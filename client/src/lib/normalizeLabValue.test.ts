import { describe, it, expect } from 'vitest';
import { normalizeLabValue } from './normalizeLabValue';

describe('normalizeLabValue', () => {
  describe('Valores legados (multiplicados por 100)', () => {
    it('deve converter creatinina legada 97 para 0.97', () => {
      expect(normalizeLabValue(97)).toBe(0.97);
    });

    it('deve converter creatinina legada 120 para 1.20', () => {
      expect(normalizeLabValue(120)).toBe(1.20);
    });

    it('deve converter bilirrubina legada 80 para 0.80', () => {
      expect(normalizeLabValue(80)).toBe(0.80);
    });

    it('deve converter valor legado 150 para 1.50', () => {
      expect(normalizeLabValue(150)).toBe(1.50);
    });
  });

  describe('Valores novos (já decimais)', () => {
    it('não deve alterar creatinina nova 1.2', () => {
      expect(normalizeLabValue(1.2)).toBe(1.20);
    });

    it('não deve alterar creatinina nova 0.97', () => {
      expect(normalizeLabValue(0.97)).toBe(0.97);
    });

    it('não deve alterar bilirrubina nova 0.8', () => {
      expect(normalizeLabValue(0.8)).toBe(0.80);
    });

    it('não deve alterar valor decimal 1.5', () => {
      expect(normalizeLabValue(1.5)).toBe(1.50);
    });
  });

  describe('Valores limítrofes', () => {
    it('deve converter exatamente 21 para 0.21', () => {
      expect(normalizeLabValue(21)).toBe(0.21);
    });

    it('não deve alterar exatamente 20', () => {
      expect(normalizeLabValue(20)).toBe(20.00);
    });

    it('não deve alterar 19.99', () => {
      expect(normalizeLabValue(19.99)).toBe(19.99);
    });
  });

  describe('Valores especiais', () => {
    it('deve retornar 0 para null', () => {
      expect(normalizeLabValue(null)).toBe(0);
    });

    it('deve retornar 0 para undefined', () => {
      expect(normalizeLabValue(undefined)).toBe(0);
    });

    it('deve retornar 0 para 0', () => {
      expect(normalizeLabValue(0)).toBe(0);
    });
  });

  describe('Precisão decimal', () => {
    it('deve arredondar para 2 casas decimais', () => {
      expect(normalizeLabValue(1.234)).toBe(1.23);
    });

    it('deve arredondar valor legado para 2 casas decimais', () => {
      expect(normalizeLabValue(123)).toBe(1.23);
    });
  });
});
