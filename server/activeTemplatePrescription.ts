import { TRPCError } from "@trpc/server";
import type { CreatePrescriptionInput } from "./prescriptionSchema";
import { calculateBSA, calculateEGFR } from "../shared/clinicalDoseEngine";
import { resolveClinicalProtocol } from "../shared/clinicalProtocols/resolver";
import {
  applyTemplateManualAdjustments,
  type TemplateDoseOverride,
} from "../shared/clinicalProtocols/manualAdjustments";
import {
  USER_TEMPLATE_VERSION,
  isActiveTemplateDocument,
  getTemplateExecutionDocument,
  getTemplatePrescriptionIssues,
  mapResolvedTemplateDrugs,
} from "../shared/clinicalProtocols/templates";
import type {
  ClinicalProtocolDocument,
  ClinicalContext,
} from "../shared/clinicalProtocols/types";

const object = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const fail = (message: string): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message });
};
// No clinical rounding is implied: tolerate only a few relative floating-point ULPs, in any unit.
const numberMatches = (a: unknown, b: unknown): boolean =>
  typeof a === "number" &&
  typeof b === "number" &&
  Number.isFinite(a) &&
  Number.isFinite(b) &&
  a > 0 &&
  b > 0 &&
  (a === b ||
    Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= 4 * Number.EPSILON);
const dailyMatches = (actual: unknown, expected: number | null) =>
  expected === null ? actual === null : numberMatches(actual, expected);

export interface ValidatedTemplateManualDoseOverride {
  rowKey: string;
  drugName: string;
  originalDose: number;
  manualDose: number;
  reason: string;
}
export interface ValidatedActiveTemplatePrescription {
  document: ClinicalProtocolDocument;
  context: ClinicalContext;
  drugs: Array<
    ReturnType<typeof mapResolvedTemplateDrugs>[number] & {
      baseDose: number;
      manualDoseValue?: number;
    }
  >;
  manualDoseOverrides: ValidatedTemplateManualDoseOverride[];
}

/** Reexecutes the stored template. Client flags, audit and maxDose never authorize a dose. */
export function validateActiveTemplatePrescription(
  input: CreatePrescriptionInput,
  stored: unknown,
  userId: number
): ValidatedActiveTemplatePrescription | null {
  const id = input.prescriptionData.protocol.id;
  if (!id?.startsWith("template-")) return null;
  if (
    !object(stored) ||
    stored.userId !== userId ||
    stored.protocolId !== id ||
    stored.isActive !== 1
  )
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Template ativo não encontrado para este usuário.",
    });
  if (
    !object(stored.clinicalPackage) ||
    stored.clinicalPackage.version !== USER_TEMPLATE_VERSION ||
    !isActiveTemplateDocument(stored.clinicalDocument)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Registro não autoriza uso como template ativo; rascunhos antigos permanecem bloqueados.",
    });
  const selected = input.prescriptionData.protocol.templateContext;
  if (
    !selected ||
    selected.cycle !== input.cycle ||
    stored.name !== input.protocolName ||
    input.prescriptionData.protocol.name !== stored.name
  )
    fail("Contexto e identidade do template não conferem com a seleção.");
  const patient = input.prescriptionData.patient;
  const context: ClinicalContext = {
    ...selected,
    cycle: input.cycle,
    bsa: calculateBSA(patient.weight, patient.height),
    weight: patient.weight,
    egfr: calculateEGFR(patient.creatinine, patient.age, patient.sex),
  };
  const document = getTemplateExecutionDocument(
    stored.clinicalDocument as unknown as ClinicalProtocolDocument
  );
  const resolution = resolveClinicalProtocol(document, context);
  const issues = getTemplatePrescriptionIssues(document, context, resolution);
  if (issues.length)
    fail("Seleção de template não resolvida: " + issues.join("; "));
  const baseline = mapResolvedTemplateDrugs(resolution);
  const supplied = input.prescriptionData.drugs;
  if (!baseline.length || baseline.length !== supplied.length)
    fail("Lista de doses não corresponde à seleção completa do template.");
  const overrides: TemplateDoseOverride[] = [];
  const keys = new Set<string>();
  for (let i = 0; i < baseline.length; i++) {
    const expected = baseline[i],
      actual = supplied[i];
    const manual = !numberMatches(actual.finalDose, expected.calculatedDose);
    if (actual.rowKey !== undefined) {
      if (actual.rowKey !== expected.rowKey || keys.has(actual.rowKey))
        fail(
          "Identidade rowKey adulterada, órfã ou duplicada na lista de doses."
        );
      keys.add(actual.rowKey);
    } else if (manual)
      fail("Dose manual exige rowKey explícita e válida da etapa.");
    if (
      actual.name !== expected.name ||
      actual.route !== expected.route ||
      actual.days !== expected.days ||
      actual.doseUnit !== expected.doseUnit ||
      actual.resultUnit !== expected.resultUnit ||
      actual.timeOrigin !== expected.timeOrigin ||
      (actual.schedule !== undefined && actual.schedule !== expected.days)
    )
      fail(
        "Medicamento, unidade, via ou calendário diverge da seleção do template."
      );
    if (
      !numberMatches(actual.baseDose, expected.dose) ||
      !numberMatches(actual.calculatedDose, expected.calculatedDose)
    )
      fail(
        "Dose base ou calculada de template divergente; baseline é imutável."
      );
    if (
      actual.frequency !== expected.frequency ||
      !dailyMatches(actual.dailyDose, expected.dailyDose)
    )
      fail(
        "Frequência ou dose diária baseline divergente da seleção do template."
      );
    if (
      (actual.doseRepresents !== undefined || manual) &&
      actual.doseRepresents !== expected.doseRepresents
    )
      fail("Definição de dose divergente da etapa do template.");
    if (
      actual.manualDoseValue !== undefined &&
      !numberMatches(actual.manualDoseValue, actual.finalDose)
    )
      fail("Alias manualDoseValue contradiz a dose final explícita.");
    if (manual)
      overrides.push({
        rowKey: actual.rowKey!,
        finalDose: actual.finalDose as number,
        reason: actual.adjustmentReason as string,
      });
  }
  const adjusted = applyTemplateManualAdjustments(resolution, overrides);
  if (adjusted.issues.length)
    fail("Ajuste manual de dose inválido: " + adjusted.issues.join("; "));
  for (let i = 0; i < adjusted.drugs.length; i++) {
    const expected = adjusted.drugs[i],
      actual = supplied[i];
    // Baseline-only legacy payloads may omit the new field. A manual dose never may.
    if (
      (expected.isManualDose || actual.prescribedDailyDose !== undefined) &&
      !dailyMatches(actual.prescribedDailyDose, expected.prescribedDailyDose)
    )
      fail(
        "Dose diária prescrita divergente da derivação da baseline do template."
      );
  }
  const drugs = adjusted.drugs.map((drug, i) => ({
    ...drug,
    baseDose: drug.dose,
    ...(supplied[i].manualDoseValue !== undefined
      ? { manualDoseValue: drug.finalDose }
      : {}),
  }));
  const manualDoseOverrides: ValidatedTemplateManualDoseOverride[] = drugs
    .filter(drug => drug.isManualDose)
    .map(drug => ({
      rowKey: drug.rowKey,
      drugName: drug.name,
      originalDose: drug.calculatedDose,
      manualDose: drug.finalDose,
      reason: drug.adjustmentReason!,
    }));
  return { document, context, drugs, manualDoseOverrides };
}
