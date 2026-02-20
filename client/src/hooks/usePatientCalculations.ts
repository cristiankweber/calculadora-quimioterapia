/**
 * Hook que encapsula o cálculo de valores derivados do paciente (BSA, eGFR, etc.).
 *
 * Responsabilidades:
 * - Calcular BSA, eGFR, classificação renal, fatores de ajuste
 * - Debounce de 300ms para evitar recálculos durante digitação
 * - Validação de campos obrigatórios
 * - Proteção contra NaN/Infinity
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { PatientData, CalculatedValues } from '@/types/calculator';
import { calculateDerivedValues } from '@shared/clinicalDoseEngine';

interface UsePatientCalculationsReturn {
  calculatedValues: CalculatedValues | null;
  validationErrors: Set<keyof PatientData>;
}

const DEBOUNCE_MS = 300;

export function usePatientCalculations(
  patientData: PatientData
): UsePatientCalculationsReturn {
  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<keyof PatientData>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extrair apenas campos relevantes para cálculo (evita recálculo ao mudar nome/comorbidades)
  const { age, sex, weight, height, creatinine, ecog } = patientData;

  useEffect(() => {
    // Validação de campos obrigatórios
    const errors = new Set<keyof PatientData>();
    if (!weight || weight <= 0) errors.add('weight');
    if (!height || height <= 0) errors.add('height');
    if (!creatinine || creatinine <= 0) errors.add('creatinine');

    if (errors.size > 0) {
      setValidationErrors(errors);
      setCalculatedValues(null);
      return;
    }

    setValidationErrors(new Set());

    // Debounce para evitar recálculos durante digitação rápida
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (age > 0 && weight > 0 && height > 0 && creatinine > 0) {
        const result = calculateDerivedValues({ age, sex, weight, height, creatinine, ecog });
        if (result) {
          setCalculatedValues(prev => {
            // Comparação rasa para evitar re-renders desnecessários
            if (
              prev &&
              prev.bsa === result.bsa &&
              prev.egfr === result.egfr &&
              prev.renalStatus === result.renalStatus &&
              prev.ecogAdjustmentFactor === result.ecogAdjustmentFactor &&
              prev.globalAdjustmentFactor === result.globalAdjustmentFactor
            ) {
              return prev;
            }
            return result;
          });
        } else {
          setCalculatedValues(null);
        }
      } else {
        setCalculatedValues(null);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [age, sex, weight, height, creatinine, ecog]);

  return { calculatedValues, validationErrors };
}
