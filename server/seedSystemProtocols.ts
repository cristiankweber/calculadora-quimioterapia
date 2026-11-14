import { createHash } from "node:crypto";
import type { InsertCustomProtocol } from "../drizzle/schema";
import clinicalLibrary from "../shared/data/clinicalProtocols.json";
import { isActiveTemplateDocument, USER_TEMPLATE_VERSION } from "../shared/clinicalProtocols/templates";

export const CLINICAL_PROTOCOL_VERSION = "2.1-source-reconciled-clinical-draft" as const;
export const PROTOCOL_COLLECTION_VERSION = "clinical-protocol-collection-1.0" as const;
export type ProtocolPackageVersion = "1.0" | typeof CLINICAL_PROTOCOL_VERSION | typeof USER_TEMPLATE_VERSION;
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
  if (data.version === USER_TEMPLATE_VERSION) {
    validateTemplatePackage(data, errors, prefix);
    return;
  }
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
    if (Object.hasOwn(protocol, "templateUsage")) errors.push(`${label}: templateUsage exige versão de template; não libera documentos legados/rascunhos.`);
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
      userId, protocolId: data.version === USER_TEMPLATE_VERSION
        ? `template-${slug}-${protocolContentSha256({ userId, document: templateIdentityContent(protocol), envelope: templateIdentityContent(envelope) })}`
        : `imported-${slug}-${identity}`,
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

/** Identity excludes export timestamps/checksums derived from them, not source content. */
function templateIdentityContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(templateIdentityContent);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "exportedAt" && key !== "sourceSha256")
    .map(([key, child]) => [key, templateIdentityContent(child)]));
}

