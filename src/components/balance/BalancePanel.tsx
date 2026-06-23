import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { BlockMath, InlineMath } from "react-katex";
import { Badge } from "@/components/ui/badge";
import { EQUIPMENT, type EquipmentType } from "@/lib/thermal/equipment";
import { calculate, systemTotals } from "@/lib/thermal/formulas";
import { fmt, kwToTr } from "@/lib/thermal/units";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function BalancePanel({ nodes }: { nodes: Node[] }) {
  const items = useMemo(() => {
    return nodes.map((n) => {
      const d = n.data as { tipo: EquipmentType; tag: string; parametros: Record<string, unknown> };
      const calc = calculate(d.tipo, d.parametros ?? {});
      return { node: n, tag: d.tag, tipo: d.tipo, calc };
    });
  }, [nodes]);

  const totals = useMemo(() => systemTotals(items.map((i) => i.calc)), [items]);

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Adicione equipamentos no canvas para ver o balanço térmico.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
        <Total label="Σ Q₀ (Capacidade frigorífica)" value={`${fmt(totals.Q_o, 2)} kW`} hint={`${fmt(kwToTr(totals.Q_o), 2)} TR`} />
        <Total label="Σ Q_c (Calor rejeitado)" value={`${fmt(totals.Q_c, 2)} kW`} />
        <Total label="Σ W (Potência compressão)" value={`${fmt(totals.W, 2)} kW`} />
        <div className="ml-auto flex items-center gap-2">
          {totals.dentroTolerancia ? (
            <Badge variant="default" className="gap-1 bg-success text-success-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Balanço OK ({fmt(totals.desvioPct, 2)}%)
            </Badge>
          ) : (
            <Badge variant="default" className="gap-1 bg-warning text-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              Desvio {fmt(totals.desvioPct, 2)}%
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Resíduo r = {fmt(totals.residuo, 2)} kW (tol. ±5%)
          </span>
        </div>
      </div>
      <div className="overflow-y-auto p-3">
        <div className="mb-3 rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Verificação de balanço de energia
          </div>
          <BlockMath math={`Q_c \\approx Q_o + W \\;\\Rightarrow\\; ${fmt(totals.Q_c, 2)} \\approx ${fmt(totals.Q_o, 2)} + ${fmt(totals.W, 2)} \\;=\\; ${fmt(totals.Q_o + totals.W, 2)}\\ \\mathrm{kW}`} />
        </div>
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-2">Componente</th>
              <th className="px-2">Fórmula</th>
              <th className="px-2">Substituição</th>
              <th className="px-2 text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ node, tag, tipo, calc }) => {
              const def = EQUIPMENT[tipo];
              if (calc.missing.length > 0 && calc.rows.length === 0) {
                return (
                  <tr key={node.id} className="bg-card">
                    <td className="rounded-l-md px-2 py-2 align-top">
                      <div className="font-mono text-sm font-semibold">{tag}</div>
                      <div className="text-xs text-muted-foreground">{def.label}</div>
                    </td>
                    <td colSpan={3} className="rounded-r-md px-2 py-2 align-top">
                      <div className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Dados Insuficientes</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Faltam: {calc.missing.join(", ")}
                      </div>
                    </td>
                  </tr>
                );
              }
              return calc.rows.map((r, idx) => (
                <tr key={`${node.id}-${idx}`} className="bg-card">
                  {idx === 0 ? (
                    <td
                      rowSpan={calc.rows.length}
                      className="rounded-l-md px-2 py-2 align-top"
                    >
                      <div className="font-mono text-sm font-semibold">{tag}</div>
                      <div className="text-xs text-muted-foreground">{def.label}</div>
                      {calc.missing.length > 0 && (
                        <div className="mt-1 text-[11px] text-warning">
                          Faltam: {calc.missing.join(", ")}
                        </div>
                      )}
                    </td>
                  ) : null}
                  <td className="px-2 py-2 align-top text-sm">
                    <div className="text-xs text-muted-foreground">{r.label}</div>
                    <InlineMath math={r.symbolic} />
                  </td>
                  <td className="px-2 py-2 align-top text-sm">
                    <InlineMath math={r.substituted} />
                  </td>
                  <td
                    className={
                      "rounded-r-md px-2 py-2 text-right align-top font-mono text-sm font-semibold text-primary"
                    }
                  >
                    {r.resultado} <span className="text-xs text-muted-foreground">{r.unidade}</span>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Total({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold text-primary">
        {value} {hint && <span className="ml-1 text-xs text-muted-foreground">({hint})</span>}
      </div>
    </div>
  );
}
