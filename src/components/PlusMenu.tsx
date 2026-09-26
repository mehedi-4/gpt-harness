"use client";

import { useEffect, useRef, useState } from "react";

function PhotoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
      <path d="M4 17l4.5-4.5 3 3L15 12l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="9.5" r="1.6" fill="currentColor" />
      <path d="M4.5 18l4.5-4.5 3.5 3.5 3-3 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M14 3v4a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6 3h8l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PlusMenu({
  webSearch,
  onToggleWebSearch,
  imageMode,
  onToggleImageMode,
  docMode,
  onToggleDocMode,
  onAddPhotosFiles,
}: {
  webSearch: boolean;
  onToggleWebSearch: () => void;
  imageMode: boolean;
  onToggleImageMode: () => void;
  docMode: boolean;
  onToggleDocMode: () => void;
  onAddPhotosFiles: () => void;
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
        aria-label="Add"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-fg-secondary transition-colors hover:bg-surface-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[260px] overflow-hidden rounded-menu border border-hairline bg-surface-1 py-1.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          <button
            type="button"
            onClick={() => {
              onAddPhotosFiles();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-surface-2"
          >
            <PhotoIcon />
            <span>Add photos &amp; files</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleWebSearch();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-surface-2"
          >
            <GlobeIcon />
            <span className="flex-1">Web search</span>
            {webSearch && (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleImageMode();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-surface-2"
          >
            <ImageIcon />
            <span className="flex-1">Images</span>
            {imageMode && (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleDocMode();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-surface-2"
          >
            <DocumentIcon />
            <span className="flex-1">Documents</span>
            {docMode && (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
