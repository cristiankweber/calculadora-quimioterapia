import { describe, it, expect } from 'vitest';
import { getDoseAdjustmentFactor, getToxicityRecommendations } from '@/data/ctcae';

describe('Toxicity Adjustment', () => {
  describe('getDoseAdjustmentFactor', () => {
    it('should return 1.0 (no adjustment) when no toxicities', () => {
      const factor = getDoseAdjustmentFactor({});
      expect(factor).toBe(1.0);
    });

    it('should return 1.0 when all toxicities are grade 0', () => {
      const factor = getDoseAdjustmentFactor({
        neutropenia: 0,
        thrombocytopenia: 0,
        neuropathy_peripheral: 0,
      });
      expect(factor).toBe(1.0);
    });

    it('should return 0.75 (25% reduction) for grade 3 neutropenia', () => {
      const factor = getDoseAdjustmentFactor({
        neutropenia: 3,
      });
      expect(factor).toBe(0.75);
    });

    it('should return 0.5 (50% reduction) for grade 4 neutropenia', () => {
      const factor = getDoseAdjustmentFactor({
        neutropenia: 4,
      });
      expect(factor).toBe(0.5);
    });

    it('should return 0.75 (25% reduction) for grade 2 neuropathy', () => {
      const factor = getDoseAdjustmentFactor({
        neuropathy_peripheral: 2,
      });
      expect(factor).toBe(0.75);
    });

    it('should return 0 (hold) for grade 3 neuropathy', () => {
      const factor = getDoseAdjustmentFactor({
        neuropathy_peripheral: 3,
      });
      expect(factor).toBe(0);
    });

    it('should use the most severe toxicity when multiple present', () => {
      const factor = getDoseAdjustmentFactor({
        neutropenia: 3, // 25% reduction
        neuropathy_peripheral: 2, // 25% reduction
      });
      expect(factor).toBe(0.75);
    });

    it('should use the most severe toxicity (hold) when mixed grades', () => {
      const factor = getDoseAdjustmentFactor({
        neutropenia: 3, // 25% reduction
        neuropathy_peripheral: 3, // hold
      });
      expect(factor).toBe(0);
    });

    it('should return 0.5 for grade 4 thrombocytopenia', () => {
      const factor = getDoseAdjustmentFactor({
        thrombocytopenia: 4,
      });
      expect(factor).toBe(0.5);
    });

    it('should return 0 (hold) for grade 3 hepatotoxicity', () => {
      const factor = getDoseAdjustmentFactor({
        hepatotoxicity: 3,
      });
      expect(factor).toBe(0);
    });
  });

  describe('getToxicityRecommendations', () => {
    it('should return empty array when no toxicities', () => {
      const recommendations = getToxicityRecommendations({});
      expect(recommendations).toEqual([]);
    });

    it('should return empty array when all toxicities are grade 0', () => {
      const recommendations = getToxicityRecommendations({
        neutropenia: 0,
        neuropathy_peripheral: 0,
      });
      expect(recommendations).toEqual([]);
    });

    it('should return recommendation for grade 3 neutropenia', () => {
      const recommendations = getToxicityRecommendations({
        neutropenia: 3,
      });
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toContain('Neutropenia');
      expect(recommendations[0]).toContain('G3');
      expect(recommendations[0]).toContain('Reduzir 25%');
    });

    it('should return recommendations for multiple toxicities', () => {
      const recommendations = getToxicityRecommendations({
        neutropenia: 3,
        neuropathy_peripheral: 2,
      });
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0]).toContain('Neutropenia');
      expect(recommendations[1]).toContain('Neuropatia');
    });

    it('should return recommendation for grade 3 diarrhea', () => {
      const recommendations = getToxicityRecommendations({
        diarrhea: 3,
      });
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toContain('Diarreia');
      expect(recommendations[0]).toContain('Suspender');
    });

    it('should return recommendation for grade 2 mucositis', () => {
      const recommendations = getToxicityRecommendations({
        mucositis: 2,
      });
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toContain('Mucosite');
      expect(recommendations[0]).toContain('analgesia');
    });
  });
});
