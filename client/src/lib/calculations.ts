import type { PatientData, CalculatedValues } from '@/types/calculator';

/**
 * Calcula a Superfície Corporal usando a fórmula de DuBois
 * SC = 0.007184 × Peso^0.425 × Altura^0.725
 */
export function calculateBSA(weight: number, height: number): number {
  const bsa = 0.007184 * Math.pow(weight, 0.425) * Math.pow(height, 0.725);
  return Math.round(bsa * 100) / 100; // 2 casas decimais
}

/**
 * Calcula eGFR usando CKD-EPI 2021 (sem raça)
 * Referência: https://www.kidney.org/professionals/kdoqi/gfr_calculator
 */
export function calculateEGFR(
  creatinine: number,
  age: number,
  sex: 'M' | 'F'
): number {
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

  return Math.round(egfr * 10) / 10; // 1 casa decimal
}

/**
 * Classifica a função renal em semáforo (ADDIKD)
 */
export function classifyRenalFunction(egfr: number): {
  status: 'green' | 'yellow' | 'red';
  label: string;
} {
  if (egfr >= 60) {
    return {
      status: 'green',
      label: 'Normal (≥60 mL/min) - Dose completa',
    };
  } else if (egfr >= 30) {
    return {
      status: 'yellow',
      label: 'Moderada (30-59 mL/min) - Cautela, possível redução',
    };
  } else {
    return {
      status: 'red',
      label: 'Grave (<30 mL/min) - Evitar ou reduzir fortemente',
    };
  }
}

/**
 * Calcula fator de ajuste baseado em ECOG
 */
export function calculateECOGAdjustment(ecog: 0 | 1 | 2 | 3 | 4): number {
  switch (ecog) {
    case 0:
    case 1:
      return 1.0; // 100% da dose
    case 2:
      return 0.85; // Redução de 15% (10-25%)
    case 3:
    case 4:
      return 0.65; // Redução de 35% (25-50%)
    default:
      return 1.0;
  }
}

/**
 * Calcula fator de ajuste adicional por idade
 */
export function calculateAgeAdjustment(
  age: number,
  ecog: 0 | 1 | 2 | 3 | 4
): number {
  if (age > 75 && ecog >= 2) {
    return 0.9; // Redução adicional de 10%
  }
  return 1.0;
}

/**
 * Calcula fator de ajuste global
 */
export function calculateGlobalAdjustment(
  age: number,
  ecog: 0 | 1 | 2 | 3 | 4
): number {
  const ecogFactor = calculateECOGAdjustment(ecog);
  const ageFactor = calculateAgeAdjustment(age, ecog);
  return ecogFactor * ageFactor;
}

/**
 * Calcula todos os valores derivados do paciente
 */
export function calculatePatientValues(
  patient: PatientData
): CalculatedValues {
  const bsa = calculateBSA(patient.weight, patient.height);
  const egfr = calculateEGFR(patient.creatinine, patient.age, patient.sex);
  const renalClassification = classifyRenalFunction(egfr);
  const ecogAdjustmentFactor = calculateECOGAdjustment(patient.ecog);
  const globalAdjustmentFactor = calculateGlobalAdjustment(
    patient.age,
    patient.ecog
  );

  return {
    bsa,
    egfr,
    renalStatus: renalClassification.status,
    renalStatusLabel: renalClassification.label,
    ecogAdjustmentFactor,
    globalAdjustmentFactor,
  };
}

/**
 * Calcula dose ajustada de uma droga
 */
export function calculateDrugDose(
  baseDose: number,
  doseUnit: 'mg/m²' | 'mg/kg' | 'mg' | 'AUC',
  bsa: number,
  weight: number,
  adjustmentFactor: number = 1.0,
  maxDose?: number
): number {
  let calculatedDose = baseDose;

  if (doseUnit === 'mg/m²') {
    calculatedDose = baseDose * bsa;
  } else if (doseUnit === 'mg/kg') {
    calculatedDose = baseDose * weight;
  } else if (doseUnit === 'AUC') {
    // AUC - retornar como referência (cálculo real requer fórmula de Calvert)
    return baseDose;
  }

  calculatedDose = calculatedDose * adjustmentFactor;

  // Aplicar dose máxima se definida
  if (maxDose !== undefined && calculatedDose > maxDose) {
    calculatedDose = maxDose;
  }

  return Math.round(calculatedDose * 10) / 10; // 1 casa decimal
}

/**
 * Valida dose cumulativa de antraciclinas
 */
export function validateCumulativeDose(
  drug: string,
  currentDose: number,
  previousDose: number
): {
  totalDose: number;
  limit: number;
  percentage: number;
  alertLevel: 'safe' | 'warning' | 'near-limit' | 'exceeded';
  message: string;
} {
  const limits: Record<string, number> = {
    doxorrubicina: 450,
    daunorrubicina: 550,
    idarrubicina: 150,
    epirrubicina: 900,
    mitoxantrona: 160,
  };

  const drugLower = drug.toLowerCase();
  const limit = limits[drugLower] || 0;

  if (limit === 0) {
    return {
      totalDose: currentDose + previousDose,
      limit: 0,
      percentage: 0,
      alertLevel: 'safe',
      message: 'Sem limite estabelecido',
    };
  }

  const totalDose = currentDose + previousDose;
  const percentage = (totalDose / limit) * 100;

  let alertLevel: 'safe' | 'warning' | 'near-limit' | 'exceeded';
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

  return {
    totalDose,
    limit,
    percentage,
    alertLevel,
    message,
  };
}
