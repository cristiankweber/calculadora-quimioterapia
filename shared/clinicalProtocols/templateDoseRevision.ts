export interface TemplateDoseField {
  path: string[];
  /** Other physical paths representing this exact same clinical field. */
  mirroredPaths: string[][];
  dose: number;
  unit: string;
  drugName: string;
  period: string;
}
export interface TemplateDoseChange {
  path: string[];
  dose: number;
}

type JsonObject = Record<string, unknown>;
const object = (v: unknown): v is JsonObject =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const own = (v: object, k: string) =>
  Object.prototype.hasOwnProperty.call(v, k);
const positive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
const unsafe = new Set(["__proto__", "constructor", "prototype"]);
// Entry allowlist, not a generic recursive search for the word 'dose'. Source/other metadata
// containing drug-like objects must never become writable, even inside extensions.
const clinicalContainers = new Set([
  "drugs",
  "phaseLibrary",
  "schedule",
  "scheduleOverrides",
  "support",
  "doses",
  "steps",
  "overrides",
  "interactionSchedules",
  "alternativeSchedule",
  "conditionalDoses",
  "conditionalExtraDays",
  "doseVariants",
  "ageDoseVariants",
  "agePerformanceVariants",
  "ageDoseTable",
  "ageTable",
  "doseLevelTable",
  "initialTitration",
  "taper",
  "arms",
  "treatmentArms",
  "programSelection",
  "optionalAntibody",
  "CNSProphylaxis",
  "CNSPositiveReplacement",
  "CNSDirectedTherapy",
  "mesnaSchedule",
  "mesnaPolicy",
  "rescueProtocol",
  "methotrexateRescueOrders",
  "supportProtocol",
  "infusionStages",
  "isatuximabInfusion",
  "methotrexate",
]);
const metadataKey = (key: string) =>
  unsafe.has(key) ||
  /source|original|archive|revision|audit|provenance|metadata|reference|envelope|checksum|sha256|hash|history|snapshot|notes?|transcription|description/i.test(
    key
  );
