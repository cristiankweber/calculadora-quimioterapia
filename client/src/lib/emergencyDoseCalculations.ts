// Cálculos de doses para medicações de emergência em hematologia

export interface EmergencyPatientData {
  weight: number; // kg
  bsa: number; // m²
  egfr: number; // mL/min
}

export interface CalculatedDose {
  value: number;
  unit: string;
  calculation: string; // Explicação do cálculo
}

/**
 * Calcula dose de Hidroxiureia para citorredução em LMA hiperleucocitária
 * Dose: 50-100 mg/kg/dia
 */
export function calculateHydroxyureaDose(weight: number): CalculatedDose {
  const doseMin = weight * 50;
  const doseMax = weight * 100;
  
  return {
    value: doseMin,
    unit: 'mg/dia',
    calculation: `${doseMin.toFixed(0)}-${doseMax.toFixed(0)} mg/dia (50-100 mg/kg × ${weight}kg)`
  };
}

/**
 * Calcula dose de Rasburicase para profilaxia/tratamento de Síndrome de Lise Tumoral
 * Dose: 0,2 mg/kg/dia EV
 */
export function calculateRasburicaseDose(weight: number): CalculatedDose {
  const dose = weight * 0.2;
  
  return {
    value: dose,
    unit: 'mg/dia',
    calculation: `${dose.toFixed(1)} mg/dia (0,2 mg/kg × ${weight}kg)`
  };
}

/**
 * Calcula dose de Alopurinol para profilaxia de Síndrome de Lise Tumoral
 * Dose: 600-800 mg/dia VO (ajustado por função renal)
 */
export function calculateAllopurinolDose(egfr: number): CalculatedDose {
  let dose = 600;
  let adjustment = '';
  
  if (egfr < 30) {
    dose = 200;
    adjustment = ' (ajustado para eGFR < 30)';
  } else if (egfr < 60) {
    dose = 400;
    adjustment = ' (ajustado para eGFR < 60)';
  }
  
  return {
    value: dose,
    unit: 'mg/dia',
    calculation: `${dose} mg/dia${adjustment}`
  };
}

/**
 * Calcula dose de Bortezomibe para Mieloma com Insuficiência Renal
 * Dose: 1,3 mg/m² SC/EV (sem ajuste renal necessário)
 */
export function calculateBortezomibDose(bsa: number): CalculatedDose {
  const dose = bsa * 1.3;
  
  return {
    value: dose,
    unit: 'mg',
    calculation: `${dose.toFixed(2)} mg (1,3 mg/m² × ${bsa.toFixed(2)}m²)`
  };
}

/**
 * Calcula dose de Dexametasona para Mieloma
 * Dose: 40 mg VO/EV (fixa, não ajustada por peso)
 */
export function calculateDexamethasoneDose(): CalculatedDose {
  return {
    value: 40,
    unit: 'mg',
    calculation: '40 mg (dose fixa)'
  };
}

/**
 * Calcula dose de Insulina Regular + Glicose para hipercalemia
 * Doses fixas: 10 UI insulina + 50 mL glicose 50%
 */
export function calculateInsulinGlucoseDose(): { insulin: CalculatedDose; glucose: CalculatedDose } {
  return {
    insulin: {
      value: 10,
      unit: 'UI',
      calculation: '10 UI (dose fixa)'
    },
    glucose: {
      value: 50,
      unit: 'mL',
      calculation: '50 mL de glicose 50% (dose fixa)'
    }
  };
}

/**
 * Calcula dose de Gluconato de Cálcio 10% para hipercalemia
 * Dose: 10 mL EV (dose fixa)
 */
export function calculateCalciumGluconateDose(): CalculatedDose {
  return {
    value: 10,
    unit: 'mL',
    calculation: '10 mL de gluconato de cálcio 10% (dose fixa)'
  };
}

/**
 * Calcula dose de Resina de troca (Sorcal) para hipercalemia
 * Dose: 15-30 g VO/retal
 */
export function calculateSorcalDose(): CalculatedDose {
  return {
    value: 15,
    unit: 'g',
    calculation: '15-30 g VO ou retal (dose padrão)'
  };
}

/**
 * Calcula dose de Crioprecipitado para CIVD
 * Dose: 1 unidade/10 kg
 */
export function calculateCryoprecipitateDose(weight: number): CalculatedDose {
  const dose = Math.ceil(weight / 10);
  
  return {
    value: dose,
    unit: 'unidades',
    calculation: `${dose} unidade(s) (1 unidade/10kg × ${weight}kg)`
  };
}

/**
 * Calcula dose de Plasma Fresco Congelado para CIVD
 * Dose: 10-15 mL/kg
 */
export function calculateFFPDose(weight: number): CalculatedDose {
  const doseMin = weight * 10;
  const doseMax = weight * 15;
  
  return {
    value: doseMin,
    unit: 'mL',
    calculation: `${doseMin.toFixed(0)}-${doseMax.toFixed(0)} mL (10-15 mL/kg × ${weight}kg)`
  };
}

/**
 * Calcula dose de Concentrado de Plaquetas para CIVD
 * Dose: 1 unidade/10 kg
 */
export function calculatePlateletDose(weight: number): CalculatedDose {
  const dose = Math.ceil(weight / 10);
  
  return {
    value: dose,
    unit: 'unidades',
    calculation: `${dose} unidade(s) (1 unidade/10kg × ${weight}kg)`
  };
}

/**
 * Função principal que calcula todas as doses baseadas no nome da medicação
 */
export function calculateEmergencyDose(
  medicationName: string,
  patientData: EmergencyPatientData
): CalculatedDose | null {
  const { weight, bsa, egfr } = patientData;
  
  // Normalizar nome da medicação (remover espaços extras, case-insensitive)
  const medName = medicationName.toLowerCase().trim();
  
  if (medName.includes('hidroxiureia') || medName.includes('hydroxyurea')) {
    return calculateHydroxyureaDose(weight);
  }
  
  if (medName.includes('rasburicase')) {
    return calculateRasburicaseDose(weight);
  }
  
  if (medName.includes('alopurinol')) {
    return calculateAllopurinolDose(egfr);
  }
  
  if (medName.includes('bortezomibe') || medName.includes('bortezomib')) {
    return calculateBortezomibDose(bsa);
  }
  
  if (medName.includes('dexametasona') || medName.includes('dexamethasone')) {
    return calculateDexamethasoneDose();
  }
  
  if (medName.includes('insulina') && medName.includes('glicose')) {
    const doses = calculateInsulinGlucoseDose();
    return doses.insulin; // Retorna insulina por padrão
  }
  
  if (medName.includes('gluconato') && medName.includes('cálcio')) {
    return calculateCalciumGluconateDose();
  }
  
  if (medName.includes('sorcal') || medName.includes('resina')) {
    return calculateSorcalDose();
  }
  
  if (medName.includes('crioprecipitado')) {
    return calculateCryoprecipitateDose(weight);
  }
  
  if (medName.includes('plasma')) {
    return calculateFFPDose(weight);
  }
  
  if (medName.includes('plaqueta')) {
    return calculatePlateletDose(weight);
  }
  
  // Medicação não reconhecida ou sem cálculo automático
  return null;
}
