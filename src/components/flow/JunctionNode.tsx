import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export function JunctionNode({ selected }: NodeProps) {
  return (
    <div
      className={cn(
        "relative h-3 w-3 rounded-full border bg-primary",
        selected ? "border-primary ring-2 ring-primary/50" : "border-primary/70",
      )}
      style={{ marginLeft: -6, marginTop: -6 }}
    >
      {/* Handles sobrepostos no centro — aceitam conexões em qualquer direção */}
      <Handle
        id="t"
        type="target"
        position={Position.Left}
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", opacity: 0, width: 12, height: 12, border: 0 }}
      />
      <Handle
        id="s"
        type="source"
        position={Position.Right}
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", opacity: 0, width: 12, height: 12, border: 0 }}
      />
    </div>
  );
}
