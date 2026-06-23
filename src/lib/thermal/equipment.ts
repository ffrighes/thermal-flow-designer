// Catálogo de equipamentos: metadados, campos e unidades
import type { LucideIcon } from "lucide-react";
import {
  Wind,
  Flame,
  Snowflake,
  Container,
  Database,
  Thermometer,
  Layers,
  Gauge,
  Fan,
} from "lucide-react";

export type EquipmentType =
  | "compressor"
  | "condensador"
  | "evaporador"
  | "separador_liquido"
  | "deposito_liquido"
  | "chiller"
  | "tanque_termoacumulacao"
  | "trocador_placas"
  | "uta";

export type FieldType = "number" | "select" | "text";

export interface FieldDef {
  key: string;
  label: string;
  unit?: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface EquipmentDef {
  type: EquipmentType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  fields: FieldDef[];
}

const pressureField = (key: string, label: string): FieldDef[] => [
  { key, label, unit: "bar", type: "number" },
  {
    key: `${key}_base`,
    label: `${label} — referência`,
    type: "select",
    options: [
      { value: "abs", label: "bar (a) — absoluta" },
      { value: "man", label: "bar (g) — manométrica" },
    ],
    help: "P_abs = P_man + 1,013 bar",
  },
];

export const EQUIPMENT: Record<EquipmentType, EquipmentDef> = {
  compressor: {
    type: "compressor",
    label: "Compressor",
    shortLabel: "CP",
    icon: Wind,
    fields: [
      ...pressureField("p_suc", "Pressão de sucção"),
      ...pressureField("p_desc", "Pressão de descarga"),
      { key: "t_suc", label: "Temperatura de sucção", unit: "°C", type: "number" },
      { key: "t_desc", label: "Temperatura de descarga", unit: "°C", type: "number" },
      { key: "h_suc", label: "Entalpia de sucção", unit: "kJ/kg", type: "number" },
      { key: "h_desc", label: "Entalpia de descarga", unit: "kJ/kg", type: "number" },
      { key: "m_dot", label: "Vazão mássica", unit: "kg/h", type: "number" },
      { key: "eta_vol", label: "Eficiência volumétrica", unit: "%", type: "number" },
      { key: "eta_isen", label: "Eficiência isentrópica", unit: "%", type: "number" },
      { key: "w_dec", label: "Potência absorvida (medida)", unit: "kW", type: "number" },
    ],
  },
  condensador: {
    type: "condensador",
    label: "Condensador",
    shortLabel: "CD",
    icon: Flame,
    fields: [
      { key: "t_cond", label: "Temperatura de condensação", unit: "°C", type: "number" },
      ...pressureField("p_cond", "Pressão de condensação"),
      { key: "h_ent", label: "Entalpia de entrada", unit: "kJ/kg", type: "number" },
      { key: "h_sai", label: "Entalpia de saída", unit: "kJ/kg", type: "number" },
      { key: "m_dot", label: "Vazão mássica", unit: "kg/h", type: "number" },
    ],
  },
  evaporador: {
    type: "evaporador",
    label: "Evaporador",
    shortLabel: "EV",
    icon: Snowflake,
    fields: [
      { key: "t_ev", label: "Temperatura de evaporação", unit: "°C", type: "number" },
      ...pressureField("p_ev", "Pressão de evaporação"),
      { key: "h_ent", label: "Entalpia de entrada", unit: "kJ/kg", type: "number" },
      { key: "h_sai", label: "Entalpia de saída", unit: "kJ/kg", type: "number" },
      { key: "m_dot", label: "Vazão mássica", unit: "kg/h", type: "number" },
    ],
  },
  separador_liquido: {
    type: "separador_liquido",
    label: "Separador de Líquido",
    shortLabel: "SL",
    icon: Container,
    fields: [
      ...pressureField("p_op", "Pressão de operação"),
      { key: "t_op", label: "Temperatura", unit: "°C", type: "number" },
      { key: "recirc", label: "Taxa de recirculação (n:1)", type: "number" },
      { key: "m_liq", label: "Vazão de líquido", unit: "kg/h", type: "number" },
      { key: "m_vap", label: "Vazão de vapor", unit: "kg/h", type: "number" },
    ],
  },
  deposito_liquido: {
    type: "deposito_liquido",
    label: "Depósito de Líquido",
    shortLabel: "DL",
    icon: Database,
    fields: [
      ...pressureField("p_op", "Pressão de operação"),
      { key: "volume", label: "Volume", unit: "m³", type: "number" },
      { key: "t_liq", label: "Temperatura do líquido", unit: "°C", type: "number" },
      { key: "nivel", label: "Nível", unit: "%", type: "number" },
    ],
  },
  chiller: {
    type: "chiller",
    label: "Chiller",
    shortLabel: "CH",
    icon: Thermometer,
    fields: [
      { key: "q", label: "Capacidade (declarada)", unit: "kW", type: "number" },
      { key: "t_ent_sec", label: "T entrada secundário", unit: "°C", type: "number" },
      { key: "t_sai_sec", label: "T saída secundário", unit: "°C", type: "number" },
      { key: "vazao_sec", label: "Vazão volumétrica secundário", unit: "m³/h", type: "number" },
      { key: "cp_sec", label: "cp do secundário", unit: "kJ/kg·K", type: "number" },
      { key: "rho_sec", label: "ρ do secundário", unit: "kg/m³", type: "number" },
      { key: "fluido_sec", label: "Fluido secundário", type: "text" },
    ],
  },
  tanque_termoacumulacao: {
    type: "tanque_termoacumulacao",
    label: "Tanque de Termoacumulação",
    shortLabel: "TA",
    icon: Layers,
    fields: [
      { key: "energia", label: "Energia armazenada", unit: "kWh", type: "number" },
      { key: "volume", label: "Volume", unit: "m³", type: "number" },
      { key: "t_carga", label: "Temperatura de carga", unit: "°C", type: "number" },
      { key: "t_desc", label: "Temperatura de descarga", unit: "°C", type: "number" },
      {
        key: "meio",
        label: "Meio de acumulação",
        type: "select",
        options: [
          { value: "agua", label: "Água" },
          { value: "gelo", label: "Gelo" },
          { value: "pcm", label: "PCM" },
        ],
      },
    ],
  },
  trocador_placas: {
    type: "trocador_placas",
    label: "Trocador a Placas",
    shortLabel: "TP",
    icon: Gauge,
    fields: [
      { key: "q", label: "Carga térmica (declarada)", unit: "kW", type: "number" },
      { key: "t_q_ent", label: "T quente entrada", unit: "°C", type: "number" },
      { key: "t_q_sai", label: "T quente saída", unit: "°C", type: "number" },
      { key: "t_f_ent", label: "T fria entrada", unit: "°C", type: "number" },
      { key: "t_f_sai", label: "T fria saída", unit: "°C", type: "number" },
      { key: "vazao_q", label: "Vazão lado quente", unit: "m³/h", type: "number" },
      { key: "vazao_f", label: "Vazão lado frio", unit: "m³/h", type: "number" },
      { key: "cp_q", label: "cp lado quente", unit: "kJ/kg·K", type: "number" },
      { key: "cp_f", label: "cp lado frio", unit: "kJ/kg·K", type: "number" },
      { key: "rho_q", label: "ρ lado quente", unit: "kg/m³", type: "number" },
      { key: "rho_f", label: "ρ lado frio", unit: "kg/m³", type: "number" },
      { key: "u", label: "Coef. global U", unit: "W/m²·K", type: "number" },
      { key: "area", label: "Área", unit: "m²", type: "number" },
      { key: "lmtd", label: "LMTD", unit: "°C", type: "number" },
    ],
  },
  uta: {
    type: "uta",
    label: "Unidade de Tratamento de Ar (UTA)",
    shortLabel: "UTA",
    icon: Fan,
    fields: [
      { key: "vazao_ar", label: "Vazão de ar", unit: "m³/h", type: "number" },
      { key: "t_insufl", label: "T de insuflamento", unit: "°C", type: "number" },
      { key: "t_retorno", label: "T de retorno", unit: "°C", type: "number" },
      { key: "q_serp", label: "Carga da serpentina", unit: "kW", type: "number" },
      { key: "q_sens", label: "Parcela sensível", unit: "kW", type: "number" },
      { key: "q_lat", label: "Parcela latente", unit: "kW", type: "number" },
    ],
  },
};

export const EQUIPMENT_LIST = Object.values(EQUIPMENT);

export interface PipeParams {
  diametro_mm?: number;
  comprimento_mm?: number;
  fluido?: "nh3" | "secundario" | "ar";
  velocidade?: number;
  perda_dt?: number;
  tag?: string;
}

export const PIPE_MATERIALS = [
  { value: "aco_carbono", label: "Aço Carbono" },
  { value: "inox", label: "Aço Inoxidável" },
] as const;

export const PIPE_FLUIDS = [
  { value: "nh3", label: "Refrigerante NH₃" },
  { value: "secundario", label: "Fluido secundário" },
  { value: "ar", label: "Ar" },
] as const;
