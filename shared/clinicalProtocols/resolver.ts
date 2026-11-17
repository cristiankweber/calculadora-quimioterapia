import type {
  ClinicalAdministrationFrequency,
  ClinicalContext,
  ClinicalDrug,
  ClinicalPhase,
  ClinicalProtocolDocument,
  ClinicalRowIdentity,
  ClinicalSchedule,
  ResolvedClinicalDrug,
  ResolvedClinicalProtocol,
} from "./types";
import {
  getClinicalDecisionIssues,
  getTemplateExecutionDocument,
  isActiveTemplateDocument,
} from "./templates";

const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const integer = (value: unknown): value is number =>
  finite(value) && Number.isSafeInteger(value);
const positiveInteger = (value: unknown): value is number =>
  integer(value) && value > 0;
const validDose = (value: unknown): value is number =>
  finite(value) && value >= 0;
const unique = (values: string[]) => Array.from(new Set(values));
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const present = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  value !== false &&
  (!Array.isArray(value) || value.length > 0);

function selectionIssues(
  value: Record<string, unknown>,
  scope: string,
  resolvedKeys: string[] = []
): string[] {
  return getClinicalDecisionIssues(value, scope, resolvedKeys);
}

/** No state change or approval action; consumes existing explicit release information only. */
export function getClinicalPrescriptionBlock(
  document: ClinicalProtocolDocument
): string[] {
  if (isActiveTemplateDocument(document)) return [];
  const issues: string[] = [];
  if (
    document.calculationPolicy?.automaticPrescriptionAllowed !== true ||
    document.automaticPrescriptionAllowed === false
  ) {
    issues.push(
      "Prescrição automática não autorizada pela calculationPolicy do documento."
    );
  }
  if (
    document.referenceOnly === true ||
    document.calculationPolicy?.referenceOnly === true
  ) {
    issues.push(
      "Documento referenceOnly: disponível apenas para consulta/simulação."
    );
  }
  if (document.review?.status !== "institutionally_approved") {
    issues.push("Documento não homologado institucionalmente (review.status).");
  }
  return issues;
}

interface Calendar {
  days?: number[];
  from?: number;
  to?: number;
  every?: number;
  label: string;
  issues: string[];
}

/** Deliberately strict: descriptive text, choices and clinical stop criteria are not parsed. */
function textDays(text: string): number[] | null {
  const normalized = text
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\bD(?=[+-]?\d)/gi, "")
    .replace(/\s+a\s+/gi, ":")
    .replace(/\s+e\s+/gi, ",");
  if (!normalized) return null;
  const result: number[] = [];
  for (const part of normalized.split(/[,;]/)) {
    const token = part.trim();
    const range = token.match(/^([+-]?\d+)\s*[:-]\s*([+-]?\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (!integer(from) || !integer(to) || to < from || to - from > 10000)
        return null;
      for (let day = from; day <= to; day++) result.push(day);
    } else if (/^[+-]?\d+$/.test(token) && integer(Number(token))) {
      result.push(Number(token));
    } else return null;
  }
  return Array.from(new Set(result)).sort((a, b) => a - b);
}

function calendar(schedule: ClinicalSchedule): Calendar {
  const issues: string[] = [];
  if (own(schedule, "days")) {
    const values =
      typeof schedule.days === "string"
        ? textDays(schedule.days)
        : schedule.days;
    if (!Array.isArray(values) || !values.length || !values.every(integer)) {
      return {
        label: typeof schedule.days === "string" ? schedule.days : "",
        issues: ["Calendário days ausente, vazio ou inválido."],
      };
    }
    const days = Array.from(new Set(values)).sort((a, b) => a - b);
    if (
      own(schedule, "dayFrom") ||
      own(schedule, "dayTo") ||
      own(schedule, "repeatEveryDays")
    )
      issues.push(
        "Calendários days e faixa/repetição simultâneos são ambíguos."
      );
    return { days, label: days.join(", "), issues };
  }
  if (!integer(schedule.dayFrom))
    return {
      label: "",
      issues: ["Calendário sem days ou dayFrom explícito válido."],
    };
  if (
    schedule.dayTo !== undefined &&
    schedule.dayTo !== null &&
    (!integer(schedule.dayTo) || schedule.dayTo < schedule.dayFrom)
  ) {
    issues.push("dayTo inválido ou anterior a dayFrom.");
  }
  if (
    own(schedule, "repeatEveryDays") &&
    !positiveInteger(schedule.repeatEveryDays)
  )
    issues.push("repeatEveryDays inválido.");
  const to = integer(schedule.dayTo) ? schedule.dayTo : undefined;
  const every = positiveInteger(schedule.repeatEveryDays)
    ? schedule.repeatEveryDays
    : undefined;
  return {
    from: schedule.dayFrom,
    to,
    every,
    label:
      to === schedule.dayFrom
        ? String(schedule.dayFrom)
        : `${schedule.dayFrom}${to === undefined ? "+" : `–${to}`}${every && every > 1 ? ` (a cada ${every} dias)` : ""}`,
    issues,
  };
}

