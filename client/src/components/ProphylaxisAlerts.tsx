import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Protocol, AntiemeticProphylaxis } from '@/types/calculator';
import { AlertTriangle, Shield, Pill, Activity } from 'lucide-react';

interface ProphylaxisAlertsProps {
  protocol: Protocol | null;
  antiemetics: AntiemeticProphylaxis | null;
}

export default function ProphylaxisAlerts({ protocol, antiemetics }: ProphylaxisAlertsProps) {
  if (!protocol) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profilaxias e Alertas</CardTitle>
          <CardDescription>
            Selecione um protocolo para visualizar as profilaxias recomendadas
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alertas Especiais */}
      {protocol.specialAlerts.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Alertas Especiais</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {protocol.specialAlerts.map((alert, index) => (
              <Alert key={index} variant="destructive">
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Profilaxias e Cuidados */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Profilaxias e Cuidados</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="prophylaxis" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="prophylaxis">Profilaxias</TabsTrigger>
              <TabsTrigger value="antiemetics">Antieméticos</TabsTrigger>
              <TabsTrigger value="nursing">Enfermagem</TabsTrigger>
            </TabsList>

            <TabsContent value="prophylaxis" className="space-y-3 mt-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center space-x-2">
                  <Pill className="h-4 w-4" />
                  <span>Profilaxias Obrigatórias/Recomendadas</span>
                </h4>
                <ul className="space-y-2">
                  {protocol.prophylaxis.map((item, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="antiemetics" className="space-y-3 mt-4">
              {antiemetics ? (
                <>
                  <div className="flex items-center space-x-2 mb-3">
                    <Badge
                      variant="outline"
                      className={
                        antiemetics.risk === 'high'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : antiemetics.risk === 'moderate'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                      }
                    >
                      Risco Emetogênico: {antiemetics.risk === 'high' ? 'Alto' : antiemetics.risk === 'moderate' ? 'Moderado' : antiemetics.risk === 'low' ? 'Baixo' : 'Mínimo'}
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Dia 1 (Pré-QT):</h4>
                      <ul className="space-y-1">
                        {antiemetics.day1.map((item, index) => (
                          <li key={index} className="flex items-start space-x-2 text-sm">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">Dias 2-4:</h4>
                      <ul className="space-y-1">
                        {antiemetics.days2to4.map((item, index) => (
                          <li key={index} className="flex items-start space-x-2 text-sm">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">Medicações de Resgate:</h4>
                      <ul className="space-y-1">
                        {antiemetics.rescue.map((item, index) => (
                          <li key={index} className="flex items-start space-x-2 text-sm">
                            <span className="text-secondary mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {antiemetics.alerts.length > 0 && (
                      <div className="mt-4">
                        {antiemetics.alerts.map((alert, index) => (
                          <Alert key={index} className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">{alert}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma profilaxia antiemética configurada
                </p>
              )}
            </TabsContent>

            <TabsContent value="nursing" className="space-y-3 mt-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>Cuidados de Enfermagem</span>
                </h4>
                <ul className="space-y-2">
                  {protocol.nursingCare.map((item, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <span className="text-secondary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Ajustes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustes de Dose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {protocol.renalAdjustments.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-primary">Ajustes Renais:</h4>
              <ul className="space-y-1">
                {protocol.renalAdjustments.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {protocol.hepaticAdjustments.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-secondary">Ajustes Hepáticos:</h4>
              <ul className="space-y-1">
                {protocol.hepaticAdjustments.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {protocol.hematologicAdjustments.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-accent">Ajustes Hematológicos:</h4>
              <ul className="space-y-1">
                {protocol.hematologicAdjustments.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
