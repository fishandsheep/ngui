import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeEditor, type CodeEditorHandle } from "./CodeEditor";

describe("CodeEditor line focus", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("focuses the textarea and selects the requested line", () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} value={"first\nsecond line\nthird"} onChange={() => undefined} />);

    act(() => {
      ref.current?.focusLine(2);
    });

    const textarea = screen.getByRole("textbox", { name: "Nginx configuration" }) as HTMLTextAreaElement;
    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(17);
  });

  it("temporarily highlights the requested line", () => {
    vi.useFakeTimers();
    const ref = createRef<CodeEditorHandle>();
    const { container } = render(<CodeEditor ref={ref} value={"first\nsecond\nthird"} onChange={() => undefined} />);

    act(() => {
      ref.current?.focusLine(2);
    });

    expect(container.querySelector('.code-line-active[data-line="2"]')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1401);
    });

    expect(container.querySelector('.code-line-active[data-line="2"]')).not.toBeInTheDocument();
  });

  it("ignores invalid line numbers without throwing", () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} value={"first\nsecond"} onChange={() => undefined} />);
    const textarea = screen.getByRole("textbox", { name: "Nginx configuration" }) as HTMLTextAreaElement;

    expect(() => {
      act(() => {
        ref.current?.focusLine(0);
        ref.current?.focusLine(99);
      });
    }).not.toThrow();

    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(0);
  });

  it("renders line numbers for blank lines and focuses the exact blank line", () => {
    const ref = createRef<CodeEditorHandle>();
    const { container } = render(<CodeEditor ref={ref} value={"first\n\nthird"} onChange={() => undefined} />);

    expect(container.querySelector('.code-gutter-line[data-line="2"]')).toHaveTextContent("2");

    act(() => {
      ref.current?.focusLine(2);
    });

    const textarea = screen.getByRole("textbox", { name: "Nginx configuration" }) as HTMLTextAreaElement;
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(6);
    expect(container.querySelector('.code-line-active[data-line="2"]')).toBeInTheDocument();
    expect(container.querySelector('.code-gutter-line-active[data-line="2"]')).toBeInTheDocument();
  });
});
