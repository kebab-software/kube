import { getCurrentWindow } from '@tauri-apps/api/window';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import type { UpdateStatus } from './update-types';

let ready: Update | null = null;
let busy = false;
type Publish = (state: UpdateStatus) => void;
const send = (publish: Publish, status: UpdateStatus['status'], message: string, version?: string) =>
  publish({ platform: 'desktop', currentVersion: __APP_VERSION__, status, message, version });

export async function checkDesktop(publish: Publish) {
  if (busy || ready) return;
  busy = true;
  let candidate: Update | null = null;
  try {
    send(publish, 'checking', 'Checking for updates…');
    candidate = await check({ timeout: 20000 });
    if (!candidate) { send(publish, 'current', 'Kube is up to date.'); return; }
    send(publish, 'downloading', 'Downloading the signed desktop update.', candidate.version);
    await candidate.download();
    ready = candidate;
    send(publish, 'ready', 'Update downloaded. Restart now or close Kube to install.', ready.version);
  } catch {
    if (candidate) await candidate.close().catch(() => {});
    send(publish, 'error', 'Could not download a verified update. Try again later.');
  } finally { busy = false; }
}

export async function installDesktop() {
  if (busy || !ready) return;
  busy = true;
  try { await ready.install(); await relaunch(); } finally { busy = false; }
}

export function watchDesktop(publish: Publish) {
  send(publish, 'idle', 'Kube checks for updates automatically.');
  const initial = setTimeout(() => void checkDesktop(publish), 15000);
  const timer = setInterval(() => void checkDesktop(publish), 6 * 60 * 60 * 1000);
  const win = getCurrentWindow();
  const off = win.onCloseRequested(async event => {
    if (!ready) return;
    event.preventDefault();
    try { await installDesktop(); } catch { await win.destroy(); }
  });
  return () => { clearTimeout(initial); clearInterval(timer); void off.then(remove => remove()); };
}
