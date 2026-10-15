import { create } from "zustand";
import { useChatStore } from "./store";
import { resetQueue, flushWrites } from "./chatApi";

export interface User { id: string; email: string }

interface AuthState {
  user: User | null;
  status: "loading" | "ready" | "error";
  error: string;
  check: () => Promise<void>;
  authenticate: (mode: "login" | "register", email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
}

function clearHistory() {
  resetQueue();
  useChatStore.getState().reset();
}

let authGeneration = 0;

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: "loading",
  error: "",
  check: async () => {
    const generation = authGeneration;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Could not connect. Please try again.");
      const { user } = await response.json() as { user: User | null };
      if (generation !== authGeneration) return;
      if (user?.id !== get().user?.id) clearHistory();
      set({ user, status: "ready", error: "" });
    } catch {
      if (generation === authGeneration && !get().user) set({ status: "error", error: "Could not connect. Please try again." });
    }
  },
  authenticate: async (mode, email, password) => {
    authGeneration++;
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "same-origin", body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? "Could not sign in.");
    authGeneration++;
    clearHistory();
    set({ user: data.user, status: "ready", error: "" });
  },
  logout: async () => {
    authGeneration++;
    await flushWrites();
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    authGeneration++;
    clearHistory();
    set({ user: null, status: "ready", error: "" });
    localStorage.setItem("auth-change", String(Date.now()));
  },
  expire: () => {
    authGeneration++;
    clearHistory();
    set({ user: null, status: "ready", error: "Your session expired. Please sign in again." });
  },
}));
