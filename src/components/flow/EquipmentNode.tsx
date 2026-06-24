import { Handle, Position, type NodeProps } from "@xyflow/react";
import { EQUIPMENT, type EquipmentType } from "@/lib/thermal/equipment";
import { cn } from "@/lib/utils";

export interface EquipmentNodeData {
  tipo: EquipmentType;
  tag: string;
  parametros?: Record<string, unknown>;
}

export function EquipmentNode({ data, selected }: NodeProps) {
  const d = data as unknown as EquipmentNodeData;
  const def = EQUIPMENT[d.tipo];
  const Icon = def.icon;

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-md border bg-card text-card-foreground shadow-md transition",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {def.shortLabel}
        </span>
        <span className="ml-auto font-mono text-sm font-semibold">{d.tag}</span>
      </div>
      <div className="px-3 py-2 text-sm">{def.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
