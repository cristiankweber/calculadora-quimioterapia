/**
 * PdfPreviewModal — Modal de prévia do PDF com personalização de seções.
 *
 * Exibe uma prévia visual do documento completo (dados do paciente, doses,
 * profilaxias, hidratação, eletrólitos, transfusão) e permite ao usuário
 * selecionar quais seções incluir antes de gerar o PDF ou imprimir.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  FileDown,
  Printer,
  Eye,
  Settings2,
  ChevronLeft,
  ChevronRight,
  User,
  Calculator,
  Pill,
  ShieldAlert,
  Stethoscope,
  Droplets,
  Zap,
  Heart,
  ClipboardList,
  Syringe,
} from 'lucide-react';
import type { PatientData, Protocol, Drug, CalculatedValues, AntiemeticProphylaxis } from '@/types/calculator';
import type { HydrationResult, ElectrolyteReplacement, TransfusionRecommendation } from '@/lib/hydrationSupport';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PdfSections {
  patientData: boolean;
  calculatedValues: boolean;
  protocol: boolean;
  drugs: boolean;
  specialAlerts: boolean;
  prophylaxis: boolean;
  antiemetics: boolean;
  nursingCare: boolean;
  doseAdjustments: boolean;
  hydration: boolean;
  electrolytes: boolean;
  transfusion: boolean;
}

export interface PdfPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientData;
  calculatedValues: CalculatedValues;
  protocol: Protocol;
  cycle: number;
  drugs: Drug[];
  antiemetics: AntiemeticProphylaxis;
  prescriptionId?: string;
  institutionName?: string;
  institutionLogo?: string;
  prescriberName?: string;
  prescriberCRM?: string;
  hydration?: HydrationResult | null;
  electrolytes?: ElectrolyteReplacement[];
  transfusion?: TransfusionRecommendation[];
  onConfirmPdf: (sections: PdfSections) => void;
  onConfirmPrint: (sections: PdfSections) => void;
}

// ── Configuração de Seções ───────────────────────────────────────────────────

interface SectionConfig {
  key: keyof PdfSections;
  label: string;
  icon: React.ReactNode;
  description: string;
  required?: boolean;
  hasData: boolean;
}

const DEFAULT_SECTIONS: PdfSections = {
  patientData: true,
  calculatedValues: true,
  protocol: true,
  drugs: true,
  specialAlerts: true,
  prophylaxis: true,
  antiemetics: true,
  nursingCare: true,
  doseAdjustments: true,
  hydration: true,
  electrolytes: true,
  transfusion: true,
};

// ── Componente Principal ─────────────────────────────────────────────────────

export default function PdfPreviewModal({
  open,
  onOpenChange,
  patient,
  calculatedValues,
  protocol,
  cycle,
  drugs,
  antiemetics,
  prescriptionId,
  institutionName = 'Hospital / Clínica',
  institutionLogo,
  prescriberName = 'Médico Responsável',
  prescriberCRM = 'CRM XXXXX',
  hydration,
  electrolytes,
  transfusion,
  onConfirmPdf,
  onConfirmPrint,
}: PdfPreviewModalProps) {
  const [sections, setSections] = useState<PdfSections>(DEFAULT_SECTIONS);
  const [showSettings, setShowSettings] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const toggleSection = useCallback((key: keyof PdfSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const selectAll = useCallback(() => {
    setSections(DEFAULT_SECTIONS);
  }, []);

  const selectMinimal = useCallback(() => {
    setSections({
      patientData: true,
      calculatedValues: true,
      protocol: true,
      drugs: true,
      specialAlerts: true,
      prophylaxis: false,
      antiemetics: true,
      nursingCare: false,
      doseAdjustments: false,
      hydration: false,
      electrolytes: false,
      transfusion: false,
    });
  }, []);

  // Determinar quais seções têm dados
  const hasHydration = !!(hydration && hydration.protocolType !== 'none' && hydration.schemes.length > 0);
  const hasElectrolytes = !!(electrolytes && electrolytes.filter(e => e.status !== 'normal').length > 0);
  const hasTransfusion = !!(transfusion && transfusion.filter(t => t.indicated).length > 0);
  const hasSpecialAlerts = protocol.specialAlerts.length > 0;
  const hasDoseAdjustments = protocol.renalAdjustments.length > 0 || protocol.hepaticAdjustments.length > 0 || protocol.hematologicAdjustments.length > 0;

  const sectionConfigs: SectionConfig[] = [
    { key: 'patientData', label: 'Dados do Paciente', icon: <User className="h-4 w-4" />, description: 'Nome, idade, peso, altura, creatinina', required: true, hasData: true },
    { key: 'calculatedValues', label: 'Valores Calculados', icon: <Calculator className="h-4 w-4" />, description: 'SC, eGFR, status renal, fator de ajuste', hasData: true },
    { key: 'protocol', label: 'Protocolo', icon: <ClipboardList className="h-4 w-4" />, description: 'Nome, indicação, ciclo', required: true, hasData: true },
    { key: 'drugs', label: 'Drogas Prescritas', icon: <Pill className="h-4 w-4" />, description: 'Tabela de medicações com doses calculadas', required: true, hasData: drugs.length > 0 },
    { key: 'specialAlerts', label: 'Alertas Especiais', icon: <ShieldAlert className="h-4 w-4" />, description: 'Alertas do protocolo', hasData: hasSpecialAlerts },
    { key: 'prophylaxis', label: 'Profilaxias', icon: <Stethoscope className="h-4 w-4" />, description: 'Profilaxias obrigatórias e recomendadas', hasData: protocol.prophylaxis.length > 0 },
    { key: 'antiemetics', label: 'Profilaxia Antiemética', icon: <Syringe className="h-4 w-4" />, description: 'Esquema antiemético D1, D2-D4 e resgate', hasData: true },
    { key: 'nursingCare', label: 'Cuidados de Enfermagem', icon: <Heart className="h-4 w-4" />, description: 'Orientações para equipe de enfermagem', hasData: protocol.nursingCare.length > 0 },
    { key: 'doseAdjustments', label: 'Ajustes de Dose', icon: <Settings2 className="h-4 w-4" />, description: 'Ajustes renais, hepáticos e hematológicos', hasData: hasDoseAdjustments },
    { key: 'hydration', label: 'Esquema de Hidratação', icon: <Droplets className="h-4 w-4" />, description: 'Hidratação pré/pós-QT', hasData: hasHydration },
    { key: 'electrolytes', label: 'Reposição de Eletrólitos', icon: <Zap className="h-4 w-4" />, description: 'Correção de distúrbios eletrolíticos', hasData: hasElectrolytes },
    { key: 'transfusion', label: 'Suporte Transfusional', icon: <Heart className="h-4 w-4" />, description: 'Hemácias e plaquetas', hasData: hasTransfusion },
  ];

  const enabledCount = Object.values(sections).filter(Boolean).length;
  const totalCount = sectionConfigs.length;

  const formatDate = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());
  };

  const antiemeticRiskLabel = antiemetics.risk === 'high' ? 'Alto'
    : antiemetics.risk === 'moderate' ? 'Moderado'
    : antiemetics.risk === 'low' ? 'Baixo' : 'Mínimo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[1200px] h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Preview da Prescrição
            </DialogTitle>
            <DialogDescription className="mt-1">
              Revise o documento antes de gerar o PDF. Personalize as seções no painel lateral.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {enabledCount}/{totalCount} seções
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="gap-1"
            >
              <Settings2 className="h-4 w-4" />
              {showSettings ? 'Ocultar' : 'Seções'}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Settings Panel */}
          {showSettings && (
            <div className="w-72 border-r bg-muted/30 flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm mb-2">Seções do Documento</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll} className="text-xs flex-1">
                    Todas
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectMinimal} className="text-xs flex-1">
                    Mínimo
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-1">
                  {sectionConfigs.map((config) => (
                    <div
                      key={config.key}
                      className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                        !config.hasData ? 'opacity-40' : sections[config.key] ? 'bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Switch
                        checked={sections[config.key]}
                        onCheckedChange={() => toggleSection(config.key)}
                        disabled={config.required || !config.hasData}
                        className="scale-75"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{config.icon}</span>
                          <span className="text-xs font-medium truncate">{config.label}</span>
                          {config.required && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">Obrigatório</Badge>
                          )}
                          {!config.hasData && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">Sem dados</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Preview Area */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              <div
                ref={previewRef}
                className="bg-white text-black mx-auto shadow-lg border rounded-sm"
                style={{ maxWidth: '210mm', minHeight: '297mm', padding: '20mm', fontSize: '11pt', lineHeight: '1.4' }}
              >
                {/* Cabeçalho */}
                <div className="border-b-[3px] border-blue-600 pb-4 mb-5 flex items-start justify-between">
                  <div className="flex-1">
                    {institutionLogo && (
                      <img src={institutionLogo} alt="Logo" className="h-14 mb-2" />
                    )}
                    <h1 className="text-[20pt] font-bold text-blue-600 m-0">PRESCRIÇÃO DE QUIMIOTERAPIA</h1>
                    <p className="text-gray-500 text-sm">{institutionName}</p>
                    <p className="text-gray-500 text-sm">Data de Emissão: {formatDate()}</p>
                  </div>
                  {prescriptionId && (
                    <div className="text-right text-xs text-gray-500">
                      <p>ID: {prescriptionId.slice(-8)}</p>
                    </div>
                  )}
                </div>

                {/* Dados do Paciente */}
                {sections.patientData && (
                  <PreviewSection title="DADOS DO PACIENTE" icon="👤">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <InfoItem label="Nome/Identificador" value={patient.name || 'Não informado'} />
                      <InfoItem label="Idade" value={`${patient.age} anos`} />
                      <InfoItem label="Sexo" value={patient.sex === 'M' ? 'Masculino' : 'Feminino'} />
                      <InfoItem label="ECOG" value={String(patient.ecog)} />
                      <InfoItem label="Peso" value={`${patient.weight} kg`} />
                      <InfoItem label="Altura" value={`${patient.height} cm`} />
                      <InfoItem label="Creatinina" value={`${patient.creatinine} mg/dL`} />
                      <InfoItem label="Bilirrubina" value={`${patient.bilirubin} mg/dL`} />
                    </div>
                    {patient.comorbidities && (
                      <div className="mt-2 text-sm">
                        <span className="font-bold text-blue-600">Comorbidades:</span> {patient.comorbidities}
                      </div>
                    )}
                  </PreviewSection>
                )}

                {/* Valores Calculados */}
                {sections.calculatedValues && (
                  <PreviewSection title="VALORES CALCULADOS" icon="📊">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <div>
                        <span className="font-bold text-blue-600">SC (DuBois):</span>{' '}
                        <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-xs font-bold">{calculatedValues.bsa.toFixed(2)} m²</span>
                      </div>
                      <div>
                        <span className="font-bold text-blue-600">eGFR (CKD-EPI 2021):</span>{' '}
                        <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-xs font-bold">{calculatedValues.egfr.toFixed(1)} mL/min</span>
                      </div>
                      <div>
                        <span className="font-bold text-blue-600">Função Renal:</span>{' '}
                        <span className={`font-bold ${
                          calculatedValues.renalStatus === 'green' ? 'text-green-600' :
                          calculatedValues.renalStatus === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                        }`}>{calculatedValues.renalStatusLabel}</span>
                      </div>
                      <div>
                        <span className="font-bold text-blue-600">Fator de Ajuste:</span>{' '}
                        <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-xs font-bold">{(calculatedValues.globalAdjustmentFactor * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </PreviewSection>
                )}

                {/* Protocolo */}
                {sections.protocol && (
                  <PreviewSection title="PROTOCOLO QUIMIOTERÁPICO" icon="📋">
                    <div className="text-sm space-y-1">
                      <InfoItem label="Protocolo" value={`${protocol.name} - Ciclo ${cycle}/${protocol.cycles}`} />
                      <InfoItem label="Indicação" value={protocol.indication} />
                      <InfoItem label="Duração do Ciclo" value={`${protocol.cycleLength} dias`} />
                    </div>
                  </PreviewSection>
                )}

                {/* Drogas */}
                {sections.drugs && (
                  <PreviewSection title="DROGAS PRESCRITAS" icon="💊">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left font-bold">Droga</th>
                          <th className="border border-gray-300 p-2 text-left font-bold">Dose Base</th>
                          <th className="border border-gray-300 p-2 text-left font-bold">Dose Calculada</th>
                          <th className="border border-gray-300 p-2 text-left font-bold">Via</th>
                          <th className="border border-gray-300 p-2 text-left font-bold">Dias</th>
                          <th className="border border-gray-300 p-2 text-left font-bold">Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drugs.map((drug, i) => (
                          <tr key={i}>
                            <td className="border border-gray-300 p-2 font-bold">{drug.name}</td>
                            <td className="border border-gray-300 p-2">{drug.dose} {drug.doseUnit}</td>
                            <td className="border border-gray-300 p-2 font-bold">{(drug.calculatedDose || 0).toFixed(1)} mg</td>
                            <td className="border border-gray-300 p-2">{drug.route}</td>
                            <td className="border border-gray-300 p-2">{drug.days}</td>
                            <td className="border border-gray-300 p-2">{drug.observations || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </PreviewSection>
                )}

                {/* Alertas Especiais */}
                {sections.specialAlerts && hasSpecialAlerts && (
                  <PreviewSection title="ALERTAS ESPECIAIS" icon="⚠️">
                    {protocol.specialAlerts.map((alert, i) => (
                      <div key={i} className="bg-red-50 border-l-4 border-red-600 p-2.5 mb-2 text-sm">
                        <span className="font-bold text-red-600">ATENÇÃO:</span> {alert}
                      </div>
                    ))}
                  </PreviewSection>
                )}

                {/* Profilaxias */}
                {sections.prophylaxis && protocol.prophylaxis.length > 0 && (
                  <PreviewSection title="PROFILAXIAS OBRIGATÓRIAS/RECOMENDADAS" icon="🛡️">
                    <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                      {protocol.prophylaxis.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </PreviewSection>
                )}

                {/* Profilaxia Antiemética */}
                {sections.antiemetics && (
                  <PreviewSection title={`PROFILAXIA ANTIEMÉTICA (Risco ${antiemeticRiskLabel})`} icon="💉">
                    <div className="text-sm space-y-3">
                      <div>
                        <p className="font-bold mb-1">Dia 1 (Pré-QT):</p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                          {antiemetics.day1.map((med, i) => <li key={i}>{med}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold mb-1">Dias 2-4:</p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                          {antiemetics.days2to4.map((med, i) => <li key={i}>{med}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold mb-1">Medicações de Resgate:</p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                          {antiemetics.rescue.map((med, i) => <li key={i}>{med}</li>)}
                        </ul>
                      </div>
                    </div>
                  </PreviewSection>
                )}

                {/* Cuidados de Enfermagem */}
                {sections.nursingCare && protocol.nursingCare.length > 0 && (
                  <PreviewSection title="CUIDADOS DE ENFERMAGEM" icon="🩺">
                    <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                      {protocol.nursingCare.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </PreviewSection>
                )}

                {/* Ajustes de Dose */}
                {sections.doseAdjustments && hasDoseAdjustments && (
                  <PreviewSection title="AJUSTES DE DOSE" icon="⚙️">
                    {protocol.renalAdjustments.length > 0 && (
                      <div className="mb-3">
                        <p className="font-bold text-sm mb-1">Ajustes Renais:</p>
                        <ul className="list-disc list-inside text-sm space-y-0.5 ml-2">
                          {protocol.renalAdjustments.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                    {protocol.hepaticAdjustments.length > 0 && (
                      <div className="mb-3">
                        <p className="font-bold text-sm mb-1">Ajustes Hepáticos:</p>
                        <ul className="list-disc list-inside text-sm space-y-0.5 ml-2">
                          {protocol.hepaticAdjustments.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                    {protocol.hematologicAdjustments.length > 0 && (
                      <div>
                        <p className="font-bold text-sm mb-1">Ajustes Hematológicos:</p>
                        <ul className="list-disc list-inside text-sm space-y-0.5 ml-2">
                          {protocol.hematologicAdjustments.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                  </PreviewSection>
                )}

                {/* Hidratação */}
                {sections.hydration && hasHydration && hydration && (
                  <PreviewSection title={`ESQUEMA DE HIDRATAÇÃO — ${hydration.protocolLabel}`} icon="💧">
                    <div className="text-sm mb-2">
                      <span className="font-bold text-blue-600">Volume Total:</span>{' '}
                      <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-xs font-bold">{hydration.totalVolume} mL</span>
                    </div>
                    {hydration.alerts.length > 0 && (
                      <div className="mb-3">
                        {hydration.alerts.map((a, i) => (
                          <div key={i} className={`text-sm p-2 mb-1 rounded border-l-4 ${
                            a.type === 'danger' ? 'bg-red-50 border-red-500 text-red-800' :
                            a.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                            'bg-blue-50 border-blue-500 text-blue-800'
                          }`}>
                            <strong>{a.type === 'danger' ? 'PERIGO' : a.type === 'warning' ? 'ATENÇÃO' : 'INFO'}:</strong> {a.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {hydration.schemes.map((s, i) => (
                      <div key={i} className={`mb-2 p-3 rounded border-l-4 bg-gray-50 ${
                        s.phase === 'pre' ? 'border-blue-500' :
                        s.phase === 'concurrent' ? 'border-purple-500' : 'border-green-500'
                      }`}>
                        <p className="font-bold text-sm mb-1">{s.phaseLabel}</p>
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div><span className="font-medium">Solução:</span> {s.solution}</div>
                          <div><span className="font-medium">Volume:</span> {s.volume} mL</div>
                          <div><span className="font-medium">Velocidade:</span> {s.rate} mL/h</div>
                          <div><span className="font-medium">Duração:</span> {s.duration}h</div>
                        </div>
                        {s.additives && s.additives.length > 0 && (
                          <p className="text-xs mt-1"><span className="font-medium">Aditivos:</span> {s.additives.join(', ')}</p>
                        )}
                      </div>
                    ))}
                    {hydration.monitoring.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-bold">Monitorização:</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 ml-2 text-gray-600">
                          {hydration.monitoring.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    )}
                  </PreviewSection>
                )}

                {/* Eletrólitos */}
                {sections.electrolytes && hasElectrolytes && electrolytes && (
                  <PreviewSection title="REPOSIÇÃO DE ELETRÓLITOS" icon="⚡">
                    {electrolytes.filter(e => e.status !== 'normal').map((e, idx) => (
                      <div key={idx} className="mb-3 p-3 border rounded bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">{e.electrolyte}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            e.status === 'critical' ? 'bg-red-100 text-red-800' :
                            e.status === 'low' ? 'bg-yellow-100 text-yellow-800' :
                            e.status === 'high' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>{e.statusLabel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div><span className="font-medium">Valor Atual:</span> {e.currentValue} {e.unit}</div>
                          <div><span className="font-medium">Faixa Normal:</span> {e.normalRange}</div>
                        </div>
                        {e.alerts.length > 0 && e.alerts.map((a, ai) => (
                          <div key={ai} className="text-xs p-1.5 mb-1 bg-red-50 border-l-2 border-red-400 text-red-700">{a}</div>
                        ))}
                        {e.replacements.length > 0 && (
                          <table className="w-full text-xs border-collapse border border-gray-200 mt-2">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border border-gray-200 p-1 text-left">Solução</th>
                                <th className="border border-gray-200 p-1 text-left">Dose</th>
                                <th className="border border-gray-200 p-1 text-left">Via</th>
                                <th className="border border-gray-200 p-1 text-left">Velocidade</th>
                                <th className="border border-gray-200 p-1 text-left">Duração</th>
                                <th className="border border-gray-200 p-1 text-left">Frequência</th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.replacements.map((r, ri) => (
                                <tr key={ri}>
                                  <td className="border border-gray-200 p-1">{r.solution}</td>
                                  <td className="border border-gray-200 p-1 font-medium">{r.dose}</td>
                                  <td className="border border-gray-200 p-1">{r.route}</td>
                                  <td className="border border-gray-200 p-1">{r.rate}</td>
                                  <td className="border border-gray-200 p-1">{r.duration}</td>
                                  <td className="border border-gray-200 p-1">{r.frequency}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {e.monitoring.length > 0 && (
                          <div className="mt-1">
                            <p className="text-xs font-medium">Monitorização:</p>
                            <ul className="list-disc list-inside text-xs space-y-0.5 ml-2 text-gray-600">
                              {e.monitoring.map((m, mi) => <li key={mi}>{m}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </PreviewSection>
                )}

                {/* Transfusão */}
                {sections.transfusion && hasTransfusion && transfusion && (
                  <PreviewSection title="SUPORTE TRANSFUSIONAL" icon="🩸">
                    {transfusion.filter(t => t.indicated).map((t, idx) => (
                      <div key={idx} className={`mb-3 p-3 rounded border-l-4 bg-gray-50 ${
                        t.urgency === 'immediate' ? 'border-red-500' : 'border-yellow-500'
                      }`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">{t.productLabel}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            t.urgency === 'immediate' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>{t.urgencyLabel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div><span className="font-medium">Valor Atual:</span> {t.currentValue} {t.unit}</div>
                          <div><span className="font-medium">Threshold:</span> {t.threshold} {t.unit}</div>
                          <div><span className="font-medium">Volume:</span> {t.volume}</div>
                          <div><span className="font-medium">Incremento:</span> {t.expectedIncrement}</div>
                        </div>
                        {t.specialRequirements.length > 0 && (
                          <div className="mb-1">
                            <p className="text-xs font-bold">Requisitos Especiais:</p>
                            <ul className="list-disc list-inside text-xs ml-2">
                              {t.specialRequirements.map((r, ri) => <li key={ri}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                        {t.premedication.length > 0 && (
                          <div className="mb-1">
                            <p className="text-xs font-bold">Pré-Medicação:</p>
                            <ul className="list-disc list-inside text-xs ml-2">
                              {t.premedication.map((p, pi) => <li key={pi}>{p}</li>)}
                            </ul>
                          </div>
                        )}
                        {t.alerts.length > 0 && t.alerts.map((a, ai) => (
                          <div key={ai} className="text-xs p-1.5 mb-1 bg-red-50 border-l-2 border-red-400 text-red-700">{a}</div>
                        ))}
                      </div>
                    ))}
                  </PreviewSection>
                )}

                {/* Rodapé */}
                <div className="mt-8 pt-4 border-t-2 border-gray-200 text-xs text-gray-500">
                  <div className="flex justify-between items-end">
                    <div>
                      <p><strong>Data/Hora:</strong> {formatDate()}</p>
                      <p><strong>Prescritor:</strong> {prescriberName} - {prescriberCRM}</p>
                      <p><strong>Sistema:</strong> Calculadora de Prescrição Quimioterápica v4.1</p>
                    </div>
                    <div className="text-right">
                      <p className="mb-8">_________________________________</p>
                      <p>Assinatura do Prescritor</p>
                    </div>
                  </div>
                  <p className="mt-4 text-center text-gray-400">
                    Este documento foi gerado eletronicamente e possui validade com assinatura digital ou física.
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Revise o documento antes de gerar. Seções desabilitadas não serão incluídas.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => onConfirmPrint(sections)} className="gap-1">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button onClick={() => onConfirmPdf(sections)} className="gap-1">
              <FileDown className="h-4 w-4" /> Gerar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function PreviewSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="bg-blue-600 text-white px-3 py-2 font-bold text-xs tracking-wide mb-2.5">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <span className="font-bold text-blue-600">{label}:</span> {value}
    </div>
  );
}
