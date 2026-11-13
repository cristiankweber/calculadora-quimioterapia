import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PatientForm from '@/components/PatientForm';
import CalculatedValuesDisplay from '@/components/CalculatedValues';
import ProtocolSelector from '@/components/ProtocolSelector';
import DrugsTable from '@/components/DrugsTable';
import ProphylaxisAlerts from '@/components/ProphylaxisAlerts';
import DilutionInfo from '@/components/DilutionInfo';
import ToxicityAssessment from '@/components/ToxicityAssessment';
import { ToxicityPredictionWithMetrics } from '@/components/ToxicityPrediction';
import PatientHistoryDB from '@/components/PatientHistoryDB';
import EmergencyModal, { type EmergencyPatientData } from '@/components/EmergencyModal';
import HydrationCalculator, { type HydrationSupportData } from '@/components/HydrationCalculator';
import PdfPreviewModal, { type PdfSections } from '@/components/PdfPreviewModal';

// Lazy load PrintablePrescription para evitar travamento ao selecionar protocolo
const PrintablePrescription = lazy(() => import('@/components/PrintablePrescription'));

import type { PatientData, Protocol, Drug } from '@/types/calculator';
import type { ToxicityGrade } from '@/data/ctcae';

import { generateAntiemeticProphylaxis } from '@/lib/antiemetics';
import { trpc } from '@/lib/trpc';

// Hooks especializados extraídos
import { usePatientCalculations } from '@/hooks/usePatientCalculations';
import { useProtocolDoseCalculation } from '@/hooks/useProtocolDoseCalculation';
import { usePrescriptionActions } from '@/hooks/usePrescriptionActions';

import {
  FileDown,
  Copy,
  Save,
  Printer,
  Settings as SettingsIcon,
  BarChart3,
  AlertCircle,
  Droplets,
  Eye,
} from 'lucide-react';

