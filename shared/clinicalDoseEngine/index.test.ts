import { describe, expect, it } from 'vitest';
import {
  calculateBSA,
  calculateEGFR,
  classifyRenalFunction,
  calculateECOGAdjustment,
  calculateAgeAdjustment,
  calculateGlobalAdjustment,
  calculateDerivedValues,
  calculateDrugDose,
  calculateDrugDoseLegacy,
  validateCumulativeDose,
} from './index';
import { isPositiveFinite, isNonNegativeFinite, safeRound, clamp, toSafeNumber } from './safemath';

// ─── safemath ──────────────────────────────────────────────────────────────

describe('safemath', () => {
  describe('isPositiveFinite', () => {
    it('retorna true para números positivos finitos', () => {
      expect(isPositiveFinite(1)).toBe(true);
      expect(isPositiveFinite(0.001)).toBe(true);
      expect(isPositiveFinite(999999)).toBe(true);
    });

    it('retorna false para zero, negativos e não-finitos', () => {
      expect(isPositiveFinite(0)).toBe(false);
      expect(isPositiveFinite(-1)).toBe(false);
      expect(isPositiveFinite(NaN)).toBe(false);
      expect(isPositiveFinite(Infinity)).toBe(false);
      expect(isPositiveFinite(-Infinity)).toBe(false);
    });

    it('retorna false para não-números', () => {
      expect(isPositiveFinite('5')).toBe(false);
      expect(isPositiveFinite(null)).toBe(false);
      expect(isPositiveFinite(undefined)).toBe(false);
    });
  });

  describe('isNonNegativeFinite', () => {
    it('aceita zero', () => {
      expect(isNonNegativeFinite(0)).toBe(true);
    });
  });

  describe('safeRound', () => {
    it('arredonda para N casas decimais', () => {
      expect(safeRound(1.2345, 2)).toBe(1.23);
      expect(safeRound(1.2355, 2)).toBe(1.24);
      expect(safeRound(1.5, 0)).toBe(2);
    });

    it('retorna 0 para NaN/Infinity', () => {
      expect(safeRound(NaN, 2)).toBe(0);
      expect(safeRound(Infinity, 2)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('limita entre min e max', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('retorna min para NaN', () => {
      expect(clamp(NaN, 0, 10)).toBe(0);
    });
  });

  describe('toSafeNumber', () => {
    it('converte string para número', () => {
      expect(toSafeNumber('3.14')).toBe(3.14);
    });

    it('retorna fallback para string inválida', () => {
      expect(toSafeNumber('abc', 99)).toBe(99);
    });

    it('retorna fallback para null/undefined', () => {
      expect(toSafeNumber(null, 0)).toBe(0);
      expect(toSafeNumber(undefined, 0)).toBe(0);
    });
  });
});

// ─── BSA ────────────────────────────────────────────────────────────────────

describe('calculateBSA', () => {
  it('calcula BSA corretamente para homem 70kg/170cm (DuBois)', () => {
    const bsa = calculateBSA(70, 170);
    expect(bsa).toBeCloseTo(1.81, 1);
  });

  it('calcula BSA para mulher 55kg/160cm', () => {
    const bsa = calculateBSA(55, 160);
    expect(bsa).toBeCloseTo(1.56, 1);
  });

  it('retorna 0 para peso ou altura inválidos', () => {
    expect(calculateBSA(0, 170)).toBe(0);
    expect(calculateBSA(70, 0)).toBe(0);
    expect(calculateBSA(-10, 170)).toBe(0);
    expect(calculateBSA(NaN, 170)).toBe(0);
  });
});

// ─── eGFR ───────────────────────────────────────────────────────────────────

describe('calculateEGFR', () => {
  it('calcula eGFR para homem jovem com creatinina normal', () => {
    const egfr = calculateEGFR(1.0, 30, 'M');
    expect(egfr).toBeGreaterThan(90);
    expect(egfr).toBeLessThan(150);
  });

  it('calcula eGFR para mulher idosa com creatinina elevada', () => {
    const egfr = calculateEGFR(2.0, 80, 'F');
    expect(egfr).toBeGreaterThan(0);
    expect(egfr).toBeLessThan(60);
  });

  it('retorna 0 para dados inválidos', () => {
    expect(calculateEGFR(0, 30, 'M')).toBe(0);
    expect(calculateEGFR(1.0, 0, 'M')).toBe(0);
    expect(calculateEGFR(NaN, 30, 'M')).toBe(0);
    expect(calculateEGFR(1.0, 30, 'X' as any)).toBe(0);
  });

  it('eGFR diminui com a idade', () => {
    const young = calculateEGFR(1.0, 25, 'M');
    const old = calculateEGFR(1.0, 75, 'M');
    expect(young).toBeGreaterThan(old);
  });

  it('eGFR diminui com creatinina mais alta', () => {
    const low = calculateEGFR(0.8, 50, 'M');
    const high = calculateEGFR(2.0, 50, 'M');
    expect(low).toBeGreaterThan(high);
  });
});

// ─── Classificação Renal ────────────────────────────────────────────────────

describe('classifyRenalFunction', () => {
  it('classifica eGFR >= 60 como green', () => {
    const result = classifyRenalFunction(90);
    expect(result.status).toBe('green');
  });

  it('classifica eGFR 30-59 como yellow', () => {
    const result = classifyRenalFunction(45);
    expect(result.status).toBe('yellow');
  });

  it('classifica eGFR < 30 como red', () => {
    const result = classifyRenalFunction(20);
    expect(result.status).toBe('red');
  });

  it('classifica eGFR negativo como red', () => {
    const result = classifyRenalFunction(-5);
    expect(result.status).toBe('red');
  });
});

// ─── ECOG ───────────────────────────────────────────────────────────────────

describe('calculateECOGAdjustment', () => {
  it('ECOG 0-1 retorna 1.0 (sem ajuste)', () => {
    expect(calculateECOGAdjustment(0)).toBe(1.0);
    expect(calculateECOGAdjustment(1)).toBe(1.0);
  });

  it('ECOG 2 retorna 0.85', () => {
    expect(calculateECOGAdjustment(2)).toBe(0.85);
  });

  it('ECOG 3-4 retorna 0.65', () => {
    expect(calculateECOGAdjustment(3)).toBe(0.65);
    expect(calculateECOGAdjustment(4)).toBe(0.65);
  });
});

// ─── Ajuste por Idade ───────────────────────────────────────────────────────

describe('calculateAgeAdjustment', () => {
  it('retorna 1.0 para paciente jovem', () => {
    expect(calculateAgeAdjustment(50, 0)).toBe(1.0);
  });

  it('retorna 0.9 para paciente > 75 com ECOG >= 2', () => {
    expect(calculateAgeAdjustment(80, 2)).toBe(0.9);
    expect(calculateAgeAdjustment(80, 3)).toBe(0.9);
  });

  it('retorna 1.0 para paciente > 75 com ECOG < 2', () => {
    expect(calculateAgeAdjustment(80, 1)).toBe(1.0);
  });
});

// ─── Ajuste Global ──────────────────────────────────────────────────────────

describe('calculateGlobalAdjustment', () => {
  it('combina ECOG e idade', () => {
    // ECOG 2 (0.85) * Idade 80 com ECOG 2 (0.9) = 0.765
    const factor = calculateGlobalAdjustment(80, 2);
    expect(factor).toBeCloseTo(0.765, 2);
  });

  it('retorna 1.0 para paciente jovem com ECOG 0', () => {
    expect(calculateGlobalAdjustment(30, 0)).toBe(1.0);
  });
});

// ─── Valores Derivados ──────────────────────────────────────────────────────

describe('calculateDerivedValues', () => {
  it('calcula todos os valores para paciente válido', () => {
    const result = calculateDerivedValues({
      age: 50,
      sex: 'M',
      weight: 70,
      height: 170,
      creatinine: 1.0,
      ecog: 0,
    });

    expect(result).not.toBeNull();
    expect(result!.bsa).toBeGreaterThan(1.5);
    expect(result!.egfr).toBeGreaterThan(60);
    expect(result!.renalStatus).toBe('green');
    expect(result!.ecogAdjustmentFactor).toBe(1.0);
    expect(result!.globalAdjustmentFactor).toBe(1.0);
  });

  it('retorna null para dados insuficientes', () => {
    expect(calculateDerivedValues({
      age: 0,
      sex: 'M',
      weight: 70,
      height: 170,
      creatinine: 1.0,
      ecog: 0,
    })).toBeNull();
  });
});

// ─── Cálculo de Dose de Droga ───────────────────────────────────────────────

describe('calculateDrugDose', () => {
  it('calcula dose mg/m² corretamente', () => {
    const dose = calculateDrugDose({
      baseDose: 100,
      doseUnit: 'mg/m²',
      bsa: 1.8,
      weight: 70,
    });
    expect(dose).toBeCloseTo(180, 0);
  });

  it('calcula dose mg/kg corretamente', () => {
    const dose = calculateDrugDose({
      baseDose: 5,
      doseUnit: 'mg/kg',
      bsa: 1.8,
      weight: 70,
    });
    expect(dose).toBeCloseTo(350, 0);
  });

  it('calcula dose fixa (mg) corretamente', () => {
    const dose = calculateDrugDose({
      baseDose: 500,
      doseUnit: 'mg',
      bsa: 1.8,
      weight: 70,
    });
    expect(dose).toBe(500);
  });

  it('calcula dose AUC (Calvert) corretamente', () => {
    const dose = calculateDrugDose({
      baseDose: 5,
      doseUnit: 'AUC',
      bsa: 1.8,
      weight: 70,
      gfrAbsolute: 90,
    });
    // GFR absoluto 90 mL/min: AUC 5 * (90 + 25) = 575.
    expect(dose).toBeCloseTo(575, 0);
  });

  it('aplica fator de ajuste', () => {
    const dose = calculateDrugDose({
      baseDose: 100,
      doseUnit: 'mg/m²',
      bsa: 1.8,
      weight: 70,
      adjustmentFactor: 0.75,
    });
    expect(dose).toBeCloseTo(135, 0);
  });

  it('respeita dose máxima', () => {
    const dose = calculateDrugDose({
      baseDose: 100,
      doseUnit: 'mg/m²',
      bsa: 2.5,
      weight: 100,
      maxDose: 200,
    });
    expect(dose).toBe(200);
  });

  it('retorna 0 para BSA inválido com dose mg/m²', () => {
    expect(calculateDrugDose({
      baseDose: 100,
      doseUnit: 'mg/m²',
      bsa: 0,
      weight: 70,
    })).toBe(0);
  });

  it('retorna 0 para dose base inválida', () => {
    expect(calculateDrugDose({
      baseDose: 0,
      doseUnit: 'mg/m²',
      bsa: 1.8,
      weight: 70,
    })).toBe(0);
  });
});

// ─── Legacy wrapper ─────────────────────────────────────────────────────────

describe('calculateDrugDoseLegacy', () => {
  it('mantém compatibilidade com assinatura posicional', () => {
    const dose = calculateDrugDoseLegacy(100, 'mg/m²', 1.8, 70, 1.0);
    expect(dose).toBeCloseTo(180, 0);
  });
});

// ─── Dose Cumulativa ────────────────────────────────────────────────────────

describe('validateCumulativeDose', () => {
  it('classifica dose segura de doxorrubicina', () => {
    const result = validateCumulativeDose('Doxorrubicina', 50, 100);
    expect(result.alertLevel).toBe('safe');
    expect(result.totalDose).toBe(150);
    expect(result.limit).toBe(450);
  });

  it('classifica dose warning de doxorrubicina (>60%)', () => {
    const result = validateCumulativeDose('Doxorrubicina', 50, 250);
    expect(result.alertLevel).toBe('warning');
  });

  it('classifica dose near-limit de doxorrubicina (>90%)', () => {
    const result = validateCumulativeDose('Doxorrubicina', 50, 370);
    expect(result.alertLevel).toBe('near-limit');
  });

  it('classifica dose excedida de doxorrubicina', () => {
    const result = validateCumulativeDose('Doxorrubicina', 50, 450);
    expect(result.alertLevel).toBe('exceeded');
    expect(result.totalDose).toBe(500);
  });

  it('retorna safe para droga sem limite', () => {
    const result = validateCumulativeDose('Cisplatina', 100, 200);
    expect(result.alertLevel).toBe('safe');
    expect(result.limit).toBe(0);
  });

  it('é case-insensitive para nome da droga', () => {
    const result = validateCumulativeDose('DOXORRUBICINA', 50, 100);
    expect(result.limit).toBe(450);
  });
});