const templateDoseUnits = new Set([...Array.from(doseUnits), "UI", "UI/kg", "mg/m2", "mcg/m2", "UI/m2"]);
/** Clinical structure only; sourceDocument/sourceEnvelope are archival, not executable draft policy. */
function inspectTemplateTree(node: unknown, errors: string[], path: string, sourced: boolean): void {
  if (Array.isArray(node)) {
    node.forEach((child, index) => inspectTemplateTree(child, errors, `${path}[${index}]`, sourced));
    return;
  }
  if (!isObject(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (["sourceDocument", "sourceEnvelope"].includes(key)) continue;
    if (key === "dose" && !(typeof value === "number" && Number.isFinite(value) && value > 0) && !(sourced && value === null))
      errors.push(`${path}.dose: dose deve ser finita > 0, ou null preservado da fonte explícita.`);
    if (key === "maxDose" && value !== null && !(typeof value === "number" && Number.isFinite(value) && value > 0))
      errors.push(`${path}.maxDose: máximo deve ser finito > 0.`);
    if (key === "doseUnit" && (typeof value !== "string" || !templateDoseUnits.has(value)))
      errors.push(`${path}.doseUnit: unidade de dose inválida: ${String(value)}.`);
    if (["drugs", "phaseLibrary", "schedule"].includes(key) && !Array.isArray(value))
      errors.push(`${path}.${key}: deve ser um array.`);
    if (key === "drugs" && Array.isArray(value)) {
      value.forEach((drug, index) => {
        const label = `${path}.drugs[${index}]`;
        if (!isObject(drug)) { errors.push(`${label}: esperado um objeto.`); return; }
        for (const field of ["id", "name", "doseUnit", "route"])
          if (!nonempty(drug[field])) errors.push(`${label}.${field}: campo obrigatório.`);
        if (!Object.hasOwn(drug, "dose")) errors.push(`${label}.dose: dose deve ser explícita.`);
        if (typeof drug.days !== "string") errors.push(`${label}.days: texto explícito obrigatório.`);
      });
      const ids = value.filter(isObject).map(drug => drug.id);
      if (new Set(ids).size !== ids.length) errors.push(`${path}.drugs: identificadores duplicados.`);
    }
    if (key === "phaseLibrary" && Array.isArray(value)) {
      value.forEach((phase, index) => {
        if (!isObject(phase) || !nonempty(phase.id) || !nonempty(phase.name)) errors.push(`${path}.phaseLibrary[${index}]: id/nome obrigatórios.`);
      });
      const ids = value.filter(isObject).map(phase => phase.id);
      if (new Set(ids).size !== ids.length) errors.push(`${path}.phaseLibrary: identificadores duplicados.`);
    }
    if (key === "schedule" && Array.isArray(value)) value.forEach((stage, index) => {
      if (!isObject(stage) || !Object.hasOwn(stage, "dose")) errors.push(`${path}.schedule[${index}]: etapa exige dose explícita.`);
    });
    inspectTemplateTree(value, errors, `${path}.${key}`, sourced);
  }
}

function validateTemplatePackage(data: JsonObject, errors: string[], prefix: string): void {
  const metadata = data.metadata;
  if (!isObject(metadata) || metadata.importMode !== "user_template" ||
    !["2.18", "1.0"].includes(String(metadata.sourceVersion)) ||
    typeof metadata.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(metadata.sourceSha256))
    errors.push(`${prefix}metadata de template exige importMode, sourceVersion e sourceSha256 íntegros.`);
  if (!isObject(data.sourceEnvelope) || (isObject(metadata) && data.sourceEnvelope.version !== metadata.sourceVersion))
    errors.push(`${prefix}sourceEnvelope original obrigatório e compatível com sourceVersion.`);
  if (!Array.isArray(data.protocols) || !data.protocols.length) { errors.push(`${prefix}protocols deve conter ao menos um documento.`); return; }
  data.protocols.forEach((document, index) => {
    const label = `${prefix}Template ${index + 1}`;
    if (!isObject(document)) { errors.push(`${label}: esperado um objeto.`); return; }
    for (const field of ["id", "name", "indication"]) if (!nonempty(document[field])) errors.push(`${label}.${field}: campo obrigatório.`);
    if (!isActiveTemplateDocument(document)) errors.push(`${label}: templateUsage deve ser user_managed, active, prescriptionEnabled true.`);
    if (!isObject(document.sourceDocument)) errors.push(`${label}: sourceDocument original integral obrigatório.`);
    else if (document.sourceDocumentSha256 !== protocolContentSha256(document.sourceDocument))
      errors.push(`${label}: sourceDocumentSha256 não corresponde ao documento original preservado.`);
    if (!Array.isArray(document.drugs) || (!document.drugs.length && document.referenceOnly !== true))
      errors.push(`${label}: drogas obrigatórias salvo referenceOnly.`);
    for (const key of ["cycles", "cycleLength"]) {
      const value = document[key];
      if (value !== null && !(typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647))
        errors.push(`${label}.${key}: inteiro positivo ou null obrigatório.`);
    }
    if (document.emetogenicRisk && !risks.has(String(document.emetogenicRisk))) errors.push(`${label}: risco emetogênico inválido.`);
    inspectTemplateTree(document, errors, label, isObject(document.sourceDocument));
  });
}

/** Only deterministic explicit numeric days; no optional/rescue/clinical text is converted. */
function staticTemplateDays(text: unknown): number[] | null {
  if (typeof text !== "string" || !/^\s*\d+(?:\s*-\s*\d+)?(?:\s*[,;]\s*\d+(?:\s*-\s*\d+)?)*\s*$/.test(text)) return null;
  const days: number[] = [];
  for (const token of text.split(/[,;]/)) {
    const [start, finish = start] = token.trim().split(/\s*-\s*/).map(Number);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(finish) || start <= 0 || finish < start || finish - start > 10000) return null;
    for (let day = start; day <= finish; day++) days.push(day);
  }
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

/** Explicit authorized converter. No DB, implicit downgrade, institutional approval or source rewrite. */
export function convertToUserTemplatePackage(raw: unknown): AnyProtocolExport {
  if (!isObject(raw)) throw new Error("Formato inválido: esperado um objeto JSON.");
  const jsonErrors: string[] = [];
  inspectJson(raw, jsonErrors);
  if (jsonErrors.length) throw new Error(`Erros de validação: ${jsonErrors.join("; ")}`);
  if (raw.version === USER_TEMPLATE_VERSION) {
    const errors = validateImportFormat(raw);
    if (errors.length) throw new Error(`Erros de validação: ${errors.join("; ")}`);
    return clone(raw) as ProtocolExportFormat;
  }
  if (raw.version === PROTOCOL_COLLECTION_VERSION) {
    if (!Array.isArray(raw.packages) || !raw.packages.length) throw new Error("Coleção deve conter pacotes.");
    return { ...clone(raw), version: PROTOCOL_COLLECTION_VERSION, packages: raw.packages.map(p => {
      const converted = convertToUserTemplatePackage(p);
      if (converted.version === PROTOCOL_COLLECTION_VERSION) throw new Error("Coleções aninhadas não são suportadas.");
      return converted;
    }) } as ProtocolCollectionFormat;
  }
  if (raw.version !== "2.18" && raw.version !== "1.0") throw new Error(`Versão fonte não autorizada para template: ${String(raw.version)}.`);
  if (!Array.isArray(raw.protocols) || !raw.protocols.length || !raw.protocols.every(isObject)) throw new Error("protocols deve conter documentos JSON.");
  const brecadd = raw.version === "1.0";
  if (brecadd && !raw.protocols.every(document => typeof document.name === "string" && /BrECADD/i.test(document.name)))
    throw new Error("Fonte 1.0 autorizada somente para planos BrECADD explícitos.");
  const { protocols, ...sourceEnvelope } = clone(raw);
  const documents = (protocols as JsonObject[]).map(original => {
    const document = clone(original);
    if (Object.hasOwn(document, "templateUsage") || Object.hasOwn(document, "sourceDocument")) throw new Error("Fonte não pode disfarçar um documento de template preexistente.");
    if (brecadd) {
      document.id = `brecadd-${protocolContentSha256({ name: document.name, document })}`;
      if (!Array.isArray(document.drugs)) throw new Error("BrECADD exige drogas explícitas.");
      document.drugs = document.drugs.map((drug, index) => {
        if (!isObject(drug)) throw new Error("Droga inválida.");
        const days = staticTemplateDays(drug.days);
        return {
          ...drug, id: `brecadd-drug-${protocolContentSha256({ documentId: document.id, index, drug })}`,
          ...(days ? { schedule: [{ dose: drug.dose, doseUnit: drug.doseUnit, days, timeOrigin: "cycle_day_one", administrationsPerDay: 1, doseRepresents: "per_administration" }] } : {}),
        };
      });
    }
    return { ...document, cycles: document.cycles ?? null, cycleLength: document.cycleLength ?? null,
      sourceDocument: original, sourceDocumentSha256: protocolContentSha256(original),
      templateUsage: { kind: "user_managed", status: "active", prescriptionEnabled: true } } as unknown as ProtocolDocument;
  });
  const normalized: ProtocolExportFormat = {
    ...clone(sourceEnvelope), version: USER_TEMPLATE_VERSION,
    metadata: { ...(isObject(sourceEnvelope.metadata) ? sourceEnvelope.metadata : {}), importMode: "user_template", sourceVersion: raw.version, sourceSha256: protocolContentSha256(raw) },
    sourceEnvelope, protocols: documents,
  };
  const errors = validateImportFormat(normalized);
  if (errors.length) throw new Error(`Erros de validação: ${errors.join("; ")}`);
  return normalized;
}
