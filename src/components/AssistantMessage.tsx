"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { SearchIndicator } from "./SearchIndicator";
import { Citations } from "./Citations";
import { downloadMarkdown, downloadText, printHtmlToPdf } from "@/lib/exportDoc";
import type { DocFormat } from "@/lib/types";

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-surface-2 ${
        active ? "text-fg" : "text-fg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function ExportMenu({
  onPdf,
  onMarkdown,
  onText,
}: {
  onPdf: () => void;
  onMarkdown: () => void;
  onText: () => void;
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

  const pick = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <ActionButton label="Export" active={open} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ActionButton>
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[180px] overflow-hidden rounded-menu border border-hairline bg-surface-1 py-1.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          <button
            type="button"
            onClick={() => pick(onPdf)}
            className="flex w-full items-center px-3 py-2 text-left text-[14px] transition-colors hover:bg-surface-2"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => pick(onMarkdown)}
            className="flex w-full items-center px-3 py-2 text-left text-[14px] transition-colors hover:bg-surface-2"
          >
            Markdown (.md)
          </button>
          <button
            type="button"
            onClick={() => pick(onText)}
            className="flex w-full items-center px-3 py-2 text-left text-[14px] transition-colors hover:bg-surface-2"
          >
            Text (.txt)
          </button>
        </div>
      )}
    </div>
  );
}

function downloadImage(src: string, index: number) {
  // For a cross-origin Cloudinary URL, route through the fl_attachment transform
  // so the browser downloads rather than navigates; data URLs download directly.
  let href = src;
  if (/^https?:\/\/res\.cloudinary\.com\//.test(src)) {
    href = src.replace("/upload/", "/upload/fl_attachment/");
  }
  const a = document.createElement("a");
  a.href = href;
  a.download = `image-${index + 1}.png`;
  a.click();
}

const DOC_LABEL: Record<DocFormat, string> = {
  pdf: "PDF",
  markdown: "Markdown",
  text: "Text",
};

export function AssistantMessage({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const title = message.content.split("\n").find((l) => l.trim())?.slice(0, 60) || "document";
  const exportPdf = () => {
    const html = contentRef.current?.innerHTML;
    if (html) printHtmlToPdf(html, title);
  };

  // Server-rendered PDF (professional, selectable text + math) for Documents mode.
  const downloadServerPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await fetch("/api/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: message.content, title }),
      });
      if (!res.ok) {
        // Fall back to the client print path if the server route fails.
        exportPdf();
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      exportPdf();
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadDocument = () => {
    const fmt = message.docFormat ?? "pdf";
    if (fmt === "markdown") downloadMarkdown(message.content, title);
    else if (fmt === "text") downloadText(message.content, title);
    else downloadServerPdf();
  };

  const showActions = !message.streaming && !message.error && message.content.length > 0;

  // ── Image-generation turn ───────────────────────────────────────────────
  if (message.isImage) {
    return (
      <div className="group">
        {message.error ? (
          <div className="rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-[15px] text-fg-secondary">
            {message.error}
          </div>
        ) : message.images && message.images.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {message.images.map((src, i) => (
              <div key={i} className="group/img relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Generated image ${i + 1}`}
                  className="max-w-full rounded-xl border border-hairline"
                  style={{ maxHeight: 512 }}
                />
                <button
                  type="button"
                  aria-label="Download image"
                  onClick={() => downloadImage(src, i)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-page/80 text-fg opacity-0 transition-opacity hover:bg-page group-hover/img:opacity-100"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="shimmer-text text-[15px] text-fg-secondary">Creating image…</div>
        )}
      </div>
    );
  }

  return (
    <div className="group">
      <SearchIndicator message={message} />
      <ThinkingIndicator message={message} />

      {message.error ? (
        <div className="rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-[15px] text-fg-secondary">
          {message.error}
        </div>
      ) : (
        <div ref={contentRef}>
          <Markdown content={message.content} streaming={message.streaming} />
        </div>
      )}

      {/* Blinking caret while an empty answer is still streaming. */}
      {message.streaming && message.content.length === 0 && !message.reasoning && (
        <span className="inline-block h-4 w-2 animate-pulse bg-fg align-middle" />
      )}

      {message.citations && message.citations.length > 0 && (
        <Citations citations={message.citations} />
      )}

      {/* Prominent download for a Documents-mode turn. */}
      {message.isDocument && showActions && (
        <div className="mt-3">
          <button
            type="button"
            onClick={downloadDocument}
            disabled={pdfBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-4 py-2 text-[14px] font-medium transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            {pdfBusy ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <path d="M12 3a9 9 0 100 18 9 9 0 000-18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="42" strokeDashoffset="10" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            Download {DOC_LABEL[message.docFormat ?? "pdf"]}
          </button>
        </div>
      )}

      {showActions && (
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ActionButton label="Copy" onClick={copy}>
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </ActionButton>
          <ExportMenu
            onPdf={exportPdf}
            onMarkdown={() => downloadMarkdown(message.content, title)}
            onText={() => downloadText(message.content, title)}
          />
          <ActionButton label="Good response" active={vote === "up"} onClick={() => setVote(vote === "up" ? null : "up")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={vote === "up" ? "currentColor" : "none"}>
              <path d="M7 10v11H4a1 1 0 01-1-1v-9a1 1 0 011-1h3zm4 0l3-7a2 2 0 012 2v3h4a2 2 0 012 2.3l-1.3 7A2 2 0 0118.7 21H11V10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </ActionButton>
          <ActionButton label="Bad response" active={vote === "down"} onClick={() => setVote(vote === "down" ? null : "down")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={vote === "down" ? "currentColor" : "none"} className="rotate-180">
              <path d="M7 10v11H4a1 1 0 01-1-1v-9a1 1 0 011-1h3zm4 0l3-7a2 2 0 012 2v3h4a2 2 0 012 2.3l-1.3 7A2 2 0 0118.7 21H11V10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </ActionButton>
        </div>
      )}
    </div>
  );
}
