
import http from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const standalone = !existsSync('dist/index.html');
const root = path.resolve(standalone ? '.' : 'dist');
const index = standalone ? readdirSync(root).find(name => /^Kube-v[0-9.]+\.html$/.test(name)) : 'index.html';
const port = Number(process.env.PORT || 4173);
const allowed = new Set(['/youtubei/v1/search','/youtubei/v1/browse','/youtubei/v1/next','/youtubei/v1/player']);
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname.startsWith('/catalog/')) {
      const route = url.pathname.slice('/catalog'.length);
      if (!allowed.has(route)) { res.writeHead(404).end(); return; }
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 100000) { res.writeHead(413).end(); return; } chunks.push(chunk); }
      const upstream = await fetch('https://music.youtube.com' + route + url.search, {
        method: 'POST', body: Buffer.concat(chunks), redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com' },
      });
      const reader = upstream.body.getReader(); const output = []; let bytes = 0;
      while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 10000000) { await reader.cancel(); throw Error('Response too large'); } output.push(Buffer.from(part.value)); }
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' }).end(Buffer.concat(output)); return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (!index || (standalone && url.pathname !== '/' && url.pathname !== '/' + index)) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/' + index : url.pathname));
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
    const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webmanifest':'application/manifest+json' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { if (!res.headersSent) res.writeHead(502, { 'Content-Type':'application/json' }).end(JSON.stringify({error:'Music catalog service unavailable'})); else res.end(); }
});
server.requestTimeout = 30000;
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log('Kube web server listening on port ' + port));
