"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/store";
import { useApiKey } from "@/hooks/useApiKey";
import { streamChat } from "@/lib/streamChat";
import { generateImage } from "@/lib/generateImage";
import { readFiles, uploadAttachments } from "@/lib/files";
import type { Effort, ModelId, Attachment, ImageSize, ImageModelId, DocFormat } from "@/lib/types";
import { DEFAULT_MODEL, DEFAULT_EFFORT, DEFAULT_IMAGE_SIZE, DEFAULT_IMAGE_MODEL, DEFAULT_DOC_FORMAT } from "@/lib/models";
import { Sidebar } from "@/components/Sidebar";
import { ModelSelector } from "@/components/ModelSelector";
import { Composer } from "@/components/Composer";
import { MessageList } from "@/components/MessageList";
import { EmptyState } from "@/components/EmptyState";
import { SettingsDialog } from "@/components/SettingsDialog";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [webSearch, setWebSearch] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize>(DEFAULT_IMAGE_SIZE);
  const [imageModel, setImageModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL);
  const [docMode, setDocMode] = useState(false);
  const [docFormat, setDocFormat] = useState<DocFormat>(DEFAULT_DOC_FORMAT);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);

  const { apiKey } = useApiKey();
  const active = useChatStore((s) =>
    s.activeId ? s.conversations[s.activeId] ?? null : null,
  );
  const activeId = useChatStore((s) => s.activeId);
  const store = useChatStore;

  useEffect(() => setMounted(true), []);

  // Hydrate the conversation list from the server on first mount. Once loaded,
  // adopt the most-recent conversation, or start a fresh one if none exist.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      const s = store.getState();
      if (!s.ready) await s.loadConversations();
      if (cancelled) return;
      const st = store.getState();
      if (st.activeId && st.conversations[st.activeId]) return;
      if (st.order.length > 0) st.setActive(st.order[0]);
      else st.newConversation();
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, store]);

  // Lazily fetch a conversation's messages the first time it becomes active.
  useEffect(() => {
    if (!activeId) return;
    const s = store.getState();
    if (!s.loaded[activeId]) s.loadMessages(activeId);
  }, [activeId, store]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const model: ModelId = active?.model ?? DEFAULT_MODEL;
  const effort: Effort = active?.effort ?? DEFAULT_EFFORT;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const { attachments: read, errors } = await readFiles(files);
    if (read.length) {
      setAttachments((prev) => [...prev, ...read]);
      // Upload binaries to Cloudinary in the background and backfill their
      // hosted `url`; the in-memory `dataUrl` still drives the live turn.
      uploadAttachments(read).then((hosted) => {
        setAttachments((prev) =>
          prev.map((a) => {
            const up = hosted.find((h) => h.id === a.id);
            return up?.url ? { ...a, url: up.url } : a;
          }),
        );
      });
    }
    if (errors.length) setToast(errors.join(" "));
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

  /** Runs a document-generation turn: a normal streaming turn steered to emit a
   *  clean, standalone document (so attached PDFs/files reach the model), whose
   *  reply is flagged for a one-click download in the chosen format. */
  const runDocument = useCallback(
    async (
      userText: string,
      userAttachments: Attachment[],
      history: Parameters<typeof streamChat>[0]["history"],
      fmt: DocFormat,
    ) => {
      const conv = store.getState().activeConversation();
      if (!conv) return;
      const assistant = store
        .getState()
        .beginAssistant({ isDocument: true, docFormat: fmt });

      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);

      let firstReasoningAt = 0;
      const startedAt = Date.now();

      const instruction =
        "You are producing a standalone document, not a chat reply. " +
        "Transform the user's request and any attached files into a clean, " +
        "professional, well-structured document in GitHub-flavored Markdown. " +
        "Use clear headings, lists, tables where helpful, and render math with " +
        "$…$ / $$…$$. Do not address the user, do not add conversational preamble " +
        "or closing remarks, and do not wrap the whole document in a code fence. " +
        "Output only the document itself.\n\n---\n\n";

      await streamChat({
        apiKey,
        model: conv.model,
        effort: conv.effort,
        history,
        userText: instruction + userText,
        userAttachments,
        webSearch: false,
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

  const handleSend = useCallback(
    async (text: string) => {
      const s = store.getState();
      s.ensureActive();
      const conv = s.activeConversation();
      if (!conv) return;

      const sent = attachments;
      setAttachments([]);
      s.addUserMessage(text, sent);

      if (imageMode) {
        const samples = sent
          .filter((a) => a.kind === "image" && a.dataUrl)
          .map((a) => a.dataUrl as string);
        await runImage(text, samples);
        return;
      }

      if (docMode) {
        await runDocument(text, sent, conv.messages, docFormat);
        return;
      }

      const history = conv.messages;
      await runStream(text, sent, history, webSearch);
    },
    [attachments, imageMode, docMode, docFormat, webSearch, runImage, runDocument, runStream, store],
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
    <div className="flex h-screen">
      {mounted && <Sidebar onOpenSettings={() => setSettingsOpen(true)} />}

      <main
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex items-center px-3 py-2.5">
          <ModelSelector
            value={model}
            onChange={(id) => store.getState().setModel(id)}
          />
        </div>

        {mounted && hasMessages ? (
          <MessageList
            conversation={active}
            onEditUserMessage={handleEditUserMessage}
            editingDisabled={generating}
          />
        ) : (
          <EmptyState />
        )}

        <div className={`w-full px-4 ${hasMessages ? "pb-4" : "pb-[18vh]"}`}>
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              effort={effort}
              onEffortChange={(e) => store.getState().setEffort(e)}
              onSend={handleSend}
              onStop={handleStop}
              generating={generating}
              hasKey={apiKey.length > 0}
              onNeedKey={() => setSettingsOpen(true)}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              webSearch={webSearch}
              onToggleWebSearch={() => setWebSearch((v) => !v)}
              imageMode={imageMode}
              onToggleImageMode={() =>
                setImageMode((v) => {
                  const next = !v;
                  if (next) setDocMode(false);
                  return next;
                })
              }
              imageSize={imageSize}
              onImageSizeChange={setImageSize}
              imageModel={imageModel}
              onImageModelChange={setImageModel}
              docMode={docMode}
              onToggleDocMode={() =>
                setDocMode((v) => {
                  const next = !v;
                  if (next) setImageMode(false);
                  return next;
                })
              }
              docFormat={docFormat}
              onDocFormatChange={setDocFormat}
            />
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

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
