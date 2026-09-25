"use client";

import type { Message } from "@/lib/types";

/** ChatGPT-style "Searching the web" → "Searched the web" pill above a reply. */
export function SearchIndicator({ message }: { message: Message }) {
  if (!message.searchStatus) return null;
  const searching = message.searchStatus === "searching";

  return (
    <div className="mb-2 flex items-center gap-1.5 text-[15px]">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className={searching ? "text-fg-tertiary" : "text-fg-secondary"}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      <span className={searching ? "shimmer-text" : "text-fg-tertiary"}>
        {searching ? "Searching the web" : "Searched the web"}
      </span>
    </div>
  );
}
