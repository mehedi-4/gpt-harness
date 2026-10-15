import type { Message } from "./types";

/** Legacy messages retain their order; linked replies follow their own prompt. */
export function orderMessages(messages: Message[]): Message[] {
  const prompts = new Set(messages.filter((m) => m.role === "user").map((m) => m.id));
  const replies = new Map<string, Message[]>();
  for (const message of messages) {
    if (message.role !== "assistant" || !message.replyToId || !prompts.has(message.replyToId)) continue;
    const siblings = replies.get(message.replyToId) ?? [];
    siblings.push(message);
    replies.set(message.replyToId, siblings);
  }
  return messages.flatMap((message) => {
    if (message.role === "assistant" && message.replyToId && prompts.has(message.replyToId)) return [];
    return [message, ...(replies.get(message.id) ?? [])];
  });
}
