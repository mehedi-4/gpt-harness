import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeShell } from "@/components/NativeShell";
import { copyText, postNative } from "@/lib/nativeBridge";
import { downloadMarkdown, downloadText, printHtmlToPdf } from "@/lib/exportDoc";

afterEach(() => { delete window.GptHarnessAndroid; document.documentElement.classList.remove("dark"); });

describe("Android integration", () => {
  it("uses the browser clipboard when running on the website", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(postNative({ type: "theme", dark: false })).toBe(false);
    await copyText("A copied answer");
    expect(writeText).toHaveBeenCalledExactlyOnceWith("A copied answer");
  });

  it("uses Android copy, document-save, and PDF handlers without opening browser popups", async () => {
    const postMessage = vi.fn();
    window.GptHarnessAndroid = { postMessage };
    const open = vi.spyOn(window, "open");
    await copyText("A copied answer");
    downloadMarkdown("# Answer", "My chat");
    downloadText("Answer", "My chat");
    expect(printHtmlToPdf("<p>Answer</p>", "A <title>")).toBe(true);
    const messages = postMessage.mock.calls.map(([value]) => JSON.parse(value));
    expect(messages[0]).toEqual({ type: "copy", text: "A copied answer" });
    expect(messages[1]).toEqual({ type: "saveText", text: "# Answer", filename: "my-chat.md", mime: "text/markdown" });
    expect(messages[2]).toEqual({ type: "saveText", text: "Answer", filename: "my-chat.txt", mime: "text/plain" });
    expect(messages[3]).toMatchObject({ type: "print", title: "A <title>" });
    expect(messages[3].html).toContain("A &lt;title&gt;");
    expect(open).not.toHaveBeenCalled();
  });

  it("synchronizes native system-bar colors with theme changes and cleans up", async () => {
    const postMessage = vi.fn();
    window.GptHarnessAndroid = { postMessage };
    const view = render(<NativeShell />);
    expect(document.documentElement.dataset.native).toBe("android");
    expect(JSON.parse(postMessage.mock.lastCall![0])).toEqual({ type: "theme", dark: false });
    await act(async () => { document.documentElement.classList.add("dark"); });
    expect(JSON.parse(postMessage.mock.lastCall![0])).toEqual({ type: "theme", dark: true });
    view.unmount();
    expect(document.documentElement.dataset.native).toBeUndefined();
  });
});
