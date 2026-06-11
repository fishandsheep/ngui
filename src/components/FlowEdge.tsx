import { EdgeLabelRenderer, type EdgeProps } from "reactflow";
import type { TopologyEdge } from "../parser";

type FlowEdgeData = TopologyEdge & {
  offset?: number;
  dimmed?: boolean;
  selected?: boolean;
  matches?: boolean;
  layout?: "horizontal" | "vertical";
};

export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data, style }: EdgeProps<FlowEdgeData>) {
  const offset = data?.offset || 0;
  const horizontal = data?.layout !== "vertical";
  const midX = sourceX + (targetX - sourceX) * 0.5;
  const midY = sourceY + (targetY - sourceY) * 0.5;
  const labelX = horizontal ? midX : midX + offset;
  const labelY = horizontal ? midY + offset : midY;
  const path = horizontal
    ? `M ${sourceX},${sourceY} C ${midX},${sourceY + offset} ${midX},${targetY + offset} ${targetX},${targetY}`
    : `M ${sourceX},${sourceY} C ${sourceX + offset},${midY} ${targetX + offset},${midY} ${targetX},${targetY}`;
  const className = [
    "custom-flow-edge",
    data?.type ? `${data.type}-edge` : "",
    data?.dimmed ? "dimmed-edge" : "",
    data?.selected ? "selected-edge" : "",
    data?.matches ? "search-edge" : ""
  ].filter(Boolean).join(" ");

  return (
    <>
      <path id={id} d={path} markerEnd={markerEnd} className={`react-flow__edge-path ${className}`} style={style} />
      {data?.label && !data.dimmed && (
        <EdgeLabelRenderer>
          <span className="edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            {data.label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
