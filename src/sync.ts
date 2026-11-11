import type { Library } from "./model";
import { accountRequest, privateRead, privateWrite } from "./account-store";
import {
  flattenLibrary,
  restoreSyncedLibrary,
  libraryChanges,
  itemKey,
  type SyncItem,
} from "./sync-data";

type Status = {
  state: "idle" | "syncing" | "synced" | "error";
  message: string;
  at?: number;
};
let status: Status = {
  state: "idle",
  message: "Sign in to sync your library.",
};
const listeners = new Set<() => void>();
function publish(next: Status) {
  status = next;
  listeners.forEach((fn) => fn());
}
type Controller = {
  record: (library: Library) => void;
  run: () => void;
  stop: () => void;
};
let active: Controller | undefined;
export const syncStore = {
  snapshot: () => status,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  retry: () => active?.run(),
};
export function recordLibrary(library: Library) {
  active?.record(library);
}

export function attachSync(
  id: string,
  get: () => Library,
  apply: (library: Library) => void,
) {
  let stopped = false,
    busy = false,
    ready = false,
    mergeNewDevice = true;
  let cursor = 0;
  let base = new Map<string, SyncItem>(),
    pending = new Map<string, SyncItem>();
  let previous = flattenLibrary(get());
  let timeout: ReturnType<typeof setTimeout>;
  const key = "kube.sync." + id;
  let saves = Promise.resolve();
  function persist() {
    const text = JSON.stringify({
      cursor,
      mergeNewDevice,
      base: [...base.values()],
      pending: [...pending.values()],
    });
    saves = saves.catch(() => {}).then(() => privateWrite(key, text));
    return saves;
  }
  function later() {
    clearTimeout(timeout);
    timeout = setTimeout(() => void run(), 700);
  }
  function record(library: Library) {
    if (!ready) return;
    const next = flattenLibrary(library);
    const changes = libraryChanges(previous, next);
    previous = next;
    if (!changes.length) return;
    for (const item of changes) pending.set(itemKey(item), item);
    void persist().catch(() =>
      publish({
        state: "error",
        message:
          "Could not save the sync queue. Export a backup before closing.",
      }),
    );
    later();
  }
  async function pull() {
    let more = true;
    while (more && !stopped) {
      const result = (await accountRequest("sync?after=" + cursor)) as {
        changes: SyncItem[];
        cursor: number;
        more: boolean;
      };
      if (stopped) return;
      result.changes.forEach((item) => base.set(itemKey(item), item));
      cursor = result.cursor;
      more = result.more;
    }
  }
  async function run() {
    if (stopped || busy || !ready) return;
    busy = true;
    publish({ state: "syncing", message: "Syncing your library…" });
    try {
      await pull();
      if (stopped) return;
      if (mergeNewDevice) {
        for (const [key, item] of flattenLibrary(get()))
          if (!base.has(key) && !pending.has(key)) pending.set(key, item);
        mergeNewDevice = false;
        await persist();
      }
      while (pending.size && !stopped) {
        const batch = [...pending.values()].slice(0, 25);
        await accountRequest("sync", "POST", { changes: batch });
        if (stopped) return;
        for (const item of batch) {
          base.set(itemKey(item), item);
          if (pending.get(itemKey(item)) === item)
            pending.delete(itemKey(item));
        }
      }
      await pull();
      if (stopped) return;
      const merged = new Map(base);
      pending.forEach((item, key) => merged.set(key, item));
      const library = restoreSyncedLibrary(get(), merged);
      previous = flattenLibrary(library);
      apply(library);
      await persist();
      publish({
        state: "synced",
        message: "Library is up to date on this device.",
        at: Date.now(),
      });
    } catch (error) {
      if (!stopped)
        publish({
          state: "error",
          message:
            (error as Error).message +
            " Changes are kept on this device and will retry.",
        });
    } finally {
      busy = false;
    }
  }
  async function initialize() {
    try {
      const saved = await privateRead(key);
      if (stopped) return;
      if (saved) {
        const parsed = JSON.parse(saved);
        cursor = parsed.cursor;
        mergeNewDevice = parsed.mergeNewDevice ?? false;
        base = new Map(
          (parsed.base as SyncItem[]).map((item) => [itemKey(item), item]),
        );
        pending = new Map(
          (parsed.pending as SyncItem[]).map((item) => [itemKey(item), item]),
        );
        const snapshot = new Map(base);
        pending.forEach((item, key) => snapshot.set(key, item));
        for (const item of libraryChanges(snapshot, flattenLibrary(get())))
          pending.set(itemKey(item), item);
      }
      previous = flattenLibrary(get());
      ready = true;
      await persist();
      await run();
    } catch (error) {
      if (!stopped)
        publish({
          state: "error",
          message: "Sync could not start. " + (error as Error).message,
        });
    }
  }
  const online = () => void run();
  const interval = setInterval(online, 20000);
  window.addEventListener("online", online);
  window.addEventListener("focus", online);
  const controller: Controller = {
    record,
    run: () => void run(),
    stop: () => {
      stopped = true;
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", online);
      if (active === controller) active = undefined;
    },
  };
  active?.stop();
  active = controller;
  void initialize();
  return () => controller.stop();
}
