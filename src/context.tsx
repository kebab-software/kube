import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from 'react';
import { type Library, type Track, type Listen } from './model';
import { saveLibrary } from './storage';
import { Player } from './player';

type Context = {
  library: Library; update: (fn: (old: Library) => Library) => void;
  player: Player; notice: string; notify: (message: string) => void;
  like: (track: Track) => void; hide: (track: Track) => void;
  storageWarning: string; recover: (library: Library) => Promise<void>;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({ initial, warning = '', children }: { initial: Library; warning?: string; children: ReactNode }) {
  const [library, setLibrary] = useState(initial);
  const latest = useRef(library); latest.current = library;
  const [notice, notify] = useState('');
  const [storageWarning, setStorageWarning] = useState(warning);
  const writable = useRef(!warning);
  const update = (fn: (old: Library) => Library) => {
    const next = fn(latest.current); latest.current = next; setLibrary(next);
    if (writable.current) void saveLibrary(next).catch(() => setStorageWarning('Changes could not be saved. Export a backup before closing Kube.'));
  };
  const playerRef = useRef<Player | null>(null);
  if (!playerRef.current) playerRef.current = new Player(() => latest.current, (listen: Listen) => {
    update(old => ({ ...old, history: [listen, ...old.history.filter(h => h.at !== listen.at)].slice(0, 3000) }));
  });
  const player = playerRef.current;
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => notify(''), 5000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => () => player.destroy(), [player]);
  return <AppContext.Provider value={{ library, update, player, notice, notify, storageWarning,
    like: track => update(old => ({ ...old, liked: old.liked.some(t => t.videoId === track.videoId) ? old.liked.filter(t => t.videoId !== track.videoId) : [track, ...old.liked], hidden: old.hidden.filter(id => id !== track.videoId) })),
    hide: track => { update(old => ({ ...old, hidden: [...new Set([...old.hidden, track.videoId])], liked: old.liked.filter(t => t.videoId !== track.videoId) })); notify('Hidden from recommendations. You can undo this in Settings.'); },
    recover: async next => { await saveLibrary(next); writable.current = true; setStorageWarning(''); latest.current = next; setLibrary(next); },
  }}>{children}</AppContext.Provider>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('App provider missing'); return value; }
