import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/Composer";
import type { ComponentProps } from "react";

function setup(overrides: Partial<ComponentProps<typeof Composer>> = {}) {
  const props: ComponentProps<typeof Composer> = {
    model: "gpt-6.1-sol", effort: "medium", onEffortChange: vi.fn(),
    onSend: vi.fn(), onStop: vi.fn(), generating: false, hasKey: true,
    onNeedKey: vi.fn(), attachments: [], onAddFiles: vi.fn(), onRemoveAttachment: vi.fn(),
    webSearch: false, onToggleWebSearch: vi.fn(), imageMode: false, onToggleImageMode: vi.fn(),
    imageSize: "1024x1024", onImageSizeChange: vi.fn(), imageModel: "gpt-image-2.5-flare",
    imageModels: [], onImageModelChange: vi.fn(), disabled: false, ...overrides,
  };
  const view = render(<Composer {...props} />);
  return { ...view, props, input: screen.getByRole("textbox", { name: "Ask ChatGPT" }) };
}

describe("composer input", () => {
  it("focuses the input from empty padding and toolbar space without stealing button focus", async () => {
    const user = userEvent.setup();
    const { container, input } = setup();
    await user.click(container.querySelector("[data-composer]")!);
    expect(document.activeElement).toBe(input);
    await user.click(container.querySelector("[data-composer] > div:last-child > .flex-1")!);
    expect(document.activeElement).toBe(input);
    const add = screen.getByRole("button", { name: "Add" });
    await user.click(add);
    expect(document.activeElement).toBe(add);
  });

  it("sends on Enter on touch devices, clears the draft, and keeps focus", async () => {
    const user = userEvent.setup();
    const { input, props } = setup();
    await user.type(input, "  Hello world  {Enter}");
    expect(props.onSend).toHaveBeenCalledExactlyOnceWith("Hello world");
    expect((input as HTMLTextAreaElement).value).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("keeps Shift+Enter as a newline and does not submit during IME composition", async () => {
    const user = userEvent.setup();
    const { input, props } = setup();
    await user.type(input, "Hello{Shift>}{Enter}{/Shift}world");
    expect((input as HTMLTextAreaElement).value).toBe("Hello\nworld");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it.each([{ generating: true }, { disabled: true }])("keeps the draft while sending is unavailable: %j", (overrides) => {
    const { input, props } = setup(overrides);
    fireEvent.change(input, { target: { value: "Keep this" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSend).not.toHaveBeenCalled();
    expect((input as HTMLTextAreaElement).value).toBe("Keep this");
  });

  it("requests a key without losing the typed prompt", () => {
    const { input, props } = setup({ hasKey: false });
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onNeedKey).toHaveBeenCalledOnce();
    expect((input as HTMLTextAreaElement).value).toBe("Hello");
  });
});
