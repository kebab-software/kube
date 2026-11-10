import { Capacitor } from '@capacitor/core';
import { Invidious } from './api';
import { NativePlayer } from './native';
import { rankRecommendations } from './recommendations';
import { type Library, type Listen, type Track, uniqueTracks } from './model';

export type PlayerState = {
  queue: Track[]; index: number; playing: boolean; loading: boolean;
  position: number; duration: number; error: string; repeat: 'off' | 'all' | 'one';
};
export class Player {
  private state: PlayerState = { queue: [], index: -1, playing: false, loading: false, position: 0, duration: 0, error: '', repeat: 'off' };
  private listeners = new Set<() => void>();
  private audio = new Audio();
  private native = Capacitor.isNativePlatform();
  private generation = 0;
  private controller?: AbortController;
  private listened = 0;
  private started = 0;
  private lastPosition = 0;
  private savedAt = 0;
  private sessionTrack?: Track;
  private sourceIndex = 0;
  private sources: string[] = [];
  private nativeTimer?: ReturnType<typeof setInterval>;
  private handlingEnd = false;
  constructor(private library: () => Library, private record: (listen: Listen) => void) {
    this.audio.preload = 'none';
    this.audio.addEventListener('timeupdate', () => this.progress(this.audio.currentTime, this.audio.duration));
    this.audio.addEventListener('playing', () => this.update({ playing: true, loading: false, error: '' }));
    this.audio.addEventListener('pause', () => { this.update({ playing: false }); this.flush(); });
    this.audio.addEventListener('waiting', () => this.update({ loading: true }));
    this.audio.addEventListener('ended', () => { void this.ended(); });
    this.audio.addEventListener('error', () => { void this.fallback(); });
    if (this.native) this.nativeTimer = setInterval(() => { void this.poll(); }, 1000);
    if ('mediaSession' in navigator && !this.native) {
      navigator.mediaSession.setActionHandler('play', () => { void this.resume(); });
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => { void this.next(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => { void this.previous(); });
      navigator.mediaSession.setActionHandler('seekto', d => this.seek(d.seekTime || 0));
      navigator.mediaSession.setActionHandler('seekbackward', d => this.seek(this.state.position - (d.seekOffset || 10)));
      navigator.mediaSession.setActionHandler('seekforward', d => this.seek(this.state.position + (d.seekOffset || 10)));
    }
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  current = () => this.state.queue[this.state.index];
  private update(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l());
    if ('mediaSession' in navigator && !this.native) navigator.mediaSession.playbackState = this.state.playing ? 'playing' : 'paused';
  }
  private progress(position: number, duration: number) {
    const delta = position - this.lastPosition;
    if (this.state.playing && delta > 0 && delta < 3) this.listened += delta;
    this.lastPosition = position;
    this.update({ position, duration: Number.isFinite(duration) && duration > 0 ? duration : this.current()?.lengthSeconds || 0 });
    if (this.listened - this.savedAt >= 30) { this.flush(); this.savedAt = this.listened; }
    if ('mediaSession' in navigator && !this.native && this.state.duration > 0) {
      try { navigator.mediaSession.setPositionState({ duration: this.state.duration, position: Math.min(position, this.state.duration), playbackRate: 1 }); } catch { /* Platform lacks position state. */ }
    }
  }
  private async poll() {
    if (this.state.index < 0 || this.state.loading) return;
    try {
      const s = await NativePlayer.status();
      if (s.id && s.id !== this.current()?.videoId) {
        const index = this.state.queue.findIndex(t => t.videoId === s.id);
        if (index >= 0) {
          this.flush(true); this.listened = 0; this.savedAt = 0; this.lastPosition = s.position; this.started = Date.now();
          this.sessionTrack = this.state.queue[index]; this.sources = []; this.update({ index });
        }
      }
      this.update({ playing: s.playing }); this.progress(s.position, s.duration);
      if (s.error && !this.state.error) { if (this.sources.length) await this.fallback(); else this.failPlayback(); }
      if (s.ended && !this.handlingEnd && !this.state.error) await this.ended();
    } catch { this.update({ error: 'Android playback service is unavailable.', playing: false }); }
  }
  private flush(completed = false) {
    const track = this.sessionTrack;
    if (track && this.listened >= 3 && this.library().settings.rememberHistory) this.record({ track, at: this.started, seconds: Math.round(this.listened), completed });
  }
  async play(track: Track, queue: Track[] = [track]) {
    this.flush();
    const list = uniqueTracks(queue.some(t => t.videoId === track.videoId) ? queue : [track, ...queue]);
    this.update({ queue: list, index: list.findIndex(t => t.videoId === track.videoId) });
    await this.load();
  }
  private async load() {
    const track = this.current(); if (!track) return;
    const generation = ++this.generation;
    this.controller?.abort(); this.controller = new AbortController();
    this.sources = []; this.sourceIndex = 0;
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
    if (this.native) await NativePlayer.stop().catch(() => {});
    if (generation !== this.generation) return;
    this.listened = 0; this.savedAt = 0; this.lastPosition = 0; this.started = Date.now();
    this.sessionTrack = track;
    this.update({ position: 0, duration: track.lengthSeconds, loading: true, playing: false, error: '' });
    try {
      const api = new Invidious(this.library().settings);
      const detail = await api.video(track.videoId, this.controller.signal, track);
      if (generation !== this.generation) return;
      const formats = detail.formats.filter(f => this.native || Boolean(this.audio.canPlayType(f.type))).sort((a, b) => Number(b.type.startsWith('audio/mp4')) - Number(a.type.startsWith('audio/mp4')) || b.bitrate - a.bitrate);
      this.sources = formats.map(f => api.stream(track.videoId, f.itag));
      if (!this.sources.length) throw new Error('This track has no supported audio stream. It may be restricted or unavailable.');
      if ('mediaSession' in navigator && !this.native) navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.author, album: 'Kube' });
      await this.startSource(generation);
    } catch (e) {
      if (generation === this.generation) this.update({ loading: false, playing: false, error: e instanceof Error ? e.message : 'Could not load track.' });
    }
  }
  private async startSource(generation: number) {
    const track = this.current(); if (!track || generation !== this.generation) return;
    if (this.native) {
      await NativePlayer.play({ url: this.sources[this.sourceIndex], title: track.title, artist: track.author, id: track.videoId });
      await NativePlayer.volume({ value: this.library().settings.volume });
      await this.syncNativeQueue();
      this.update({ loading: false, playing: true });
    } else {
      this.audio.src = this.sources[this.sourceIndex];
      this.audio.volume = this.library().settings.volume;
      try { await this.audio.play(); }
      catch (e) {
        if (generation !== this.generation) return;
        if (e instanceof DOMException && e.name === 'NotAllowedError') this.update({ loading: false, error: 'Your browser requires another tap. Press Play to start audio.' });
        // Media failures trigger the error event, which tries the next supported format.
        else if (!(e instanceof DOMException && ['AbortError', 'NotSupportedError'].includes(e.name))) throw e;
      }
    }
  }
  private async fallback() {
    if (!this.sources.length) return;
    if (++this.sourceIndex < Math.min(this.sources.length, 3)) {
      try { await this.startSource(this.generation); } catch { this.failPlayback(); }
    } else this.failPlayback();
  }
  private failPlayback() { this.update({ loading: false, playing: false, error: 'The instance could not serve this audio. Try another track or change the instance in Settings. Your queue is preserved.' }); }
  async resume() {
    if (!this.current()) return;
    if (this.state.error && !this.state.error.includes('another tap')) return this.load();
    try {
      if (this.native) await NativePlayer.resume(); else await this.audio.play();
      this.update({ playing: true, error: '' });
    } catch { this.failPlayback(); }
  }
  pause() { if (this.native) void NativePlayer.pause().catch(() => this.failPlayback()); else this.audio.pause(); this.update({ playing: false, loading: false }); this.flush(); }
  toggle() { if (this.state.playing) this.pause(); else void this.resume(); }
  seek(value: number) {
    const seconds = Math.max(0, Math.min(value, this.state.duration)); this.lastPosition = seconds;
    if (this.native) void NativePlayer.seek({ seconds }).catch(() => this.failPlayback()); else this.audio.currentTime = seconds;
    this.update({ position: seconds });
  }
  volume(value: number) { this.audio.volume = value; if (this.native) void NativePlayer.volume({ value }).catch(() => {}); }
  private async syncNativeQueue() {
    if (!this.native || !this.current()) return;
    const api = new Invidious(this.library().settings);
    await NativePlayer.upcoming({ tracks: this.state.queue.slice(this.state.index + 1).filter(track => track.musicVerified).map(track => ({ id: track.videoId, title: track.title, artist: track.author, url: api.stream(track.videoId, '140') })) });
    await NativePlayer.repeat({ mode: this.state.repeat });
  }
  enqueue(track: Track) { this.update({ queue: [...this.state.queue, track] }); void this.syncNativeQueue().catch(() => this.failPlayback()); }
  remove(index: number) {
    if (index === this.state.index) return;
    this.update({ queue: this.state.queue.filter((_, i) => i !== index), index: index < this.state.index ? this.state.index - 1 : this.state.index });
    void this.syncNativeQueue().catch(() => this.failPlayback());
  }
  move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (index <= this.state.index || next <= this.state.index || next >= this.state.queue.length) return;
    const queue = [...this.state.queue]; [queue[index], queue[next]] = [queue[next], queue[index]]; this.update({ queue });
    void this.syncNativeQueue().catch(() => this.failPlayback());
  }
  shuffle() {
    const past = this.state.queue.slice(0, this.state.index + 1), future = this.state.queue.slice(this.state.index + 1);
    for (let i = future.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [future[i], future[j]] = [future[j], future[i]]; }
    this.update({ queue: [...past, ...future] });
    void this.syncNativeQueue().catch(() => this.failPlayback());
  }
  repeat() { this.update({ repeat: this.state.repeat === 'off' ? 'all' : this.state.repeat === 'all' ? 'one' : 'off' }); if (this.native) void NativePlayer.repeat({ mode: this.state.repeat }).catch(() => this.failPlayback()); }
  async previous() {
    if (this.state.position > 3) return this.seek(0);
    if (this.state.index > 0) { this.flush(); this.update({ index: this.state.index - 1 }); await this.load(); }
  }
  async next(automatic = false) {
    this.flush(automatic);
    if (automatic && this.state.repeat === 'one') return this.load();
    if (this.state.index + 1 < this.state.queue.length) { this.update({ index: this.state.index + 1 }); return this.load(); }
    if (this.state.repeat === 'all' && this.state.queue.length) { this.update({ index: 0 }); return this.load(); }
    if (this.library().settings.autoplay && this.current()) {
      const generation = this.generation;
      this.update({ loading: true });
      try {
        const api = new Invidious(this.library().settings);
        const related = await api.related(this.current().videoId);
        if (generation !== this.generation) return;
        const queued = new Set(this.state.queue.map(t => t.videoId));
        const candidates = rankRecommendations(related.filter(t => !queued.has(t.videoId)), this.library()).slice(0, 12).map(r => r.track);
        if (candidates.length) { this.update({ queue: [...this.state.queue, ...candidates], index: this.state.queue.length }); return this.load(); }
      } catch (e) { if (generation === this.generation) this.update({ error: e instanceof Error ? e.message : 'Could not extend the queue.' }); }
      if (generation !== this.generation) return;
    }
    this.pause(); this.update({ loading: false });
  }
  private async ended() { this.handlingEnd = true; try { await this.next(true); } finally { this.handlingEnd = false; } }
  stop() {
    this.flush(); ++this.generation; this.controller?.abort(); this.sources = [];
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
    if (this.native) void NativePlayer.stop().catch(() => {});
    this.sessionTrack = undefined; this.listened = 0;
    this.update({ playing: false, loading: false, position: 0, error: '', index: -1, queue: [] });
  }
  destroy() { this.stop(); clearInterval(this.nativeTimer); this.listeners.clear(); }
}
