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
  useStore,
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
import { OrthoEdge } from "@/components/flow/OrthoEdge";
import { JunctionNode } from "@/components/flow/JunctionNode";
import { Palette } from "@/components/flow/Palette";
import { Inspector } from "@/components/flow/Inspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, LogOut, Save, Snowflake, Spline, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: EditorPage,
});

const nodeTypes = { equipment: EquipmentNode, junction: JunctionNode };
const edgeTypes = { ortho: OrthoEdge };

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
  const [branchMode, setBranchMode] = useState(false);
  type Pt = { x: number; y: number };
  type Drawing = {
    points: Pt[];
    cursor: Pt | null;
    startNodeId: string | null;
    anchor: Pt | null;
  };
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const drawingRef = useRef<Drawing | null>(null);
  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);
  const initialized = useRef(false);
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useStore((s) => s.transform);

  const makeJunction = useCallback((x: number, y: number): Node => ({
    id: crypto.randomUUID(),
    type: "junction",
    position: { x: snap(x), y: snap(y) },
    data: { tipo: "junction", tag: "", parametros: {} },
  }), []);

  const orthoNext = useCallback((prev: Pt, next: Pt): Pt => {
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    if (Math.abs(dx) >= Math.abs(dy)) return { x: snap(next.x), y: prev.y };
    return { x: prev.x, y: snap(next.y) };
  }, []);

  const nodeAnchor = useCallback((n: Node): Pt => {
    if (n.type === "equipment") {
      return { x: n.position.x + 180, y: n.position.y + 30 };
    }
    return { x: n.position.x, y: n.position.y };
  }, []);

  const startDrawing = useCallback(() => {
    setBranchMode(false);
    setSelectedNode(null);
    setSelectedEdge(null);
    setDrawing({ points: [], cursor: null, startNodeId: null, anchor: null });
  }, []);

  const cancelDrawing = useCallback(() => setDrawing(null), []);

  const commitDrawing = useCallback(
    (endNodeId: string | null, endNodeAnchor: Pt | null) => {
      const cur = drawingRef.current;
      if (!cur) return;
      // Determine last reference point for ortho projection
      const ref = cur.points[cur.points.length - 1] ?? cur.anchor;
      let pts = [...cur.points];

      if (endNodeId && endNodeAnchor && ref) {
        const finalPt = orthoNext(ref, endNodeAnchor);
        if (!pts.length || pts[pts.length - 1].x !== finalPt.x || pts[pts.length - 1].y !== finalPt.y) {
          pts.push(finalPt);
        }
      }

      // Need at least one segment: source + target distinct
      if (!cur.startNodeId && !endNodeId && pts.length < 2) {
        setDrawing(null);
        return;
      }
      if ((cur.startNodeId || endNodeId) && pts.length < 1) {
        setDrawing(null);
        return;
      }

      let sourceId = cur.startNodeId;
      let targetId = endNodeId;
      const newJunctions: Node[] = [];

      if (!sourceId) {
        const j = makeJunction(pts[0].x, pts[0].y);
        newJunctions.push(j);
        sourceId = j.id;
        pts = pts.slice(1);
      }
      if (!targetId) {
        const lastP = pts[pts.length - 1];
        const j = makeJunction(lastP.x, lastP.y);
        newJunctions.push(j);
        targetId = j.id;
        pts = pts.slice(0, -1);
      }
      if (sourceId === targetId) {
        setDrawing(null);
        return;
      }

      // Derive axes from first/last segment of full polyline (src-anchor → pts → tgt-anchor)
      const srcNode = newJunctions.find((n) => n.id === sourceId)
        ?? nodes.find((n) => n.id === sourceId);
      const tgtNode = newJunctions.find((n) => n.id === targetId)
        ?? nodes.find((n) => n.id === targetId);
      const srcAnchor = srcNode ? nodeAnchor(srcNode) : { x: 0, y: 0 };
      const tgtAnchor = tgtNode ? nodeAnchor(tgtNode) : { x: 0, y: 0 };
      const firstWp = pts[0] ?? tgtAnchor;
      const lastWp = pts[pts.length - 1] ?? srcAnchor;
      const startAxis: "h" | "v" =
        Math.abs(firstWp.x - srcAnchor.x) >= Math.abs(firstWp.y - srcAnchor.y) ? "h" : "v";
      const endAxis: "h" | "v" =
        Math.abs(tgtAnchor.x - lastWp.x) >= Math.abs(tgtAnchor.y - lastWp.y) ? "h" : "v";

      setNodes((nds) => [...nds, ...newJunctions]);
      setEdges((eds) => [
        ...eds,
        {
          id: crypto.randomUUID(),
          source: sourceId!,
          target: targetId!,
          sourceHandle: "s",
          targetHandle: "t",
          type: "ortho",
          data: {
            material: "aco_carbono",
            waypoints: pts,
            startAxis,
            endAxis,
          },
        },
      ]);
      setDrawing(null);
    },
    [makeJunction, nodeAnchor, nodes, orthoNext],
  );

  // Keyboard: Esc cancels, Enter finalizes (with junction at last cursor/point)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!drawingRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDrawing();
      } else if (e.key === "Enter") {
        e.preventDefault();
        commitDrawing(null, null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelDrawing, commitDrawing]);




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
        type: "ortho",
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
          { ...c, id: crypto.randomUUID(), type: "ortho", data: { material: "aco_carbono" } },
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
            onMouseMove={(e) => {
              if (!drawingRef.current) return;
              const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
              setDrawing((cur) => (cur ? { ...cur, cursor: pos } : cur));
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => {
                if (drawing) {
                  if (n.type !== "equipment" && n.type !== "junction") return;
                  if (!drawing.startNodeId && drawing.points.length === 0) {
                    setDrawing({ ...drawing, startNodeId: n.id, anchor: nodeAnchor(n) });
                  } else {
                    commitDrawing(n.id, nodeAnchor(n));
                  }
                  return;
                }
                setSelectedNode(n);
                setSelectedEdge(null);
              }}
              onEdgeClick={(evt, e) => {
                if (drawing) return;
                if (evt.altKey || branchMode) {
                  const pos = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
                  splitEdgeAt(e.id, pos.x, pos.y);
                  setBranchMode(false);
                  return;
                }
                setSelectedEdge(e);
                setSelectedNode(null);
              }}
              onPaneClick={(evt) => {
                if (drawing) {
                  const pos = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
                  const ref = drawing.points[drawing.points.length - 1] ?? drawing.anchor;
                  const next = ref ? orthoNext(ref, pos) : { x: snap(pos.x), y: snap(pos.y) };
                  setDrawing({ ...drawing, points: [...drawing.points, next] });
                  return;
                }
                setSelectedNode(null);
                setSelectedEdge(null);
                if (branchMode) setBranchMode(false);
              }}
              onDoubleClick={(evt) => {
                if (!drawingRef.current) return;
                evt.preventDefault();
                const pos = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
                const cur = drawingRef.current;
                const ref = cur.points[cur.points.length - 1] ?? cur.anchor;
                const next = ref ? orthoNext(ref, pos) : { x: snap(pos.x), y: snap(pos.y) };
                setDrawing({ ...cur, points: [...cur.points, next] });
                // commit on next tick after points update
                setTimeout(() => commitDrawing(null, null), 0);
              }}
              fitView
              snapToGrid
              snapGrid={[16, 16]}
              deleteKeyCode={["Delete", "Backspace"]}
              onBeforeDelete={async ({ nodes: ns, edges: es }) => {
                for (const n of ns) deleteNode(n.id);
                for (const e of es) {
                  if (ns.some((n) => n.id === e.source || n.id === e.target)) continue;
                  deleteEdge(e.id);
                }
                return false;
              }}
              className={cn((branchMode || drawing) && "cursor-crosshair")}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>

            {/* Preview do desenho em andamento */}
            {drawing ? (
              <DrawingPreview drawing={drawing} viewport={viewport} orthoNext={orthoNext} />
            ) : null}

            {/* Toolbar flutuante */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-2">
              <Button
                size="sm"
                variant={drawing ? "default" : "secondary"}
                className="pointer-events-auto shadow-md"
                onClick={drawing ? cancelDrawing : startDrawing}
                title={
                  drawing
                    ? "Esc cancela, Enter finaliza"
                    : "Clique para iniciar, depois clique no canvas ou em um equipamento"
                }
              >
                <Spline className="mr-1 h-4 w-4" />
                {drawing ? "Cancelar desenho" : "Nova linha"}
              </Button>
              <Button
                size="sm"
                variant={branchMode ? "default" : "secondary"}
                className="pointer-events-auto shadow-md"
                onClick={() => setBranchMode((v) => !v)}
                title="Clique numa linha para criar um ponto de derivação"
              >
                <GitBranch className="mr-1 h-4 w-4" />
                Ponto de derivação
              </Button>
            </div>
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

function DrawingPreview({
  drawing,
  viewport,
  orthoNext,
}: {
  drawing: {
    points: { x: number; y: number }[];
    cursor: { x: number; y: number } | null;
    startNodeId: string | null;
    anchor: { x: number; y: number } | null;
  };
  viewport: [number, number, number];
  orthoNext: (a: { x: number; y: number }, b: { x: number; y: number }) => { x: number; y: number };
}) {
  const [tx, ty, zoom] = viewport;
  const pts: { x: number; y: number }[] = [];
  if (drawing.anchor) pts.push(drawing.anchor);
  pts.push(...drawing.points);
  if (drawing.cursor) {
    const last = pts[pts.length - 1];
    pts.push(last ? orthoNext(last, drawing.cursor) : drawing.cursor);
  }
  if (pts.length < 1) return null;
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  return (
    <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full">
      <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
        {pts.length >= 2 ? (
          <path
            d={d}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2 / zoom}
            strokeDasharray={`${6 / zoom} ${4 / zoom}`}
          />
        ) : null}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4 / zoom}
            fill={i === pts.length - 1 && drawing.cursor ? "hsl(var(--primary) / 0.4)" : "hsl(var(--primary))"}
          />
        ))}
      </g>
    </svg>
  );
}

