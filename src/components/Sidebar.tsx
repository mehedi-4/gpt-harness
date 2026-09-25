"use client";

import { useChatStore } from "@/lib/store";
import { useTheme } from "./ThemeProvider";

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

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const order = useChatStore((s) => s.order);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const newConversation = useChatStore((s) => s.newConversation);
  const setActive = useChatStore((s) => s.setActive);
  const remove = useChatStore((s) => s.remove);
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-surface-2/40 dark:bg-surface-1">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="px-1 text-[17px] font-semibold">ChatGPT</span>
      </div>

      <div className="px-2">
        <button
          type="button"
          onClick={() => newConversation()}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[15px] transition-colors hover:bg-surface-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New chat
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[15px] transition-colors hover:bg-surface-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Search chats
        </button>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-2">
        <div className="px-2 pb-1 text-xs font-medium text-fg-secondary">Recents</div>
        {order.map((id) => {
          const c = conversations[id];
          if (!c) return null;
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
                onClick={() => setActive(id)}
                className="flex-1 truncate px-2 py-2 text-left text-[14px]"
                title={c.title}
              >
                {c.title}
              </button>
              <button
                type="button"
                aria-label="Delete chat"
                onClick={() => remove(id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-secondary opacity-0 transition hover:bg-surface-3 group-hover:opacity-100"
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
      </div>
    </aside>
  );
}
