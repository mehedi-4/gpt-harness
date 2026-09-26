import { NextRequest } from "next/server";
import { uploadDataUrl } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Uploads a single attachment (base64 data URL) to Cloudinary and returns its
 * hosted URL. The client calls this before persisting a user message so the DB
 * stores only the URL, not the binary.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: { dataUrl?: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }
  if (!body.dataUrl) {
    return json(400, { error: { message: "Missing dataUrl." } });
  }
  try {
    const { url } = await uploadDataUrl(body.dataUrl, { filename: body.filename });
    return json(200, { url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed.";
    return json(500, { error: { message } });
  }
}
