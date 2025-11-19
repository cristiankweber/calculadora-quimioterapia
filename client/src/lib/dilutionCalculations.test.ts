import { describe, it, expect } from 'vitest';
import {
  calculateDilutionVolume,
  calculateInfusionRate,
  calculateInfusionTime,
  formatInfusionTime,
} from './dilutionCalculations';
import { DilutionInfo } from '../data/dilutionData';

describe('Cálculos de Diluição', () => {
  describe('calculateDilutionVolume', () => {
    it('deve calcular volume baseado em concentração máxima', () => {
      const dilutionInfo: DilutionInfo = {
        drugName: 'Doxorrubicina',
        maxConcentration: {
          value: 2,
          unit: 'mg/mL',
        },
        diluents: ['SF', 'SG'],
        pvcCompatible: true,
        stability: {},
      };

      // Dose 100 mg, conc máx 2 mg/mL → volume mín 50 mL
      const result = calculateDilutionVolume(100, dilutionInfo);
      
      expect(result.volume).toBe(50);
      expect(result.concentration).toBe(2); // 100/50
    });

    it('deve arredondar para volumes práticos', () => {
      const dilutionInfo: DilutionInfo = {
        drugName: 'Ciclofosfamida',
        maxConcentration: {
          value: 20,
          unit: 'mg/mL',
        },
        diluents: ['SF', 'SG'],
        pvcCompatible: true,
        stability: {},
      };

      // Dose 1500 mg, conc máx 20 mg/mL → volume mín 75 mL → arredondar para 100 mL
      const result = calculateDilutionVolume(1500, dilutionInfo);
      
      expect(result.volume).toBe(100);
      expect(result.concentration).toBe(15); // 1500/100
    });

    it('deve respeitar volume mínimo', () => {
      const dilutionInfo: DilutionInfo = {
        drugName: 'Rituximabe',
        maxConcentration: {
          value: 4,
          unit: 'mg/mL',
        },
        minVolume: 250,
        diluents: ['SF'],
        pvcCompatible: true,
        stability: {},
      };

      // Dose 375 mg, volume calculado seria ~94 mL, mas mínimo é 250 mL
      const result = calculateDilutionVolume(375, dilutionInfo);
      
      expect(result.volume).toBe(250);
      expect(result.concentration).toBe(1.5); // 375/250
    });
  });

  describe('calculateInfusionRate', () => {
    it('deve calcular velocidade de infusão em mL/h', () => {
      // 250 mL em 60 minutos (1 hora) → 250 mL/h
      const rate = calculateInfusionRate(250, 60);
      expect(rate).toBe(250);
    });

    it('deve calcular velocidade para infusão de 30 minutos', () => {
      // 100 mL em 30 minutos (0.5 hora) → 200 mL/h
      const rate = calculateInfusionRate(100, 30);
      expect(rate).toBe(200);
    });

    it('deve calcular velocidade para infusão de 2 horas', () => {
      // 500 mL em 120 minutos (2 horas) → 250 mL/h
      const rate = calculateInfusionRate(500, 120);
      expect(rate).toBe(250);
    });

    it('deve arredondar para 1 casa decimal', () => {
      // 250 mL em 90 minutos (1.5 horas) → 166.67 → 166.7 mL/h
      const rate = calculateInfusionRate(250, 90);
      expect(rate).toBe(166.7);
    });
  });

  describe('calculateInfusionTime', () => {
    it('deve calcular tempo de infusão em minutos', () => {
      // 250 mL a 250 mL/h → 1 hora = 60 minutos
      const time = calculateInfusionTime(250, 250);
      expect(time).toBe(60);
    });

    it('deve calcular tempo para velocidade baixa', () => {
      // 500 mL a 100 mL/h → 5 horas = 300 minutos
      const time = calculateInfusionTime(500, 100);
      expect(time).toBe(300);
    });

    it('deve calcular tempo para velocidade alta', () => {
      // 100 mL a 200 mL/h → 0.5 hora = 30 minutos
      const time = calculateInfusionTime(100, 200);
      expect(time).toBe(30);
    });
  });

  describe('formatInfusionTime', () => {
    it('deve formatar minutos quando < 60', () => {
      expect(formatInfusionTime(30)).toBe('30 min');
      expect(formatInfusionTime(45)).toBe('45 min');
    });

    it('deve formatar horas exatas', () => {
      expect(formatInfusionTime(60)).toBe('1h');
      expect(formatInfusionTime(120)).toBe('2h');
      expect(formatInfusionTime(180)).toBe('3h');
    });

    it('deve formatar horas e minutos', () => {
      expect(formatInfusionTime(90)).toBe('1h 30min');
      expect(formatInfusionTime(150)).toBe('2h 30min');
      expect(formatInfusionTime(195)).toBe('3h 15min');
    });
  });
});

describe('Cenários Clínicos Reais', () => {
  it('Doxorrubicina 50 mg em 60 minutos', () => {
    const dilutionInfo: DilutionInfo = {
      drugName: 'Doxorrubicina',
      maxConcentration: { value: 2, unit: 'mg/mL' },
      diluents: ['SF', 'SG'],
      pvcCompatible: true,
      stability: {},
    };

    const { volume, concentration } = calculateDilutionVolume(50, dilutionInfo);
    const rate = calculateInfusionRate(volume, 60);

    expect(volume).toBe(50); // 50 mg / 2 mg/mL = 25 mL → arredondar para 50 mL
    expect(concentration).toBe(1); // 50 mg / 50 mL
    expect(rate).toBe(50); // 50 mL em 1h
  });

  it('Rituximabe 375 mg (paciente 1.8 m²) em 4 horas', () => {
    const dilutionInfo: DilutionInfo = {
      drugName: 'Rituximabe',
      maxConcentration: { value: 4, unit: 'mg/mL' },
      minVolume: 250,
      diluents: ['SF'],
      pvcCompatible: true,
      stability: {},
    };

    // Dose calculada: 375 mg/m² × 1.8 m² = 675 mg
    const dose = 675;
    const { volume, concentration } = calculateDilutionVolume(dose, dilutionInfo);
    const rate = calculateInfusionRate(volume, 240); // 4 horas

    expect(volume).toBe(250); // volume mínimo
    expect(concentration).toBe(2.7); // 675 / 250
    expect(rate).toBe(62.5); // 250 mL em 4h
  });

  it('Carboplatina AUC 5 (eGFR 90) em 60 minutos', () => {
    const dilutionInfo: DilutionInfo = {
      drugName: 'Carboplatina',
      maxConcentration: { value: 6, unit: 'mg/mL', diluent: 'SG' },
      diluents: ['SF', 'SG'],
      pvcCompatible: true,
      stability: {},
    };

    // Dose calculada: AUC 5 × (eGFR 90 + 25) = 575 mg
    const dose = 575;
    const { volume, concentration } = calculateDilutionVolume(dose, dilutionInfo);
    const rate = calculateInfusionRate(volume, 60);

    expect(volume).toBe(100); // 575/6 = 95.8 → arredondar para 100
    expect(concentration).toBe(5.75); // 575 / 100
    expect(rate).toBe(100); // 100 mL em 1h
  });
});