function includesDay(value: Calendar, day: number): boolean {
  if (value.days) return value.days.includes(day);
  if (
    value.from === undefined ||
    day < value.from ||
    (value.to !== undefined && day > value.to)
  )
    return false;
  return value.every === undefined || (day - value.from) % value.every === 0;
}

function calendarsOverlap(a: Calendar, b: Calendar): boolean {
  if (a.issues.length || b.issues.length) return false;
  if (a.days) return a.days.some(day => includesDay(b, day));
  if (b.days) return b.days.some(day => includesDay(a, day));
  if (a.from === undefined || b.from === undefined) return false;
  const lower = Math.max(a.from, b.from);
  const upper = Math.min(a.to ?? Infinity, b.to ?? Infinity);
  if (lower > upper) return false;
  // Exact progression intersection using integer arithmetic (no calendar expansion).
  const A = BigInt(a.every ?? 1),
    B = BigInt(b.every ?? 1);
  let r0 = A,
    r1 = B,
    x0 = BigInt(1),
    x1 = BigInt(0);
  while (r1 !== BigInt(0)) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [x0, x1] = [x1, x0 - q * x1];
  }
  const delta = BigInt(b.from) - BigInt(a.from);
  if (delta % r0 !== BigInt(0)) return false;
  const modulus = B / r0;
  const k = ((((delta / r0) * x0) % modulus) + modulus) % modulus;
  const period = A * modulus;
  let first = BigInt(a.from) + A * k;
  const bound = BigInt(lower);
  if (first < bound)
    first += ((bound - first + period - BigInt(1)) / period) * period;
  else first -= ((first - bound) / period) * period;
  return !Number.isFinite(upper) || first <= BigInt(upper);
}

function cycleIssues(schedule: ClinicalSchedule): string[] {
  const issues: string[] = [];
  for (const key of ["cycleFrom", "cycleTo"] as const) {
    if (
      schedule[key] !== undefined &&
      schedule[key] !== null &&
      !positiveInteger(schedule[key])
    )
      issues.push(`${key} inválido.`);
  }
  if (
    positiveInteger(schedule.cycleFrom) &&
    positiveInteger(schedule.cycleTo) &&
    schedule.cycleTo < schedule.cycleFrom
  )
    issues.push("cycleTo anterior a cycleFrom.");
  return issues;
}

function inCycle(schedule: ClinicalSchedule, cycle: number): boolean {
  return (
    !(positiveInteger(schedule.cycleFrom) && cycle < schedule.cycleFrom) &&
    !(positiveInteger(schedule.cycleTo) && cycle > schedule.cycleTo)
  );
}

const supportedScheduleKeys = new Set([
  "dose",
  "doseUnit",
  "days",
  "dayFrom",
  "dayTo",
  "repeatEveryDays",
  "cycleFrom",
  "cycleTo",
  "cycleLength",
  "timeOrigin",
  "phase",
  "administrationsPerDay",
  "administrationFrequency",
  "frequency",
  "doseRepresents",
  "continuousInfusion",
]);
const supportedOrigins = new Set([
  "cycle_day_one",
  "cycle_start",
  "treatment_start",
  "transplant_day_zero",
  "phase_day_one",
  "induction_day_one",
  "protocol_I_day_one",
  "protocol_II_day_one",
  "maintenance_start",
]);
const canonicalOrigin = (origin: string): string =>
  origin === "cycle_start" ? "cycle_day_one" : origin;

