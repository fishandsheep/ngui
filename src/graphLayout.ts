import type { Edge, Node } from "reactflow";
import type { TopologyGraph, TopologyNode } from "./parser";

const ranks: Record<TopologyNode["type"], number> = {
  entry: 0,
  server: 1,
  route: 2,
  variable: 3,
  upstream: 4,
  target: 5
};

export type LayoutDirection = "horizontal" | "vertical";

const horizontalRankGap = 290;
const horizontalNodeGap = 132;
const verticalRankGap = 180;
const verticalNodeGap = 250;
const start = 80;

export function toFlowElements(graph: TopologyGraph, query = "", selectedId?: string, layout: LayoutDirection = "horizontal") {
  const lowerQuery = query.trim().toLowerCase();
  const queryActive = lowerQuery.length > 0;
  const matchedNodeIds = new Set(
    queryActive
      ? graph.nodes.filter((node) => searchable(node).includes(lowerQuery)).map((node) => node.id)
      : []
  );
  const connected = new Set<string>();
  if (selectedId) {
    connected.add(selectedId);
    graph.edges.forEach((edge) => {
      if (edge.source === selectedId || edge.target === selectedId) {
        connected.add(edge.source);
        connected.add(edge.target);
      }
    });
  }

  const buckets = new Map<number, TopologyNode[]>();
  graph.nodes.forEach((node) => {
    const rank = ranks[node.type];
    const bucket = buckets.get(rank);
    if (bucket) {
      bucket.push(node);
    } else {
      buckets.set(rank, [node]);
    }
  });
  const nodeIndexes = new Map<string, number>();
  buckets.forEach((bucket) => bucket.forEach((node, index) => nodeIndexes.set(node.id, index)));
  const maxBucketSize = Math.max(1, ...[...buckets.values()].map((bucket) => bucket.length));
  const horizontalCenter = start + ((maxBucketSize - 1) * horizontalNodeGap) / 2;
  const verticalCenter = start + ((maxBucketSize - 1) * verticalNodeGap) / 2;

  const nodes: Node[] = graph.nodes.map((node) => {
    const rank = ranks[node.type];
    const bucket = buckets.get(rank) || [];
    const index = nodeIndexes.get(node.id) || 0;
    const matches = matchedNodeIds.has(node.id);
    const related = selectedId ? connected.has(node.id) : false;
    const dimmedBySelection = Boolean(selectedId && !related && selectedId !== node.id);
    const dimmedByQuery = queryActive && !matches;
    return {
      id: node.id,
      type: "nginxNode",
      position: layout === "horizontal"
        ? {
          x: start + rank * horizontalRankGap,
          y: horizontalCenter - ((bucket.length - 1) * horizontalNodeGap) / 2 + index * horizontalNodeGap
        }
        : {
          x: verticalCenter - ((bucket.length - 1) * verticalNodeGap) / 2 + index * verticalNodeGap,
          y: start + rank * verticalRankGap
        },
      data: {
        ...node,
        layout,
        matches,
        related,
        dimmed: dimmedBySelection || dimmedByQuery
      }
    };
  });

  const edgeGroups = new Map<string, number>();
  const sourceEdgeIndexes = new Map<string, number>();
  const sourceEdgeCounts = new Map<string, number>();
  graph.edges.forEach((edge) => {
    const key = `${edge.source}->${edge.target}`;
    edgeGroups.set(key, (edgeGroups.get(key) || 0) + 1);
    const sourceIndex = sourceEdgeCounts.get(edge.source) || 0;
    sourceEdgeIndexes.set(edge.id, sourceIndex);
    sourceEdgeCounts.set(edge.source, sourceIndex + 1);
  });
  const edgeIndexes = new Map<string, number>();

  const edges: Edge[] = graph.edges.map((edge) => {
    const selected = selectedId && (edge.source === selectedId || edge.target === selectedId);
    const matches = queryActive && (
      Boolean(edge.label?.toLowerCase().includes(lowerQuery))
      || matchedNodeIds.has(edge.source)
      || matchedNodeIds.has(edge.target)
    );
    const key = `${edge.source}->${edge.target}`;
    const siblingCount = edgeGroups.get(key) || 1;
    const siblingIndex = edgeIndexes.get(key) || 0;
    edgeIndexes.set(key, siblingIndex + 1);
    const sourceFanout = sourceEdgeIndexes.get(edge.id) || 0;
    const offset = (siblingIndex - (siblingCount - 1) / 2) * 32 + ((sourceFanout % 5) - 2) * 12;
    const dimmed = Boolean((selectedId && !selected) || (queryActive && !matches));
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: layout === "vertical" ? "source-bottom" : "source-right",
      targetHandle: layout === "vertical" ? "target-top" : "target-left",
      animated: false,
      label: edge.label,
      type: "flowEdge",
      className: `${edge.type}-edge${selected ? " selected-edge" : ""}${matches ? " search-edge" : ""}${dimmed ? " dimmed-edge" : ""}`,
      data: { ...edge, selected: Boolean(selected), matches, dimmed, offset, layout },
      style: {
        strokeWidth: selected ? 3 : 2,
        opacity: dimmed ? 0.18 : 1
      }
    };
  });

  return { nodes, edges };
}

function searchable(node: TopologyNode) {
  return `${node.label} ${node.subtitle || ""} ${node.raw || ""} ${node.details.join(" ")}`.toLowerCase();
}
