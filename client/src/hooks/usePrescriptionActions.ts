/**
 * Hook que encapsula todas as ações de prescrição (salvar, copiar, PDF, imprimir).
 *
 * Responsabilidades:
 * - Salvar prescrição no banco de dados
 * - Copiar prescrição para clipboard
 * - Exportar PDF
 * - Imprimir
 * - Validação antes de cada ação
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { PatientData, Protocol, Drug, CalculatedValues, AntiemeticProphylaxis } from '@/types/calculator';
import type { ToxicityGrade } from '@/data/ctcae';
import { getDoseAdjustmentFactor } from '@/data/ctcae';
import { generatePrescriptionPDF } from '@/lib/pdfGenerator';
import { trpc } from '@/lib/trpc';

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
}

interface UsePrescriptionActionsReturn {
  prescriptionId: string;
  showPrint: boolean;
  handleSaveToHistory: () => Promise<void>;
  handleCopyPrescription: () => void;
  handleExportPDF: () => Promise<void>;
  handlePrint: () => void;
  setShowPrint: (show: boolean) => void;
}

export function usePrescriptionActions(ctx: PrescriptionContext): UsePrescriptionActionsReturn {
  const [prescriptionId, setPrescriptionId] = useState('');
  const [showPrint, setShowPrint] = useState(false);

  const createPatientMutation = trpc.patients.create.useMutation();
  const savePrescriptionMutation = trpc.prescriptions.create.useMutation();

  const validateBeforeAction = useCallback((actionName: string): boolean => {
    if (!ctx.selectedProtocol || !ctx.calculatedValues) {
      toast.error(`Preencha todos os dados antes de ${actionName}`);
      return false;
    }
    return true;
  }, [ctx.selectedProtocol, ctx.calculatedValues]);

  const warnIfNoInstitution = useCallback(() => {
    if (!ctx.institutionSettings?.institutionName || !ctx.institutionSettings?.prescriberName) {
      toast.warning('Configure os dados institucionais em Configurações para personalizar a impressão');
    }
  }, [ctx.institutionSettings?.institutionName, ctx.institutionSettings?.prescriberName]);

  const handleSaveToHistory = useCallback(async () => {
    if (!validateBeforeAction('salvar')) return;
    if (!ctx.patientData.name) {
      toast.error('Preencha o nome do paciente antes de salvar');
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

      const prescription = await savePrescriptionMutation.mutateAsync({
        patientId: patient.id,
        patientName: ctx.patientData.name,
        protocolName: ctx.selectedProtocol!.name,
        cycle: ctx.selectedCycle,
        bsa: ctx.calculatedValues!.bsa,
        egfr: ctx.calculatedValues!.egfr,
        renalStatus: ctx.calculatedValues!.renalStatus,
        prescriptionData: {
          patientData: ctx.patientData,
          protocol: ctx.selectedProtocol,
          cycle: ctx.selectedCycle,
          calculatedValues: ctx.calculatedValues,
          calculatedDrugs: ctx.calculatedDrugs,
          antiemetics: ctx.antiemetics,
          toxicities: ctx.toxicities,
          adjustmentFactor: getDoseAdjustmentFactor(ctx.toxicities),
        },
      });

      setPrescriptionId(prescription.prescriptionId);
      toast.success(`Prescrição salva! ID: ${prescription.prescriptionId}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar.');
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
    if (!validateBeforeAction('copiar')) return;

    const { patientData, calculatedValues, selectedProtocol, selectedCycle, calculatedDrugs } = ctx;

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
    toast.success('Prescrição copiada!');
  }, [ctx, validateBeforeAction]);

  const handleExportPDF = useCallback(async () => {
    if (!validateBeforeAction('exportar o PDF')) return;
    warnIfNoInstitution();

    try {
      await generatePrescriptionPDF({
        patient: ctx.patientData,
        calculatedValues: ctx.calculatedValues!,
        protocol: ctx.selectedProtocol!,
        cycle: ctx.selectedCycle,
        drugs: ctx.calculatedDrugs,
        antiemetics: ctx.antiemetics!,
      });
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF.');
    }
  }, [ctx, validateBeforeAction, warnIfNoInstitution]);

  const handlePrint = useCallback(() => {
    if (!validateBeforeAction('imprimir')) return;
    warnIfNoInstitution();
    setShowPrint(true);
    setTimeout(() => window.print(), 80);
  }, [validateBeforeAction, warnIfNoInstitution]);

  return {
    prescriptionId,
    showPrint,
    handleSaveToHistory,
    handleCopyPrescription,
    handleExportPDF,
    handlePrint,
    setShowPrint,
  };
}
