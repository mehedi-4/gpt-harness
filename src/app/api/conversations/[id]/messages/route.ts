import { NextRequest } from "next/server";
import { getMessages, appendMessage } from "@/lib/repo";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]/messages">,
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const messages = await getMessages(id);
    return json(200, { messages });
  } catch {
    return json(500, { error: { message: "Failed to load messages." } });
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]/messages">,
): Promise<Response> {
  const { id } = await ctx.params;
  let body: Message;
  try {
    body = (await req.json()) as Message;
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }
  try {
    await appendMessage(id, body);
    return json(201, { ok: true });
  } catch {
    return json(500, { error: { message: "Failed to save message." } });
  }
}
