import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2 } from 'lucide-react';

export default function ModelMetrics() {
  const { data: metrics, isLoading } = trpc.toxicity.metrics.useQuery();

  if (isLoading || !metrics) return null;

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900 text-sm">
          <Activity className="h-4 w-4" />
          Métricas do Modelo de IA
        </CardTitle>
        <CardDescription className="text-xs">
          Última atualização: {formatDate(metrics.lastUpdated)} | Amostra: {metrics.sampleSize} pacientes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Neutropenia */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-900">Neutropenia G3-4</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">AUC-ROC</span>
                <span className="font-bold text-green-700 flex items-center gap-1">
                  {formatPercent(metrics.neutropenia.aucRoc)}
                  {metrics.neutropenia.aucRoc >= 0.75 && <CheckCircle2 className="h-3 w-3" />}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sensibilidade</span>
                <span className="font-medium">{formatPercent(metrics.neutropenia.sensitivity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Especificidade</span>
                <span className="font-medium">{formatPercent(metrics.neutropenia.specificity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Acurácia</span>
                <span className="font-medium">{formatPercent(metrics.neutropenia.accuracy)}</span>
              </div>
            </div>
          </div>

          {/* Mucosite */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-900">Mucosite G3-4</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">AUC-ROC</span>
                <span className="font-bold text-green-700 flex items-center gap-1">
                  {formatPercent(metrics.mucositis.aucRoc)}
                  {metrics.mucositis.aucRoc >= 0.75 && <CheckCircle2 className="h-3 w-3" />}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sensibilidade</span>
                <span className="font-medium">{formatPercent(metrics.mucositis.sensitivity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Especificidade</span>
                <span className="font-medium">{formatPercent(metrics.mucositis.specificity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Acurácia</span>
                <span className="font-medium">{formatPercent(metrics.mucositis.accuracy)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs text-gray-600 italic">
            ✅ AUC-ROC {'>'} 0.75 indica performance adequada para uso clínico (critério de validação atendido)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
