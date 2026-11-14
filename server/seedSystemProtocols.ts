import { createHash } from "node:crypto";
import type { InsertCustomProtocol } from "../drizzle/schema";
import clinicalLibrary from "../shared/data/clinicalProtocols.json";

export const CLINICAL_PROTOCOL_VERSION = "2.1-source-reconciled-clinical-draft" as const;
export const PROTOCOL_COLLECTION_VERSION = "clinical-protocol-collection-1.0" as const;
export type ProtocolPackageVersion = "1.0" | typeof CLINICAL_PROTOCOL_VERSION;
export type JsonObject = Record<string, unknown>;

/** Extensible JSON contracts: never parse through a schema that strips unknown keys. */
export interface ProtocolDrug extends JsonObject {
  name: string;
  dose: number | null;
  doseUnit: string;
  route: string;
  days: string;
  maxDose?: number;
}
export interface ProtocolDocument extends JsonObject {
  id?: string;
  name: string;
  indication: string;
  cycles?: number | null;
  cycleLength?: number | null;
  emetogenicRisk?: string;
  drugs: ProtocolDrug[];
}
export interface ProtocolExportFormat extends JsonObject {
  version: ProtocolPackageVersion;
  exportedAt?: string;
  exportedBy?: string;
  protocols: ProtocolDocument[];
}
/** A mixed export groups by exact envelope, not only version, so no references are overwritten. */
export interface ProtocolCollectionFormat extends JsonObject {
  version: typeof PROTOCOL_COLLECTION_VERSION;
  packages: ProtocolExportFormat[];
}
export type AnyProtocolExport = ProtocolExportFormat | ProtocolCollectionFormat;

