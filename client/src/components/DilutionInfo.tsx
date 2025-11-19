import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Beaker, Clock, Droplet, Info } from 'lucide-react';
import { Drug } from '@/types/calculator';
import { getDilutionInfo } from '@/data/dilutionData';
import { calculateDilution, formatInfusionTime } from '@/lib/dilutionCalculations';

interface DilutionInfoProps {
  drugs: Drug[];
}

export default function DilutionInfo({ drugs }: DilutionInfoProps) {
  if (drugs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5 text-primary" />
          Informações de Diluição e Administração
        </CardTitle>
        <CardDescription>
          Parâmetros de preparo baseados na tabela CMI/HCPA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {drugs.map((drug, index) => {
          const dilutionInfo = getDilutionInfo(drug.name);
          
          if (!dilutionInfo) {
            return (
              <div key={index} className="p-4 border rounded-lg bg-muted/30">
                <p className="font-semibold text-sm">{drug.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Informações de diluição não disponíveis no banco de dados CMI
                </p>
              </div>
            );
          }

          const calculatedDose = drug.calculatedDose || 0;
          const dilutionResult = calculateDilution(drug.name, calculatedDose, dilutionInfo);

          return (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              {/* Cabeçalho da droga */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-base">{drug.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Dose calculada: <span className="font-medium text-foreground">{calculatedDose.toFixed(1)} mg</span>
                  </p>
                </div>
                {dilutionInfo.photosensitive && (
                  <Badge variant="destructive" className="text-xs">
                    Fotossensível
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Parâmetros de diluição */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Droplet className="h-3 w-3" />
                    Volume
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {dilutionResult.recommendedVolume} mL
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dilutionResult.diluent}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Beaker className="h-3 w-3" />
                    Concentração
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {dilutionResult.finalConcentration.toFixed(2)} mg/mL
                  </p>
                  {dilutionInfo.maxConcentration && (
                    <p className="text-xs text-muted-foreground">
                      Máx: {dilutionInfo.maxConcentration.value} mg/mL
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Tempo
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {formatInfusionTime(dilutionResult.infusionTime)}
                  </p>
                  {dilutionInfo.infusionTime && (
                    <p className="text-xs text-muted-foreground">
                      {dilutionInfo.infusionTime.min && `Mín: ${dilutionInfo.infusionTime.min}min`}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    Velocidade
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {dilutionResult.infusionRate} mL/h
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bomba de infusão
                  </p>
                </div>
              </div>

              {/* Avisos */}
              {dilutionResult.warnings.length > 0 && (
                <Alert variant="default" className="bg-yellow-50 border-yellow-300">
                  <AlertTriangle className="h-4 w-4 text-yellow-700" />
                  <AlertDescription className="text-sm text-yellow-800">
                    <ul className="list-disc list-inside space-y-1">
                      {dilutionResult.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Instruções especiais */}
              {dilutionResult.specialInstructions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-900 mb-2">Instruções Especiais:</p>
                  {dilutionResult.specialInstructions.map((instruction, idx) => (
                    <p key={idx} className="text-xs text-blue-800">
                      {instruction}
                    </p>
                  ))}
                </div>
              )}

              {/* Badges de compatibilidade */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={dilutionInfo.pvcCompatible ? 'outline' : 'destructive'} className="text-xs">
                  {dilutionInfo.pvcCompatible ? '✓ PVC OK' : '✗ Sem PVC'}
                </Badge>
                {dilutionInfo.specialEquipment && (
                  <Badge variant="secondary" className="text-xs">
                    {dilutionInfo.specialEquipment === 'LPVC' && 'Equipo LPVC'}
                    {dilutionInfo.specialEquipment === 'FS' && 'Equipo Fotossensível'}
                    {dilutionInfo.specialEquipment === 'Filtro' && 'Equipo c/ Filtro'}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}

        {/* Nota de rodapé */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Informações baseadas na tabela CMI/HCPA (atualização 11/05/18). 
            Sempre verificar protocolo institucional e bula do medicamento.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
