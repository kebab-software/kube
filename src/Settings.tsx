import { useState } from 'react';
import { Download, Upload, RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useApp } from './context';
import { discoverInstances, Invidious, instanceOrigin } from './api';
import { exportLibrary, parseBackup } from './storage';
import { defaultLibrary } from './model';
import { Failure, Modal } from './components';
import { UpdateSettings } from './UpdateNotice';
export function Settings() {
  const { library, update, player, notify, recover, storageWarning } = useApp();
  const [instance, setInstance] = useState(library.settings.instance);
  const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [instances, setInstances] = useState<{ origin: string; cors: boolean; region: string }[]>([]);
  const [confirm, setConfirm] = useState<'history' | 'reset' | null>(null);
  async function connect() {
    setError(''); setStatus(''); setBusy(true);
    try {
      const origin = instanceOrigin(instance);
      const result = await new Invidious({ ...library.settings, instance: origin }).health();
      player.stop(); update(old => ({ ...old, settings: { ...old.settings, instance: origin } })); setInstance(origin); setStatus(result);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function importBackup(file: File) {
    try {
      if (file.size > 20_000_000) throw new Error('Backup exceeds 20 MB.');
      const next = parseBackup(await file.text());
      // Explicit replacement confirmation since this overwrites the existing library.
      if (!window.confirm(`Replace this device’s library with ${next.liked.length} liked tracks and ${next.playlists.length} playlists from the backup?`)) return;
      player.stop(); await recover(next); setInstance(next.settings.instance); notify('Library restored');
    } catch (e) { setError(`Could not import backup: ${(e as Error).message}`); }
  }
  return <div className="settings-page"><header className="page-heading"><div><h1>Settings</h1><p>Connection, playback, and local library.</p></div><ShieldCheck size={36} className="accent" /></header>
    {error && <Failure message={error} />}
    <UpdateSettings />
    <section className="settings-card"><h2>Music connection</h2><p>Kube uses your chosen Invidious instance for search, artwork, and proxied audio. Instance operators can see requests; your preferences and listening history stay on this device.</p><label htmlFor="instance">Invidious instance</label><div className="input-action"><input id="instance" type="url" value={instance} onChange={e => setInstance(e.target.value)} placeholder="https://your-instance.example" /><button className="primary" onClick={() => void connect()} disabled={busy}>{busy ? 'Testing…' : 'Test & connect'}</button></div><p className="help">Only saves after a successful search request. Public APIs may be disabled, rate-limited, or temporarily blocked by YouTube. Web builds require CORS support.</p>{status && <p className="success" role="status">{status}</p>}
      <button className="text-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const result = await discoverInstances(); setInstances(result); if (!result.length) setStatus('The official registry currently lists no API-enabled instances. You can enter your own above.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><RefreshCw size={16} /> Find instances in the official registry</button>
      {instances.map(i => <button className="instance-option" key={i.origin} onClick={() => setInstance(i.origin)}><strong>{new URL(i.origin).hostname}</strong><span>{i.region} · {i.cors ? 'Web compatible' : 'Native / desktop only'}</span></button>)}
      {!Capacitor.isNativePlatform() && !window.kubeDesktop && <a className="text-button" href="https://docs.invidious.io/installation/" target="_blank" rel="noreferrer">Host your own instance <ExternalLink size={14} /></a>}
      <label htmlFor="region">Music region</label><select id="region" value={library.settings.region} onChange={e => update(old => ({ ...old, settings: { ...old.settings, region: e.target.value } }))}>{[['GB','United Kingdom'],['US','United States'],['CA','Canada'],['AU','Australia'],['DE','Germany'],['FR','France'],['IN','India'],['JP','Japan'],['BR','Brazil']].map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select>
    </section>
    <section className="settings-card"><h2>Listening & discovery</h2><label className="toggle-row"><span><strong>Keep the music going</strong><small>Add related tracks when your queue ends.</small></span><input type="checkbox" checked={library.settings.autoplay} onChange={e => update(old => ({ ...old, settings: { ...old.settings, autoplay: e.target.checked } }))} /></label><label className="toggle-row"><span><strong>Remember listening history</strong><small>Learn from listening time and skips, on this device only.</small></span><input type="checkbox" checked={library.settings.rememberHistory} onChange={e => update(old => ({ ...old, settings: { ...old.settings, rememberHistory: e.target.checked } }))} /></label><label htmlFor="discovery">Discovery mix · {Math.round(library.settings.discovery * 100)}% exploration</label><input id="discovery" type="range" min="0" max="1" step="0.05" value={library.settings.discovery} onChange={e => update(old => ({ ...old, settings: { ...old.settings, discovery: Number(e.target.value) } }))} /><div className="range-labels"><span>Familiar artists</span><span>New discoveries</span></div><p className="help">Recommendations blend related tracks, followed artists, likes, and recent listening. Early skips reduce artist affinity; repeated listening increases it. Recent plays are downranked and artists are diversified. This is Kube’s own algorithm, not YouTube Music’s proprietary model.</p><button onClick={() => { update(old => ({ ...old, hidden: [] })); notify('Hidden tracks can appear in recommendations again'); }} disabled={!library.hidden.length}>Reset hidden tracks ({library.hidden.length})</button></section>
    <section className="settings-card"><h2>Your library</h2><p>Stored on this device. Export a backup to move your library to another device or protect it before clearing app data.</p><div className="button-row"><button onClick={() => void exportLibrary(library).catch(e => setError(e.message))}><Download size={17} /> Export backup</button><label className="file-button"><Upload size={17} /> Import backup<input type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; if (file) void importBackup(file); e.target.value = ''; }} /></label><button onClick={() => setConfirm('history')} disabled={!library.history.length}>Clear listening history</button>{storageWarning && <button className="danger" onClick={() => setConfirm('reset')}>Reset unreadable storage</button>}</div><p className="help">No account, advertising SDK, analytics, or cloud profile. Backup files contain your listening history and preferences. Streaming requires a working internet connection; Kube does not download audio for offline playback.</p></section>
    {confirm && <Modal title={confirm === 'history' ? 'Clear listening history?' : 'Reset stored library?'} close={() => setConfirm(null)}><p>{confirm === 'history' ? 'This removes listening events and their recommendation influence. Likes, playlists, and followed artists are kept.' : 'This permanently replaces the unreadable stored library with an empty library.'}</p><div className="button-row"><button onClick={() => setConfirm(null)}>Cancel</button><button className="danger" onClick={async () => { player.stop(); if (confirm === 'history') update(old => ({ ...old, history: [] })); else await recover(defaultLibrary()); setConfirm(null); notify('Done'); }}>Confirm</button></div></Modal>}
  </div>;
}
