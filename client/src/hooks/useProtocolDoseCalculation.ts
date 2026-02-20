/**
 * Hook que encapsula o cálculo de doses de drogas para um protocolo selecionado.
 *
 * Responsabilidades:
 * - Calcular doses ajustadas para cada droga do protocolo
 * - Aplicar fator de toxicidade
 * - Permitir ajuste manual de dose
 * - Recalcular apenas quando inputs relevantes mudam
 */

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { Protocol, Drug, CalculatedValues } from '@/types/calculator';
import type { ToxicityGrade } from '@/data/ctcae';
import { getDoseAdjustmentFactor } from '@/data/ctcae';
import { calculateDrugDoseLegacy } from '@shared/clinicalDoseEngine';
import { applyFluCyTBIRules, FLUCYTBI_PROTOCOL_ID } from '@/lib/flucytbiRules';

interface UseProtocolDoseCalculationInput {
  selectedProtocol: Protocol | null;
  calculatedValues: CalculatedValues | null;
  weight: number;
  toxicities: Record<string, ToxicityGrade>;
  patientAge?: number;
  patientSex?: 'M' | 'F';
  patientCreatinine?: number;
}

interface UseProtocolDoseCalculationReturn {
  calculatedDrugs: Drug[];
  toxicityFactor: number;
  handleDoseChange: (index: number, newDose: number) => void;
  setCalculatedDrugs: React.Dispatch<React.SetStateAction<Drug[]>>;
}

export function useProtocolDoseCalculation({
  selectedProtocol,
  calculatedValues,
  weight,
  toxicities,
  patientAge,
  patientSex,
  patientCreatinine,
}: UseProtocolDoseCalculationInput): UseProtocolDoseCalculationReturn {
  const [manualOverrides, setManualOverrides] = useState<Map<number, number>>(new Map());

  const toxicityFactor = useMemo(
    () => getDoseAdjustmentFactor(toxicities),
    [toxicities]
  );

  const calculatedDrugs = useMemo(() => {
    if (!selectedProtocol || !calculatedValues) return [];

    const baseDrugs = selectedProtocol.drugs.map((drug, index) => {
      // Verificar se há override manual
      const manualDose = manualOverrides.get(index);
      if (manualDose !== undefined) {
        return { ...drug, calculatedDose: manualDose };
      }

      const baseDose = calculateDrugDoseLegacy(
        drug.dose,
        drug.doseUnit,
        calculatedValues.bsa,
        weight,
        calculatedValues.globalAdjustmentFactor,
        drug.maxDose,
        calculatedValues.egfr
      );

      return {
        ...drug,
        calculatedDose: Math.round(baseDose * toxicityFactor * 10) / 10,
      };
    });

    // Pós-processamento específico do protocolo FluCyTBI
    if (selectedProtocol.id === FLUCYTBI_PROTOCOL_ID) {
      return applyFluCyTBIRules(
        baseDrugs,
        calculatedValues,
        weight,
        patientAge,
        patientSex,
        patientCreatinine,
      );
    }

    return baseDrugs;
  }, [
    selectedProtocol?.id,
    calculatedValues?.bsa,
    calculatedValues?.egfr,
    calculatedValues?.globalAdjustmentFactor,
    weight,
    toxicityFactor,
    manualOverrides,
    patientAge,
    patientSex,
    patientCreatinine,
  ]);

  const handleDoseChange = useCallback((index: number, newDose: number) => {
    setManualOverrides(prev => {
      const next = new Map(prev);
      next.set(index, newDose);
      return next;
    });
    toast.success(`Dose ajustada manualmente: ${newDose.toFixed(1)} mg`);
  }, []);

  // Limpar overrides quando protocolo muda
  useMemo(() => {
    setManualOverrides(new Map());
  }, [selectedProtocol?.id]);

  // setCalculatedDrugs para compatibilidade com PatientHistoryDB
  const setCalculatedDrugs = useCallback((action: React.SetStateAction<Drug[]>) => {
    // Quando carregando do histórico, limpar overrides e deixar o useMemo recalcular
    setManualOverrides(new Map());
  }, []);

  return {
    calculatedDrugs,
    toxicityFactor,
    handleDoseChange,
    setCalculatedDrugs,
  };
}
