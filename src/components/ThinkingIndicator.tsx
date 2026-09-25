"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";

export function ThinkingIndicator({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  const reasoning = message.reasoning ?? "";
  const isThinking = message.streaming && message.content.length === 0;

  // Nothing to show: no reasoning captured and not actively thinking.
  if (!isThinking && reasoning.length === 0) return null;

  const label = isThinking
    ? "Thinking"
    : message.thoughtSeconds
      ? `Thought for ${message.thoughtSeconds}s`
      : "Thought for a moment";

  const canExpand = reasoning.length > 0;

  return (
    <div className="mb-2">
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => canExpand && setOpen((o) => !o)}
        className="flex items-center gap-1 text-[15px] disabled:cursor-default"
      >
        <span className={isThinking ? "shimmer-text" : "text-fg-tertiary"}>
          {label}
        </span>
        {canExpand && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className={`text-fg-tertiary transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && canExpand && (
        <div className="mt-2 whitespace-pre-wrap border-l-2 border-hairline pl-3 text-[14px] leading-relaxed text-fg-secondary">
          {reasoning}
        </div>
      )}
    </div>
  );
}
