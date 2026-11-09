import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Search, Home, Library, Heart, Clock3, Users, Settings as SettingsIcon, Plus, ArrowRight, Play, RefreshCw, ListMusic, Trash2, ArrowUp, ArrowDown, X, Music2, Check, Pencil } from 'lucide-react';
import { useApp } from './context';
import { Invidious } from './api';
import { recommendations, rankRecommendations, type Recommendation } from './recommendations';
import { type Track, uniqueTracks, type Artist } from './model';
import { Cover, Empty, Failure, IconButton, Loading, Modal, PlayerBar, TrackRow } from './components';
import { Settings } from './Settings';
import { Sidebar } from './components/ui/sidebar';
import { useMusicLibrary } from './useMusicLibrary';
import { UpdateNotice } from './UpdateNotice';

type View = 'home' | 'search' | 'liked' | 'playlists' | 'history' | 'artists' | 'settings' | 'queue' | 'artist' | 'playlist';
export function App() {
  const { library: stored, update, player, notice, notify, storageWarning } = useApp();
  const library = useMusicLibrary(stored, update);
  const playback = useSyncExternalStore(player.subscribe, player.snapshot);
  const [view, setView] = useState<View>('home');
  const [search, setSearch] = useState(''); const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]); const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false); const [moreLoading, setMoreLoading] = useState(false); const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1); const [continuation, setContinuation] = useState<string>();
  const [error, setError] = useState(''); const [partial, setPartial] = useState(false); const [refresh, setRefresh] = useState(0);
  const [artist, setArtist] = useState<Artist>(); const [playlistId, setPlaylistId] = useState('');
  const [playlistModal, setPlaylistModal] = useState<'create' | 'add' | 'rename' | null>(null); const [trackToAdd, setTrackToAdd] = useState<Track>(); const [playlistName, setPlaylistName] = useState('');
  const [importModal, setImportModal] = useState(false); const [importValue, setImportValue] = useState(''); const [importBusy, setImportBusy] = useState(false); const [importError, setImportError] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const requestVersion = useRef(0); const mainRef = useRef<HTMLElement>(null);
  const api = new Invidious(library.settings);
  const activePlaylist = library.playlists.find(p => p.id === playlistId);
  function navigate(next: View) { setView(next); setError(''); mainRef.current?.scrollTo({ top: 0 }); }
  function doSearch(q: string) { if (!q.trim()) return; setSearch(q); setQuery(q.trim()); navigate('search'); setRefresh(n => n + 1); }
  function openArtist(value: Artist) {
    if (!value.authorId) return doSearch(value.author);
    setArtist(value); navigate('artist');
  }
  useEffect(() => {
    const controller = new AbortController(); const version = ++requestVersion.current;
    setError(''); setPartial(false); setResults([]); setPage(1); setHasMore(false); setContinuation(undefined);
    if (!['home', 'search', 'artist'].includes(view)) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    const run = async () => {
      if (view === 'home') {
        const result = await recommendations(new Invidious(library.settings), library, controller.signal);
        if (controller.signal.aborted) return;
        setRecs(result.items); setResults(result.items.map(r => r.track)); setPartial(result.partial);
      } else if (view === 'search') {
        if (!query) return;
        const list = await new Invidious(library.settings).searchPage(query, 1, controller.signal);
        if (controller.signal.aborted) return; setResults(list.tracks); setHasMore(list.hasMore);
      } else if (artist) {
        const result = await new Invidious(library.settings).channel(artist.authorId, undefined, controller.signal);
        if (controller.signal.aborted) return; setResults(result.tracks); setContinuation(result.continuation); setHasMore(Boolean(result.continuation));
      }
    };
    void run().catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (version === requestVersion.current) setLoading(false); });
    return () => controller.abort();
    // Library changes are applied on refresh so liking a song never replaces the screen mid-click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, query, artist?.authorId, library.settings.instance, library.settings.region, refresh]);
  async function loadMore() {
    const version = requestVersion.current; setMoreLoading(true); setError('');
    try {
      if (view === 'search') { const list = await api.searchPage(query, page + 1); if (version !== requestVersion.current) return; setResults(old => uniqueTracks([...old, ...list.tracks])); setPage(n => n + 1); setHasMore(list.hasMore); }
      else if (artist) { const result = await api.channel(artist.authorId, continuation); if (version !== requestVersion.current) return; setResults(old => uniqueTracks([...old, ...result.tracks])); setContinuation(result.continuation); setHasMore(Boolean(result.continuation)); }
    } catch (e) { if (version === requestVersion.current) setError((e as Error).message); } finally { setMoreLoading(false); }
  }
  async function radio(track: Track) {
    notify('Finding related tracks…');
    try {
      const related = await api.related(track.videoId);
      const ranked = rankRecommendations(related, library).map(r => r.track).filter(t => t.videoId !== track.videoId);
      if (!ranked.length) { notify('This instance returned no related tracks for this song.'); return; }
      await player.play(track, [track, ...ranked]); navigate('queue'); notify('Track radio is ready');
    } catch (e) { notify((e as Error).message); }
  }
  function addTrack(track: Track) { setTrackToAdd(track); setPlaylistName(''); setPlaylistModal('add'); }
  function createPlaylist(e: FormEvent) {
    e.preventDefault(); const name = playlistName.trim(); if (!name) return;
    if (playlistModal === 'rename') update(old => ({ ...old, playlists: old.playlists.map(p => p.id === playlistId ? { ...p, name } : p) }));
    else { const id = crypto.randomUUID(); update(old => ({ ...old, playlists: [...old.playlists, { id, name, created: Date.now(), tracks: playlistModal === 'add' && trackToAdd ? [trackToAdd] : [] }] })); if (playlistModal === 'create') { setPlaylistId(id); navigate('playlist'); } }
    setPlaylistModal(null); setPlaylistName(''); notify('Playlist saved');
  }
  async function importPlaylist(e: FormEvent) {
    e.preventDefault(); setImportBusy(true); setImportError('');
    try {
      let id = importValue.trim(); if (id.includes('://')) id = new URL(id).searchParams.get('list') || '';
      const first = await api.playlist(id); let tracks = first.tracks;
      let scanned = first.scanned;
      for (let p = 2; scanned > 0 && scanned < first.count && p <= 100; p++) {
        const next = await api.playlist(id, p);
        if (!next.scanned) break;
        scanned += next.scanned;
        tracks = uniqueTracks([...tracks, ...next.tracks]);
      }
      if (!tracks.length) throw new Error('No verified music was found in this playlist.');
      const newId = crypto.randomUUID(); update(old => ({ ...old, playlists: [...old.playlists, { id: newId, name: first.title.slice(0, 120), created: Date.now(), tracks }] }));
      setPlaylistId(newId); navigate('playlist'); setImportModal(false); setImportValue(''); notify('Imported ' + tracks.length + ' music tracks');
    } catch (e) { setImportError((e as Error).message); } finally { setImportBusy(false); }
  }
  function rows(tracks: Track[], reasons = false, removable = false) {
    return <div className="track-list">{tracks.map((track, index) => <div key={`${track.videoId}-${index}`} className={removable ? 'removable-row' : ''}><TrackRow track={track} list={tracks} index={index} reason={reasons ? recs.find(r => r.track.videoId === track.videoId)?.reason : undefined} onArtist={openArtist} onAdd={addTrack} onRadio={t => void radio(t)} />{removable && <IconButton label={`Remove ${track.title} from playlist`} onClick={() => update(old => ({ ...old, playlists: old.playlists.map(p => p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.videoId !== track.videoId) } : p) }))}><X size={16} /></IconButton>}</div>)}</div>;
  }
  const nav = [{ id: 'home', title: 'Listen now', icon: Home }, { id: 'search', title: 'Explore', icon: Search }, { id: 'liked', title: 'Liked songs', icon: Heart }, { id: 'playlists', title: 'Playlists', icon: Library }, { id: 'artists', title: 'Artists', icon: Users }, { id: 'history', title: 'Recently played', icon: Clock3 }] as const;
  const titles: Partial<Record<View, [string, string]>> = { search: [query ? `Results for “${query}”` : 'Search', 'Search for a song or artist.'], liked: ['Liked songs', `${library.liked.length} liked tracks.`], history: ['Recently played', 'Your listening history.'], artists: ['Your artists', 'Artists you follow.'], playlists: ['Your playlists', 'Saved on this device.'], queue: ['Up next', `${playback.queue.length} tracks in your listening session.`] };
  return <div className="app-shell">
    <Sidebar items={[...nav, { id: 'queue', title: 'Queue', icon: ListMusic }, { id: 'settings', title: 'Settings', icon: SettingsIcon }]} active={view} navigate={navigate} />
    <div className="workspace"><header className="topbar"><button className="mobile-brand" aria-label="Kube home" onClick={() => navigate('home')}><img src="./logo.png" alt="" /></button><form className="search-box" onSubmit={e => { e.preventDefault(); doSearch(search); }}><Search size={19} /><input aria-label="Search music" placeholder="Search songs, artists, and more" value={search} maxLength={300} onChange={e => setSearch(e.target.value)} /><kbd>↵</kbd></form><button className="connection-badge" onClick={() => navigate('settings')} title={library.settings.instance}><span className="connection-dot" /> Invidious <span className="connection-host">/ {new URL(library.settings.instance).hostname}</span></button><IconButton label="Show queue" active={view === 'queue'} onClick={() => navigate('queue')}><ListMusic size={20} /></IconButton></header>
    <main ref={mainRef}>
      {storageWarning && <Failure message={storageWarning} />}
      {playback.error && <div className="playback-error" role="alert"><span>{playback.error}</span><button onClick={() => void player.resume()}>Retry</button><button onClick={() => navigate('settings')}>Settings</button></div>}
      {view === 'settings' ? <Settings /> : <>
        {view === 'home' ? <>
          <header className="listen-heading"><div><h1>Listen now</h1><p>{library.history.length || library.liked.length ? 'Recommendations based on your listening' : 'Music recommendations'}</p></div><div className="button-row"><IconButton label="Refresh recommendations" onClick={() => setRefresh(n => n + 1)} disabled={loading}><RefreshCw size={18} /></IconButton><button className="primary" disabled={!results.length || loading} onClick={() => results[0] && void player.play(results[0], results)}><Play size={16} fill="currentColor" /> Play mix</button></div></header>
          <nav className="library-shortcuts" aria-label="Library shortcuts"><button onClick={() => navigate('liked')}><Heart size={17} /> Liked songs <small>{library.liked.length}</small></button><button onClick={() => navigate('playlists')}><Library size={17} /> Playlists <small>{library.playlists.length}</small></button><button onClick={() => navigate('artists')}><Users size={17} /> Artists <small>{library.artists.length}</small></button><button onClick={() => navigate('history')}><Clock3 size={17} /> History</button></nav>
          {library.history.length > 0 && <section className="recent-section"><div className="section-heading"><h2>Recently played</h2><button className="text-button" onClick={() => navigate('history')}>View all <ArrowRight size={14} /></button></div><div className="recent-grid">{uniqueTracks(library.history.map(h => h.track)).slice(0, 4).map(track => <button className="recent-track" key={track.videoId} onClick={() => void player.play(track)}><Cover track={track} /><span><strong>{track.title}</strong><small>{track.author}</small></span><Play size={16} /></button>)}</div></section>}
          <div className="section-heading"><h2>{library.history.length || library.liked.length ? 'Recommended for you' : 'Discover music'}</h2><span className="result-count">{results.length ? results.length + ' tracks' : ''}</span></div>
        </> : titles[view] ? <header className="page-heading"><div><h1>{titles[view]?.[0]}</h1><p>{titles[view]?.[1]}</p></div>{view === 'playlists' && <div className="button-row"><button onClick={() => setImportModal(true)}>Import playlist</button><button className="primary" onClick={() => { setPlaylistName(''); setPlaylistModal('create'); }}><Plus size={17} /> New playlist</button></div>}</header> : null}
        {view === 'artist' && artist && <header className="collection-heading"><div className="artist-avatar"><Users size={44} /></div><div><p className="eyebrow">ARTIST / CHANNEL</p><h1>{artist.author}</h1><button className={library.artists.some(a => a.authorId === artist.authorId) ? '' : 'primary'} onClick={() => update(old => ({ ...old, artists: old.artists.some(a => a.authorId === artist.authorId) ? old.artists.filter(a => a.authorId !== artist.authorId) : [artist, ...old.artists] }))}>{library.artists.some(a => a.authorId === artist.authorId) ? <><Check size={16} /> Following</> : <><Plus size={16} /> Follow artist</>}</button></div></header>}
        {view === 'playlist' && activePlaylist && <header className="collection-heading"><div className="playlist-cover"><ListMusic size={48} /></div><div><p className="eyebrow">YOUR PLAYLIST · {activePlaylist.tracks.length} TRACKS</p><h1>{activePlaylist.name}</h1><div className="button-row"><button className="primary" disabled={!activePlaylist.tracks.length} onClick={() => void player.play(activePlaylist.tracks[0], activePlaylist.tracks)}><Play size={16} /> Play</button><IconButton label="Rename playlist" onClick={() => { setPlaylistName(activePlaylist.name); setPlaylistModal('rename'); }}><Pencil size={17} /></IconButton><IconButton label="Delete playlist" onClick={() => setDeleteId(activePlaylist.id)}><Trash2 size={17} /></IconButton></div></div></header>}
        {error && <Failure message={error} retry={() => setRefresh(n => n + 1)} />}
        {loading ? <Loading /> : <>
          {partial && view === 'home' && <p className="inline-note">Some recommendation sources are unavailable. Showing the music that loaded successfully.</p>}
          {view === 'home' && results.length > 0 && rows(results, true)}
          {(view === 'search' || view === 'artist') && (results.length ? <>{rows(results)}{hasMore && <button className="load-more" disabled={moreLoading} onClick={() => void loadMore()}>{moreLoading ? 'Loading…' : 'Load more'} <ArrowDown size={15} /></button>}</> : !error && <Empty title={view === 'search' && !query ? 'Search your music' : 'No tracks found'}>{view === 'search' && !query ? 'Search above for a song or artist to get started.' : 'Try a different search or check your Invidious connection.'}</Empty>)}
          {view === 'liked' && (library.liked.length ? <><button className="primary collection-play" onClick={() => void player.play(library.liked[0], library.liked)}><Play size={17} /> Play liked songs</button>{rows(library.liked)}</> : <Empty title="No liked songs yet">Tap the heart beside a track. Your liked songs will live here.</Empty>)}
          {view === 'history' && (library.history.length ? rows(uniqueTracks(library.history.map(h => h.track))) : <Empty title="No listening history yet">Listen to a track to begin your history. You control this in Settings.</Empty>)}
          {view === 'playlist' && (activePlaylist?.tracks.length ? rows(activePlaylist.tracks, false, true) : <Empty title="This playlist is empty">Find a track and choose “Add to playlist” from its options menu.</Empty>)}
          {view === 'artists' && (library.artists.length ? <div className="library-grid">{library.artists.map(a => <button className="library-card" key={a.authorId} onClick={() => openArtist(a)}><div className="artist-avatar"><Users size={36} /></div><h3>{a.author}</h3><span>Following <ArrowRight size={14} /></span></button>)}</div> : <Empty title="No followed artists">Open an artist from any song, then follow them to shape your recommendations.</Empty>)}
          {view === 'playlists' && (library.playlists.length ? <div className="library-grid">{library.playlists.map(p => <button className="library-card" key={p.id} onClick={() => { setPlaylistId(p.id); navigate('playlist'); }}><div className="playlist-cover"><ListMusic size={38} /></div><h3>{p.name}</h3><span>{p.tracks.length} tracks <ArrowRight size={14} /></span></button>)}</div> : <Empty title="No playlists yet">Create your first playlist or import a public YouTube playlist.</Empty>)}
          {view === 'queue' && (playback.queue.length ? <><div className="queue-caption"><span>NOW & NEXT</span><button onClick={() => player.shuffle()}>Shuffle upcoming</button></div>{playback.queue.map((t, i) => <div className={`queue-item ${i === playback.index ? 'current' : ''}`} key={`${t.videoId}-${i}`}><span className="queue-index">{i === playback.index ? <Music2 size={17} /> : i + 1}</span><Cover track={t} /><div className="track-copy"><strong>{t.title}</strong><span>{t.author}</span></div><IconButton label={`Play queue track ${i + 1}`} onClick={() => void player.play(t, playback.queue.slice(i))}><Play size={17} /></IconButton>{i > playback.index && <><IconButton label={`Move track ${i + 1} up`} disabled={i === playback.index + 1} onClick={() => player.move(i, -1)}><ArrowUp size={16} /></IconButton><IconButton label={`Move track ${i + 1} down`} disabled={i === playback.queue.length - 1} onClick={() => player.move(i, 1)}><ArrowDown size={16} /></IconButton></>}<IconButton label={`Remove queue track ${i + 1}`} disabled={i === playback.index} onClick={() => player.remove(i)}><X size={17} /></IconButton></div>)}</> : <Empty title="Your queue is empty">Play a song or add tracks to your queue from the options menu.</Empty>)}
          {!results.length && hasMore && (view === 'search' || view === 'artist') && <button className="load-more" disabled={moreLoading} onClick={() => void loadMore()}>Load more</button>}
        </>}
      </>}

    </main></div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{[{ id: 'home' as View, title: 'Home', icon: Home }, { id: 'search' as View, title: 'Explore', icon: Search }, { id: 'playlists' as View, title: 'Library', icon: Library }, { id: 'liked' as View, title: 'Liked', icon: Heart }, { id: 'settings' as View, title: 'Settings', icon: SettingsIcon }].map(({ id, title, icon: Icon }) => <button className={view === id ? 'current' : ''} key={id} onClick={() => navigate(id)}><Icon size={19} /><span>{title}</span></button>)}</nav>
    <PlayerBar openQueue={() => navigate('queue')} />
    <UpdateNotice />
    {notice && <div className="toast" role="status">{notice}</div>}
    {playlistModal && <Modal title={playlistModal === 'add' ? 'Add to playlist' : playlistModal === 'rename' ? 'Rename playlist' : 'Create a playlist'} close={() => setPlaylistModal(null)}>{playlistModal === 'add' && <div className="playlist-choices">{library.playlists.map(p => <button key={p.id} onClick={() => { if (trackToAdd) update(old => ({ ...old, playlists: old.playlists.map(list => list.id === p.id ? { ...list, tracks: uniqueTracks([...list.tracks, trackToAdd]) } : list) })); setPlaylistModal(null); notify(`Added to ${p.name}`); }}><ListMusic size={19} />{p.name}<Plus size={16} /></button>)}</div>}<form onSubmit={createPlaylist}><label htmlFor="playlist-name">{playlistModal === 'add' ? 'Or create a new playlist' : 'Playlist name'}</label><input id="playlist-name" autoFocus required maxLength={120} value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="Playlist name" /><button className="primary modal-submit" disabled={!playlistName.trim()} type="submit">{playlistModal === 'rename' ? 'Save name' : 'Create playlist'}</button></form></Modal>}
    {importModal && <Modal title="Import a public playlist" close={() => { if (!importBusy) setImportModal(false); }}><p>Paste a YouTube playlist URL or ID. Tracks are copied to your local library through Invidious.</p><form onSubmit={e => void importPlaylist(e)}><label htmlFor="playlist-url">Playlist URL or ID</label><input id="playlist-url" required value={importValue} onChange={e => setImportValue(e.target.value)} />{importError && <Failure message={importError} />}<button className="primary modal-submit" disabled={importBusy}>{importBusy ? 'Importing tracks…' : 'Import playlist'}</button></form></Modal>}
    {deleteId && <Modal title="Delete this playlist?" close={() => setDeleteId('')}><p>The playlist will be removed from this device. Liked songs are kept.</p><div className="button-row"><button onClick={() => setDeleteId('')}>Cancel</button><button className="danger" onClick={() => { update(old => ({ ...old, playlists: old.playlists.filter(p => p.id !== deleteId) })); setDeleteId(''); navigate('playlists'); }}>Delete playlist</button></div></Modal>}
  </div>;
}
