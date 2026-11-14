import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalculatedValues } from "@/types/calculator";
import { Activity, Calculator, Droplet } from "lucide-react";

interface CalculatedValuesProps {
  values: CalculatedValues;
  referenceOnly?: boolean;
}

export default function CalculatedValuesDisplay({
  values,
  referenceOnly = false,
}: CalculatedValuesProps) {
  const color =
    values.renalStatus === "green"
      ? "bg-green-100 text-green-800 border-green-300"
      : values.renalStatus === "yellow"
        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
        : "bg-red-100 text-red-800 border-red-300";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Valores Calculados</CardTitle>
        <CardDescription>
          {referenceOnly
            ? "Medidas para simulação; sem ajuste automático de dose"
            : "Cálculos automáticos baseados nos dados do paciente"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="shrink-0 p-2 bg-primary/10 rounded-md">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                Superfície Corporal (SC)
              </p>
              <p className="text-2xl font-bold text-foreground">
                {values.bsa.toFixed(2)} m²
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Fórmula de DuBois
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="shrink-0 p-2 bg-secondary/10 rounded-md">
              <Droplet className="h-5 w-5 text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                eGFR (CKD-EPI 2021)
              </p>
              <p className="text-2xl font-bold text-foreground">
                {values.egfr.toFixed(1)}
                {!referenceOnly && " mL/min"}
              </p>
              {referenceOnly ? (
                <p className="text-xs text-muted-foreground mt-1">
                  mL/min/1,73 m²
                </p>
              ) : (
                <Badge
                  variant="outline"
                  className={`mt-2 whitespace-normal ${color}`}
                >
                  {values.renalStatusLabel.split(" - ")[0]}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="shrink-0 p-2 bg-accent/10 rounded-md">
              <Activity className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                {referenceOnly ? "Ajustes de dose" : "Fator de Ajuste Global"}
              </p>
              <p
                className={
                  referenceOnly
                    ? "text-base font-semibold text-foreground"
                    : "text-2xl font-bold text-foreground"
                }
              >
                {referenceOnly
                  ? "Sem ajuste automático"
                  : `${(values.globalAdjustmentFactor * 100).toFixed(0)}%`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {referenceOnly
                  ? "Definição médica conforme protocolo e condições clínicas"
                  : "ECOG + Idade"}
              </p>
            </div>
          </div>
        </div>
        <div
          className={`mt-4 p-4 rounded-lg border-2 ${referenceOnly ? "border-border bg-muted/30 text-foreground" : color}`}
        >
          <p className="font-semibold mb-1">Função renal:</p>
          <p className="text-sm">
            {referenceOnly
              ? "Estimativa indexada; não substitui GFR absoluto para Calvert e não determina elegibilidade, ajuste ou autorização para administrar."
              : values.renalStatusLabel}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
