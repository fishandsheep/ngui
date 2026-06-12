import type { NodeProps } from "reactflow";

type LaneGroupData = {
  label: string;
  subtitle?: string;
  entryCount: number;
};

export function LaneGroup() {
  return <div className="lane-group" />;
}