function scheduleIssues(
  schedule: ClinicalSchedule,
  context: ClinicalContext
): string[] {
  const issues = Object.keys(schedule)
    .filter(key => !supportedScheduleKeys.has(key))
    .map(
      key =>
        `Agenda: ${key} não suportado; seleção/critério temporal deve ser explicitado.`
    );
  issues.push(...cycleIssues(schedule));
  if (
    own(schedule, "cycleLength") &&
    schedule.cycleLength !== null &&
    !positiveInteger(schedule.cycleLength)
  )
    issues.push("cycleLength da agenda inválido.");
  if (schedule.context !== undefined)
    issues.push(
      "Agenda: context não selecionado; não inferir interação ou contexto clínico."
    );
  if (schedule.phase !== undefined && !context.phaseId)
    issues.push("Agenda: phase exige phaseId explícito.");
  return issues;
}

interface SelectedDrug {
  source: ClinicalDrug;
  schedules?: ClinicalSchedule[];
  issues: string[];
  drugLocation: "document" | "phase";
  drugIndex: number;
}

function selectDrugs(
  document: ClinicalProtocolDocument,
  context: ClinicalContext
): { drugs: SelectedDrug[]; phase?: ClinicalPhase; issues: string[] } {
  const issues: string[] = [];
  if (!own(document, "phaseLibrary")) {
    if (
      context.phaseId &&
      !document.drugs.some(d =>
        d.schedule?.some(s => s.phase === context.phaseId)
      )
    ) {
      return {
        drugs: [],
        issues: ["phaseId inválido: nenhuma fase correspondente declarada."],
      };
    }
    return {
      drugs: document.drugs.map((source, drugIndex) => ({
        source,
        drugIndex,
        drugLocation: "document",
        issues: [],
      })),
      issues,
    };
  }
  const phase = document.phaseLibrary?.find(
    phase => phase.id === context.phaseId
  );
  if (!phase || !context.phaseId)
    return {
      drugs: [],
      issues: [
        "Selecionar phaseId válido da phaseLibrary; nenhuma droga principal é usada como fallback.",
      ],
    };
  if (document.phaseLibrary?.filter(p => p.id === phase.id).length !== 1)
    return { drugs: [], issues: ["phaseId duplicado na phaseLibrary."] };
  const phaseIssues = selectionIssues(phase, `Fase ${phase.id}`, [
    "requiresExplicitSelection",
  ]);
  if (phase.automaticPrescriptionAllowed === false)
    issues.push(`Fase ${phase.id}: prescrição automática não autorizada.`);
  if (phase.support?.length)
    issues.push(
      `Fase ${phase.id}: suporte pendente de ordens próprias; não incluído como drogas ativas.`
    );
  for (const key of ["locoregional", "conditionalIT", "ITMaintenance"]) {
    if (present(phase[key]))
      issues.push(
        `Fase ${phase.id}: ${key} pendente; não incluído como droga ativa.`
      );
  }
  const sources: ClinicalDrug[] = [...(phase.drugs ?? [])];
  for (const id of phase.drugRefs ?? []) {
    const matches = document.drugs.filter(d => d.id === id);
    if (matches.length !== 1)
      phaseIssues.push(
        `Fase ${phase.id}: drugRefs ${id} inexistente ou ambíguo.`
      );
    else if (!sources.some(d => d.id === id)) sources.push(matches[0]);
  }
  if (new Set(sources.map(d => d.id)).size !== sources.length)
    phaseIssues.push(`Fase ${phase.id}: identificadores de droga duplicados.`);
  for (const override of phase.scheduleOverrides ?? []) {
    if (!sources.some(d => d.id === override.drugId))
      phaseIssues.push(
        `Fase ${phase.id}: scheduleOverrides aponta droga ausente ${override.drugId}.`
      );
    if (Object.keys(override).some(k => k !== "drugId" && k !== "days"))
      phaseIssues.push(
        `Fase ${phase.id}: scheduleOverrides suporta somente substituição explícita de dias.`
      );
  }
  if (!sources.length)
    issues.push(`Fase ${phase.id} vazia: nenhuma droga ativa declarada.`);
  issues.push(...phaseIssues);
  return {
    phase,
    issues,
    drugs: sources.map(source => {
      const overrides =
        phase.scheduleOverrides?.filter(o => o.drugId === source.id) ?? [];
      const localIssues = [...phaseIssues];
      let schedules: ClinicalSchedule[] | undefined;
      if (overrides.length) {
        if (overrides.length !== 1 || !own(overrides[0], "days"))
          localIssues.push(
            `scheduleOverrides ambíguo ou sem dias: ${source.id}.`
          );
        const originals = source.schedule;
        if (!originals || originals.length !== 1)
          localIssues.push(
            `scheduleOverrides de ${source.id} exige uma única etapa original; não combina doses.`
          );
        else
          schedules = originals.map(
            ({
              dayFrom: _from,
              dayTo: _to,
              repeatEveryDays: _repeat,
              ...schedule
            }) => ({ ...schedule, days: overrides[0].days })
          );
      }
      const phaseIndex = phase.drugs?.indexOf(source) ?? -1;
      return {
        source,
        schedules,
        issues: localIssues,
        drugLocation: phaseIndex >= 0 ? "phase" : "document",
        drugIndex:
          phaseIndex >= 0 ? phaseIndex : document.drugs.indexOf(source),
      };
    }),
  };
}

