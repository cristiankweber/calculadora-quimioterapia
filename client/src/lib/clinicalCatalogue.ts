import type { Protocol, Drug } from "@/types/calculator";
import { protocols as legacyProtocols } from "@/data/protocols";
import {
  clinicalDocuments,
  clinicalPackage,
  isReviewedLegacy,
  isEnrichedClinicalDocument,
} from "@shared/clinicalProtocols/library";
import {
  isActiveTemplateDocument,
  USER_TEMPLATE_VERSION,
} from "@shared/clinicalProtocols/templates";
export type CatalogueKind = "reviewed" | "custom" | "legacy" | "templates";
const { protocols: _documents, ...envelope } = clinicalPackage;
const risk = (v: unknown): Protocol["emetogenicRisk"] =>
  ["high", "moderate", "low", "minimal"].includes(String(v))
    ? (v as Protocol["emetogenicRisk"])
    : "minimal";
const strings = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((item): item is string => typeof item === "string")
    : [];

export function mapClinicalDocument(
  document: Record<string, unknown>,
  packageData: Record<string, unknown> = envelope,
  id?: string
): Protocol {
  return {
    id: id ?? `clinical-${String(document.id)}`,
    name: String(document.name ?? "Documento clínico"),
    indication: String(document.indication ?? ""),
    cycles:
      typeof document.cycles === "number" &&
      document.cycles > 0 &&
      document.cycles !== 999
        ? document.cycles
        : 1,
    cycleLength:
      typeof document.cycleLength === "number" && document.cycleLength > 0
        ? document.cycleLength
        : 1,
    emetogenicRisk: risk(document.emetogenicRisk),
    drugs: [],
    renalAdjustments: strings(document.renalAdjustments),
    hepaticAdjustments: strings(document.hepaticAdjustments),
    hematologicAdjustments: strings(document.hematologicAdjustments),
    prophylaxis: strings(document.prophylaxis),
    nursingCare: strings(document.nursingCare),
    specialAlerts: strings(document.specialAlerts),
    clinicalDocument: document,
    clinicalPackage: packageData,
    libraryKind: "reviewed",
  };
}

export function mapStoredProtocol(record: Record<string, unknown>): Protocol {
  const packageData = record.clinicalPackage as
    | Record<string, unknown>
    | undefined;
  if (
    packageData?.version === USER_TEMPLATE_VERSION &&
    isActiveTemplateDocument(record.clinicalDocument)
  ) {
    return {
      ...mapClinicalDocument(
        record.clinicalDocument as Record<string, unknown>,
        packageData,
        String(record.protocolId)
      ),
      libraryKind: "templates",
      isUserTemplate: true,
    };
  }
  if (isEnrichedClinicalDocument(record.clinicalDocument)) {
    return mapClinicalDocument(
      record.clinicalDocument as Record<string, unknown>,
      (record.clinicalPackage as Record<string, unknown>) ?? envelope,
      String(record.protocolId)
    );
  }
  if (
    record.clinicalDocument &&
    typeof record.clinicalDocument === "object" &&
    !Array.isArray(record.clinicalDocument)
  )
    record = {
      ...record,
      ...(record.clinicalDocument as Record<string, unknown>),
      protocolId: record.protocolId,
    };
  const mapped: Protocol = {
    id: String(record.protocolId),
    name: String(record.name ?? ""),
    indication: String(record.indication ?? ""),
    cycles: Number(record.cycles ?? 1),
    cycleLength: Number(record.cycleLength ?? 21),
    drugs: Array.isArray(record.drugs) ? (record.drugs as Drug[]) : [],
    emetogenicRisk: risk(record.emetogenicRisk),
    renalAdjustments: strings(record.renalAdjustments),
    hepaticAdjustments: strings(record.hepaticAdjustments),
    hematologicAdjustments: strings(record.hematologicAdjustments),
    prophylaxis: strings(record.prophylaxis),
    nursingCare: strings(record.nursingCare),
    specialAlerts: strings(record.specialAlerts),
    libraryKind: "custom",
  };
  if (isReviewedLegacy(mapped) || record.isSystem === 1)
    mapped.libraryKind = "legacy";
  return mapped;
}

export function getClinicalCatalogue(
  kind: CatalogueKind,
  records: Record<string, unknown>[]
): Protocol[] {
  const active = records
    .filter(record => record.isActive !== 0)
    .map(mapStoredProtocol);
  if (kind === "templates")
    return active.filter(protocol => protocol.libraryKind === "templates");
  if (kind === "reviewed")
    return clinicalDocuments.map(doc => mapClinicalDocument(doc));
  if (kind === "custom")
    return active.filter(
      protocol =>
        protocol.libraryKind === "custom" ||
        (protocol.clinicalDocument &&
          !clinicalDocuments.some(
            doc => doc.id === protocol.clinicalDocument?.id
          ))
    );
  const stored = active.filter(p => p.libraryKind === "legacy");
  const storedNames = new Set(stored.map(p => p.name));
  return [
    ...stored,
    ...legacyProtocols
      .filter(p => !storedNames.has(p.name))
      .map(p => ({ ...p, libraryKind: "legacy" as const })),
  ];
}
