"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/store";
import { useApiKey } from "@/hooks/useApiKey";
import { streamChat } from "@/lib/streamChat";
import { generateImage } from "@/lib/generateImage";
import { readFiles, uploadAttachments } from "@/lib/files";
import type { Effort, ModelId, Attachment, ImageSize, ImageModelId } from "@/lib/types";
import { DEFAULT_MODEL, DEFAULT_EFFORT, DEFAULT_IMAGE_SIZE, DEFAULT_IMAGE_MODEL } from "@/lib/models";
import { Sidebar } from "@/components/Sidebar";
import { ModelSelector } from "@/components/ModelSelector";
import { Composer } from "@/components/Composer";
import { MessageList } from "@/components/MessageList";
import { EmptyState } from "@/components/EmptyState";
import { SettingsDialog } from "@/components/SettingsDialog";
import { AuthGate } from "@/components/AuthGate";
import { useModelCatalog } from "@/hooks/useModelCatalog";

export default function Home() {
  return <AuthGate><Chat /></AuthGate>;
}

function Chat() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [webSearch, setWebSearch] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize>(DEFAULT_IMAGE_SIZE);
  const [selectedImageModel, setImageModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches && localStorage.getItem("sidebar-open") !== "false");
  const [uploading, setUploading] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);

  const { apiKey } = useApiKey();
  const catalog = useModelCatalog(apiKey);
  const imageModel = catalog.imageModels.some((m) => m.id === selectedImageModel) ? selectedImageModel : catalog.imageModels[0]?.id ?? "";
  const active = useChatStore((s) =>
    s.activeId ? s.conversations[s.activeId] ?? null : null,
  );
  const activeId = useChatStore((s) => s.activeId);
  const ready = useChatStore((s) => s.ready);
  const loaded = useChatStore((s) => activeId ? !!s.loaded[activeId] : true);
  const store = useChatStore;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const adapt = () => setSidebarOpen(media.matches && localStorage.getItem("sidebar-open") !== "false");
    media.addEventListener("change", adapt);
    const failed = (event: Event) => setToast((event as CustomEvent<string>).detail);
    window.addEventListener("persistence-error", failed);
    return () => { media.removeEventListener("change", adapt); window.removeEventListener("persistence-error", failed); abortRef.current?.abort(); };
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    if (window.matchMedia("(min-width: 768px)").matches) localStorage.setItem("sidebar-open", "false");
  }, []);
  const afterNavigate = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }, []);

  // Hydrate the conversation list from the server on first mount. Once loaded,
  // adopt the most-recent conversation, or start a fresh one if none exist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = store.getState();
      try { if (!s.ready) await s.loadConversations(); }
      catch (error) { if (!cancelled) setHistoryError(error instanceof Error ? error.message : "Could not load your chats."); return; }
      if (cancelled) return;
      const st = store.getState();
      if (st.activeId && st.conversations[st.activeId]) return;
      if (st.order.length > 0) st.setActive(st.order[0]);
      else st.newConversation();
    })();
    return () => {
      cancelled = true;
    };
  }, [store, historyRevision]);

  // Lazily fetch a conversation's messages the first time it becomes active.
  useEffect(() => {
    if (!activeId) return;
    const s = store.getState();
    if (!s.loaded[activeId]) s.loadMessages(activeId).catch((error) => setHistoryError(error instanceof Error ? error.message : "Could not load messages."));
  }, [activeId, store, historyRevision]);

  useEffect(() => {
    if (!catalog.models.length || !active || catalog.models.some((m) => m.id === active.model)) return;
    store.getState().setModel(catalog.models[0].id);
  }, [catalog.models, active, store]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const model: ModelId = active?.model ?? DEFAULT_MODEL;
  const effort: Effort = active?.effort ?? DEFAULT_EFFORT;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setUploading((v) => v + 1);
    try {
      const { attachments: read, errors } = await readFiles(files);
      if (read.length) {
        const hosted = await uploadAttachments(read);
        setAttachments((prev) => [...prev, ...hosted]);
      }
      if (errors.length) setToast(errors.join(" "));
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not upload files. Please try again."); }
    finally { setUploading((v) => v - 1); }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  /** Runs a streaming turn given the conversation history already in the store. */
  const runStream = useCallback(
    async (
      userText: string,
      userAttachments: Attachment[],
      history: Parameters<typeof streamChat>[0]["history"],
      useWebSearch: boolean,
    ) => {
      const conv = store.getState().activeConversation();
      if (!conv) return;
      const assistant = store.getState().beginAssistant();

      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);

      let firstReasoningAt = 0;
      const startedAt = Date.now();

      await streamChat({
        apiKey,
        model: conv.model,
        effort: conv.effort,
        history,
        userText,
        userAttachments,
        webSearch: useWebSearch,
        signal: controller.signal,
        handlers: {
          onReasoningDelta: (t) => {
            if (!firstReasoningAt) firstReasoningAt = Date.now();
            store.getState().appendReasoning(assistant.id, t);
          },
          onAnswerDelta: (t) => store.getState().appendAnswer(assistant.id, t),
          onSearchStart: () =>
            store.getState().setSearchStatus(assistant.id, "searching"),
          onSearchQuery: (q) => store.getState().addSearchQuery(assistant.id, q),
          onSearchDone: () =>
            store.getState().setSearchStatus(assistant.id, "searched"),
          onCitation: (c) => store.getState().addCitation(assistant.id, c),
          onDone: () => {
            const base = firstReasoningAt || startedAt;
            const secs = Math.max(1, Math.round((Date.now() - base) / 1000));
            store.getState().finalizeAssistant(assistant.id, secs);
          },
          onError: (msg) => store.getState().setError(assistant.id, msg),
        },
      });

      abortRef.current = null;
      setGenerating(false);
    },
    [apiKey, store],
  );

  /** Runs a single-shot image-generation turn (no chat history). */
  const runImage = useCallback(
    async (prompt: string, samples: string[]) => {
      const assistant = store.getState().beginAssistant({ isImage: true });

      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);

      const result = await generateImage({
        apiKey,
        prompt,
        size: imageSize,
        model: imageModel,
        samples,
        signal: controller.signal,
      });

      if ("error" in result) {
        store.getState().setError(assistant.id, result.error);
      } else {
        store.getState().setImages(assistant.id, result.images);
        store.getState().finalizeAssistant(assistant.id, 1);
      }

      abortRef.current = null;
      setGenerating(false);
    },
    [apiKey, imageSize, imageModel, store],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const s = store.getState();
      s.ensureActive();
      const conv = s.activeConversation();
      if (!conv) return;
      if (generating || uploading || !loaded || !ready || !catalog.models.some((m) => m.id === conv.model)) return;

      const sent = attachments;
      setAttachments([]);
      s.addUserMessage(text, sent);

      if (imageMode) {
        const samples = sent
          .filter((a) => a.kind === "image" && (a.url || a.dataUrl))
          .map((a) => (a.url ?? a.dataUrl) as string);
        await runImage(text, samples);
        return;
      }

      const history = conv.messages;
      await runStream(text, sent, history, webSearch);
    },
    [attachments, imageMode, webSearch, runImage, runStream, store, generating, uploading, loaded, ready, catalog.models],
  );

  // Edit a prior user message: rewrite it, drop everything after, re-run.
  const handleEditUserMessage = useCallback(
    async (messageId: string, newText: string) => {
      const s = store.getState();
      const conv = s.activeConversation();
      if (!conv) return;
      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;

      const original = conv.messages[idx];
      const history = conv.messages.slice(0, idx);
      s.editUserMessage(messageId, newText);
      s.truncateAfter(messageId, false); // keep the edited msg, drop replies after
      await runStream(newText, original.attachments ?? [], history, webSearch);
    },
    [runStream, store, webSearch],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    const conv = store.getState().activeConversation();
    const last = conv?.messages[conv.messages.length - 1];
    if (last && last.role === "assistant" && last.streaming) {
      store.getState().finalizeAssistant(last.id, last.thoughtSeconds ?? 1);
    }
  }, [store]);

  // Drag-and-drop file handling over the whole main pane.
  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const hasMessages = !!active && active.messages.length > 0;

  return (
    <div className="flex h-dvh overflow-hidden">
      {sidebarOpen && <Sidebar onOpenSettings={() => { setSettingsOpen(true); afterNavigate(); }} onClose={closeSidebar} onNavigate={afterNavigate} disabled={generating || !!uploading || !ready || !loaded} />}

      <main
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex shrink-0 items-center gap-1 px-2 py-2.5 sm:px-3">
          <button type="button" aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={sidebarOpen} aria-controls="chat-sidebar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-surface-2" onClick={() => {
            setSidebarOpen(!sidebarOpen);
            if (window.matchMedia("(min-width: 768px)").matches) localStorage.setItem("sidebar-open", String(!sidebarOpen));
          }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" /><path d="M9 4v16" stroke="currentColor" strokeWidth="1.7" /></svg>
          </button>
          <ModelSelector
            value={model}
            models={catalog.models}
            loading={catalog.loading}
            onRefresh={catalog.refresh}
            disabled={generating || !ready || !loaded}
            onChange={(id) => store.getState().setModel(id)}
          />
        </div>

        {(historyError || catalog.error) && <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2 text-sm"><span className="min-w-0 flex-1">{historyError || catalog.error}</span><button type="button" className="text-link" onClick={() => { setHistoryError(""); setHistoryRevision((v) => v + 1); catalog.refresh(); }}>Retry</button></div>}

        {!ready || !loaded ? <div role="status" className="flex flex-1 items-center justify-center text-sm text-fg-secondary">Loading your chats…</div> : hasMessages ? (
          <MessageList
            conversation={active}
            onEditUserMessage={handleEditUserMessage}
            editingDisabled={generating || !apiKey || !catalog.models.length}
          />
        ) : (
          <EmptyState />
        )}

        <div className={`w-full shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-4 ${hasMessages ? "sm:pb-4" : "sm:pb-[12vh]"}`}>
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              effort={effort}
              onEffortChange={(e) => store.getState().setEffort(e)}
              onSend={handleSend}
              onStop={handleStop}
              generating={generating}
              disabled={!!uploading || !ready || !loaded || (!!apiKey && (catalog.loading || (imageMode ? !imageModel : !catalog.models.length)))}
              hasKey={apiKey.length > 0}
              onNeedKey={() => setSettingsOpen(true)}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              webSearch={webSearch}
              onToggleWebSearch={() => setWebSearch((v) => !v)}
              imageMode={imageMode}
              onToggleImageMode={() => setImageMode((v) => !v)}
              imageSize={imageSize}
              onImageSizeChange={setImageSize}
              imageModel={imageModel}
              imageModels={catalog.imageModels}
              onImageModelChange={setImageModel}
            />
            {uploading > 0 && <p role="status" className="mt-2 text-center text-xs text-fg-secondary">Uploading files…</p>}
            <p className="mt-2 text-center text-xs text-fg-tertiary">
              ChatGPT can make mistakes. Check important info.
            </p>
          </div>
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-page/80">
            <div className="rounded-2xl border-2 border-dashed border-fg-secondary px-10 py-8 text-center">
              <div className="text-lg font-medium">Drop files to add</div>
              <div className="mt-1 text-sm text-fg-secondary">
                Images, PDFs, text and code
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="absolute bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-fg px-4 py-2 text-sm text-fg-inverse shadow-lg">
            {toast}
          </div>
        )}
      </main>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