interface Frequency {
  frequency: number | null;
  continuous: boolean;
  represents: string;
  issues: string[];
}
interface ExplicitDeclaration {
  value: unknown;
}

function getFrequency(
  source: ClinicalDrug,
  schedule: ClinicalSchedule,
  document: ClinicalProtocolDocument,
  phase?: ClinicalPhase
): Frequency {
  const issues: string[] = [];
  const scopeSettings = (
    scope: ClinicalDrug | ClinicalSchedule,
    label: string
  ) => {
    const containers: Record<string, unknown>[] = [];
    if (
      own(scope, "administrationFrequency") &&
      scope.administrationFrequency !== undefined
    ) {
      if (record(scope.administrationFrequency))
        containers.push(scope.administrationFrequency);
      else
        issues.push(
          `${label}: administrationFrequency inválida explícita; não usar fallback.`
        );
    }
    const invalidContainer =
      own(scope, "administrationFrequency") &&
      scope.administrationFrequency !== undefined &&
      !record(scope.administrationFrequency);
    if (record(scope.frequency)) containers.push(scope.frequency);
    const settings: ClinicalAdministrationFrequency = Object.assign(
      {},
      ...containers
    );
    const pick = (key: string): ExplicitDeclaration | undefined => {
      const values = containers.filter(c => own(c, key)).map(c => c[key]);
      if (own(scope, key)) values.unshift(scope[key]);
      if (
        key === "administrationsPerDay" &&
        own(scope, "frequency") &&
        !record(scope.frequency) &&
        scope.frequency !== undefined
      )
        values.push(scope.frequency);
      if (values.some(v => !Object.is(v, values[0])))
        issues.push(
          `${label}: ${key} conflitante no mesmo escopo; nenhuma declaração escolhida.`
        );
      return values.length ? { value: values[0] } : undefined;
    };
    return {
      settings,
      frequency: invalidContainer
        ? { value: null }
        : pick("administrationsPerDay"),
      represents: pick("doseRepresents"),
      continuous: pick("continuousInfusion"),
    };
  };
  const base = scopeSettings(source, "Droga");
  const override = scopeSettings(schedule, "Agenda");
  const settings = { ...base.settings, ...override.settings };
  const raw = override.frequency ?? base.frequency;
  const frequency = raw?.value;
  if (!positiveInteger(frequency))
    issues.push(
      "Frequência administrationsPerDay ausente ou inválida; não aplicada frequência padrão."
    );
  const continuousValue = (override.continuous ?? base.continuous)?.value;
  if (continuousValue !== undefined && typeof continuousValue !== "boolean")
    issues.push("continuousInfusion inválido.");
  const policyRepresentation = (
    node: ClinicalProtocolDocument | ClinicalPhase | undefined
  ) => {
    if (!node || !own(node, "calculationPolicy")) return undefined;
    if (!record(node.calculationPolicy)) {
      issues.push(
        "calculationPolicy explícita inválida; não usar política padrão."
      );
      return undefined;
    }
    const value = node.calculationPolicy.doseRepresents;
    // Existing policy literally declares per-administration unless a more local base is marked.
    return own(node.calculationPolicy, "doseRepresents")
      ? {
          value:
            value === "per_administration_unless_explicitly_marked"
              ? "per_administration"
              : value,
        }
      : undefined;
  };
  const documentRepresentation = policyRepresentation(document);
  const phaseRepresentation = policyRepresentation(phase);
  // Stage > drug > selected phase policy > document policy > historical per-administration default.
  // A declaration object preserves explicit null instead of treating it as absent.
  const declarations = [
    override.represents,
    base.represents,
    phaseRepresentation,
    documentRepresentation,
  ];
  for (const declaration of declarations) {
    if (
      declaration &&
      ![
        "per_administration",
        "per_24_hours",
        "total_for_this_infusion",
      ].includes(String(declaration.value))
    )
      issues.push(
        "doseRepresents explícito inválido: não substituir null/valor desconhecido por fallback."
      );
  }
  const selectedRepresentation = declarations.find(
    value => value !== undefined
  );
  const rawRepresents = selectedRepresentation
    ? selectedRepresentation.value
    : "per_administration";
  const represents = typeof rawRepresents === "string" ? rawRepresents : "";
  if (
    !["per_administration", "per_24_hours", "total_for_this_infusion"].includes(
      represents
    )
  )
    issues.push(
      "doseRepresents desconhecido: não inferir dose por aplicação/diária."
    );
  if (settings.intervalHours !== undefined && settings.intervalHours !== null) {
    if (
      !finite(settings.intervalHours) ||
      settings.intervalHours <= 0 ||
      (positiveInteger(frequency) &&
        Math.abs(settings.intervalHours * frequency - 24) > 1e-9)
    )
      issues.push(
        "intervalHours inválido ou incompatível com administrationsPerDay."
      );
  }
  for (const key of Object.keys(settings)) {
    if (
      ![
        "administrationsPerDay",
        "continuousInfusion",
        "doseRepresents",
        "intervalHours",
      ].includes(key)
    )
      issues.push(`Frequência: ${key} não suportado.`);
  }
  return {
    frequency: positiveInteger(frequency) ? frequency : null,
    continuous: continuousValue === true,
    represents,
    issues,
  };
}

