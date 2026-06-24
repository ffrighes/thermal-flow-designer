// Catálogo de equipamentos: apenas metadados visuais (sem parâmetros termodinâmicos)
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

export interface EquipmentDef {
  type: EquipmentType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const EQUIPMENT: Record<EquipmentType, EquipmentDef> = {
  compressor: { type: "compressor", label: "Compressor", shortLabel: "CP", icon: Wind },
  condensador: { type: "condensador", label: "Condensador", shortLabel: "CD", icon: Flame },
  evaporador: { type: "evaporador", label: "Evaporador", shortLabel: "EV", icon: Snowflake },
  separador_liquido: { type: "separador_liquido", label: "Separador de Líquido", shortLabel: "SL", icon: Container },
  deposito_liquido: { type: "deposito_liquido", label: "Depósito de Líquido", shortLabel: "DL", icon: Database },
  chiller: { type: "chiller", label: "Chiller", shortLabel: "CH", icon: Thermometer },
  tanque_termoacumulacao: { type: "tanque_termoacumulacao", label: "Tanque de Termoacumulação", shortLabel: "TA", icon: Layers },
  trocador_placas: { type: "trocador_placas", label: "Trocador a Placas", shortLabel: "TP", icon: Gauge },
  uta: { type: "uta", label: "Unidade de Tratamento de Ar (UTA)", shortLabel: "UTA", icon: Fan },
};

export const EQUIPMENT_LIST = Object.values(EQUIPMENT);
