import type { Edge, Node } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EQUIPMENT, type EquipmentType } from "@/lib/thermal/equipment";

interface Props {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (id: string, patch: Partial<Node["data"]>) => void;
  onUpdateEdge: (id: string, patch: Partial<Edge["data"]>) => void;
}

export function Inspector({ selectedNode, selectedEdge, onUpdateNode, onUpdateEdge }: Props) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Selecione um equipamento ou tubulação para editar.
      </div>
    );
  }
  if (selectedEdge) return <EdgeInspector edge={selectedEdge} onUpdate={onUpdateEdge} />;
  return <NodeInspector node={selectedNode!} onUpdate={onUpdateNode} />;
}

function NodeInspector({
  node,
  onUpdate,
}: {
  node: Node;
  onUpdate: (id: string, patch: Partial<Node["data"]>) => void;
}) {
  const data = node.data as { tipo: EquipmentType; tag: string; parametros?: Record<string, unknown> };
  const def = EQUIPMENT[data.tipo];

  return (
    <div className="flex h-full flex-col p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{def.shortLabel}</div>
      <div className="mb-3 text-sm font-medium">{def.label}</div>
      <Label className="text-xs">Tag</Label>
      <Input
        value={data.tag}
        onChange={(e) => onUpdate(node.id, { ...data, tag: e.target.value })}
        className="mt-1 font-mono"
      />
      <p className="mt-6 text-xs text-muted-foreground">
        Parâmetros e cálculos serão adicionados em breve.
      </p>
    </div>
  );
}

function EdgeInspector({
  edge,
  onUpdate,
}: {
  edge: Edge;
  onUpdate: (id: string, patch: Partial<Edge["data"]>) => void;
}) {
  const data = (edge.data ?? {}) as Record<string, unknown>;
  return (
    <div className="flex h-full flex-col p-4">
      <h3 className="mb-3 text-sm font-semibold">Tubulação</h3>
      <Label className="text-xs">Tag</Label>
      <Input
        value={(data.tag as string) ?? ""}
        onChange={(e) => onUpdate(edge.id, { ...data, tag: e.target.value })}
        className="mt-1 font-mono"
        placeholder="ex.: L-01"
      />
    </div>
  );
}
