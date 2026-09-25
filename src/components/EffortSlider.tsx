"use client";

import { useEffect, useRef, useState } from "react";
import type { Effort } from "@/lib/types";
import { EFFORT_STOPS, effortLabel, effortIndex } from "@/lib/models";

/**
 * The ChatGPT "thinking effort" control: a composer chip that opens a popover
 * with a draggable slider across the effort levels. At the top ("Max") stop the
 * track and label pick up ChatGPT's animated gradient sweep.
 */
export function EffortSlider({
  value,
  onChange,
}: {
  value: Effort;
  onChange: (e: Effort) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const idx = effortIndex(value);
  const max = EFFORT_STOPS.length - 1;
  const isMax = idx === max;
  const pct = (idx / max) * 100;

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
        className="flex items-center gap-1.5 rounded-capsule border border-hairline px-3 py-1.5 text-[14px] text-fg-secondary transition-colors hover:bg-surface-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 3a6 6 0 00-3.5 10.9c.3.2.5.6.5 1V17h6v-2.1c0-.4.2-.8.5-1A6 6 0 0012 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 20h6M10 22h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className={isMax ? "effort-max-text font-medium" : undefined}>
          {effortLabel(value)}
        </span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[280px] rounded-menu border border-hairline bg-surface-1 p-4"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-secondary">
              Thinking effort
            </span>
            <span
              className={`text-[13px] font-medium ${isMax ? "effort-max-text" : "text-fg"}`}
            >
              {effortLabel(value)}
            </span>
          </div>

          {/* Track + fill + thumb, driven by an invisible range input on top. */}
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
            <div
              className={`absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full ${isMax ? "effort-max-track" : "bg-fg"}`}
              style={{ width: `${pct}%` }}
            />
            <div
              className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-page bg-fg shadow ${isMax ? "effort-max-track effort-max-thumb" : ""}`}
              style={{ left: `${pct}%` }}
            />
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={idx}
              onChange={(e) => onChange(EFFORT_STOPS[Number(e.target.value)].value)}
              aria-label="Thinking effort"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          <div className="mt-2 flex justify-between text-[10px] text-fg-tertiary">
            <span>{EFFORT_STOPS[0].label}</span>
            <span>{EFFORT_STOPS[max].label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
