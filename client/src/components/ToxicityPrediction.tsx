import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Info } from 'lucide-react';
import type { PatientData, Protocol } from '@/types/calculator';
import ModelMetrics from './ModelMetrics';

interface ToxicityPredictionProps {
  patientData: PatientData;
  protocol: Protocol | null;
}

export default function ToxicityPrediction({ patientData, protocol }: ToxicityPredictionProps) {
  // Não mostrar se não tiver protocolo selecionado
  if (!protocol) return null;

  // Preparar input para API
  const hasComorbidities = Boolean(patientData.comorbidities && patientData.comorbidities.trim().length > 0);
  
  // Mapear risco emetogênico para risco de toxicidade
  const protocolRisk = protocol.emetogenicRisk === 'minimal' ? 'low' : protocol.emetogenicRisk as 'low' | 'moderate' | 'high' | 'very_high';
  
  const { data: prediction, isLoading } = trpc.toxicity.predict.useQuery({
    age: patientData.age,
    creatinine: patientData.creatinine,
    bilirubin: patientData.bilirubin,
    ecog: patientData.ecog,
    hasComorbidities,
    protocolName: protocol.name,
    protocolRisk,
  }, {
    enabled: Boolean(protocol && patientData.age > 0 && patientData.creatinine > 0),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Predição de Toxicidade (ML)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'high': return 'ALTO RISCO';
      case 'moderate': return 'RISCO MODERADO';
      case 'low': return 'BAIXO RISCO';
      default: return risk.toUpperCase();
    }
  };

  const getProgressColor = (probability: number) => {
    if (probability >= 0.45) return 'bg-red-500';
    if (probability >= 0.20) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-900">
          <TrendingUp className="h-5 w-5" />
          Predição de Toxicidade com IA
        </CardTitle>
        <CardDescription>
          Modelo de Machine Learning (Regressão Logística) - AUC-ROC: 0.78
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Neutropenia */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Neutropenia G3-4</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskColor(prediction.neutropenia.risk)}`}>
              {getRiskLabel(prediction.neutropenia.risk)}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Probabilidade</span>
              <span className="font-bold">{(prediction.neutropenia.probability * 100).toFixed(0)}%</span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div 
                className={`h-full transition-all ${getProgressColor(prediction.neutropenia.probability)}`}
                style={{ width: `${prediction.neutropenia.probability * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mucosite */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Mucosite G3-4</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskColor(prediction.mucositis.risk)}`}>
              {getRiskLabel(prediction.mucositis.risk)}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Probabilidade</span>
              <span className="font-bold">{(prediction.mucositis.probability * 100).toFixed(0)}%</span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div 
                className={`h-full transition-all ${getProgressColor(prediction.mucositis.probability)}`}
                style={{ width: `${prediction.mucositis.probability * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recomendações */}
        {prediction.recommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Recomendações Clínicas
            </h3>
            <div className="space-y-2">
              {prediction.recommendations.map((rec, index) => (
                <Alert key={index} className="py-2">
                  <AlertDescription className="text-sm">{rec}</AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Feature Importance */}
        {prediction.featureImportance.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Fatores de Risco
            </h3>
            <div className="space-y-2">
              {prediction.featureImportance.map((feature, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{feature.feature}</span>
                    <span className="text-gray-500 text-xs">{feature.value}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div 
                      className="h-full transition-all bg-purple-500"
                      style={{ width: `${feature.importance}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-gray-500 italic border-t pt-3">
          ⚠️ Esta predição é baseada em modelo estatístico e deve ser interpretada no contexto clínico completo do paciente. 
          Não substitui avaliação médica individualizada.
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Componente wrapper que inclui predição + métricas
 */
export function ToxicityPredictionWithMetrics({ patientData, protocol }: ToxicityPredictionProps) {
  return (
    <div className="space-y-4">
      <ToxicityPrediction patientData={patientData} protocol={protocol} />
      <ModelMetrics />
    </div>
  );
}
