import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Heart, Play, Plus, MoreHorizontal, ListPlus, Ban, Radio, X, Music2, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Volume2, ListMusic } from 'lucide-react';
import { useApp } from './context';
import { thumbnail } from './api';
import { duration, type Track } from './model';

export function IconButton({ label, children, onClick, active = false, disabled = false, className = '' }: { label: string; children: ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  return <button className={`icon-button ${active ? 'active' : ''} ${className}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}
export function Cover({ track, large = false }: { track: Track; large?: boolean }) {
  const { library } = useApp(); const [failed, setFailed] = useState(false);
  return <div className={`cover ${large ? 'large' : ''}`}>{!failed ? <img src={thumbnail(track, library.settings.instance)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <Music2 />}</div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><div className="empty-icon"><Music2 size={28} /></div><h3>{title}</h3><p>{children}</p></div>;
}
export function Loading() { return <div className="loading" role="status"><span className="spinner" /> Finding your next listen…</div>; }
export function Failure({ message, retry }: { message: string; retry?: () => void }) { return <div className="failure" role="alert"><strong>Something interrupted the music</strong><p>{message}</p>{retry && <button onClick={retry}>Try again</button>}</div>; }
export function TrackRow({ track, list, index, reason, onArtist, onAdd, onRadio }: { track: Track; list: Track[]; index: number; reason?: string; onArtist: (track: Track) => void; onAdd: (track: Track) => void; onRadio: (track: Track) => void }) {
  const { player, library, like, hide, notify } = useApp(); const state = useSyncExternalStore(player.subscribe, player.snapshot);
  const [menu, setMenu] = useState(false);
  const selected = player.current()?.videoId === track.videoId;
  return <div className={`track-row ${selected ? 'selected' : ''}`}>
    <button className="row-play" onClick={() => selected ? player.toggle() : void player.play(track, list)} aria-label={`Play ${track.title}`}>{selected && state.playing ? <Pause size={16} /> : <><span>{String(index + 1).padStart(2, '0')}</span><Play size={16} /></>}</button>
    <Cover track={track} />
    <div className="track-copy"><button className="track-title" onClick={() => void player.play(track, list)}>{track.title}</button><button className="artist-link" onClick={() => onArtist(track)}>{track.author}</button></div>
    {reason && <span className="track-reason">{reason}</span>}
    <span className="duration">{duration(track.lengthSeconds)}</span>
    <IconButton label={library.liked.some(t => t.videoId === track.videoId) ? `Unlike ${track.title}` : `Like ${track.title}`} onClick={() => like(track)} active={library.liked.some(t => t.videoId === track.videoId)}><Heart size={17} /></IconButton>
    <div className="menu-wrap"><IconButton label={`Options for ${track.title}`} onClick={() => setMenu(!menu)}><MoreHorizontal size={19} /></IconButton>{menu && <><button className="menu-dismiss" aria-label="Close track options" onClick={() => setMenu(false)} /><div className="track-menu"><button onClick={() => { player.enqueue(track); notify('Added to queue'); setMenu(false); }}><ListPlus size={16} /> Add to queue</button><button onClick={() => { onAdd(track); setMenu(false); }}><Plus size={16} /> Add to playlist</button><button onClick={() => { onRadio(track); setMenu(false); }}><Radio size={16} /> Start track radio</button><button onClick={() => { hide(track); setMenu(false); }}><Ban size={16} /> Not for me</button></div></>}</div>
  </div>;
}
export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  // Native dialog provides focus containment, Escape handling, and a modal accessibility tree.
  return <dialog ref={node => { if (node && !node.open) node.showModal(); }} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="modal-heading"><h2>{title}</h2><IconButton label="Close dialog" onClick={close}><X /></IconButton></div>{children}</dialog>;
}
export function PlayerBar({ openQueue }: { openQueue: () => void }) {
  const { player, library, update, like } = useApp(); const state = useSyncExternalStore(player.subscribe, player.snapshot); const track = player.current();
  return <footer className="player-bar" aria-label="Music player">
    <div className="now-playing">{track ? <Cover track={track} /> : <div className="cover"><Music2 /></div>}<div className="now-copy"><strong>{track?.title || 'Your next favourite is out there'}</strong><span>{track?.author || 'Choose a track to start listening'}</span></div>{track && <IconButton label="Like current track" active={library.liked.some(t => t.videoId === track.videoId)} onClick={() => like(track)}><Heart size={18} /></IconButton>}</div>
    <div className="transport"><div className="transport-buttons"><IconButton label="Shuffle upcoming tracks" disabled={!track} onClick={() => player.shuffle()}><Shuffle size={17} /></IconButton><IconButton label="Previous track" disabled={!track} onClick={() => void player.previous()}><SkipBack size={20} /></IconButton><IconButton label={state.playing ? 'Pause' : 'Play'} disabled={!track} className="primary-play" onClick={() => player.toggle()}>{state.loading ? <span className="spinner" /> : state.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</IconButton><IconButton label="Next track" disabled={!track} onClick={() => void player.next()}><SkipForward size={20} /></IconButton><IconButton label={`Repeat: ${state.repeat}`} active={state.repeat !== 'off'} disabled={!track} onClick={() => player.repeat()}>{state.repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}</IconButton></div><div className="seek"><span>{duration(state.position)}</span><input aria-label="Playback position" type="range" min="0" max={state.duration || 1} step="0.1" value={Math.min(state.position, state.duration || 1)} disabled={!track} onChange={e => player.seek(Number(e.target.value))} /><span>{duration(state.duration)}</span></div></div>
    <div className="player-extras"><Volume2 size={18} /><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={library.settings.volume} onChange={e => { const volume = Number(e.target.value); player.volume(volume); update(old => ({ ...old, settings: { ...old.settings, volume } })); }} /><IconButton label="Open queue" onClick={openQueue}><ListMusic size={21} /></IconButton></div>
  </footer>;
}
