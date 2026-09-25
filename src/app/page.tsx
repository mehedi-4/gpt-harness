"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/store";
import { useApiKey } from "@/hooks/useApiKey";
import { streamChat } from "@/lib/streamChat";
import { readFiles } from "@/lib/files";
import type { Effort, ModelId, Attachment } from "@/lib/types";
import { DEFAULT_MODEL, DEFAULT_EFFORT } from "@/lib/models";
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
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);

  const { apiKey } = useApiKey();
  const active = useChatStore((s) =>
    s.activeId ? s.conversations[s.activeId] ?? null : null,
  );
  const store = useChatStore;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !useChatStore.getState().activeId) {
      useChatStore.getState().newConversation();
    }
  }, [mounted]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const model: ModelId = active?.model ?? DEFAULT_MODEL;
  const effort: Effort = active?.effort ?? DEFAULT_EFFORT;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const { attachments: read, errors } = await readFiles(files);
    if (read.length) setAttachments((prev) => [...prev, ...read]);
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

      const history = conv.messages;
      const sent = attachments;
      const useWebSearch = webSearch;
      setAttachments([]);
      s.addUserMessage(text, sent);
      await runStream(text, sent, history, useWebSearch);
    },
    [attachments, webSearch, runStream, store],
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
