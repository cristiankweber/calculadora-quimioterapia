// Tipos para a calculadora de quimioterapia

export interface PatientData {
  name: string;
  age: number;
  sex: 'M' | 'F';
  weight: number; // kg
  height: number; // cm
  creatinine: number; // mg/dL
  bilirubin: number; // mg/dL
  ecog: 0 | 1 | 2 | 3 | 4;
  comorbidities: string;
}

export interface CalculatedValues {
  bsa: number; // m² - Body Surface Area
  egfr: number; // mL/min/1.73m² - eGFR CKD-EPI 2021
  renalStatus: 'green' | 'yellow' | 'red';
  renalStatusLabel: string;
  ecogAdjustmentFactor: number;
  globalAdjustmentFactor: number;
}

export interface Drug {
  name: string;
  dose: number;
  doseUnit: 'mg/m²' | 'mg/kg' | 'mg' | 'AUC' | 'mcg/kg' | 'cGy';
  maxDose?: number; // Dose máxima absoluta em mg
  calculatedDose?: number;
  route: string;
  days: string;
  observations?: string;
  emetogenicRisk?: 'high' | 'moderate' | 'low' | 'minimal';
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
  emetogenicRisk: 'high' | 'moderate' | 'low' | 'minimal';
}

export interface CumulativeDose {
  drug: string;
  currentDose: number;
  previousDose: number;
  totalDose: number;
  limit: number;
  percentage: number;
  alertLevel: 'safe' | 'warning' | 'near-limit' | 'exceeded';
}

export interface AntiemeticProphylaxis {
  risk: 'high' | 'moderate' | 'low' | 'minimal';
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
