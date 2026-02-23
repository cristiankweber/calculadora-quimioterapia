/**
 * Módulo de Hidratação e Suporte Clínico
 *
 * Implementa cálculos baseados em guidelines:
 * - Hidratação: ESMO/NVMO Cisplatin Hydration 2024, BC Cancer, eviQ
 * - Eletrólitos: VUMC Electrolyte Replacement, MEGA Protocol
 * - Transfusão: AABB 2023 Guidelines, NCCN Hematology
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface HydrationInput {
  weight: number; // kg
  bsa: number; // m²
  egfr: number; // mL/min/1.73m²
  protocolName: string;
  hasCardiacDisease: boolean;
  hasRenalImpairment: boolean; // eGFR < 60
  cisplatinDose?: number; // mg/m² (se aplicável)
}

export interface HydrationScheme {
  phase: "pre" | "concurrent" | "post";
  phaseLabel: string;
  solution: string;
  volume: number; // mL
  rate: number; // mL/h
  duration: number; // horas
  additives?: string[];
  notes?: string[];
}

export interface HydrationResult {
  protocolType: "cisplatin_high" | "cisplatin_low" | "methotrexate_hd" | "ifosfamide" | "cyclophosphamide_hd" | "standard" | "none";
  protocolLabel: string;
  totalVolume: number; // mL total
  schemes: HydrationScheme[];
  alerts: HydrationAlert[];
  monitoring: string[];
}

export interface HydrationAlert {
  type: "warning" | "danger" | "info";
  message: string;
}

export interface ElectrolyteInput {
  weight: number; // kg
  sodium?: number; // mEq/L (135-145)
  potassium?: number; // mEq/L (3.5-5.5)
  magnesium?: number; // mg/dL (1.8-2.4)
  calciumIonized?: number; // mmol/L (1.15-1.35)
  phosphorus?: number; // mg/dL (2.5-4.5)
  egfr: number;
  hasCardiacDisease: boolean;
}

export interface ElectrolyteReplacement {
  electrolyte: string;
  currentValue: number;
  normalRange: string;
  unit: string;
  status: "critical" | "low" | "normal" | "high" | "critical_high";
  statusLabel: string;
  replacements: ReplacementOption[];
  alerts: string[];
  monitoring: string[];
}

export interface ReplacementOption {
  solution: string;
  dose: string;
  volume: string;
  route: string;
  rate: string;
  duration: string;
  frequency: string;
  notes?: string;
}

export interface TransfusionInput {
  weight: number; // kg
  hemoglobin?: number; // g/dL
  hematocrit?: number; // %
  platelets?: number; // /mm³ ou x10³/µL
  isBleeding: boolean;
  isPreProcedure: boolean;
  isBMT: boolean; // transplante de medula
  isImmunosuppressed: boolean;
  hasFever: boolean;
}

export interface TransfusionRecommendation {
  product: string;
  productLabel: string;
  indicated: boolean;
  urgency: "immediate" | "routine" | "not_indicated";
  urgencyLabel: string;
  currentValue: number;
  threshold: number;
  unit: string;
  volume: string;
  expectedIncrement: string;
  specialRequirements: string[];
  premedication: string[];
  alerts: string[];
  monitoring: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIDRATAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/** Protocolos que requerem hidratação especial */
const NEPHROTOXIC_PROTOCOLS: Record<string, string> = {
  // Cisplatina
  "cisplatin": "cisplatin_high",
  "dhap": "cisplatin_high",
  "r-dhap": "cisplatin_high",
  "eshap": "cisplatin_high",
  "ice": "cisplatin_high",
  "r-ice": "cisplatin_high",
  "bep": "cisplatin_high",
  "ep": "cisplatin_high",
  // Metotrexato alta dose
  "hd-mtx": "methotrexate_hd",
  "hyper-cvad parte b": "methotrexate_hd",
  "hyper-cvad b": "methotrexate_hd",
  // Ifosfamida
  "ifosfamide": "ifosfamide",
  "flag-ida": "ifosfamide",
  // Ciclofosfamida alta dose
  "cyclophosphamide_hd": "cyclophosphamide_hd",
  "hyper-cvad parte a": "cyclophosphamide_hd",
  "hyper-cvad a": "cyclophosphamide_hd",
};

function detectProtocolType(protocolName: string): HydrationResult["protocolType"] {
  const lower = protocolName.toLowerCase().trim();

  // Cisplatina
  if (lower.includes("cisplatin") || lower.includes("dhap") || lower.includes("eshap") || lower.includes("bep")) {
    return "cisplatin_high";
  }
  if (lower.includes("r-dhap") || lower.includes("r-ice")) {
    return "cisplatin_high";
  }

  // Metotrexato alta dose
  if (lower.includes("hd-mtx") || lower.includes("metotrexato alta dose") ||
      (lower.includes("hyper-cvad") && lower.includes("b"))) {
    return "methotrexate_hd";
  }

  // Ifosfamida
  if (lower.includes("ifosfamid") || lower.includes("flag-ida")) {
    return "ifosfamide";
  }

  // Ciclofosfamida alta dose (>1g/m²)
  if ((lower.includes("hyper-cvad") && lower.includes("a")) ||
      lower.includes("ciclofosfamida alta dose")) {
    return "cyclophosphamide_hd";
  }

  // Protocolos com risco moderado
  if (lower.includes("carboplatina") || lower.includes("carboplatin") ||
      lower.includes("r-chop") || lower.includes("abvd") ||
      lower.includes("da-r-epoch")) {
    return "standard";
  }

  return "none";
}

