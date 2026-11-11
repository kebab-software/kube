import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export async function privateRead(key: string) {
  return Capacitor.isNativePlatform()
    ? (await Preferences.get({ key })).value
    : localStorage.getItem(key);
}
export async function privateWrite(key: string, value: string | null) {
  if (Capacitor.isNativePlatform()) {
    if (value === null) await Preferences.remove({ key });
    else await Preferences.set({ key, value });
  } else if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}
type Account = { id: string; email: string };
type Auth = { user: Account | null; ready: boolean };
let state: Auth = { user: null, ready: false };
let token = "";
let initialized = false;
let generation = 0;
const listeners = new Set<() => void>();
function publish(next: Auth) {
  state = next;
  listeners.forEach((fn) => fn());
}
const root = "https://kube.jamesd.uk";
const directCookie = () =>
  !Capacitor.isNativePlatform() && location.origin === root;
export async function accountRequest(
  path: string,
  method = "GET",
  body?: unknown,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!directCookie()) headers["X-Kube-Client"] = "native";
  if (token) headers.Authorization = "Bearer " + token;
  let status: number, data: unknown;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: root + "/api/" + path,
      method,
      headers,
      data: body,
      connectTimeout: 12000,
      readTimeout: 20000,
      responseType: "json",
    });
    status = response.status;
    data =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;
  } else {
    const response = await fetch(root + "/api/" + path, {
      method,
      headers,
      credentials: directCookie() ? "include" : "omit",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    status = response.status;
    data = await response.json();
  }
  if (status < 200 || status >= 300) {
    const error = new Error(
      (data as { error?: string }).error ||
        "The account service is unavailable.",
    ) as Error & { status: number };
    error.status = status;
    throw error;
  }
  return data;
}
export const accountStore = {
  snapshot: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  async initialize() {
    if (initialized) return;
    initialized = true;
    const current = generation;
    try {
      const saved = await privateRead("kube.account");
      if (saved) {
        const parsed = JSON.parse(saved);
        token = parsed.token || "";
        publish({ user: parsed.user, ready: true });
      }
      const result = (await accountRequest("me")) as { user: Account };
      if (current !== generation) return;
      await privateWrite(
        "kube.account",
        JSON.stringify({ user: result.user, token }),
      );
      publish({ user: result.user, ready: true });
    } catch (error) {
      if (current !== generation) return;
      if ((error as { status?: number }).status === 401) {
        token = "";
        await privateWrite("kube.account", null);
        publish({ user: null, ready: true });
      } else publish({ ...state, ready: true });
    }
  },
  async signIn(email: string, password: string, signup: boolean) {
    generation++;
    const result = (await accountRequest(signup ? "signup" : "login", "POST", {
      email,
      password,
    })) as { user: Account; token?: string };
    token = result.token || "";
    await privateWrite(
      "kube.account",
      JSON.stringify({ user: result.user, token }),
    );
    publish({ user: result.user, ready: true });
  },
  async signOut() {
    generation++;
    try {
      await accountRequest("logout", "POST", {});
    } catch (error) {
      if ((error as { status?: number }).status !== 401) throw error;
    }
    token = "";
    await privateWrite("kube.account", null);
    publish({ user: null, ready: true });
  },
};
