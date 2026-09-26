import { NextRequest } from "next/server";
import { listConversations, createConversation } from "@/lib/repo";
import type { ConversationMeta } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(): Promise<Response> {
  try {
    const conversations = await listConversations();
    return json(200, { conversations });
  } catch {
    return json(500, { error: { message: "Failed to load conversations." } });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: ConversationMeta;
  try {
    body = (await req.json()) as ConversationMeta;
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }
  try {
    await createConversation(body);
    return json(201, { ok: true });
  } catch {
    return json(500, { error: { message: "Failed to create conversation." } });
  }
}
