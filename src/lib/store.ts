import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Conversation, Message, ModelId, Effort, Attachment, Citation, SearchStatus } from "./types";
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

  addUserMessage: (text: string, attachments?: Attachment[]) => Message;
  editUserMessage: (id: string, text: string) => void;
  /** Drops every message after (and including) the given id. */
  truncateAfter: (id: string, inclusive: boolean) => void;
  beginAssistant: () => Message;
  appendAnswer: (id: string, delta: string) => void;
  appendReasoning: (id: string, delta: string) => void;
  setSearchStatus: (id: string, status: SearchStatus) => void;
  addCitation: (id: string, citation: Citation) => void;
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

      addUserMessage: (text, attachments) => {
        const id = get().ensureActive();
        const msg: Message = {
          id: uid(),
          role: "user",
          content: text,
          attachments: attachments && attachments.length ? attachments : undefined,
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

      editUserMessage: (msgId, text) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId ? { ...m, content: text } : m,
            ),
          })),
        );
      },

      truncateAfter: (msgId, inclusive) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => {
            const idx = c.messages.findIndex((m) => m.id === msgId);
            if (idx < 0) return c;
            const end = inclusive ? idx : idx + 1;
            return { ...c, messages: c.messages.slice(0, end) };
          }),
        );
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

      setSearchStatus: (msgId, status) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId ? { ...m, searchStatus: status } : m,
            ),
          })),
        );
      },

      addCitation: (msgId, citation) => {
        const id = get().activeId;
        if (!id) return;
        set((s) =>
          touch(s, id, (c) => ({
            ...c,
            messages: c.messages.map((m) => {
              if (m.id !== msgId) return m;
              const existing = m.citations ?? [];
              if (existing.some((x) => x.url === citation.url)) return m;
              return { ...m, citations: [...existing, citation] };
            }),
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
                ? {
                    ...m,
                    streaming: false,
                    thoughtSeconds,
                    // Settle a still-"searching" indicator on completion/stop.
                    searchStatus:
                      m.searchStatus === "searching" ? "searched" : m.searchStatus,
                  }
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
    {
      name: "chat-store",
      version: 1,
      // localStorage can throw QuotaExceededError once attachments pile up.
      // Swallow write failures so the app keeps working (history just won't
      // persist that update) instead of crashing mid-stream.
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            /* over quota — keep running with in-memory state only */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            /* ignore */
          }
        },
      })),
    },
  ),
);
