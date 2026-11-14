import { TRPCError } from "@trpc/server";
import type { CreatePrescriptionInput } from "./prescriptionSchema";
import { calculateBSA, calculateEGFR } from "../shared/clinicalDoseEngine";
import { resolveClinicalProtocol } from "../shared/clinicalProtocols/resolver";
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
const numberMatches = (a: unknown, b: unknown): boolean =>
  typeof a === "number" &&
  typeof b === "number" &&
  Number.isFinite(a) &&
  Number.isFinite(b) &&
  Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.0001);
export function validateActiveTemplatePrescription(
  input: CreatePrescriptionInput,
  stored: unknown,
  userId: number
): {
  document: ClinicalProtocolDocument;
  context: ClinicalContext;
  drugs: ReturnType<typeof mapResolvedTemplateDrugs>;
} | null {
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
  const drugs = mapResolvedTemplateDrugs(resolution);
  const supplied = input.prescriptionData.drugs;
  if (!drugs.length || drugs.length !== supplied.length)
    fail("Lista de doses não corresponde à seleção completa do template.");
  for (let i = 0; i < drugs.length; i++) {
    const expected = drugs[i],
      actual = supplied[i];
    if (
      actual.name !== expected.name ||
      actual.route !== expected.route ||
      actual.days !== expected.days ||
      actual.doseUnit !== expected.doseUnit ||
      actual.resultUnit !== expected.resultUnit ||
      actual.timeOrigin !== expected.timeOrigin
    )
      fail(
        "Medicamento, unidade, via ou calendário diverge da seleção do template."
      );
    if (
      actual.isManualDose ||
      !numberMatches(actual.baseDose, expected.dose) ||
      !numberMatches(actual.calculatedDose, expected.calculatedDose) ||
      !numberMatches(actual.finalDose, expected.calculatedDose)
    )
      fail(
        "Dose de template divergente; revise o template completo em vez de enviar dose presumida."
      );
    if (
      actual.frequency !== expected.frequency ||
      (expected.dailyDose === null
        ? actual.dailyDose !== null
        : !numberMatches(actual.dailyDose, expected.dailyDose))
    )
      fail("Frequência ou dose diária divergente da seleção do template.");
    if (
      actual.doseRepresents !== undefined &&
      actual.doseRepresents !== expected.doseRepresents
    )
      fail("Definição de dose divergente da etapa do template.");
  }
  return { document, context, drugs };
}
