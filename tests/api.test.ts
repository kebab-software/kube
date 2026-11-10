import { afterEach, describe, expect, it, vi } from 'vitest';
import { Invidious, requestJson } from '../src/api';
import { defaultLibrary } from '../src/model';
afterEach(() => vi.unstubAllGlobals());
describe('Invidious client', () => {
  it('does not treat HTML challenge pages as successful API responses', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Challenge</html>', { headers: { 'Content-Type': 'text/html' } })));
    await expect(requestJson('https://example.com/api/v1/search')).rejects.toThrow('web page');
  });
  it('reports rate limiting without retry storms', async () => {
    vi.stubGlobal('window', {}); const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 429 })); vi.stubGlobal('fetch', fetcher);
    await expect(requestJson('https://example.com/api/v1/search')).rejects.toThrow('429'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('uses video metadata for mixed music searches and rejects ordinary video playback', async () => {
    const api = new Invidious({ ...defaultLibrary().settings, instance: 'https://catalog.example' });
    const clips = [
      { videoId: 'abcdefghij1', title: 'Interview about music', genre: 'People & Blogs' },
      { videoId: 'abcdefghij2', title: 'Concert', genre: 'Music' },
      { videoId: 'abcdefghij3', title: 'Performance', genre: 'Entertainment', musicTracks: [{ song: 'Live track' }] },
      { videoId: 'abcdefghij4', title: 'Single (Official Audio)', genre: '', keywords: ['pop'] },
      { videoId: 'abcdefghij5', title: 'Interview about pop', genre: '', keywords: ['pop'] },
      { videoId: 'abcdefghij6', title: 'Trailer (Official Video)', genre: 'Gaming', keywords: ['music'] },
    ];
    vi.spyOn(api, 'get').mockImplementation(async path => path === 'search' ? clips : clips.find(clip => path.endsWith(clip.videoId)));
    expect((await api.search('artist')).map(t => t.title)).toEqual(['Concert', 'Performance', 'Single (Official Audio)']);
    await expect(api.video(clips[0].videoId)).rejects.toThrow('music metadata');
  });
  it('tops up sparse search pages and returns the next unscanned page', async () => {
    const api = new Invidious({ ...defaultLibrary().settings, instance: 'https://pages.example' });
    const get = vi.spyOn(api, 'get').mockImplementation(async (path, params) => {
      if (path === 'search') return params?.page === '1'
        ? [{ videoId: 'zyxwvutsrq1', title: 'News' }]
        : params?.page === '2' ? [{ videoId: 'zyxwvutsrq2', title: 'Single (Official Music Video Remastered)' }] : [];
      return path.endsWith('1') ? { videoId: 'zyxwvutsrq1', title: 'News', genre: 'News' }
        : { videoId: 'zyxwvutsrq2', title: 'Single (Official Music Video Remastered)', keywords: [] };
    });
    const result = await api.searchPage('single');
    expect(result.tracks).toHaveLength(1);
    expect(result.nextPage).toBe(4);
    expect(result.hasMore).toBe(false);
    expect(get.mock.calls.filter(([path]) => path === 'search').map(([, params]) => params?.page)).toEqual(['1','2','3']);
  });
  it('falls back to music search when trending contains only news', async () => {
    const api = new Invidious({ ...defaultLibrary().settings, instance: 'https://fallback.example' });
    vi.spyOn(api, 'get').mockImplementation(async path => path === 'trending'
      ? [{ videoId: 'newsabcdef1', title: 'News' }] : { videoId: 'newsabcdef1', title: 'News', genre: 'News' });
    const music = { videoId: 'songabcdef1', title: 'Song', author: 'Artist', authorId: '', lengthSeconds: 180, videoThumbnails: [], musicVerified: true };
    const search = vi.spyOn(api, 'search').mockResolvedValue([music]);
    expect(await api.trending()).toEqual([music]);
    expect(search).toHaveBeenCalledOnce();
  });
  it('routes audio through the selected instance with local proxy enabled', () => {
    const api = new Invidious({ ...defaultLibrary().settings, instance: 'https://example.com' });
    expect(api.stream('5NV6Rdv1a3I', '140')).toBe('https://example.com/latest_version?id=5NV6Rdv1a3I&itag=140&local=true');
  });
  it('does not return late native/desktop results after navigation aborts', async () => {
    const abort = new AbortController(); vi.stubGlobal('window', { kubeDesktop: { request: async () => { abort.abort(); return []; } } });
    await expect(requestJson('https://example.com/api/v1/search', abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
