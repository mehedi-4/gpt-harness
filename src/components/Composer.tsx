"use client";

import { useRef, useState, useEffect } from "react";
import type { Effort, Attachment } from "@/lib/types";
import { EffortSlider } from "./EffortSlider";
import { AttachmentChip } from "./AttachmentChip";
import { PlusMenu } from "./PlusMenu";

export function Composer({
  effort,
  onEffortChange,
  onSend,
  onStop,
  generating,
  hasKey,
  onNeedKey,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  webSearch,
  onToggleWebSearch,
}: {
  effort: Effort;
  onEffortChange: (e: Effort) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  generating: boolean;
  hasKey: boolean;
  onNeedKey: () => void;
  attachments: Attachment[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if ((!trimmed && attachments.length === 0) || generating) return;
    onSend(trimmed);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      onAddFiles(files);
    }
  };

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !generating;

  return (
    <div
      className="rounded-[26px] border border-hairline bg-surface-1 px-3 pb-2 pt-3"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pb-2 pt-1">
          {attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              attachment={a}
              onRemove={() => onRemoveAttachment(a.id)}
            />
          ))}
        </div>
      )}

      <textarea
        ref={taRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder="Ask ChatGPT"
        className="max-h-60 w-full resize-none bg-transparent px-2 text-[17px] leading-6 outline-none placeholder:text-fg-tertiary"
      />

      <div className="mt-1 flex items-center gap-2">
        <PlusMenu
          webSearch={webSearch}
          onToggleWebSearch={onToggleWebSearch}
          onAddPhotosFiles={() => fileRef.current?.click()}
        />

        {webSearch && (
          <button
            type="button"
            onClick={onToggleWebSearch}
            className="flex items-center gap-1.5 rounded-capsule border border-link/40 bg-link/10 px-3 py-1.5 text-[14px] text-link transition-colors hover:bg-link/15"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
              <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            <span>Web search</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <EffortSlider value={effort} onChange={onEffortChange} />

        <div className="flex-1" />

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
