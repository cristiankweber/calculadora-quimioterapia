import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ctcaeToxicities, getDoseAdjustmentFactor, getToxicityRecommendations, ToxicityGrade } from '@/data/ctcae';
import { AlertTriangle, Info } from 'lucide-react';

interface ToxicityAssessmentProps {
  toxicities: { [toxicity: string]: ToxicityGrade };
  onToxicityChange: (toxicity: string, grade: ToxicityGrade) => void;
}

export default function ToxicityAssessment({ toxicities, onToxicityChange }: ToxicityAssessmentProps) {
  const adjustmentFactor = getDoseAdjustmentFactor(toxicities);
  const recommendations = getToxicityRecommendations(toxicities);

  const hematologicToxicities = Object.entries(ctcaeToxicities).filter(
    ([_, criteria]) => criteria.category === 'hematologic'
  );

  const nonHematologicToxicities = Object.entries(ctcaeToxicities).filter(
    ([_, criteria]) => criteria.category === 'non-hematologic'
  );

  const getAdjustmentColor = (factor: number) => {
    if (factor === 1) return 'text-green-600';
    if (factor >= 0.75) return 'text-yellow-600';
    if (factor >= 0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getAdjustmentText = (factor: number) => {
    if (factor === 1) return 'Sem ajuste necessário';
    if (factor === 0.75) return 'Reduzir 25% da dose';
    if (factor === 0.5) return 'Reduzir 50% da dose';
    if (factor === 0) return 'SUSPENDER tratamento';
    return `Ajustar para ${(factor * 100).toFixed(0)}% da dose`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Avaliação de Toxicidade (CTCAE v5.0)
        </CardTitle>
        <CardDescription>
          Selecione os graus de toxicidade apresentados pelo paciente para calcular ajuste de dose
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toxicidades Hematológicas */}
        <div>
          <h3 className="font-semibold text-sm mb-3 text-blue-700">Toxicidades Hematológicas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hematologicToxicities.map(([key, criteria]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{criteria.name}</Label>
                <Select
                  value={toxicities[key]?.toString() || '0'}
                  onValueChange={(value) => onToxicityChange(key, parseInt(value) as ToxicityGrade)}
                >
                  <SelectTrigger id={key}>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(criteria.grades).map(([grade, description]) => (
                      <SelectItem key={grade} value={grade}>
                        G{grade}: {description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Toxicidades Não-Hematológicas */}
        <div>
          <h3 className="font-semibold text-sm mb-3 text-purple-700">Toxicidades Não-Hematológicas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonHematologicToxicities.map(([key, criteria]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{criteria.name}</Label>
                <Select
                  value={toxicities[key]?.toString() || '0'}
                  onValueChange={(value) => onToxicityChange(key, parseInt(value) as ToxicityGrade)}
                >
                  <SelectTrigger id={key}>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(criteria.grades).map(([grade, description]) => (
                      <SelectItem key={grade} value={grade}>
                        G{grade}: {description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Recomendações de Ajuste */}
        {recommendations.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Ajuste de Dose Recomendado</h3>
              <span className={`text-lg font-bold ${getAdjustmentColor(adjustmentFactor)}`}>
                {getAdjustmentText(adjustmentFactor)}
              </span>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-yellow-900">Recomendações por Toxicidade:</p>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {recommendations.map((rec, index) => (
                      <li key={index} className="pl-4">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> O ajuste de dose é calculado baseado na toxicidade mais grave. Sempre considere o
              contexto clínico individual do paciente e as diretrizes específicas do protocolo.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
