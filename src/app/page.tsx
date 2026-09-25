"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/store";
import { useApiKey } from "@/hooks/useApiKey";
import { streamChat } from "@/lib/streamChat";
import type { Effort, ModelId } from "@/lib/types";
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
  const abortRef = useRef<AbortController | null>(null);

  const { apiKey } = useApiKey();
  const active = useChatStore((s) =>
    s.activeId ? s.conversations[s.activeId] ?? null : null,
  );
  const store = useChatStore;

  useEffect(() => setMounted(true), []);

  // Ensure there is always an active conversation once mounted.
  useEffect(() => {
    if (mounted && !useChatStore.getState().activeId) {
      useChatStore.getState().newConversation();
    }
  }, [mounted]);

  const model: ModelId = active?.model ?? DEFAULT_MODEL;
  const effort: Effort = active?.effort ?? DEFAULT_EFFORT;

  const handleSend = useCallback(
    async (text: string) => {
      const s = store.getState();
      s.ensureActive();
      const conv = s.activeConversation();
      if (!conv) return;

      const history = conv.messages;
      s.addUserMessage(text);
      const assistant = s.beginAssistant();

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
        userText: text,
        signal: controller.signal,
        handlers: {
          onReasoningDelta: (t) => {
            if (!firstReasoningAt) firstReasoningAt = Date.now();
            store.getState().appendReasoning(assistant.id, t);
          },
          onAnswerDelta: (t) => store.getState().appendAnswer(assistant.id, t),
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

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    // Settle the thinking indicator on the streaming message.
    const conv = store.getState().activeConversation();
    const last = conv?.messages[conv.messages.length - 1];
    if (last && last.role === "assistant" && last.streaming) {
      store.getState().finalizeAssistant(last.id, last.thoughtSeconds ?? 1);
    }
  }, [store]);

  const hasMessages = !!active && active.messages.length > 0;

  return (
    <div className="flex h-screen">
      {mounted && <Sidebar onOpenSettings={() => setSettingsOpen(true)} />}

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Top-left model selector (no filled top bar). */}
        <div className="flex items-center px-3 py-2.5">
          <ModelSelector
            value={model}
            onChange={(id) => store.getState().setModel(id)}
          />
        </div>

        {mounted && hasMessages ? (
          <MessageList conversation={active} />
        ) : (
          <EmptyState />
        )}

        <div
          className={`w-full px-4 ${hasMessages ? "pb-4" : "pb-[18vh]"}`}
        >
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              effort={effort}
              onEffortChange={(e) => store.getState().setEffort(e)}
              onSend={handleSend}
              onStop={handleStop}
              generating={generating}
              hasKey={apiKey.length > 0}
              onNeedKey={() => setSettingsOpen(true)}
            />
            <p className="mt-2 text-center text-xs text-fg-tertiary">
              ChatGPT can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
