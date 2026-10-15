import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const origin = "https://chat.example.com";
const password = "test-password-12345";
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGP8AAAAASUVORK5CYII=";

function call(path: string, method = "GET", body?: unknown, cookie?: string, extra?: Record<string, string>) {
  return exports.default.fetch(`${origin}/api/${path}`, {
    method, headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function register(email = "owner@example.com") {
  const response = await call("auth/register", "POST", { email, password });
  expect(response.status).toBe(201);
  return { cookie: response.headers.get("Set-Cookie")!.split(";")[0], user: (await response.json<{ user: { id: string; email: string } }>()).user, headers: response.headers };
}

async function create(cookie: string, id = "chat1") {
  const response = await call("conversations", "POST", { id, title: "Private chat", model: "gpt-6-luna", effort: "medium" }, cookie);
  expect(response.status).toBe(201);
}

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM users"), env.DB.prepare("DELETE FROM auth_attempts")]);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("accounts and isolation", () => {
  it("requires sign-in on every private endpoint", async () => {
    for (const [path, method] of [["conversations", "GET"], ["conversations/chat/messages", "GET"], ["models", "GET"], ["files/user/file", "GET"], ["chat", "POST"], ["image", "POST"], ["upload", "POST"]]) {
      expect((await call(path, method)).status).toBe(401);
    }
  });

  it("hashes passwords and session tokens, restores sessions, and revokes logout", async () => {
    const owner = await register();
    expect(owner.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(owner.headers.get("Set-Cookie")).toContain("Secure");
    expect(owner.headers.get("Set-Cookie")).toContain("SameSite=Lax");
    const user = await env.DB.prepare("SELECT password_hash, salt FROM users").first<{ password_hash: string; salt: string }>();
    expect(user?.password_hash).not.toBe(password);
    expect(user?.password_hash).toHaveLength(64);
    const session = await env.DB.prepare("SELECT token_hash FROM sessions").first<{ token_hash: string }>();
    expect(owner.cookie).not.toContain(session!.token_hash);
    expect(await (await call("auth/session", "GET", undefined, owner.cookie)).json()).toEqual({ user: owner.user });
    expect((await call("auth/login", "POST", { email: owner.user.email, password: "wrong" })).status).toBe(401);
    const login = await call("auth/login", "POST", { email: owner.user.email.toUpperCase(), password });
    expect(login.status).toBe(200);
    const loginCookie = login.headers.get("Set-Cookie")!.split(";")[0];
    expect((await call("auth/logout", "POST", undefined, loginCookie)).status).toBe(200);
    expect((await call("conversations", "GET", undefined, loginCookie)).status).toBe(401);
    await env.DB.prepare("UPDATE sessions SET expires_at = 0").run();
    expect((await call("conversations", "GET", undefined, owner.cookie)).status).toBe(401);
  });

  it("rejects weak passwords, duplicates, malformed JSON, and cross-origin mutations", async () => {
    expect((await call("auth/register", "POST", { email: "test@example.com", password: "short" })).status).toBe(400);
    await register();
    expect((await call("auth/register", "POST", { email: "owner@example.com", password })).status).toBe(409);
    expect((await call("auth/login", "POST", {}, undefined, { Origin: "https://other.example" })).status).toBe(403);
    expect((await exports.default.fetch(`${origin}/api/auth/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{" })).status).toBe(400);
  });

  it("rate limits repeated authentication attempts", async () => {
    for (let i = 0; i < 10; i++) expect((await call("auth/login", "POST", { email: "missing@example.com", password })).status).toBe(401);
    expect((await call("auth/login", "POST", { email: "missing@example.com", password })).status).toBe(429);
  });

  it("scopes all reads, edits, deletes, and truncation to the owner", async () => {
    const owner = await register();
    const other = await register("other@example.com");
    await create(owner.cookie);
    const message = { id: "m1", role: "user", content: "Only mine", createdAt: 1 };
    expect((await call("conversations/chat1/messages", "POST", message, owner.cookie)).status).toBe(201);
    expect(await (await call("conversations", "GET", undefined, other.cookie)).json()).toEqual({ conversations: [] });
    for (const [path, method, body] of [
      ["conversations/chat1/messages", "GET", undefined],
      ["conversations/chat1", "PATCH", { title: "stolen" }],
      ["conversations/chat1", "DELETE", undefined],
      ["conversations/chat1/messages", "POST", message],
      ["conversations/chat1/messages/m1", "PATCH", message],
      ["conversations/chat1/truncate", "POST", { messageId: "m1", inclusive: true }],
    ] as const) expect((await call(path, method, body, other.cookie)).status).toBe(404);
    // Identical client IDs in different accounts cannot collide.
    await create(other.cookie);
    expect(await (await call("conversations/chat1/messages", "GET", undefined, other.cookie)).json()).toEqual({ messages: [] });
    expect((await call("conversations/chat1/messages/mismatched", "PATCH", message, owner.cookie)).status).toBe(400);
    const saved = await (await call("conversations/chat1/messages", "GET", undefined, owner.cookie)).json<{ messages: { content: string }[] }>();
    expect(saved.messages[0].content).toBe("Only mine");
  });

  it("persists ordered messages idempotently, supports edits, truncation and cascade delete", async () => {
    const { cookie } = await register();
    await create(cookie);
    for (const id of ["first", "second", "second", "third"]) await call("conversations/chat1/messages", "POST", { id, role: "user", content: id, createdAt: 1 }, cookie);
    await call("conversations/chat1/messages/first", "PATCH", { id: "first", role: "user", content: "edited", createdAt: 1 }, cookie);
    let data = await (await call("conversations/chat1/messages", "GET", undefined, cookie)).json<{ messages: { id: string; content: string }[] }>();
    expect(data.messages.map((m) => m.id)).toEqual(["first", "second", "third"]);
    expect(data.messages[0].content).toBe("edited");
    await call("conversations/chat1/truncate", "POST", { messageId: "second", inclusive: false }, cookie);
    data = await (await call("conversations/chat1/messages", "GET", undefined, cookie)).json();
    expect(data.messages.map((m) => m.id)).toEqual(["first", "second"]);
    await call("conversations/chat1", "DELETE", undefined, cookie);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM messages").first<{ n: number }>())?.n).toBe(0);
  });
});

describe("private R2 and OpenAI", () => {
  it("saves private files, denies other users, and rejects unsafe uploads", async () => {
    const owner = await register(), other = await register("other@example.com");
    const response = await call("upload", "POST", { dataUrl: png, filename: "sample.png" }, owner.cookie);
    expect(response.status).toBe(200);
    const { url } = await response.json<{ url: string }>();
    expect(url).toContain(`/api/files/${owner.user.id}/`);
    const file = await call(url.slice(5), "GET", undefined, owner.cookie);
    expect(file.status).toBe(200);
    expect(file.headers.get("Content-Type")).toBe("image/png");
    expect(file.headers.get("Cache-Control")).toContain("no-store");
    await file.arrayBuffer();
    expect((await call(url.slice(5), "GET", undefined, other.cookie)).status).toBe(404);
    expect((await call("upload", "POST", { dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }, owner.cookie)).status).toBe(400);
    expect((await call("upload", "POST", { dataUrl: "https://example.com" }, owner.cookie)).status).toBe(400);
  });

  it("discovers GPT-6+ models and only the newest image generation using the supplied key", async () => {
    const { cookie } = await register();
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ data: [
      { id: "gpt-5.6-sol", created: 10 }, { id: "gpt-6-luna", created: 20 }, { id: "gpt-7", created: 30 },
      { id: "gpt-6.1-luna", created: 50 }, { id: "gpt-6-terra", created: 45 },
      { id: "gpt-6-realtime", created: 40 }, { id: "gpt-image-1" }, { id: "gpt-image-2.5-flare" },
    ] }));
    const response = await call("models", "GET", undefined, cookie, { "x-openai-key": "user-key" });
    expect(response.status).toBe(200);
    const data = await response.json<{ models: { id: string }[]; imageModels: { id: string }[] }>();
    expect(data.models.map((m) => m.id)).toEqual(["gpt-7", "gpt-6.1-luna", "gpt-6-terra", "gpt-6-luna"]);
    expect(data.imageModels.map((m) => m.id)).toEqual(["gpt-image-2.5-flare"]);
    expect(spy.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer user-key" });
    expect(spy.mock.calls[0][1]?.cache).toBe("no-store");
    spy.mockImplementationOnce(async () => Response.json({ data: [{ id: "gpt-6.2-luna" }, { id: "gpt-6-terra" }] }));
    const refreshed = await call("models", "GET", undefined, cookie, { "x-openai-key": "user-key" });
    expect(refreshed.status).toBe(200);
    expect((await refreshed.json<{ models: { id: string }[] }>()).models.map((m) => m.id)).toEqual(["gpt-6.2-luna", "gpt-6-terra"]);
  });

  it("streams responses with private R2 image/PDF bytes and refuses older models", async () => {
    const { cookie } = await register();
    const { url } = await (await call("upload", "POST", { dataUrl: png }, cookie)).json<{ url: string }>();
    const pdf = "data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=";
    const pdfFile = await (await call("upload", "POST", { dataUrl: pdf }, cookie)).json<{ url: string }>();
    const textFile = await (await call("upload", "POST", { dataUrl: `data:text/plain;base64,${btoa("Saved code")}` }, cookie)).json<{ url: string }>();
    const stream = 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\nevent: response.completed\ndata: {"type":"response.completed"}\n\n';
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } }));
    const body = { model: "gpt-6-luna", effort: "medium", input: [{ role: "user", content: [
      { type: "input_image", image_url: url },
      { type: "input_file", file_url: pdfFile.url, filename: "test.pdf" },
      { type: "input_file", file_url: textFile.url, filename: "code.ts" },
    ] }] };
    const response = await call("chat", "POST", body, cookie, { "x-openai-key": "user-key" });
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(await response.text()).toBe(stream);
    const sent = JSON.parse(spy.mock.calls[0][1]?.body as string);
    expect(sent.input[0].content[0].image_url).toBe(png);
    expect(sent.input[0].content[1].file_data).toBe(pdf);
    expect(sent.input[0].content[2]).toEqual({ type: "input_text", text: "File: code.ts\nSaved code" });
    expect(sent.store).toBe(false);
    expect((await call("chat", "POST", { ...body, model: "gpt-5.6-sol" }, cookie, { "x-openai-key": "user-key" })).status).toBe(400);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first()).toEqual({ n: 1 });
  });

  it("persists generated images to R2", async () => {
    const { cookie } = await register();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ data: [{ b64_json: png.split(",")[1] }] }));
    const response = await call("image", "POST", { prompt: "A tree", model: "gpt-image-2.5-flare", size: "1024x1024" }, cookie, { "x-openai-key": "user-key" });
    expect(response.status).toBe(200);
    const { images } = await response.json<{ images: string[] }>();
    expect(images[0]).toMatch(/^\/api\/files\//);
    const stored = await call(images[0].slice(5), "GET", undefined, cookie);
    expect(stored.status).toBe(200);
    await stored.arrayBuffer();
  });
});
