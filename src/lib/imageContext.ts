import type { Attachment, ImageRequest, Message } from "./types";

// The Images edit API supports at most sixteen references. Prefer explicit
// attachments, then the most recent images, and label them in the transcript.
export const MAX_IMAGE_REFERENCES = 16;

function attachedImages(attachments?: Attachment[]): string[] {
  return attachments?.flatMap((a) => a.kind === "image" && (a.url || a.dataUrl) ? [a.url || a.dataUrl!] : []) ?? [];
}

export function buildImageContext(prompt: string, attachments: Attachment[], history: Message[]) {
  const prior = history.filter((message) => !message.error);
  const references = prior.flatMap((message) => [...attachedImages(message.attachments), ...(message.images ?? [])]);
  const samples = [...new Set([...attachedImages(attachments), ...references.reverse()])].slice(0, MAX_IMAGE_REFERENCES);
  if (!prior.length) return { prompt, samples };

  const transcript = prior.map((message) => {
    const labels = [...attachedImages(message.attachments), ...(message.images ?? [])]
      .map((url) => samples.indexOf(url))
      .filter((index) => index >= 0)
      .map((index) => `[Reference image ${index + 1}]`);
    return `${message.role === "user" ? "User" : "Assistant"}: ${message.content} ${labels.join(" ")}`.trim();
  }).join("\n\n");
  const instruction = "Continue this image conversation. Use the supplied reference images and earlier requests as context. Apply the current request while keeping relevant visual details consistent.\n\nEarlier conversation:\n";
  const current = `\n\nCurrent request:\n${prompt}`;
  const budget = Math.max(0, 32_000 - instruction.length - current.length);
  return { prompt: budget ? instruction + transcript.slice(-budget) + current : prompt, samples };
}

/** Legacy chats identify image prompts by the assistant directly after them. */
export function imageRequestForEdit(messages: Message[], index: number, fallback: ImageRequest): ImageRequest | undefined {
  const prompt = messages[index];
  if (prompt?.imageRequest) return prompt.imageRequest;
  const reply = messages[index + 1];
  return reply?.role === "assistant" && reply.isImage ? reply.imageRequest ?? fallback : undefined;
}
