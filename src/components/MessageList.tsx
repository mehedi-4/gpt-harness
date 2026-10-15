"use client";

import { useLayoutEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  // Follow actual rendered height, including streamed Markdown and loaded images.
  // Scrolling up opts out until the reader returns near the bottom.
  useLayoutEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    following.current = true;
    el.scrollTop = el.scrollHeight;
    const resize = new ResizeObserver(() => {
      if (following.current) el.scrollTop = el.scrollHeight;
    });
    resize.observe(content);
    return () => resize.disconnect();
  }, [conversation.id]);

  return (
    <div ref={containerRef} onScroll={(event) => {
      const el = event.currentTarget;
      following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    }} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]">
      <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        {conversation.messages.map((m) =>
          <div key={m.id} className="ui-message min-w-0" data-message-id={m.id}>{m.role === "user" ? (
            <UserMessage
              message={m}
              onEdit={onEditUserMessage}
              editingDisabled={editingDisabled}
            />
          ) : (
            <AssistantMessage message={m} />
          )}</div>,
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
