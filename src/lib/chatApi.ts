import type { Conversation, Message, ModelId, Effort } from "./types";
import { apiFetch } from "./apiFetch";

/**
 * Client-side wrapper over the `/api/conversations` CRUD routes. All calls are
 * best-effort: the store updates local state first for a snappy UI, then fires
 * these to persist. Failures reject so the caller can surface a toast, but the
 * UI has already moved on.
 */

export type ConversationMeta = Omit<Conversation, "messages">;

async function req(input: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  }
  return res;
}

let pending: Promise<unknown> = Promise.resolve();
let generation = 0;
let controller = new AbortController();
export function resetQueue() { generation++; controller.abort(); controller = new AbortController(); pending = Promise.resolve(); }
export async function flushWrites() { await pending.catch(() => {}); }

function write(input: string, init: RequestInit): Promise<void> {
  const version = generation;
  const signal = controller.signal;
  const next = pending.catch(() => {}).then(async () => {
    if (version !== generation) throw new DOMException("Account changed", "AbortError");
    await req(input, { ...init, signal });
  });
  pending = next;
  return next;
}

export async function fetchConversations(): Promise<ConversationMeta[]> {
  const res = await req("/api/conversations");
  const data = (await res.json()) as { conversations: ConversationMeta[] };
  return data.conversations;
}

export async function createConversation(c: ConversationMeta): Promise<void> {
  await write("/api/conversations", { method: "POST", body: JSON.stringify(c) });
}

export async function patchConversation(
  id: string,
  patch: { title?: string; model?: ModelId; effort?: Effort },
): Promise<void> {
  await write(`/api/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await write(`/api/conversations/${id}`, { method: "DELETE" });
}

export async function fetchMessages(id: string): Promise<Message[]> {
  const res = await req(`/api/conversations/${id}/messages`);
  const data = (await res.json()) as { messages: Message[] };
  return data.messages;
}

export async function appendMessage(id: string, m: Message): Promise<void> {
  await write(`/api/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(m),
  });
}

export async function updateMessage(
  conversationId: string,
  m: Message,
): Promise<void> {
  await write(`/api/conversations/${conversationId}/messages/${m.id}`, {
    method: "PATCH",
    body: JSON.stringify(m),
  });
}

export async function truncateAfter(
  conversationId: string,
  messageId: string,
  inclusive: boolean,
): Promise<void> {
  await write(`/api/conversations/${conversationId}/truncate`, {
    method: "POST",
    body: JSON.stringify({ messageId, inclusive }),
  });
}
