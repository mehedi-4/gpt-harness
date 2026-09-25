"use client";

import type { Citation } from "@/lib/types";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Source chips shown under a reply that used web search. */
export function Citations({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-xs font-semibold text-fg-secondary">Sources</div>
      <div className="flex flex-wrap gap-2">
        {citations.map((c, i) => (
          <a
            key={`${c.url}-${i}`}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            title={c.title}
            className="flex max-w-[260px] items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${hostOf(c.url)}&sz=32`}
              alt=""
              width={16}
              height={16}
              className="rounded-sm"
            />
            <span className="truncate text-fg-secondary">{hostOf(c.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
