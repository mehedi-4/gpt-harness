import type { Env } from "./env";
import { auth, currentUser } from "./auth";
import { conversations } from "./repo";
import { getFile, upload } from "./storage";
import { chat, image, models } from "./openai";
import { HttpError, json } from "./http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      // Browser mutations require a matching origin; JSON routes never enable CORS.
      if (!["GET", "HEAD"].includes(request.method) && request.headers.get("Origin") !== url.origin) {
        throw new HttpError(403, "Request origin is not allowed.");
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "api") throw new HttpError(404, "Not found.");
      if (parts[1] === "auth" && parts.length === 3) return await auth(request, env, parts[2]);
      const user = await currentUser(request, env);
      if (!user) throw new HttpError(401, "Please sign in to continue.");
      if (parts[1] === "conversations") return await conversations(request, env, user.id, parts.slice(2));
      if (parts[1] === "files" && parts.length === 4 && request.method === "GET") return await getFile(request, env, user.id, parts.slice(2).join("/"));
      if (parts.length === 2) {
        if (parts[1] === "upload" && request.method === "POST") return await upload(request, env, user.id);
        if (parts[1] === "chat" && request.method === "POST") return await chat(request, env, user.id);
        if (parts[1] === "image" && request.method === "POST") return await image(request, env, user.id);
        if (parts[1] === "models" && request.method === "GET") return await models(request);
      }
      throw new HttpError(404, "Not found.");
    } catch (error) {
      if (error instanceof HttpError) return json({ error: { message: error.message } }, error.status);
      if (error instanceof Error && error.name === "AbortError") return new Response(null, { status: 499 });
      // Never log request headers, payloads, passwords, or API keys.
      console.error("Worker request failed", error instanceof Error ? error.name : "UnknownError");
      return json({ error: { message: "The request failed. Please try again." } }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
