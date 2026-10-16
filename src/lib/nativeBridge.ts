interface AndroidBridge { postMessage(message: string): void }

declare global {
  interface Window { GptHarnessAndroid?: AndroidBridge }
}

/** Android exposes this object only to our exact HTTPS origin, in the main frame. */
export function postNative(message: Record<string, unknown>): boolean {
  if (typeof window === "undefined" || !window.GptHarnessAndroid) return false;
  window.GptHarnessAndroid.postMessage(JSON.stringify(message));
  return true;
}

export async function copyText(text: string): Promise<void> {
  if (!postNative({ type: "copy", text })) await navigator.clipboard.writeText(text);
}
