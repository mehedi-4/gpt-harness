"use client";

import { useEffect, useRef } from "react";
import type { Conversation } from "@/lib/types";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";

export function MessageList({
  conversation,
  onEditUserMessage,
  editingDisabled,
}: {
  conversation: Conversation;
  onEditUserMessage: (id: string, text: string) => void;
  editingDisabled: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Autoscroll to the bottom on new content only if the user is already near it.
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const streamingLen = lastMsg?.content.length ?? 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation.messages.length, streamingLen]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        {conversation.messages.map((m) =>
          m.role === "user" ? (
            <UserMessage
              key={m.id}
              message={m}
              onEdit={onEditUserMessage}
              editingDisabled={editingDisabled}
            />
          ) : (
            <AssistantMessage key={m.id} message={m} />
          ),
        )}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}
