"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, status, error, check, expire, authenticate } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void check();
    const refresh = () => void check();
    const onStorage = (event: StorageEvent) => { if (event.key === "auth-change") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-required", expire);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-required", expire);
    };
  }, [check, expire]);

  if (user && status === "ready") return <div key={user.id}>{children}</div>;
  if (status === "loading") return <div className="flex h-dvh items-center justify-center text-fg-secondary" role="status">Loading your account…</div>;
  if (status === "error") return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 p-6">
      <p role="alert">{error}</p>
      <button className="rounded-capsule border border-hairline px-5 py-2" onClick={() => void check()}>Try again</button>
    </main>
  );

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-lg font-semibold">ChatGPT</p>
        <h1 className="text-center text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <form className="mt-8 space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const form = new FormData(event.currentTarget);
          setBusy(true); setFormError("");
          try { await authenticate(mode, String(form.get("email")), String(form.get("password"))); }
          catch (error) { setFormError(error instanceof Error ? error.message : "Could not sign in. Please try again."); }
          finally { setBusy(false); }
        }}>
          <label className="block text-sm font-medium">Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-2 w-full rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-base outline-none focus:border-fg-secondary" />
          </label>
          <label className="block text-sm font-medium">Password
            <input key={mode} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 12 : 1} maxLength={256} aria-describedby={mode === "register" ? "password-help" : undefined} className="mt-2 w-full rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-base outline-none focus:border-fg-secondary" />
          </label>
          {mode === "register" && <p id="password-help" className="text-xs text-fg-secondary">Use at least 12 characters.</p>}
          {(formError || error) && <p role="alert" className="text-sm text-red-500">{formError || error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-capsule bg-fg px-5 py-3 font-medium text-fg-inverse disabled:opacity-50">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button type="button" disabled={busy} className="mt-6 w-full text-center text-sm text-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setFormError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
