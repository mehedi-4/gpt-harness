"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ThinkingIndicator } from "./ThinkingIndicator";

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-surface-2 ${
        active ? "text-fg" : "text-fg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

export function AssistantMessage({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const showActions = !message.streaming && !message.error && message.content.length > 0;

  return (
    <div className="group">
      <ThinkingIndicator message={message} />

      {message.error ? (
        <div className="rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-[15px] text-fg-secondary">
          {message.error}
        </div>
      ) : (
        <Markdown content={message.content} />
      )}

      {/* Blinking caret while an empty answer is still streaming. */}
      {message.streaming && message.content.length === 0 && !message.reasoning && (
        <span className="inline-block h-4 w-2 animate-pulse bg-fg align-middle" />
      )}

      {showActions && (
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ActionButton label="Copy" onClick={copy}>
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </ActionButton>
          <ActionButton label="Good response" active={vote === "up"} onClick={() => setVote(vote === "up" ? null : "up")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={vote === "up" ? "currentColor" : "none"}>
              <path d="M7 10v11H4a1 1 0 01-1-1v-9a1 1 0 011-1h3zm4 0l3-7a2 2 0 012 2v3h4a2 2 0 012 2.3l-1.3 7A2 2 0 0118.7 21H11V10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </ActionButton>
          <ActionButton label="Bad response" active={vote === "down"} onClick={() => setVote(vote === "down" ? null : "down")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={vote === "down" ? "currentColor" : "none"} className="rotate-180">
              <path d="M7 10v11H4a1 1 0 01-1-1v-9a1 1 0 011-1h3zm4 0l3-7a2 2 0 012 2v3h4a2 2 0 012 2.3l-1.3 7A2 2 0 0118.7 21H11V10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </ActionButton>
        </div>
      )}
    </div>
  );
}
