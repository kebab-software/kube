import { afterEach, expect, it, vi } from 'vitest';
import worker from '../cloudflare/worker';
afterEach(() => vi.unstubAllGlobals());
const request = (path: string, body = '{}') => new Request('https://kube.example' + path, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
it('rejects arbitrary catalog routes and oversized bodies without contacting upstream', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect((await worker.fetch(request('/catalog/other'))).status).toBe(404);
  expect((await worker.fetch(request('/catalog/youtubei/v1/search', 'x'.repeat(100001)))).status).toBe(413);
  expect(fetcher).not.toHaveBeenCalled();
});
it('relays the catalog response and strips client credentials', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"contents":[]}', { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const req = request('/catalog/youtubei/v1/search?prettyPrint=false');
  req.headers.set('Cookie', 'private=value');
  const result = await worker.fetch(req);
  expect(await result.json()).toEqual({contents:[]});
  expect(fetcher.mock.calls[0][0]).toBe('https://music.youtube.com/youtubei/v1/search?prettyPrint=false');
  expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('Cookie');
  expect(result.headers.get('cache-control')).toBe('no-store');
});
