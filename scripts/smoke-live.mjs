// Deliberately separate from deterministic tests: these requests hit real services.
const timeout = 20000;
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`HTTP ${r.status} at ${url}`);
  if (!r.headers.get('content-type')?.includes('json')) throw new Error(`Non-JSON response at ${url} (possible anti-bot challenge)`);
  return r.json();
}
let bases = process.env.INVIDIOUS_INSTANCE ? [process.env.INVIDIOUS_INSTANCE] : ['https://yt.chocolatemoo53.com'];
try {
  const registry = await json('https://api.invidious.io/');
  const available = registry.filter(([, x]) => x.api && x.type === 'https').map(([, x]) => x.uri);
  console.log('Official API-enabled instances:', available);
  if (!process.env.INVIDIOUS_INSTANCE) bases = [...new Set([...available, ...bases])];
} catch (e) { console.warn('Registry:', e.message); }
let passed = false;
for (const base of bases) {
  try {
    const results = await json(`${base}/api/v1/search?q=Daft%20Punk%20Get%20Lucky&type=video`);
    const track = results.find(x => x.videoId && x.lengthSeconds > 60);
    if (!track) throw new Error('No real search results');
    console.log('SEARCH OK', base, track.videoId, track.title);
    const detail = await json(`${base}/api/v1/videos/${track.videoId}`);
    const audio = detail.adaptiveFormats?.find(x => x.type?.startsWith('audio/mp4')) ?? detail.adaptiveFormats?.find(x => x.type?.startsWith('audio/'));
    if (!audio) throw new Error('No audio formats in video details');
    const stream = `${base}/latest_version?id=${track.videoId}&itag=${audio.itag}&local=true`;
    const response = await fetch(stream, { headers: { Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(timeout) });
    if (!response.ok || !/audio|video|octet-stream/.test(response.headers.get('content-type') ?? '')) throw new Error(`Stream returned HTTP ${response.status} ${response.headers.get('content-type')}`);
    const first = await response.body.getReader().read();
    if (!first.value?.length) throw new Error('Empty stream');
    await response.body.cancel().catch(() => {});
    console.log('STREAM OK', response.status, response.headers.get('content-type'), 'first bytes:', first.value.length);
    passed = true;
    break;
  } catch (e) { console.error('LIVE CHECK FAILED', base, e.message); }
}
process.exitCode = passed ? 0 : 1;
