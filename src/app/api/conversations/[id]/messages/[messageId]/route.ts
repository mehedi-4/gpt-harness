import { NextRequest } from "next/server";
import { updateMessage } from "@/lib/repo";
import type { Message } from "@/lib/types";

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
  ctx: RouteContext<"/api/conversations/[id]/messages/[messageId]">,
): Promise<Response> {
  const { id } = await ctx.params;
  let body: Message;
  try {
    body = (await req.json()) as Message;
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }
  try {
    await updateMessage(id, body);
    return json(200, { ok: true });
  } catch {
    return json(500, { error: { message: "Failed to update message." } });
  }
}
