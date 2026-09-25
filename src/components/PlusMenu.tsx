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

function ResearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PlusMenu({
  webSearch,
  onToggleWebSearch,
  onAddPhotosFiles,
}: {
  webSearch: boolean;
  onToggleWebSearch: () => void;
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
            disabled
            className="flex w-full cursor-not-allowed items-center gap-3 px-3 py-2.5 text-left text-[15px] text-fg-tertiary"
          >
            <ResearchIcon />
            <span className="flex-1">Deep research</span>
            <span className="text-[11px] text-fg-tertiary">Soon</span>
          </button>
        </div>
      )}
    </div>
  );
}
