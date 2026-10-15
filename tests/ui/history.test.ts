import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@/lib/store";
import * as api from "@/lib/chatApi";
import { orderMessages } from "@/lib/messageOrder";
import { buildImageContext, imageRequestForEdit } from "@/lib/imageContext";
import type { Message } from "@/lib/types";

vi.mock("@/lib/chatApi", () => ({
  createConversation: vi.fn(async () => {}), appendMessage: vi.fn(async () => {}),
  patchConversation: vi.fn(async () => {}), updateMessage: vi.fn(async () => {}), truncateAfter: vi.fn(async () => {}),
}));

beforeEach(() => { useChatStore.getState().reset(); vi.clearAllMocks(); });

describe("conversation edits", () => {
  it("starts new chats with GPT-6.1 Sol and Medium effort", () => {
    useChatStore.getState().newConversation();
    expect(useChatStore.getState().activeConversation()).toMatchObject({ model: "gpt-6.1-sol", effort: "medium" });
  });

  it("regenerates only the edited reply in a five-prompt chat, preserving IDs and later messages", () => {
    const store = useChatStore;
    const prompts: string[] = [];
    for (let i = 0; i < 5; i++) {
      const prompt = store.getState().addUserMessage(`Prompt ${i + 1}`);
      prompts.push(prompt.id);
      const reply = store.getState().beginAssistant({ replyToId: prompt.id });
      store.getState().appendAnswer(reply.id, `Reply ${i + 1}`);
      store.getState().finalizeAssistant(reply.id, 1);
    }
    const before = store.getState().activeConversation()!.messages;
    store.getState().editUserMessage(prompts[1], "Edited prompt 2");
    const reply = store.getState().beginAssistant({ replyToId: prompts[1] });
    expect(reply.id).toBe(before[3].id);
    store.getState().appendAnswer(reply.id, "New reply 2");
    store.getState().finalizeAssistant(reply.id, 2);
    const after = store.getState().activeConversation()!.messages;
    expect(after).toHaveLength(10);
    expect(after.map((message) => message.id)).toEqual(before.map((message) => message.id));
    expect(after[2].content).toBe("Edited prompt 2");
    expect(after[3].content).toBe("New reply 2");
    for (let i = 4; i < 10; i++) expect(after[i]).toBe(before[i]);
    expect(api.truncateAfter).not.toHaveBeenCalled();
    expect(api.updateMessage).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ id: before[3].id, content: "New reply 2", replyToId: prompts[1], streaming: false }));
  });

  it("repairs a missing earlier reply in the same position on reload", () => {
    const messages: Message[] = [
      { id: "u1", role: "user", content: "First", createdAt: 1 },
      { id: "u2", role: "user", content: "Later", createdAt: 2 },
      { id: "a2", role: "assistant", content: "Later reply", createdAt: 3 },
      { id: "a1", role: "assistant", content: "Recovered reply", replyToId: "u1", createdAt: 4 },
    ];
    expect(orderMessages(messages).map((message) => message.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });
});

describe("image conversation context", () => {
  const settings = { model: "gpt-image-2.5-flare", size: "1024x1536" as const };
  const history: Message[] = [
    { id: "u1", role: "user", content: "A red house", imageRequest: settings, createdAt: 1 },
    { id: "a1", role: "assistant", content: "", isImage: true, images: ["/api/files/owner/house.png"], createdAt: 2 },
    { id: "u2", role: "user", content: "Make the roof blue", createdAt: 3 },
    { id: "a2", role: "assistant", content: "", isImage: true, images: ["/api/files/owner/blue-roof.png"], createdAt: 4 },
  ];

  it("sends previous generated images and their instructions as references", () => {
    const context = buildImageContext("Add a garden", [], history);
    expect(context.samples).toEqual(["/api/files/owner/blue-roof.png", "/api/files/owner/house.png"]);
    expect(context.prompt).toContain("A red house");
    expect(context.prompt).toContain("Make the roof blue");
    expect(context.prompt).toContain("[Reference image 1]");
    expect(context.prompt).toMatch(/Current request:\nAdd a garden$/);
  });

  it("retains saved image settings and recognizes legacy image prompts independently of the current mode", () => {
    expect(imageRequestForEdit(history, 0, { ...settings, size: "1024x1024" })).toEqual(settings);
    expect(imageRequestForEdit(history, 2, settings)).toEqual(settings);
    expect(imageRequestForEdit([{ ...history[0], imageRequest: undefined }], 0, settings)).toBeUndefined();
    const original = buildImageContext("A green house", [], history.slice(0, 0));
    expect(original).toEqual({ prompt: "A green house", samples: [] });
  });

  it("prefers explicit references, deduplicates, and stays within image and prompt limits", () => {
    const many: Message[] = Array.from({ length: 20 }, (_, i) => ({ id: String(i), role: "assistant", content: "context ".repeat(1000), images: [`image-${i}`], createdAt: i }));
    const context = buildImageContext("Keep the subject", [{ id: "ref", kind: "image", name: "ref.png", mime: "image/png", size: 1, url: "image-19" }], many);
    expect(context.samples).toHaveLength(16);
    expect(context.samples.slice(0, 2)).toEqual(["image-19", "image-18"]);
    expect(context.prompt.length).toBeLessThanOrEqual(32_000);
    expect(context.prompt.endsWith("Keep the subject")).toBe(true);
  });
});
