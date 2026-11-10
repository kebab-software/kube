import { isTauri, invoke } from '@tauri-apps/api/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export function catalogFetch(proxy: string, signal?: AbortSignal): typeof fetch {
  return async (input, init) => {
    signal?.throwIfAborted();
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!['www.youtube.com', 'music.youtube.com'].includes(url.hostname) ||
        !/^\/youtubei\/v1\/(search|browse|next|player)$/.test(url.pathname) ||
        request.method !== 'POST') throw new Error('Unsupported music catalog request');
    const path = url.pathname + url.search;
    const body = await request.text();
    let result: Response;
    if (isTauri()) {
      const text = await invoke<string>('catalog_request', { path, body });
      result = new Response(text, { headers: { 'Content-Type': 'application/json' } });
    } else if (window.kubeDesktop?.catalogRequest) {
      result = new Response(await window.kubeDesktop.catalogRequest(path, body), { headers: { 'Content-Type': 'application/json' } });
    } else if (Capacitor.isNativePlatform()) {
      const r = await CapacitorHttp.post({ url: 'https://music.youtube.com' + path, data: JSON.parse(body), headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com' }, connectTimeout: 12000, readTimeout: 20000 });
      result = new Response(typeof r.data === 'string' ? r.data : JSON.stringify(r.data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    } else {
      const base = proxy || (location.protocol.startsWith('http') ? location.origin : '');
      if (!base) throw new Error('Set the Music catalog server in Settings, or open Kube through its web server.');
      result = await fetch(base + '/catalog' + path, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: AbortSignal.any([AbortSignal.timeout(25000), ...(signal ? [signal] : [])]) });
    }
    signal?.throwIfAborted();
    return result;
  };
}
