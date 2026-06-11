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
    const api = elements.nodes.find((node) => node.id === "server::api");
    const server = elements.nodes.find((node) => node.id === "server::server");

    expect(api?.data.matches).toBe(true);
    expect(api?.data.dimmed).toBe(false);
    expect(server?.data.matches).toBe(false);
    expect(server?.data.dimmed).toBe(true);
  });

  it("keeps matching-node connections visible and dims unrelated edges", () => {
    const elements = toFlowElements(graph, "api");
    const apiEdge = elements.edges.find((edge) => edge.id === "server::api-edge");
    const staticEdge = elements.edges.find((edge) => edge.id === "server::static-edge");

    expect(apiEdge?.data?.matches).toBe(true);
    expect(apiEdge?.data?.dimmed).toBe(false);
    expect(staticEdge?.data?.matches).toBe(false);
    expect(staticEdge?.data?.dimmed).toBe(true);
  });

  it("groups multiple entry points that feed the same server into one lane", () => {
    const groupedGraph: TopologyGraph = {
      nodes: [
        { id: "entry-80", type: "entry", label: "http 80", details: [] },
        { id: "entry-443", type: "entry", label: "http 443 ssl", details: [] },
        { id: "server", type: "server", label: "example.com", details: [] },
        { id: "route", type: "route", label: "location /api", details: [] }
      ],
      edges: [
        { id: "entry80-server", source: "entry-80", target: "server", type: "flow", label: "serves" },
        { id: "entry443-server", source: "entry-443", target: "server", type: "flow", label: "serves" },
        { id: "server-route", source: "server", target: "route", type: "flow", label: "matches" }
      ],
      errors: []
    };

    const elements = toFlowElements(groupedGraph);

    expect(elements.nodes.filter((node) => node.type === "laneGroup")).toHaveLength(1);
    expect(elements.nodes.some((node) => node.id === "server::entry-80")).toBe(true);
    expect(elements.nodes.some((node) => node.id === "server::entry-443")).toBe(true);
    expect(elements.edges.some((edge) => edge.id === "server::server-route")).toBe(true);
  });
});
