/**
 * Regras de cálculo específicas para o protocolo FluCyTBI Haplo.
 *
 * Este módulo contém lógica de pós-processamento que é aplicada APÓS o cálculo
 * padrão de doses (calculateDrugDose). Inclui:
 *
 * 1. Ajuste renal da Fludarabina por faixas de clearance (Cockcroft-Gault)
 * 2. Cálculo automático da Mesna (125% da dose diária de PTCy)
 * 3. TBI como procedimento fixo (200 cGy, sem cálculo por BSA/peso)
 *
 * IMPORTANTE: Estas regras são funções puras, sem dependência de React/UI.
 */

import type { Drug, CalculatedValues } from '@/types/calculator';
import { safeRound } from '@shared/clinicalDoseEngine';

// ─── Constantes do Protocolo ─────────────────────────────────────────────────

export const FLUCYTBI_PROTOCOL_ID = 'flucytbi-haplo';

/** Faixas de ajuste renal da Fludarabina (Cockcroft-Gault) */
export const FLUDARABINE_RENAL_ADJUSTMENTS = [
  { minCCr: 46, maxCCr: 60, adjustedDose: 24, label: 'CCr 46–60 mL/min → 24 mg/m²' },
  { minCCr: 31, maxCCr: 45, adjustedDose: 22.5, label: 'CCr 31–45 mL/min → 22,5 mg/m²' },
  { minCCr: 21, maxCCr: 30, adjustedDose: 19.5, label: 'CCr 21–30 mL/min → 19,5 mg/m²' },
  { minCCr: 0, maxCCr: 20, adjustedDose: 15, label: 'CCr < 20 mL/min → 15 mg/m²' },
] as const;

/** Dose padrão de Fludarabina (sem ajuste renal) */
export const FLUDARABINE_STANDARD_DOSE = 30; // mg/m²

/** Fator de Mesna sobre a dose de PTCy */
export const MESNA_FACTOR = 1.25; // 125%

// ─── Ajuste Renal da Fludarabina ─────────────────────────────────────────────

/**
 * Calcula a dose ajustada de Fludarabina com base no clearance de creatinina.
 *
 * Usa eGFR como proxy para clearance (o sistema já calcula CKD-EPI 2021).
 * Para ajuste mais preciso, o protocolo recomenda Cockcroft-Gault,
 * mas na prática clínica ambos são aceitos para esta decisão.
 *
 * @param egfr - eGFR ou clearance de creatinina em mL/min
 * @param bsa - Superfície corporal em m²
 * @returns Objeto com dose ajustada e informações de ajuste
 */
export function calculateFludarabineAdjustedDose(
  egfr: number,
  bsa: number
): {
  baseDoseMgM2: number;
  calculatedDose: number;
  isAdjusted: boolean;
  adjustmentLabel: string;
} {
  if (!Number.isFinite(egfr) || !Number.isFinite(bsa) || bsa <= 0) {
    return {
      baseDoseMgM2: FLUDARABINE_STANDARD_DOSE,
      calculatedDose: 0,
      isAdjusted: false,
      adjustmentLabel: 'Dados insuficientes para cálculo',
    };
  }

  // Se clearance >= 61, dose padrão
  if (egfr >= 61) {
    return {
      baseDoseMgM2: FLUDARABINE_STANDARD_DOSE,
      calculatedDose: safeRound(FLUDARABINE_STANDARD_DOSE * bsa, 1),
      isAdjusted: false,
      adjustmentLabel: 'Dose padrão (ClCr ≥ 61 mL/min)',
    };
  }

  // Encontrar faixa de ajuste
  for (const range of FLUDARABINE_RENAL_ADJUSTMENTS) {
    if (egfr >= range.minCCr && egfr <= range.maxCCr) {
      return {
        baseDoseMgM2: range.adjustedDose,
        calculatedDose: safeRound(range.adjustedDose * bsa, 1),
        isAdjusted: true,
        adjustmentLabel: `⚠️ ${range.label}`,
      };
    }
  }

  // Fallback para CCr muito baixo (< 0 ou edge case)
  const lowestRange = FLUDARABINE_RENAL_ADJUSTMENTS[FLUDARABINE_RENAL_ADJUSTMENTS.length - 1];
  return {
    baseDoseMgM2: lowestRange.adjustedDose,
    calculatedDose: safeRound(lowestRange.adjustedDose * bsa, 1),
    isAdjusted: true,
    adjustmentLabel: `⚠️ ${lowestRange.label}`,
  };
}

// ─── Cálculo da Mesna ────────────────────────────────────────────────────────

