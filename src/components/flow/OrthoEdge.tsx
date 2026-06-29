import { useEffect, useRef } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

const SNAP = 16;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

type Pt = { x: number; y: number };
type Axis = "h" | "v";
type EdgeData = {
  material?: string;
  tag?: string;
  waypoints?: Pt[];
  startAxis?: Axis;
  endAxis?: Axis;
};

function simplify(points: Pt[]): Pt[] {
  // Mantém pontos cujas duas arestas adjacentes não são colineares.
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    const next = points[i + 1];
    const collinearH = prev.y === cur.y && cur.y === next.y;
    const collinearV = prev.x === cur.x && cur.x === next.x;
    if (collinearH || collinearV) continue;
    out.push(cur);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function OrthoEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  label,
  markerEnd,
  style,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const d = (data ?? {}) as EdgeData;

  // Inicialização: cria waypoints default em formato de "cotovelo".
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!d.waypoints || d.waypoints.length === 0 || !d.startAxis || !d.endAxis) {
      const wp: Pt[] = [{ x: snap(targetX), y: snap(sourceY) }];
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id
            ? {
                ...e,
                data: {
                  ...(e.data ?? {}),
                  waypoints: wp,
                  startAxis: "h",
                  endAxis: "v",
                },
              }
            : e,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAxis: Axis = d.startAxis ?? "h";
  const endAxis: Axis = d.endAxis ?? "v";
  const storedWp = d.waypoints && d.waypoints.length > 0
    ? d.waypoints.map((p) => ({ ...p }))
    : [{ x: targetX, y: sourceY }];

  // Auto-alinha primeiro/último waypoint para manter ortogonalidade com nós que podem ter movido.
  const wp = storedWp.map((p) => ({ ...p }));
  if (startAxis === "h") wp[0].y = sourceY;
  else wp[0].x = sourceX;
  const last = wp.length - 1;
  if (endAxis === "h") wp[last].y = targetY;
  else wp[last].x = targetX;

  const points: Pt[] = [
    { x: sourceX, y: sourceY },
    ...wp,
    { x: targetX, y: targetY },
  ];

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  function handleSegmentDrag(
    segIdx: number,
    orient: Axis,
    e: React.PointerEvent,
  ) {
    e.stopPropagation();
    e.preventDefault();
    const startFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const baseWp = wp.map((p) => ({ ...p }));
    const baseStart = startAxis;
    const baseEnd = endAxis;
    const baseSrc = { x: sourceX, y: sourceY };
    const baseTgt = { x: targetX, y: targetY };

    function compute(delta: number) {
      const working = baseWp.map((p) => ({ ...p }));
      let i = segIdx;
      let sAxis: Axis = baseStart;
      let eAxis: Axis = baseEnd;
      const touchesSrc = i === 0;
      // após possível unshift, ainda referenciamos o segmento atual via i
      const touchesTgt = i === baseWp.length;

      if (touchesSrc) {
        const newP: Pt =
          orient === "h"
            ? { x: baseSrc.x, y: snap(baseSrc.y + delta) }
            : { x: snap(baseSrc.x + delta), y: baseSrc.y };
        working.unshift(newP);
        // novo primeiro segmento (src → newP) tem orientação perpendicular a `orient`
        sAxis = orient === "h" ? "v" : "h";
        i = 1;
      }
      if (touchesTgt) {
        const newP: Pt =
          orient === "h"
            ? { x: baseTgt.x, y: snap(baseTgt.y + delta) }
            : { x: snap(baseTgt.x + delta), y: baseTgt.y };
        working.push(newP);
        eAxis = orient === "h" ? "v" : "h";
      }

      const a = working[i - 1];
      const b = working[i];
      if (orient === "h") {
        working[i - 1] = { ...a, y: snap(a.y + delta) };
        working[i] = { ...b, y: snap(b.y + delta) };
      } else {
        working[i - 1] = { ...a, x: snap(a.x + delta) };
        working[i] = { ...b, x: snap(b.x + delta) };
      }
      return { wp: working, startAxis: sAxis, endAxis: eAxis };
    }

    function onMove(ev: PointerEvent) {
      const cur = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const delta = orient === "h" ? cur.y - startFlow.y : cur.x - startFlow.x;
      const { wp: nw, startAxis: sa, endAxis: ea } = compute(delta);
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id
            ? {
                ...e,
                data: {
                  ...(e.data ?? {}),
                  waypoints: nw,
                  startAxis: sa,
                  endAxis: ea,
                },
              }
            : e,
        ),
      );
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Simplifica: remove waypoints redundantes (colineares)
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== id) return e;
          const cd = (e.data ?? {}) as EdgeData;
          const wpCur = cd.waypoints ?? [];
          const pts: Pt[] = [
            { x: baseSrc.x, y: baseSrc.y },
            ...wpCur,
            { x: baseTgt.x, y: baseTgt.y },
          ];
          const simp = simplify(pts);
          const newWp = simp.slice(1, -1);
          return {
            ...e,
            data: { ...(e.data ?? {}), waypoints: newWp },
          };
        }),
      );
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const stroke = selected ? "hsl(var(--primary))" : "hsl(var(--foreground))";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{ stroke, strokeWidth: 2, ...style }}
      />
      <EdgeLabelRenderer>
        {points.slice(0, -1).map((p, i) => {
          const q = points[i + 1];
          const orient: Axis = p.y === q.y ? "h" : "v";
          const mx = (p.x + q.x) / 2;
          const my = (p.y + q.y) / 2;
          const len = orient === "h" ? Math.abs(q.x - p.x) : Math.abs(q.y - p.y);
          if (len < 8) return null;
          return (
            <div
              key={i}
              className="nodrag nopan pointer-events-auto absolute"
              style={{
                transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`,
                width: orient === "h" ? 28 : 10,
                height: orient === "h" ? 10 : 28,
                background: selected
                  ? "hsl(var(--primary) / 0.7)"
                  : "hsl(var(--primary) / 0.25)",
                borderRadius: 3,
                cursor: orient === "h" ? "ns-resize" : "ew-resize",
              }}
              onPointerDown={(e) => handleSegmentDrag(i, orient, e)}
              title={orient === "h" ? "Arraste verticalmente" : "Arraste horizontalmente"}
            />
          );
        })}
        {label ? (
          <div
            className="pointer-events-none absolute rounded border border-border bg-card px-1.5 py-0.5 text-xs font-mono shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2 - 14}px)`,
            }}
          >
            {label as string}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}
