// Motor de cálculo — para cada equipamento devolve fórmulas e resultado
import { fmt, kwToTr, barManToAbs, m3hToM3s } from "./units";
import type { EquipmentType } from "./equipment";

export interface CalcRow {
  label: string;
  symbolic: string; // LaTeX
  substituted: string; // LaTeX
  resultado?: string;
  unidade?: string;
}

export interface CalcResult {
  rows: CalcRow[];
  missing: string[];
  q_o?: number; // capacidade frigorífica kW (evaporador)
  q_c?: number; // calor rejeitado kW (condensador)
  w?: number; // potência compressor kW
}

type Params = Record<string, unknown>;

function num(p: Params, key: string): number | undefined {
  const v = p[key];
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pAbs(p: Params, key: string): number | undefined {
  const v = num(p, key);
  if (v === undefined) return undefined;
  return p[`${key}_base`] === "man" ? barManToAbs(v) : v;
}

export function calculate(tipo: EquipmentType, p: Params, label = ""): CalcResult {
  const missing: string[] = [];
  const need = (key: string, lbl: string) => {
    const v = num(p, key);
    if (v === undefined) missing.push(lbl);
    return v;
  };
  const rows: CalcRow[] = [];

  switch (tipo) {
    case "compressor": {
      const m = need("m_dot", "Vazão mássica");
      const h1 = need("h_suc", "h sucção");
      const h2 = need("h_desc", "h descarga");
      const pSuc = pAbs(p, "p_suc");
      const pDesc = pAbs(p, "p_desc");
      if (pSuc !== undefined)
        rows.push({
          label: "Pressão de sucção (absoluta)",
          symbolic: "P_{suc,abs}",
          substituted: `${fmt(pSuc, 3)}\\ \\mathrm{bar\\,a}`,
          resultado: fmt(pSuc, 3),
          unidade: "bar a",
        });
      if (pDesc !== undefined)
        rows.push({
          label: "Pressão de descarga (absoluta)",
          symbolic: "P_{desc,abs}",
          substituted: `${fmt(pDesc, 3)}\\ \\mathrm{bar\\,a}`,
          resultado: fmt(pDesc, 3),
          unidade: "bar a",
        });
      if (m !== undefined && h1 !== undefined && h2 !== undefined) {
        const w = (m / 3600) * (h2 - h1);
        rows.push({
          label: "Potência de compressão",
          symbolic: "W = \\dot{m}\\,(h_{desc} - h_{suc})",
          substituted: `W = \\frac{${fmt(m, 0)}}{3600}\\,(${fmt(h2, 1)} - ${fmt(h1, 1)}) = ${fmt(w, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(w, 2),
          unidade: "kW",
        });
        return { rows, missing, w };
      }
      return { rows, missing };
    }
    case "condensador": {
      const m = need("m_dot", "Vazão mássica");
      const h1 = need("h_ent", "h entrada");
      const h2 = need("h_sai", "h saída");
      if (m !== undefined && h1 !== undefined && h2 !== undefined) {
        const q = (m / 3600) * (h1 - h2);
        rows.push({
          label: "Calor rejeitado",
          symbolic: "Q_c = \\dot{m}\\,(h_{ent} - h_{sai})",
          substituted: `Q_c = \\frac{${fmt(m, 0)}}{3600}\\,(${fmt(h1, 1)} - ${fmt(h2, 1)}) = ${fmt(q, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(q, 2),
          unidade: "kW",
        });
        return { rows, missing, q_c: q };
      }
      return { rows, missing };
    }
    case "evaporador": {
      const m = need("m_dot", "Vazão mássica");
      const h1 = need("h_ent", "h entrada");
      const h2 = need("h_sai", "h saída");
      if (m !== undefined && h1 !== undefined && h2 !== undefined) {
        const q = (m / 3600) * (h2 - h1);
        rows.push({
          label: "Capacidade frigorífica",
          symbolic: "Q_o = \\dot{m}\\,(h_{sai} - h_{ent})",
          substituted: `Q_o = \\frac{${fmt(m, 0)}}{3600}\\,(${fmt(h2, 1)} - ${fmt(h1, 1)}) = ${fmt(q, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(q, 2),
          unidade: "kW",
        });
        rows.push({
          label: "Capacidade em TR",
          symbolic: "Q_o[\\mathrm{TR}] = Q_o / 3{,}517",
          substituted: `${fmt(q, 2)} / 3{,}517 = ${fmt(kwToTr(q), 2)}\\ \\mathrm{TR}`,
          resultado: fmt(kwToTr(q), 2),
          unidade: "TR",
        });
        return { rows, missing, q_o: q };
      }
      return { rows, missing };
    }
    case "chiller": {
      const dt_ent = need("t_ent_sec", "T entrada secundário");
      const dt_sai = need("t_sai_sec", "T saída secundário");
      const vaz = need("vazao_sec", "Vazão secundário");
      const cp = need("cp_sec", "cp secundário");
      const rho = need("rho_sec", "ρ secundário");
      if (
        dt_ent !== undefined &&
        dt_sai !== undefined &&
        vaz !== undefined &&
        cp !== undefined &&
        rho !== undefined
      ) {
        const m_dot = m3hToM3s(vaz) * rho; // kg/s
        const dt = dt_ent - dt_sai;
        const q = m_dot * cp * dt;
        rows.push({
          label: "Vazão mássica secundário",
          symbolic: "\\dot{m} = \\dot{V}\\,\\rho",
          substituted: `\\dot{m} = \\frac{${fmt(vaz, 2)}}{3600}\\,\\cdot ${fmt(rho, 1)} = ${fmt(m_dot, 3)}\\ \\mathrm{kg/s}`,
          resultado: fmt(m_dot, 3),
          unidade: "kg/s",
        });
        rows.push({
          label: "Capacidade frigorífica",
          symbolic: "Q = \\dot{m}\\,c_p\\,\\Delta T",
          substituted: `Q = ${fmt(m_dot, 3)}\\,\\cdot ${fmt(cp, 2)}\\,\\cdot (${fmt(dt_ent, 2)} - ${fmt(dt_sai, 2)}) = ${fmt(q, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(q, 2),
          unidade: "kW",
        });
        rows.push({
          label: "Capacidade em TR",
          symbolic: "Q[\\mathrm{TR}] = Q / 3{,}517",
          substituted: `${fmt(q, 2)} / 3{,}517 = ${fmt(kwToTr(q), 2)}\\ \\mathrm{TR}`,
          resultado: fmt(kwToTr(q), 2),
          unidade: "TR",
        });
        return { rows, missing, q_o: q };
      }
      return { rows, missing };
    }
    case "trocador_placas": {
      const tqe = need("t_q_ent", "T quente entrada");
      const tqs = need("t_q_sai", "T quente saída");
      const tfe = need("t_f_ent", "T fria entrada");
      const tfs = need("t_f_sai", "T fria saída");
      const vq = need("vazao_q", "Vazão quente");
      const cpq = need("cp_q", "cp quente");
      const rhoq = need("rho_q", "ρ quente");
      const U = num(p, "u");
      const A = num(p, "area");
      const lmtd = num(p, "lmtd");
      if (
        tqe !== undefined &&
        tqs !== undefined &&
        vq !== undefined &&
        cpq !== undefined &&
        rhoq !== undefined
      ) {
        const m_dot = m3hToM3s(vq) * rhoq;
        const dt = tqe - tqs;
        const q = m_dot * cpq * dt;
        rows.push({
          label: "Q pelo lado quente",
          symbolic: "Q = \\dot{m}\\,c_p\\,\\Delta T",
          substituted: `Q = \\frac{${fmt(vq, 2)}}{3600}\\,\\cdot ${fmt(rhoq, 1)}\\,\\cdot ${fmt(cpq, 2)}\\,\\cdot (${fmt(tqe, 2)} - ${fmt(tqs, 2)}) = ${fmt(q, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(q, 2),
          unidade: "kW",
        });
      }
      if (U !== undefined && A !== undefined && lmtd !== undefined) {
        const q2 = (U * A * lmtd) / 1000;
        rows.push({
          label: "Q por U·A·LMTD",
          symbolic: "Q = U\\,A\\,\\Delta T_{ml}",
          substituted: `Q = ${fmt(U, 1)}\\,\\cdot ${fmt(A, 2)}\\,\\cdot ${fmt(lmtd, 2)} / 1000 = ${fmt(q2, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(q2, 2),
          unidade: "kW",
        });
      }
      // checagens cruzadas
      if (tfe !== undefined && tfs !== undefined) {
        rows.push({
          label: "ΔT lado frio",
          symbolic: "\\Delta T_f = T_{f,sai} - T_{f,ent}",
          substituted: `${fmt(tfs, 2)} - ${fmt(tfe, 2)} = ${fmt(tfs - tfe, 2)}\\ \\mathrm{°C}`,
          resultado: fmt(tfs - tfe, 2),
          unidade: "°C",
        });
      }
      return { rows, missing };
    }
    case "uta": {
      const v = need("vazao_ar", "Vazão de ar");
      const ti = need("t_insufl", "T insuflamento");
      const tr = need("t_retorno", "T retorno");
      if (v !== undefined && ti !== undefined && tr !== undefined) {
        // Q_sens = ρ_ar·cp_ar·V̇·ΔT  (1,2 kg/m³ · 1,005 kJ/kg·K)
        const m_dot = m3hToM3s(v) * 1.2;
        const qs = m_dot * 1.005 * (tr - ti);
        rows.push({
          label: "Carga sensível estimada",
          symbolic: "Q_{sens} = \\rho\\,c_p\\,\\dot{V}\\,(T_{ret} - T_{ins})",
          substituted: `Q_{sens} = 1{,}2\\,\\cdot 1{,}005\\,\\cdot \\frac{${fmt(v, 0)}}{3600}\\,\\cdot (${fmt(tr, 2)} - ${fmt(ti, 2)}) = ${fmt(qs, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(qs, 2),
          unidade: "kW",
        });
      }
      const qSerp = num(p, "q_serp");
      if (qSerp !== undefined) {
        rows.push({
          label: "Carga total da serpentina (informada)",
          symbolic: "Q_{serp}",
          substituted: `${fmt(qSerp, 2)}\\ \\mathrm{kW}`,
          resultado: fmt(qSerp, 2),
          unidade: "kW",
        });
      }
      return { rows, missing };
    }
    case "tanque_termoacumulacao": {
      const E = num(p, "energia");
      const V = num(p, "volume");
      if (E !== undefined)
        rows.push({
          label: "Energia armazenada",
          symbolic: "E",
          substituted: `${fmt(E, 2)}\\ \\mathrm{kWh}`,
          resultado: fmt(E, 2),
          unidade: "kWh",
        });
      if (V !== undefined)
        rows.push({
          label: "Volume",
          symbolic: "V",
          substituted: `${fmt(V, 2)}\\ \\mathrm{m^3}`,
          resultado: fmt(V, 2),
          unidade: "m³",
        });
      if (E === undefined && V === undefined) missing.push("Energia ou volume");
      return { rows, missing };
    }
    case "separador_liquido":
    case "deposito_liquido": {
      const pop = pAbs(p, "p_op");
      if (pop !== undefined)
        rows.push({
          label: "Pressão de operação (absoluta)",
          symbolic: "P_{op,abs}",
          substituted: `${fmt(pop, 3)}\\ \\mathrm{bar\\,a}`,
          resultado: fmt(pop, 3),
          unidade: "bar a",
        });
      else missing.push("Pressão de operação");
      return { rows, missing };
    }
  }
  return { rows, missing };
}

export interface SystemTotals {
  Q_o: number;
  Q_c: number;
  W: number;
  residuo: number;
  desvioPct: number;
  dentroTolerancia: boolean;
}

export function systemTotals(results: CalcResult[]): SystemTotals {
  let Q_o = 0;
  let Q_c = 0;
  let W = 0;
  for (const r of results) {
    if (r.q_o) Q_o += r.q_o;
    if (r.q_c) Q_c += r.q_c;
    if (r.w) W += r.w;
  }
  const residuo = Q_c - (Q_o + W);
  const denom = Math.max(Math.abs(Q_c), 1e-6);
  const desvioPct = (Math.abs(residuo) / denom) * 100;
  return {
    Q_o,
    Q_c,
    W,
    residuo,
    desvioPct,
    dentroTolerancia: Q_c === 0 ? true : desvioPct <= 5,
  };
}
