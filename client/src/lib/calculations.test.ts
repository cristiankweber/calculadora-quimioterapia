import { describe, it, expect } from 'vitest';
import {
  calculateBSA,
  calculateEGFR,
  classifyRenalFunction,
  calculateECOGAdjustment,
  calculateGlobalAdjustment,
  calculateDrugDose,
  validateCumulativeDose,
} from './calculations';

describe('Cálculo de Superfície Corporal (BSA)', () => {
  it('deve calcular BSA corretamente usando fórmula de DuBois', () => {
    // Paciente: 70kg, 170cm
    const bsa = calculateBSA(70, 170);
    expect(bsa).toBeCloseTo(1.81, 2);
  });

  it('deve calcular BSA para paciente pediátrico', () => {
    // Paciente: 30kg, 130cm
    const bsa = calculateBSA(30, 130);
    expect(bsa).toBeCloseTo(1.04, 2);
  });

  it('deve calcular BSA para paciente obeso', () => {
    // Paciente: 120kg, 180cm
    const bsa = calculateBSA(120, 180);
    expect(bsa).toBeCloseTo(2.37, 2);
  });
});

describe('Cálculo de eGFR (CKD-EPI 2021)', () => {
  it('deve calcular eGFR para homem adulto', () => {
    // Homem, 50 anos, creatinina 1.2 mg/dL
    const egfr = calculateEGFR(1.2, 50, 'M');
    expect(egfr).toBeGreaterThan(60);
    expect(egfr).toBeLessThan(100);
  });

  it('deve calcular eGFR para mulher adulta', () => {
    // Mulher, 60 anos, creatinina 1.0 mg/dL
    const egfr = calculateEGFR(1.0, 60, 'F');
    expect(egfr).toBeGreaterThan(60);
  });

  it('deve calcular eGFR baixo para creatinina elevada', () => {
    // Homem, 70 anos, creatinina 3.0 mg/dL
    const egfr = calculateEGFR(3.0, 70, 'M');
    expect(egfr).toBeLessThan(30);
  });
});

describe('Classificação de Função Renal', () => {
  it('deve classificar como verde (normal) para eGFR >= 60', () => {
    const result = classifyRenalFunction(80);
    expect(result.status).toBe('green');
    expect(result.label).toContain('Normal');
  });

  it('deve classificar como amarelo (moderada) para eGFR 30-59', () => {
    const result = classifyRenalFunction(45);
    expect(result.status).toBe('yellow');
    expect(result.label).toContain('Moderada');
  });

  it('deve classificar como vermelho (grave) para eGFR < 30', () => {
    const result = classifyRenalFunction(20);
    expect(result.status).toBe('red');
    expect(result.label).toContain('Grave');
  });
});

describe('Ajuste por ECOG', () => {
  it('deve retornar 100% para ECOG 0 ou 1', () => {
    expect(calculateECOGAdjustment(0)).toBe(1.0);
    expect(calculateECOGAdjustment(1)).toBe(1.0);
  });

  it('deve retornar ~85% para ECOG 2', () => {
    expect(calculateECOGAdjustment(2)).toBe(0.85);
  });

  it('deve retornar ~65% para ECOG 3 ou 4', () => {
    expect(calculateECOGAdjustment(3)).toBe(0.65);
    expect(calculateECOGAdjustment(4)).toBe(0.65);
  });
});

describe('Ajuste Global (ECOG + Idade)', () => {
  it('deve aplicar apenas ajuste ECOG para paciente jovem', () => {
    const factor = calculateGlobalAdjustment(50, 2);
    expect(factor).toBe(0.85);
  });

  it('deve aplicar ajuste adicional para paciente >75 anos com ECOG >= 2', () => {
    const factor = calculateGlobalAdjustment(80, 2);
    expect(factor).toBeCloseTo(0.765, 3); // 0.85 * 0.9
  });

  it('não deve aplicar ajuste adicional de idade para ECOG < 2', () => {
    const factor = calculateGlobalAdjustment(80, 1);
    expect(factor).toBe(1.0);
  });
});

describe('Cálculo de Dose de Droga', () => {
  it('deve calcular dose em mg/m² corretamente', () => {
    // 100 mg/m², BSA 1.8 m², sem ajuste
    const dose = calculateDrugDose(100, 'mg/m²', 1.8, 70, 1.0);
    expect(dose).toBeCloseTo(180, 1);
  });

  it('deve calcular dose em mg/kg corretamente', () => {
    // 5 mg/kg, peso 70kg, sem ajuste
    const dose = calculateDrugDose(5, 'mg/kg', 1.8, 70, 1.0);
    expect(dose).toBeCloseTo(350, 1);
  });

  it('deve calcular dose fixa em mg corretamente', () => {
    // 400 mg fixo
    const dose = calculateDrugDose(400, 'mg', 1.8, 70, 1.0);
    expect(dose).toBe(400);
  });

  it('deve aplicar fator de ajuste corretamente', () => {
    // 100 mg/m², BSA 1.8 m², ajuste 75%
    const dose = calculateDrugDose(100, 'mg/m²', 1.8, 70, 0.75);
    expect(dose).toBeCloseTo(135, 1);
  });
});

describe('Validação de Dose Cumulativa', () => {
  it('deve classificar como segura para dose baixa de doxorrubicina', () => {
    const result = validateCumulativeDose('doxorrubicina', 50, 100);
    expect(result.alertLevel).toBe('safe');
    expect(result.totalDose).toBe(150);
    expect(result.limit).toBe(450);
  });

  it('deve alertar quando próximo do limite', () => {
    const result = validateCumulativeDose('doxorrubicina', 50, 360);
    expect(result.alertLevel).toBe('near-limit');
    expect(result.percentage).toBeGreaterThan(90);
  });

  it('deve alertar quando exceder o limite', () => {
    const result = validateCumulativeDose('doxorrubicina', 100, 400);
    expect(result.alertLevel).toBe('exceeded');
    expect(result.totalDose).toBeGreaterThan(result.limit);
  });

  it('deve retornar safe para droga sem limite estabelecido', () => {
    const result = validateCumulativeDose('vincristina', 2, 10);
    expect(result.alertLevel).toBe('safe');
    expect(result.limit).toBe(0);
  });
});
