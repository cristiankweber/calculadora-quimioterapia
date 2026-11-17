import type { PatientData, Protocol } from "@/types/calculator";
import type { ClinicalContext } from "@shared/clinicalProtocols/types";

const record = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const nullableFinite = (value: unknown): number | null | undefined =>
  value === null ? null : finite(value);

/** Read-only clinical snapshot. This is deliberately NOT an executable Protocol. */
export interface PrescriptionHistorySnapshot {
  original: unknown;
  patient: Partial<PatientData>;
  protocol: { id?: string; name?: string; totalCycles?: number };
  cycle: number;
  context: ClinicalContext;
  calculatedValues: { bsa?: number; egfr?: number } | null;
  drugs: Array<{
    name: string;
    baseDose?: number;
    finalDose?: number;
    calculatedDose?: number;
    rowKey?: string;
    adjustmentReason?: string;
    isManualDose?: boolean;
    doseUnit?: string;
    resultUnit?: string;
    route?: string;
    days?: string;
    frequency?: number | null;
    dailyDose?: number | null;
    prescribedDailyDose?: number | null;
    timeOrigin?: string;
    doseRepresents?: string;
    notes?: string;
  }>;
  toxicities: Record<string, number | string>;
  cumulativeDose?: number;
}

/** Normalize old v1 and current v2 at every history consumer, without recalculation. */
export function readPrescriptionHistory(
  input: unknown
): PrescriptionHistorySnapshot {
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      parsed = null;
    }
  }
  const data = record(parsed);
  const protocol = record(data.protocol);
  const rawPatient = record(data.patient ?? data.patientData);
  const patient: Partial<PatientData> = {};
  if (typeof rawPatient.name === "string") patient.name = rawPatient.name;
  if (rawPatient.sex === "M" || rawPatient.sex === "F")
    patient.sex = rawPatient.sex;
  for (const key of [
    "age",
    "weight",
    "height",
    "creatinine",
    "bilirubin",
    "ecog",
  ] as const) {
    const value = finite(rawPatient[key]);
    if (value !== undefined) Object.assign(patient, { [key]: value });
  }
  if (typeof rawPatient.comorbidities === "string")
    patient.comorbidities = rawPatient.comorbidities;
  const rawContext = record(protocol.templateContext ?? data.templateContext);
  const rawCycle = finite(protocol.cycle ?? data.cycle ?? rawContext.cycle);
  const cycle =
    rawCycle !== undefined && Number.isInteger(rawCycle) && rawCycle >= 1
      ? rawCycle
      : 1;
  const context: ClinicalContext = { cycle };
  if (typeof rawContext.phaseId === "string")
    context.phaseId = rawContext.phaseId;
  const day = finite(rawContext.day);
  if (day !== undefined && Number.isInteger(day)) context.day = day;
  const gfr = finite(rawContext.gfrForCalvert);
  if (gfr !== undefined) context.gfrForCalvert = gfr;
  const values = record(data.calculatedValues);
  const rawDrugs = data.drugs ?? data.calculatedDrugs;
  const drugs = Array.isArray(rawDrugs)
    ? rawDrugs.map(value => {
        const d = record(value);
        return {
          name:
            typeof d.name === "string"
              ? d.name
              : "Medicamento não identificado",
          baseDose: finite(d.baseDose ?? d.dose),
          finalDose: finite(d.finalDose ?? d.calculatedDose),
          calculatedDose: finite(d.calculatedDose),
          rowKey: typeof d.rowKey === "string" ? d.rowKey : undefined,
          adjustmentReason:
            typeof d.adjustmentReason === "string"
              ? d.adjustmentReason
              : undefined,
          isManualDose:
            typeof d.isManualDose === "boolean" ? d.isManualDose : undefined,
          doseUnit: typeof d.doseUnit === "string" ? d.doseUnit : undefined,
          // Legacy absolute unit may be stored as unit; never label a normalized base as absolute.
          resultUnit:
            typeof (d.resultUnit ?? d.unit) === "string"
              ? (d.resultUnit ?? d.unit)
              : undefined,
          route: typeof d.route === "string" ? d.route : undefined,
          days:
            typeof d.days === "string"
              ? d.days
              : Array.isArray(d.days) &&
                  d.days.every(day => finite(day) !== undefined)
                ? d.days.join(", ")
                : typeof d.schedule === "string"
                  ? d.schedule
                  : undefined,
          frequency: nullableFinite(d.frequency),
          dailyDose: nullableFinite(d.dailyDose),
          prescribedDailyDose: nullableFinite(d.prescribedDailyDose),
          timeOrigin:
            typeof d.timeOrigin === "string" ? d.timeOrigin : undefined,
          doseRepresents:
            typeof d.doseRepresents === "string" ? d.doseRepresents : undefined,
          notes:
            typeof (d.notes ?? d.observations ?? d.adjustmentReason) ===
            "string"
              ? (d.notes ?? d.observations ?? d.adjustmentReason)
              : undefined,
        };
      })
    : [];
  const toxicities: PrescriptionHistorySnapshot["toxicities"] = {};
  for (const [key, value] of Object.entries(record(data.toxicities))) {
    if (typeof value === "string" || finite(value) !== undefined)
      toxicities[key] = value as number | string;
  }
  for (const adjustment of Array.isArray(data.audit?.toxicityAdjustments)
    ? data.audit.toxicityAdjustments
    : []) {
    if (
      typeof adjustment.toxicityType === "string" &&
      finite(adjustment.grade) !== undefined
    )
      toxicities[adjustment.toxicityType] = adjustment.grade;
  }
  return {
    original: input,
    patient,
    protocol: {
      id: typeof protocol.id === "string" ? protocol.id : undefined,
      name: typeof protocol.name === "string" ? protocol.name : undefined,
      totalCycles: finite(protocol.totalCycles ?? protocol.cycles),
    },
    cycle,
    context,
    calculatedValues: Object.keys(values).length
      ? { bsa: finite(values.bsa), egfr: finite(values.egfr) }
      : null,
    drugs,
    toxicities,
    cumulativeDose: finite(data.cumulativeDose),
  };
}

