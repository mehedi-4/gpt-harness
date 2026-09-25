"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "openai-api-key";
const EVENT = "apikey-change";

function read(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) ?? "";
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
  const apiKey = useSyncExternalStore(subscribe, read, () => "");

  const setApiKey = useCallback((value: string) => {
    window.localStorage.setItem(KEY, value.trim());
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const clearApiKey = useCallback(() => {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { apiKey, setApiKey, clearApiKey };
}
