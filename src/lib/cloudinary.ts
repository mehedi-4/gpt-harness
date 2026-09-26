import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary integration. Server-only. Binaries (uploaded images/PDFs, generated
 * images) are stored here so the database only holds hosted URLs — never base64.
 *
 * Configured from CLOUDINARY_URL (cloudinary://<key>:<secret>@<cloud_name>), or
 * the individual CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET vars. Credentials
 * are server-side env only and never reach the client.
 */

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  // The SDK auto-reads CLOUDINARY_URL from the environment; set explicit config
  // only when the discrete vars are provided instead.
  if (!process.env.CLOUDINARY_URL) {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud_name || !api_key || !api_secret) {
      throw new Error(
        "Cloudinary is not configured (set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/_API_KEY/_API_SECRET).",
      );
    }
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  } else {
    cloudinary.config({ secure: true });
  }
  configured = true;
}

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads a data URL (or any remote/base64 source Cloudinary accepts) and returns
 * the hosted secure URL. `resource_type: "auto"` handles both images and PDFs.
 */
export async function uploadDataUrl(
  dataUrl: string,
  opts?: { folder?: string; filename?: string },
): Promise<UploadResult> {
  ensureConfigured();
  const res = await cloudinary.uploader.upload(dataUrl, {
    resource_type: "auto",
    folder: opts?.folder ?? "chat",
    ...(opts?.filename
      ? { public_id: opts.filename.replace(/\.[^.]+$/, ""), use_filename: true }
      : {}),
  });
  return { url: res.secure_url, publicId: res.public_id };
}
