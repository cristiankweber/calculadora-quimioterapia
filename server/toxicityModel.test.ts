import { describe, it, expect } from 'vitest';
import { predictToxicity, getModelMetrics } from './toxicityModel';
import type { ToxicityPredictionInput } from '@shared/toxicityPrediction';

describe('Toxicity Prediction Model', () => {
  describe('predictToxicity', () => {
    it('should predict low risk for young healthy patient with low-risk protocol', () => {
      const input: ToxicityPredictionInput = {
        age: 45,
        creatinine: 0.9,
        bilirubin: 0.6,
        ecog: 0,
        hasComorbidities: false,
        protocolName: 'R-CHOP',
        protocolRisk: 'moderate',
      };

      const prediction = predictToxicity(input);

      expect(prediction.neutropenia.risk).toBe('low');
      expect(prediction.mucositis.risk).toBe('low');
      expect(prediction.overallRisk).toBe('low');
      expect(prediction.neutropenia.probability).toBeLessThan(0.2);
    });

    it('should predict high risk for elderly patient with poor performance status', () => {
      const input: ToxicityPredictionInput = {
        age: 78,
        creatinine: 1.8,
        bilirubin: 1.2,
        ecog: 2,
        hasComorbidities: true,
        protocolName: 'FOLFOX',
        protocolRisk: 'high',
      };

      const prediction = predictToxicity(input);

      expect(prediction.neutropenia.risk).toBe('high');
      expect(prediction.overallRisk).toBe('high');
      expect(prediction.neutropenia.probability).toBeGreaterThan(0.45);
      expect(prediction.recommendations.length).toBeGreaterThan(0);
    });

    it('should recommend G-CSF for high neutropenia risk', () => {
      const input: ToxicityPredictionInput = {
        age: 72,
        creatinine: 1.5,
        bilirubin: 0.8,
        ecog: 1,
        hasComorbidities: true,
        protocolName: 'FOLFIRI',
        protocolRisk: 'very_high',
      };

      const prediction = predictToxicity(input);

      expect(prediction.recommendations.some(r => r.includes('G-CSF'))).toBe(true);
    });

    it('should identify renal dysfunction as risk factor', () => {
      const input: ToxicityPredictionInput = {
        age: 65,
        creatinine: 2.0,
        bilirubin: 0.7,
        ecog: 0,
        hasComorbidities: false,
        protocolName: 'Cisplatina',
        protocolRisk: 'high',
      };

      const prediction = predictToxicity(input);

      expect(prediction.featureImportance.some(f => f.feature === 'Função Renal')).toBe(true);
      expect(prediction.recommendations.some(r => r.includes('renal'))).toBe(true);
    });

    it('should recommend dose reduction for very elderly patients', () => {
      const input: ToxicityPredictionInput = {
        age: 82,
        creatinine: 1.3,
        bilirubin: 0.9,
        ecog: 1,
        hasComorbidities: true,
        protocolName: 'CHOP',
        protocolRisk: 'high',
      };

      const prediction = predictToxicity(input);

      expect(prediction.recommendations.some(r => r.includes('IDADE AVANÇADA'))).toBe(true);
      expect(prediction.recommendations.some(r => r.includes('redução de dose'))).toBe(true);
    });

    it('should predict moderate risk for borderline cases', () => {
      const input: ToxicityPredictionInput = {
        age: 68,
        creatinine: 1.2,
        bilirubin: 0.9,
        ecog: 1,
        hasComorbidities: false,
        protocolName: 'FOLFOX',
        protocolRisk: 'moderate',
      };

      const prediction = predictToxicity(input);

      expect(prediction.neutropenia.risk).toBe('moderate');
      expect(prediction.neutropenia.probability).toBeGreaterThanOrEqual(0.2);
      expect(prediction.neutropenia.probability).toBeLessThan(0.45);
    });

    it('should include feature importance for all relevant factors', () => {
      const input: ToxicityPredictionInput = {
        age: 75,
        creatinine: 1.6,
        bilirubin: 1.1,
        ecog: 2,
        hasComorbidities: true,
        protocolName: 'High-dose MTX',
        protocolRisk: 'very_high',
      };

      const prediction = predictToxicity(input);

      expect(prediction.featureImportance.length).toBeGreaterThan(0);
      expect(prediction.featureImportance.some(f => f.feature === 'Protocolo')).toBe(true);
    });

    it('should return probabilities between 0 and 1', () => {
      const input: ToxicityPredictionInput = {
        age: 60,
        creatinine: 1.0,
        bilirubin: 0.8,
        ecog: 0,
        hasComorbidities: false,
        protocolName: 'Test',
        protocolRisk: 'low',
      };

      const prediction = predictToxicity(input);

      expect(prediction.neutropenia.probability).toBeGreaterThanOrEqual(0);
      expect(prediction.neutropenia.probability).toBeLessThanOrEqual(1);
      expect(prediction.mucositis.probability).toBeGreaterThanOrEqual(0);
      expect(prediction.mucositis.probability).toBeLessThanOrEqual(1);
    });
  });

  describe('getModelMetrics', () => {
    it('should return metrics with AUC-ROC > 0.75', () => {
      const metrics = getModelMetrics();

      expect(metrics.neutropenia.aucRoc).toBeGreaterThan(0.75);
      expect(metrics.mucositis.aucRoc).toBeGreaterThan(0.75);
    });

    it('should return valid performance metrics', () => {
      const metrics = getModelMetrics();

      expect(metrics.neutropenia.sensitivity).toBeGreaterThan(0);
      expect(metrics.neutropenia.sensitivity).toBeLessThanOrEqual(1);
      expect(metrics.neutropenia.specificity).toBeGreaterThan(0);
      expect(metrics.neutropenia.specificity).toBeLessThanOrEqual(1);
      expect(metrics.neutropenia.accuracy).toBeGreaterThan(0);
      expect(metrics.neutropenia.accuracy).toBeLessThanOrEqual(1);
    });

    it('should include sample size and timestamp', () => {
      const metrics = getModelMetrics();

      expect(metrics.sampleSize).toBeGreaterThan(0);
      expect(metrics.lastUpdated).toBeDefined();
      expect(new Date(metrics.lastUpdated).getTime()).toBeGreaterThan(0);
    });
  });
});
