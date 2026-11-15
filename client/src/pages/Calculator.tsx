import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PatientForm from "@/components/PatientForm";
import CalculatedValuesDisplay from "@/components/CalculatedValues";
import ProtocolSelector from "@/components/ProtocolSelector";
import DrugsTable from "@/components/DrugsTable";
import ProphylaxisAlerts from "@/components/ProphylaxisAlerts";
import DilutionInfo from "@/components/DilutionInfo";
import ToxicityAssessment from "@/components/ToxicityAssessment";
import { ToxicityPredictionWithMetrics } from "@/components/ToxicityPrediction";
import PatientHistoryDB from "@/components/PatientHistoryDB";
import EmergencyModal, {
  type EmergencyPatientData,
} from "@/components/EmergencyModal";
import HydrationCalculator, {
  type HydrationSupportData,
} from "@/components/HydrationCalculator";
import PdfPreviewModal, {
  type PdfSections,
} from "@/components/PdfPreviewModal";
import ClinicalProtocolPanel from "@/components/ClinicalProtocolPanel";
import {
  getKnownClinicalDocument,
  getPrescriptionBlockReason,
  clinicalPackage,
} from "@shared/clinicalProtocols/library";
import {
  resolveClinicalProtocol,
  getClinicalPrescriptionBlock,
} from "@shared/clinicalProtocols/resolver";
import type {
  ClinicalProtocolDocument,
  ClinicalContext,
} from "@shared/clinicalProtocols/types";
import {
  isActiveTemplateDocument,
  getTemplateExecutionDocument,
  getTemplatePrescriptionIssues,
  mapResolvedTemplateDrugs,
} from "@shared/clinicalProtocols/templates";
import { useAuth } from "@/_core/hooks/useAuth";

// Lazy load PrintablePrescription para evitar travamento ao selecionar protocolo
const PrintablePrescription = lazy(
  () => import("@/components/PrintablePrescription")
);

import type { PatientData, Protocol, Drug } from "@/types/calculator";
import type { ToxicityGrade } from "@/data/ctcae";

import { generateAntiemeticProphylaxis } from "@/lib/antiemetics";
import { trpc } from "@/lib/trpc";

// Hooks especializados extraídos
import { usePatientCalculations } from "@/hooks/usePatientCalculations";
import { useProtocolDoseCalculation } from "@/hooks/useProtocolDoseCalculation";
import { usePrescriptionActions } from "@/hooks/usePrescriptionActions";
import { usePatientSession, emptyPatient } from "@/hooks/usePatientSession";
import {
  readPrescriptionHistory,
  preparePrescriptionReuse,
  type PrescriptionHistorySnapshot,
} from "@/hooks/prescriptionHistoryAdapter";
import { getClinicalCatalogue } from "@/lib/clinicalCatalogue";

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
} from "lucide-react";

