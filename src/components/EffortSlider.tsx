"use client";

import { useEffect, useRef, useState } from "react";
import type { Effort } from "@/lib/types";
import { EFFORT_STOPS, effortLabel } from "@/lib/models";

/**
 * The ChatGPT "thinking effort" control, rendered as a composer chip that opens
 * a small menu of the effort levels.
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
        <span>{effortLabel(value)}</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[200px] overflow-hidden rounded-menu border border-hairline bg-surface-1 py-1.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          <div className="px-3 pb-1 pt-1.5 text-xs font-semibold text-fg-secondary">
            Thinking effort
          </div>
          {EFFORT_STOPS.map((stop) => (
            <button
              key={stop.value}
              type="button"
              onClick={() => {
                onChange(stop.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[15px] transition-colors hover:bg-surface-2"
            >
              <span>{stop.label}</span>
              {value === stop.value && (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
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
