"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";

const KEY = "openai-api-key";
const EVENT = "apikey-change";

function read(userId?: string): string {
  if (typeof window === "undefined") return "";
  return userId ? window.localStorage.getItem(`${KEY}:${userId}`) ?? "" : "";
}

function subscribe(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/** API key stored in localStorage, kept in sync across components and tabs. */
export function useApiKey(): {
  apiKey: string;
  setApiKey: (value: string) => void;
  clearApiKey: () => void;
} {
  const userId = useAuth((s) => s.user?.id);
  const snapshot = useCallback(() => read(userId), [userId]);
  const apiKey = useSyncExternalStore(subscribe, snapshot, () => "");

  const setApiKey = useCallback((value: string) => {
    if (!userId) return;
    window.localStorage.setItem(`${KEY}:${userId}`, value.trim());
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);

  const clearApiKey = useCallback(() => {
    if (!userId) return;
    window.localStorage.removeItem(`${KEY}:${userId}`);
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);

  return { apiKey, setApiKey, clearApiKey };
}