export function clearPatientCalvertGfr(patient: PatientData): PatientData {
  const { calvertGfrAbsolute: _oldGfr, ...clean } = patient as PatientData & {
    calvertGfrAbsolute?: number;
  };
  return clean;
}

/** New prescription uses the CURRENT full registry; historical doses/GFR are never executed. */
export function preparePrescriptionReuse(
  patient: PatientData,
  snapshot: PrescriptionHistorySnapshot,
  catalogue: readonly Protocol[]
) {
  const identityDiffers =
    (snapshot.patient.name !== undefined &&
      snapshot.patient.name !== patient.name) ||
    (snapshot.patient.sex !== undefined &&
      snapshot.patient.sex !== patient.sex);
  if (identityDiffers)
    return {
      patient: clearPatientCalvertGfr(patient),
      protocol: null,
      context: { cycle: 1 } as ClinicalContext,
      cycle: 1,
      warning:
        "Identidade do snapshot histórico diverge do paciente selecionado. Registro preservado somente para consulta; não foi reutilizado para uma nova prescrição.",
    };
  const found = catalogue.find(
    p => p.id === snapshot.protocol.id && Array.isArray(p.drugs)
  );
  const context: ClinicalContext = { cycle: snapshot.cycle };
  if (snapshot.context.phaseId !== undefined)
    context.phaseId = snapshot.context.phaseId;
  if (snapshot.context.day !== undefined) context.day = snapshot.context.day;
  let protocol: Protocol | null = null;
  if (found) {
    const {
      calvertGfrAbsolute: _gfr,
      templateContext: _context,
      ...current
    } = found as Protocol & { calvertGfrAbsolute?: number };
    protocol = current;
  }
  return {
    patient: clearPatientCalvertGfr({
      ...patient,
      ...snapshot.patient,
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
    }),
    protocol,
    context,
    cycle: snapshot.cycle,
    warning: protocol
      ? "Nova prescrição: cadastro atual recuperado por ID. Confira a versão, fase/ciclo/dia e as doses; o GFR de Calvert e os ajustes históricos não foram reutilizados."
      : "Protocolo do histórico não encontrado no cadastro atual. Snapshot preservado para consulta; selecione um protocolo íntegro para nova prescrição.",
  };
}
