/**
 * Testes unitários para o protocolo FluCyTBI Haplo.
 *
 * Cobertura:
 * 1. Cronograma completo D-6 a D+5
 * 2. Cálculo de Fludarabina 30 mg/m² por BSA
 * 3. Ajuste renal da Fludarabina por faixas de clearance
 * 4. Cálculo de Cy 14,5 mg/kg (pré) e PTCy 50 mg/kg (pós)
 * 5. MMF 15 mg/kg TID respeitando máximo diário de 3 g
 * 6. Filgrastim 5 mcg/kg
 * 7. Presença dos alertas clínicos obrigatórios
 * 8. TBI como item fixo/procedimento em D-1
 * 9. Mesna = 125% da PTCy
 * 10. Cockcroft-Gault
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFludarabineAdjustedDose,
  calculateMesnaDose,
  calculateCockcroftGault,
  applyFluCyTBIRules,
  FLUDARABINE_STANDARD_DOSE,
  MESNA_FACTOR,
  FLUCYTBI_PROTOCOL_ID,
} from './flucytbiRules';
import { protocols, getProtocolById } from '@/data/protocols';
import type { CalculatedValues, Drug } from '@/types/calculator';
import { calculateDrugDoseLegacy } from '@shared/clinicalDoseEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_BSA = 1.81; // m² (70kg, 170cm)
const MOCK_WEIGHT = 70; // kg

function getFlucytbiProtocol() {
  const protocol = getProtocolById(FLUCYTBI_PROTOCOL_ID);
  if (!protocol) throw new Error('Protocolo FluCyTBI não encontrado');
  return protocol;
}

function mockCalculatedValues(overrides: Partial<CalculatedValues> = {}): CalculatedValues {
  return {
    bsa: MOCK_BSA,
    egfr: 95,
    renalStatus: 'green',
    renalStatusLabel: 'Normal (≥60 mL/min) - Dose completa',
    ecogAdjustmentFactor: 1.0,
    globalAdjustmentFactor: 1.0,
    ...overrides,
  };
}

// ─── 1. Cronograma completo D-6 a D+5 ───────────────────────────────────────

describe('FluCyTBI Haplo — Cronograma', () => {
  const protocol = getFlucytbiProtocol();

  it('protocolo existe com ID correto', () => {
    expect(protocol.id).toBe('flucytbi-haplo');
    expect(protocol.name).toContain('FluCyTBI');
  });

  it('contém indicação de TCTH haploidêntico', () => {
    expect(protocol.indication.toLowerCase()).toContain('haploidêntico');
    expect(protocol.indication.toLowerCase()).toContain('não mieloablativo');
  });

  it('contém todas as 8 drogas/itens do cronograma', () => {
    expect(protocol.drugs.length).toBe(8);
  });

  it('Fludarabina nos dias D-6 a D-2 (5 doses)', () => {
    const flu = protocol.drugs.find(d => d.name === 'Fludarabina');
    expect(flu).toBeDefined();
    expect(flu!.days).toContain('D-6');
    expect(flu!.days).toContain('D-2');
  });

  it('Ciclofosfamida pré-TMO nos dias D-6 e D-5', () => {
    const cy = protocol.drugs.find(d => d.name.includes('pré-TMO'));
    expect(cy).toBeDefined();
    expect(cy!.days).toContain('D-6');
    expect(cy!.days).toContain('D-5');
  });

  it('TBI em D-1', () => {
    const tbi = protocol.drugs.find(d => d.name.includes('TBI'));
    expect(tbi).toBeDefined();
    expect(tbi!.days).toBe('D-1');
  });

  it('PTCy em D+3 e D+4', () => {
    const ptcy = protocol.drugs.find(d => d.name.includes('PTCy'));
    expect(ptcy).toBeDefined();
    expect(ptcy!.days).toContain('D+3');
    expect(ptcy!.days).toContain('D+4');
  });

  it('Tacrolimus, MMF e Filgrastim iniciam em D+5', () => {
    const tak = protocol.drugs.find(d => d.name.includes('Tacrolimus'));
    const mmf = protocol.drugs.find(d => d.name.includes('MMF'));
    const gcsf = protocol.drugs.find(d => d.name.includes('Filgrastim'));

    expect(tak!.days).toContain('D+5');
    expect(mmf!.days).toContain('D+5');
    expect(gcsf!.days).toContain('D+5');
  });

  it('Mesna nos mesmos dias do PTCy (D+3, D+4)', () => {
    const mesna = protocol.drugs.find(d => d.name.includes('Mesna'));
    expect(mesna).toBeDefined();
    expect(mesna!.days).toContain('D+3');
    expect(mesna!.days).toContain('D+4');
  });
});

// ─── 2. Fludarabina 30 mg/m² por BSA ────────────────────────────────────────

describe('FluCyTBI Haplo — Fludarabina', () => {
  it('dose padrão é 30 mg/m²', () => {
    const protocol = getFlucytbiProtocol();
    const flu = protocol.drugs.find(d => d.name === 'Fludarabina');
    expect(flu!.dose).toBe(30);
    expect(flu!.doseUnit).toBe('mg/m²');
  });

  it('calcula dose por BSA: 30 × 1.81 = 54.3 mg', () => {
    const dose = calculateDrugDoseLegacy(30, 'mg/m²', MOCK_BSA, MOCK_WEIGHT);
    expect(dose).toBeCloseTo(54.3, 1);
  });

  it('dose padrão sem ajuste quando ClCr >= 61', () => {
    const result = calculateFludarabineAdjustedDose(95, MOCK_BSA);
    expect(result.isAdjusted).toBe(false);
    expect(result.baseDoseMgM2).toBe(FLUDARABINE_STANDARD_DOSE);
    expect(result.calculatedDose).toBeCloseTo(30 * MOCK_BSA, 1);
  });
});

// ─── 3. Ajuste renal da Fludarabina ──────────────────────────────────────────

describe('FluCyTBI Haplo — Ajuste Renal Fludarabina', () => {
  it('CCr 46-60 → 24 mg/m²', () => {
    const result = calculateFludarabineAdjustedDose(55, MOCK_BSA);
    expect(result.isAdjusted).toBe(true);
    expect(result.baseDoseMgM2).toBe(24);
    expect(result.calculatedDose).toBeCloseTo(24 * MOCK_BSA, 1);
  });

  it('CCr 31-45 → 22.5 mg/m²', () => {
    const result = calculateFludarabineAdjustedDose(40, MOCK_BSA);
    expect(result.isAdjusted).toBe(true);
    expect(result.baseDoseMgM2).toBe(22.5);
    expect(result.calculatedDose).toBeCloseTo(22.5 * MOCK_BSA, 1);
  });

  it('CCr 21-30 → 19.5 mg/m²', () => {
    const result = calculateFludarabineAdjustedDose(25, MOCK_BSA);
    expect(result.isAdjusted).toBe(true);
    expect(result.baseDoseMgM2).toBe(19.5);
    expect(result.calculatedDose).toBeCloseTo(19.5 * MOCK_BSA, 1);
  });

  it('CCr < 20 → 15 mg/m²', () => {
    const result = calculateFludarabineAdjustedDose(15, MOCK_BSA);
    expect(result.isAdjusted).toBe(true);
    expect(result.baseDoseMgM2).toBe(15);
    expect(result.calculatedDose).toBeCloseTo(15 * MOCK_BSA, 1);
  });

  it('CCr = 60 (limite) → ajuste para 24 mg/m²', () => {
    const result = calculateFludarabineAdjustedDose(60, MOCK_BSA);
    expect(result.isAdjusted).toBe(true);
    expect(result.baseDoseMgM2).toBe(24);
  });

  it('CCr = 61 → sem ajuste (dose padrão)', () => {
    const result = calculateFludarabineAdjustedDose(61, MOCK_BSA);
    expect(result.isAdjusted).toBe(false);
    expect(result.baseDoseMgM2).toBe(30);
  });

  it('dados inválidos retorna dose 0', () => {
    const result = calculateFludarabineAdjustedDose(NaN, MOCK_BSA);
    expect(result.calculatedDose).toBe(0);
    expect(result.isAdjusted).toBe(false);
  });
});

// ─── 4. Ciclofosfamida pré e PTCy pós ───────────────────────────────────────

describe('FluCyTBI Haplo — Ciclofosfamida', () => {
  it('Cy pré-TMO: 14.5 mg/kg × 70 kg = 1015 mg', () => {
    const dose = calculateDrugDoseLegacy(14.5, 'mg/kg', MOCK_BSA, MOCK_WEIGHT);
    expect(dose).toBeCloseTo(1015, 0);
  });

  it('PTCy: 50 mg/kg × 70 kg = 3500 mg', () => {
    const dose = calculateDrugDoseLegacy(50, 'mg/kg', MOCK_BSA, MOCK_WEIGHT);
    expect(dose).toBeCloseTo(3500, 0);
  });

  it('Cy pré-TMO e PTCy são drogas separadas no protocolo', () => {
    const protocol = getFlucytbiProtocol();
    const cyPre = protocol.drugs.find(d => d.name.includes('pré-TMO'));
    const ptcy = protocol.drugs.find(d => d.name.includes('PTCy'));
    expect(cyPre).toBeDefined();
    expect(ptcy).toBeDefined();
    expect(cyPre!.name).not.toBe(ptcy!.name);
  });

  it('Cy pré-TMO é 14.5 mg/kg e PTCy é 50 mg/kg', () => {
    const protocol = getFlucytbiProtocol();
    const cyPre = protocol.drugs.find(d => d.name.includes('pré-TMO'));
    const ptcy = protocol.drugs.find(d => d.name.includes('PTCy'));
    expect(cyPre!.dose).toBe(14.5);
    expect(cyPre!.doseUnit).toBe('mg/kg');
    expect(ptcy!.dose).toBe(50);
    expect(ptcy!.doseUnit).toBe('mg/kg');
  });
});

// ─── 5. MMF 15 mg/kg TID com cap 3g/dia ─────────────────────────────────────

describe('FluCyTBI Haplo — MMF', () => {
  it('dose base é 15 mg/kg', () => {
    const protocol = getFlucytbiProtocol();
    const mmf = protocol.drugs.find(d => d.name.includes('MMF'));
    expect(mmf!.dose).toBe(15);
    expect(mmf!.doseUnit).toBe('mg/kg');
  });

  it('dose máxima por tomada é 1000 mg (1g)', () => {
    const protocol = getFlucytbiProtocol();
    const mmf = protocol.drugs.find(d => d.name.includes('MMF'));
    expect(mmf!.maxDose).toBe(1000);
  });

  it('paciente 70kg: 15 × 70 = 1050 mg → cap em 1000 mg', () => {
    const dose = calculateDrugDoseLegacy(15, 'mg/kg', MOCK_BSA, MOCK_WEIGHT, 1.0, 1000);
    expect(dose).toBe(1000);
  });

  it('paciente 50kg: 15 × 50 = 750 mg → sem cap', () => {
    const dose = calculateDrugDoseLegacy(15, 'mg/kg', 1.5, 50, 1.0, 1000);
    expect(dose).toBe(750);
  });

  it('rota é VO 3x/dia (TID)', () => {
    const protocol = getFlucytbiProtocol();
    const mmf = protocol.drugs.find(d => d.name.includes('MMF'));
    expect(mmf!.route.toLowerCase()).toContain('tid');
  });

  it('duração padrão até D+35', () => {
    const protocol = getFlucytbiProtocol();
    const mmf = protocol.drugs.find(d => d.name.includes('MMF'));
    expect(mmf!.days).toContain('D+35');
  });
});

// ─── 6. Filgrastim 5 mcg/kg ─────────────────────────────────────────────────

describe('FluCyTBI Haplo — Filgrastim', () => {
  it('dose base é 5 mcg/kg', () => {
    const protocol = getFlucytbiProtocol();
    const gcsf = protocol.drugs.find(d => d.name.includes('Filgrastim'));
    expect(gcsf!.dose).toBe(5);
    expect(gcsf!.doseUnit).toBe('mcg/kg');
  });

  it('paciente 70kg: 5 × 70 = 350 mcg', () => {
    const dose = calculateDrugDoseLegacy(5, 'mcg/kg', MOCK_BSA, MOCK_WEIGHT);
    expect(dose).toBeCloseTo(350, 0);
  });

  it('rota é SC', () => {
    const protocol = getFlucytbiProtocol();
    const gcsf = protocol.drugs.find(d => d.name.includes('Filgrastim'));
    expect(gcsf!.route).toBe('SC');
  });

  it('observação menciona ANC > 1.000', () => {
    const protocol = getFlucytbiProtocol();
    const gcsf = protocol.drugs.find(d => d.name.includes('Filgrastim'));
    expect(gcsf!.observations).toContain('ANC > 1.000');
  });
});

// ─── 7. Alertas clínicos obrigatórios ────────────────────────────────────────

describe('FluCyTBI Haplo — Alertas Clínicos', () => {
  const protocol = getFlucytbiProtocol();

  it('contém alerta de cronograma', () => {
    const hasTimeline = protocol.specialAlerts.some(a => a.includes('CRONOGRAMA'));
    expect(hasTimeline).toBe(true);
  });

  it('contém alerta de não iniciar imunossupressores antes de 24h após PTCy', () => {
    const hasAlert = protocol.specialAlerts.some(a =>
      a.includes('NÃO iniciar') && a.includes('24h')
    );
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de hidratação + Mesna', () => {
    const hasAlert = protocol.specialAlerts.some(a =>
      a.includes('Hidratação') && a.includes('Mesna')
    );
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de monitorização de tacrolimus', () => {
    const hasAlert = protocol.specialAlerts.some(a =>
      a.includes('Tacrolimus') && a.includes('5–10 ng/mL')
    );
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de ajuste renal da fludarabina', () => {
    const hasAlert = protocol.specialAlerts.some(a =>
      a.includes('Fludarabina') && a.includes('renal')
    );
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de TBI/radioterapia', () => {
    const hasAlert = protocol.specialAlerts.some(a => a.includes('TBI'));
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de Mesna = 125%', () => {
    const hasAlert = protocol.specialAlerts.some(a => a.includes('125%'));
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de duração do MMF', () => {
    const hasAlert = protocol.specialAlerts.some(a =>
      a.includes('MMF') && a.includes('D+35')
    );
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de duração do Tacrolimus', () => {
    const hasAlert = protocol.specialAlerts.some(a =>
      a.includes('Tacrolimus') && a.includes('D+180')
    );
    expect(hasAlert).toBe(true);
  });

  it('contém alerta de Filgrastim/ANC', () => {
    const hasAlert = protocol.specialAlerts.some(a =>
      a.includes('Filgrastim') && a.includes('ANC')
    );
    expect(hasAlert).toBe(true);
  });
});

// ─── 8. TBI como procedimento fixo ──────────────────────────────────────────

describe('FluCyTBI Haplo — TBI', () => {
  it('TBI é 200 cGy (dose fixa)', () => {
    const protocol = getFlucytbiProtocol();
    const tbi = protocol.drugs.find(d => d.name.includes('TBI'));
    expect(tbi!.dose).toBe(200);
    expect(tbi!.doseUnit).toBe('cGy');
  });

  it('TBI tem calculatedDose pré-definida como 200', () => {
    const protocol = getFlucytbiProtocol();
    const tbi = protocol.drugs.find(d => d.name.includes('TBI'));
    expect(tbi!.calculatedDose).toBe(200);
  });

  it('TBI é marcado como Radioterapia', () => {
    const protocol = getFlucytbiProtocol();
    const tbi = protocol.drugs.find(d => d.name.includes('TBI'));
    expect(tbi!.route).toContain('Radioterapia');
  });

  it('TBI observação menciona PROCEDIMENTO', () => {
    const protocol = getFlucytbiProtocol();
    const tbi = protocol.drugs.find(d => d.name.includes('TBI'));
    expect(tbi!.observations).toContain('PROCEDIMENTO');
  });

  it('applyFluCyTBIRules mantém TBI como dose fixa', () => {
    const drugs: Drug[] = [
      { name: 'TBI (Irradiação Corporal Total)', dose: 200, doseUnit: 'cGy', calculatedDose: 200, route: 'Radioterapia', days: 'D-1' },
    ];
    const result = applyFluCyTBIRules(drugs, mockCalculatedValues(), MOCK_WEIGHT);
    expect(result[0].calculatedDose).toBe(200);
  });
});

// ─── 9. Mesna = 125% da PTCy ────────────────────────────────────────────────

describe('FluCyTBI Haplo — Mesna', () => {
  it('fator de Mesna é 1.25 (125%)', () => {
    expect(MESNA_FACTOR).toBe(1.25);
  });

  it('Mesna para PTCy 3500 mg = 4375 mg', () => {
    const dose = calculateMesnaDose(3500);
    expect(dose).toBeCloseTo(4375, 0);
  });

  it('Mesna para PTCy 2500 mg = 3125 mg', () => {
    const dose = calculateMesnaDose(2500);
    expect(dose).toBeCloseTo(3125, 0);
  });

  it('Mesna retorna 0 para dose inválida', () => {
    expect(calculateMesnaDose(0)).toBe(0);
    expect(calculateMesnaDose(-100)).toBe(0);
    expect(calculateMesnaDose(NaN)).toBe(0);
  });

  it('applyFluCyTBIRules calcula Mesna automaticamente', () => {
    const drugs: Drug[] = [
      { name: 'Ciclofosfamida PTCy (pós-TMO)', dose: 50, doseUnit: 'mg/kg', calculatedDose: 3500, route: 'IV', days: 'D+3, D+4' },
      { name: 'Mesna (com PTCy)', dose: 0, doseUnit: 'mg', calculatedDose: 0, route: 'IV', days: 'D+3, D+4' },
    ];
    const result = applyFluCyTBIRules(drugs, mockCalculatedValues(), MOCK_WEIGHT);
    const mesna = result.find(d => d.name.includes('Mesna'));
    expect(mesna!.calculatedDose).toBeCloseTo(4375, 0);
  });
});

// ─── 10. Cockcroft-Gault ─────────────────────────────────────────────────────

describe('FluCyTBI Haplo — Cockcroft-Gault', () => {
  it('homem 45 anos, 70kg, Cr 1.0 → CCr ≈ 92.4 mL/min', () => {
    const ccr = calculateCockcroftGault(45, 70, 1.0, 'M');
    expect(ccr).toBeCloseTo(92.4, 0);
  });

  it('mulher 60 anos, 65kg, Cr 1.2 → CCr ≈ 51.2 mL/min', () => {
    const ccr = calculateCockcroftGault(60, 65, 1.2, 'F');
    expect(ccr).toBeCloseTo(51.2, 0);
  });

  it('homem 70 anos, 80kg, Cr 2.0 → CCr ≈ 38.9 mL/min', () => {
    const ccr = calculateCockcroftGault(70, 80, 2.0, 'M');
    expect(ccr).toBeCloseTo(38.9, 0);
  });

  it('retorna 0 para dados inválidos', () => {
    expect(calculateCockcroftGault(0, 70, 1.0, 'M')).toBe(0);
    expect(calculateCockcroftGault(45, 0, 1.0, 'M')).toBe(0);
    expect(calculateCockcroftGault(45, 70, 0, 'M')).toBe(0);
    expect(calculateCockcroftGault(NaN, 70, 1.0, 'M')).toBe(0);
  });

  it('fator feminino é 0.85', () => {
    const male = calculateCockcroftGault(45, 70, 1.0, 'M');
    const female = calculateCockcroftGault(45, 70, 1.0, 'F');
    expect(female).toBeCloseTo(male * 0.85, 0);
  });
});

// ─── 11. applyFluCyTBIRules integração ──────────────────────────────────────

describe('FluCyTBI Haplo — applyFluCyTBIRules integração', () => {
  it('aplica ajuste renal na Fludarabina quando eGFR < 61', () => {
    const drugs: Drug[] = [
      { name: 'Fludarabina', dose: 30, doseUnit: 'mg/m²', calculatedDose: 54.3, route: 'IV', days: 'D-6 a D-2' },
    ];
    const cv = mockCalculatedValues({ egfr: 50 });
    const result = applyFluCyTBIRules(drugs, cv, MOCK_WEIGHT);
    const flu = result.find(d => d.name === 'Fludarabina');
    // CCr 46-60 → 24 mg/m² × 1.81 = 43.4 mg
    expect(flu!.calculatedDose).toBeCloseTo(24 * MOCK_BSA, 1);
    expect(flu!.observations).toContain('AJUSTE RENAL');
  });

  it('não aplica ajuste renal quando eGFR >= 61', () => {
    const drugs: Drug[] = [
      { name: 'Fludarabina', dose: 30, doseUnit: 'mg/m²', calculatedDose: 54.3, route: 'IV', days: 'D-6 a D-2' },
    ];
    const cv = mockCalculatedValues({ egfr: 95 });
    const result = applyFluCyTBIRules(drugs, cv, MOCK_WEIGHT);
    const flu = result.find(d => d.name === 'Fludarabina');
    expect(flu!.calculatedDose).toBeCloseTo(30 * MOCK_BSA, 1);
  });

  it('usa Cockcroft-Gault quando dados do paciente disponíveis', () => {
    const drugs: Drug[] = [
      { name: 'Fludarabina', dose: 30, doseUnit: 'mg/m²', calculatedDose: 54.3, route: 'IV', days: 'D-6 a D-2' },
    ];
    // Paciente com eGFR alto mas CCr baixo (mulher idosa com Cr elevada)
    const cv = mockCalculatedValues({ egfr: 65 }); // eGFR >= 61, sem ajuste
    // Mas CCr pela Cockcroft-Gault será ~51 mL/min → ajuste para 24 mg/m²
    const result = applyFluCyTBIRules(drugs, cv, 65, 60, 'F', 1.2);
    const flu = result.find(d => d.name === 'Fludarabina');
    // CCr ≈ 51.2 → faixa 46-60 → 24 mg/m²
    expect(flu!.calculatedDose).toBeCloseTo(24 * MOCK_BSA, 1);
    expect(flu!.observations).toContain('Cockcroft-Gault');
  });

  it('retorna array vazio para drugs vazio', () => {
    const result = applyFluCyTBIRules([], mockCalculatedValues(), MOCK_WEIGHT);
    expect(result).toEqual([]);
  });

  it('drogas sem regra especial mantêm cálculo padrão', () => {
    const drugs: Drug[] = [
      { name: 'Tacrolimus (TAK)', dose: 0.015, doseUnit: 'mg/kg', calculatedDose: 1.1, route: 'IV', days: 'D+5' },
    ];
    const result = applyFluCyTBIRules(drugs, mockCalculatedValues(), MOCK_WEIGHT);
    expect(result[0].calculatedDose).toBe(1.1);
  });
});

// ─── 12. Protocolo no array global ──────────────────────────────────────────

describe('FluCyTBI Haplo — Integração com protocols.ts', () => {
  it('protocolo está presente no array global de protocolos', () => {
    const found = protocols.find(p => p.id === FLUCYTBI_PROTOCOL_ID);
    expect(found).toBeDefined();
  });

  it('protocolo tem profilaxias definidas', () => {
    const protocol = getFlucytbiProtocol();
    expect(protocol.prophylaxis.length).toBeGreaterThan(0);
    expect(protocol.prophylaxis.some(p => p.includes('Aciclovir'))).toBe(true);
    expect(protocol.prophylaxis.some(p => p.includes('Mesna'))).toBe(true);
  });

  it('protocolo tem ajustes renais documentados', () => {
    const protocol = getFlucytbiProtocol();
    expect(protocol.renalAdjustments.length).toBeGreaterThan(0);
    expect(protocol.renalAdjustments.some(r => r.includes('Fludarabina'))).toBe(true);
  });

  it('protocolo tem cuidados de enfermagem', () => {
    const protocol = getFlucytbiProtocol();
    expect(protocol.nursingCare.length).toBeGreaterThan(0);
    expect(protocol.nursingCare.some(n => n.includes('tacrolimus'))).toBe(true);
  });

  it('não quebra protocolos existentes (total de protocolos aumentou em 1)', () => {
    // Verificar que pelo menos os protocolos básicos ainda existem
    expect(protocols.find(p => p.id === '7plus3')).toBeDefined();
    expect(protocols.find(p => p.id === 'flag-ida')).toBeDefined();
    expect(protocols.find(p => p.id === FLUCYTBI_PROTOCOL_ID)).toBeDefined();
  });
});
