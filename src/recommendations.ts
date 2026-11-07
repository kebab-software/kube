import { artistKey, uniqueTracks, type Library, type Track } from './model';
import type { Invidious } from './api';
export type Recommendation = { track: Track; reason: string; score: number };
const tokens = (text: string) => new Set(text.toLowerCase().replace(/\b(official|video|audio|music|lyrics|hd|4k|feat)\b/g, '').match(/[\p{L}\p{N}]{3,}/gu) || []);
export function rankRecommendations(candidates: Track[], library: Library, related = new Set<string>(), now = Date.now()): Recommendation[] {
  const affinities = new Map<string, number>();
  const words = new Map<string, number>();
  const recentlyPlayed = new Map<string, number>();
  const liked = new Set(library.liked.map(t => t.videoId));
  const hidden = new Set(library.hidden);
  const followed = new Set(library.artists.map(artistKey));
  for (const t of library.liked) {
    affinities.set(artistKey(t), (affinities.get(artistKey(t)) || 0) + 3);
    for (const token of tokens(t.title)) words.set(token, (words.get(token) || 0) + 1);
  }
  for (const h of library.history) {
    const age = Math.max(0, (now - h.at) / 86_400_000);
    const decay = Math.exp(-age / 21);
    const fraction = h.track.lengthSeconds ? Math.min(h.seconds / h.track.lengthSeconds, 1) : Math.min(h.seconds / 180, 1);
    const weight = (h.completed || fraction > 0.65 ? 2 : h.seconds < 20 ? -1 : 0.5) * decay;
    affinities.set(artistKey(h.track), (affinities.get(artistKey(h.track)) || 0) + weight);
    recentlyPlayed.set(h.track.videoId, Math.min(age, recentlyPlayed.get(h.track.videoId) ?? Infinity));
  }
  const scored = uniqueTracks(candidates).filter(t => !hidden.has(t.videoId) && t.lengthSeconds >= 45 && t.lengthSeconds <= 3600 && !t.liveNow).map(track => {
    const key = artistKey(track);
    const affinity = Math.max(-3, Math.min(8, affinities.get(key) || 0));
    const familiar = affinity > 0 || followed.has(key);
    const textScore = [...tokens(track.title)].reduce((s, w) => s + Math.min(1, (words.get(w) || 0) * 0.15), 0);
    const age = recentlyPlayed.get(track.videoId);
    const score = affinity * (1 - library.settings.discovery) + (followed.has(key) ? 3 : 0) + (related.has(track.videoId) ? 2.5 : 0) + Math.min(2, textScore) + (!familiar ? 4 * library.settings.discovery : 0) + (liked.has(track.videoId) ? 0.7 : 0) - (age === undefined ? 0 : 5 * Math.exp(-age / 2));
    const reason = followed.has(key) ? 'From an artist you follow' : related.has(track.videoId) ? 'Related to your listening' : affinity > 0 ? 'An artist you come back to' : 'Something to explore';
    return { track, score, reason };
  }).sort((a, b) => b.score - a.score || a.track.videoId.localeCompare(b.track.videoId));
  // Greedy reranking discourages long runs from the same artist, without losing candidates.
  const result: Recommendation[] = [];
  const counts = new Map<string, number>();
  while (scored.length && result.length < 40) {
    let best = 0, bestScore = -Infinity;
    scored.forEach((item, i) => {
      const key = artistKey(item.track);
      const adjusted = item.score - (counts.get(key) || 0) * 3 - (result.length && artistKey(result[result.length - 1].track) === key ? 4 : 0);
      if (adjusted > bestScore) { best = i; bestScore = adjusted; }
    });
    const [item] = scored.splice(best, 1); result.push(item);
    const key = artistKey(item.track); counts.set(key, (counts.get(key) || 0) + 1);
  }
  return result;
}
export async function recommendations(api: Invidious, library: Library, signal?: AbortSignal) {
  const seeds = uniqueTracks([...library.history.filter(h => h.seconds >= 30).slice(0, 10).map(h => h.track), ...library.liked]).slice(0, 3);
  const relatedIds = new Set<string>();
  const requests: Promise<Track[]>[] = [api.trending(signal)];
  for (const seed of seeds) requests.push(api.video(seed.videoId, signal).then(d => { d.related.forEach(t => relatedIds.add(t.videoId)); return d.related; }));
  for (const artist of library.artists.slice(0, 2)) requests.push(api.channel(artist.authorId, undefined, signal).then(d => d.tracks));
  const results = await Promise.allSettled(requests);
  const tracks = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!tracks.length) throw new Error('Could not load music from this instance. Check the connection in Settings or try searching.');
  return { items: rankRecommendations(tracks, library, relatedIds), partial: results.some(r => r.status === 'rejected') };
}
