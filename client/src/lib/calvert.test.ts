import { describe, it, expect } from 'vitest';
import { calculateDrugDose } from './calculations';

describe('Fórmula de Calvert para Carboplatina', () => {
  it('deve calcular dose de Carboplatina usando fórmula de Calvert', () => {
    // Fórmula: Dose (mg) = AUC × (eGFR + 25)
    // Exemplo: AUC 5, eGFR 90 → Dose = 5 × (90 + 25) = 575 mg
    const dose = calculateDrugDose(
      5,      // AUC desejada
      'AUC',  // unidade
      1.8,    // BSA (não usado para AUC)
      70,     // peso (não usado para AUC)
      1.0,    // fator de ajuste
      undefined, // sem maxDose
      90      // eGFR
    );
    
    expect(dose).toBe(575); // 5 × (90 + 25)
  });

  it('deve calcular dose com eGFR reduzido', () => {
    // Paciente com função renal reduzida
    // AUC 5, eGFR 45 → Dose = 5 × (45 + 25) = 350 mg
    const dose = calculateDrugDose(
      5,
      'AUC',
      1.8,
      70,
      1.0,
      undefined,
      45      // eGFR reduzido
    );
    
    expect(dose).toBe(350); // 5 × (45 + 25)
  });

  it('deve calcular dose com AUC 6 (protocolo alternativo)', () => {
    // AUC 6, eGFR 80 → Dose = 6 × (80 + 25) = 630 mg
    const dose = calculateDrugDose(
      6,
      'AUC',
      1.8,
      70,
      1.0,
      undefined,
      80
    );
    
    expect(dose).toBe(630); // 6 × (80 + 25)
  });

  it('deve retornar AUC como referência se eGFR não fornecido', () => {
    // Se não houver eGFR, retorna AUC sem cálculo
    const dose = calculateDrugDose(
      5,
      'AUC',
      1.8,
      70,
      1.0,
      undefined
      // sem eGFR
    );
    
    expect(dose).toBe(5); // Retorna AUC como referência
  });

  it('deve aplicar fator de ajuste após cálculo de Calvert', () => {
    // AUC 5, eGFR 90, ajuste 85% → Dose = 5 × (90 + 25) × 0.85 = 488.75 → 488.8
    const dose = calculateDrugDose(
      5,
      'AUC',
      1.8,
      70,
      0.85,   // ajuste ECOG
      undefined,
      90
    );
    
    expect(dose).toBe(488.8); // 575 × 0.85 arredondado
  });

  it('deve calcular corretamente para paciente idoso com função renal preservada', () => {
    // Idoso, eGFR 75 → Dose = 5 × (75 + 25) = 500 mg
    const dose = calculateDrugDose(
      5,
      'AUC',
      1.7,
      65,
      1.0,
      undefined,
      75
    );
    
    expect(dose).toBe(500);
  });

  it('deve calcular para função renal limítrofe', () => {
    // eGFR 30 (limítrofe) → Dose = 5 × (30 + 25) = 275 mg
    const dose = calculateDrugDose(
      5,
      'AUC',
      1.8,
      70,
      1.0,
      undefined,
      30
    );
    
    expect(dose).toBe(275);
  });
});
