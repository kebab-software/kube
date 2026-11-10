
import { Innertube } from 'youtubei.js/web';
import type { YTMusic } from 'youtubei.js/web';
type Search = YTMusic.Search;
type SearchContinuation = Awaited<ReturnType<Search['getContinuation']>>;
import { catalogFetch } from './catalog-transport';
import { trackSchema, uniqueTracks, type Track, type Settings } from './model';

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === 'object' ? value as Row : {};
const musicIds = new Set<string>();
const sessions = new Map<string, Promise<Innertube>>();
async function client(settings: Settings, signal?: AbortSignal) {
  signal?.throwIfAborted();
  // Fetch cancellation is checked at the catalog operation boundaries. Shared sessions outlive views.
  const key = settings.region + settings.catalogProxy;
  if (!sessions.has(key)) {
    const pending = Innertube.create({ lang: 'en', location: settings.region, generate_session_locally: true,
      retrieve_player: false, fetch: catalogFetch(settings.catalogProxy) });
    sessions.set(key, pending);
    void pending.catch(() => sessions.delete(key));
  }
  return sessions.get(key)!;
}
function text(value: unknown) {
  return typeof value === 'string' ? value : String(value ?? '');
}
export function catalogTracks(value: unknown): Track[] {
  const found: Track[] = [];
  const seen = new Set<object>();
  function visit(value: unknown) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const item = record(value);
    const id = item.video_id || item.id;
    if (['song', 'video'].includes(String(item.item_type)) || item.type === 'PlaylistPanelVideo') {
      const artists = Array.isArray(item.artists) ? item.artists.map(record) : [];
      const author = record(item.author);
      const parsed = trackSchema.safeParse({ videoId: id, title: text(item.title), author: artists.map(a => text(a.name)).join(', ') || text(author.name || item.author),
        authorId: artists[0]?.channel_id || author.channel_id || '', lengthSeconds: Number(record(item.duration).seconds) || 0,
        videoThumbnails: [], musicVerified: true, musicSource: 'youtube-music' });
      if (parsed.success) { found.push(parsed.data); musicIds.add(parsed.data.videoId); }
    }
    for (const key of ['sections','contents','items','content','primary_renderer','songs']) visit(item[key]);
  }
  visit(value);
  return uniqueTracks(found);
}
type Results = { songs: Search | SearchContinuation; videos: Search | SearchContinuation };
const pages = new Map<string, Results>();
export async function catalogSearch(settings: Settings, query: string, page = 1, signal?: AbortSignal) {
  const key = settings.region + settings.catalogProxy + query;
  const music = (await client(settings, signal)).music;
  let results: Results;
  let activeSongs = true, activeVideos = true;
  if (page === 1) {
    const [songs, videos] = await Promise.all([music.search(query, { type: 'song' }), music.search(query, { type: 'video' })]);
    results = { songs, videos };
    if (pages.size > 30) pages.clear();
  } else {
    const previous = pages.get(key + ':' + (page - 1));
    if (!previous) throw new Error('Search expired. Search again to load more music.');
    activeSongs = previous.songs.has_continuation; activeVideos = previous.videos.has_continuation;
    results = {
      songs: previous.songs.has_continuation ? await previous.songs.getContinuation() : previous.songs,
      videos: previous.videos.has_continuation ? await previous.videos.getContinuation() : previous.videos,
    };
  }
  signal?.throwIfAborted();
  pages.set(key + ':' + page, results);
  return { tracks: catalogTracks([activeSongs ? results.songs : undefined, activeVideos ? results.videos : undefined]), hasMore: results.songs.has_continuation || results.videos.has_continuation, nextPage: page + 1 };
}
export async function catalogHome(settings: Settings, signal?: AbortSignal) {
  const music = (await client(settings, signal)).music;
  const home = await music.getHomeFeed();
  let tracks = catalogTracks(home);
  if (tracks.length < 8) {
    const playlists = home.sections?.flatMap(section => 'contents' in section ? Array.from(section.contents) : [])
      .filter(item => 'item_type' in item && item.item_type === 'playlist' && 'id' in item).slice(0, 2) ?? [];
    const expanded = await Promise.allSettled(playlists.map(item => music.getPlaylist(String(record(item).id))));
    tracks = uniqueTracks([...tracks, ...expanded.flatMap(result => result.status === 'fulfilled' ? catalogTracks(result.value) : [])]);
  }
  if (!tracks.length) tracks = catalogTracks(await music.getExplore());
  if (!tracks.length) throw new Error('YouTube Music returned no playable catalog tracks. Try searching or retry shortly.');
  signal?.throwIfAborted();
  return tracks;
}
export async function catalogArtist(settings: Settings, id: string, signal?: AbortSignal) {
  const artist = await (await client(settings, signal)).music.getArtist(id);
  const tracks = catalogTracks([artist, await artist.getAllSongs()]);
  signal?.throwIfAborted();
  return { tracks, continuation: undefined };
}
export async function catalogRelated(settings: Settings, id: string, signal?: AbortSignal) {
  const info = await (await client(settings, signal)).music.getInfo(id);
  const panel = await info.getUpNext();
  signal?.throwIfAborted();
  return catalogTracks(panel).filter(t => t.videoId !== id);
}
export async function catalogClassify(settings: Settings, track: Track, signal?: AbortSignal) {
  if (musicIds.has(track.videoId) || track.musicSource === 'youtube-music') return true;
  const result = await catalogSearch(settings, track.title, 1, signal);
  return result.tracks.some(t => t.videoId === track.videoId);
}
