import {
  conversationsCol,
  messagesCol,
  ensureIndexes,
  type ConversationDoc,
  type MessageDoc,
} from "./db";
import type {
  Conversation,
  Message,
  ModelId,
  Effort,
  Citation,
  SearchStatus,
  DocFormat,
} from "./types";

/**
 * Data-access layer. Server-only. All chat persistence goes through here; route
 * handlers call these functions and nothing else touches the database. Documents
 * are stored camelCase (matching the app types), so mapping is minimal. Binaries
 * are NOT stored here — attachments/images carry Cloudinary URLs (see cloudinary.ts).
 */

/** A conversation without its messages (used for the sidebar list). */
export type ConversationMeta = Omit<Conversation, "messages">;

function toMeta(d: ConversationDoc): ConversationMeta {
  return {
    id: d.id,
    title: d.title,
    model: d.model as ModelId,
    effort: d.effort as Effort,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function toMessage(d: MessageDoc): Message {
  const m: Message = {
    id: d.id,
    role: d.role as Message["role"],
    content: d.content,
    createdAt: d.createdAt,
  };
  if (d.reasoning) m.reasoning = d.reasoning;
  if (d.thoughtSeconds != null) m.thoughtSeconds = d.thoughtSeconds;
  if (d.searchStatus) m.searchStatus = d.searchStatus as SearchStatus;
  if (d.searchQueries?.length) m.searchQueries = d.searchQueries;
  if (d.citations?.length) m.citations = d.citations as Citation[];
  if (d.usedWebSearch) m.usedWebSearch = true;
  if (d.isImage) m.isImage = true;
  if (d.images?.length) m.images = d.images;
  if (d.isDocument) m.isDocument = true;
  if (d.docFormat) m.docFormat = d.docFormat as DocFormat;
  if (d.attachments?.length) m.attachments = d.attachments as Message["attachments"];
  if (d.error) m.error = d.error;
  return m;
}

/** Build a message document from an app Message, dropping undefined fields. */
function toDoc(conversationId: string, m: Message, seq: number): MessageDoc {
  const d: MessageDoc = {
    id: m.id,
    conversationId,
    seq,
    role: m.role,
    content: m.content ?? "",
    createdAt: m.createdAt,
  };
  if (m.reasoning) d.reasoning = m.reasoning;
  if (m.thoughtSeconds != null) d.thoughtSeconds = m.thoughtSeconds;
  if (m.searchStatus) d.searchStatus = m.searchStatus;
  if (m.searchQueries?.length) d.searchQueries = m.searchQueries;
  if (m.citations?.length) d.citations = m.citations;
  if (m.usedWebSearch) d.usedWebSearch = true;
  if (m.isImage) d.isImage = true;
  if (m.images?.length) d.images = m.images;
  if (m.isDocument) d.isDocument = true;
  if (m.docFormat) d.docFormat = m.docFormat;
  if (m.attachments?.length) d.attachments = m.attachments;
  if (m.error) d.error = m.error;
  return d;
}

// ── Conversations ──────────────────────────────────────────────────────────

export async function listConversations(): Promise<ConversationMeta[]> {
  await ensureIndexes();
  const docs = await conversationsCol()
    .find({}, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map(toMeta);
}

export async function createConversation(c: ConversationMeta): Promise<void> {
  await ensureIndexes();
  // Upsert-on-insert: ignore if a row with this id already exists.
  await conversationsCol().updateOne(
    { id: c.id },
    {
      $setOnInsert: {
        id: c.id,
        title: c.title,
        model: c.model,
        effort: c.effort,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
    },
    { upsert: true },
  );
}

export async function updateConversation(
  id: string,
  patch: { title?: string; model?: ModelId; effort?: Effort },
): Promise<void> {
  await ensureIndexes();
  const set: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.model !== undefined) set.model = patch.model;
  if (patch.effort !== undefined) set.effort = patch.effort;
  await conversationsCol().updateOne({ id }, { $set: set });
}

export async function deleteConversation(id: string): Promise<void> {
  await ensureIndexes();
  // No FK cascade in Mongo — remove the messages explicitly.
  await messagesCol().deleteMany({ conversationId: id });
  await conversationsCol().deleteOne({ id });
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(conversationId: string): Promise<Message[]> {
  await ensureIndexes();
  const docs = await messagesCol()
    .find({ conversationId }, { projection: { _id: 0 } })
    .sort({ seq: 1 })
    .toArray();
  return docs.map(toMessage);
}

/** Next per-conversation sequence number (monotonic; used for ordering). */
async function nextSeq(conversationId: string): Promise<number> {
  const last = await messagesCol()
    .find({ conversationId })
    .sort({ seq: -1 })
    .limit(1)
    .next();
  return (last?.seq ?? 0) + 1;
}

async function touchConversation(id: string): Promise<void> {
  await conversationsCol().updateOne({ id }, { $set: { updatedAt: Date.now() } });
}

export async function appendMessage(
  conversationId: string,
  m: Message,
): Promise<void> {
  await ensureIndexes();
  // Skip if this message id was already written (append is idempotent).
  const existing = await messagesCol().findOne({ id: m.id });
  if (existing) return;
  const seq = await nextSeq(conversationId);
  await messagesCol().insertOne(toDoc(conversationId, m, seq));
  await touchConversation(conversationId);
}

/** Upserts the final state of a message (used when streaming completes). */
export async function updateMessage(
  conversationId: string,
  m: Message,
): Promise<void> {
  await ensureIndexes();
  const existing = await messagesCol().findOne({ id: m.id });
  const seq = existing?.seq ?? (await nextSeq(conversationId));
  const doc = toDoc(conversationId, m, seq);
  // Replace the whole document so cleared fields don't linger.
  await messagesCol().replaceOne({ id: m.id }, doc, { upsert: true });
  await touchConversation(conversationId);
}

/**
 * Drops messages at/after the given message. `inclusive` removes the target too;
 * otherwise everything strictly after it is removed. Used for edit-and-rerun.
 */
export async function truncateAfter(
  conversationId: string,
  messageId: string,
  inclusive: boolean,
): Promise<void> {
  await ensureIndexes();
  const target = await messagesCol().findOne({ id: messageId });
  if (!target) return;
  await messagesCol().deleteMany({
    conversationId,
    seq: inclusive ? { $gte: target.seq } : { $gt: target.seq },
  });
  await touchConversation(conversationId);
}
