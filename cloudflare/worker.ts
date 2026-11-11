import { accounts, type AccountEnv } from './accounts';
const allowedRoutes = new Set(['/youtubei/v1/search', '/youtubei/v1/browse', '/youtubei/v1/next', '/youtubei/v1/player']);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: cors });
}
export default {
  async fetch(request: Request, env?: AccountEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return env ? accounts(request, env) : error('Account database unavailable',503);
    if (url.pathname === '/health') return Response.json({ status: 'ok', service: 'kube-web' });
    const route = url.pathname.slice('/catalog'.length);
    if (!url.pathname.startsWith('/catalog/') || !allowedRoutes.has(route)) return error('Unknown catalog route', 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return error('POST required', 405);
    if (!request.headers.get('content-type')?.includes('application/json')) return error('JSON required', 415);
    if (Number(request.headers.get('content-length')) > 100000) return error('Request too large', 413);
    try {
      const reader = request.body?.getReader();
      if (!reader) return error('Missing request body', 400);
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 100000) { await reader.cancel(); return error('Request too large', 413); }
        chunks.push(part.value);
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      try { JSON.parse(new TextDecoder().decode(body)); } catch { return error('Invalid JSON', 400); }
      const response = await fetch('https://music.youtube.com' + route + url.search, {
        method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com' },
      });
      if (!response.headers.get('content-type')?.includes('json')) {
        console.warn(JSON.stringify({ event: 'catalog_response', status: response.status, json: false }));
        return error('Music catalog returned an unexpected response', 502);
      }
      let bytes = 0;
      const stream = response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > 10000000) throw new Error('Catalog response too large');
          controller.enqueue(chunk);
        },
      }));
      return new Response(stream, { status: response.status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch (cause) {
      console.warn(JSON.stringify({ event: 'catalog_unavailable', message: cause instanceof Error ? cause.message : 'Unknown upstream error' }));
      return error('Music catalog service unavailable. Try again shortly.', 502);
    }
  },
};