const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (object(v))
    return `{${Object.keys(v)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v) ?? "undefined";
};
const keyOf = (path: string[]) => JSON.stringify(path);
const printable = (v: unknown) =>
  Array.isArray(v)
    ? v.join(", ")
    : typeof v === "string" || typeof v === "number"
      ? String(v)
      : "";

/** Lists raw clinical dose fields; never promotes/replaces the source document or resolves choices.
 * Equal root/extensions mirrors are one editor row. A conflict blocks the whole revision.
 */
export function listTemplateDoseFields(document: unknown): TemplateDoseField[] {
  if (!object(document)) throw new Error("Documento clínico inválido.");
  const fields: TemplateDoseField[] = [];
  type Context = {
    drugName: string;
    unit: string;
    phase: string;
    days: string;
    cycles: string;
    origin: string;
  };
  const walk = (
    value: unknown,
    paths: string[][],
    context: Context,
    dictionary = false
  ): void => {
    if (Array.isArray(value)) {
      value.forEach((child, i) =>
        walk(
          child,
          paths.map(p => [...p, String(i)]),
          context,
          dictionary
        )
      );
      return;
    }
    if (!object(value)) return;
    if (["dose", "name", "id", "drugId", "drug"].some(k => own(value, k)))
      dictionary = false;
    const ext = object(value.extensions) ? value.extensions : {};
    const isPhase = paths[0].at(-2) === "phaseLibrary";
    const next: Context = {
      drugName: isPhase
        ? context.drugName
        : printable(
            value.name ?? value.drug ?? value.drugName ?? value.drugId
          ) || context.drugName,
      unit: own(value, "doseUnit")
        ? printable(value.doseUnit)
        : own(value, "unit")
          ? printable(value.unit)
          : context.unit,
      phase: isPhase
        ? printable(value.name ?? value.id)
        : printable(value.phase) || context.phase,
      days: own(value, "days")
        ? printable(value.days)
        : own(value, "day")
          ? printable(value.day)
          : own(value, "dayFrom") || own(value, "dayTo")
            ? `${printable(value.dayFrom)}–${printable(value.dayTo)}`
            : context.days,
      cycles:
        own(value, "cycleFrom") || own(value, "cycleTo")
          ? `${printable(value.cycleFrom)}–${printable(value.cycleTo)}`
          : context.cycles,
      origin: own(value, "timeOrigin")
        ? printable(value.timeOrigin)
        : context.origin,
    };
    // Only named clinical containers may enter from a document/drug/phase. Dictionary
    // keys inside them (e.g. interactionSchedules.posaconazole) may be arbitrary.
    const allowed = (key: string) =>
      !metadataKey(key) &&
      (key === "dose" || clinicalContainers.has(key) || dictionary);
    const keys = Array.from(
      new Set([...Object.keys(value), ...Object.keys(ext)])
    );
    for (const key of keys) {
      if (
        key === "extensions" ||
        !allowed(key) ||
        (key === "dose" && paths[0].length === 0)
      )
        continue;
      const root = own(value, key);
      const extension = own(ext, key);
      if (root && extension && canonical(value[key]) !== canonical(ext[key]))
        throw new Error(
          `Conflito explícito entre raiz e extensions em ${[...paths[0], key].join(".")}; revise o JSON integral.`
        );
      const child = root ? value[key] : ext[key];
      const childPaths = paths.flatMap(p => [
        ...(root ? [[...p, key]] : []),
        ...(extension ? [[...p, "extensions", key]] : []),
      ]);
      if (key === "dose") {
        if (positive(child))
          fields.push({
            path: childPaths[0],
            mirroredPaths: childPaths.slice(1),
            dose: child,
            unit: next.unit || "Unidade não declarada",
            drugName: next.drugName || "Medicamento não identificado",
            period: [
              next.phase && `Fase: ${next.phase}`,
              next.days && `Dias: ${next.days}`,
              next.cycles && `Ciclos: ${next.cycles}`,
              next.origin && `Origem: ${next.origin}`,
              paths[0].includes("schedule") ? "Agenda" : "Dose-padrão",
            ]
              .filter(Boolean)
              .join(" · "),
          });
      } else if (object(child) || Array.isArray(child)) {
        // A clinical node has its own name/id/dose; only actual dictionary wrappers
        // propagate arbitrary keys, preventing drug metadata from becoming editable.
        const isDictionary =
          key === "interactionSchedules" ||
          (dictionary &&
            object(child) &&
            !["dose", "name", "id", "drugId", "drug"].some(k => own(child, k)));
        walk(child, childPaths, next, isDictionary);
      }
    }
  };
  walk(document, [[]], {
    drugName: "",
    unit: "",
    phase: "",
    days: "",
    cycles: "",
    origin: "",
  });
  return fields;
}

/** Applies only paths rediscovered from current state. Input remains unchanged on success/error. */
export function applyTemplateDoseChanges<T>(
  document: T,
  changes: TemplateDoseChange[]
): T {
  if (!Array.isArray(changes) || changes.length === 0)
    throw new Error("Informe ao menos uma alteração de dose.");
  const allowed = new Map<string, TemplateDoseField>();
  for (const field of listTemplateDoseFields(document))
    for (const path of [field.path, ...field.mirroredPaths])
      allowed.set(keyOf(path), field);
  const seen = new Set<string>();
  const edits: { field: TemplateDoseField; dose: number }[] = [];
  for (const change of changes) {
    if (
      !object(change) ||
      !Array.isArray(change.path) ||
      !change.path.length ||
      change.path.some(p => typeof p !== "string" || !p || unsafe.has(p)) ||
      !positive(change.dose)
    )
      throw new Error(
        "Alteração de dose inválida: path seguro e dose numérica finita positiva obrigatórios."
      );
    const field = allowed.get(keyOf(change.path));
    if (!field)
      throw new Error(
        "Path não permitido ou dose ausente/não numérica no documento atual."
      );
    const logicalPath = keyOf(field.path);
    if (seen.has(logicalPath))
      throw new Error(
        "Paths duplicados, inclusive espelhos, não são permitidos."
      );
    seen.add(logicalPath);
    edits.push({ field, dose: change.dose });
  }
  if (edits.every(e => e.field.dose === e.dose))
    throw new Error("Nenhuma dose foi alterada.");
  const output = structuredClone(document);
  for (const { field, dose } of edits)
    for (const path of [field.path, ...field.mirroredPaths]) {
      let node: any = output;
      for (const segment of path.slice(0, -1)) {
        if (!own(node, segment))
          throw new Error("Path não pertence ao documento.");
        node = node[segment];
      }
      node[path.at(-1)!] = dose;
    }
  return output;
}