const PROTOCOL_LABELS: Record<string, string> = {
  cisplatin_high: "Cisplatina (Nefrotóxico - Hidratação Intensiva)",
  cisplatin_low: "Cisplatina Dose Baixa (≤40 mg/m²)",
  methotrexate_hd: "Metotrexato Alta Dose (Alcalinização + Hiper-hidratação)",
  ifosfamide: "Ifosfamida (Prevenção de Cistite Hemorrágica)",
  cyclophosphamide_hd: "Ciclofosfamida Alta Dose (Prevenção de Cistite)",
  standard: "Hidratação Padrão",
  none: "Sem Hidratação Especial Necessária",
};

export function calculateHydration(input: HydrationInput): HydrationResult {
  const type = detectProtocolType(input.protocolName);
  const alerts: HydrationAlert[] = [];
  const monitoring: string[] = [];
  let schemes: HydrationScheme[] = [];

  // Alertas gerais
  if (input.hasCardiacDisease) {
    alerts.push({
      type: "danger",
      message: "Paciente cardiopata: reduzir volume total em 30-50%. Monitorar balanço hídrico rigorosamente. Considerar furosemida profilática.",
    });
  }
  if (input.hasRenalImpairment) {
    alerts.push({
      type: "warning",
      message: `eGFR ${input.egfr.toFixed(0)} mL/min: ajustar velocidade de infusão. Monitorar débito urinário ≥100 mL/h.`,
    });
  }

  switch (type) {
    case "cisplatin_high":
      schemes = getCisplatinHydration(input);
      monitoring.push(
        "Débito urinário ≥100 mL/h (≥3 mL/kg/h)",
        "Peso diário (alvo: variação <2 kg)",
        "Eletrólitos (Na, K, Mg, Ca) antes e 24h após",
        "Creatinina sérica antes de cada ciclo",
        "Balanço hídrico a cada 4h",
      );
      alerts.push({
        type: "info",
        message: "Manter débito urinário ≥100 mL/h. Se <100 mL/h, administrar Furosemida 20-40mg IV.",
      });
      break;

    case "methotrexate_hd":
      schemes = getMethotrexateHydration(input);
      monitoring.push(
        "pH urinário ≥7.0 antes e durante infusão (verificar a cada 6h)",
        "Nível sérico de MTX: 24h, 48h, 72h pós-infusão",
        "Creatinina sérica diária",
        "Débito urinário ≥200 mL/h",
        "Balanço hídrico a cada 4h",
        "Leucovorin conforme nível sérico de MTX",
      );
      alerts.push({
        type: "danger",
        message: "OBRIGATÓRIO: pH urinário ≥7.0 antes de iniciar MTX. Se pH <7.0, aumentar NaHCO3.",
      });
      break;

    case "ifosfamide":
      schemes = getIfosfamideHydration(input);
      monitoring.push(
        "Hematúria (fita reagente a cada 6h)",
        "Débito urinário ≥100 mL/h",
        "Balanço hídrico a cada 8h",
        "Eletrólitos diários",
      );
      alerts.push({
        type: "info",
        message: "MESNA obrigatório: dose = 60-100% da dose de Ifosfamida, fracionada em 3 doses (0h, 4h, 8h).",
      });
      break;

    case "cyclophosphamide_hd":
      schemes = getCyclophosphamideHydration(input);
      monitoring.push(
        "Hematúria (fita reagente a cada 6h)",
        "Débito urinário ≥100 mL/h",
        "Balanço hídrico a cada 8h",
        "Peso diário",
      );
      alerts.push({
        type: "info",
        message: "MESNA obrigatório para doses >1g/m². Dose = 60-100% da Ciclofosfamida.",
      });
      break;

    case "standard":
      schemes = getStandardHydration(input);
      monitoring.push(
        "Balanço hídrico diário",
        "Eletrólitos conforme protocolo",
        "Sinais de sobrecarga hídrica",
      );
      break;

    case "none":
      monitoring.push("Hidratação oral conforme tolerância", "Monitorar sinais de desidratação");
      break;
  }

  // Reduzir volumes para cardiopatas
  if (input.hasCardiacDisease && schemes.length > 0) {
    schemes = schemes.map((s) => ({
      ...s,
      volume: Math.round(s.volume * 0.7),
      rate: Math.round(s.rate * 0.7),
      notes: [...(s.notes || []), "Volume reduzido 30% por cardiopatia"],
    }));
  }

  const totalVolume = schemes.reduce((sum, s) => sum + s.volume, 0);

  return {
    protocolType: type,
    protocolLabel: PROTOCOL_LABELS[type],
    totalVolume,
    schemes,
    alerts,
    monitoring,
  };
}

