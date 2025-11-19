import { describe, it, expect } from 'vitest';
import { calculateDrugDose } from './calculations';

describe('Dose Máxima', () => {
  it('deve respeitar dose máxima quando calculada exceder o limite', () => {
    // Vincristina: dose base 2 mg, mas com SC alta poderia exceder
    const dose = calculateDrugDose(
      2,      // dose base
      'mg',   // unidade
      2.5,    // BSA (não usado para dose fixa)
      80,     // peso
      1.0,    // fator de ajuste
      2       // maxDose = 2 mg
    );
    
    expect(dose).toBe(2);
  });

  it('deve aplicar dose máxima mesmo com fator de ajuste', () => {
    // Vincristina com dose por m² que excederia o máximo
    const dose = calculateDrugDose(
      1.4,    // dose base mg/m²
      'mg/m²',
      2.0,    // BSA = 2.0 → 2.8 mg sem limite
      70,
      1.0,
      2       // maxDose = 2 mg
    );
    
    expect(dose).toBe(2);
  });

  it('não deve aplicar dose máxima se calculada for menor', () => {
    const dose = calculateDrugDose(
      1.0,
      'mg/m²',
      1.2,    // BSA pequena → 1.2 mg
      50,
      1.0,
      2       // maxDose = 2 mg
    );
    
    expect(dose).toBe(1.2);
  });

  it('deve funcionar sem dose máxima definida', () => {
    const dose = calculateDrugDose(
      50,
      'mg/m²',
      1.8,
      70,
      1.0
      // sem maxDose
    );
    
    expect(dose).toBe(90); // 50 * 1.8
  });

  it('deve aplicar dose máxima após ajuste por ECOG', () => {
    // Dose que após ajuste ainda excede o máximo
    const dose = calculateDrugDose(
      2.5,
      'mg',
      1.8,
      70,
      0.85,   // ajuste ECOG 2 (85%)
      2       // maxDose = 2 mg
    );
    
    // 2.5 * 0.85 = 2.125 → limitado a 2
    expect(dose).toBe(2);
  });
});
