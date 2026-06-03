import { Handle, Position, type NodeProps } from "reactflow";
import { Database, GitBranch, Globe2, Route, Server, Shuffle } from "lucide-react";
import type { TopologyNode } from "../parser";

const icons = {
  entry: Globe2,
  server: Server,
  route: Route,
  upstream: GitBranch,
  target: Database,
  variable: Shuffle
};

export function NginxNode({ data, selected }: NodeProps<TopologyNode & { matches?: boolean; related?: boolean; dimmed?: boolean }>) {
  const Icon = icons[data.type];
  return (
    <div className={`nginx-node ${data.type} ${selected ? "selected" : ""} ${data.matches ? "matches" : ""} ${data.related ? "related" : ""} ${data.dimmed ? "dimmed" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-topline">
        <span className="node-icon"><Icon size={15} /></span>
        <span className="node-type">{data.type}</span>
        {data.confidence && <span className={`confidence ${data.confidence}`}>{data.confidence}</span>}
      </div>
      <div className="node-label">{data.label}</div>
      {data.subtitle && <div className="node-subtitle">{data.subtitle}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
