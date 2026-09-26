"use client";

import { useRef, useState, useEffect } from "react";
import type { Effort, Attachment, ImageSize, ImageModelId, DocFormat } from "@/lib/types";
import { IMAGE_SIZES, imageSizeLabel, IMAGE_MODELS, imageModelName, DOC_FORMATS, docFormatLabel } from "@/lib/models";
import { EffortSlider } from "./EffortSlider";
import { AttachmentChip } from "./AttachmentChip";
import { PlusMenu } from "./PlusMenu";

function ImageModelSelector({
  value,
  onChange,
}: {
  value: ImageModelId;
  onChange: (v: ImageModelId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-capsule border border-hairline px-3 py-1.5 text-[14px] text-fg-secondary transition-colors hover:bg-surface-2"
      >
        <span>{imageModelName(value)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[240px] overflow-hidden rounded-menu border border-hairline bg-surface-1 py-1.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          {IMAGE_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[14px] transition-colors hover:bg-surface-2"
            >
              <span className="flex-1">{m.name}</span>
              {value === m.id && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageSizeSelector({
  value,
  onChange,
}: {
  value: ImageSize;
  onChange: (v: ImageSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-capsule border border-hairline px-3 py-1.5 text-[14px] text-fg-secondary transition-colors hover:bg-surface-2"
      >
        <span>{imageSizeLabel(value)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[180px] overflow-hidden rounded-menu border border-hairline bg-surface-1 py-1.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          {IMAGE_SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                onChange(s.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[14px] transition-colors hover:bg-surface-2"
            >
              <span className="flex-1">{s.label}</span>
              <span className="text-fg-tertiary">{s.value}</span>
              {value === s.value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocFormatSelector({
  value,
  onChange,
}: {
  value: DocFormat;
  onChange: (v: DocFormat) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-capsule border border-hairline px-3 py-1.5 text-[14px] text-fg-secondary transition-colors hover:bg-surface-2"
      >
        <span>{docFormatLabel(value)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[180px] overflow-hidden rounded-menu border border-hairline bg-surface-1 py-1.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          {DOC_FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                onChange(f.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[14px] transition-colors hover:bg-surface-2"
            >
              <span className="flex-1">{f.label}</span>
              {value === f.value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  imageMode,
  onToggleImageMode,
  imageSize,
  onImageSizeChange,
  imageModel,
  onImageModelChange,
  docMode,
  onToggleDocMode,
  docFormat,
  onDocFormatChange,
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
  imageMode: boolean;
  onToggleImageMode: () => void;
  imageSize: ImageSize;
  onImageSizeChange: (v: ImageSize) => void;
  imageModel: ImageModelId;
  onImageModelChange: (v: ImageModelId) => void;
  docMode: boolean;
  onToggleDocMode: () => void;
  docFormat: DocFormat;
  onDocFormatChange: (v: DocFormat) => void;
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
        placeholder={
          imageMode
            ? "Describe an image…"
            : docMode
              ? "Describe the document…"
              : "Ask ChatGPT"
        }
        className="max-h-60 w-full resize-none bg-transparent px-2 text-[17px] leading-6 outline-none placeholder:text-fg-tertiary"
      />

      <div className="mt-1 flex items-center gap-2">
        <PlusMenu
          webSearch={webSearch}
          onToggleWebSearch={onToggleWebSearch}
          imageMode={imageMode}
          onToggleImageMode={onToggleImageMode}
          docMode={docMode}
          onToggleDocMode={onToggleDocMode}
          onAddPhotosFiles={() => fileRef.current?.click()}
        />

        {imageMode ? (
          <>
            <button
              type="button"
              onClick={onToggleImageMode}
              className="flex items-center gap-1.5 rounded-capsule border border-violet/40 bg-violet/10 px-3 py-1.5 text-[14px] text-violet transition-colors hover:bg-violet/15"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="9" cy="9.5" r="1.6" fill="currentColor" />
                <path d="M4.5 18l4.5-4.5 3.5 3.5 3-3 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Images</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <ImageSizeSelector value={imageSize} onChange={onImageSizeChange} />
            <ImageModelSelector value={imageModel} onChange={onImageModelChange} />
          </>
        ) : docMode ? (
          <>
            <button
              type="button"
              onClick={onToggleDocMode}
              className="flex items-center gap-1.5 rounded-capsule border border-link/40 bg-link/10 px-3 py-1.5 text-[14px] text-link transition-colors hover:bg-link/15"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M14 3v4a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M6 3h8l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span>Documents</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <DocFormatSelector value={docFormat} onChange={onDocFormatChange} />
          </>
        ) : (
          <>
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
          </>
        )}

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
