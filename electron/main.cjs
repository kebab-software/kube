const { app, BrowserWindow, ipcMain, session, net, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
protocol.registerSchemesAsPrivileged([{ scheme: 'kube', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
app.setAppUserModelId('app.kube.music');
let window;
function createWindow() {
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 390, minHeight: 640, title: 'Kube', icon: path.join(__dirname, '../dist/icon-512.png'), backgroundColor: '#101113', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', e => e.preventDefault());
  window.loadURL('kube://app/index.html');
}
app.whenReady().then(() => {
  protocol.handle('kube', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Forbidden', { status: 403 });
    const root = path.resolve(__dirname, '../dist');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('kube:request', async (event, input) => {
    if (event.senderFrame?.url !== 'kube://app/index.html') throw new Error('Untrusted request');
    if (typeof input !== 'string' || input.length > 4096) throw new Error('Invalid request');
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || !(url.pathname.startsWith('/api/v1/') || (url.hostname === 'api.invidious.io' && url.pathname === '/'))) throw new Error('Only HTTPS Invidious API requests are allowed');
    const response = await fetch(url, { signal: AbortSignal.timeout(18000), redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Instance returned HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('json')) throw new Error('Instance did not return JSON');
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 10_000_000) { await reader.cancel(); throw new Error('Response too large'); } chunks.push(Buffer.from(part.value)); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  });

  ipcMain.handle('kube:catalog', async (event, input, body) => {
    if (event.senderFrame?.url !== 'kube://app/index.html') throw new Error('Untrusted request');
    if (typeof input !== 'string' || input.length > 4096 || typeof body !== 'string' || body.length > 100000) throw new Error('Invalid request');
    const url = new URL('https://music.youtube.com' + input);
    if (url.hostname !== 'music.youtube.com' || !/^\/youtubei\/v1\/(search|browse|next|player)$/.test(url.pathname)) throw new Error('Invalid catalog path');
    const r = await fetch(url, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com' } });
    if (!r.ok) throw new Error('YouTube Music HTTP ' + r.status);
    const reader = r.body.getReader(); const chunks = []; let bytes = 0;
    while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.length; if (bytes > 10000000) { await reader.cancel(); throw new Error('Catalog response too large'); } chunks.push(Buffer.from(item.value)); }
    return Buffer.concat(chunks).toString('utf8');
  });
  createWindow();
  require('./updates.cjs').configureUpdates(() => window);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
