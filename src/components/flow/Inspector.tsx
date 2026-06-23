import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import { BlockMath, InlineMath } from "react-katex";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";
import { EQUIPMENT, PIPE_FLUIDS, PIPE_MATERIALS, type EquipmentType } from "@/lib/thermal/equipment";
import { calculate } from "@/lib/thermal/formulas";

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
  const data = node.data as { tipo: EquipmentType; tag: string; parametros: Record<string, unknown> };
  const def = EQUIPMENT[data.tipo];
  const calc = useMemo(() => calculate(data.tipo, data.parametros ?? {}), [data]);

  const setParam = (key: string, value: unknown) =>
    onUpdate(node.id, {
      ...data,
      parametros: { ...data.parametros, [key]: value },
    });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <Label className="text-xs">Tag</Label>
        <Input
          value={data.tag}
          onChange={(e) => onUpdate(node.id, { ...data, tag: e.target.value })}
          className="mt-1 font-mono"
        />
        <div className="mt-1 text-xs text-muted-foreground">{def.label}</div>
      </div>
      <Tabs defaultValue="params" className="flex-1 overflow-hidden">
        <TabsList className="m-3">
          <TabsTrigger value="params">Parâmetros</TabsTrigger>
          <TabsTrigger value="result">Resultado</TabsTrigger>
          <TabsTrigger value="formulas">Fórmulas</TabsTrigger>
        </TabsList>
        <TabsContent value="params" className="overflow-y-auto px-3 pb-4">
          <div className="space-y-3">
            {def.fields.map((f) => (
              <div key={f.key}>
                <Label className="text-xs">
                  {f.label}
                  {f.unit && <span className="ml-1 text-muted-foreground">({f.unit})</span>}
                </Label>
                {f.type === "select" ? (
                  <Select
                    value={(data.parametros[f.key] as string) ?? ""}
                    onValueChange={(v) => setParam(f.key, v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "text" ? (
                  <Input
                    value={(data.parametros[f.key] as string) ?? ""}
                    onChange={(e) => setParam(f.key, e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={(data.parametros[f.key] as number | string) ?? ""}
                    onChange={(e) =>
                      setParam(f.key, e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="vazio = Dados Insuficientes"
                    className="mt-1 font-mono"
                  />
                )}
                {f.help && <p className="mt-0.5 text-[11px] text-muted-foreground">{f.help}</p>}
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="result" className="overflow-y-auto px-3 pb-4">
          {calc.missing.length > 0 && (
            <Alert className="mb-3 border-warning/40 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Dados Insuficientes</AlertTitle>
              <AlertDescription>
                Faltam: <strong>{calc.missing.join(", ")}</strong>.
              </AlertDescription>
            </Alert>
          )}
          {calc.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem resultados ainda.</p>
          ) : (
            <div className="space-y-3">
              {calc.rows.map((r, i) => (
                <div key={i} className="rounded-md border border-border bg-card p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {r.label}
                  </div>
                  <div className="mt-1 text-lg font-mono font-semibold text-primary">
                    {r.resultado} <span className="text-xs text-muted-foreground">{r.unidade}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="formulas" className="overflow-y-auto px-3 pb-4">
          {calc.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem fórmulas a exibir.</p>
          ) : (
            <div className="space-y-4">
              {calc.rows.map((r, i) => (
                <div key={i} className="rounded-md border border-border bg-card p-3">
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {r.label}
                  </div>
                  <div className="text-sm">
                    <InlineMath math={r.symbolic} />
                  </div>
                  <div className="mt-2 overflow-x-auto text-sm">
                    <BlockMath math={r.substituted} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
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
  const set = (k: string, v: unknown) => onUpdate(edge.id, { ...data, [k]: v });

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <h3 className="mb-3 text-sm font-semibold">Tubulação</h3>
      <Alert className="mb-3">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          NH₃ ataca cobre e latão na presença de umidade — por isso a interligação é feita
          somente em aço (carbono ou inox).
        </AlertDescription>
      </Alert>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Tag</Label>
          <Input
            value={(data.tag as string) ?? ""}
            onChange={(e) => set("tag", e.target.value)}
            className="mt-1 font-mono"
            placeholder="ex.: L-01"
          />
        </div>
        <div>
          <Label className="text-xs">Material</Label>
          <Select
            value={(data.material as string) ?? "aco_carbono"}
            onValueChange={(v) => set("material", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPE_MATERIALS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Fluido</Label>
          <Select
            value={(data.fluido as string) ?? ""}
            onValueChange={(v) => set("fluido", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {PIPE_FLUIDS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Diâmetro nominal (mm)</Label>
            <Input
              type="number"
              value={(data.diametro_mm as number | string) ?? ""}
              onChange={(e) =>
                set("diametro_mm", e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Comprimento (mm)</Label>
            <Input
              type="number"
              value={(data.comprimento_mm as number | string) ?? ""}
              onChange={(e) =>
                set("comprimento_mm", e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Velocidade (m/s)</Label>
            <Input
              type="number"
              value={(data.velocidade as number | string) ?? ""}
              onChange={(e) =>
                set("velocidade", e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Perda de carga (ΔT eq. °C)</Label>
            <Input
              type="number"
              value={(data.perda_dt as number | string) ?? ""}
              onChange={(e) =>
                set("perda_dt", e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 font-mono"
              disabled={data.fluido !== "nh3"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
