const { app, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
function configureUpdates(getWindow) {
  // Only release builds opt in. Development and unsigned macOS builds remain honest.
  const configPath = path.join(__dirname, 'release-config.json');
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : { enabled: false, macSigned: false };
  const supported = app.isPackaged && config.enabled && (process.platform !== 'darwin' || config.macSigned) && (process.platform !== 'linux' || Boolean(process.env.APPIMAGE));
  let state = { platform: process.platform, currentVersion: app.getVersion(), status: supported ? 'idle' : 'unavailable', message: supported ? 'Updates download automatically and install when Kube closes.' : process.platform === 'darwin' && !config.macSigned ? 'This macOS build is unsigned. Automatic installation requires a Developer ID signed release.' : 'Automatic installation is available in release installers and Linux AppImages.' };
  let checking = false;
  const publish = patch => { state = { ...state, ...patch }; const win = getWindow(); if (win && !win.isDestroyed()) win.webContents.send('kube:update-status', state); };
  const trusted = event => { if (event.senderFrame?.url !== 'kube://app/index.html') throw new Error('Untrusted update request'); };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('checking-for-update', () => publish({ status: 'checking', message: 'Checking for updates…' }));
  autoUpdater.on('update-available', info => publish({ status: 'downloading', version: info.version, progress: 0, message: `Downloading Kube ${info.version}…` }));
  autoUpdater.on('download-progress', progress => publish({ status: 'downloading', progress: Math.round(progress.percent) }));
  autoUpdater.on('update-not-available', () => publish({ status: 'current', message: 'Kube is up to date.' }));
  autoUpdater.on('update-downloaded', info => publish({ status: 'ready', version: info.version, progress: 100, message: `Kube ${info.version} is ready. It will install when you close the app.` }));
  autoUpdater.on('error', () => publish({ status: 'error', message: 'Could not check or download an update. The release may still be building; try again later.' }));
  async function check() {
    if (!supported || checking || ['ready','downloading'].includes(state.status)) return state;
    checking = true;
    try { await autoUpdater.checkForUpdates(); } catch { /* Error event supplies safe UI text. */ } finally { checking = false; }
    return state;
  }
  ipcMain.handle('kube:update-status', event => { trusted(event); return state; });
  ipcMain.handle('kube:update-check', event => { trusted(event); return check(); });
  ipcMain.handle('kube:update-install', event => { trusted(event); if (supported && state.status === 'ready') setImmediate(() => autoUpdater.quitAndInstall(false, true)); });
  ipcMain.handle('kube:releases', event => { trusted(event); return shell.openExternal('https://github.com/getkube/kube/releases'); });
  if (supported) { setTimeout(check, 15000).unref(); setInterval(check, 6 * 60 * 60 * 1000).unref(); }
}
module.exports = { configureUpdates };
