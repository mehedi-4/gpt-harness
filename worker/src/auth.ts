import type { Env, User } from "./env";
import { HttpError, json, readJson, requiredString } from "./http";

const COOKIE = "chat_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function randomHex(length = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  // Workers Web Crypto supports at most 100,000 PBKDF2 iterations.
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100_000 }, key, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

function token(request: Request): string | undefined {
  return request.headers.get("Cookie")?.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
}

function cookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function currentUser(request: Request, env: Env): Promise<User | null> {
  const value = token(request);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  return env.DB.prepare(`SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await digest(value), Date.now()).first<User>();
}

async function rateLimit(request: Request, env: Env, email: string): Promise<void> {
  const now = Date.now();
  const windowStart = now - 15 * 60_000;
  // IP and account limits both apply, including failed and successful attempts.
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  for (const [identity, limit] of [[`ip:${ip}`, 30], [`email:${email}`, 10]] as const) {
    const result = await env.DB.prepare(`INSERT INTO auth_attempts(key, window_start, attempts) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET
        attempts = CASE WHEN window_start < ? THEN 1 ELSE attempts + 1 END,
        window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END
      RETURNING attempts`).bind(await digest(identity), now, windowStart, windowStart).first<{ attempts: number }>();
    if ((result?.attempts ?? 0) > limit) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM auth_attempts WHERE window_start < ?").bind(windowStart),
  ]);
}

export async function auth(request: Request, env: Env, action: string): Promise<Response> {
  if (action === "session" && request.method === "GET") return json({ user: await currentUser(request, env) });
  if (request.method !== "POST") throw new HttpError(405, "Method not allowed.");
  if (action === "logout") {
    const value = token(request);
    if (value) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(value)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie(request, "", 0) });
  }
  if (action !== "login" && action !== "register") throw new HttpError(404, "Not found.");
  const body = await readJson<{ email?: unknown; password?: unknown }>(request, 4096);
  const email = requiredString(body.email, "email", 254).trim().toLowerCase();
  const password = requiredString(body.password, "password", 256);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  await rateLimit(request, env, email);
  let user: User;
  if (action === "register") {
    if (password.length < 12) throw new HttpError(400, "Use a password with at least 12 characters.");
    const salt = randomHex(16);
    const hash = await passwordHash(password, salt);
    user = { id: crypto.randomUUID(), email };
    const result = await env.DB.prepare("INSERT INTO users(id, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING")
      .bind(user.id, email, hash, salt, Date.now()).run();
    if (!result.meta.changes) throw new HttpError(409, "An account already exists for this email. Sign in instead.");
  } else {
    const row = await env.DB.prepare("SELECT id, email, password_hash, salt FROM users WHERE email = ?")
      .bind(email).first<User & { password_hash: string; salt: string }>();
    const hash = await passwordHash(password, row?.salt ?? "00000000000000000000000000000000");
    if (!row || !equal(hash, row.password_hash)) throw new HttpError(401, "Email or password is incorrect.");
    user = { id: row.id, email: row.email };
  }
  const value = randomHex();
  const oldToken = token(request);
  if (oldToken) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(oldToken)).run();
  await env.DB.prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await digest(value), user.id, Date.now() + SESSION_SECONDS * 1000).run();
  return json({ user }, action === "register" ? 201 : 200, { "Set-Cookie": cookie(request, value, SESSION_SECONDS) });
}
