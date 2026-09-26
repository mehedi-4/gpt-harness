import { create } from "zustand";
import type {
  Conversation,
  Message,
  ModelId,
  Effort,
  Attachment,
  Citation,
  SearchStatus,
  DocFormat,
} from "./types";
import { DEFAULT_MODEL, DEFAULT_EFFORT } from "./models";
import * as api from "./chatApi";

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

/** Fire a persistence call without blocking the UI; log failures. */
function persist(p: Promise<unknown>): void {
  p.catch((e) => console.error("Persistence error:", e));
}

function metaOf(c: Conversation): api.ConversationMeta {
  const { id, title, model, effort, createdAt, updatedAt } = c;
  return { id, title, model, effort, createdAt, updatedAt };
}

/** Strip transient base64 (`dataUrl`) from attachments before persistence — the
 *  hosted Cloudinary `url` is what's stored. Keeps `text` (small, inline). */
function persistableAttachments(
  attachments?: Attachment[],
): Attachment[] | undefined {
  if (!attachments?.length) return undefined;
  return attachments.map((a) => {
    const { dataUrl, ...rest } = a;
    void dataUrl;
    return rest;
  });
}

/** A message with any transient binary stripped, safe to send to the DB. */
function persistableMessage(m: Message): Message {
  const attachments = persistableAttachments(m.attachments);
  return attachments ? { ...m, attachments } : m;
}

interface ChatState {
  conversations: Record<string, Conversation>;
  order: string[];
  activeId: string | null;
  /** Conversations whose messages have been fetched from the server. */
  loaded: Record<string, boolean>;
  /** Set to true once the initial conversation list has loaded. */
  ready: boolean;
  /** True while an unpersisted (message-less) conversation exists locally. */

  activeConversation: () => Conversation | null;
  ensureActive: () => string;
  newConversation: () => string;
  setActive: (id: string) => void;
  remove: (id: string) => void;

  loadConversations: () => Promise<void>;
  loadMessages: (id: string) => Promise<void>;

  setModel: (model: ModelId) => void;
  setEffort: (effort: Effort) => void;

  addUserMessage: (text: string, attachments?: Attachment[]) => Message;
  editUserMessage: (id: string, text: string) => void;
  /** Drops every message after (and including) the given id. */
  truncateAfter: (id: string, inclusive: boolean) => void;
  beginAssistant: (init?: {
    isImage?: boolean;
    isDocument?: boolean;
    docFormat?: DocFormat;
  }) => Message;
  appendAnswer: (id: string, delta: string) => void;
  appendReasoning: (id: string, delta: string) => void;
  setSearchStatus: (id: string, status: SearchStatus) => void;
  addSearchQuery: (id: string, query: string) => void;
  addCitation: (id: string, citation: Citation) => void;
  setImages: (id: string, images: string[]) => void;
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

/** Look up a message in a conversation after a state update, for persistence. */
function findMessage(
  state: ChatState,
  convId: string,
  msgId: string,
): Message | undefined {
  return state.conversations[convId]?.messages.find((m) => m.id === msgId);
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: {},
  order: [],
  activeId: null,
  loaded: {},
  ready: false,

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
      loaded: { ...s.loaded, [c.id]: true },
    }));
    // Persist the empty conversation so message inserts have a parent row.
    persist(api.createConversation(metaOf(c)));
    return c.id;
  },

  setActive: (id) => {
    set({ activeId: id });
    if (!get().loaded[id]) persist(get().loadMessages(id));
  },

  remove: (id) => {
    set((s) => {
      const conversations = { ...s.conversations };
      delete conversations[id];
      const order = s.order.filter((x) => x !== id);
      const activeId = s.activeId === id ? order[0] ?? null : s.activeId;
      return { conversations, order, activeId };
    });
    persist(api.deleteConversation(id));
    const next = get().activeId;
    if (next && !get().loaded[next]) persist(get().loadMessages(next));
  },

  loadConversations: async () => {
    const metas = await api.fetchConversations();
    set((s) => {
      const conversations = { ...s.conversations };
      for (const m of metas) {
        // Server metadata is authoritative; keep any already-loaded messages.
        conversations[m.id] = {
          ...m,
          messages: conversations[m.id]?.messages ?? [],
        };
      }
      return {
        conversations,
        order: metas.map((m) => m.id),
        ready: true,
      };
    });
  },

  loadMessages: async (id) => {
    const messages = await api.fetchMessages(id);
    set((s) => {
      const c = s.conversations[id];
      if (!c) return {};
      return {
        conversations: { ...s.conversations, [id]: { ...c, messages } },
        loaded: { ...s.loaded, [id]: true },
      };
    });
  },

  setModel: (model) => {
    const id = get().ensureActive();
    set((s) => touch(s, id, (c) => ({ ...c, model })));
    persist(api.patchConversation(id, { model }));
  },

  setEffort: (effort) => {
    const id = get().ensureActive();
    set((s) => touch(s, id, (c) => ({ ...c, effort })));
    persist(api.patchConversation(id, { effort }));
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
    let newTitle: string | null = null;
    set((s) =>
      touch(s, id, (c) => {
        const title = c.messages.length === 0 ? titleFrom(text) : c.title;
        if (c.messages.length === 0) newTitle = title;
        return { ...c, title, messages: [...c.messages, msg] };
      }),
    );
    persist(api.appendMessage(id, persistableMessage(msg)));
    if (newTitle) persist(api.patchConversation(id, { title: newTitle }));
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
    const m = findMessage(get(), id, msgId);
    if (m) persist(api.updateMessage(id, persistableMessage(m)));
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
    persist(api.truncateAfter(id, msgId, inclusive));
  },

  beginAssistant: (init) => {
    const id = get().ensureActive();
    const msg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      reasoning: "",
      streaming: true,
      isImage: init?.isImage || undefined,
      isDocument: init?.isDocument || undefined,
      docFormat: init?.docFormat,
      createdAt: Date.now(),
    };
    set((s) => touch(s, id, (c) => ({ ...c, messages: [...c.messages, msg] })));
    // Not persisted yet — the row is written once when streaming finalizes.
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

  addSearchQuery: (msgId, query) => {
    const id = get().activeId;
    if (!id) return;
    const q = query.trim();
    if (!q) return;
    set((s) =>
      touch(s, id, (c) => ({
        ...c,
        messages: c.messages.map((m) => {
          if (m.id !== msgId) return m;
          const existing = m.searchQueries ?? [];
          if (existing.includes(q)) return m;
          return { ...m, searchQueries: [...existing, q] };
        }),
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

  setImages: (msgId, images) => {
    const id = get().activeId;
    if (!id) return;
    set((s) =>
      touch(s, id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === msgId ? { ...m, images, streaming: false } : m,
        ),
      })),
    );
    const m = findMessage(get(), id, msgId);
    if (m) persist(api.updateMessage(id, m));
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
    const m = findMessage(get(), id, msgId);
    if (m) persist(api.updateMessage(id, m));
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
    const m = findMessage(get(), id, msgId);
    if (m) persist(api.updateMessage(id, m));
  },
}));
