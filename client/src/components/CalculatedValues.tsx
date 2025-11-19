import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CalculatedValues } from '@/types/calculator';
import { Activity, Calculator, Droplet } from 'lucide-react';

interface CalculatedValuesProps {
  values: CalculatedValues;
}

export default function CalculatedValuesDisplay({ values }: CalculatedValuesProps) {
  const getRenalStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'red':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valores Calculados</CardTitle>
        <CardDescription>
          Cálculos automáticos baseados nos dados do paciente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Superfície Corporal */}
          <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
            <div className="p-2 bg-primary/10 rounded-md">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Superfície Corporal (SC)
              </p>
              <p className="text-2xl font-bold text-foreground">
                {values.bsa.toFixed(2)} m²
              </p>
              <p className="text-xs text-muted-foreground mt-1">Fórmula de DuBois</p>
            </div>
          </div>

          {/* eGFR */}
          <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
            <div className="p-2 bg-secondary/10 rounded-md">
              <Droplet className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                eGFR (CKD-EPI 2021)
              </p>
              <p className="text-2xl font-bold text-foreground">
                {values.egfr.toFixed(1)} mL/min
              </p>
              <Badge
                variant="outline"
                className={`mt-2 ${getRenalStatusColor(values.renalStatus)}`}
              >
                {values.renalStatusLabel.split(' - ')[0]}
              </Badge>
            </div>
          </div>

          {/* Fator de Ajuste Global */}
          <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
            <div className="p-2 bg-accent/10 rounded-md">
              <Activity className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Fator de Ajuste Global
              </p>
              <p className="text-2xl font-bold text-foreground">
                {(values.globalAdjustmentFactor * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ECOG + Idade
              </p>
            </div>
          </div>
        </div>

        {/* Classificação Renal Detalhada */}
        <div className={`mt-4 p-4 rounded-lg border-2 ${getRenalStatusColor(values.renalStatus)}`}>
          <p className="font-semibold mb-1">Função Renal:</p>
          <p className="text-sm">{values.renalStatusLabel}</p>
        </div>
      </CardContent>
    </Card>
  );
}
