/**
 * Hook que encapsula todas as ações de prescrição (salvar, copiar, PDF, imprimir).
 *
 * Responsabilidades:
 * - Salvar prescrição no banco de dados (formato v2 com auditoria)
 * - Copiar prescrição para clipboard
 * - Exportar PDF
 * - Imprimir
 * - Validação antes de cada ação
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type {
  PatientData,
  Protocol,
  Drug,
  CalculatedValues,
  AntiemeticProphylaxis,
} from "@/types/calculator";
import type { ToxicityGrade } from "@/data/ctcae";
import { getDoseAdjustmentFactor } from "@/data/ctcae";
import { generatePrescriptionPDF } from "@/lib/pdfGenerator";
import { trpc } from "@/lib/trpc";
import type { HydrationSupportData } from "@/components/HydrationCalculator";
import type { PdfSections } from "@/components/PdfPreviewModal";
import { getPrescriptionBlockReason } from "@shared/clinicalProtocols/library";

interface PrescriptionContext {
  patientData: PatientData;
  calculatedValues: CalculatedValues | null;
  selectedProtocol: Protocol | null;
  selectedCycle: number;
  calculatedDrugs: Drug[];
  antiemetics: AntiemeticProphylaxis | null;
  toxicities: Record<string, ToxicityGrade>;
  institutionSettings?: {
    institutionName?: string | null;
    institutionLogo?: string | null;
    prescriberName?: string | null;
    prescriberCRM?: string | null;
  } | null;
  hydrationSupportData?: HydrationSupportData | null;
}

interface UsePrescriptionActionsReturn {
  prescriptionId: string;
  showPrint: boolean;
  handleSaveToHistory: () => Promise<void>;
  handleCopyPrescription: () => void;
  handleExportPDF: (sections?: PdfSections) => Promise<void>;
  handlePrint: (sections?: PdfSections) => void;
  setShowPrint: (show: boolean) => void;
  validateBeforeAction: (actionName: string) => boolean;
}

/**
 * Mapeia os dados do frontend para o formato prescriptionData v2
 * com metadados de auditoria completos.
 */
function buildPrescriptionDataV2(ctx: PrescriptionContext) {
  const protocol = ctx.selectedProtocol!;
  const calculatedValues = ctx.calculatedValues!;
  const adjustmentFactor = getDoseAdjustmentFactor(ctx.toxicities);

  // Identificar doses manuais
  const manualDoseOverrides = ctx.calculatedDrugs
    .filter(
      d =>
        d.calculatedDose !== undefined &&
        d.dose !== undefined &&
        d.calculatedDose !== d.dose
    )
    .map(d => ({
      drugName: d.name,
      originalDose: d.dose,
      manualDose: d.calculatedDose ?? d.dose,
    }));

  // Mapear toxicidades para formato de auditoria
  // ToxicityGrade é um número simples (0-5)
  const toxicityAdjustments = Object.entries(ctx.toxicities)
    .filter(([, grade]) => grade > 0)
    .map(([key, grade]) => ({
      drugName: key,
      toxicityType: key,
      grade: grade as number,
    }));

  return {
    patient: {
      name: ctx.patientData.name,
      age: ctx.patientData.age,
      sex: ctx.patientData.sex,
      weight: ctx.patientData.weight,
      height: ctx.patientData.height,
      creatinine: ctx.patientData.creatinine,
      bilirubin: ctx.patientData.bilirubin,
      ecog: ctx.patientData.ecog,
      comorbidities: ctx.patientData.comorbidities || undefined,
    },
    protocol: {
      id: protocol.id,
      name: protocol.name,
      category: protocol.indication,
      indication: protocol.indication,
      emetogenicRisk: protocol.emetogenicRisk,
      cycle: ctx.selectedCycle,
      totalCycles: protocol.cycles,
    },
    calculatedValues: {
      bsa: calculatedValues.bsa,
      egfr: calculatedValues.egfr,
      renalStatus: calculatedValues.renalStatus,
      renalStatusLabel: calculatedValues.renalStatusLabel,
      ecogAdjustmentFactor: calculatedValues.ecogAdjustmentFactor,
      globalAdjustmentFactor: calculatedValues.globalAdjustmentFactor,
    },
    drugs: ctx.calculatedDrugs.map(d => ({
      name: d.name,
      baseDose: d.dose,
      doseUnit: d.doseUnit,
      calculatedDose: d.calculatedDose,
      finalDose: d.calculatedDose ?? d.dose,
      maxDose: d.maxDose,
      route: d.route,
      days: d.days,
      notes: d.observations,
      isManualDose: false,
    })),
    preMedications: ctx.antiemetics
      ? [
          ...ctx.antiemetics.day1.map(med => ({ name: med, schedule: "D1" })),
          ...ctx.antiemetics.days2to4.map(med => ({
            name: med,
            schedule: "D2-D4",
          })),
        ]
      : undefined,
    alerts: protocol.specialAlerts?.map(msg => ({
      type: "protocol",
      message: msg,
    })),
    audit: {
      version: 2 as const,
      formulaVersions: {
        bsa: "DuBois",
        egfr: "CKD-EPI-2021",
        dose: "standard",
      },
      generatedAt: Date.now(),
      globalAdjustmentFactor: adjustmentFactor,
      toxicityAdjustments:
        toxicityAdjustments.length > 0 ? toxicityAdjustments : undefined,
      manualDoseOverrides:
        manualDoseOverrides.length > 0 ? manualDoseOverrides : undefined,
      clinicalInputs: {
        weight: ctx.patientData.weight,
        height: ctx.patientData.height,
        creatinine: ctx.patientData.creatinine,
        age: ctx.patientData.age,
        sex: ctx.patientData.sex,
        ecog: ctx.patientData.ecog,
        bilirubin: ctx.patientData.bilirubin,
      },
    },
  };
}

