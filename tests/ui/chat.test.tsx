import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import Home from "@/app/page";
import { useChatStore } from "@/lib/store";
import { generateImage } from "@/lib/generateImage";
import { streamChat } from "@/lib/streamChat";
import { chatModelCatalog } from "@/lib/models";
import { Presence } from "@/components/Presence";
import type { Message } from "@/lib/types";

vi.mock("@/components/AuthGate", () => ({ AuthGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/hooks/useApiKey", () => ({ useApiKey: () => ({ apiKey: "demo" }) }));
vi.mock("@/hooks/useModelCatalog", () => ({ useModelCatalog: () => ({ models: chatModelCatalog(), imageModels: [{ id: "gpt-image-2.5-flare", name: "Image" }], loading: false, error: "", refresh: vi.fn() }) }));
vi.mock("@/lib/chatApi", () => ({ createConversation: vi.fn(async () => {}), appendMessage: vi.fn(async () => {}), patchConversation: vi.fn(async () => {}), updateMessage: vi.fn(async () => {}) }));
vi.mock("@/lib/generateImage", () => ({ generateImage: vi.fn(async () => ({ images: ["/api/files/owner/new.png"] })) }));
vi.mock("@/lib/streamChat", () => ({ streamChat: vi.fn(async () => {}) }));

const settings = { model: "gpt-image-2.5-flare", size: "1024x1536" as const };
const imageHistory: Message[] = [
  { id: "u1", role: "user", content: "A red house", imageRequest: settings, createdAt: 1 },
  { id: "a1", role: "assistant", content: "", isImage: true, images: ["/api/files/owner/red.png"], imageRequest: settings, createdAt: 2 },
  { id: "u2", role: "user", content: "A blue roof", imageRequest: settings, createdAt: 3 },
  { id: "a2", role: "assistant", content: "", isImage: true, images: ["/api/files/owner/blue.png"], imageRequest: settings, createdAt: 4 },
];

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.getState().reset();
  const id = useChatStore.getState().newConversation();
  useChatStore.setState((state) => ({ ready: true, conversations: { ...state.conversations, [id]: { ...state.conversations[id], messages: imageHistory } } }));
});

describe("image generation workflow", () => {
  it("restores image mode and includes earlier images when sending a follow-up", async () => {
    render(<Home />);
    const input = screen.getByRole("textbox", { name: "Describe an image" });
    fireEvent.change(input, { target: { value: "Add a garden" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(generateImage).toHaveBeenCalledOnce());
    expect(vi.mocked(generateImage).mock.calls[0][0]).toMatchObject({ samples: ["/api/files/owner/blue.png", "/api/files/owner/red.png"] });
    expect(vi.mocked(generateImage).mock.calls[0][0].prompt).toContain("A blue roof");
    expect(streamChat).not.toHaveBeenCalled();
    await waitFor(() => expect(useChatStore.getState().activeConversation()!.messages.at(-1)?.streaming).toBe(false));
  });

  it("edits an image prompt through the image model even after switching to text mode, keeping later images", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Images" }));
    expect(screen.getByRole("textbox", { name: "Ask ChatGPT" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit message" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Edit prompt" }), { target: { value: "A green house" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & send" }));
    await waitFor(() => expect(generateImage).toHaveBeenCalledOnce());
    expect(vi.mocked(generateImage).mock.calls[0][0]).toMatchObject({ ...settings, prompt: "A green house", samples: [] });
    expect(streamChat).not.toHaveBeenCalled();
    await waitFor(() => expect(useChatStore.getState().activeConversation()!.messages[1].streaming).toBe(false));
    const messages = useChatStore.getState().activeConversation()!.messages;
    expect(messages.map((message) => message.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(messages[1]).toMatchObject({ isImage: true, images: ["/api/files/owner/new.png"] });
    expect(messages[2]).toEqual(imageHistory[2]);
    expect(messages[3]).toEqual(imageHistory[3]);
  });

  it("stops an image edit in place and leaves later turns untouched", async () => {
    vi.mocked(generateImage).mockImplementationOnce(({ signal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve({ images: [] }), { once: true });
    }));
    render(<Home />);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit message" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Edit prompt" }), { target: { value: "A green house" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & send" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(useChatStore.getState().activeConversation()!.messages[1]).toMatchObject({ streaming: false, error: "Image generation stopped." }));
    const messages = useChatStore.getState().activeConversation()!.messages;
    expect(messages[2]).toEqual(imageHistory[2]);
    expect(messages[3]).toEqual(imageHistory[3]);
  });
});

it("finishes closing a surface without allowing stale timers to hide a reopened surface", () => {
  vi.useFakeTimers();
  try {
    const view = render(<Presence show><button>Surface</button></Presence>);
    view.rerender(<Presence show={false}><button>Surface</button></Presence>);
    expect(view.container.querySelector("[inert][data-state=closed]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(80));
    view.rerender(<Presence show><button>Surface</button></Presence>);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("button", { name: "Surface" })).toBeTruthy();
    view.rerender(<Presence show={false}><button>Surface</button></Presence>);
    act(() => vi.advanceTimersByTime(160));
    expect(view.container.children).toHaveLength(0);
  } finally { vi.useRealTimers(); }
});
