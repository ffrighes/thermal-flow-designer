// Conversões de unidades de engenharia
export const KW_PER_TR = 3.517;
export const ATM_BAR = 1.013;

export const kwToTr = (kw: number) => kw / KW_PER_TR;
export const trToKw = (tr: number) => tr * KW_PER_TR;
export const barManToAbs = (man: number) => man + ATM_BAR;
export const barAbsToMan = (abs: number) => abs - ATM_BAR;
export const barToKPa = (bar: number) => bar * 100;
export const mmToM = (mm: number) => mm / 1000;
export const mToMm = (m: number) => m * 1000;
export const kghToKgs = (kgh: number) => kgh / 3600;
export const m3hToM3s = (m3h: number) => m3h / 3600;

export function fmt(value: number | undefined | null, digits = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return "∞";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
