import type { Env } from "./env";
import { HttpError, json, readJson, requiredString } from "./http";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"]);

export function decodeDataUrl(source: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(source);
  if (!match || !ALLOWED_MIME.has(match[1])) throw new HttpError(400, "Use an image, PDF, or text file.");
  let raw: string;
  try { raw = atob(match[2]); } catch { throw new HttpError(400, "Invalid file data."); }
  if (raw.length > MAX_FILE_BYTES) throw new HttpError(413, "Files must be 20 MB or smaller.");
  return { bytes: Uint8Array.from(raw, (c) => c.charCodeAt(0)), mime: match[1] };
}

export function dataUrl(bytes: ArrayBuffer, mime: string): string {
  const data = new Uint8Array(bytes);
  let raw = "";
  for (let i = 0; i < data.length; i += 8192) raw += String.fromCharCode(...data.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(raw)}`;
}

export async function storeFile(env: Env, userId: string, source: string, filename = "file"): Promise<string> {
  const { bytes, mime } = decodeDataUrl(source);
  const key = `${userId}/${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime }, customMetadata: { filename: filename.slice(0, 200) } });
  return `/api/files/${key}`;
}

export async function upload(request: Request, env: Env, userId: string): Promise<Response> {
  const body = await readJson<{ dataUrl: string; filename?: string }>(request, Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4096);
  requiredString(body.dataUrl, "file data", Math.ceil(MAX_FILE_BYTES * 4 / 3) + 100);
  if (body.filename !== undefined) requiredString(body.filename, "filename", 200);
  return json({ url: await storeFile(env, userId, body.dataUrl, body.filename) });
}

export async function getFile(request: Request, env: Env, userId: string, key: string): Promise<Response> {
  if (!key.startsWith(`${userId}/`) || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key)) throw new HttpError(404, "File not found.");
  const object = await env.FILES.get(key);
  if (!object) throw new HttpError(404, "File not found.");
  const filename = (object.customMetadata?.filename ?? "file").replace(/[^a-zA-Z0-9._ -]/g, "_");
  const mime = object.httpMetadata?.contentType ?? "application/octet-stream";
  const download = new URL(request.url).searchParams.has("download") || !mime.startsWith("image/");
  return new Response(object.body, { headers: {
    "Content-Type": mime,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "ETag": object.httpEtag,
  } });
}

// OpenAI cannot read authenticated R2 URLs. Resolve only this user's private
// objects inside the Worker and pass bytes upstream for image/PDF inputs.
export async function resolveFile(env: Env, userId: string, ref: string): Promise<string> {
  const prefix = `/api/files/${userId}/`;
  if (!ref.startsWith(prefix) || !/^[a-zA-Z0-9_-]+$/.test(ref.slice(prefix.length))) throw new HttpError(400, "Invalid file reference.");
  const object = await env.FILES.get(ref.slice("/api/files/".length));
  if (!object) throw new HttpError(404, "Attached file not found.");
  return dataUrl(await object.arrayBuffer(), object.httpMetadata?.contentType ?? "application/octet-stream");
}
