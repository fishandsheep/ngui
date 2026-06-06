import { describe, expect, it } from "vitest";
import type { TopologyGraph } from "./parser";
import { toFlowElements } from "./graphLayout";

const graph: TopologyGraph = {
  nodes: [
    { id: "server", type: "server", label: "example.com", details: [] },
    { id: "api", type: "upstream", label: "api_backend", details: ["API pool"] },
    { id: "static", type: "upstream", label: "static_backend", details: [] }
  ],
  edges: [
    { id: "api-edge", source: "server", target: "api", type: "flow", label: "proxy_pass" },
    { id: "static-edge", source: "server", target: "static", type: "flow", label: "assets" }
  ],
  errors: []
};

describe("topology search states", () => {
  it("highlights matching nodes and dims unmatched nodes", () => {
    const elements = toFlowElements(graph, "api");
    const api = elements.nodes.find((node) => node.id === "api");
    const server = elements.nodes.find((node) => node.id === "server");

    expect(api?.data.matches).toBe(true);
    expect(api?.data.dimmed).toBe(false);
    expect(server?.data.matches).toBe(false);
    expect(server?.data.dimmed).toBe(true);
  });

  it("keeps matching-node connections visible and dims unrelated edges", () => {
    const elements = toFlowElements(graph, "api");
    const apiEdge = elements.edges.find((edge) => edge.id === "api-edge");
    const staticEdge = elements.edges.find((edge) => edge.id === "static-edge");

    expect(apiEdge?.data?.matches).toBe(true);
    expect(apiEdge?.data?.dimmed).toBe(false);
    expect(staticEdge?.data?.matches).toBe(false);
    expect(staticEdge?.data?.dimmed).toBe(true);
  });
});
