import { NextRequest } from "next/server";
import { truncateAfter } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]/truncate">,
): Promise<Response> {
  const { id } = await ctx.params;
  let body: { messageId: string; inclusive: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }
  try {
    await truncateAfter(id, body.messageId, body.inclusive);
    return json(200, { ok: true });
  } catch {
    return json(500, { error: { message: "Failed to truncate conversation." } });
  }
}
