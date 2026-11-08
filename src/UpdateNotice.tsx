import { useEffect, useSyncExternalStore } from 'react';
import { updateStore, startUpdates } from './updates';
export function UpdateNotice() {
  const update = useSyncExternalStore(updateStore.subscribe, updateStore.snapshot);
  useEffect(startUpdates, []);
  if (update.status !== 'ready') return null;
  return <div className="update-notice" role="status"><span>Kube {update.version} is ready.</span><button onClick={() => void updateStore.install()}>{update.platform === 'android' ? 'Install update' : 'Restart to update'}</button></div>;
}
export function UpdateSettings() {
  const update = useSyncExternalStore(updateStore.subscribe, updateStore.snapshot);
  return <section className="settings-card"><h2>App updates</h2><p>Kube {update.currentVersion}</p><p role="status">{update.message}{update.status === 'downloading' && update.progress !== undefined ? ` ${update.progress}%` : ''}</p><div className="button-row"><button onClick={() => void updateStore.check()} disabled={['unavailable','checking','downloading','ready'].includes(update.status)}>Check for updates</button>{update.status === 'ready' && <button className="primary" onClick={() => void updateStore.install()}>{update.platform === 'android' ? 'Install update' : 'Restart to update'}</button>}<button onClick={() => void updateStore.openReleases()}>Release notes</button></div><p className="help">Release builds check GitHub on startup and every six hours while running. Downloads are automatic. Android requires system confirmation to install. Checks contact GitHub; no listening history is sent.</p></section>;
}
