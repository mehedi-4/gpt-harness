import { NextRequest } from "next/server";
import { updateConversation, deleteConversation } from "@/lib/repo";
import type { ModelId, Effort } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]">,
): Promise<Response> {
  const { id } = await ctx.params;
  let body: { title?: string; model?: ModelId; effort?: Effort };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }
  try {
    await updateConversation(id, body);
    return json(200, { ok: true });
  } catch {
    return json(500, { error: { message: "Failed to update conversation." } });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]">,
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    await deleteConversation(id);
    return json(200, { ok: true });
  } catch {
    return json(500, { error: { message: "Failed to delete conversation." } });
  }
}
