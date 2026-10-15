"use client";

import { Presence } from "./Presence";

import { useEffect, useId, useRef, useState } from "react";
import type { Effort, ModelId } from "@/lib/types";
import { EFFORT_STOPS, effortLabel, effortIndex, modelName } from "@/lib/models";

const SPARKS = [
  [9, 8, 0.7], [16, 15, 0.6], [27, 7, 0.8], [36, 12, 0.5],
  [48, 17, 0.7], [62, 10, 0.6], [73, 6, 0.5], [81, 15, 0.8],
  [95, 11, 0.6], [107, 17, 0.5], [115, 7, 0.8], [126, 13, 0.6],
  [139, 9, 0.7], [151, 17, 0.5], [165, 12, 0.8], [177, 7, 0.6],
  [188, 16, 0.5], [199, 10, 0.7], [211, 7, 0.6], [221, 15, 0.5],
];

export function EffortSlider({
  model,
  value,
  onChange,
}: {
  model: ModelId;
  value: Effort;
  onChange: (e: Effort) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupId = useId();

  const idx = effortIndex(value);
  const max = EFFORT_STOPS.length - 1;
  const isMax = idx === max;
  const pct = (idx / max) * 100;

  useEffect(() => {
    if (!open) return;
    const placePopup = () => {
      if (!ref.current || !popupRef.current) return;
      const left = ref.current.getBoundingClientRect().left;
      popupRef.current.style.left = `${Math.max(12 - left, Math.min(0, window.innerWidth - 12 - left - popupRef.current.offsetWidth))}px`;
    };
    placePopup();
    rangeRef.current?.focus({ preventScroll: true });
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", placePopup);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placePopup);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Thinking effort: ${effortLabel(value)}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-capsule border border-hairline px-3 py-1.5 text-[14px] text-fg-secondary transition-colors hover:bg-surface-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 3a6 6 0 00-3.5 10.9c.3.2.5.6.5 1V17h6v-2.1c0-.4.2-.8.5-1A6 6 0 0012 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 20h6M10 22h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className={isMax ? "text-[#cc865f] font-medium" : undefined}>
          {effortLabel(value)}
        </span>
      </button>

      <Presence show={open}>
        <div
          ref={popupRef}
          id={popupId}
          role="dialog"
          aria-label="Thinking effort"
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(256px,calc(100vw-92px))] rounded-[20px] border border-white/10 bg-[#3d3d3b]/95 px-3 pb-1.5 pt-2.5 text-[#f5f3ef] shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center justify-center gap-1 font-mono text-[14px] leading-5 tracking-wide">
            <span className="truncate">{modelName(model).replace(/^GPT-/, "")}</span>
            <span className="shrink-0 text-[#d48c64]">{effortLabel(value)}</span>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[#a4a19b]">
              <path d="m4.5 3 3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="effort-rail relative mt-1 h-10 rounded-full" data-max={isMax}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-full bg-[#514037] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="effort-warm-fill absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%` }} />
              <svg viewBox="0 0 230 24" preserveAspectRatio="none" className="effort-sparks absolute inset-0 h-full w-full" fill="#ffe3c7">
                {SPARKS.map(([cx, cy, r], index) => <circle key={index} cx={cx} cy={cy} r={r} />)}
              </svg>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
              style={{ left: `calc(${pct}% + ${14 - pct * 0.28}px)` }}
            />
            <input
              ref={rangeRef}
              type="range"
              min={0}
              max={max}
              step={1}
              value={idx}
              onChange={(e) => onChange(EFFORT_STOPS[Number(e.target.value)].value)}
              aria-label="Thinking effort"
              aria-valuetext={effortLabel(value)}
              className="effort-range absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        </div>
      </Presence>
    </div>
  );
}