function getCisplatinHydration(input: HydrationInput): HydrationScheme[] {
  const bsa = input.bsa;
  // Pré-hidratação: 1000-2000 mL em 2-4h
  const preVolume = Math.round(Math.max(1000, bsa * 1000));
  // Pós-hidratação: 1000-2000 mL em 4-6h
  const postVolume = Math.round(Math.max(1000, bsa * 1000));

  return [
    {
      phase: "pre",
      phaseLabel: "Pré-Hidratação",
      solution: "SF 0,9% + KCl 20 mEq/L + MgSO4 1g",
      volume: preVolume,
      rate: Math.round(preVolume / 2),
      duration: 2,
      additives: ["KCl 20 mEq/L", "MgSO4 8% 1g (8 mEq Mg)"],
      notes: [
        "Iniciar 2h antes da Cisplatina",
        "Verificar débito urinário ≥100 mL/h antes de iniciar QT",
      ],
    },
    {
      phase: "concurrent",
      phaseLabel: "Manitol (Diurese Forçada)",
      solution: "Manitol 20%",
      volume: 250,
      rate: 250,
      duration: 1,
      notes: [
        "Administrar junto com a Cisplatina",
        "Opcional: pode usar Furosemida 20mg IV se débito urinário insuficiente",
      ],
    },
    {
      phase: "post",
      phaseLabel: "Pós-Hidratação",
      solution: "SF 0,9% + KCl 20 mEq/L + MgSO4 1g",
      volume: postVolume,
      rate: Math.round(postVolume / 4),
      duration: 4,
      additives: ["KCl 20 mEq/L", "MgSO4 8% 1g (8 mEq Mg)"],
      notes: [
        "Manter por 4-6h após término da Cisplatina",
        "Manter débito urinário ≥100 mL/h",
        "Se débito <100 mL/h: Furosemida 20-40mg IV",
      ],
    },
  ];
}

function getMethotrexateHydration(input: HydrationInput): HydrationScheme[] {
  const bsa = input.bsa;
  // Hiper-hidratação: 3000 mL/m²/dia = 125 mL/m²/h
  const ratePerHour = Math.round(125 * bsa);
  const preVolume = ratePerHour * 6; // 6h pré
  const postVolume = ratePerHour * 24; // 24h pós (mínimo)

  return [
    {
      phase: "pre",
      phaseLabel: "Pré-Hidratação + Alcalinização",
      solution: "SG 5% + NaHCO3 40 mEq/L + KCl 20 mEq/L",
      volume: preVolume,
      rate: ratePerHour,
      duration: 6,
      additives: ["NaHCO3 8,4% 40 mEq/L", "KCl 19,1% 20 mEq/L"],
      notes: [
        "Iniciar 6-12h antes do MTX",
        "OBRIGATÓRIO: pH urinário ≥7.0 antes de iniciar MTX",
        "Se pH <7.0: bolus NaHCO3 50 mEq IV e reavaliar em 1h",
      ],
    },
    {
      phase: "concurrent",
      phaseLabel: "Hidratação Durante Infusão",
      solution: "SG 5% + NaHCO3 40 mEq/L + KCl 20 mEq/L",
      volume: Math.round(ratePerHour * 4),
      rate: ratePerHour,
      duration: 4,
      additives: ["NaHCO3 8,4% 40 mEq/L", "KCl 19,1% 20 mEq/L"],
      notes: [
        "Manter durante infusão de MTX",
        "Verificar pH urinário a cada 6h",
      ],
    },
    {
      phase: "post",
      phaseLabel: "Pós-Hidratação + Alcalinização",
      solution: "SG 5% + NaHCO3 40 mEq/L + KCl 20 mEq/L",
      volume: postVolume,
      rate: ratePerHour,
      duration: 24,
      additives: ["NaHCO3 8,4% 40 mEq/L", "KCl 19,1% 20 mEq/L"],
      notes: [
        "Manter até nível sérico de MTX <0.05 µmol/L",
        "Leucovorin 15 mg/m² IV a cada 6h (iniciar 24h pós-MTX)",
        "Ajustar Leucovorin conforme nível sérico",
        "Manter pH urinário ≥7.0",
      ],
    },
  ];
}

function getIfosfamideHydration(input: HydrationInput): HydrationScheme[] {
  const bsa = input.bsa;
  const volume = Math.round(Math.max(1000, bsa * 1500));

  return [
    {
      phase: "pre",
      phaseLabel: "Pré-Hidratação",
      solution: "SF 0,9%",
      volume: Math.round(volume * 0.5),
      rate: Math.round((volume * 0.5) / 2),
      duration: 2,
      notes: ["Iniciar 2h antes da Ifosfamida"],
    },
    {
      phase: "concurrent",
      phaseLabel: "MESNA (Uroproteção)",
      solution: "MESNA IV",
      volume: 0,
      rate: 0,
      duration: 0,
      notes: [
        "Dose MESNA = 60-100% da dose de Ifosfamida",
        "Fracionamento: 20% no tempo 0h, 20% em 4h, 20% em 8h",
        "Alternativa: MESNA VO 40% da dose a cada 2h (3 doses)",
      ],
    },
    {
      phase: "post",
      phaseLabel: "Pós-Hidratação",
      solution: "SF 0,9%",
      volume: volume,
      rate: Math.round(volume / 6),
      duration: 6,
      notes: [
        "Manter por 6-12h após término da Ifosfamida",
        "Monitorar hematúria (fita reagente a cada 6h)",
        "Se hematúria: aumentar hidratação e considerar irrigação vesical",
      ],
    },
  ];
}