function calculate(
  dose: number | null,
  unit: string,
  source: ClinicalDrug,
  settings: Frequency,
  context: ClinicalContext
): {
  calculatedDose: number | null;
  dailyDose: number | null;
  resultUnit: string;
  issues: string[];
} {
  const issues: string[] = [];
  let total: number | null = dose;
  const normalized = unit.replace(/\s+/g, "").replace(/m2/g, "m²");
  let resultUnit = normalized.split("/")[0];
  if (dose === null)
    issues.push(
      "Dose da etapa ausente ou inválida; não substituída pela dose principal."
    );
  if (["mg/m²", "mcg/m²", "UI/m²"].includes(normalized)) {
    if (!finite(context.bsa) || context.bsa <= 0) {
      issues.push("bsa/SC explícita ausente ou inválida.");
      total = null;
    } else if (dose !== null) total = dose * context.bsa;
  } else if (["mg/kg", "mcg/kg", "UI/kg"].includes(normalized)) {
    if (!finite(context.weight) || context.weight <= 0) {
      issues.push("weight/peso explícito ausente ou inválido.");
      total = null;
    } else if (dose !== null) total = dose * context.weight;
  } else if (normalized.toUpperCase() === "AUC") {
    resultUnit = "mg";
    if (!validDose(context.gfrForCalvert)) {
      issues.push(
        "AUC/Calvert exige gfrForCalvert absoluto explícito (mL/min); eGFR indexada não é substituto."
      );
      total = null;
    } else if (dose !== null) total = dose * (context.gfrForCalvert + 25);
  } else if (!["mg", "mcg", "UI", "cGy"].includes(normalized)) {
    issues.push(
      `Unidade ${unit || "ausente"} não suportada; não converter por inferência.`
    );
    total = null;
  }
  const frequency = settings.frequency;
  let calculatedDose = total;
  let dailyDose: number | null = null;
  if (total !== null && frequency !== null) {
    if (settings.represents === "per_24_hours") {
      dailyDose = total;
      if (!settings.continuous) calculatedDose = total / frequency;
    } else if (settings.represents !== "total_for_this_infusion") {
      if (settings.continuous) {
        issues.push(
          "Infusão contínua sem dose total diária/por infusão explícita."
        );
        calculatedDose = null;
      } else dailyDose = total * frequency;
    }
    if (source.maxDose !== undefined && source.maxDose !== null) {
      if (
        !validDose(source.maxDose) ||
        (source.maxDoseUnit !== undefined && source.maxDoseUnit !== resultUnit)
      )
        issues.push("maxDose inválida ou com unidade incompatível.");
      else if (calculatedDose !== null) {
        calculatedDose = Math.min(calculatedDose, source.maxDose);
        if (dailyDose !== null)
          dailyDose = settings.continuous
            ? calculatedDose
            : calculatedDose * frequency;
      }
    }
  }
  if (
    (calculatedDose !== null && !finite(calculatedDose)) ||
    (dailyDose !== null && !finite(dailyDose))
  )
    issues.push("Resultado numérico não finito; cálculo bloqueado.");
  return { calculatedDose, dailyDose, resultUnit, issues };
}

