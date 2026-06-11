import type { NodeProps } from "reactflow";

type LaneGroupData = {
  label: string;
  subtitle?: string;
  entryCount: number;
};

export function LaneGroup({ data }: NodeProps<LaneGroupData>) {
  return (
    <div className="lane-group">
      <div className="lane-group__header">
        <span className="lane-group__eyebrow">SERVER GROUP</span>
        <span className="lane-group__count">{data.entryCount} {data.entryCount === 1 ? "entry" : "entries"}</span>
      </div>
      <div className="lane-group__title">{data.label}</div>
      {data.subtitle && <div className="lane-group__subtitle">{data.subtitle}</div>}
    </div>
  );
}
