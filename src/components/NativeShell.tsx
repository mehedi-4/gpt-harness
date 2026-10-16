"use client";

import { useEffect } from "react";
import { postNative } from "@/lib/nativeBridge";

/** Keep Android system bars in step with the user's chosen web theme. */
export function NativeShell() {
  useEffect(() => {
    if (!window.GptHarnessAndroid) return;
    const root = document.documentElement;
    root.dataset.native = "android";
    const syncTheme = () => postNative({ type: "theme", dark: root.classList.contains("dark") });
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => { observer.disconnect(); delete root.dataset.native; };
  }, []);
  return null;
}
