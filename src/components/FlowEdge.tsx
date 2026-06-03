import { EdgeLabelRenderer, type EdgeProps } from "reactflow";
import type { TopologyEdge } from "../parser";

type FlowEdgeData = TopologyEdge & {
  offset?: number;
  dimmed?: boolean;
  selected?: boolean;
  matches?: boolean;
};

export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data, style }: EdgeProps<FlowEdgeData>) {
  const offset = data?.offset || 0;
  const midX = sourceX + (targetX - sourceX) * 0.5;
  const labelX = midX;
  const labelY = sourceY + (targetY - sourceY) * 0.5 + offset;
  const path = `M ${sourceX},${sourceY} C ${midX},${sourceY + offset} ${midX},${targetY + offset} ${targetX},${targetY}`;
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
