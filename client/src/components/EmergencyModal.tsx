import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { emergencyProtocols, type EmergencyProtocol } from '@/data/emergencyProtocols';
import { AlertTriangle, Pill, Activity, Droplet } from 'lucide-react';

interface EmergencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmergencyModal({ open, onOpenChange }: EmergencyModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<string>(emergencyProtocols[0]?.id || '');

  const currentProtocol = emergencyProtocols.find(p => p.id === selectedProtocol);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-3xl">🚨</span>
            <span className="text-red-600 font-bold">MODO EMERGÊNCIA</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Acesso rápido a protocolos de situações críticas em hematologia
          </p>
        </DialogHeader>

        <Tabs value={selectedProtocol} onValueChange={setSelectedProtocol} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            {emergencyProtocols.map((protocol) => (
              <TabsTrigger
                key={protocol.id}
                value={protocol.id}
                className="text-xs sm:text-sm flex items-center gap-1"
              >
                <span>{protocol.icon}</span>
                <span className="hidden sm:inline">{protocol.title.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {emergencyProtocols.map((protocol) => (
            <TabsContent key={protocol.id} value={protocol.id} className="space-y-4">
              {/* Título do Protocolo */}
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border-2 border-red-200 dark:border-red-800">
                <h2 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <span className="text-2xl">{protocol.icon}</span>
                  {protocol.title}
                </h2>
              </div>

              {/* Diagnóstico */}
              {protocol.diagnosis && (
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader className="bg-orange-50 dark:bg-orange-950">
                    <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <Activity className="h-5 w-5" />
                      {protocol.diagnosis.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2">
                      {protocol.diagnosis.criteria.map((criterion, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Badge variant="outline" className="mt-0.5 shrink-0">
                            {idx + 1}
                          </Badge>
                          <span className="font-medium">{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Manejo */}
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-blue-50 dark:bg-blue-950">
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Droplet className="h-5 w-5" />
                    {protocol.management.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {protocol.management.steps.map((step, idx) => (
                    <div key={idx} className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 py-2">
                      <h3 className="font-bold text-lg text-blue-900 dark:text-blue-300 mb-2">
                        {step.step}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">{step.description}</p>

                      {/* Detalhes */}
                      {step.details && step.details.length > 0 && (
                        <ul className="space-y-1 mb-3">
                          {step.details.map((detail, detailIdx) => (
                            <li key={detailIdx} className="text-sm flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Medicações */}
                      {step.medications && step.medications.length > 0 && (
                        <div className="space-y-3 mt-3">
                          {step.medications.map((med, medIdx) => (
                            <div
                              key={medIdx}
                              className="bg-green-50 dark:bg-green-950 p-3 rounded-md border border-green-200 dark:border-green-800"
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <Pill className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                                <div className="flex-1">
                                  <h4 className="font-bold text-green-900 dark:text-green-300">
                                    {med.name}
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-sm">
                                    <div>
                                      <span className="font-semibold">Dose:</span> {med.dose}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Via:</span> {med.route}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Frequência:</span> {med.frequency}
                                    </div>
                                  </div>
                                  {med.notes && (
                                    <p className="text-xs text-muted-foreground mt-2 italic">
                                      {med.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Monitorização */}
              {protocol.monitoring && protocol.monitoring.length > 0 && (
                <Card className="border-purple-200 dark:border-purple-800">
                  <CardHeader className="bg-purple-50 dark:bg-purple-950">
                    <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                      <Activity className="h-5 w-5" />
                      Monitorização Necessária
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2">
                      {protocol.monitoring.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Badge variant="secondary" className="mt-0.5 shrink-0">
                            ✓
                          </Badge>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Alertas */}
              {protocol.alerts && protocol.alerts.length > 0 && (
                <div className="space-y-2">
                  {protocol.alerts.map((alert, idx) => (
                    <Alert key={idx} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="font-medium">{alert}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
