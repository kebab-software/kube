import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
const source = readFileSync(new URL('../electron/updates.cjs', import.meta.url), 'utf8');
function setup(platform = 'win32', enabled = true, macSigned = false) {
  const handlers = new Map<string, (...args: any[]) => any>();
  const updater = Object.assign(new EventEmitter(), { autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: true, allowDowngrade: true, checkForUpdates: vi.fn(async () => {}), quitAndInstall: vi.fn() });
  const send = vi.fn(), openExternal = vi.fn(), schedule = vi.fn(() => ({ unref() {} }));
  const exports: { configureUpdates?: (getWindow: () => any) => void } = {};
  const modules: Record<string, any> = {
    electron: { app: { isPackaged: true, getVersion: () => '0.2.0' }, ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn) }, shell: { openExternal } },
    'electron-updater': { autoUpdater: updater },
    'node:fs': { existsSync: () => true, readFileSync: () => JSON.stringify({ enabled, macSigned }) },
    'node:path': path,
  };
  const module = { exports };
  runInNewContext(source, { require: (name: string) => modules[name], module, __dirname: '/app/electron', process: { platform, env: { APPIMAGE: '/apps/Kube.AppImage' } }, setTimeout: schedule, setInterval: schedule, setImmediate: (fn: () => void) => fn() });
  module.exports.configureUpdates!(() => ({ isDestroyed: () => false, webContents: { send } }));
  const event = { senderFrame: { url: 'kube://app/index.html' } };
  const invoke = (name: string) => handlers.get(name)!(event);
  return { updater, invoke, handlers, schedule, send, openExternal };
}
describe('desktop automatic updater', () => {
  it('checks on startup and every six hours, downloads automatically and installs on quit', () => {
    const app = setup(); expect(app.schedule).toHaveBeenCalledTimes(2);
    expect(app.updater.autoDownload).toBe(true); expect(app.updater.autoInstallOnAppQuit).toBe(true);
    expect(app.updater.allowDowngrade).toBe(false); expect(app.updater.allowPrerelease).toBe(false);
  });
  it('requires a downloaded update and a trusted renderer before restarting', () => {
    const app = setup(); app.invoke('kube:update-install'); expect(app.updater.quitAndInstall).not.toHaveBeenCalled();
    expect(() => app.handlers.get('kube:update-install')!({ senderFrame: { url: 'https://untrusted.example' } })).toThrow();
    app.updater.emit('update-downloaded', { version: '0.3.0' });
    expect(app.invoke('kube:update-status').status).toBe('ready');
    app.invoke('kube:update-install'); expect(app.updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });
  it('does not falsely enable automatic installation for unsigned macOS or development builds', async () => {
    for (const app of [setup('darwin', true, false), setup('win32', false)]) {
      expect(app.invoke('kube:update-status').status).toBe('unavailable');
      await app.invoke('kube:update-check'); expect(app.updater.checkForUpdates).not.toHaveBeenCalled();
      expect(app.schedule).not.toHaveBeenCalled();
    }
  });
  it('opens only the fixed release page and reports failed downloads', () => {
    const app = setup(); app.invoke('kube:releases');
    expect(app.openExternal).toHaveBeenCalledWith('https://github.com/kebab-software/kube/releases');
    app.updater.emit('error', new Error('internal request details'));
    expect(app.invoke('kube:update-status').status).toBe('error');
    expect(app.invoke('kube:update-status').message).not.toContain('internal request details');
  });
});
