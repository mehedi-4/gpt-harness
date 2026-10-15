import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { streamChat, type StreamHandlers } from "@/lib/streamChat";
import { Markdown } from "@/components/Markdown";
import { AssistantMessage } from "@/components/AssistantMessage";

function handlers(): StreamHandlers {
  return { onReasoningDelta: vi.fn(), onAnswerDelta: vi.fn(), onSearchStart: vi.fn(),
    onSearchQuery: vi.fn(), onSearchDone: vi.fn(), onCitation: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
}
function request(callbacks: StreamHandlers, signal = new AbortController().signal) {
  return streamChat({ apiKey: "demo", model: "gpt-6.1-sol", effort: "medium", history: [], userText: "Hi", signal, handlers: callbacks });
}

describe("live response rendering", () => {
  it("formats unfinished Markdown before completion and continues in place", async () => {
    const view = render(<Markdown content="**Hello" streaming />);
    await waitFor(() => expect(view.container.querySelector("strong")?.textContent).toBe("Hello"));
    view.rerender(<Markdown content={"**Hello world**\n\n- First item\n- Second"} streaming />);
    await waitFor(() => expect(view.container.querySelector("strong")?.textContent).toBe("Hello world"));
    await waitFor(() => expect(view.container.querySelectorAll("li")).toHaveLength(2));
    view.rerender(<Markdown content="**Hello world**" streaming={false} />);
    expect(view.container.querySelector("strong")?.textContent).toBe("Hello world");
  });

  it("renders code and math safely after completion", () => {
    const view = render(<Markdown content={'```js\nconst value = 1;\n```\n\n\\(x^2\\)\n\n<img src="x" onerror="alert(1)"><script>alert(1)</script>'} />);
    expect(view.container.querySelector("pre code")?.textContent).toContain("const value = 1;");
    expect(view.container.querySelector(".katex")).not.toBeNull();
    expect(view.container.querySelector("script, [onerror]")).toBeNull();
  });

  it("copies the code text without animation or syntax-highlighting markup", () => {
    render(<Markdown content={'```js\nconst value = 1;\n```'} />);
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith("const value = 1;");
  });

  it("keeps partial text visible when the connection fails", () => {
    render(<AssistantMessage message={{ id: "a", role: "assistant", content: "Already received", error: "Connection interrupted.", createdAt: 1 }} />);
    expect(screen.getByText("Already received")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Connection interrupted.");
  });

  it("delivers deltas before the stream closes and handles split UTF-8, CRLF, and a final undelimited frame", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    const callbacks = handlers();
    const pending = request(callbacks);
    const encoder = new TextEncoder();
    const bytes = encoder.encode('event: response.output_text.delta\r\ndata: {"delta":"Hello 🌍"}\r\n\r\n');
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    await vi.waitFor(() => expect(callbacks.onAnswerDelta).toHaveBeenCalledWith("Hello 🌍"));
    expect(callbacks.onDone).not.toHaveBeenCalled();
    controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":" again"}\n\ndata: {"type":"response.completed"}'));
    controller.close();
    await pending;
    expect(callbacks.onAnswerDelta).toHaveBeenLastCalledWith(" again");
    expect(callbacks.onDone).toHaveBeenCalledOnce();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("reports upstream failure once and aborts a pending read without completing it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('data: {"type":"response.failed","response":{"error":{"message":"Unavailable"}}}\n\n')));
    const failed = handlers();
    await request(failed);
    expect(failed.onError).toHaveBeenCalledExactlyOnceWith("Unavailable");
    expect(failed.onDone).not.toHaveBeenCalled();

    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ cancel }))));
    const aborted = handlers(), controller = new AbortController();
    const pending = request(aborted, controller.signal);
    await Promise.resolve();
    controller.abort();
    await pending;
    expect(cancel).toHaveBeenCalledOnce();
    expect(aborted.onDone).not.toHaveBeenCalled();
    expect(aborted.onError).not.toHaveBeenCalled();
  });
});
