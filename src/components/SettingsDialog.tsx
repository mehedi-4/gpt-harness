"use client";

import { useEffect, useRef, useState } from "react";
import { useApiKey } from "@/hooks/useApiKey";

export function SettingsDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const { apiKey, setApiKey, clearApiKey } = useApiKey();
  const [draft, setDraft] = useState(apiKey);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    setApiKey(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-md rounded-lg border border-hairline bg-surface-1 p-6"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className="text-lg font-semibold">Settings</h2>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Enter your own OpenAI API key. It is saved for your account in this
          browser and sent through the server to OpenAI. It is never saved to the database.
        </p>

        <label htmlFor="openai-key" className="mt-5 block text-[14px] font-medium">OpenAI API key</label>
        <input
          id="openai-key"
          ref={inputRef}
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="sk-..."
          className="mt-1.5 w-full rounded-lg border border-hairline bg-page px-3 py-2 font-mono text-[14px] outline-none focus:border-fg-secondary"
        />

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              clearApiKey();
              setDraft("");
            }}
            className="text-[14px] text-fg-secondary transition-colors hover:text-fg"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-capsule border border-hairline px-4 py-2 text-[14px] transition-colors hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-capsule bg-fg px-4 py-2 text-[14px] text-fg-inverse transition-opacity hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
