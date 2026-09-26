"use client";

import type { Attachment } from "@/lib/types";
import { formatBytes } from "@/lib/files";

function FileGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14 3v4a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 3h8l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** A single attachment: image thumbnail or a file card, optionally removable. */
export function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: () => void;
}) {
  const removeBtn = onRemove ? (
    <button
      type="button"
      aria-label={`Remove ${attachment.name}`}
      onClick={onRemove}
      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-fg text-fg-inverse shadow"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
  ) : null;

  if (attachment.kind === "image" && (attachment.url || attachment.dataUrl)) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url ?? attachment.dataUrl}
          alt={attachment.name}
          className="h-16 w-16 rounded-lg border border-hairline object-cover"
        />
        {removeBtn}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-1 px-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-secondary">
        <FileGlyph />
      </div>
      <div className="min-w-0">
        <div className="max-w-[160px] truncate text-[13px] font-medium">
          {attachment.name}
        </div>
        <div className="text-[11px] uppercase text-fg-secondary">
          {attachment.kind === "pdf" ? "PDF" : "Document"} · {formatBytes(attachment.size)}
        </div>
      </div>
      {removeBtn}
    </div>
  );
}
