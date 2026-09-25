"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelId } from "@/lib/types";
import { ALL_MODELS, modelName } from "@/lib/models";

export function ModelSelector({
  value,
  onChange,
}: {
  value: ModelId;
  onChange: (id: ModelId) => void;
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
        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[18px] font-medium transition-colors hover:bg-surface-2"
      >
        <span>{modelName(value)}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-fg-secondary">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-[240px] overflow-hidden rounded-menu border border-hairline bg-surface-1 py-1.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          {ALL_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex-1 text-[15px] font-medium">{m.name}</span>
              {value === m.id && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
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
