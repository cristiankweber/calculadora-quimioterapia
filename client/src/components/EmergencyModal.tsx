import { useState, useMemo } from 'react';
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
import { AlertTriangle, Pill, Activity, Droplet, User, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { calculateEmergencyDose, type CalculatedDose } from '@/lib/emergencyDoseCalculations';

export interface EmergencyPatientData {
  name: string;
  age: number;
  sex: string;
  weight: number;
  height: number;
  bsa: number;
  egfr: number;
  creatinine: number;
}

interface EmergencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientData?: EmergencyPatientData | null;
  onSaveEmergencyPrescription?: (protocol: string, clinicalSituation: string, medications: any[]) => void;
}

export default function EmergencyModal({ open, onOpenChange, patientData, onSaveEmergencyPrescription }: EmergencyModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<string>(emergencyProtocols[0]?.id || '');
  const [usePatientData, setUsePatientData] = useState(false);
  const [clinicalSituation, setClinicalSituation] = useState('');

  const currentProtocol = emergencyProtocols.find(p => p.id === selectedProtocol);

  // Função para salvar prescrição de emergência
  const handleSaveEmergencyPrescription = () => {
    if (!currentProtocol || !patientData || !clinicalSituation.trim()) {
      toast.error('Preencha a situação clínica antes de salvar');
      return;
    }

    // Preparar medicações com doses calculadas
    const medications: any[] = [];
    currentProtocol.management.steps.forEach(step => {
      step.medications?.forEach(med => {
        const calculatedDose = calculatedDoses.get(med.name);
        medications.push({
          name: med.name,
          dose: calculatedDose ? `${calculatedDose.value.toFixed(1)} ${calculatedDose.unit}` : med.dose,
          route: med.route,
          frequency: med.frequency,
          notes: med.notes,
          calculation: calculatedDose?.calculation
        });
      });
    });

    // Chamar callback para salvar
    if (onSaveEmergencyPrescription) {
      onSaveEmergencyPrescription(currentProtocol.title, clinicalSituation, medications);
      toast.success('Prescrição de emergência salva no histórico!');
      
      // Limpar campo de situação clínica após salvar
      setClinicalSituation('');
      setUsePatientData(false);
    } else {
      toast.error('Função de salvamento não disponível');
    }
  };

  // Calcular doses automaticamente quando dados do paciente estão disponíveis
  const calculatedDoses = useMemo(() => {
    if (!usePatientData || !patientData) return new Map<string, CalculatedDose>();
    
    const dosesMap = new Map<string, CalculatedDose>();
    
    // Iterar por todos os steps e medicações do protocolo atual
    currentProtocol?.management.steps.forEach(step => {
      step.medications?.forEach(med => {
        const calculated = calculateEmergencyDose(med.name, {
          weight: patientData.weight,
          bsa: patientData.bsa,
          egfr: patientData.egfr
        });
        if (calculated) {
          dosesMap.set(med.name, calculated);
        }
      });
    });
    
    return dosesMap;
  }, [usePatientData, patientData, currentProtocol]);

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

        {/* Integração com Dados do Paciente */}
        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-300">
                    {patientData ? `${patientData.name || 'Paciente Atual'} - ${patientData.age} anos - ${patientData.sex}` : 'Nenhum paciente carregado'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {patientData ? `Peso: ${patientData.weight}kg | SC: ${patientData.bsa.toFixed(2)}m² | eGFR: ${patientData.egfr.toFixed(0)} mL/min` : 'Preencha os dados do paciente na tela principal'}
                  </p>
                </div>
              </div>
              <Button
                variant={usePatientData ? "default" : "outline"}
                size="sm"
                onClick={() => setUsePatientData(!usePatientData)}
                disabled={!patientData}
                className={usePatientData ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                {usePatientData ? '✓ Usando Dados' : 'Usar Dados do Paciente'}
              </Button>
            </div>

            {/* Campo Situação Clínica */}
            <div className="space-y-2">
              <Label htmlFor="clinical-situation" className="text-blue-900 dark:text-blue-300">
                Situação Clínica (Contexto da Emergência)
              </Label>
              <Input
                id="clinical-situation"
                placeholder="Ex: Paciente com LLA em indução, leucometria 250.000, dispneia progressiva..."
                value={clinicalSituation}
                onChange={(e) => setClinicalSituation(e.target.value)}
                className="bg-white dark:bg-gray-900"
              />
            </div>
          </div>

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
                                      <span className="font-semibold">Dose:</span> 
                                      {calculatedDoses.has(med.name) ? (
                                        <span className="font-bold text-blue-600 dark:text-blue-400">
                                          {calculatedDoses.get(med.name)!.value.toFixed(1)} {calculatedDoses.get(med.name)!.unit}
                                        </span>
                                      ) : (
                                        med.dose
                                      )}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Via:</span> {med.route}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Frequência:</span> {med.frequency}
                                    </div>
                                  </div>
                                  {calculatedDoses.has(med.name) && (
                                    <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900 rounded text-xs">
                                      <span className="font-semibold text-blue-900 dark:text-blue-300">ℹ️ Cálculo:</span>
                                      <span className="text-blue-800 dark:text-blue-400"> {calculatedDoses.get(med.name)!.calculation}</span>
                                    </div>
                                  )}
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

        {/* Footer com botão Salvar */}
        {usePatientData && patientData && (
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-t">
            <p className="text-sm text-muted-foreground">
              {clinicalSituation ? (
                <span>✓ Situação clínica documentada</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">⚠️ Preencha a situação clínica antes de salvar</span>
              )}
            </p>
            <Button
              onClick={handleSaveEmergencyPrescription}
              disabled={!clinicalSituation.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar no Histórico
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
