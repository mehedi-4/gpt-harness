"use client";

import { useChatStore } from "@/lib/store";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

export function Sidebar({ onOpenSettings, onClose, onNavigate, disabled }: { onOpenSettings: () => void; onClose: () => void; onNavigate: () => void; disabled: boolean }) {
  const order = useChatStore((s) => s.order);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const newConversation = useChatStore((s) => s.newConversation);
  const setActive = useChatStore((s) => s.setActive);
  const remove = useChatStore((s) => s.remove);
  const { theme, toggleTheme } = useTheme();
  const logout = useAuth((s) => s.logout);
  const [query, setQuery] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const previous = document.activeElement as HTMLElement | null;
    if (mobile) panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !mobile) return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input");
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (mobile) previous?.focus(); };
  }, [onClose]);

  return (
    <>
    <button type="button" aria-label="Close sidebar backdrop" className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={onClose} />
    <aside id="chat-sidebar" aria-label="Chat history" ref={panelRef} className="fixed inset-y-0 left-0 z-[60] flex h-dvh w-[min(300px,85vw)] shrink-0 flex-col bg-surface-1 md:relative md:z-auto md:h-full md:w-[260px] md:bg-surface-2/40 dark:md:bg-surface-1">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="px-1 text-[17px] font-semibold">ChatGPT</span>
        <IconButton label="Collapse sidebar" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" /><path d="M9 4v16M16 9l-3 3 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </IconButton>
      </div>

      <div className="px-2">
        <button
          type="button"
          disabled={disabled || signingOut}
          onClick={() => { newConversation(); onNavigate(); }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[15px] transition-colors hover:bg-surface-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New chat
        </button>
        <input type="search" aria-label="Search chats" placeholder="Search your chats" value={query} onChange={(e) => setQuery(e.target.value)} className="mt-2 w-full rounded-lg border border-hairline bg-page px-3 py-2 text-base outline-none focus:border-fg-secondary" />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-2">
        <div className="px-2 pb-1 text-xs font-medium text-fg-secondary">Recents</div>
        {order.map((id) => {
          const c = conversations[id];
          if (!c || !c.title.toLowerCase().includes(query.toLowerCase())) return null;
          const active = id === activeId;
          return (
            <div
              key={id}
              className={`group flex items-center rounded-lg pr-1 transition-colors ${
                active ? "bg-surface-2" : "hover:bg-surface-2"
              }`}
            >
              <button
                type="button"
                disabled={disabled || signingOut}
                onClick={() => { setActive(id); onNavigate(); }}
                className="flex-1 truncate px-2 py-2 text-left text-[14px]"
                title={c.title}
              >
                {c.title}
              </button>
              <button
                type="button"
                aria-label="Delete chat"
                disabled={disabled || signingOut}
                onClick={() => remove(id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-secondary transition hover:bg-surface-3 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 border-t border-hairline px-2 py-2">
        <IconButton label="Settings" onClick={onOpenSettings}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-4l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4L4 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.4 2.4h4l.3-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.6.1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <IconButton label="Toggle theme" onClick={toggleTheme}>
          {theme === "dark" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          )}
        </IconButton>
        <button type="button" aria-label={signingOut ? "Signing out…" : "Sign out"} title="Sign out" disabled={disabled || signingOut} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-fg-secondary hover:bg-surface-2 disabled:opacity-50" onClick={async () => {
          setSigningOut(true);
          try { await logout(); }
          catch (error) { window.dispatchEvent(new CustomEvent("persistence-error", { detail: error instanceof Error ? error.message : "Could not sign out." })); setSigningOut(false); }
        }}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" className={signingOut ? "animate-pulse" : undefined}>
            <path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5M14 8l4 4-4 4M9 12h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
    </>
  );
}
