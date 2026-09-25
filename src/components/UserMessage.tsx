"use client";

import { useState, useRef, useEffect } from "react";
import type { Message } from "@/lib/types";
import { AttachmentChip } from "./AttachmentChip";

export function UserMessage({
  message,
  onEdit,
  editingDisabled,
}: {
  message: Message;
  onEdit: (id: string, text: string) => void;
  editingDisabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }
  }, [editing]);

  const start = () => {
    setDraft(message.content);
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== message.content) onEdit(message.id, trimmed);
  };

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[76%] rounded-[22px] bg-surface-2 px-4 py-3">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const ta = taRef.current;
              if (ta) {
                ta.style.height = "auto";
                ta.style.height = ta.scrollHeight + "px";
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                cancel();
              }
            }}
            className="w-full resize-none bg-transparent text-[17px] leading-[1.4] outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-capsule border border-hairline px-4 py-1.5 text-[14px] transition-colors hover:bg-surface-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-capsule bg-fg px-4 py-1.5 text-[14px] text-fg-inverse transition-opacity hover:opacity-90"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1.5">
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex max-w-[76%] flex-wrap justify-end gap-2">
          {message.attachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} />
          ))}
        </div>
      )}

      {message.content && (
        <div className="max-w-[76%] whitespace-pre-wrap rounded-[22px] bg-surface-2 px-[18px] py-2.5 text-[17px] leading-[1.4]">
          {message.content}
        </div>
      )}

      <button
        type="button"
        aria-label="Edit message"
        onClick={start}
        disabled={editingDisabled}
        className="flex h-7 w-7 items-center justify-center rounded-md text-fg-secondary opacity-0 transition hover:bg-surface-2 group-hover:opacity-100 disabled:opacity-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
