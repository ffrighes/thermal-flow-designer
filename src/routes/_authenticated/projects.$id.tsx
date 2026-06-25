import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadProject, saveProject } from "@/lib/projects.functions";
import { EQUIPMENT, type EquipmentType } from "@/lib/thermal/equipment";
import { EquipmentNode } from "@/components/flow/EquipmentNode";
import { JunctionNode } from "@/components/flow/JunctionNode";
import { Palette } from "@/components/flow/Palette";
import { Inspector } from "@/components/flow/Inspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, LogOut, Save, Snowflake } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: EditorPage,
});

const nodeTypes = { equipment: EquipmentNode, junction: JunctionNode };

const SNAP = 16;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

function EditorPage() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}

function EditorInner() {
  const { id } = Route.useParams();
  const load = useServerFn(loadProject);
  const save = useServerFn(saveProject);
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => load({ data: { id } }),
  });

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [name, setName] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const initialized = useRef(false);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setName(data.project.nome);
    setNodes(
      data.nodes.map((n) => {
        if (n.tipo === "junction") {
          return {
            id: n.id,
            type: "junction",
            position: { x: n.pos_x, y: n.pos_y },
            data: { tipo: "junction" as const, tag: "", parametros: {} },
          } as Node;
        }
        return {
          id: n.id,
          type: "equipment",
          position: { x: n.pos_x, y: n.pos_y },
          data: { tipo: n.tipo as EquipmentType, tag: n.tag, parametros: n.parametros ?? {} },
        } as Node;
      }),
    );
    setEdges(
      data.edges.map((e) => ({
        id: e.id,
        source: e.source_node,
        target: e.target_node,
        type: "step",
        data: { material: e.material, ...((e.parametros as object) ?? {}) },
        label: (e.parametros as Record<string, unknown>)?.tag as string | undefined,
      })),
    );
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      return save({
        data: {
          id,
          nome: name,
          nodes: nodes.map((n) => {
            const d = n.data as { tipo: string; tag: string; parametros: Record<string, unknown> };
            return {
              id: n.id,
              tipo: d.tipo,
              tag: d.tag,
              pos_x: n.position.x,
              pos_y: n.position.y,
              parametros: d.parametros ?? {},
            };
          }),
          edges: edges.map((e) => {
            const d = (e.data ?? {}) as Record<string, unknown>;
            const { material = "aco_carbono", ...rest } = d;
            return {
              id: e.id,
              source_node: e.source,
              target_node: e.target,
              material: material as string,
              parametros: rest,
            };
          }),
        },
      });
    },
    onSuccess: (r) => {
      setSavedAt(r.savedAt);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error("Falha ao salvar", { description: String(e) }),
  });

  // Auto-save debounce
  useEffect(() => {
    if (!initialized.current) return;
    const t = setTimeout(() => saveMut.mutate(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...c, id: crypto.randomUUID(), type: "step", data: { material: "aco_carbono" } },
          eds,
        ),
      ),
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const tipo = e.dataTransfer.getData("application/x-equipment") as EquipmentType;
      if (!tipo || !EQUIPMENT[tipo]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const tag = `${EQUIPMENT[tipo].shortLabel}-${String(
        nodes.filter((n) => (n.data as { tipo: EquipmentType }).tipo === tipo).length + 1,
      ).padStart(2, "0")}`;
      setNodes((nds) => [
        ...nds,
        {
          id: crypto.randomUUID(),
          type: "equipment",
          position,
          data: { tipo, tag, parametros: {} },
        },
      ]);
    },
    [nodes, screenToFlowPosition],
  );

  const updateNode = useCallback((nodeId: string, patch: Partial<Node["data"]>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
    setSelectedNode((cur) =>
      cur && cur.id === nodeId ? { ...cur, data: { ...cur.data, ...patch } } : cur,
    );
  }, []);
  const updateEdge = useCallback((edgeId: string, patch: Partial<Edge["data"]>) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e;
        const newData = { ...(e.data ?? {}), ...patch };
        return { ...e, data: newData, label: (newData as Record<string, unknown>).tag as string | undefined };
      }),
    );
    setSelectedEdge((cur) =>
      cur && cur.id === edgeId ? { ...cur, data: { ...(cur.data ?? {}), ...patch } } : cur,
    );
  }, []);

  // Helper: substitui um nó por uma junção na mesma posição, preservando as arestas
  const replaceNodeWithJunction = useCallback((nodeId: string) => {
    let junctionId: string | null = null;
    setNodes((nds) => {
      const target = nds.find((n) => n.id === nodeId);
      if (!target) return nds.filter((n) => n.id !== nodeId);
      // Centro aproximado: para equipamentos, ~90x30 do canto sup. esq.
      const isEquip = target.type === "equipment";
      const cx = snap(target.position.x + (isEquip ? 90 : 0));
      const cy = snap(target.position.y + (isEquip ? 30 : 0));
      junctionId = crypto.randomUUID();
      const junction: Node = {
        id: junctionId,
        type: "junction",
        position: { x: cx, y: cy },
        data: { tipo: "junction", tag: "", parametros: {} },
      };
      return [...nds.filter((n) => n.id !== nodeId), junction];
    });
    setEdges((eds) =>
      eds
        .map((e) => {
          if (e.source !== nodeId && e.target !== nodeId) return e;
          if (!junctionId) return e;
          const next: Edge = {
            ...e,
            source: e.source === nodeId ? junctionId : e.source,
            target: e.target === nodeId ? junctionId : e.target,
            sourceHandle: e.source === nodeId ? "s" : e.sourceHandle,
            targetHandle: e.target === nodeId ? "t" : e.targetHandle,
          };
          // Evita self-loop caso ambas as pontas viessem do mesmo nó
          if (next.source === next.target) return null;
          return next;
        })
        .filter((e): e is Edge => e !== null),
    );
    setSelectedNode((cur) => (cur && cur.id === nodeId ? null : cur));
  }, []);

  const deleteNode = useCallback(
    (nodeId: string) => {
      // Se for junção, apenas remove (e remove arestas órfãs, ou funde se houver exatamente 2)
      setNodes((nds) => {
        const target = nds.find((n) => n.id === nodeId);
        if (target?.type === "junction") {
          setEdges((eds) => {
            const incident = eds.filter((e) => e.source === nodeId || e.target === nodeId);
            const others = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
            if (incident.length === 2) {
              // Fundir: pega a "entrada" e a "saída" e cria uma nova aresta direta
              const a = incident[0];
              const b = incident[1];
              const otherOfA = a.source === nodeId ? a.target : a.source;
              const otherOfB = b.source === nodeId ? b.target : b.source;
              if (otherOfA !== otherOfB) {
                others.push({
                  ...a,
                  id: crypto.randomUUID(),
                  source: otherOfA,
                  target: otherOfB,
                  sourceHandle: undefined,
                  targetHandle: undefined,
                });
              }
            }
            return others;
          });
          setSelectedNode((cur) => (cur && cur.id === nodeId ? null : cur));
          return nds.filter((n) => n.id !== nodeId);
        }
        return nds;
      });
      // Para equipamentos, preserva as linhas convertendo em junção
      const isEquip = nodes.find((n) => n.id === nodeId)?.type === "equipment";
      if (isEquip) replaceNodeWithJunction(nodeId);
    },
    [nodes, replaceNodeWithJunction],
  );

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdge((cur) => (cur && cur.id === edgeId ? null : cur));
  }, []);

  // Cria junção sobre uma aresta (Alt+clique) e a divide em duas
  const splitEdgeAt = useCallback(
    (edgeId: string, flowX: number, flowY: number) => {
      const x = snap(flowX);
      const y = snap(flowY);
      const junctionId = crypto.randomUUID();
      setNodes((nds) => [
        ...nds,
        {
          id: junctionId,
          type: "junction",
          position: { x, y },
          data: { tipo: "junction", tag: "", parametros: {} },
        },
      ]);
      setEdges((eds) => {
        const orig = eds.find((e) => e.id === edgeId);
        if (!orig) return eds;
        const a: Edge = {
          ...orig,
          id: crypto.randomUUID(),
          target: junctionId,
          targetHandle: "t",
        };
        const b: Edge = {
          ...orig,
          id: crypto.randomUUID(),
          source: junctionId,
          sourceHandle: "s",
        };
        return [...eds.filter((e) => e.id !== edgeId), a, b];
      });
      setSelectedEdge(null);
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Carregando projeto…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Topbar */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
        <Link to="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Projetos
        </Link>
        <Snowflake className="h-4 w-4 text-primary" />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 max-w-[260px] font-medium"
        />
        <div className="ml-2 text-xs text-muted-foreground">
          {saveMut.isPending
            ? "Salvando…"
            : savedAt
              ? `Salvo às ${new Date(savedAt).toLocaleTimeString("pt-BR")}`
              : "Não salvo"}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="mr-1 h-4 w-4" />
            Salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <aside className="w-60 border-r border-border bg-sidebar">
          <Palette />
        </aside>
        {/* Canvas + Balance */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            className="relative flex-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={onDrop}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => {
                setSelectedNode(n);
                setSelectedEdge(null);
              }}
              onEdgeClick={(evt, e) => {
                if (evt.altKey) {
                  const pos = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
                  splitEdgeAt(e.id, pos.x, pos.y);
                  return;
                }
                setSelectedEdge(e);
                setSelectedNode(null);
              }}
              onPaneClick={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              fitView
              snapToGrid
              snapGrid={[16, 16]}
              deleteKeyCode={["Delete", "Backspace"]}
              onBeforeDelete={async ({ nodes: ns, edges: es }) => {
                // Trate cada nó com nossa lógica (preserva linhas em equipamentos)
                for (const n of ns) deleteNode(n.id);
                for (const e of es) {
                  if (ns.some((n) => n.id === e.source || n.id === e.target)) continue;
                  deleteEdge(e.id);
                }
                return false;
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        </div>
        {/* Inspector */}
        <aside className="w-80 border-l border-border bg-sidebar">
          <Inspector
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onUpdateNode={updateNode}
            onUpdateEdge={updateEdge}
            onDeleteNode={deleteNode}
            onDeleteEdge={deleteEdge}
            onSplitEdge={(edgeId) => {
              const e = edges.find((x) => x.id === edgeId);
              if (!e) return;
              const a = nodes.find((n) => n.id === e.source);
              const b = nodes.find((n) => n.id === e.target);
              if (!a || !b) return;
              splitEdgeAt(edgeId, (a.position.x + b.position.x) / 2, (a.position.y + b.position.y) / 2);
            }}
          />
        </aside>
      </div>
    </div>
  );
}
