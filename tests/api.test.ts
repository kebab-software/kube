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
  it('routes audio through the selected instance with local proxy enabled', () => {
    const api = new Invidious({ ...defaultLibrary().settings, instance: 'https://example.com' });
    expect(api.stream('5NV6Rdv1a3I', '140')).toBe('https://example.com/latest_version?id=5NV6Rdv1a3I&itag=140&local=true');
  });
  it('does not return late native/desktop results after navigation aborts', async () => {
    const abort = new AbortController(); vi.stubGlobal('window', { kubeDesktop: { request: async () => { abort.abort(); return []; } } });
    await expect(requestJson('https://example.com/api/v1/search', abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
