/**
 * Tipos para Sistema de Predição de Toxicidade com Machine Learning
 */

export interface ToxicityPredictionInput {
  age: number;
  creatinine: number; // mg/dL
  bilirubin: number; // mg/dL
  ecog: number; // 0-4
  hasComorbidities: boolean;
  protocolName: string;
  protocolRisk: 'low' | 'moderate' | 'high' | 'very_high'; // Risco emetogênico como proxy
}

export interface ToxicityPrediction {
  neutropenia: {
    probability: number; // 0-1
    risk: 'low' | 'moderate' | 'high';
    grade: string; // "G3-4"
  };
  mucositis: {
    probability: number; // 0-1
    risk: 'low' | 'moderate' | 'high';
    grade: string; // "G3-4"
  };
  overallRisk: 'low' | 'moderate' | 'high';
  recommendations: string[];
  featureImportance: {
    feature: string;
    importance: number;
    value: string;
  }[];
}

export interface ModelMetrics {
  neutropenia: {
    aucRoc: number;
    sensitivity: number;
    specificity: number;
    accuracy: number;
  };
  mucositis: {
    aucRoc: number;
    sensitivity: number;
    specificity: number;
    accuracy: number;
  };
  lastUpdated: string;
  sampleSize: number;
}
