import type { Message, ModelId, Effort, Attachment, Citation } from "./types";

export interface StreamHandlers {
  onReasoningDelta: (text: string) => void;
  onAnswerDelta: (text: string) => void;
  onSearchStart: () => void;
  onSearchDone: () => void;
  onCitation: (citation: Citation) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

interface InputItem {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

/** Builds Responses-API content for a user turn: text + typed file parts. */
function buildUserContent(
  text: string,
  attachments?: Attachment[],
): string | ContentPart[] {
  if (!attachments || attachments.length === 0) return text;

  const parts: ContentPart[] = [];
  const textFiles: Attachment[] = [];

  for (const a of attachments) {
    if (a.kind === "image" && a.dataUrl) {
      parts.push({ type: "input_image", image_url: a.dataUrl });
    } else if (a.kind === "pdf" && a.dataUrl) {
      parts.push({ type: "input_file", filename: a.name, file_data: a.dataUrl });
    } else if (a.kind === "text" && a.text != null) {
      textFiles.push(a);
    }
  }

  // Inline text/code files into a single text part so any model can read them.
  let combined = text;
  for (const a of textFiles) {
    combined += `\n\n----- File: ${a.name} -----\n${a.text}`;
  }
  parts.unshift({ type: "input_text", text: combined || " " });

  return parts;
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
 * (already-sent turns); `userText`/`userAttachments` are the new user message.
 * The full transcript is sent each turn because the server is stateless.
 */
export async function streamChat(opts: {
  apiKey: string;
  model: ModelId;
  effort: Effort;
  history: Message[];
  userText: string;
  userAttachments?: Attachment[];
  webSearch?: boolean;
  signal: AbortSignal;
  handlers: StreamHandlers;
}): Promise<void> {
  const {
    apiKey,
    model,
    effort,
    history,
    userText,
    userAttachments,
    webSearch,
    signal,
    handlers,
  } = opts;

  const input: InputItem[] = [
    ...history
      .filter((m) => !m.error && (m.content.trim().length > 0 || m.attachments?.length))
      .map<InputItem>((m) =>
        m.role === "user"
          ? { role: "user", content: buildUserContent(m.content, m.attachments) }
          : { role: "assistant", content: m.content },
      ),
    { role: "user", content: buildUserContent(userText, userAttachments) },
  ];

  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openai-key": apiKey,
      },
      body: JSON.stringify({ model, effort, input, webSearch: !!webSearch }),
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
          case "response.web_search_call.in_progress":
          case "response.web_search_call.searching":
            handlers.onSearchStart();
            break;
          case "response.web_search_call.completed":
            handlers.onSearchDone();
            break;
          case "response.output_text.annotation.added": {
            const ann = payload.annotation as
              | { type?: string; url?: string; title?: string }
              | undefined;
            if (ann?.type === "url_citation" && ann.url) {
              handlers.onCitation({ url: ann.url, title: ann.title || ann.url });
            }
            break;
          }
          case "response.output_item.done": {
            // Fallback: some payloads only carry citations on the finished
            // message item's content annotations.
            const item = payload.item as
              | {
                  type?: string;
                  content?: Array<{
                    annotations?: Array<{ type?: string; url?: string; title?: string }>;
                  }>;
                }
              | undefined;
            if (item?.type === "message" && item.content) {
              for (const part of item.content) {
                for (const ann of part.annotations ?? []) {
                  if (ann.type === "url_citation" && ann.url) {
                    handlers.onCitation({ url: ann.url, title: ann.title || ann.url });
                  }
                }
              }
            }
            break;
          }
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
