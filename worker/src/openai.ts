import { EFFORT_STOPS, IMAGE_SIZES } from "../../src/lib/models";
import { MAX_IMAGE_REFERENCES } from "../../src/lib/imageContext";
import { isChatModel, newestChatModels, type AvailableModel } from "../../src/lib/modelDiscovery";
import type { Env } from "./env";
import { HttpError, json, readJson, requiredString } from "./http";
import { decodeDataUrl, resolveFile, storeFile } from "./storage";

function apiKey(request: Request): string {
  const key = request.headers.get("x-openai-key");
  if (!key || key.length > 1024) throw new HttpError(400, "Add your OpenAI API key in Settings.");
  return key;
}

async function upstream(path: string, key: string, signal: AbortSignal, body?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${key}`, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new HttpError(502, "Could not reach OpenAI.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    // App authentication and an invalid provider key are distinct failures.
    throw new HttpError(response.status === 401 ? 400 : response.status, error?.error?.message ?? `OpenAI request failed (${response.status}).`);
  }
  return response;
}

export async function models(request: Request): Promise<Response> {
  const response = await upstream("models", apiKey(request), request.signal);
  const payload = await response.json() as { data: AvailableModel[] };
  const available = payload.data.filter((m) => typeof m.id === "string");
  const images = available.filter((m) => /^gpt-image-\d/.test(m.id));
  const latestImageGeneration = Math.max(0, ...images.map((m) => Number(/^gpt-image-(\d+(?:\.\d+)?)/.exec(m.id)?.[1] ?? 0)));
  return json({
    models: newestChatModels(available),
    imageModels: images.filter((m) => Number(/^gpt-image-(\d+(?:\.\d+)?)/.exec(m.id)?.[1]) === latestImageGeneration)
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id)),
  });
}

interface InputPart { type: string; image_url?: string; file_url?: string; file_data?: string; filename?: string; text?: string }
interface InputItem { role: string; content: string | InputPart[] }

export async function chat(request: Request, env: Env, userId: string): Promise<Response> {
  const key = apiKey(request);
  const body = await readJson<{ model: string; effort: string; input: InputItem[]; webSearch?: boolean }>(request, 32 * 1024 * 1024);
  if (!isChatModel(body.model)) throw new HttpError(400, "Choose a GPT-6 or newer model.");
  if (!EFFORT_STOPS.some((e) => e.value === body.effort)) throw new HttpError(400, "Invalid reasoning effort.");
  if (!Array.isArray(body.input) || !body.input.length || body.input.length > 500) throw new HttpError(400, "Invalid chat input.");
  let binarySize = 0;
  const input: InputItem[] = [];
  for (const item of body.input) {
    if (!item || !["user", "assistant", "system"].includes(item.role)) throw new HttpError(400, "Invalid message role.");
    if (typeof item.content === "string") { input.push({ role: item.role, content: item.content }); continue; }
    if (!Array.isArray(item.content) || item.content.length > 30) throw new HttpError(400, "Invalid message content.");
    const content: InputPart[] = [];
    for (const part of item.content) {
      if (!part || typeof part !== "object") throw new HttpError(400, "Invalid content part.");
      if (part.type === "input_text" && typeof part.text === "string") { content.push({ type: part.type, text: part.text }); continue; }
      const ref = part.type === "input_image" ? part.image_url : part.type === "input_file" ? part.file_url ?? part.file_data : undefined;
      if (typeof ref !== "string") throw new HttpError(400, "Invalid attachment.");
      const source = ref.startsWith("/api/files/") ? await resolveFile(env, userId, ref) : ref;
      const { bytes, mime } = decodeDataUrl(source);
      binarySize += bytes.length;
      if (binarySize > 40 * 1024 * 1024) throw new HttpError(413, "This chat has too many attachments. Start a new chat.");
      if (part.type === "input_file" && mime === "text/plain") {
        content.push({ type: "input_text", text: `File: ${part.filename ?? "text file"}\n${new TextDecoder().decode(bytes)}` });
        continue;
      }
      if (part.type === "input_image" && !mime.startsWith("image/")) throw new HttpError(400, "Expected an image attachment.");
      content.push(part.type === "input_image" ? { type: "input_image", image_url: source } : { type: "input_file", filename: part.filename ?? "file.pdf", file_data: source });
    }
    input.push({ role: item.role, content });
  }
  const response = await upstream("responses", key, request.signal, {
    model: body.model,
    input,
    stream: true,
    store: false,
    reasoning: body.effort === "none" ? { effort: "none" } : { effort: body.effort, summary: "auto" },
    ...(body.webSearch ? { tools: [{ type: "web_search", search_context_size: "high" }], tool_choice: "auto", include: ["web_search_call.action.sources"] } : {}),
  });
  return new Response(response.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
}

export async function image(request: Request, env: Env, userId: string): Promise<Response> {
  const key = apiKey(request);
  const body = await readJson<{ prompt: string; model: string; size: string; samples?: string[] }>(request, 32 * 1024 * 1024);
  const prompt = requiredString(body.prompt, "prompt", 32_000);
  if (typeof body.model !== "string" || !/^gpt-image-\d[\w.-]*$/.test(body.model)) throw new HttpError(400, "Choose an image model.");
  if (!IMAGE_SIZES.some((s) => s.value === body.size)) throw new HttpError(400, "Invalid image size.");
  const samples = body.samples ?? [];
  if (!Array.isArray(samples) || samples.length > MAX_IMAGE_REFERENCES || samples.some((s) => typeof s !== "string")) throw new HttpError(400, "Use up to sixteen reference images.");
  let response: Response;
  if (samples.length) {
    const form = new FormData();
    form.set("model", body.model);
    form.set("prompt", prompt);
    form.set("size", body.size);
    form.set("quality", "high");
    for (let i = 0; i < samples.length; i++) {
      const source = samples[i].startsWith("/api/files/") ? await resolveFile(env, userId, samples[i]) : samples[i];
      const { bytes, mime } = decodeDataUrl(source);
      if (!mime.startsWith("image/")) throw new HttpError(400, "References must be images.");
      form.append("image[]", new Blob([bytes], { type: mime }), `sample-${i}.${mime.split("/")[1]}`);
    }
    response = await upstream("images/edits", key, request.signal, form);
  } else {
    response = await upstream("images/generations", key, request.signal, { model: body.model, prompt, size: body.size, quality: "high", n: 1 });
  }
  const payload = await response.json() as { data?: { b64_json?: string }[] };
  if (!payload.data?.length || payload.data.some((d) => !d.b64_json)) throw new HttpError(502, "OpenAI did not return image data.");
  const images: string[] = [];
  for (const item of payload.data) images.push(await storeFile(env, userId, `data:image/png;base64,${item.b64_json}`, "generated.png"));
  return json({ images });
}