export default function Calculator() {
  const [, setLocation] = useLocation();

  // ── Estado do Paciente ──────────────────────────────────────────────────
  const [patientData, setPatientData] = useState<PatientData>({
    name: '',
    age: 0,
    sex: 'M',
    weight: 0,
    height: 0,
    creatinine: 0,
    bilirubin: 0,
    ecog: 0,
    comorbidities: '',
  });

  const handlePatientChange = useCallback((newData: PatientData) => {
    setPatientData(prev => {
      for (const key in newData) {
        if (newData[key as keyof PatientData] !== prev[key as keyof PatientData]) {
          return newData;
        }
      }
      return prev;
    });
  }, []);

  // ── Cálculos do Paciente (BSA, eGFR, etc.) ─────────────────────────────
  const { calculatedValues, validationErrors } = usePatientCalculations(patientData);

  // ── Estado do Protocolo ─────────────────────────────────────────────────
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [toxicities, setToxicities] = useState<Record<string, ToxicityGrade>>({});
  const [showEmergency, setShowEmergency] = useState(false);

  // ── Dados de Hidratação/Eletrólitos/Transfusão (para PDF) ────────────────
  const [hydrationSupportData, setHydrationSupportData] = useState<HydrationSupportData | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const handleHydrationDataChange = useCallback((data: HydrationSupportData) => {
    setHydrationSupportData(data);
  }, []);

  // ── Cálculo de Doses ────────────────────────────────────────────────────
  const {
    calculatedDrugs,
    handleDoseChange,
    setCalculatedDrugs,
  } = useProtocolDoseCalculation({
    selectedProtocol,
    calculatedValues,
    weight: patientData.weight,
    toxicities,
    patientAge: patientData.age,
    patientSex: patientData.sex,
    patientCreatinine: patientData.creatinine,
  });

  // ── Antieméticos ────────────────────────────────────────────────────────
  const antiemetics = useMemo(() => {
    if (!selectedProtocol) return null;
    return generateAntiemeticProphylaxis(selectedProtocol.emetogenicRisk);
  }, [selectedProtocol?.emetogenicRisk]);

  // ── Configurações Institucionais ────────────────────────────────────────
  const { data: institutionSettings } = trpc.settings.get.useQuery();

  // ── Ações de Prescrição (salvar, copiar, PDF, imprimir) ─────────────────
  const {
    prescriptionId,
    showPrint,
    handleSaveToHistory,
    handleCopyPrescription,
    handleExportPDF,
    handlePrint,
    setShowPrint,
    validateBeforeAction,
  } = usePrescriptionActions({
    patientData,
    calculatedValues,
    selectedProtocol,
    selectedCycle,
    calculatedDrugs,
    antiemetics,
    toxicities,
    institutionSettings,
    hydrationSupportData,
  });

  // ── Dados do Paciente para Emergência ───────────────────────────────────
  const emergencyPatientData: EmergencyPatientData | null = useMemo(() => {
    if (!calculatedValues) return null;
    return {
      name: patientData.name,
      age: patientData.age,
      sex: patientData.sex,
      weight: patientData.weight,
      height: patientData.height,
      bsa: calculatedValues.bsa,
      egfr: calculatedValues.egfr,
      creatinine: patientData.creatinine,
    };
  }, [
    calculatedValues,
    patientData.name,
    patientData.age,
    patientData.sex,
    patientData.weight,
    patientData.height,
    patientData.creatinine,
  ]);

  // ── Carregar Histórico ──────────────────────────────────────────────────
  const handleLoadPatient = useCallback((loadedPatient: PatientData, prescriptionData?: any) => {
    setPatientData(loadedPatient);

    if (prescriptionData) {
      if (prescriptionData.protocol) setSelectedProtocol(prescriptionData.protocol);
      if (prescriptionData.cycle) setSelectedCycle(prescriptionData.cycle);
      if (prescriptionData.calculatedDrugs) setCalculatedDrugs(prescriptionData.calculatedDrugs);
      if (prescriptionData.toxicities) setToxicities(prescriptionData.toxicities);
    }
  }, [setCalculatedDrugs]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* HEADER */}
      <header className="border-b bg-card">
        <div className="container py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 xl:max-w-md xl:shrink-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Calculadora de Prescrição Quimioterápica</h1>
              <p className="text-muted-foreground">
                Hematologia • Oncologia • Terapia Celular
              </p>
            </div>
            <div className="flex w-full gap-2 flex-wrap xl:flex-1 xl:justify-end" role="group" aria-label="Ações da calculadora">
              <Button
                variant="destructive"
                onClick={() => setShowEmergency(true)}
                className="bg-red-600 hover:bg-red-700 font-bold"
              >
                <AlertCircle className="h-4 w-4 mr-2" /> EMERGÊNCIA
              </Button>
              <PatientHistoryDB onLoadPatient={handleLoadPatient} />
              <Button variant="outline" onClick={handleSaveToHistory}>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
              <Button variant="outline" onClick={() => setLocation('/settings')}>
                <SettingsIcon className="h-4 w-4 mr-2" /> Configurações
              </Button>
              <Button variant="outline" onClick={() => setLocation('/dashboard')}>
                <BarChart3 className="h-4 w-4 mr-2" /> Dashboard
              </Button>
              <Button variant="outline" onClick={() => {
                if (validateBeforeAction('visualizar preview')) setShowPdfPreview(true);
              }}>
                <Eye className="h-4 w-4 mr-2" /> Prévia / PDF
              </Button>
              <Button onClick={handleCopyPrescription}>
                <Copy className="h-4 w-4 mr-2" /> Copiar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUNA 1 */}
          <div className="space-y-6 lg:col-span-1">
            <PatientForm
              data={patientData}
              onChange={handlePatientChange}
              validationErrors={validationErrors}
            />

            <ProtocolSelector
              selectedProtocol={selectedProtocol}
              selectedCycle={selectedCycle}
              onProtocolChange={setSelectedProtocol}
              onCycleChange={setSelectedCycle}
            />
          </div>

          {/* COLUNA 2 - RESULTADOS */}
          <div className="space-y-6 lg:col-span-2">
            {calculatedValues && (
              <CalculatedValuesDisplay values={calculatedValues} />
            )}

            <DrugsTable drugs={calculatedDrugs} onDoseChange={handleDoseChange} />

            <ProphylaxisAlerts protocol={selectedProtocol} antiemetics={antiemetics} />

            <DilutionInfo drugs={calculatedDrugs} />

            <HydrationCalculator
              patientData={patientData}
              calculatedValues={calculatedValues}
              selectedProtocol={selectedProtocol}
              onDataChange={handleHydrationDataChange}
            />

            <ToxicityAssessment
              toxicities={toxicities}
              onToxicityChange={(tox, grade) =>
                setToxicities(prev => ({ ...prev, [tox]: grade }))
              }
            />

            {/* Predição de Toxicidade com IA */}
            <ToxicityPredictionWithMetrics
              patientData={patientData}
              protocol={selectedProtocol}
            />
          </div>

        </div>
      </main>

      {/* IMPRESSÃO — SOMENTE QUANDO NECESSÁRIO */}
      {showPrint && selectedProtocol && calculatedValues && antiemetics && (
        <Suspense fallback={<div className="print:hidden">Preparando impressão...</div>}>
          <PrintablePrescription
            patient={patientData}
            calculatedValues={calculatedValues}
            protocol={selectedProtocol}
            cycle={selectedCycle}
            drugs={calculatedDrugs}
            antiemetics={antiemetics}
            prescriptionId={prescriptionId}
            institutionName={institutionSettings?.institutionName ?? undefined}
            institutionLogo={institutionSettings?.institutionLogo ?? undefined}
            prescriberName={institutionSettings?.prescriberName ?? undefined}
            prescriberCRM={institutionSettings?.prescriberCRM ?? undefined}
            hydration={hydrationSupportData?.hydration}
            electrolytes={hydrationSupportData?.electrolytes}
            transfusion={hydrationSupportData?.transfusion}
          />
        </Suspense>
      )}

      {/* MODAL DE EMERGÊNCIA */}
      <EmergencyModal
        open={showEmergency}
        onOpenChange={setShowEmergency}
        patientData={emergencyPatientData}
      />

      {/* MODAL DE PREVIEW DO PDF */}
      {selectedProtocol && calculatedValues && antiemetics && (
        <PdfPreviewModal
          open={showPdfPreview}
          onOpenChange={setShowPdfPreview}
          patient={patientData}
          calculatedValues={calculatedValues}
          protocol={selectedProtocol}
          cycle={selectedCycle}
          drugs={calculatedDrugs}
          antiemetics={antiemetics}
          prescriptionId={prescriptionId}
          institutionName={institutionSettings?.institutionName ?? undefined}
          institutionLogo={institutionSettings?.institutionLogo ?? undefined}
          prescriberName={institutionSettings?.prescriberName ?? undefined}
          prescriberCRM={institutionSettings?.prescriberCRM ?? undefined}
          hydration={hydrationSupportData?.hydration}
          electrolytes={hydrationSupportData?.electrolytes}
          transfusion={hydrationSupportData?.transfusion}
          onConfirmPdf={async (sections) => {
            setShowPdfPreview(false);
            await handleExportPDF(sections);
          }}
          onConfirmPrint={(sections) => {
            setShowPdfPreview(false);
            handlePrint(sections);
          }}
        />
      )}
    </div>
  );
}