function getCyclophosphamideHydration(input: HydrationInput): HydrationScheme[] {
  const bsa = input.bsa;
  const volume = Math.round(Math.max(1000, bsa * 1500));

  return [
    {
      phase: "pre",
      phaseLabel: "Pré-Hidratação",
      solution: "SF 0,9%",
      volume: Math.round(volume * 0.5),
      rate: Math.round((volume * 0.5) / 2),
      duration: 2,
      notes: ["Iniciar 2h antes da Ciclofosfamida"],
    },
    {
      phase: "concurrent",
      phaseLabel: "MESNA (Uroproteção)",
      solution: "MESNA IV",
      volume: 0,
      rate: 0,
      duration: 0,
      notes: [
        "MESNA obrigatório para doses >1 g/m²",
        "Dose MESNA = 60-100% da dose de Ciclofosfamida",
        "Fracionamento: 20% no tempo 0h, 20% em 4h, 20% em 8h",
      ],
    },
    {
      phase: "post",
      phaseLabel: "Pós-Hidratação",
      solution: "SF 0,9%",
      volume: volume,
      rate: Math.round(volume / 6),
      duration: 6,
      notes: [
        "Manter por 6-12h após término",
        "Monitorar hematúria",
        "Estimular micção frequente",
      ],
    },
  ];
}

