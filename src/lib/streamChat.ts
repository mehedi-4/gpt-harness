import type { Message, ModelId, Effort } from "./types";

export interface StreamHandlers {
  onReasoningDelta: (text: string) => void;
  onAnswerDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

interface InputItem {
  role: "user" | "assistant";
  content: string;
}

function parseOpenAiError(raw: string, status: number): string {
  try {
    const obj = JSON.parse(raw);
    const msg = obj?.error?.message ?? obj?.message;
    if (msg) return msg;
  } catch {
    /* fall through */
  }
  if (status === 401) return "Invalid API key — check Settings.";
  return `Request failed (${status}).`;
}

/**
 * Streams a completion from the local proxy. `history` is the prior conversation
 * (already-sent turns); `userText` is the new user message. The full transcript is
 * sent each turn because the server is stateless.
 */
export async function streamChat(opts: {
  apiKey: string;
  model: ModelId;
  effort: Effort;
  history: Message[];
  userText: string;
  signal: AbortSignal;
  handlers: StreamHandlers;
}): Promise<void> {
  const { apiKey, model, effort, history, userText, signal, handlers } = opts;

  const input: InputItem[] = [
    ...history
      .filter((m) => !m.error && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userText },
  ];

  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openai-key": apiKey,
      },
      body: JSON.stringify({ model, effort, input }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("Network error — is the server running?");
    return;
  }

  if (!res.ok || !res.body) {
    const raw = res.body ? await res.text() : "";
    handlers.onError(parseOpenAiError(raw, res.status));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        let eventType = "";
        let dataStr = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
        }
        if (!dataStr || dataStr === "[DONE]") continue;

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(dataStr);
        } catch {
          continue;
        }

        const type = (payload.type as string) || eventType;
        switch (type) {
          case "response.reasoning_summary_text.delta":
            handlers.onReasoningDelta((payload.delta as string) ?? "");
            break;
          case "response.output_text.delta":
            handlers.onAnswerDelta((payload.delta as string) ?? "");
            break;
          case "response.completed":
            handlers.onDone();
            return;
          case "error":
          case "response.failed": {
            const errObj = (payload.error ?? payload.response) as
              | { error?: { message?: string } }
              | { message?: string }
              | undefined;
            const message =
              (errObj as { message?: string })?.message ??
              (errObj as { error?: { message?: string } })?.error?.message ??
              "The model stopped unexpectedly.";
            handlers.onError(message);
            return;
          }
          default:
            break;
        }
      }
    }
    handlers.onDone();
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("Connection interrupted.");
  }
}