export function usePrescriptionActions(
  ctx: PrescriptionContext
): UsePrescriptionActionsReturn {
  const [prescriptionId, setPrescriptionId] = useState("");
  const [showPrint, setShowPrint] = useState(false);

  const createPatientMutation = trpc.patients.create.useMutation();
  const savePrescriptionMutation = trpc.prescriptions.create.useMutation();

  const validateBeforeAction = useCallback(
    (actionName: string): boolean => {
      const blockReason = getPrescriptionBlockReason(ctx.selectedProtocol);
      if (blockReason) {
        toast.error(blockReason);
        return false;
      }
      if (!ctx.selectedProtocol || !ctx.calculatedValues) {
        toast.error(`Preencha todos os dados antes de ${actionName}`);
        return false;
      }
      return true;
    },
    [ctx.selectedProtocol, ctx.calculatedValues]
  );

  const warnIfNoInstitution = useCallback(() => {
    if (
      !ctx.institutionSettings?.institutionName ||
      !ctx.institutionSettings?.prescriberName
    ) {
      toast.warning(
        "Configure os dados institucionais em Configurações para personalizar a impressão"
      );
    }
  }, [
    ctx.institutionSettings?.institutionName,
    ctx.institutionSettings?.prescriberName,
  ]);

  const handleSaveToHistory = useCallback(async () => {
    if (!validateBeforeAction("salvar")) return;
    if (!ctx.patientData.name) {
      toast.error("Preencha o nome do paciente antes de salvar");
      return;
    }

    try {
      const patient = await createPatientMutation.mutateAsync({
        name: ctx.patientData.name,
        age: ctx.patientData.age,
        sex: ctx.patientData.sex,
        weight: ctx.patientData.weight,
        height: ctx.patientData.height,
        creatinine: ctx.patientData.creatinine,
        bilirubin: ctx.patientData.bilirubin,
        ecog: ctx.patientData.ecog,
        comorbidities: ctx.patientData.comorbidities || undefined,
      });

      // Construir payload v2 com metadados de auditoria
      const prescriptionDataV2 = buildPrescriptionDataV2(ctx);

      const prescription = await savePrescriptionMutation.mutateAsync({
        patientId: patient.id,
        patientName: ctx.patientData.name,
        protocolName: ctx.selectedProtocol!.name,
        cycle: ctx.selectedCycle,
        bsa: ctx.calculatedValues!.bsa,
        egfr: ctx.calculatedValues!.egfr,
        renalStatus: ctx.calculatedValues!.renalStatus,
        prescriptionData: prescriptionDataV2,
      });

      setPrescriptionId(prescription.prescriptionId);
      toast.success(`Prescrição salva! ID: ${prescription.prescriptionId}`);
    } catch (err: unknown) {
      console.error(err);
      // Exibir mensagem de erro do backend se disponível
      const message = err instanceof Error ? err.message : "Erro ao salvar.";
      toast.error(
        message.includes("Doses inválidas")
          ? message
          : "Erro ao salvar prescrição."
      );
    }
  }, [
    ctx.patientData,
    ctx.calculatedValues,
    ctx.selectedProtocol,
    ctx.selectedCycle,
    ctx.calculatedDrugs,
    ctx.antiemetics,
    ctx.toxicities,
    createPatientMutation,
    savePrescriptionMutation,
    validateBeforeAction,
  ]);

  const handleCopyPrescription = useCallback(() => {
    if (!validateBeforeAction("copiar")) return;

    const {
      patientData,
      calculatedValues,
      selectedProtocol,
      selectedCycle,
      calculatedDrugs,
    } = ctx;

    let text = `PRESCRIÇÃO DE QUIMIOTERAPIA\n\n`;
    text += `Paciente: ${patientData.name}\n`;
    text += `Idade: ${patientData.age} anos | Sexo: ${patientData.sex}\n`;
    text += `Peso: ${patientData.weight} kg | Altura: ${patientData.height} cm\n`;
    text += `SC: ${calculatedValues!.bsa.toFixed(2)} m² | eGFR: ${calculatedValues!.egfr.toFixed(1)}\n\n`;

    text += `PROTOCOLO: ${selectedProtocol!.name}\nCiclo: ${selectedCycle}/${selectedProtocol!.cycles}\n`;
    text += `Indicação: ${selectedProtocol!.indication}\n\n`;

    text += `DROGAS:\n`;
    calculatedDrugs.forEach(d => {
      text += `• ${d.name}: ${d.calculatedDose?.toFixed(1)} mg ${d.route} (Dias ${d.days})\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success("Prescrição copiada!");
  }, [ctx, validateBeforeAction]);

  const handleExportPDF = useCallback(
    async (sections?: PdfSections) => {
      if (!validateBeforeAction("exportar o PDF")) return;
      warnIfNoInstitution();

      try {
        await generatePrescriptionPDF({
          patient: ctx.patientData,
          calculatedValues: ctx.calculatedValues!,
          protocol: ctx.selectedProtocol!,
          cycle: ctx.selectedCycle,
          drugs: ctx.calculatedDrugs,
          antiemetics: ctx.antiemetics!,
          hydration: ctx.hydrationSupportData?.hydration ?? null,
          electrolytes: ctx.hydrationSupportData?.electrolytes ?? [],
          transfusion: ctx.hydrationSupportData?.transfusion ?? [],
          sections,
        });
        toast.success("PDF gerado com sucesso!");
      } catch (error) {
        console.error(error);
        toast.error("Erro ao gerar PDF.");
      }
    },
    [ctx, validateBeforeAction, warnIfNoInstitution]
  );

  const handlePrint = useCallback(
    (sections?: PdfSections) => {
      if (!validateBeforeAction("imprimir")) return;
      warnIfNoInstitution();
      setShowPrint(true);
      setTimeout(() => window.print(), 80);
    },
    [validateBeforeAction, warnIfNoInstitution]
  );

  return {
    prescriptionId,
    showPrint,
    handleSaveToHistory,
    handleCopyPrescription,
    handleExportPDF,
    handlePrint,
    setShowPrint,
    validateBeforeAction,
  };
}
