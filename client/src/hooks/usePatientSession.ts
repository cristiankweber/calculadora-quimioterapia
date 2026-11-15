import { useCallback, useRef, useState } from "react";
import type { PatientData } from "@/types/calculator";
import { clearPatientCalvertGfr } from "./prescriptionHistoryAdapter";

export const emptyPatient = (): PatientData => ({
  name: "",
  age: 0,
  sex: "M",
  weight: 0,
  height: 0,
  creatinine: 0,
  bilirubin: 0,
  ecog: 0,
  comorbidities: "",
});

/** Only an explicit selection/new-patient action changes identity. Name/biometrics are edits. */
export function usePatientSession() {
  const [session, setSession] = useState(() => ({
    patient: emptyPatient(),
    patientId: undefined as number | undefined,
    epoch: 0,
  }));
  const current = useRef(session);
  const editPatient = useCallback((patient: PatientData) => {
    const next = { ...current.current, patient };
    current.current = next;
    setSession(next);
  }, []);
  const transitionPatient = useCallback(
    (patient: PatientData, patientId?: number, expectedEpoch?: number) => {
      if (
        expectedEpoch !== undefined &&
        current.current.epoch !== expectedEpoch
      )
        return undefined;
      const next = {
        patient: clearPatientCalvertGfr(patient),
        patientId,
        epoch: current.current.epoch + 1,
      };
      current.current = next;
      setSession(next);
      return next.epoch;
    },
    []
  );
  const isCurrentSession = useCallback(
    (epoch: number) => current.current.epoch === epoch,
    []
  );
  return {
    patientData: session.patient,
    patientId: session.patientId,
    sessionKey: session.epoch,
    editPatient,
    transitionPatient,
    isCurrentSession,
  };
}
