import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = new URL(process.argv[2] ?? "http://localhost:8788");
if (!["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("This test creates disposable accounts and must run locally.");
const password = `smoke-${randomUUID()}`;
async function call(path, method = "GET", body, cookie) {
  return fetch(new URL(`/api/${path}`, base), {
    method, headers: { Origin: base.origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function register() {
  const response = await call("auth/register", "POST", { email: `smoke-${randomUUID()}@example.test`, password });
  assert.equal(response.status, 201, await response.clone().text());
  return response.headers.get("Set-Cookie").split(";")[0];
}

const frontend = await fetch(base);
assert.equal(frontend.status, 200);
assert.match(await frontend.text(), /Loading your account/);
assert.deepEqual(await (await call("auth/session")).json(), { user: null });
const owner = await register(), other = await register();
assert.equal((await call("conversations", "POST", { id: "smoke-chat", title: "Smoke test", model: "gpt-6-luna", effort: "medium" }, owner)).status, 201);
assert.equal((await call("conversations/smoke-chat/messages", "POST", { id: "smoke-msg", role: "user", content: "Saved through the Pages service binding", createdAt: Date.now() }, owner)).status, 201);
const history = await (await call("conversations/smoke-chat/messages", "GET", undefined, owner)).json();
assert.equal(history.messages[0].content, "Saved through the Pages service binding");
assert.equal((await call("conversations/smoke-chat/messages", "GET", undefined, other)).status, 404);
const upload = await call("upload", "POST", { dataUrl: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=", filename: "test.pdf" }, owner);
assert.equal(upload.status, 200);
const { url } = await upload.json();
assert.equal((await fetch(new URL(url, base), { headers: { Cookie: owner } })).status, 200);
assert.equal((await fetch(new URL(url, base), { headers: { Cookie: other } })).status, 404);
assert.equal((await call("auth/logout", "POST", undefined, owner)).status, 200);
assert.equal((await call("conversations", "GET", undefined, owner)).status, 401);
console.log("Pages → Worker smoke test passed: frontend, registration, sessions, private history, R2 files, and logout.");
