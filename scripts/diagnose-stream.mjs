const base = 'https://yt.chocolatemoo53.com';
const id = '5NV6Rdv1a3I';
for (const local of ['', '?local=true']) {
  try {
    const r = await fetch(`${base}/api/v1/videos/${id}${local}`, { signal: AbortSignal.timeout(20000) });
    const data = await r.json();
    console.log('DETAIL', local || 'default', r.status, 'CORS', r.headers.get('access-control-allow-origin'));
    const f = data.adaptiveFormats?.find(f => f.itag === '140');
    if (!f) { console.log('No M4A format'); continue; }
    const u = new URL(f.url); console.log('Returned audio host/path:', u.hostname, u.pathname);
    const proxy = new URL(f.url); proxy.host = new URL(base).host; proxy.protocol = 'https:';
    const urls = [...new Set([`${base}/latest_version?id=${id}&itag=140&local=true`, proxy.href, ...(u.hostname === new URL(base).hostname ? [f.url] : [])])];
    for (const url of urls) {
      const response = await fetch(url, { headers: { Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(20000) });
      console.log('PROXY', new URL(url).pathname, response.status, response.headers.get('content-type'), 'final host', new URL(response.url).hostname);
      if (response.headers.get('content-type')?.includes('text')) console.log((await response.text()).slice(0, 300));
      else { const reader = response.body.getReader(); const chunk = await reader.read(); console.log('BYTES', chunk.value?.length); await reader.cancel(); }
    }
  } catch (e) { console.log(e.message); }
}