/** Opaque stable identity; no name, filtered index, dose value or client-reported BSA. */
export function clinicalRowKey(identity: ClinicalRowIdentity): string {
  return JSON.stringify([
    "clinical-row-v1",
    identity.documentId,
    identity.phaseId ?? null,
    identity.phaseIndex ?? null,
    identity.drugLocation,
    identity.drugIndex,
    identity.scheduleIndex,
    identity.cycle,
    identity.day ?? null,
  ]);
}

function idle(source: ClinicalDrug): ResolvedClinicalDrug {
  return {
    source,
    dose: null,
    calculatedDose: null,
    dailyDose: null,
    frequency: null,
    resultUnit: source.doseUnit,
    days: "",
    issues: [],
    status: "not_scheduled",
    timeOrigin: source.timeOrigin ?? "cycle_day_one",
  };
}

/** Pure consultation/simulation. Never generates prescription orders or generic dose adjustments. */
export function resolveClinicalProtocol(
  document: ClinicalProtocolDocument,
  context: ClinicalContext
): ResolvedClinicalProtocol {
  const template = isActiveTemplateDocument(document);
  if (template) document = getTemplateExecutionDocument(document);
  const prescriptionIssues = getClinicalPrescriptionBlock(document);
  const selected = selectDrugs(document, context);
  const globalIssues = selectionIssues(document, "Documento");
  if (template) {
    if (Array.isArray(document.templateExecutionIssues))
      globalIssues.push(
        ...document.templateExecutionIssues.filter(
          (issue): issue is string => typeof issue === "string"
        )
      );
    if (
      document.referenceOnly === true ||
      document.calculationPolicy?.referenceOnly === true
    )
      globalIssues.push(
        "Documento referenceOnly: somente consulta, sem prescrição."
      );
  }
  if (!positiveInteger(context.cycle))
    globalIssues.push("cycle deve ser inteiro positivo explícito.");
  if (context.day !== undefined && !integer(context.day))
    globalIssues.push(
      "day deve ser inteiro finito na origem temporal declarada."
    );
  if (document.cycles !== null && !positiveInteger(document.cycles))
    globalIssues.push("Limite cycles inválido.");
  const allIssues = [
    ...prescriptionIssues,
    ...selected.issues,
    ...globalIssues,
  ];
  let cycleLength: number | null =
    selected.phase?.cycleLength ?? document.cycleLength;
  if (cycleLength !== null && !positiveInteger(cycleLength)) {
    allIssues.push("cycleLength inválido.");
    globalIssues.push("cycleLength inválido.");
    cycleLength = null;
  }
  const explicitLengths = new Set<number>();
  for (const { source, schedules } of selected.drugs) {
    for (const schedule of schedules ?? source.schedule ?? []) {
      if (
        inCycle(schedule, context.cycle) &&
        positiveInteger(schedule.cycleLength)
      )
        explicitLengths.add(schedule.cycleLength);
    }
  }
  if (explicitLengths.size === 1) cycleLength = Array.from(explicitLengths)[0];
  else if (explicitLengths.size > 1) {
    globalIssues.push("cycleLength conflitante nas agendas do ciclo.");
    allIssues.push("cycleLength conflitante nas agendas do ciclo.");
    cycleLength = null;
  }
  const rows: ResolvedClinicalDrug[] = [];
  for (const selectedDrug of selected.drugs) {
    const { source } = selectedDrug;
    const identify = (scheduleIndex: number | null) => {
      const rowIdentity: ClinicalRowIdentity = {
        documentId: document.id,
        phaseId: context.phaseId,
        phaseIndex: selected.phase
          ? document.phaseLibrary!.indexOf(selected.phase)
          : undefined,
        drugLocation: selectedDrug.drugLocation,
        drugIndex: selectedDrug.drugIndex,
        scheduleIndex,
        cycle: context.cycle,
        day: context.day,
      };
      return { rowIdentity, rowKey: clinicalRowKey(rowIdentity) };
    };
    const idleRow = () => ({ ...idle(source), ...identify(null) });
    const continuousSentinel =
      document.cycles === 999 &&
      record(document.cycleDefinition) &&
      document.cycleDefinition.kind === "continuous_treatment";
    if (
      !continuousSentinel &&
      positiveInteger(document.cycles) &&
      context.cycle > document.cycles
    ) {
      rows.push(idleRow());
      continue;
    }
    const drugIssues = [
      ...globalIssues,
      ...selectedDrug.issues,
      ...selectionIssues(source, `Droga ${source.id}`),
    ];
    if (template && source.dose === 0)
      drugIssues.push(`Droga ${source.id}: dose zero não é uma ordem válida.`);
    const schedules = selectedDrug.schedules ?? source.schedule ?? [];
    const eligibleSchedules = schedules.filter(
      schedule =>
        inCycle(schedule, context.cycle) &&
        !(
          schedule.phase &&
          context.phaseId &&
          schedule.phase !== context.phaseId
        )
    );
    const origins = new Set(
      eligibleSchedules.map(schedule =>
        canonicalOrigin(
          schedule.timeOrigin ??
            source.timeOrigin ??
            (selected.phase ? "phase_day_one" : "cycle_day_one")
        )
      )
    );
    if (origins.size > 1)
      drugIssues.push(
        "Agendas da mesma droga usam origens distintas sem contexto temporal para provar compatibilidade; não inferir offsets."
      );
    for (const schedule of schedules) {
      if (
        inCycle(schedule, context.cycle) &&
        !(
          schedule.phase &&
          context.phaseId &&
          schedule.phase !== context.phaseId
        )
      ) {
        drugIssues.push(...selectionIssues(schedule, `Agenda ${source.id}`));
      }
    }
    allIssues.push(...drugIssues);
    if (!schedules.length) {
      const row = idleRow();
      row.status = "blocked";
      row.issues = [
        ...drugIssues,
        "schedule vazio: dose principal não utilizada.",
      ];
      rows.push(row);
      continue;
    }
    const candidates: ResolvedClinicalDrug[] = [];
    const calendars: Calendar[] = [];
    for (
      let scheduleIndex = 0;
      scheduleIndex < schedules.length;
      scheduleIndex++
    ) {
      const schedule = schedules[scheduleIndex];
      if (
        !inCycle(schedule, context.cycle) &&
        cycleIssues(schedule).length === 0
      )
        continue;
      if (
        schedule.phase &&
        context.phaseId &&
        schedule.phase !== context.phaseId
      )
        continue;
      const value = calendar(schedule);
      const origin = canonicalOrigin(
        schedule.timeOrigin ??
          source.timeOrigin ??
          (selected.phase ? "phase_day_one" : "cycle_day_one")
      );
      const temporalIssues: string[] = [];
      if (!supportedOrigins.has(origin))
        temporalIssues.push(
          `timeOrigin ${origin} exige contexto temporal adicional não suportado.`
        );
      // Known treatment/transplant/phase origins never use cycleLength to truncate an absolute day.
      if (
        origins.size <= 1 &&
        context.day !== undefined &&
        integer(context.day) &&
        value.issues.length === 0 &&
        !includesDay(value, context.day)
      )
        continue;
      if (
        context.day !== undefined &&
        ["cycle_day_one", "cycle_start"].includes(origin) &&
        cycleLength !== null &&
        context.day > cycleLength &&
        value.issues.length === 0
      )
        continue;
      const settings = getFrequency(source, schedule, document, selected.phase);
      const dose =
        validDose(schedule.dose) && !(template && schedule.dose === 0)
          ? schedule.dose
          : null;
      const calculated = calculate(
        dose,
        schedule.doseUnit ?? source.doseUnit,
        source,
        settings,
        context
      );
      const issues = unique([
        ...drugIssues,
        ...scheduleIssues(schedule, context),
        ...value.issues,
        ...temporalIssues,
        ...settings.issues,
        ...calculated.issues,
      ]);
      calendars.push(value);
      candidates.push({
        ...identify(scheduleIndex),
        source,
        dose,
        frequency: settings.frequency,
        doseUnit: schedule.doseUnit ?? source.doseUnit,
        doseRepresents: settings.represents,
        continuousInfusion: settings.continuous,
        calculatedDose: issues.length ? null : calculated.calculatedDose,
        dailyDose: issues.length ? null : calculated.dailyDose,
        resultUnit: calculated.resultUnit,
        days: value.label,
        issues,
        status: issues.length ? "blocked" : "ready",
        timeOrigin: origin,
      });
    }
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        if (
          candidates[i].timeOrigin !== candidates[j].timeOrigin ||
          !calendarsOverlap(calendars[i], calendars[j])
        )
          continue;
        for (const row of [candidates[i], candidates[j]]) {
          row.status = "blocked";
          row.calculatedDose = null;
          row.dailyDose = null;
          row.issues.push(
            "Agendas sobrepostas para a mesma droga/dia; não escolher nem combinar etapas."
          );
        }
      }
    }
    if (candidates.length) rows.push(...candidates);
    else {
      const row = idleRow();
      if (drugIssues.length) {
        row.status = "blocked";
        row.issues = unique(drugIssues);
      }
      rows.push(row);
    }
  }
  for (const row of rows)
    allIssues.push(...row.issues.map(issue => `${row.source.name}: ${issue}`));
  const issues = unique(allIssues);
  return {
    rows,
    issues,
    cycleLength,
    prescriptionBlocked:
      issues.length > 0 || rows.some(row => row.status === "blocked"),
  };
}