function getStandardHydration(input: HydrationInput): HydrationScheme[] {
  const volume = Math.round(Math.max(500, input.bsa * 500));

  return [
    {
      phase: "pre",
      phaseLabel: "Hidratação Pré-QT",
      solution: "SF 0,9%",
      volume: volume,
      rate: Math.round(volume / 1),
      duration: 1,
      notes: ["Hidratação padrão antes da quimioterapia"],
    },
    {
      phase: "post",
      phaseLabel: "Hidratação Pós-QT",
      solution: "SF 0,9%",
      volume: volume,
      rate: Math.round(volume / 2),
      duration: 2,
      notes: [
        "Manter hidratação oral conforme tolerância",
        "Orientar ingestão ≥2L/dia de líquidos em casa",
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSIÇÃO DE ELETRÓLITOS
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateElectrolyteReplacements(input: ElectrolyteInput): ElectrolyteReplacement[] {
  const results: ElectrolyteReplacement[] = [];

  if (input.potassium !== undefined) {
    results.push(calculatePotassiumReplacement(input.potassium, input.weight, input.egfr, input.hasCardiacDisease));
  }
  if (input.magnesium !== undefined) {
    results.push(calculateMagnesiumReplacement(input.magnesium, input.weight, input.egfr));
  }
  if (input.calciumIonized !== undefined) {
    results.push(calculateCalciumReplacement(input.calciumIonized, input.weight, input.hasCardiacDisease));
  }
  if (input.phosphorus !== undefined) {
    results.push(calculatePhosphorusReplacement(input.phosphorus, input.weight));
  }
  if (input.sodium !== undefined) {
    results.push(calculateSodiumAssessment(input.sodium, input.weight));
  }

  return results;
}

function getElectrolyteStatus(
  value: number,
  criticalLow: number,
  low: number,
  high: number,
  criticalHigh: number
): { status: ElectrolyteReplacement["status"]; label: string } {
  if (value < criticalLow) return { status: "critical", label: "Criticamente Baixo" };
  if (value < low) return { status: "low", label: "Baixo" };
  if (value > criticalHigh) return { status: "critical_high", label: "Criticamente Alto" };
  if (value > high) return { status: "high", label: "Alto" };
  return { status: "normal", label: "Normal" };
}

function calculatePotassiumReplacement(
  k: number,
  weight: number,
  egfr: number,
  hasCardiac: boolean
): ElectrolyteReplacement {
  const { status, label } = getElectrolyteStatus(k, 2.5, 3.5, 5.5, 6.5);
  const replacements: ReplacementOption[] = [];
  const alerts: string[] = [];
  const monitoring: string[] = [];

  if (k < 3.0) {
    // Hipocalemia grave
    replacements.push({
      solution: "KCl 19,1% (25 mEq/10mL)",
      dose: "40 mEq",
      volume: "500 mL SF 0,9%",
      route: "IV",
      rate: "20 mEq/h (máx. 40 mEq/h em UTI com monitorização)",
      duration: "2-4 horas",
      frequency: "Repetir conforme nível sérico",
      notes: "Velocidade máxima por veia periférica: 10 mEq/h. Acesso central: até 40 mEq/h.",
    });
    alerts.push("HIPOCALEMIA GRAVE: risco de arritmia. Monitorização cardíaca contínua obrigatória.");
    alerts.push("Repor Magnésio simultaneamente (hipocalemia refratária se Mg baixo).");
    if (hasCardiac) {
      alerts.push("CARDIOPATA: velocidade máxima 10 mEq/h. ECG antes e após reposição.");
    }
  } else if (k < 3.5) {
    // Hipocalemia leve-moderada
    replacements.push({
      solution: "KCl 19,1% (25 mEq/10mL)",
      dose: "20-40 mEq",
      volume: "500 mL SF 0,9%",
      route: "IV",
      rate: "10-20 mEq/h",
      duration: "2-4 horas",
      frequency: "1-2x/dia conforme nível sérico",
    });
    replacements.push({
      solution: "KCl xarope 6% (0,8 mEq/mL)",
      dose: "20-40 mEq (25-50 mL)",
      volume: "Diluir em suco",
      route: "VO",
      rate: "N/A",
      duration: "N/A",
      frequency: "2-3x/dia",
      notes: "Preferir VO se paciente tolerar e K >3.0",
    });
  }

  if (k > 5.5) {
    alerts.push("HIPERCALEMIA: ECG imediato. Verificar se amostra não é hemolisada.");
    if (k > 6.5) {
      alerts.push("HIPERCALEMIA GRAVE: Gluconato de Cálcio 10% 10mL IV em 2-3 min (cardioproteção). Insulina 10UI + Glicose 50% 50mL IV. Nebulização com Salbutamol 10-20mg.");
    }
  }

  if (egfr < 30) {
    alerts.push("Insuficiência renal: reduzir dose de reposição e monitorar mais frequentemente.");
  }

  monitoring.push(
    "K sérico: controle 2-4h após reposição IV",
    "ECG se K <3.0 ou >5.5",
    "Monitorar Mg simultaneamente",
  );

  return {
    electrolyte: "Potássio (K⁺)",
    currentValue: k,
    normalRange: "3,5 - 5,5",
    unit: "mEq/L",
    status,
    statusLabel: label,
    replacements,
    alerts,
    monitoring,
  };
}

function calculateMagnesiumReplacement(
  mg: number,
  weight: number,
  egfr: number
): ElectrolyteReplacement {
  const { status, label } = getElectrolyteStatus(mg, 1.0, 1.8, 2.4, 3.0);
  const replacements: ReplacementOption[] = [];
  const alerts: string[] = [];
  const monitoring: string[] = [];

  if (mg < 1.0) {
    // Hipomagnesemia grave
    replacements.push({
      solution: "MgSO4 50% (4 mEq/mL)",
      dose: "4g (32 mEq)",
      volume: "250 mL SF 0,9%",
      route: "IV",
      rate: "1g/h (máx. 2g/h)",
      duration: "4 horas",
      frequency: "Repetir conforme nível sérico",
      notes: "Monitorar reflexos patelares. Suspender se reflexos abolidos.",
    });
    alerts.push("HIPOMAGNESEMIA GRAVE: risco de arritmia e convulsão. Monitorização cardíaca.");
    alerts.push("Hipocalemia pode ser refratária até corrigir Mg.");
  } else if (mg < 1.8) {
    // Hipomagnesemia leve-moderada
    replacements.push({
      solution: "MgSO4 50% (4 mEq/mL)",
      dose: "2g (16 mEq)",
      volume: "100 mL SF 0,9%",
      route: "IV",
      rate: "1g/h",
      duration: "2 horas",
      frequency: "1x/dia conforme nível sérico",
    });
    replacements.push({
      solution: "Óxido de Magnésio 400mg",
      dose: "400-800 mg",
      volume: "N/A",
      route: "VO",
      rate: "N/A",
      duration: "N/A",
      frequency: "2-3x/dia",
      notes: "Pode causar diarreia. Preferir via IV em pacientes com QT.",
    });
  }

  if (egfr < 30) {
    alerts.push("Insuficiência renal: risco de hipermagnesemia. Reduzir dose em 50%.");
  }

  monitoring.push(
    "Mg sérico: controle 6-8h após reposição",
    "Reflexos patelares durante infusão IV",
    "K sérico (corrigir simultaneamente)",
  );

  return {
    electrolyte: "Magnésio (Mg²⁺)",
    currentValue: mg,
    normalRange: "1,8 - 2,4",
    unit: "mg/dL",
    status,
    statusLabel: label,
    replacements,
    alerts,
    monitoring,
  };
}

function calculateCalciumReplacement(
  caI: number,
  weight: number,
  hasCardiac: boolean
): ElectrolyteReplacement {
  const { status, label } = getElectrolyteStatus(caI, 0.9, 1.15, 1.35, 1.6);
  const replacements: ReplacementOption[] = [];
  const alerts: string[] = [];
  const monitoring: string[] = [];

  if (caI < 0.9) {
    // Hipocalcemia grave
    replacements.push({
      solution: "Gluconato de Cálcio 10% (0,45 mEq/mL)",
      dose: "2 ampolas (20 mL = 9 mEq Ca)",
      volume: "100 mL SG 5%",
      route: "IV lento",
      rate: "Infundir em 10-20 min",
      duration: "20 minutos",
      frequency: "Repetir conforme CaI",
      notes: "NUNCA infundir em bolus rápido (risco de arritmia). Não misturar com bicarbonato.",
    });
    alerts.push("HIPOCALCEMIA GRAVE: risco de tetania, convulsão e arritmia. ECG obrigatório.");
    if (hasCardiac) {
      alerts.push("CARDIOPATA: infundir mais lentamente (30 min). Monitorização contínua.");
    }
  } else if (caI < 1.15) {
    // Hipocalcemia leve-moderada
    replacements.push({
      solution: "Gluconato de Cálcio 10%",
      dose: "1-2 ampolas (10-20 mL)",
      volume: "100 mL SG 5%",
      route: "IV",
      rate: "Infundir em 20-30 min",
      duration: "30 minutos",
      frequency: "1-2x/dia",
    });
    replacements.push({
      solution: "Carbonato de Cálcio 500mg",
      dose: "500-1000 mg de Ca elementar",
      volume: "N/A",
      route: "VO",
      rate: "N/A",
      duration: "N/A",
      frequency: "2-3x/dia às refeições",
      notes: "Associar Vitamina D3 se deficiência confirmada.",
    });
  }

  if (caI > 1.35) {
    alerts.push("HIPERCALCEMIA: investigar causa (tumor, PTH, vitamina D). Hidratação vigorosa com SF 0,9%.");
    if (caI > 1.6) {
      alerts.push("HIPERCALCEMIA GRAVE: SF 0,9% 200-300 mL/h + Furosemida 20-40mg IV + Ácido Zoledrônico 4mg IV em 15 min.");
    }
  }

  monitoring.push(
    "CaI: controle 4-6h após reposição",
    "ECG se CaI <0.9 ou >1.5",
    "Mg e K séricos (corrigir simultaneamente)",
    "Albumina sérica (para interpretar Ca total)",
  );

  return {
    electrolyte: "Cálcio Ionizado (Ca²⁺)",
    currentValue: caI,
    normalRange: "1,15 - 1,35",
    unit: "mmol/L",
    status,
    statusLabel: label,
    replacements,
    alerts,
    monitoring,
  };
}

function calculatePhosphorusReplacement(
  p: number,
  weight: number
): ElectrolyteReplacement {
  const { status, label } = getElectrolyteStatus(p, 1.0, 2.5, 4.5, 7.0);
  const replacements: ReplacementOption[] = [];
  const alerts: string[] = [];
  const monitoring: string[] = [];

  if (p < 1.0) {
    // Hipofosfatemia grave
    replacements.push({
      solution: "Fosfato de Potássio (KH2PO4)",
      dose: `${Math.round(weight * 0.5)} mmol (0,5 mmol/kg)`,
      volume: "250 mL SF 0,9%",
      route: "IV",
      rate: "Infundir em 6 horas",
      duration: "6 horas",
      frequency: "Repetir conforme nível sérico",
      notes: "Monitorar K durante infusão (contém potássio). Máx. 80 mmol/dia.",
    });
    alerts.push("HIPOFOSFATEMIA GRAVE: risco de fraqueza muscular, insuficiência respiratória e rabdomiólise.");
    alerts.push("Comum na Síndrome de Lise Tumoral (fase de reposição) e realimentação.");
  } else if (p < 2.5) {
    // Hipofosfatemia leve-moderada
    replacements.push({
      solution: "Fosfato de Potássio",
      dose: `${Math.round(weight * 0.25)} mmol (0,25 mmol/kg)`,
      volume: "250 mL SF 0,9%",
      route: "IV",
      rate: "Infundir em 4-6 horas",
      duration: "4-6 horas",
      frequency: "1x/dia",
    });
    replacements.push({
      solution: "Fosfato de Sódio (Fleet Phospho-soda)",
      dose: "15-30 mL (250-500 mg P)",
      volume: "Diluir em água",
      route: "VO",
      rate: "N/A",
      duration: "N/A",
      frequency: "2-3x/dia",
      notes: "Pode causar diarreia. Evitar em insuficiência renal.",
    });
  }

  if (p > 4.5) {
    alerts.push("HIPERFOSFATEMIA: investigar insuficiência renal ou lise tumoral.");
    if (p > 7.0) {
      alerts.push("HIPERFOSFATEMIA GRAVE (Lise Tumoral?): Hidratação vigorosa + Sevelamer 800mg 3x/dia + considerar diálise.");
    }
  }

  monitoring.push(
    "P sérico: controle 6-12h após reposição",
    "K sérico (se usando fosfato de potássio)",
    "Ca sérico (relação inversa com fósforo)",
  );

  return {
    electrolyte: "Fósforo (PO₄)",
    currentValue: p,
    normalRange: "2,5 - 4,5",
    unit: "mg/dL",
    status,
    statusLabel: label,
    replacements,
    alerts,
    monitoring,
  };
}

function calculateSodiumAssessment(
  na: number,
  weight: number
): ElectrolyteReplacement {
  const { status, label } = getElectrolyteStatus(na, 120, 135, 145, 155);
  const replacements: ReplacementOption[] = [];
  const alerts: string[] = [];
  const monitoring: string[] = [];

  if (na < 120) {
    // Hiponatremia grave
    const deficit = Math.round((125 - na) * weight * 0.6);
    replacements.push({
      solution: "NaCl 3% (513 mEq/L)",
      dose: `${Math.min(150, Math.round(weight * 2))} mL (bolus)`,
      volume: `${Math.min(150, Math.round(weight * 2))} mL`,
      route: "IV (acesso central preferível)",
      rate: "Bolus em 20 min, depois 0,5-1 mL/kg/h",
      duration: "Conforme resposta",
      frequency: "Repetir bolus se sintomático após 20 min (máx. 3 bolus)",
      notes: `Déficit estimado: ${deficit} mEq. CORREÇÃO MÁXIMA: 8-10 mEq/L em 24h (risco de mielinólise pontina).`,
    });
    alerts.push("HIPONATREMIA GRAVE: risco de convulsão e edema cerebral. Correção LENTA obrigatória.");
    alerts.push("Correção máxima: 8-10 mEq/L nas primeiras 24h. Se ultrapassar, considerar desmopressina.");
  } else if (na < 130) {
    // Hiponatremia moderada
    replacements.push({
      solution: "NaCl 3%",
      dose: "1-2 mL/kg/h",
      volume: "Conforme cálculo",
      route: "IV",
      rate: "1-2 mL/kg/h",
      duration: "Conforme resposta",
      frequency: "Controle Na a cada 4-6h",
      notes: "Correção máxima: 8-10 mEq/L em 24h.",
    });
    replacements.push({
      solution: "Restrição hídrica",
      dose: "800-1000 mL/dia",
      volume: "N/A",
      route: "N/A",
      rate: "N/A",
      duration: "Contínuo",
      frequency: "Diário",
      notes: "Se SIADH: restrição hídrica é primeira linha.",
    });
  } else if (na < 135) {
    replacements.push({
      solution: "Restrição hídrica + SF 0,9%",
      dose: "Ajustar conforme causa",
      volume: "N/A",
      route: "N/A",
      rate: "N/A",
      duration: "N/A",
      frequency: "Diário",
      notes: "Investigar causa: SIADH, diuréticos, perda GI.",
    });
  }

  if (na > 145) {
    alerts.push("HIPERNATREMIA: geralmente por desidratação. Repor água livre.");
    if (na > 155) {
      alerts.push("HIPERNATREMIA GRAVE: SG 5% IV. Correção máxima: 10-12 mEq/L em 24h.");
    }
  }

  monitoring.push(
    "Na sérico: controle a cada 4-6h durante correção",
    "Osmolaridade sérica e urinária",
    "Balanço hídrico rigoroso",
    "Avaliação neurológica seriada",
  );

  return {
    electrolyte: "Sódio (Na⁺)",
    currentValue: na,
    normalRange: "135 - 145",
    unit: "mEq/L",
    status,
    statusLabel: label,
    replacements,
    alerts,
    monitoring,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPORTE TRANSFUSIONAL
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateTransfusionSupport(input: TransfusionInput): TransfusionRecommendation[] {
  const results: TransfusionRecommendation[] = [];

  if (input.hemoglobin !== undefined) {
    results.push(calculateRBCTransfusion(input));
  }
  if (input.platelets !== undefined) {
    results.push(calculatePlateletTransfusion(input));
  }

  return results;
}

function calculateRBCTransfusion(input: TransfusionInput): TransfusionRecommendation {
  const hb = input.hemoglobin!;
  let threshold = 7.0; // AABB 2023: threshold restritivo
  let indicated = false;
  let urgency: TransfusionRecommendation["urgency"] = "not_indicated";
  const alerts: string[] = [];
  const specialRequirements: string[] = [];
  const premedication: string[] = [];

  // Ajustar threshold conforme contexto
  if (input.isBleeding) {
    threshold = 8.0;
    if (hb < threshold) {
      indicated = true;
      urgency = "immediate";
    }
  } else if (input.isPreProcedure) {
    threshold = 8.0;
    if (hb < threshold) {
      indicated = true;
      urgency = "routine";
    }
  } else {
    // Threshold restritivo (AABB 2023)
    if (hb < 7.0) {
      indicated = true;
      urgency = hb < 5.0 ? "immediate" : "routine";
    }
  }

  // Sintomático com Hb 7-8
  if (!indicated && hb >= 7.0 && hb < 8.0) {
    alerts.push("Hb entre 7-8 g/dL: transfundir se sintomático (taquicardia, dispneia, hipotensão ortostática).");
  }

  // Cálculo de volume
  const units = hb < 5.0 ? 3 : hb < 6.0 ? 2 : 1;
  const volumePerUnit = 300; // mL por concentrado
  const expectedIncrease = units; // ~1 g/dL por concentrado

  // Requisitos especiais
  if (input.isBMT || input.isImmunosuppressed) {
    specialRequirements.push("Hemácias IRRADIADAS (prevenção de GVHD transfusional)");
    specialRequirements.push("Hemácias FILTRADAS (leucodepletadas)");
  }
  if (input.hasFever) {
    specialRequirements.push("Hemácias FILTRADAS (reduzir reação febril não-hemolítica)");
    premedication.push("Dipirona 1g IV ou Paracetamol 750mg VO (30 min antes)");
  }

  // Pré-medicação padrão para pacientes oncológicos
  premedication.push("Furosemida 20mg IV (se risco de sobrecarga, ICC, ou ≥2 concentrados)");

  const monitoring = [
    "Sinais vitais: antes, 15 min, 30 min, 1h e ao término",
    "Observar reações transfusionais (febre, calafrios, urticária, dispneia)",
    "Hb de controle 1h após término da transfusão",
    "Tempo máximo de infusão: 4h por concentrado",
  ];

  if (hb < 5.0) {
    alerts.push("ANEMIA GRAVE: considerar transfusão de emergência. Tipagem sanguínea + prova cruzada URGENTE.");
  }

  return {
    product: "rbc",
    productLabel: "Concentrado de Hemácias",
    indicated,
    urgency,
    urgencyLabel: urgency === "immediate" ? "Imediata" : urgency === "routine" ? "Rotina" : "Não Indicada",
    currentValue: hb,
    threshold,
    unit: "g/dL",
    volume: `${units} concentrado(s) (~${units * volumePerUnit} mL)`,
    expectedIncrement: `+${expectedIncrease} g/dL`,
    specialRequirements,
    premedication,
    alerts,
    monitoring,
  };
}

function calculatePlateletTransfusion(input: TransfusionInput): TransfusionRecommendation {
  const plt = input.platelets!;
  // Normalizar: se valor >1000, assumir que está em /mm³; senão, x10³/µL
  const pltNormalized = plt > 1000 ? plt : plt * 1000;
  let threshold = 10000; // NCCN: threshold profilático
  let indicated = false;
  let urgency: TransfusionRecommendation["urgency"] = "not_indicated";
  const alerts: string[] = [];
  const specialRequirements: string[] = [];
  const premedication: string[] = [];

  // Ajustar threshold conforme contexto
  if (input.isBleeding) {
    threshold = 50000;
    if (pltNormalized < threshold) {
      indicated = true;
      urgency = "immediate";
    }
  } else if (input.isPreProcedure) {
    threshold = 50000;
    if (pltNormalized < threshold) {
      indicated = true;
      urgency = "routine";
    }
  } else if (input.hasFever) {
    threshold = 20000;
    if (pltNormalized < threshold) {
      indicated = true;
      urgency = "routine";
    }
  } else {
    // Profilático
    threshold = 10000;
    if (pltNormalized < threshold) {
      indicated = true;
      urgency = pltNormalized < 5000 ? "immediate" : "routine";
    }
  }

  // Alertas intermediários
  if (!indicated && pltNormalized >= 10000 && pltNormalized < 20000) {
    alerts.push("Plaquetas 10-20.000: transfundir se febre, infecção, sangramento mucoso ou pré-procedimento.");
  }

  // Tipo de produto
  const isAferesis = true; // Preferir aférese em oncologia
  const volume = isAferesis ? "1 unidade de aférese (~200-300 mL)" : "1 pool de plaquetas randômicas (5-6 unidades, ~300 mL)";
  const expectedIncrease = isAferesis ? "30.000-50.000/mm³" : "20.000-40.000/mm³";

  // Requisitos especiais
  if (input.isBMT || input.isImmunosuppressed) {
    specialRequirements.push("Plaquetas IRRADIADAS (prevenção de GVHD)");
    specialRequirements.push("Plaquetas FILTRADAS (leucodepletadas)");
  }
  if (input.hasFever) {
    premedication.push("Dipirona 1g IV ou Paracetamol 750mg VO (30 min antes)");
    premedication.push("Hidrocortisona 100mg IV (se reação prévia)");
  }

  const monitoring = [
    "Sinais vitais: antes, 15 min e ao término",
    "Observar reações (febre, calafrios, urticária)",
    "Plaquetas de controle 1h após término",
    "Tempo de infusão: 20-30 min (máx. 4h)",
    "Avaliar refratariedade se incremento <10.000 em 2 transfusões consecutivas",
  ];

  if (pltNormalized < 5000) {
    alerts.push("PLAQUETOPENIA GRAVE: risco de sangramento espontâneo (SNC). Transfusão IMEDIATA.");
  }

  return {
    product: "platelets",
    productLabel: "Concentrado de Plaquetas",
    indicated,
    urgency,
    urgencyLabel: urgency === "immediate" ? "Imediata" : urgency === "routine" ? "Rotina" : "Não Indicada",
    currentValue: pltNormalized,
    threshold,
    unit: "/mm³",
    volume,
    expectedIncrement: `+${expectedIncrease}`,
    specialRequirements,
    premedication,
    alerts,
    monitoring,
  };
}
