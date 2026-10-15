"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Keep a closing surface mounted just long enough to finish its exit motion. */
export function Presence({ show, kind = "popover", children }: {
  show: boolean;
  kind?: "popover" | "modal" | "sidebar";
  children: ReactNode;
}) {
  const [present, setPresent] = useState(show);
  const [previous, setPrevious] = useState(show);
  if (show !== previous) {
    setPrevious(show);
    if (show) setPresent(true);
  }

  useEffect(() => {
    if (show || !present) return;
    const timer = setTimeout(() => setPresent(false), 160);
    return () => clearTimeout(timer);
  }, [show, present]);

  if (!present) return null;
  return (
    <div className={`ui-presence ui-${kind}`} data-state={show ? "open" : "closed"} inert={!show} aria-hidden={!show || undefined}>
      {children}
    </div>
  );
}
