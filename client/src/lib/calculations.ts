/**
 * Camada de compatibilidade — redireciona para o motor clínico centralizado.
 *
 * Todos os cálculos vivem em `shared/clinicalDoseEngine`.
 * Este arquivo mantém a API pública original para que imports existentes
 * continuem funcionando sem alteração.
 */

import {
  calculateBSA as _calculateBSA,
  calculateEGFR as _calculateEGFR,
  classifyRenalFunction as _classifyRenalFunction,
  calculateECOGAdjustment as _calculateECOGAdjustment,
  calculateAgeAdjustment as _calculateAgeAdjustment,
  calculateGlobalAdjustment as _calculateGlobalAdjustment,
  calculateDrugDoseLegacy,
  validateCumulativeDose as _validateCumulativeDose,
  calculateDerivedValues,
} from '@shared/clinicalDoseEngine';

import type { PatientData, CalculatedValues } from '@/types/calculator';

// Re-exports diretos (mesma assinatura)
export const calculateBSA = _calculateBSA;
export const calculateEGFR = _calculateEGFR;
export const classifyRenalFunction = _classifyRenalFunction;
export const calculateECOGAdjustment = _calculateECOGAdjustment;
export const calculateAgeAdjustment = _calculateAgeAdjustment;
export const calculateGlobalAdjustment = _calculateGlobalAdjustment;
export const validateCumulativeDose = _validateCumulativeDose;

// Mantém assinatura posicional original
export const calculateDrugDose = calculateDrugDoseLegacy;

/**
 * Calcula todos os valores derivados do paciente.
 * Mantém a assinatura original que recebe PatientData e retorna CalculatedValues.
 */
export function calculatePatientValues(patient: PatientData): CalculatedValues {
  const result = calculateDerivedValues({
    age: patient.age,
    sex: patient.sex,
    weight: patient.weight,
    height: patient.height,
    creatinine: patient.creatinine,
    ecog: patient.ecog,
  });

  // Fallback seguro se dados insuficientes
  if (!result) {
    return {
      bsa: 0,
      egfr: 0,
      renalStatus: 'red',
      renalStatusLabel: 'Dados insuficientes para cálculo',
      ecogAdjustmentFactor: 1,
      globalAdjustmentFactor: 1,
    };
  }

  return result;
}
