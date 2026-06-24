import type { Edge, Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { EQUIPMENT, type EquipmentType } from "@/lib/thermal/equipment";

interface Props {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (id: string, patch: Partial<Node["data"]>) => void;
  onUpdateEdge: (id: string, patch: Partial<Edge["data"]>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
}

export function Inspector({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
}: Props) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Selecione um equipamento ou tubulação para editar.
        <p className="mt-3 text-xs">
          Dica: pressione <kbd className="rounded border border-border bg-muted px-1">Delete</kbd>{" "}
          ou <kbd className="rounded border border-border bg-muted px-1">Backspace</kbd> para
          remover itens selecionados.
        </p>
      </div>
    );
  }
  if (selectedEdge)
    return (
      <EdgeInspector edge={selectedEdge} onUpdate={onUpdateEdge} onDelete={onDeleteEdge} />
    );
  return (
    <NodeInspector node={selectedNode!} onUpdate={onUpdateNode} onDelete={onDeleteNode} />
  );
}

function NodeInspector({
  node,
  onUpdate,
  onDelete,
}: {
  node: Node;
  onUpdate: (id: string, patch: Partial<Node["data"]>) => void;
  onDelete: (id: string) => void;
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
      <Button
        variant="destructive"
        size="sm"
        className="mt-6"
        onClick={() => onDelete(node.id)}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        Remover equipamento
      </Button>
    </div>
  );
}

function EdgeInspector({
  edge,
  onUpdate,
  onDelete,
}: {
  edge: Edge;
  onUpdate: (id: string, patch: Partial<Edge["data"]>) => void;
  onDelete: (id: string) => void;
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
      <Button
        variant="destructive"
        size="sm"
        className="mt-6"
        onClick={() => onDelete(edge.id)}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        Remover tubulação
      </Button>
    </div>
  );
}