const doseUnits = new Set(["mg/m²", "mg/kg", "mg", "AUC", "mcg/kg", "mcg/m²", "mcg", "cGy", "UI/m²"]);
const risks = new Set(["high", "moderate", "low", "minimal"]);
const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);
const libraryIds = new Set(clinicalLibrary.protocols.map(protocol => protocol.id));
const enrichedKeys = new Set([
  "calculationPolicy", "review", "referenceOnly", "phaseLibrary", "phaseBreak", "cycleDefinition",
  "schedule", "administrationFrequency", "doseBasis", "scheduleStatus", "automaticPrescriptionAllowed",
  "ageDoseTable", "doseLevelTable", "requiresScheduleAwareEngine", "essentialSupportOrders",
  "baselineTests", "monitoring", "additionalReferenceModules", "sources",
]);
const safetyValues: Record<string, boolean> = {
  automaticPrescriptionAllowed: false,
  legacyImportSafetyVerified: false,
  requiresScheduleAwareEngine: true,
  unitsMustBeExplicit: true,
  renalOrHepaticAdjustmentAutomatic: false,
  requiresMedicalApproval: true,
  requiresPharmacyApproval: true,
  calculatorIntegrationTested: false,
};
const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Also rejects inherited/custom prototypes, cyclic objects and non-JSON values for direct callers. */
function inspectJson(value: unknown, errors: string[], path = "$", ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path}: número deve ser finito.`);
    return;
  }
  if (typeof value !== "object") { errors.push(`${path}: valor não JSON.`); return; }
  if (ancestors.has(value)) { errors.push(`${path}: estrutura cíclica não JSON.`); return; }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    errors.push(`${path}: protótipo não permitido.`); return;
  }
  ancestors.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (unsafeKeys.has(key)) errors.push(`${path}.${key}: chave proibida (prototype pollution).`);
    inspectJson(child, errors, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

function containsEnriched(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsEnriched);
  return isObject(value) && Object.entries(value).some(([key, child]) => enrichedKeys.has(key) || containsEnriched(child));
}
function hasDoseDecision(node: JsonObject): boolean {
  return ["ageDoseTable", "ageTable", "doseLevelTable", "ageDoseVariants", "doseVariants"].some(key =>
    Array.isArray(node[key]) && (node[key] as unknown[]).length > 0,
  ) || ["doseSelection", "doseDecision", "doseSelectionDecision"].some(key =>
    nonempty(node[key]) || isObject(node[key]),
  );
}

/** Structural validation only. This does NOT resolve calendars, doses, phases or clinical decisions. */
function inspectClinicalTree(node: unknown, errors: string[], path: string, decision = false): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => inspectClinicalTree(child, errors, `${path}[${i}]`, decision));
    return;
  }
  if (!isObject(node)) return;
  const allowNullDose = decision || hasDoseDecision(node);
  for (const [key, value] of Object.entries(node)) {
    if (Object.hasOwn(safetyValues, key) && value !== safetyValues[key]) {
      errors.push(`${path}.${key}: política de rascunho deve permanecer ${safetyValues[key]}.`);
    }
    if (key === "doseUnit" && (typeof value !== "string" || !doseUnits.has(value))) {
      errors.push(`${path}: unidade de dose inválida: ${String(value)}`);
    }
    if (key === "dose" && !(typeof value === "number" && Number.isFinite(value) && value >= 0) && !(value === null && allowNullDose)) {
      errors.push(`${path}: dose deve ser um número finito >= 0 ou null com tabela/decisão explícita.`);
    }
    if (["drugs", "phaseLibrary", "schedule"].includes(key) && !Array.isArray(value)) {
      errors.push(`${path}.${key}: deve ser um array.`);
    }
    if (key === "drugs" && Array.isArray(value)) {
      value.forEach((drug, index) => {
        if (!isObject(drug)) { errors.push(`${path}.drugs[${index}]: esperado um objeto.`); return; }
        for (const field of ["name", "doseUnit", "route"]) {
          if (!nonempty(drug[field])) errors.push(`${path}.drugs[${index}].${field}: campo obrigatório.`);
        }
        if (typeof drug.days !== "string" || (!nonempty(drug.days) && !(Array.isArray(drug.schedule) && drug.schedule.length > 0))) {
          errors.push(`${path}.drugs[${index}].days: texto ou calendário estruturado obrigatório.`);
        }
        if (!Object.hasOwn(drug, "dose")) errors.push(`${path}.drugs[${index}]: dose deve ser explicitamente informada.`);
      });
    }
    // Dose decisions are local to their drug and its schedule, not inherited by unrelated phase drugs.
    inspectClinicalTree(value, errors, `${path}.${key}`, key === "schedule" ? allowNullDose : false);
  }
}

function validatePackage(data: JsonObject, errors: string[], prefix = ""): void {
  if (data.version !== "1.0" && data.version !== CLINICAL_PROTOCOL_VERSION) {
    errors.push(`Versão não suportada: ${String(data.version)}. Esperado: 1.0 ou ${CLINICAL_PROTOCOL_VERSION}`);
    return;
  }
  const clinical = data.version === CLINICAL_PROTOCOL_VERSION;
  if (!clinical && containsEnriched(data)) {
    errors.push("Documento clínico enriquecido não pode ser declarado como versão 1.0; políticas não podem ser removidas.");
  }
  if (!Array.isArray(data.protocols)) { errors.push("Campo 'protocols' deve ser um array."); return; }
  if (!data.protocols.length) { errors.push("Nenhum protocolo encontrado no arquivo."); return; }
  if (clinical) {
    if (!isObject(data.metadata)) errors.push("metadata clínico deve ser um objeto.");
    for (const key of ["references", "additionalReferenceModules"]) {
      if (data[key] !== undefined && !Array.isArray(data[key])) errors.push(`${key} deve ser um array.`);
    }
    inspectClinicalTree(data, errors, prefix || "$");
  }
  data.protocols.forEach((protocol, i) => {
    const label = `${prefix}Protocolo ${i + 1}`;
    if (!isObject(protocol)) { errors.push(`${label}: esperado um objeto.`); return; }
    if (!nonempty(protocol.name)) errors.push(`${label}: nome é obrigatório.`);
    if (!nonempty(protocol.indication)) errors.push(`${label}: indicação é obrigatória.`);
    if (clinical && !nonempty(protocol.id)) errors.push(`${label}: id é obrigatório.`);
    if (!clinical && typeof protocol.id === "string" && libraryIds.has(protocol.id)) {
      errors.push(`${label}: identificador da biblioteca clínica não pode ser rebaixado para 1.0.`);
    }
    for (const key of ["cycles", "cycleLength"]) {
      const value = protocol[key];
      if (value !== undefined && value !== null && !(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647)) {
        errors.push(`${label}: ${key} deve ser inteiro finito não negativo ou null.`);
      }
    }
    if (protocol.emetogenicRisk && !risks.has(String(protocol.emetogenicRisk))) {
      errors.push(`${label}: risco emetogênico inválido: ${String(protocol.emetogenicRisk)}`);
    }
    if (!Array.isArray(protocol.drugs) || (!protocol.drugs.length && protocol.referenceOnly !== true)) {
      errors.push(`${label}: pelo menos uma droga é obrigatória (exceto referenceOnly).`);
    } else {
      protocol.drugs.forEach((drug, j) => {
        const drugLabel = `${label}, Droga ${j + 1}`;
        if (!isObject(drug)) { errors.push(`${drugLabel}: esperado um objeto.`); return; }
        if (!nonempty(drug.name)) errors.push(`${drugLabel}: nome é obrigatório.`);
        if (!(typeof drug.dose === "number" && Number.isFinite(drug.dose) && drug.dose >= 0) && !(clinical && drug.dose === null && hasDoseDecision(drug))) {
          errors.push(`${drugLabel}: dose deve ser um número finito >= 0 ou null com tabela/decisão explícita.`);
        }
        if (typeof drug.doseUnit !== "string" || !doseUnits.has(drug.doseUnit)) errors.push(`${drugLabel}: unidade de dose inválida: ${String(drug.doseUnit)}`);
        if (!nonempty(drug.route)) errors.push(`${drugLabel}: via é obrigatória.`);
        if (!nonempty(drug.days)) errors.push(`${drugLabel}: dias é obrigatório.`);
      });
    }
    if (clinical) {
      for (const [section, keys] of [
        ["calculationPolicy", ["automaticPrescriptionAllowed", "legacyImportSafetyVerified", "requiresScheduleAwareEngine", "unitsMustBeExplicit", "renalOrHepaticAdjustmentAutomatic"]],
        ["review", ["requiresMedicalApproval", "requiresPharmacyApproval", "calculatorIntegrationTested"]],
      ] as const) {
        const policy = protocol[section];
        if (!isObject(policy)) { errors.push(`${label}: ${section} obrigatório em rascunho clínico.`); continue; }
        for (const key of keys) if (policy[key] !== safetyValues[key]) errors.push(`${label}: ${section}.${key} deve permanecer ${safetyValues[key]}.`);
        if (section === "review" && policy.status !== "draft_not_institutionally_approved") errors.push(`${label}: status de revisão deve permanecer rascunho não homologado.`);
      }
    }
  });
}

export function validateImportFormat(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(data)) return ["Formato inválido: esperado um objeto JSON."];
  inspectJson(data, errors);
  if (errors.length) return errors;
  if (data.version === PROTOCOL_COLLECTION_VERSION) {
    if (!Array.isArray(data.packages) || data.packages.length === 0) return ["Coleção deve conter ao menos um pacote."];
    data.packages.forEach((p, i) => {
      if (!isObject(p)) errors.push(`Pacote ${i + 1}: esperado um objeto.`);
      else validatePackage(p, errors, `Pacote ${i + 1}, `);
    });
  } else validatePackage(data, errors);
  return errors;
}

export function parseProtocolImport(jsonData: string): AnyProtocolExport {
  let parsed: unknown;
  try { parsed = JSON.parse(jsonData); }
  catch { throw new Error("JSON inválido. Verifique o formato do arquivo."); }
  const errors = validateImportFormat(parsed);
  if (errors.length) throw new Error(`Erros de validação: ${errors.join("; ")}`);
  return parsed as AnyProtocolExport;
}

/** Canonical hashing: whitespace and property insertion order do not produce a new identity. */
export function canonicalProtocolJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalProtocolJson).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalProtocolJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function protocolContentSha256(value: unknown): string {
  return createHash("sha256").update(canonicalProtocolJson(value)).digest("hex");
}
function assertUser(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Usuário autenticado válido é obrigatório.");
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function convertImportToDbRecords(
  data: AnyProtocolExport,
  userId: number,
  options: { isSystem?: 0 | 1; source?: string } = {},
): InsertCustomProtocol[] {
  assertUser(userId);
  const errors = validateImportFormat(data);
  if (errors.length) throw new Error(`Erros de validação: ${errors.join("; ")}`);
  if (data.version === PROTOCOL_COLLECTION_VERSION) {
    return data.packages.flatMap(p => convertImportToDbRecords(p, userId, options));
  }
  const { protocols, ...envelope } = data;
  return protocols.map(protocol => {
    const contentHash = protocolContentSha256({ document: protocol, envelope });
    const source = options.source ?? envelope.sourceId ?? envelope.source ?? protocol.sources ?? "protocol-import";
    const identity = protocolContentSha256({ userId, source, id: protocol.id ?? protocol.name, version: data.version, contentHash });
    const slug = protocol.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const summaryArrays: Partial<InsertCustomProtocol> = {};
    for (const key of ["specialAlerts", "prophylaxis", "nursingCare", "renalAdjustments", "hepaticAdjustments", "hematologicAdjustments", "dilutionInfo"] as const) {
      // Full original arrays remain in clinicalDocument even when legacy summary fields are absent.
      (summaryArrays as JsonObject)[key] = clone(protocol[key] ?? []);
    }
    return {
      userId, protocolId: `imported-${slug}-${identity}`,
      name: protocol.name.slice(0, 255), indication: protocol.indication.slice(0, 512),
      cycles: protocol.cycles === null || protocol.cycles === 999 ? 1 : protocol.cycles || 1,
      cycleLength: protocol.cycleLength || (data.version === "1.0" ? 21 : 1),
      emetogenicRisk: (protocol.emetogenicRisk || "moderate") as InsertCustomProtocol["emetogenicRisk"],
      drugs: clone(protocol.drugs), clinicalDocument: clone(protocol), clinicalPackage: clone(envelope),
      ...summaryArrays, isActive: 1, isSystem: options.isSystem ?? 0,
    };
  });
}

/** Legacy-system entry point retained, but identities are now owner scoped and payloads are lossless. */
type SourceProtocol = {
  id: string; name: string; indication: string; cycles: number; cycleLength: number;
  emetogenicRisk: string;
  drugs: Array<{ name: string; dose: number; doseUnit: string; route: string; days: string }>;
};
export function convertProtocolToDbRecord(protocol: SourceProtocol, userId: number): InsertCustomProtocol {
  return convertAllProtocols([protocol], userId)[0];
}
export function convertAllProtocols(protocols: SourceProtocol[], userId: number): InsertCustomProtocol[] {
  return convertImportToDbRecords({ version: "1.0", protocols: clone(protocols) as ProtocolDocument[] }, userId, { isSystem: 1, source: "legacy-system" });
}

type ExportableRecord = Pick<InsertCustomProtocol, "name" | "indication" | "drugs"> & Partial<InsertCustomProtocol>;
export function exportProtocolPackage(records: ExportableRecord[]): AnyProtocolExport {
  const groups = new Map<string, ProtocolExportFormat>();
  for (const record of records) {
    let document: ProtocolDocument;
    let envelope: JsonObject;
    if (record.clinicalDocument != null) {
      if (!isObject(record.clinicalDocument) || !isObject(record.clinicalPackage)) throw new Error("Documento clínico sem envelope íntegro; exportação bloqueada para evitar perda.");
      document = clone(record.clinicalDocument) as ProtocolDocument;
      envelope = clone(record.clinicalPackage);
      if (Object.hasOwn(envelope, "protocols")) throw new Error("Envelope armazenado não pode conter protocols.");
    } else {
      if (record.clinicalPackage != null || containsEnriched(record.drugs)) throw new Error("Registro enriquecido incompleto não pode ser rebaixado para 1.0.");
      envelope = { version: "1.0" };
      document = { id: record.protocolId, name: record.name, indication: record.indication,
        cycles: record.cycles ?? 1, cycleLength: record.cycleLength ?? 21, emetogenicRisk: record.emetogenicRisk ?? "moderate", drugs: clone(record.drugs) as ProtocolDrug[] };
      for (const key of ["specialAlerts", "prophylaxis", "nursingCare", "renalAdjustments", "hepaticAdjustments", "hematologicAdjustments", "dilutionInfo"] as const) document[key] = clone(record[key] ?? []);
    }
    const candidate = { ...envelope, protocols: [document] };
    const errors = validateImportFormat(candidate);
    if (errors.length) throw new Error(`Documento armazenado inválido para exportação: ${errors.join("; ")}`);
    const key = canonicalProtocolJson(envelope);
    const group = groups.get(key);
    if (group) group.protocols.push(document);
    else groups.set(key, candidate as ProtocolExportFormat);
  }
  if (groups.size === 0) return { version: "1.0", protocols: [] };
  if (groups.size === 1) return Array.from(groups.values())[0];
  return { version: PROTOCOL_COLLECTION_VERSION, packages: Array.from(groups.values()) };
}
