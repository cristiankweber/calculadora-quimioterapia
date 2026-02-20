/**
 * Motor de Cálculo Clínico — Funções puras sem dependência de React/UI.
 *
 * Este módulo é a fonte de verdade para todos os cálculos clínicos do sistema.
 * Pode ser importado tanto pelo frontend (hooks) quanto pelo backend (tRPC).
 *
 * REGRA: Nenhuma função aqui deve importar React, DOM, ou qualquer dependência de UI.
 */

export { isPositiveFinite, isNonNegativeFinite, safeRound, clamp, toSafeNumber } from './safemath';

import { isPositiveFinite, safeRound, clamp } from './safemath';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type Sex = 'M' | 'F';
export type ECOGScore = 0 | 1 | 2 | 3 | 4;
export type RenalStatus = 'green' | 'yellow' | 'red';
export type DoseUnit = 'mg/m²' | 'mg/kg' | 'mg' | 'AUC';
export type CumulativeAlertLevel = 'safe' | 'warning' | 'near-limit' | 'exceeded';

export interface PatientMetrics {
  age: number;
  sex: Sex;
  weight: number;   // kg
  height: number;    // cm
  creatinine: number; // mg/dL
  ecog: ECOGScore;
}

export interface DerivedValues {
  bsa: number;
  egfr: number;
  renalStatus: RenalStatus;
  renalStatusLabel: string;
  ecogAdjustmentFactor: number;
  globalAdjustmentFactor: number;
}

export interface DrugDoseInput {
  baseDose: number;
  doseUnit: DoseUnit;
  bsa: number;
  weight: number;
  adjustmentFactor?: number;
  maxDose?: number;
  egfr?: number;
}

export interface CumulativeResult {
  totalDose: number;
  limit: number;
  percentage: number;
  alertLevel: CumulativeAlertLevel;
  message: string;
}

// ─── BSA (DuBois) ───────────────────────────────────────────────────────────

/**
 * Calcula a Superfície Corporal usando a fórmula de DuBois.
 * SC = 0.007184 × Peso^0.425 × Altura^0.725
 *
 * Retorna 0 se peso ou altura forem inválidos.
 */
export function calculateBSA(weight: number, height: number): number {
  if (!isPositiveFinite(weight) || !isPositiveFinite(height)) return 0;
  const bsa = 0.007184 * Math.pow(weight, 0.425) * Math.pow(height, 0.725);
  return safeRound(bsa, 2);
}

// ─── eGFR (CKD-EPI 2021) ───────────────────────────────────────────────────

/**
 * Calcula eGFR usando CKD-EPI 2021 (sem raça).
 * Referência: https://www.kidney.org/professionals/kdoqi/gfr_calculator
 *
 * Retorna 0 se creatinina, idade ou sexo forem inválidos.
 */
export function calculateEGFR(creatinine: number, age: number, sex: Sex): number {
  if (!isPositiveFinite(creatinine) || !isPositiveFinite(age)) return 0;
  if (sex !== 'M' && sex !== 'F') return 0;

  const kappa = sex === 'F' ? 0.7 : 0.9;
  const alpha = sex === 'F' ? -0.241 : -0.302;
  const sexFactor = sex === 'F' ? 1.012 : 1.0;

  const creatRatio = creatinine / kappa;
  const minTerm = Math.min(creatRatio, 1);
  const maxTerm = Math.max(creatRatio, 1);

  const egfr =
    142 *
    Math.pow(minTerm, alpha) *
    Math.pow(maxTerm, -1.2) *
    Math.pow(0.9938, age) *
    sexFactor;

  return safeRound(egfr, 1);
}

// ─── Classificação Renal ────────────────────────────────────────────────────

export function classifyRenalFunction(egfr: number): {
  status: RenalStatus;
  label: string;
} {
  if (!Number.isFinite(egfr) || egfr < 0) {
    return { status: 'red', label: 'Valor inválido de eGFR' };
  }
  if (egfr >= 60) {
    return { status: 'green', label: 'Normal (≥60 mL/min) - Dose completa' };
  }
  if (egfr >= 30) {
    return { status: 'yellow', label: 'Moderada (30-59 mL/min) - Cautela, possível redução' };
  }
  return { status: 'red', label: 'Grave (<30 mL/min) - Evitar ou reduzir fortemente' };
}

// ─── Ajuste por ECOG ────────────────────────────────────────────────────────

export function calculateECOGAdjustment(ecog: ECOGScore): number {
  switch (ecog) {
    case 0:
    case 1:
      return 1.0;
    case 2:
      return 0.85;
    case 3:
    case 4:
      return 0.65;
    default:
      return 1.0;
  }
}

// ─── Ajuste por Idade ───────────────────────────────────────────────────────

export function calculateAgeAdjustment(age: number, ecog: ECOGScore): number {
  if (age > 75 && ecog >= 2) return 0.9;
  return 1.0;
}

// ─── Ajuste Global (ECOG + Idade) ──────────────────────────────────────────

