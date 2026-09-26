import { NextRequest } from "next/server";
import { renderPdf } from "@/lib/renderPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDF rendering (headless Chrome) can take a few seconds for large documents.
export const maxDuration = 60;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function slugify(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "document";
}

/**
 * Renders posted Markdown to a downloadable PDF. Used by Documents mode for the
 * one-click "Download PDF" action; MD/TXT are produced client-side.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: { markdown?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }
  const markdown = (body.markdown ?? "").trim();
  if (!markdown) {
    return json(400, { error: { message: "Missing markdown." } });
  }
  const title = (body.title ?? "document").trim() || "document";

  try {
    const pdf = await renderPdf(markdown, title);
    return new Response(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slugify(title)}.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF rendering failed.";
    return json(500, { error: { message } });
  }
}