/**
 * Calcula a dose de Mesna como 125% da dose diária de Ciclofosfamida PTCy.
 *
 * @param ptcyDailyDose - Dose diária de Ciclofosfamida PTCy em mg
 * @returns Dose de Mesna em mg
 */
export function calculateMesnaDose(ptcyDailyDose: number): number {
  if (!Number.isFinite(ptcyDailyDose) || ptcyDailyDose <= 0) return 0;
  return safeRound(ptcyDailyDose * MESNA_FACTOR, 1);
}

// ─── Cockcroft-Gault ─────────────────────────────────────────────────────────

/**
 * Calcula o Clearance de Creatinina pela fórmula de Cockcroft-Gault.
 * Usado especificamente para ajuste renal da Fludarabina neste protocolo.
 *
 * @param age - Idade em anos
 * @param weight - Peso em kg
 * @param creatinine - Creatinina sérica em mg/dL
 * @param sex - Sexo ('M' ou 'F')
 * @returns Clearance de creatinina em mL/min
 */
export function calculateCockcroftGault(
  age: number,
  weight: number,
  creatinine: number,
  sex: 'M' | 'F'
): number {
  if (!Number.isFinite(age) || age <= 0) return 0;
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  if (!Number.isFinite(creatinine) || creatinine <= 0) return 0;

  const factor = sex === 'F' ? 0.85 : 1.0;
  const ccr = ((140 - age) * weight * factor) / (72 * creatinine);
  return safeRound(ccr, 1);
}

// ─── Pós-processamento do Protocolo FluCyTBI ─────────────────────────────────

/**
 * Aplica regras de cálculo específicas do FluCyTBI APÓS o cálculo padrão de doses.
 *
 * Esta função é chamada pelo hook useProtocolDoseCalculation quando o protocolo
 * selecionado é 'flucytbi-haplo'. Ela modifica as doses calculadas para:
 *
 * 1. Ajustar Fludarabina por função renal
 * 2. Calcular Mesna como 125% da PTCy
 * 3. Manter TBI como dose fixa
 *
 * @param drugs - Array de drogas já calculadas pelo motor padrão
 * @param calculatedValues - Valores derivados do paciente (BSA, eGFR, etc.)
 * @param weight - Peso do paciente em kg
 * @param patientAge - Idade do paciente
 * @param patientSex - Sexo do paciente
 * @param patientCreatinine - Creatinina sérica do paciente
 * @returns Array de drogas com doses ajustadas
 */
export function applyFluCyTBIRules(
  drugs: Drug[],
  calculatedValues: CalculatedValues,
  weight: number,
  patientAge?: number,
  patientSex?: 'M' | 'F',
  patientCreatinine?: number,
): Drug[] {
  if (!drugs.length || !calculatedValues) return drugs;

  // Calcular CCr (Cockcroft-Gault) se dados disponíveis, senão usar eGFR
  let clearance = calculatedValues.egfr;
  let clearanceSource = 'eGFR (CKD-EPI 2021)';
  if (patientAge && patientSex && patientCreatinine) {
    clearance = calculateCockcroftGault(patientAge, weight, patientCreatinine, patientSex);
    clearanceSource = 'ClCr (Cockcroft-Gault)';
  }

  // Encontrar dose de PTCy para calcular Mesna
  const ptcyDrug = drugs.find(d => d.name.includes('PTCy'));
  const ptcyDailyDose = ptcyDrug?.calculatedDose ?? 0;

  return drugs.map((drug) => {
    // 1. Ajuste renal da Fludarabina
    if (drug.name === 'Fludarabina') {
      const adjusted = calculateFludarabineAdjustedDose(clearance, calculatedValues.bsa);
      const observations = adjusted.isAdjusted
        ? `${drug.observations ?? ''}\n⚠️ AJUSTE RENAL APLICADO (${clearanceSource}: ${clearance.toFixed(0)} mL/min): ${adjusted.adjustmentLabel}`
        : drug.observations;
      return {
        ...drug,
        calculatedDose: adjusted.calculatedDose,
        observations: observations ?? drug.observations,
      };
    }

    // 2. TBI — manter dose fixa
    if (drug.doseUnit === 'cGy') {
      return { ...drug, calculatedDose: drug.dose };
    }

    // 3. Mesna — calcular como 125% da PTCy
    if (drug.name.includes('Mesna')) {
      const mesnaDose = calculateMesnaDose(ptcyDailyDose);
      return {
        ...drug,
        calculatedDose: mesnaDose,
        observations: `${drug.observations ?? ''}\nDose calculada: ${mesnaDose.toFixed(1)} mg (125% de ${ptcyDailyDose.toFixed(1)} mg de PTCy)`,
      };
    }

    // Demais drogas: manter cálculo padrão
    return drug;
  });
}