export function calculateGlobalAdjustment(age: number, ecog: ECOGScore): number {
  return calculateECOGAdjustment(ecog) * calculateAgeAdjustment(age, ecog);
}

// ─── Valores Derivados do Paciente ──────────────────────────────────────────

/**
 * Calcula todos os valores derivados do paciente de uma vez.
 * Retorna null se os dados mínimos não forem válidos.
 */
export function calculateDerivedValues(metrics: PatientMetrics): DerivedValues | null {
  const { age, sex, weight, height, creatinine, ecog } = metrics;

  if (!isPositiveFinite(weight) || !isPositiveFinite(height) || !isPositiveFinite(creatinine) || !isPositiveFinite(age)) {
    return null;
  }

  const bsa = calculateBSA(weight, height);
  const egfr = calculateEGFR(creatinine, age, sex);
  const renal = classifyRenalFunction(egfr);
  const ecogFactor = calculateECOGAdjustment(ecog);
  const globalFactor = calculateGlobalAdjustment(age, ecog);

  return {
    bsa,
    egfr,
    renalStatus: renal.status,
    renalStatusLabel: renal.label,
    ecogAdjustmentFactor: ecogFactor,
    globalAdjustmentFactor: globalFactor,
  };
}

// ─── Cálculo de Dose de Droga ───────────────────────────────────────────────

/**
 * Calcula dose ajustada de uma droga.
 * Retorna 0 se os dados forem insuficientes para o tipo de dose.
 */
export function calculateDrugDose(input: DrugDoseInput): number {
  const { baseDose, doseUnit, bsa, weight, adjustmentFactor = 1.0, maxDose, egfr } = input;

  if (!Number.isFinite(baseDose) || baseDose <= 0) return 0;

  let calculatedDose = baseDose;

  switch (doseUnit) {
    case 'mg/m²':
      if (!isPositiveFinite(bsa)) return 0;
      calculatedDose = baseDose * bsa;
      break;
    case 'mg/kg':
      if (!isPositiveFinite(weight)) return 0;
      calculatedDose = baseDose * weight;
      break;
    case 'AUC':
      if (egfr === undefined || !Number.isFinite(egfr)) return baseDose;
      calculatedDose = baseDose * (egfr + 25);
      break;
    case 'mg':
      // Dose fixa, sem cálculo
      break;
    default:
      return 0;
  }

  calculatedDose *= adjustmentFactor;

  if (maxDose !== undefined && isPositiveFinite(maxDose) && calculatedDose > maxDose) {
    calculatedDose = maxDose;
  }

  return safeRound(calculatedDose, 1);
}

/**
 * Wrapper de compatibilidade com a assinatura antiga (posicional).
 * Usado para manter retrocompatibilidade com código existente.
 */
export function calculateDrugDoseLegacy(
  baseDose: number,
  doseUnit: DoseUnit,
  bsa: number,
  weight: number,
  adjustmentFactor: number = 1.0,
  maxDose?: number,
  egfr?: number
): number {
  return calculateDrugDose({ baseDose, doseUnit, bsa, weight, adjustmentFactor, maxDose, egfr });
}

// ─── Dose Cumulativa de Antraciclinas ───────────────────────────────────────

const ANTHRACYCLINE_LIMITS: Record<string, number> = {
  doxorrubicina: 450,
  daunorrubicina: 550,
  idarrubicina: 150,
  epirrubicina: 900,
  mitoxantrona: 160,
};

export function validateCumulativeDose(
  drug: string,
  currentDose: number,
  previousDose: number
): CumulativeResult {
  const drugLower = drug.toLowerCase();
  const limit = ANTHRACYCLINE_LIMITS[drugLower] || 0;

  const totalDose = (Number.isFinite(currentDose) ? currentDose : 0) +
                    (Number.isFinite(previousDose) ? previousDose : 0);

  if (limit === 0) {
    return {
      totalDose,
      limit: 0,
      percentage: 0,
      alertLevel: 'safe',
      message: 'Sem limite estabelecido',
    };
  }

  const percentage = (totalDose / limit) * 100;

  let alertLevel: CumulativeAlertLevel;
  let message: string;

  if (totalDose > limit) {
    alertLevel = 'exceeded';
    message = `DOSE EXCEDIDA! Total: ${totalDose.toFixed(1)} mg/m² (limite: ${limit} mg/m²)`;
  } else if (percentage >= 90) {
    alertLevel = 'near-limit';
    message = `Próximo do limite: ${totalDose.toFixed(1)} mg/m² de ${limit} mg/m² (${percentage.toFixed(1)}%)`;
  } else if (percentage >= 60) {
    alertLevel = 'warning';
    message = `Atenção: ${totalDose.toFixed(1)} mg/m² de ${limit} mg/m² (${percentage.toFixed(1)}%)`;
  } else {
    alertLevel = 'safe';
    message = `Dose segura: ${totalDose.toFixed(1)} mg/m² de ${limit} mg/m² (${percentage.toFixed(1)}%)`;
  }

  return { totalDose, limit, percentage, alertLevel, message };
}
