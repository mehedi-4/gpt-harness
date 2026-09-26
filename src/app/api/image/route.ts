import { NextRequest } from "next/server";
import { DEFAULT_IMAGE_MODEL } from "@/lib/models";
import { uploadDataUrl } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImageRequestBody {
  prompt: string;
  size: string;
  model?: string;
  /** Reference/sample image data URLs (for the edit endpoint). */
  samples?: string[];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Decode a `data:<mime>;base64,<data>` URL into a Blob + filename. */
function dataUrlToBlob(dataUrl: string, index: number): { blob: Blob; filename: string } | null {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : mime.includes("jpeg") || mime.includes("jpg")
        ? "jpg"
        : "png";
  return {
    blob: new Blob([bytes], { type: mime }),
    filename: `sample-${index}.${ext}`,
  };
}

async function parseError(upstream: Response): Promise<string> {
  const raw = await upstream.text();
  try {
    const obj = JSON.parse(raw);
    const msg = obj?.error?.message ?? obj?.message;
    if (msg) return msg;
  } catch {
    /* fall through */
  }
  if (upstream.status === 401) return "Invalid API key — check Settings.";
  return `Image request failed (${upstream.status}).`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const key = req.headers.get("x-openai-key");
  if (!key) {
    return json(401, { error: { message: "Missing API key — add one in Settings." } });
  }

  let body: ImageRequestBody;
  try {
    body = (await req.json()) as ImageRequestBody;
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return json(400, { error: { message: "A prompt is required." } });
  }
  const size = body.size || "1024x1024";
  const model = body.model || DEFAULT_IMAGE_MODEL;
  const samples = body.samples ?? [];

  let upstream: Response;
  try {
    if (samples.length > 0) {
      // Edit endpoint: multipart with one image[] entry per reference image.
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", prompt);
      form.append("size", size);
      form.append("quality", "high");
      for (let i = 0; i < samples.length; i++) {
        const decoded = dataUrlToBlob(samples[i], i);
        if (decoded) form.append("image[]", decoded.blob, decoded.filename);
      }
      upstream = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: req.signal,
      });
    } else {
      upstream = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          quality: "high",
          n: 1,
        }),
        signal: req.signal,
      });
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return json(502, { error: { message: "Could not reach OpenAI." } });
  }

  if (!upstream.ok) {
    return json(upstream.status, { error: { message: await parseError(upstream) } });
  }

  let payload: { data?: Array<{ b64_json?: string; url?: string }> };
  try {
    payload = await upstream.json();
  } catch {
    return json(502, { error: { message: "Malformed response from OpenAI." } });
  }

  const images = (payload.data ?? [])
    .map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url))
    .filter((x): x is string => !!x);

  // Persist binaries to Cloudinary so the DB stores hosted URLs, not base64.
  // If Cloudinary isn't configured or upload fails, fall back to the original
  // source (data URL or OpenAI URL) so image generation still works.
  const hosted = await Promise.all(
    images.map(async (src) => {
      try {
        const { url } = await uploadDataUrl(src, { folder: "chat/generated" });
        return url;
      } catch {
        return src;
      }
    }),
  );

  return json(200, { images: hosted });
}
