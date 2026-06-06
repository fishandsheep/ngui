import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("reactflow", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Background: () => null,
  Controls: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ControlButton: ({ children, ...props }: { children: ReactNode; title?: string; onClick?: () => void }) => <button {...props}>{children}</button>,
  MiniMap: () => null,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useReactFlow: () => ({ fitView: vi.fn() })
}));

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));

describe("App accessibility and interaction states", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("provides names for configuration, search, upload, and icon actions", () => {
    render(<App />);

    expect(screen.getByRole("textbox", { name: "Nginx configuration" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search topology" })).toBeInTheDocument();
    expect(screen.getByLabelText("Upload nginx configuration")).toHaveAttribute("type", "file");
    expect(screen.getByRole("button", { name: "Export topology as JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fullscreen topology workspace" })).toBeInTheDocument();
  });

  it("exposes the configuration panel expansion state", () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: "Collapse config panel" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Expand config panel" })).toHaveAttribute("aria-expanded", "false");
  });

  it("announces deferred topology updates while search settles", async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search topology" }), { target: { value: "api" } });
    expect(screen.getByText("Updating topology...")).toHaveAttribute("role", "status");

    await act(async () => {
      vi.advanceTimersByTime(130);
    });

    expect(screen.queryByText("Updating topology...")).not.toBeInTheDocument();
  });

  it("toggles the topology workspace focus mode", () => {
    const { container } = render(<App />);
    const focusButton = screen.getByRole("button", { name: "Fullscreen topology workspace" });

    fireEvent.click(focusButton);
    expect(container.querySelector(".app-shell")).toHaveClass("canvas-focused");
    expect(screen.getByRole("button", { name: "Show side panels" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Show side panels" }));
    expect(container.querySelector(".app-shell")).not.toHaveClass("canvas-focused");
  });

  it("switches concise interface copy between English and Chinese", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("searchbox", { name: "搜索拓扑" })).toHaveAttribute("placeholder", "搜索 server、upstream、backend...");
    expect(screen.getByRole("heading", { name: "拓扑详情" })).toBeInTheDocument();
    expect(screen.getByText("选择节点或连线，查看来源指令、行号和关联流向。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to English" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(screen.getByRole("heading", { name: "Topology details" })).toBeInTheDocument();
  });
});