/** Frequency is independent of scheduled days and must never fabricate a zero/default. */
export function formatClinicalFrequency(row: ResolvedClinicalDrug): string {
  const settings =
    row.source.administrationFrequency ??
    (record(row.source.frequency) ? row.source.frequency : undefined);
  const schedule = row.source.schedule?.find(
    s =>
      s.dose === row.dose &&
      canonicalOrigin(s.timeOrigin ?? row.timeOrigin) === row.timeOrigin &&
      calendar(s).label === row.days
  );
  const continuous =
    row.continuousInfusion ??
    schedule?.continuousInfusion ??
    schedule?.administrationFrequency?.continuousInfusion ??
    settings?.continuousInfusion;
  const represents =
    row.doseRepresents ??
    schedule?.doseRepresents ??
    schedule?.administrationFrequency?.doseRepresents ??
    settings?.doseRepresents ??
    row.source.doseRepresents;
  if (represents === "total_for_this_infusion")
    return "Dose total desta infusão (não é taxa)";
  if (continuous === true)
    return represents === "per_24_hours"
      ? "Infusão contínua — dose total de 24h (não é taxa)"
      : "Infusão contínua — confirmar dose total";
  if (!positiveInteger(row.frequency)) return "Frequência pendente";
  const interval = 24 / row.frequency;
  return `${row.frequency} administração(ões)/dia${Number.isInteger(interval) ? ` (${interval}/${interval}h)` : ""}${represents === "per_24_hours" ? " — dose diária dividida" : " — dose por administração"}`;
}
