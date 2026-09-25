"use client";

import { useRef, useState, useEffect } from "react";
import type { Effort } from "@/lib/types";
import { EffortSlider } from "./EffortSlider";

export function Composer({
  effort,
  onEffortChange,
  onSend,
  onStop,
  generating,
  hasKey,
  onNeedKey,
}: {
  effort: Effort;
  onEffortChange: (e: Effort) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  generating: boolean;
  hasKey: boolean;
  onNeedKey: () => void;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 240) + "px";
  }, [text]);

  const submit = () => {
    if (!hasKey) {
      onNeedKey();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || generating) return;
    onSend(trimmed);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = text.trim().length > 0 && !generating;

  return (
    <div
      className="rounded-[26px] border border-hairline bg-surface-1 px-3 pb-2 pt-3"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      <textarea
        ref={taRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask ChatGPT"
        className="max-h-60 w-full resize-none bg-transparent px-2 text-[17px] leading-6 outline-none placeholder:text-fg-tertiary"
      />

      <div className="mt-1 flex items-center justify-between">
        <EffortSlider value={effort} onChange={onEffortChange} />

        {generating ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-fg-inverse transition-opacity hover:opacity-90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-fg-inverse transition-opacity disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
