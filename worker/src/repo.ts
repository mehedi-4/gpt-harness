import type { Conversation, Message } from "../../src/lib/types";
import { EFFORT_STOPS } from "../../src/lib/models";
import { isChatModel } from "../../src/lib/modelDiscovery";
import { HttpError, json, readJson, requiredString, validId } from "./http";
import type { Env } from "./env";

type Meta = Omit<Conversation, "messages">;

export async function conversations(request: Request, env: Env, userId: string, parts: string[]): Promise<Response> {
  const db = env.DB;
  const id = parts[0] ? validId(parts[0]) : undefined;
  const now = Date.now();
  if (!id) {
    if (request.method === "GET") {
      const rows = await db.prepare(`SELECT id, title, model, effort, created_at AS createdAt, updated_at AS updatedAt
        FROM conversations WHERE user_id = ? ORDER BY updated_at DESC`).bind(userId).all<Meta>();
      return json({ conversations: rows.results });
    }
    if (request.method === "POST") {
      const body = await readJson<Meta>(request);
      validId(body.id);
      requiredString(body.title, "title", 200);
      if (!isChatModel(body.model) || !EFFORT_STOPS.some((e) => e.value === body.effort)) throw new HttpError(400, "Invalid model or effort.");
      await db.prepare(`INSERT INTO conversations(user_id, id, title, model, effort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO NOTHING`)
        .bind(userId, body.id, body.title, body.model, body.effort, now, now).run();
      return json({ ok: true }, 201);
    }
    throw new HttpError(405, "Method not allowed.");
  }
  const owned = await db.prepare("SELECT id FROM conversations WHERE user_id = ? AND id = ?").bind(userId, id).first();
  if (!owned) throw new HttpError(404, "Conversation not found.");
  const touch = db.prepare("UPDATE conversations SET updated_at = ? WHERE user_id = ? AND id = ?").bind(now, userId, id);
  if (parts.length === 1) {
    if (request.method === "DELETE") {
      await db.prepare("DELETE FROM conversations WHERE user_id = ? AND id = ?").bind(userId, id).run();
      return json({ ok: true });
    }
    if (request.method === "PATCH") {
      const body = await readJson<Partial<Meta>>(request);
      if (body.title !== undefined) requiredString(body.title, "title", 200);
      if (body.model !== undefined && !isChatModel(body.model)) throw new HttpError(400, "Use GPT-6 or newer.");
      if (body.effort !== undefined && !EFFORT_STOPS.some((e) => e.value === body.effort)) throw new HttpError(400, "Invalid effort.");
      await db.prepare(`UPDATE conversations SET title = COALESCE(?, title), model = COALESCE(?, model),
        effort = COALESCE(?, effort), updated_at = ? WHERE user_id = ? AND id = ?`)
        .bind(body.title ?? null, body.model ?? null, body.effort ?? null, now, userId, id).run();
      return json({ ok: true });
    }
    throw new HttpError(405, "Method not allowed.");
  }
  if (parts[1] === "truncate" && parts.length === 2 && request.method === "POST") {
    const body = await readJson<{ messageId: string; inclusive: boolean }>(request);
    validId(body.messageId);
    if (typeof body.inclusive !== "boolean") throw new HttpError(400, "Invalid inclusive flag.");
    const target = await db.prepare("SELECT seq FROM messages WHERE user_id = ? AND conversation_id = ? AND id = ?")
      .bind(userId, id, body.messageId).first<{ seq: number }>();
    if (!target) throw new HttpError(404, "Message not found.");
    await db.batch([db.prepare(`DELETE FROM messages WHERE user_id = ? AND conversation_id = ? AND seq ${body.inclusive ? ">=" : ">"} ?`).bind(userId, id, target.seq), touch]);
    return json({ ok: true });
  }
  if (parts[1] !== "messages" || parts.length > 3) throw new HttpError(404, "Not found.");
  if (parts.length === 2 && request.method === "GET") {
    const rows = await db.prepare("SELECT data FROM messages WHERE user_id = ? AND conversation_id = ? ORDER BY seq")
      .bind(userId, id).all<{ data: string }>();
    return json({ messages: rows.results.map((r) => JSON.parse(r.data)) });
  }
  const append = parts.length === 2 && request.method === "POST";
  const update = parts.length === 3 && request.method === "PATCH";
  if (!append && !update) throw new HttpError(405, "Method not allowed.");
  const body = await readJson<Message>(request);
  validId(body.id);
  if (update && body.id !== validId(parts[2])) throw new HttpError(400, "Message ID mismatch.");
  if ((body.role !== "user" && body.role !== "assistant") || typeof body.content !== "string" || !Number.isFinite(body.createdAt)) throw new HttpError(400, "Invalid message.");
  // Store only durable, owner-scoped file references, never transient binary data.
  if (body.attachments !== undefined && !Array.isArray(body.attachments)) throw new HttpError(400, "Invalid attachments.");
  body.attachments = body.attachments?.map((a) => {
    if (!a || typeof a !== "object") throw new HttpError(400, "Invalid attachment.");
    const { dataUrl, ...durable } = a;
    void dataUrl;
    if ((a.kind === "image" || a.kind === "pdf") && !a.url) throw new HttpError(400, "Upload attachments before saving.");
    return durable;
  });
  const refs = [...(body.attachments?.flatMap((a) => a.url ? [a.url] : []) ?? []), ...(body.images ?? [])];
  for (const ref of refs) {
    if (typeof ref !== "string" || !ref.startsWith(`/api/files/${userId}/`)) throw new HttpError(400, "Invalid file reference.");
  }
  delete body.streaming;
  await db.batch([
    db.prepare(`INSERT INTO messages(user_id, conversation_id, id, data) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, conversation_id, id) DO ${append ? "NOTHING" : "UPDATE SET data = excluded.data"}`)
      .bind(userId, id, body.id, JSON.stringify(body)),
    touch,
  ]);
  return json({ ok: true }, append ? 201 : 200);
}
