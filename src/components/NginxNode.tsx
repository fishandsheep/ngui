import { Handle, Position, type NodeProps } from "reactflow";
import { GitBranch, Globe2, HardDrive, Route, Server, Shuffle } from "lucide-react";
import type { TopologyNode } from "../parser";

const icons = {
  entry: Globe2,
  server: Server,
  route: Route,
  upstream: GitBranch,
  target: HardDrive,
  variable: Shuffle
};

export function NginxNode({ data, selected }: NodeProps<TopologyNode & { matches?: boolean; related?: boolean; dimmed?: boolean; layout?: "horizontal" | "vertical" }>) {
  const Icon = icons[data.type];
  const targetPosition = data.layout === "vertical" ? Position.Top : Position.Left;
  const sourcePosition = data.layout === "vertical" ? Position.Bottom : Position.Right;

  return (
    <div className={`nginx-node ${data.type} ${selected ? "selected" : ""} ${data.matches ? "matches" : ""} ${data.related ? "related" : ""} ${data.dimmed ? "dimmed" : ""}`}>
      <Handle type="target" position={targetPosition} />
      <div className="node-topline">
        <span className="node-icon"><Icon size={15} /></span>
        <span className="node-type">{data.type}</span>
        {data.confidence && <span className={`confidence ${data.confidence}`}>{data.confidence}</span>}
      </div>
      <div className="node-label">{data.label}</div>
      {data.subtitle && <div className="node-subtitle">{data.subtitle}</div>}
      {data.type !== "target" && <Handle type="source" position={sourcePosition} />}
    </div>
  );
}
