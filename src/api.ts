import { catalogSearch, catalogHome, catalogArtist, catalogRelated, catalogClassify } from './catalog';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { trackSchema, tracksFrom, type Track, type Settings } from './model';
import { mapMusicPage } from './music';
import type { UpdateStatus } from './update-types';

declare global {
  interface Window { kubeDesktop?: {
    catalogRequest?: (path: string, body: string) => Promise<string>;
    request: (url: string) => Promise<unknown>;
    updateStatus: () => Promise<UpdateStatus>; checkUpdate: () => Promise<UpdateStatus>;
    installUpdate: () => Promise<void>; openReleases: () => Promise<void>;
    onUpdate: (callback: (state: UpdateStatus) => void) => () => void;
  } }
}
export class ApiError extends Error {}
export function instanceOrigin(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new ApiError('Enter a valid HTTPS instance address.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) throw new ApiError('Use an HTTPS instance origin, without a path, query, or password.');
  return url.origin;
}
export async function requestJson(url: string, signal?: AbortSignal): Promise<unknown> {
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let result: unknown;
    if (isTauri()) result = await invoke('request_json', { input: url });
    else if (window.kubeDesktop) result = await window.kubeDesktop.request(url);
    else if (Capacitor.isNativePlatform()) {
      const r = await CapacitorHttp.get({ url, connectTimeout: 12000, readTimeout: 18000, responseType: 'json', headers: { Accept: 'application/json' } });
      if (r.status < 200 || r.status >= 300) throw new ApiError(`Instance returned HTTP ${r.status}. It may be unavailable or rate-limited.`);
      result = r.data;
      if (typeof result === 'string') { try { result = JSON.parse(result); } catch { throw new ApiError('Instance returned a web page instead of JSON. Its API may be disabled or protected by a challenge.'); } }
    } else {
      const r = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(18000), ...(signal ? [signal] : [])]), credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new ApiError(`Instance returned HTTP ${r.status}. It may be unavailable or rate-limited.`);
      if (!r.headers.get('content-type')?.includes('json')) throw new ApiError('Instance returned a web page instead of JSON. Its API may be disabled or protected by a challenge.');
      result = await r.json();
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (result && typeof result === 'object' && 'error' in result) throw new ApiError(String(result.error).slice(0, 400));
    return result;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Cannot reach this Invidious API. Check your connection or choose another instance in Settings.${!Capacitor.isNativePlatform() && !window.kubeDesktop ? ' Web access also requires CORS support.' : ''}`);
  }
}
type VideoDetail = { track: Track; related: Track[]; formats: { itag: string; type: string; bitrate: number }[] };
const cache = new Map<string, { expires: number; data: VideoDetail }>();
export class Invidious {
  origin: string;
  constructor(readonly settings: Settings) { this.origin = instanceOrigin(settings.instance); }
  async get(path: string, params: Record<string, string> = {}, signal?: AbortSignal) {
    const url = new URL(`${this.origin}/api/v1/${path}`);
    url.search = new URLSearchParams({ region: this.settings.region, ...params }).toString();
    return requestJson(url.href, signal);
  }
  private async musicPage(rows: unknown, signal?: AbortSignal) {
    const candidates = tracksFrom(rows);
    let failures = 0;
    let failure: unknown;
    const verified = await mapMusicPage(candidates, async (track): Promise<Track | undefined> => {
      try { return await catalogClassify(this.settings, track, signal) ? { ...track, musicVerified: true, musicSource: 'youtube-music' as const } : undefined; }
      catch (error) {
        signal?.throwIfAborted();
        if (error instanceof ApiError && /HTTP (404|410)/.test(error.message)) return undefined;
        failures++;
        failure = error;
        return undefined;
      }
    }, signal);
    if (failures && failures === candidates.length) throw failure;
    return verified.filter((t): t is Track => Boolean(t?.musicVerified && !t.liveNow));
  }
  async trending(signal?: AbortSignal) { return catalogHome(this.settings, signal); }
  async searchPage(query: string, page = 1, signal?: AbortSignal) { return catalogSearch(this.settings, query, page, signal); }
  async search(query: string, page = 1, signal?: AbortSignal) { return (await this.searchPage(query, page, signal)).tracks; }
  async channel(id: string, _continuation?: string, signal?: AbortSignal) { return catalogArtist(this.settings, id, signal); }
  async playlist(id: string, page = 1) {
    if (!/^[\w-]{10,100}$/.test(id)) throw new ApiError('Enter a valid YouTube playlist ID or URL.');
    const data = await this.get(`playlists/${id}`, { page: String(page) }) as { title?: string; videos?: unknown; videoCount?: number };
    return { title: data.title || 'Imported playlist', tracks: await this.musicPage(data.videos), scanned: Array.isArray(data.videos) ? data.videos.length : 0, count: data.videoCount || 0 };
  }
  private async details(id: string, signal?: AbortSignal): Promise<VideoDetail> {
    if (!/^[\w-]{11}$/.test(id)) throw new ApiError('Invalid track ID.');
    const key = `${this.origin}:${this.settings.region}:${id}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.data;
    const raw = await this.get(`videos/${id}`, {}, signal) as Record<string, unknown>;
    const track = trackSchema.parse(raw);
    const formats = (Array.isArray(raw.adaptiveFormats) ? raw.adaptiveFormats : []).flatMap((f: Record<string, unknown>) => {
      if (typeof f.type !== 'string' || !f.type.startsWith('audio/') || !/^\d+$/.test(String(f.itag))) return [];
      return [{ itag: String(f.itag), type: f.type, bitrate: Number(f.bitrate) || 0 }];
    });
    const data = { track, related: tracksFrom(raw.recommendedVideos), formats };
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { data, expires: Date.now() + 5 * 60_000 });
    return data;
  }
  async classify(track: Track, signal?: AbortSignal) {
    return catalogClassify(this.settings, track, signal);
  }
  async video(id: string, signal?: AbortSignal, knownTrack?: Track) {
    const detail = await this.details(id, signal);
    if (!await catalogClassify(this.settings, knownTrack?.videoId === id ? knownTrack : detail.track, signal) || detail.track.liveNow) throw new ApiError('This video has no supported music metadata.');
    return detail;
  }
  async related(id: string, signal?: AbortSignal) {
    return catalogRelated(this.settings, id, signal);
  }
  stream(id: string, itag: string) {
    return `${this.origin}/latest_version?${new URLSearchParams({ id, itag, local: 'true' })}`;
  }
  async health() {
    const tracks = tracksFrom(await this.get('search', { q: 'music', type: 'video' }));
    if (!tracks.length) throw new ApiError('API responded, but returned no playable search results.');
    return `${tracks.length} search results received. Playback still depends on the instance’s media proxy.`;
  }
}
export function thumbnail(track: Track, origin: string) {
  // Fetch artwork through the chosen instance; never send the listener to Google image hosts.
  return `${origin}/vi/${encodeURIComponent(track.videoId)}/mqdefault.jpg`;
}
export async function discoverInstances() {
  const raw = await requestJson('https://api.invidious.io/');
  if (!Array.isArray(raw)) throw new ApiError('Invalid instance registry response.');
  return raw.flatMap(row => {
    if (!Array.isArray(row) || !row[1] || row[1].type !== 'https' || !row[1].api) return [];
    try { return [{ origin: instanceOrigin(row[1].uri), cors: Boolean(row[1].cors), region: String(row[1].region || '') }]; } catch { return []; }
  });
}
