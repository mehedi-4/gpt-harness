import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, Message, ModelId, Effort } from "./types";
import { DEFAULT_MODEL, DEFAULT_EFFORT } from "./models";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeConversation(): Conversation {
  const now = Date.now();
  return {
    id: uid(),
    title: "New chat",
    messages: [],
    model: DEFAULT_MODEL,
    effort: DEFAULT_EFFORT,
    createdAt: now,
    updatedAt: now,
  };
}

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? t.slice(0, 40) + "…" : t || "New chat";
}

interface ChatState {
  conversations: Record<string, Conversation>;
  order: string[];
  activeId: string | null;

  activeConversation: () => Conversation | null;
  ensureActive: () => string;
  newConversation: () => string;
  setActive: (id: string) => void;
  remove: (id: string) => void;

  setModel: (model: ModelId) => void;
  setEffort: (effort: Effort) => void;

  addUserMessage: (text: string) => Message;
  beginAssistant: () => Message;
  appendAnswer: (id: string, delta: string) => void;
  appendReasoning: (id: string, delta: string) => void;
  finalizeAssistant: (id: string, thoughtSeconds: number) => void;
  setError: (id: string, message: string) => void;
}

/** Immutably update one conversation, bump updatedAt, and hoist it in `order`. */
function touch(
  state: ChatState,
  id: string,
  fn: (c: Conversation) => Conversation,
): Partial<ChatState> {
  const existing = state.conversations[id];
  if (!existing) return {};
  const updated = { ...fn(existing), updatedAt: Date.now() };
  return {
    conversations: { ...state.conversations, [id]: updated },
    order: [id, ...state.order.filter((x) => x !== id)],
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: {},
      order: [],
      activeId: null,

      activeConversation: () => {
        const { activeId, conversations } = get();
        return activeId ? conversations[activeId] ?? null : null;
      },

      ensureActive: () => {
        const { activeId, conversations } = get();
        if (activeId && conversations[activeId]) return activeId;
        return get().newConversation();
      },

      newConversation: () => {
        const c = makeConversation();
        set((s) => ({
          conversations: { ...s.conversations, [c.id]: c },
          order: [c.id, ...s.order],
          activeId: c.id,
        }));
        return c.id;
      },

      setActive: (id) => set({ activeId: id }),

      remove: (id) =>
        set((s) => {
          const conversations = { ...s.conversations };
          delete conversations[id];
          const order = s.order.filter((x) => x !== id);
          const activeId =
            s.activeId === id ? order[0] ?? null : s.activeId;
          return { conversations, order, activeId };
        }),

      setModel: (model) => {
        const id = get().ensureActive();
        set((s) => touch(s, id, (c) => ({ ...c, model })));
      },

      setEffort: (effort) => {
        const id = get().ensureActive();
        set((s) => touch(s, id, (c) => ({ ...c, effort })));
      },

      addUserMessage: (text) => {
        const id = get().ensureActive();
        const msg: Message = {
          id: uid(),
          role: "user",
          content: text,
          createdAt: Date.now(),
        };
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            title: c.messages.length === 0 ? titleFrom(text) : c.title,
            messages: [...c.messages, msg],
          })),
        );
        return msg;
      },

      beginAssistant: () => {
        const id = get().ensureActive();
        const msg: Message = {
          id: uid(),
          role: "assistant",
          content: "",
          reasoning: "",
          streaming: true,
          createdAt: Date.now(),
        };
        set((s) => touch(s, id, (c) => ({ ...c, messages: [...c.messages, msg] })));
        return msg;
      },

      appendAnswer: (msgId, delta) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId ? { ...m, content: m.content + delta } : m,
            ),
          })),
        );
      },

      appendReasoning: (msgId, delta) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId
                ? { ...m, reasoning: (m.reasoning ?? "") + delta }
                : m,
            ),
          })),
        );
      },

      finalizeAssistant: (msgId, thoughtSeconds) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId
                ? { ...m, streaming: false, thoughtSeconds }
                : m,
            ),
          })),
        );
      },

      setError: (msgId, message) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId ? { ...m, streaming: false, error: message } : m,
            ),
          })),
        );
      },
    }),
    { name: "chat-store", version: 1 },
  ),
);
