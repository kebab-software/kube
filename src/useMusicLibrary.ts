import { useEffect, useRef } from 'react';
import { Invidious } from './api';
import { uniqueTracks, type Library, type Track } from './model';
import { mapMusicPage } from './music';

export function useMusicLibrary(stored: Library, update: (fn: (old: Library) => Library) => void) {
  const latest = useRef(update);
  latest.current = update;
  const pending = uniqueTracks([...stored.liked, ...stored.history.map(h => h.track), ...stored.playlists.flatMap(p => p.tracks)])
    .filter(t => t.musicVerified === undefined);
  const ids = pending.map(t => t.videoId).join(',');
  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    const api = new Invidious(stored.settings);
    async function migrate() {
      const decisions = new Map<string, boolean>();
      await mapMusicPage(pending, async track => {
        try { decisions.set(track.videoId, await api.classify(track, controller.signal)); }
        catch { /* Keep unresolved entries in storage for a later check. */ }
      }, controller.signal);
      if (controller.signal.aborted || !decisions.size) return;
      const mark = (t: Track) => decisions.has(t.videoId) ? { ...t, musicVerified: decisions.get(t.videoId) } : t;
      latest.current(old => ({ ...old, liked: old.liked.map(mark), history: old.history.map(h => ({ ...h, track: mark(h.track) })),
        playlists: old.playlists.map(p => ({ ...p, tracks: p.tracks.map(mark) })) }));
    }
    void migrate().catch(() => {});
    return () => controller.abort();
  }, [ids, stored.settings.instance, stored.settings.region]);
  return { ...stored, liked: stored.liked.filter(t => t.musicVerified), history: stored.history.filter(h => h.track.musicVerified),
    playlists: stored.playlists.map(p => ({ ...p, tracks: p.tracks.filter(t => t.musicVerified) })) };
}