export default function Calculator() {
  const [, setLocation] = useLocation();

  // ── Estado do Paciente ──────────────────────────────────────────────────
  const {
    patientData,
    patientId,
    sessionKey,
    editPatient: handlePatientChange,
    transitionPatient,
  } = usePatientSession();
  const [historySnapshot, setHistorySnapshot] =
    useState<PrescriptionHistorySnapshot | null>(null);
  const [historyWarning, setHistoryWarning] = useState("");

  // ── Cálculos do Paciente (BSA, eGFR, etc.) ─────────────────────────────
  const { calculatedValues, validationErrors } = usePatientCalculations(
    patientData,
    sessionKey
  );

  // ── Estado do Protocolo ─────────────────────────────────────────────────
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(
    null
  );
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [toxicities, setToxicities] = useState<Record<string, ToxicityGrade>>(
    {}
  );
  const [clinicalSelection, setClinicalSelection] = useState<ClinicalContext>({
    cycle: 1,
  });
  const clinicalDocument = useMemo(() => {
    const doc = getKnownClinicalDocument(selectedProtocol) as
      | ClinicalProtocolDocument
      | undefined;
    return doc && isActiveTemplateDocument(doc)
      ? getTemplateExecutionDocument(doc)
      : doc;
  }, [selectedProtocol]);
  const isUserTemplate = Boolean(
    selectedProtocol?.isUserTemplate &&
      isActiveTemplateDocument(clinicalDocument)
  );
  const prescriptionBlock = getPrescriptionBlockReason(selectedProtocol);
  const clinicalContext = useMemo<ClinicalContext>(
    () => ({
      ...clinicalSelection,
      cycle: selectedCycle,
      bsa: calculatedValues?.bsa,
      weight: patientData.weight || undefined,
      egfr: calculatedValues?.egfr,
    }),
    [
      clinicalSelection,
      selectedCycle,
      calculatedValues?.bsa,
      calculatedValues?.egfr,
      patientData.weight,
    ]
  );
  const clinicalResolution = useMemo(
    () =>
      clinicalDocument
        ? resolveClinicalProtocol(clinicalDocument, clinicalContext)
        : null,
    [clinicalDocument, clinicalContext]
  );
  const handleProtocolChange = useCallback((protocol: Protocol | null) => {
    setSelectedProtocol(protocol);
    setSelectedCycle(1);
    setClinicalSelection({ cycle: 1 });
  }, []);
  const [showEmergency, setShowEmergency] = useState(false);

  // ── Dados de Hidratação/Eletrólitos/Transfusão (para PDF) ────────────────
  const [hydrationSupportData, setHydrationSupportData] =
    useState<HydrationSupportData | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const handleHydrationDataChange = useCallback(
    (data: HydrationSupportData) => {
      setHydrationSupportData(data);
    },
    []
  );

  // ── Cálculo de Doses ────────────────────────────────────────────────────
  const { calculatedDrugs, handleDoseChange, setCalculatedDrugs } =
    useProtocolDoseCalculation({
      selectedProtocol: clinicalDocument ? null : selectedProtocol,
      calculatedValues,
      weight: patientData.weight,
      toxicities,
      patientAge: patientData.age,
      patientSex: patientData.sex,
      patientCreatinine: patientData.creatinine,
      sessionKey,
      calvertGfrAbsolute: patientData.calvertGfrAbsolute,
    });
  const templateIssues = useMemo(
    () =>
      isUserTemplate && clinicalDocument && clinicalResolution
        ? getTemplatePrescriptionIssues(
            clinicalDocument,
            clinicalContext,
            clinicalResolution
          )
        : [],
    [isUserTemplate, clinicalDocument, clinicalContext, clinicalResolution]
  );
  const prescriptionDrugs = useMemo(
    () =>
      isUserTemplate && clinicalResolution
        ? (mapResolvedTemplateDrugs(clinicalResolution) as Drug[])
        : calculatedDrugs,
    [isUserTemplate, clinicalResolution, calculatedDrugs]
  );
  const prescriptionProtocol = useMemo(
    () =>
      selectedProtocol && isUserTemplate
        ? {
            ...selectedProtocol,
            templateContext: {
              cycle: selectedCycle,
              phaseId: clinicalSelection.phaseId,
              day: clinicalSelection.day,
              gfrForCalvert: clinicalSelection.gfrForCalvert,
            },
          }
        : selectedProtocol
          ? {
              ...selectedProtocol,
              calvertGfrAbsolute: patientData.calvertGfrAbsolute,
            }
          : null,
    [
      selectedProtocol,
      isUserTemplate,
      selectedCycle,
      clinicalSelection,
      patientData.calvertGfrAbsolute,
    ]
  );
  const prescriptionValues = useMemo(
    () =>
      calculatedValues && isUserTemplate
        ? {
            ...calculatedValues,
            ecogAdjustmentFactor: 1,
            globalAdjustmentFactor: 1,
          }
        : calculatedValues,
    [calculatedValues, isUserTemplate]
  );
  const effectiveSupportDrugs = useMemo(
    () =>
      clinicalResolution
        ? clinicalResolution.rows
            .filter(row => row.status === "ready")
            .map(row => ({
              name: row.source.name,
              dose: row.dose ?? 0,
              doseUnit: row.doseUnit ?? row.source.doseUnit,
              administrationsPerDay:
                row.doseRepresents === "per_24_hours"
                  ? 1
                  : (row.frequency ?? undefined),
            }))
        : calculatedDrugs.map(drug => ({
            name: drug.name,
            dose: drug.dose,
            doseUnit: drug.doseUnit,
          })),
    [clinicalResolution, calculatedDrugs]
  );
  const supportSelectionResolved =
    !clinicalResolution ||
    (clinicalResolution.rows.length > 0 &&
      !clinicalResolution.rows.some(row => row.status === "blocked") &&
      clinicalResolution.issues.every(
        issue =>
          clinicalDocument &&
          getClinicalPrescriptionBlock(clinicalDocument).includes(issue)
      ));

  // ── Antieméticos ────────────────────────────────────────────────────────
  const antiemetics = useMemo(() => {
    if (!selectedProtocol || clinicalDocument) return null;
    return generateAntiemeticProphylaxis(selectedProtocol.emetogenicRisk);
  }, [selectedProtocol?.emetogenicRisk, clinicalDocument]);
  const outputAntiemetics = useMemo(
    () =>
      isUserTemplate
        ? {
            risk: selectedProtocol!.emetogenicRisk,
            day1: [],
            days2to4: [],
            rescue: [],
            alerts: [
              "Antiemese e demais ordens de suporte do template devem ser conferidas pelo prescritor; não foram preenchidas por esquema genérico.",
            ],
          }
        : antiemetics,
    [isUserTemplate, selectedProtocol, antiemetics]
  );

  // ── Configurações Institucionais ────────────────────────────────────────
  const { isAuthenticated } = useAuth();
  const { data: institutionSettings } = trpc.settings.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: storedProtocols } = trpc.customProtocols.listActive.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
      staleTime: 30_000,
    }
  );
  const currentCatalogue = useMemo(() => {
    const records = (storedProtocols ?? []) as unknown as Record<
      string,
      unknown
    >[];
    return ["templates", "custom", "reviewed", "legacy"].flatMap(kind =>
      getClinicalCatalogue(
        kind as "templates" | "custom" | "reviewed" | "legacy",
        records
      )
    );
  }, [storedProtocols]);

  // ── Ações de Prescrição (salvar, copiar, PDF, imprimir) ─────────────────
  const {
    prescriptionId,
    showPrint,
    printSections,
    handleSaveToHistory,
    handleCopyPrescription,
    handleExportPDF,
    handlePrint,
    setShowPrint,
    validateBeforeAction,
  } = usePrescriptionActions({
    patientData,
    calculatedValues: prescriptionValues,
    selectedProtocol: prescriptionProtocol,
    selectedCycle,
    calculatedDrugs: prescriptionDrugs,
    antiemetics: outputAntiemetics,
    toxicities,
    institutionSettings,
    hydrationSupportData,
    clinicalIssues: templateIssues,
    patientId,
    sessionKey,
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
  const handleLoadPatient = useCallback(
    (
      loadedPatient: PatientData,
      prescriptionData?: unknown,
      loadedId?: number,
      expectedEpoch?: number
    ) => {
      const snapshot =
        prescriptionData === undefined
          ? null
          : readPrescriptionHistory(prescriptionData);
      const reuse = snapshot
        ? preparePrescriptionReuse(loadedPatient, snapshot, currentCatalogue)
        : null;
      const epoch = transitionPatient(
        reuse?.patient ?? loadedPatient,
        loadedId,
        expectedEpoch
      );
      if (epoch === undefined) return undefined;
      setCalculatedDrugs([]);
      setSelectedCycle(reuse?.cycle ?? 1);
      setClinicalSelection(reuse?.context ?? { cycle: 1 });
      setToxicities({});
      setHydrationSupportData(null);
      setShowPdfPreview(false);
      setShowPrint(false);
      setShowEmergency(false);
      setHistorySnapshot(snapshot);
      setHistoryWarning(reuse?.warning ?? "");
      if (reuse) setSelectedProtocol(reuse.protocol);
      return epoch;
    },
    [setCalculatedDrugs, currentCatalogue, transitionPatient, setShowPrint]
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="border-b bg-card">
        <div className="container py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 xl:max-w-md xl:shrink-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                Calculadora de Prescrição Quimioterápica
              </h1>
              <p className="text-muted-foreground">
                Hematologia • Oncologia • Terapia Celular
              </p>
            </div>
            <div
              className="flex w-full gap-2 flex-wrap xl:flex-1 xl:justify-end"
              role="group"
              aria-label="Ações da calculadora"
            >
              <Button
                variant="destructive"
                onClick={() => setShowEmergency(true)}
                className="bg-red-600 hover:bg-red-700 font-bold"
              >
                <AlertCircle className="h-4 w-4 mr-2" /> EMERGÊNCIA
              </Button>
              <PatientHistoryDB
                onLoadPatient={handleLoadPatient}
                sessionKey={sessionKey}
              />
              <Button
                variant="outline"
                onClick={() => handleLoadPatient(emptyPatient())}
              >
                Novo paciente / limpar sessão
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveToHistory}
                disabled={Boolean(prescriptionBlock)}
                title={prescriptionBlock ?? undefined}
              >
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/settings")}
              >
                <SettingsIcon className="h-4 w-4 mr-2" /> Configurações
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/dashboard")}
              >
                <BarChart3 className="h-4 w-4 mr-2" /> Dashboard
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(prescriptionBlock)}
                title={prescriptionBlock ?? undefined}
                onClick={() => {
                  if (validateBeforeAction("visualizar preview"))
                    setShowPdfPreview(true);
                }}
              >
                <Eye className="h-4 w-4 mr-2" /> Prévia / PDF
              </Button>
              <Button
                onClick={handleCopyPrescription}
                disabled={Boolean(prescriptionBlock)}
                title={prescriptionBlock ?? undefined}
              >
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
              showCalvertGfr={
                !clinicalDocument &&
                Boolean(selectedProtocol?.drugs.some(d => d.doseUnit === "AUC"))
              }
            />
            <p className="text-xs text-muted-foreground">
              Nome e biometria editam a sessão atual. Para outra pessoa, use
              Novo paciente ou selecione no histórico.
            </p>

            <ProtocolSelector
              selectedProtocol={selectedProtocol}
              selectedCycle={selectedCycle}
              onProtocolChange={handleProtocolChange}
              onCycleChange={setSelectedCycle}
            />
          </div>

          {/* COLUNA 2 - RESULTADOS */}
          <div className="space-y-6 lg:col-span-2">
            {historyWarning && (
              <p
                role="status"
                className="rounded-md border border-amber-300 p-3 text-sm"
              >
                {historyWarning}
              </p>
            )}
            {historySnapshot && (
              <details className="rounded-md border p-3">
                <summary>Snapshot histórico — consulta, sem recálculo</summary>
                <p>
                  {historySnapshot.patient.name} —{" "}
                  {historySnapshot.protocol.name} — Ciclo{" "}
                  {historySnapshot.cycle}
                </p>
                <p>
                  Fase: {historySnapshot.context.phaseId ?? "não registrada"} |
                  Dia: {historySnapshot.context.day ?? "agenda completa"} | GFR
                  de Calvert histórico:{" "}
                  {historySnapshot.context.gfrForCalvert ?? "não registrado"}{" "}
                  (não carregado)
                </p>
                <ul>
                  {historySnapshot.drugs.map((d, i) => (
                    <li key={i}>
                      {d.name}: {d.finalDose ?? "não registrada"}{" "}
                      {d.resultUnit ?? "unidade não registrada"} {d.route} —{" "}
                      {d.days}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {calculatedValues && (
              <CalculatedValuesDisplay
                referenceOnly={Boolean(clinicalDocument)}
                values={
                  clinicalDocument
                    ? {
                        ...calculatedValues,
                        ecogAdjustmentFactor: 1,
                        globalAdjustmentFactor: 1,
                        renalStatusLabel:
                          "Estimativa indexada de função renal; não determina ajuste automático ou elegibilidade.",
                      }
                    : calculatedValues
                }
              />
            )}

            {clinicalDocument && clinicalResolution ? (
              <ClinicalProtocolPanel
                document={clinicalDocument}
                resolution={clinicalResolution}
                context={clinicalContext}
                onContextChange={next => {
                  setClinicalSelection(next);
                  setSelectedCycle(next.cycle);
                }}
                packageData={
                  selectedProtocol?.clinicalPackage ??
                  (clinicalPackage as unknown as Record<string, unknown>)
                }
              />
            ) : (
              <>
                <DrugsTable
                  drugs={calculatedDrugs}
                  onDoseChange={handleDoseChange}
                />
                <ProphylaxisAlerts
                  protocol={selectedProtocol}
                  antiemetics={antiemetics}
                />
                <DilutionInfo drugs={calculatedDrugs} />
              </>
            )}

            <HydrationCalculator
              key={`hydration-${sessionKey}`}
              sessionKey={sessionKey}
              patientData={patientData}
              calculatedValues={calculatedValues}
              selectedProtocol={selectedProtocol}
              effectiveDrugs={effectiveSupportDrugs}
              selectionResolved={supportSelectionResolved}
              proposalOnly={Boolean(prescriptionBlock)}
              onDataChange={handleHydrationDataChange}
            />

            <ToxicityAssessment
              key={`toxicity-${sessionKey}`}
              toxicities={toxicities}
              onToxicityChange={(tox, grade) =>
                setToxicities(prev => ({ ...prev, [tox]: grade }))
              }
            />

            {/* Predição de Toxicidade com IA */}
            {!clinicalDocument && (
              <ToxicityPredictionWithMetrics
                patientData={patientData}
                protocol={selectedProtocol}
              />
            )}
          </div>
        </div>
      </main>

      {/* IMPRESSÃO — SOMENTE QUANDO NECESSÁRIO */}
      {showPrint &&
        !prescriptionBlock &&
        selectedProtocol &&
        calculatedValues &&
        outputAntiemetics && (
          <Suspense
            fallback={
              <div className="print:hidden">Preparando impressão...</div>
            }
          >
            <PrintablePrescription
              patient={patientData}
              calculatedValues={prescriptionValues!}
              protocol={prescriptionProtocol!}
              cycle={selectedCycle}
              drugs={prescriptionDrugs}
              antiemetics={outputAntiemetics}
              sections={printSections}
              prescriptionId={prescriptionId}
              institutionName={
                institutionSettings?.institutionName ?? undefined
              }
              institutionLogo={
                institutionSettings?.institutionLogo ?? undefined
              }
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
      {!prescriptionBlock &&
        selectedProtocol &&
        calculatedValues &&
        outputAntiemetics && (
          <PdfPreviewModal
            open={showPdfPreview}
            onOpenChange={setShowPdfPreview}
            patient={patientData}
            calculatedValues={prescriptionValues!}
            protocol={prescriptionProtocol!}
            cycle={selectedCycle}
            drugs={prescriptionDrugs}
            antiemetics={outputAntiemetics}
            prescriptionId={prescriptionId}
            institutionName={institutionSettings?.institutionName ?? undefined}
            institutionLogo={institutionSettings?.institutionLogo ?? undefined}
            prescriberName={institutionSettings?.prescriberName ?? undefined}
            prescriberCRM={institutionSettings?.prescriberCRM ?? undefined}
            hydration={hydrationSupportData?.hydration}
            electrolytes={hydrationSupportData?.electrolytes}
            transfusion={hydrationSupportData?.transfusion}
            onConfirmPdf={async sections => {
              setShowPdfPreview(false);
              await handleExportPDF(sections);
            }}
            onConfirmPrint={sections => {
              setShowPdfPreview(false);
              handlePrint(sections);
            }}
          />
        )}
    </div>
  );
}
