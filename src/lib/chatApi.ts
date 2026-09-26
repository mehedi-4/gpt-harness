import type { Conversation, Message, ModelId, Effort } from "./types";

/**
 * Client-side wrapper over the `/api/conversations` CRUD routes. All calls are
 * best-effort: the store updates local state first for a snappy UI, then fires
 * these to persist. Failures reject so the caller can surface a toast, but the
 * UI has already moved on.
 */

export type ConversationMeta = Omit<Conversation, "messages">;

async function req(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  return res;
}

export async function fetchConversations(): Promise<ConversationMeta[]> {
  const res = await req("/api/conversations");
  const data = (await res.json()) as { conversations: ConversationMeta[] };
  return data.conversations;
}

export async function createConversation(c: ConversationMeta): Promise<void> {
  await req("/api/conversations", { method: "POST", body: JSON.stringify(c) });
}

export async function patchConversation(
  id: string,
  patch: { title?: string; model?: ModelId; effort?: Effort },
): Promise<void> {
  await req(`/api/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await req(`/api/conversations/${id}`, { method: "DELETE" });
}

export async function fetchMessages(id: string): Promise<Message[]> {
  const res = await req(`/api/conversations/${id}/messages`);
  const data = (await res.json()) as { messages: Message[] };
  return data.messages;
}

export async function appendMessage(id: string, m: Message): Promise<void> {
  await req(`/api/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(m),
  });
}

export async function updateMessage(
  conversationId: string,
  m: Message,
): Promise<void> {
  await req(`/api/conversations/${conversationId}/messages/${m.id}`, {
    method: "PATCH",
    body: JSON.stringify(m),
  });
}

export async function truncateAfter(
  conversationId: string,
  messageId: string,
  inclusive: boolean,
): Promise<void> {
  await req(`/api/conversations/${conversationId}/truncate`, {
    method: "POST",
    body: JSON.stringify({ messageId, inclusive }),
  });
}
