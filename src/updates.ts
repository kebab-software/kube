import { isTauri, invoke } from '@tauri-apps/api/core';
import { checkDesktop, installDesktop, watchDesktop } from './tauri-updates';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { UpdateStatus } from './update-types';
const NativeUpdater = registerPlugin<{ status(): Promise<UpdateStatus>; check(): Promise<UpdateStatus>; install(): Promise<void>; openReleases(): Promise<void> }>('KubeUpdater');
let state: UpdateStatus = { platform: 'web', currentVersion: __APP_VERSION__, status: 'unavailable', message: 'The web app updates when you reload after a new deployment.' };
const subscribers = new Set<() => void>();
const publish = (next: UpdateStatus) => { state = next; subscribers.forEach(fn => fn()); };
export const updateStore = {
  snapshot: () => state,
  subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
  check: async () => {
    try { if (isTauri()) await checkDesktop(publish); else if (window.kubeDesktop) publish(await window.kubeDesktop.checkUpdate()); else if (Capacitor.isNativePlatform()) publish(await NativeUpdater.check()); }
    catch { publish({ ...state, status: 'error', message: 'The update service is unavailable. Try again later.' }); }
  },
  install: async () => {
    try { if (isTauri()) await installDesktop(); else if (window.kubeDesktop) await window.kubeDesktop.installUpdate(); else if (Capacitor.isNativePlatform()) await NativeUpdater.install(); }
    catch (e) { publish({ ...state, message: e instanceof Error ? e.message : 'Could not start installation.' }); }
  },
  openReleases: async () => { if (isTauri()) await invoke("release_notes"); else if (window.kubeDesktop) await window.kubeDesktop.openReleases(); else if (Capacitor.isNativePlatform()) await NativeUpdater.openReleases(); else window.open('https://github.com/kebab-software/kube/releases', '_blank', 'noopener,noreferrer'); },
};
export function startUpdates() {
  if (isTauri()) return watchDesktop(publish);
  if (window.kubeDesktop) {
    void window.kubeDesktop.updateStatus().then(publish).catch(() => {});
    return window.kubeDesktop.onUpdate(publish);
  }
  if (Capacitor.isNativePlatform()) {
    const poll = () => { void NativeUpdater.status().then(publish).catch(() => {}); };
    poll(); const interval = setInterval(poll, 2000);
    const initial = setTimeout(() => void updateStore.check(), 15000);
    const checks = setInterval(() => void updateStore.check(), 6 * 60 * 60 * 1000);
    return () => { clearInterval(interval); clearTimeout(initial); clearInterval(checks); };
  }
  return () => {};
}
