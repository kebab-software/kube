import { Preferences } from '@capacitor/preferences';
import { librarySchema, defaultLibrary, type Library } from './model';
const KEY = 'kube.library.v1';
let pending = Promise.resolve();
export async function loadLibrary(): Promise<{ library: Library; warning?: string }> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return { library: defaultLibrary() };
    return { library: librarySchema.parse(JSON.parse(value)) };
  } catch {
    // Never overwrite an unreadable library automatically.
    return { library: defaultLibrary(), warning: 'Your saved library could not be read. Changes will not be saved until you import a valid backup or explicitly reset storage.' };
  }
}
export function saveLibrary(library: Library) {
  const value = JSON.stringify(library);
  const save = pending.catch(() => {}).then(() => Preferences.set({ key: KEY, value }));
  pending = save;
  return save;
}
export function parseBackup(text: string): Library {
  if (text.length > 20_000_000) throw new Error('Backup exceeds 20 MB.');
  const backup = librarySchema.parse(JSON.parse(text));
  // Imported files can have stale or edited verification flags.
  const recheck = (track: Library['liked'][number]) => ({ ...track, musicVerified: undefined });
  return { ...backup, liked: backup.liked.map(recheck), history: backup.history.map(h => ({ ...h, track: recheck(h.track) })),
    playlists: backup.playlists.map(p => ({ ...p, tracks: p.tracks.map(recheck) })) };
}
export async function exportLibrary(library: Library) {
  const text = JSON.stringify(library, null, 2);
  // Native Android exports via Storage Access Framework, not unsupported blob downloads.
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { NativePlayer } = await import('./native');
    await NativePlayer.exportBackup({ content: text });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `kube-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
