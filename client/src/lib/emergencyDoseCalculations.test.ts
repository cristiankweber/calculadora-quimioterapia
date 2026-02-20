import { describe, expect, it } from 'vitest';
import { calculateEmergencyDose, type CalculatedDose } from './emergencyDoseCalculations';

describe('calculateEmergencyDose', () => {
  const defaultPatient = {
    weight: 70,
    bsa: 1.8,
    egfr: 90,
  };

  describe('Hidroxiureia', () => {
    it('calcula dose baseada em peso (50-100 mg/kg)', () => {
      const result = calculateEmergencyDose('Hidroxiureia', defaultPatient);
      expect(result).not.toBeNull();
      expect(result!.unit).toContain('mg');
      // 50 mg/kg * 70 = 3500
      expect(result!.value).toBeGreaterThanOrEqual(3500);
    });
  });

  describe('Rasburicase', () => {
    it('calcula dose 0.2 mg/kg', () => {
      const result = calculateEmergencyDose('Rasburicase', defaultPatient);
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(14, 0); // 0.2 * 70
      expect(result!.unit).toContain('mg');
    });
  });

  describe('Alopurinol', () => {
    it('dose normal com eGFR >= 60', () => {
      const result = calculateEmergencyDose('Alopurinol', { ...defaultPatient, egfr: 90 });
      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThanOrEqual(300);
    });

    it('dose reduzida com eGFR < 30', () => {
      const result = calculateEmergencyDose('Alopurinol', { ...defaultPatient, egfr: 20 });
      expect(result).not.toBeNull();
      // Deve ser menor que dose normal
      expect(result!.value).toBeLessThanOrEqual(300);
    });
  });

  describe('Dexametasona', () => {
    it('calcula dose fixa de 40mg', () => {
      const result = calculateEmergencyDose('Dexametasona', defaultPatient);
      expect(result).not.toBeNull();
      expect(result!.value).toBe(40);
      expect(result!.unit).toBe('mg');
    });
  });

  describe('Bortezomibe', () => {
    it('calcula dose 1.3 mg/m²', () => {
      const result = calculateEmergencyDose('Bortezomibe', defaultPatient);
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(1.3 * 1.8, 1); // 2.34
      expect(result!.unit).toBe('mg');
    });
  });

  describe('Droga desconhecida', () => {
    it('retorna null para droga não mapeada', () => {
      const result = calculateEmergencyDose('DrogaInexistente', defaultPatient);
      expect(result).toBeNull();
    });
  });

  describe('Dados inválidos do paciente', () => {
    it('lida com peso zero', () => {
      const result = calculateEmergencyDose('Hidroxiureia', { weight: 0, bsa: 1.8, egfr: 90 });
      // Deve retornar null ou dose 0
      if (result) {
        expect(result.value).toBe(0);
      }
    });
  });
});
