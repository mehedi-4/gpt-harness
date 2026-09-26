import type { ImageSize, ImageModelId } from "./types";

/**
 * Generates image(s) via the local `/api/image` proxy. Non-streaming — returns
 * a single JSON result. `samples` are image data URLs used as edit references;
 * when present the proxy uses the image-edit endpoint instead of generation.
 */
export async function generateImage(opts: {
  apiKey: string;
  prompt: string;
  size: ImageSize;
  model: ImageModelId;
  samples?: string[];
  signal: AbortSignal;
}): Promise<{ images: string[] } | { error: string }> {
  const { apiKey, prompt, size, model, samples, signal } = opts;

  let res: Response;
  try {
    res = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openai-key": apiKey,
      },
      body: JSON.stringify({ prompt, size, model, samples: samples ?? [] }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return { images: [] };
    return { error: "Network error — is the server running?" };
  }

  let data: { images?: string[]; error?: { message?: string } | string };
  try {
    data = await res.json();
  } catch {
    return { error: `Request failed (${res.status}).` };
  }

  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : data.error?.message ?? `Request failed (${res.status}).`;
    return { error: msg };
  }

  return { images: data.images ?? [] };
}
