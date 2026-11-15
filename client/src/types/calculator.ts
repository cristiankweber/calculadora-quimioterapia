// Tipos para a calculadora de quimioterapia

export interface PatientData {
  name: string;
  age: number;
  sex: "M" | "F";
  weight: number; // kg
  height: number; // cm
  creatinine: number; // mg/dL
  /** Entrada explícita validada pelo médico para Calvert, mL/min não indexados. */
  calvertGfrAbsolute?: number;
  bilirubin: number; // mg/dL
  ecog: 0 | 1 | 2 | 3 | 4;
  comorbidities: string;
}

export interface CalculatedValues {
  bsa: number; // m² - Body Surface Area
  egfr: number; // mL/min/1.73m² - eGFR CKD-EPI 2021
  renalStatus: "green" | "yellow" | "red";
  renalStatusLabel: string;
  ecogAdjustmentFactor: number;
  globalAdjustmentFactor: number;
}

export interface Drug {
  name: string;
  dose: number;
  doseUnit:
    | "mg/m²"
    | "mg/kg"
    | "mg"
    | "AUC"
    | "mcg/kg"
    | "cGy"
    | "mcg/m²"
    | "mcg"
    | "UI/m²";
  maxDose?: number; // Limite absoluto na unidade do resultado: mg, mcg, UI ou cGy.
  calculatedDose?: number;
  resultUnit?: string;
  frequency?: number | null;
  dailyDose?: number | null;
  timeOrigin?: string;
  doseRepresents?: string;
  route: string;
  days: string;
  observations?: string;
  emetogenicRisk?: "high" | "moderate" | "low" | "minimal";
  renalAdjustment?: string;
  hepaticAdjustment?: string;
}

export interface Protocol {
  id: string;
  name: string;
  indication: string;
  cycles: number;
  cycleLength: number; // dias
  drugs: Drug[];
  renalAdjustments: string[];
  hepaticAdjustments: string[];
  hematologicAdjustments: string[];
  prophylaxis: string[];
  nursingCare: string[];
  specialAlerts: string[];
  emetogenicRisk: "high" | "moderate" | "low" | "minimal";
  /** Documento fonte preservado: não é uma prescrição automaticamente liberada. */
  clinicalDocument?: Record<string, unknown>;
  clinicalPackage?: Record<string, unknown>;
  libraryKind?: "reviewed" | "custom" | "legacy" | "templates";
  isUserTemplate?: boolean;
  /** Contexto de AUC no legado; não substituir por eGFR indexado. */
  calvertGfrAbsolute?: number;
  templateContext?: {
    cycle: number;
    phaseId?: string;
    day?: number;
    gfrForCalvert?: number;
  };
}

export interface CumulativeDose {
  drug: string;
  currentDose: number;
  previousDose: number;
  totalDose: number;
  limit: number;
  percentage: number;
  alertLevel: "safe" | "warning" | "near-limit" | "exceeded";
}

export interface AntiemeticProphylaxis {
  risk: "high" | "moderate" | "low" | "minimal";
  day1: string[];
  days2to4: string[];
  rescue: string[];
  alerts: string[];
}

export interface Prescription {
  patient: PatientData;
  calculated: CalculatedValues;
  protocol: Protocol;
  cycle: number;
  drugs: Drug[];
  prophylaxis: string[];
  antiemetics: AntiemeticProphylaxis;
  nursingCare: string[];
  alerts: string[];
  cumulativeDoses: CumulativeDose[];
  generatedAt: Date;
}
