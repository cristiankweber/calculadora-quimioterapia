import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import type { Protocol, Drug, CalculatedValues } from "@/types/calculator";
import type { ToxicityGrade } from "@/data/ctcae";
import { getDoseAdjustmentFactor } from "@/data/ctcae";
import {
  calculateDrugDoseLegacy,
  getDoseResultUnit,
} from "@shared/clinicalDoseEngine";
import { applyFluCyTBIRules, FLUCYTBI_PROTOCOL_ID } from "@/lib/flucytbiRules";
import { formatDoseQuantity } from "@/lib/pdfGenerator";

interface UseProtocolDoseCalculationInput {
  selectedProtocol: Protocol | null;
  calculatedValues: CalculatedValues | null;
  weight: number;
  toxicities: Record<string, ToxicityGrade>;
  patientAge?: number;
  patientSex?: "M" | "F";
  patientCreatinine?: number;
  /** Explicit patient transition epoch, not a biometric or name. */
  sessionKey?: string | number;
  calvertGfrAbsolute?: number;
}

export function useProtocolDoseCalculation({
  selectedProtocol,
  calculatedValues,
  weight,
  toxicities,
  patientAge,
  patientSex,
  patientCreatinine,
  sessionKey = 0,
  calvertGfrAbsolute,
}: UseProtocolDoseCalculationInput) {
  // Include actual drug content: same-ID revisions cannot inherit index-based overrides.
  const scope = JSON.stringify([
    sessionKey,
    selectedProtocol?.id,
    selectedProtocol?.drugs,
  ]);
  const [overrides, setOverrides] = useState<{
    scope: string;
    doses: Map<number, number>;
  }>(() => ({ scope, doses: new Map() }));
  const manualOverrides =
    overrides.scope === scope ? overrides.doses : undefined;
  const toxicityFactor = useMemo(
    () => getDoseAdjustmentFactor(toxicities),
    [toxicities]
  );
  const gfrValid =
    typeof calvertGfrAbsolute === "number" &&
    Number.isFinite(calvertGfrAbsolute) &&
    calvertGfrAbsolute > 0;

  const calculatedDrugs = useMemo(() => {
    if (
      !selectedProtocol ||
      !calculatedValues ||
      !Array.isArray(selectedProtocol.drugs)
    )
      return [];
    const baseDrugs = selectedProtocol.drugs.map((drug, index) => {
      // Even a manual override cannot bypass the explicit renal-input gate.
      if (drug.doseUnit === "AUC" && !gfrValid)
        return {
          ...drug,
          calculatedDose: undefined,
          resultUnit: getDoseResultUnit(drug.doseUnit),
        };
      const manualDose = manualOverrides?.get(index);
      if (manualDose !== undefined)
        return {
          ...drug,
          calculatedDose: manualDose,
          resultUnit: getDoseResultUnit(drug.doseUnit),
        };
      const baseDose = calculateDrugDoseLegacy(
        drug.dose,
        drug.doseUnit,
        calculatedValues.bsa,
        weight,
        calculatedValues.globalAdjustmentFactor,
        drug.maxDose,
        calvertGfrAbsolute
      );
      const adjusted = baseDose * toxicityFactor;
      const rounded = Math.round(adjusted * 10) / 10;
      return {
        ...drug,
        calculatedDose: adjusted > 0 && rounded === 0 ? adjusted : rounded,
        resultUnit: getDoseResultUnit(drug.doseUnit),
      };
    });
    return selectedProtocol.id === FLUCYTBI_PROTOCOL_ID
      ? applyFluCyTBIRules(
          baseDrugs,
          calculatedValues,
          weight,
          patientAge,
          patientSex,
          patientCreatinine
        )
      : baseDrugs;
  }, [
    selectedProtocol,
    calculatedValues,
    weight,
    toxicityFactor,
    manualOverrides,
    patientAge,
    patientSex,
    patientCreatinine,
    calvertGfrAbsolute,
    gfrValid,
  ]);

  const handleDoseChange = useCallback(
    (index: number, newDose: number) => {
      const drug = selectedProtocol?.drugs[index];
      if (
        !drug ||
        !Number.isFinite(newDose) ||
        newDose < 0 ||
        (drug.doseUnit === "AUC" && !gfrValid)
      )
        return;
      setOverrides(prev => {
        const doses = new Map(prev.scope === scope ? prev.doses : []);
        doses.set(index, newDose);
        return { scope, doses };
      });
      toast.success(
        `Dose ajustada manualmente: ${formatDoseQuantity(newDose)} ${getDoseResultUnit(drug.doseUnit)}`
      );
    },
    [selectedProtocol, scope, gfrValid]
  );

  const resetDoseOverrides = useCallback(
    () => setOverrides({ scope, doses: new Map() }),
    [scope]
  );
  // Compatibility: history snapshots are never injected as executable doses.
  const setCalculatedDrugs = useCallback(
    (_action: React.SetStateAction<Drug[]>) => resetDoseOverrides(),
    [resetDoseOverrides]
  );
  return {
    calculatedDrugs,
    toxicityFactor,
    handleDoseChange,
    resetDoseOverrides,
    setCalculatedDrugs,
  };
}
