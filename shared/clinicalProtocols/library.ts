import originalPackage from "../data/clinicalProtocols.json";
import { protocols as legacyProtocols } from "../../client/src/data/protocols";
import { isActiveTemplateDocument } from "./templates";

export const CLINICAL_SOURCE_SHA256 =
  "3eb9e462aac5359ac42016d25ef3280517a5784ce78604c6334f75a73201fbe8";
export const clinicalPackage = originalPackage;
export const clinicalDocuments = originalPackage.protocols as unknown as Record<
  string,
  unknown
>[];

export function normalizeProtocolIdentity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[★\s]+/, "")
    .replace(/\[(?:legado|rascunho|consulta)[^\]]*\]/gi, "")
    .trim()
    .toLowerCase();
}

const byIdentity = new Map<string, Record<string, unknown>>();
for (const document of clinicalDocuments) {
  for (const name of [document.name, document.originalName]) {
    if (typeof name === "string")
      byIdentity.set(normalizeProtocolIdentity(name), document);
  }
  if (typeof document.id === "string") {
    byIdentity.set(document.id, document);
    byIdentity.set(`clinical-${document.id}`, document);
  }
}
for (const legacy of legacyProtocols) {
  const document = byIdentity.get(normalizeProtocolIdentity(legacy.name));
  if (document) {
    byIdentity.set(legacy.id, document);
    byIdentity.set(`system-${legacy.id}`, document);
  }
}

export function isEnrichedClinicalDocument(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const doc = value as Record<string, unknown>;
  return (
    [
      "calculationPolicy",
      "review",
      "referenceOnly",
      "phaseLibrary",
      "cycleDefinition",
      "baselineTests",
      "monitoring",
    ].some(key => Object.hasOwn(doc, key)) ||
    (Array.isArray(doc.drugs) &&
      doc.drugs.some(
        drug =>
          drug &&
          typeof drug === "object" &&
          ["schedule", "administrationFrequency", "doseSelectionRequired"].some(
            key => Object.hasOwn(drug, key)
          )
      ))
  );
}

export function getKnownClinicalDocument(
  input:
    | { id?: string; name?: string; clinicalDocument?: unknown }
    | string
    | null
    | undefined
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  if (typeof input === "string")
    return (
      byIdentity.get(input) ?? byIdentity.get(normalizeProtocolIdentity(input))
    );
  if (isEnrichedClinicalDocument(input.clinicalDocument)) {
    return input.clinicalDocument as Record<string, unknown>;
  }
  return (
    (input.id ? byIdentity.get(input.id) : undefined) ??
    (input.name
      ? byIdentity.get(normalizeProtocolIdentity(input.name))
      : undefined)
  );
}

/** Presence of a clinical document never implies homologation. No client flag unlocks prescribing. */
export function getPrescriptionBlockReason(
  input:
    | { id?: string; name?: string; clinicalDocument?: unknown }
    | string
    | null
    | undefined
): string | null {
  if (
    typeof input === "object" &&
    input?.id?.startsWith("template-") &&
    isActiveTemplateDocument(input.clinicalDocument)
  )
    return null;
  const document = getKnownClinicalDocument(input);
  if (document)
    return "Rascunho clínico: disponível somente para consulta e simulação. Prescrição bloqueada até homologação médica e farmacêutica em fluxo institucional próprio.";
  if (
    typeof input === "object" &&
    input?.id &&
    /^(clinical-|imported-clinical-|reviewed-)/.test(input.id)
  ) {
    return "Documento clínico versionado não reconhecido: prescrição bloqueada; confira a origem e a política de revisão.";
  }
  return null;
}

/** Selectors use 52 reviewed documents by default; legacy records remain stored, not deleted. */
export function isReviewedLegacy(input: {
  id?: string;
  name?: string;
  clinicalDocument?: unknown;
}): boolean {
  return !input.clinicalDocument && Boolean(getKnownClinicalDocument(input));
}
