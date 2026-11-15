import { useState, useEffect } from "react";
import type { PatientData, CalculatedValues } from "@/types/calculator";
import { calculateDerivedValues } from "@shared/clinicalDoseEngine";

interface UsePatientCalculationsReturn {
  calculatedValues: CalculatedValues | null;
  validationErrors: Set<keyof PatientData>;
}

/** Results are tagged with their clinical inputs: stale debounced values never escape. */
export function usePatientCalculations(
  patientData: PatientData,
  sessionKey: string | number = 0
): UsePatientCalculationsReturn {
  const { age, sex, weight, height, creatinine, ecog } = patientData;
  const inputKey = JSON.stringify([
    sessionKey,
    age,
    sex,
    weight,
    height,
    creatinine,
    ecog,
  ]);
  const [result, setResult] = useState<{
    key: string;
    values: CalculatedValues | null;
  } | null>(null);
  const validationErrors = new Set<keyof PatientData>();
  if (!Number.isFinite(weight) || weight <= 0) validationErrors.add("weight");
  if (!Number.isFinite(height) || height <= 0) validationErrors.add("height");
  if (!Number.isFinite(creatinine) || creatinine <= 0)
    validationErrors.add("creatinine");
  const valid = validationErrors.size === 0 && Number.isFinite(age) && age > 0;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      const values = calculateDerivedValues({
        age,
        sex,
        weight,
        height,
        creatinine,
        ecog,
      });
      if (!cancelled) setResult({ key: inputKey, values });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [inputKey, valid, age, sex, weight, height, creatinine, ecog]);

  return {
    calculatedValues: valid && result?.key === inputKey ? result.values : null,
    validationErrors,
  };
}
