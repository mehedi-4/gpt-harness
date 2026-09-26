import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Effort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

interface ChatRequestBody {
  model: string;
  effort: Effort;
  input: Array<{ role: "user" | "assistant" | "system"; content: unknown }>;
  webSearch?: boolean;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const key = req.headers.get("x-openai-key");
  if (!key) {
    return json(401, { error: { message: "Missing API key — add one in Settings." } });
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return json(400, { error: { message: "Malformed request body." } });
  }

  let upstream: Response;
  try {
    // With effort "none" the model does no reasoning, so a summary is
    // meaningless (and rejected by some models) — omit it in that case.
    const reasoning =
      body.effort === "none"
        ? { effort: "none" as const }
        : { effort: body.effort, summary: "auto" as const };

    // Built-in hosted web search tool. `include` returns the full source list
    // on the web_search_call item so we can surface citations. "high" context
    // pulls more of each page into the model for better-grounded answers.
    const tools = body.webSearch
      ? [{ type: "web_search", search_context_size: "high" }]
      : undefined;

    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model,
        input: body.input,
        stream: true,
        reasoning,
        ...(tools
          ? {
              tools,
              tool_choice: "auto",
              include: ["web_search_call.action.sources"],
            }
          : {}),
        // effort !== "none" → temperature/top_p are unsupported, so we omit them.
      }),
      signal: req.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return json(502, { error: { message: "Could not reach OpenAI." } });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(text || JSON.stringify({ error: { message: "Upstream error." } }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Direct SSE passthrough; the browser pulls at its own rate (natural backpressure).
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
