import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import type { InferEnv } from "cf/config";
import type config from "../cloudflare.config";
export type AccountEnv = InferEnv<typeof config.worker>;
const origins = new Set([
  "https://kube.jamesd.uk",
  "https://kube-music.123058.workers.dev",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "kube://app",
  "null",
]);
const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(256),
});
const mutation = z.object({
  kind: z.enum([
    "liked",
    "hidden",
    "artists",
    "playlists",
    "playlistTracks",
    "history",
  ]),
  id: z.string().min(1).max(300),
  value: z
    .unknown()
    .nullable()
    .refine((value) => value !== undefined),
});
const syncSchema = z.object({ changes: z.array(mutation).min(1).max(25) });
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(
    new Uint8Array(bytes instanceof Uint8Array ? bytes.buffer : bytes),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
const unhex = (text: string) =>
  Uint8Array.from(text.match(/../g) ?? [], (x) => parseInt(x, 16));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async (value: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: unhex(salt),
        iterations: 100000,
      },
      key,
      256,
    ),
  );
}
function equal(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function json(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Missing request", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 500000) {
      await reader.cancel();
      throw new HttpError("Request too large", 413);
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError("Invalid JSON", 400);
  }
}
export async function accounts(request: Request, env: AccountEnv) {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (origin && origins.has(origin))
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Kube-Client",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
  const reply = (
    body: unknown,
    status = 200,
    extra: Record<string, string> = {},
  ) => Response.json(body, { status, headers: { ...headers, ...extra } });
  if (origin && !origins.has(origin))
    return reply({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  const path = new URL(request.url).pathname;
  const db: D1Database = env.DB;
  try {
    if (
      request.method === "POST" &&
      !request.headers.get("content-type")?.includes("application/json")
    )
      throw new HttpError("JSON required", 415);
    if (
      ["/api/signup", "/api/login"].includes(path) &&
      request.method === "POST"
    ) {
      const input = credentials.parse(await json(request));
      const now = Date.now();
      const bucket = await digest(
        (request.headers.get("CF-Connecting-IP") || "local") +
          ":" +
          Math.floor(now / 600000),
      );
      const limit = await db
        .prepare(
          "INSERT INTO auth_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
        )
        .bind(bucket, now + 1200000)
        .first<{ attempts: number }>();
      if ((limit?.attempts ?? 100) > 30)
        throw new HttpError(
          "Too many attempts. Try again in ten minutes.",
          429,
        );
      let user = await db
        .prepare("SELECT id,email,salt,password FROM users WHERE email=?")
        .bind(input.email)
        .first<{ id: string; email: string; salt: string; password: string }>();
      if (path === "/api/signup") {
        if (user)
          throw new HttpError(
            "An account with this email already exists. Sign in instead.",
            409,
          );
        const salt = random();
        const password = await passwordHash(input.password, salt);
        const id = crypto.randomUUID();
        try {
          await db
            .prepare(
              "INSERT INTO users(id,email,salt,password,created_at) VALUES(?,?,?,?,?)",
            )
            .bind(id, input.email, salt, password, now)
            .run();
        } catch {
          throw new HttpError(
            "This email is already registered. Try signing in.",
            409,
          );
        }
        user = { id, email: input.email, salt, password };
      } else {
        const hash = await passwordHash(
          input.password,
          user?.salt ?? "00".repeat(32),
        );
        if (!user || !equal(hash, user.password))
          throw new HttpError("Email or password is incorrect.", 401);
      }
      const token = random();
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now),
        db.prepare("DELETE FROM auth_limits WHERE expires_at<?").bind(now),
        db
          .prepare(
            "INSERT INTO sessions(digest,user_id,expires_at) VALUES(?,?,?)",
          )
          .bind(await digest(token), user.id, now + 30 * 86400000),
      ]);
      return reply(
        {
          user: { id: user.id, email: user.email },
          ...(request.headers.get("X-Kube-Client") === "native"
            ? { token }
            : {}),
        },
        200,
        {
          "Set-Cookie":
            "__Host-kube_session=" +
            token +
            "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000",
        },
      );
    }
    const token =
      request.headers.get("Authorization")?.replace(/^Bearer /, "") ||
      request.headers
        .get("Cookie")
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("__Host-kube_session="))
        ?.split("=")[1];
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new HttpError("Please sign in.", 401);
    const tokenHash = await digest(token);
    const user = await db
      .prepare(
        "SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.digest=? AND sessions.expires_at>?",
      )
      .bind(tokenHash, Date.now())
      .first<{ id: string; email: string }>();
    if (!user)
      throw new HttpError("Your session expired. Please sign in again.", 401);
    if (path === "/api/me" && request.method === "GET") return reply({ user });
    if (path === "/api/logout" && request.method === "POST") {
      await db
        .prepare("DELETE FROM sessions WHERE digest=?")
        .bind(tokenHash)
        .run();
      return reply({ ok: true }, 200, {
        "Set-Cookie":
          "__Host-kube_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      });
    }
    if (path === "/api/sync" && request.method === "GET") {
      const after = Number(new URL(request.url).searchParams.get("after") || 0);
      if (!Number.isSafeInteger(after) || after < 0)
        throw new HttpError("Invalid sync cursor", 400);
      const rows = await db
        .prepare(
          "SELECT kind,item_id as id,value,revision FROM sync_items WHERE user_id=? AND revision>? ORDER BY revision LIMIT 100",
        )
        .bind(user.id, after)
        .all<{
          kind: string;
          id: string;
          value: string | null;
          revision: number;
        }>();
      return reply({
        changes: rows.results.map((row) => ({
          ...row,
          value: row.value === null ? null : JSON.parse(row.value),
        })),
        cursor: rows.results.at(-1)?.revision ?? after,
        more: rows.results.length === 100,
      });
    }
    if (path === "/api/sync" && request.method === "POST") {
      const { changes } = syncSchema.parse(await json(request));
      for (const change of changes)
        if (JSON.stringify(change.value).length > 40000)
          throw new HttpError("A sync item exceeds 40 KB.", 413);
      await db.batch([
        db
          .prepare("UPDATE users SET sync_version=sync_version+? WHERE id=?")
          .bind(changes.length, user.id),
        ...changes.map((change, index) =>
          db
            .prepare(
              "INSERT INTO sync_items(user_id,kind,item_id,value,revision) VALUES(?,?,?,?,(SELECT sync_version FROM users WHERE id=?)-?+?) ON CONFLICT(user_id,kind,item_id) DO UPDATE SET value=excluded.value,revision=excluded.revision",
            )
            .bind(
              user.id,
              change.kind,
              change.id,
              change.value === null ? null : JSON.stringify(change.value),
              user.id,
              changes.length,
              index + 1,
            ),
        ),
      ]);
      return reply({ ok: true });
    }
    return reply({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof HttpError)
      return reply({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return reply(
        {
          error:
            "Check your input. Passwords must contain at least 12 characters.",
        },
        400,
      );
    if (error instanceof Error && error.message.includes('sync_quota')) return reply({error:'Your cloud library storage is full. Export a backup and remove unused items.'},413);
    console.error(JSON.stringify({ event: "account_request_failed", path }));
    return reply(
      { error: "The account service is temporarily unavailable." },
      503,
    );
  }
}
