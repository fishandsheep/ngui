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
  useReactFlow: () => ({ fitView: vi.fn() }),
  applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes
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

    fireEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }));

    expect(screen.getByRole("searchbox", { name: "搜索拓扑" })).toHaveAttribute("placeholder", "搜索 server、upstream、backend...");
    expect(screen.getByRole("heading", { name: "拓扑详情" })).toBeInTheDocument();
    expect(screen.getByText("选择节点或连线，查看来源指令、行号和关联流向。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to English" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(screen.getByRole("heading", { name: "Topology details" })).toBeInTheDocument();
  });

  it("shows unified issue count and English issue messages", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nginx configuration" }), {
      target: { value: "http { server { listen 80; location / { proxy_pass http://missing_pool; } } }" }
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const issues = screen.getByLabelText("2 configuration issues");
    expect(issues).toBeInTheDocument();
    expect(issues.textContent).toContain("[INFO] L1: HTTP server block has no server_name directive.");
  });

  it("translates issue messages after switching to Chinese", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nginx configuration" }), {
      target: { value: "http { server { listen 80; location / { proxy_pass http://missing_pool; } } }" }
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }));
    const issues = screen.getByLabelText("2 个配置问题");
    expect(issues).toBeInTheDocument();
    expect(issues.textContent).toContain("[提示] L1: HTTP server 块没有 server_name 指令。");
  });

  it("renders issues even when the config has only advisory checks", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nginx configuration" }), {
      target: { value: "http { server { listen 80; location /docs { add_header X-Test ok; } } }" }
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const issues = screen.getByLabelText("2 configuration issues");
    expect(issues).toBeInTheDocument();
    expect(issues.textContent).toContain("[INFO] L1: Location \"/docs\" has no recognized terminal routing directive.");
  });

  it("jumps to the matching config line when an issue is clicked", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nginx configuration" }), {
      target: { value: "events {}\nhttp { server { location /docs { add_header X-Test ok; } } }" }
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const issues = screen.getByLabelText("3 configuration issues");
    const issueButtons = issues.querySelectorAll("button.issue-item");
    expect(issueButtons).toHaveLength(3);

    fireEvent.click(issueButtons[0]);

    const textarea = screen.getByRole("textbox", { name: "Nginx configuration" }) as HTMLTextAreaElement;
    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBeGreaterThan(0);
    expect(document.querySelector('.code-line-active[data-line="2"]')).toBeInTheDocument();
  });

  it("keeps issue line jump available after switching to Chinese", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nginx configuration" }), {
      target: { value: "events {}\nhttp { server { location /docs { add_header X-Test ok; } } }" }
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }));

    const issues = screen.getByLabelText("3 个配置问题");
    const issueButtons = issues.querySelectorAll("button.issue-item");
    expect(issueButtons).toHaveLength(3);

    fireEvent.keyDown(issueButtons[0], { key: "Enter", code: "Enter" });

    const textarea = screen.getByRole("textbox", { name: "Nginx 配置" }) as HTMLTextAreaElement;
    expect(textarea).toHaveFocus();
    expect(document.querySelector('.code-line-active[data-line="2"]')).toBeInTheDocument();
  });

  it("keeps issue line and jump target exactly aligned when blank lines exist", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nginx configuration" }), {
      target: {
        value: [
          "events {}",
          "",
          "http {",
          "  server {",
          "    location /docs {",
          "      add_header X-Test ok;",
          "    }",
          "  }",
          "}"
        ].join("\n")
      }
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const issues = screen.getByLabelText("3 configuration issues");
    const issueButtons = [...issues.querySelectorAll("button.issue-item")];
    const locationIssue = issueButtons.find((button) => button.textContent?.includes('Location "/docs"'));
    expect(locationIssue).toBeDefined();
    expect(locationIssue?.textContent).toContain("L5:");

    fireEvent.click(locationIssue!);

    expect(document.querySelector('.code-line-active[data-line="5"]')).toBeInTheDocument();
    expect(document.querySelector('.code-gutter-line-active[data-line="5"]')).toBeInTheDocument();
  });
});
