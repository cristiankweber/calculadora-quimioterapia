import type { ClinicalContext, ClinicalProtocolDocument, ResolvedClinicalProtocol } from "./types";
import { formatClinicalFrequency } from "./resolver";

export const USER_TEMPLATE_VERSION = "user-protocol-template-1.0" as const;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** UX/execution discriminator only. Ownership and stored package version are backend responsibilities. */
export function isActiveTemplateDocument(document: unknown): boolean {
  if (!record(document) || !record(document.templateUsage)) return false;
  return document.templateUsage.kind === "user_managed" &&
    document.templateUsage.status === "active" && document.templateUsage.prescriptionEnabled === true;
}

const clinicalExtensions = new Set([
  "phaseLibrary", "calculationPolicy", "referenceOnly", "cycleDefinition", "cyclesUnbounded",
  "schedule", "administrationFrequency", "doseRepresents", "timeOrigin", "doseDecision",
  "doseSelection", "doseSelectionDecision", "doseSelectionRequired", "selectionRequired",
  "ageDoseTable", "ageTable", "ageDoseVariants", "doseVariants", "doseLevelTable",
  "doseLevelSelection", "doseLevelAdjustmentRules", "agePerformanceVariants", "conditionalDoses",
  "conditionalExtraDays", "alternatives", "arms", "treatmentArms", "programSelection",
  "mesnaPolicy", "mesnaSchedule", "rescueProtocol", "methotrexateRescueOrders",
  "CNSProphylaxis", "CNSPositiveReplacement", "CNSDirectedTherapy", "optionalAntibody",
  "adjustmentTables", "dosingWeightPolicy", "asparaginaseToxicityModifications",
  "courseCountPolicy", "neuropathyAdjustmentNotes", "isatuximabInfusion", "supportProtocol",
]);
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
};

/** Derives executable roots, never rewrites sourceDocument/extensions or fills explicit nulls. */
export function getTemplateExecutionDocument(document: ClinicalProtocolDocument): ClinicalProtocolDocument {
  const conflicts: string[] = [];
  const derive = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) return value.map((item, index) => derive(item, `${path}[${index}]`));
    if (!record(value)) return value;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      // Archival fields are cloned, not recursively promoted/interpreted.
      output[key] = ["sourceDocument", "sourceEnvelope", "extensions"].includes(key)
        ? structuredClone(child) : derive(child, `${path}.${key}`);
    }
    if (record(value.extensions)) {
      for (const [key, child] of Object.entries(value.extensions)) {
        if (!clinicalExtensions.has(key)) continue;
        if (own(value, key)) {
          if (canonical(value[key]) !== canonical(child))
            conflicts.push(`${path}.${key}: conflito explícito entre raiz e extensions; nenhuma variante escolhida.`);
        } else output[key] = derive(child, `${path}.${key}`);
      }
    }
    return output;
  };
  const execution = derive(document, "Documento") as ClinicalProtocolDocument;
  const prior = Array.isArray(execution.templateExecutionIssues)
    ? execution.templateExecutionIssues.filter((issue): issue is string => typeof issue === "string") : [];
  if (prior.length || conflicts.length) execution.templateExecutionIssues = Array.from(new Set([...prior, ...conflicts]));
  return execution;
}

/** A selected output is all-or-nothing. This is not an institutional release or an ownership check. */
export function getTemplatePrescriptionIssues(
  document: ClinicalProtocolDocument, context: ClinicalContext, resolution: ResolvedClinicalProtocol,
): string[] {
  const execution = getTemplateExecutionDocument(document);
  const issues = [...resolution.issues];
  if (!isActiveTemplateDocument(document)) issues.push("Template do usuário não está ativo para prescrição.");
  if (execution.referenceOnly === true || execution.calculationPolicy?.referenceOnly === true)
    issues.push("Documento referenceOnly: somente consulta, sem prescrição.");
  if (Array.isArray(execution.templateExecutionIssues))
    issues.push(...execution.templateExecutionIssues.filter((issue): issue is string => typeof issue === "string"));
  if (!Number.isSafeInteger(context.cycle) || context.cycle <= 0) issues.push("cycle explícito inválido.");
  if (execution.phaseLibrary && (!context.phaseId || execution.phaseLibrary.filter(p => p.id === context.phaseId).length !== 1))
    issues.push("Selecionar phaseId válido e único; não usar drogas principais como fallback.");
  else if (context.phaseId && !execution.phaseLibrary && !execution.drugs.some(d => d.schedule?.some(s => s.phase === context.phaseId)))
    issues.push("phaseId não corresponde a nenhuma fase declarada.");
  for (const row of resolution.rows) {
    issues.push(...row.issues);
    if (row.status === "blocked") issues.push(`${row.source.name}: etapa não resolvida; saída parcial bloqueada.`);
    if (row.status === "ready" && (!positive(row.dose) || !positive(row.calculatedDose) || !positive(row.frequency)))
      issues.push(`${row.source.name}: dose/frequência não resolvida numericamente.`);
  }
  if (!resolution.rows.some(row => row.status === "ready")) issues.push("Nenhuma droga pronta na seleção atual.");
  if (resolution.prescriptionBlocked && issues.length === 0) issues.push("Resolução bloqueada; revisar seleção completa.");
  return Array.from(new Set(issues));
}

/** Adapter for Drug consumers: stage dose stays unscaled; calculatedDose is per application. */
export function mapResolvedTemplateDrugs(resolution: ResolvedClinicalProtocol) {
  if (resolution.prescriptionBlocked || resolution.issues.length || resolution.rows.some(row => row.status === "blocked" || row.issues.length)) return [];
  const ready = resolution.rows.filter(row => row.status === "ready");
  if (!ready.length || ready.some(row => !positive(row.dose) || !positive(row.calculatedDose) || !positive(row.frequency))) return [];
  return ready.map(row => {
    const frequency = formatClinicalFrequency(row);
    const daily = row.dailyDose === null ? "Dose de 24h: não definida (total desta infusão)" : `Dose de 24h: ${row.dailyDose} ${row.resultUnit}`;
    const originalNotes = typeof row.source.observations === "string" ? row.source.observations : "";
    return {
      id: row.source.id, name: row.source.name,
      dose: row.dose as number, doseUnit: row.doseUnit ?? row.source.doseUnit,
      calculatedDose: row.calculatedDose as number, resultUnit: row.resultUnit,
      route: row.source.route, days: row.days,
      observations: [originalNotes, `Origem temporal: ${row.timeOrigin}`, frequency, daily].filter(Boolean).join("; "),
      frequency: row.frequency as number, dailyDose: row.dailyDose,
      timeOrigin: row.timeOrigin, doseRepresents: row.doseRepresents ?? "per_administration",
      ...(positive(row.source.maxDose) ? { maxDose: row.source.maxDose } : {}),
    };
  });
}
