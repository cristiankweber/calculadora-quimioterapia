import { listTemplateDoseFields } from "./templateDoseRevision";

export interface TemplateClinicalField {
  path: string[];
  mirroredPaths: string[][];
  label: string;
  section:
    | "general"
    | "drugs"
    | "administration"
    | "prophylaxis"
    | "antiemetics"
    | "nursing"
    | "alerts"
    | "adjustments";
  kind: "text" | "textList" | "number" | "select" | "days";
  value: unknown;
  options?: Array<{ value: string; label: string }>;
  nullable?: boolean;
}
export interface TemplateClinicalChange {
  path: string[];
  value: unknown;
}
type Obj = Record<string, unknown>;
type Field = TemplateClinicalField & {
  key: string;
  frequencyScopes?: string[][];
};
type Node = { value: Obj; paths: string[][]; label: string };
const object = (v: unknown): v is Obj =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const own = (v: object, k: string) =>
  Object.prototype.hasOwnProperty.call(v, k);
const unsafe = new Set(["__proto__", "constructor", "prototype"]);
const positive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
const keyOf = (p: string[]) => JSON.stringify(p);
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : object(v)
      ? `{${Object.keys(v)
          .sort()
          .map(k => `${JSON.stringify(k)}:${canonical(v[k])}`)
          .join(",")}}`
      : (JSON.stringify(v) ?? "undefined");
const options = (values: string[]) =>
  values.map(value => ({ value, label: value }));
const units = options([
  "mg/m²",
  "mg/m2",
  "mg/kg",
  "mg",
  "AUC",
  "mcg/kg",
  "mcg/m²",
  "mcg/m2",
  "mcg",
  "cGy",
  "UI/m²",
  "UI/m2",
  "UI",
  "UI/kg",
]);
const origins = options([
  "cycle_day_one",
  "transplant_day_zero",
  "phase_day_one",
  "cycle_start",
  "treatment_start",
  "induction_day_one",
  "protocol_I_day_one",
  "protocol_II_day_one",
  "maintenance_start",
]);
const representations = options([
  "per_administration",
  "per_24_hours",
  "total_for_this_infusion",
]);
const risks = options(["high", "moderate", "low", "minimal"]);
const boolOptions = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

/** Reject invalid JSON before traversal/clone, including pollution in uneditable source archives. */
function assertJson(v: unknown, ancestors = new Set<object>()): void {
  if (v === null || typeof v === "string" || typeof v === "boolean") return;
  if (typeof v === "number" && Number.isFinite(v)) return;
  if (typeof v !== "object" || v === null || ancestors.has(v))
    throw Error("Documento/valor deve ser JSON seguro, finito e sem ciclos.");
  const proto = Object.getPrototypeOf(v);
  if (!Array.isArray(v) && proto !== Object.prototype && proto !== null)
    throw Error("Protótipo não permitido.");
  ancestors.add(v);
  for (const [k, child] of Object.entries(v)) {
    if (unsafe.has(k)) throw Error("Chave insegura/protótipo não permitido.");
    assertJson(child, ancestors);
  }
  ancestors.delete(v);
}
function readPath(document: unknown, path: string[]): unknown {
  let value = document;
  for (const k of path) {
    if (!object(value) && !Array.isArray(value)) return undefined;
    if (!own(value, k)) return undefined;
    value = (value as Obj)[k];
  }
  return value;
}

/** Known clinical nodes only. This is not a recursive JSON editor. */
function catalogue(document: unknown): {
  fields: Field[];
  defaults: Map<string, unknown>;
  arrayLengths: Map<string, number>;
} {
  assertJson(document);
  if (!object(document)) throw Error("Documento clínico inválido.");
  const fields: Field[] = [];
  const defaults = new Map<string, unknown>();
  const arrayLengths = new Map<string, number>();
  const discovered = new Set<string>();
  const child = (
    node: Node,
    key: string,
    canonicalRoot = false
  ): { value: unknown; paths: string[][] } => {
    const ext = object(node.value.extensions) ? node.value.extensions : {};
    const root = own(node.value, key),
      extension = own(ext, key);
    if (root && extension && canonical(node.value[key]) !== canonical(ext[key]))
      throw Error(
        `Conflito explícito entre raiz e extensions em ${[...node.paths[0], key].join(".")}.`
      );
    const value = root ? node.value[key] : ext[key];
    const paths = node.paths.flatMap(p => [
      ...(root || canonicalRoot || !extension ? [[...p, key]] : []),
      ...(extension ? [[...p, "extensions", key]] : []),
    ]);
    return { value, paths };
  };
  const add = (
    node: Node,
    key: string,
    label: string,
    section: Field["section"],
    kind: Field["kind"],
    opts?: Field["options"],
    canonicalRoot = false
  ) => {
    const item = child(node, key, canonicalRoot);
    // Never overwrite an object/list with text, or flatten a pharmacy product-specific structure.
    if (item.value !== undefined && item.value !== null) {
      if (kind === "text" && typeof item.value !== "string") return;
      if (
        kind === "textList" &&
        (!Array.isArray(item.value) ||
          !item.value.every(v => typeof v === "string"))
      )
        return;
      if (kind === "number" && typeof item.value !== "number") return;
      if (
        kind === "days" &&
        typeof item.value !== "string" &&
        !Array.isArray(item.value)
      )
        return;
    }
    if (discovered.has(keyOf(item.paths[0]))) return;
    discovered.add(keyOf(item.paths[0]));
    const f: Field = {
      path: item.paths[0],
      mirroredPaths: item.paths.slice(1),
      key,
      label: `${node.label}${node.label ? " · " : ""}${label}`,
      section,
      kind,
      value:
        item.value === undefined
          ? kind === "textList"
            ? []
            : kind === "text" || kind === "days" || kind === "select"
              ? ""
              : null
          : structuredClone(item.value),
      ...(opts ? { options: opts } : {}),
      ...(item.value === null ? { nullable: true } : {}),
    };
    fields.push(f);
    return f;
  };
  const root: Node = { value: document, paths: [[]], label: "" };
  for (const [key, label, section] of [
    ["prophylaxis", "Profilaxias", "prophylaxis"],
    ["nursingCare", "Cuidados de enfermagem", "nursing"],
    ["specialAlerts", "Alertas especiais", "alerts"],
    ["renalAdjustments", "Ajustes renais (texto informativo)", "adjustments"],
    [
      "hepaticAdjustments",
      "Ajustes hepáticos (texto informativo)",
      "adjustments",
    ],
    [
      "hematologicAdjustments",
      "Ajustes hematológicos (texto informativo)",
      "adjustments",
    ],
  ] as const)
    add(root, key, label, section, "textList", undefined, true);
  add(
    root,
    "emetogenicRisk",
    "Risco emetogênico",
    "general",
    "select",
    risks,
    true
  );

  const anti = child(root, "antiemetics", true);
  if (anti.value !== undefined && !object(anti.value))
    throw Error(
      "Antiemese estruturada inválida; não sobrescrever conteúdo existente."
    );
  const antiDefault = {
    day1: [],
    days2to4: [],
    rescue: [],
    alerts: [],
    timeReference: "",
    ...(object(anti.value) ? anti.value : {}),
  };
  for (const p of anti.paths) defaults.set(keyOf(p), antiDefault);
  const antiNode: Node = {
    value: object(anti.value) ? anti.value : {},
    paths: anti.paths,
    label: "Antiemese explícita",
  };
  for (const [key, label] of [
    ["day1", "Dia 1"],
    ["days2to4", "Dias 2–4"],
    ["rescue", "Resgate"],
    ["alerts", "Alertas"],
  ] as const)
    add(antiNode, key, label, "antiemetics", "textList");
  add(antiNode, "timeReference", "Referência temporal", "antiemetics", "text");

  const medications: { id: string; name: string }[] = [];
  const frequency = (node: Node): void => {
    const containers: Node[] = [];
    for (const key of ["administrationFrequency", "frequency"]) {
      const c = child(node, key);
      if (object(c.value))
        containers.push({ value: c.value, paths: c.paths, label: node.label });
      else if (key === "administrationFrequency" && c.value === undefined) {
        // Do not add a competing declaration when scalar/other frequency is already explicit.
        if (
          !own(node.value, "frequency") &&
          !own(node.value, "administrationsPerDay")
        )
          containers.push({ value: {}, paths: c.paths, label: node.label });
      } else if (
        key === "frequency" &&
        (typeof c.value === "number" || c.value === null)
      ) {
        const f = add(
          node,
          key,
          "Administrações/dia",
          "administration",
          "number"
        );
        if (f) f.frequencyScopes = node.paths;
      }
    }
    const logical = new Map<string, Field>();
    for (const scope of [node, ...containers])
      for (const [key, label, kind, opts] of [
        ["administrationsPerDay", "Administrações/dia", "number", undefined],
        ["intervalHours", "Intervalo (horas)", "number", undefined],
        ["continuousInfusion", "Infusão contínua", "select", boolOptions],
        ["doseRepresents", "Dose representa", "select", representations],
      ] as const) {
        if (
          scope === node &&
          !child(node, key).paths.some(p => readPath(document, p) !== undefined)
        )
          continue;
        const item = child(scope, key);
        const known = logical.get(key);
        if (known && item.value !== undefined) {
          if (
            known.value !== undefined &&
            canonical(known.value) !== canonical(item.value)
          )
            throw Error(`Conflito de frequência em ${node.label}.`);
          known.mirroredPaths.push(...item.paths);
          continue;
        }
        // If another alias is already explicit, do not introduce an empty competing value.
        if (known && item.value === undefined) continue;
        const f = add(
          scope,
          key,
          label,
          "administration",
          kind,
          opts as Field["options"]
        );
        if (f) {
          f.frequencyScopes = node.paths;
          logical.set(key, f);
        }
      }
    const scalar = fields.find(
      f => f.path.join(".") === [...node.paths[0], "frequency"].join(".")
    );
    const perDay = logical.get("administrationsPerDay");
    if (scalar && perDay) {
      if (canonical(scalar.value) !== canonical(perDay.value))
        throw Error(`Conflito de frequência em ${node.label}.`);
      perDay.mirroredPaths.push(scalar.path, ...scalar.mirroredPaths);
      fields.splice(fields.indexOf(scalar), 1);
    }
  };
  const visitStage = (node: Node) => {
    add(
      node,
      "days",
      "Dias da etapa (sem inferência)",
      "administration",
      "days"
    );
    add(
      node,
      "timeOrigin",
      "Origem temporal",
      "administration",
      "select",
      origins
    );
    add(
      node,
      "doseUnit",
      "Unidade da etapa",
      "administration",
      "select",
      units
    );
    for (const key of ["observations", "calculationNote"])
      add(
        node,
        key,
        key === "observations"
          ? "Observações"
          : "Nota de cálculo (texto; não implementa fórmula)",
        "administration",
        "text"
      );
    frequency(node);
  };
  const visitDrug = (node: Node) => {
    if (
      typeof node.value.id === "string" &&
      typeof node.value.name === "string"
    ) {
      if (!medications.some(m => m.id === node.value.id))
        medications.push({ id: node.value.id, name: node.value.name });
    }
    for (const [key, label, section] of [
      ["observations", "Observações", "drugs"],
      ["route", "Via", "drugs"],
      ["days", "Dias (texto declarado)", "drugs"],
      ["renalAdjustment", "Ajuste renal (texto informativo)", "adjustments"],
      [
        "hepaticAdjustment",
        "Ajuste hepático (texto informativo)",
        "adjustments",
      ],
      [
        "calculationNote",
        "Nota de cálculo (texto; não implementa fórmula)",
        "drugs",
      ],
    ] as const)
      add(node, key, label, section, "text");
    add(node, "doseUnit", "Unidade da dose", "drugs", "select", units);
    add(
      node,
      "timeOrigin",
      "Origem temporal",
      "administration",
      "select",
      origins
    );
    add(node, "emetogenicRisk", "Risco emetogênico", "drugs", "select", risks);
    const max = child(node, "maxDose");
    if (positive(max.value))
      add(node, "maxDose", "Dose máxima declarada", "drugs", "number");
    frequency(node);
    const schedule = child(node, "schedule");
    if (schedule.value !== undefined && !Array.isArray(schedule.value))
      throw Error("Agenda inválida; não sobrescrever.");
    if (Array.isArray(schedule.value))
      schedule.value.forEach((s, i) => {
        if (!object(s)) throw Error("Etapa inválida.");
        visitStage({
          value: s,
          paths: schedule.paths.map(p => [...p, String(i)]),
          label: `${node.label} · Etapa ${i + 1}`,
        });
      });
  };
  const visitDrugs = (node: Node) => {
    const drugs = child(node, "drugs");
    if (drugs.value !== undefined && !Array.isArray(drugs.value))
      throw Error("Medicamentos inválidos.");
    if (Array.isArray(drugs.value))
      drugs.value.forEach((d, i) => {
        if (!object(d)) throw Error("Medicamento inválido.");
        visitDrug({
          value: d,
          paths: drugs.paths.map(p => [...p, String(i)]),
          label: `${node.label}${node.label ? " · " : ""}${typeof d.name === "string" ? d.name : `Medicamento ${i + 1}`}`,
        });
      });
  };
  visitDrugs(root);
  const phases = child(root, "phaseLibrary");
  if (phases.value !== undefined && !Array.isArray(phases.value))
    throw Error("Biblioteca de fases inválida.");
  if (Array.isArray(phases.value))
    phases.value.forEach((p, i) => {
      if (!object(p)) throw Error("Fase inválida.");
      const node = {
        value: p,
        paths: phases.paths.map(path => [...path, String(i)]),
        label: `Fase ${String(p.name ?? p.id ?? i + 1)}`,
      };
      visitDrugs(node);
      const overrides = child(node, "scheduleOverrides");
      if (Array.isArray(overrides.value))
        overrides.value.forEach((s, j) => {
          if (object(s))
            visitStage({
              value: s,
              paths: overrides.paths.map(path => [...path, String(j)]),
              label: `${node.label} · Agenda ${j + 1}`,
            });
        });
    });
  for (const f of listTemplateDoseFields(document))
    fields.push({
      path: f.path,
      mirroredPaths: f.mirroredPaths,
      label: `${f.drugName} · Dose (${f.unit}) · ${f.period}`,
      section: "drugs",
      kind: "number",
      value: f.dose,
      key: "dose",
    });

  const pharmacy = child(root, "dilutionInfo", true);
  if (pharmacy.value !== undefined && !Array.isArray(pharmacy.value))
    throw Error("Farmacotécnica inválida; não sobrescrever.");
  const entries: unknown[] = Array.isArray(pharmacy.value)
    ? structuredClone(pharmacy.value)
    : [];
  if (entries.some(e => !object(e)))
    throw Error("Entrada farmacotécnica inválida.");
  for (const drug of medications) {
    // Match by stable ID; a legacy name-only match is accepted only when unambiguous.
    const idMatches = entries.filter(e => object(e) && e.drugId === drug.id);
    if (idMatches.length > 1)
      throw Error("Farmacotécnica duplicada para o mesmo identificador.");
    if (idMatches.length) continue;
    const nameMatches = entries.filter(
      e => object(e) && !e.drugId && e.drugName === drug.name
    );
    if (
      nameMatches.length > 1 ||
      (nameMatches.length &&
        medications.filter(m => m.name === drug.name).length > 1)
    )
      throw Error("Vínculo farmacotécnico ambíguo.");
    if (!nameMatches.length)
      entries.push({ drugId: drug.id, drugName: drug.name });
  }
  // Used only to fill safe missing array parents/positions in a submitted allowed path.
  for (const p of pharmacy.paths) {
    defaults.set(keyOf(p), entries);
    arrayLengths.set(
      keyOf(p),
      Array.isArray(pharmacy.value) ? pharmacy.value.length : 0
    );
  }
  entries.forEach((e, i) => {
    if (!object(e)) return;
    const node = {
      value: e,
      paths: pharmacy.paths.map(p => [...p, String(i)]),
      label: `Farmacotécnica · ${String(e.drugName ?? e.drugId ?? i + 1)}`,
    };
    for (const [key, label] of [
      ["diluent", "Diluente"],
      ["volume", "Volume"],
      ["infusionTime", "Tempo de infusão"],
      ["stability", "Estabilidade"],
      ["specialInstructions", "Instruções especiais"],
    ] as const)
      add(node, key, label, "administration", "text");
    if (own(e, "status") && own(e, "validationStatus")) {
      if (canonical(e.status) !== canonical(e.validationStatus))
        throw Error("Conflito de status farmacotécnico.");
      const f = add(
        node,
        "validationStatus",
        "Status de validação",
        "administration",
        "text"
      );
      if (f) f.mirroredPaths.push(...node.paths.map(p => [...p, "status"]));
    } else
      add(
        node,
        own(e, "status") ? "status" : "validationStatus",
        "Status de validação (declarado; não homologa)",
        "administration",
        "text"
      );
  });
  return { fields, defaults, arrayLengths };
}

/** Empty text/list means not informed; it is not an assertion of absence or a recommendation. */
export function listTemplateClinicalFields(
  document: unknown
): TemplateClinicalField[] {
  return catalogue(document).fields.map(
    ({ key: _key, frequencyScopes: _scopes, ...field }) => field
  );
}
function validateValue(f: Field, input: unknown): unknown {
  if (input === null && f.nullable && f.key !== "dose" && f.key !== "maxDose")
    return null;
  if (f.kind === "text") {
    if (
      typeof input !== "string" ||
      input.length > 20000 ||
      (f.key === "route" && !input.trim())
    )
      throw Error("Texto clínico inválido.");
  } else if (f.kind === "textList") {
    if (
      !Array.isArray(input) ||
      input.length > 2000 ||
      !input.every(
        v => typeof v === "string" && !!v.trim() && v.length <= 20000
      )
    )
      throw Error(
        "Lista clínica deve conter textos não vazios; use [] para não informado."
      );
  } else if (f.kind === "number") {
    if (
      !positive(input) ||
      (["administrationsPerDay", "frequency"].includes(f.key) &&
        !Number.isSafeInteger(input))
    )
      throw Error(
        "Número positivo finito obrigatório; administrações/dia deve ser inteiro."
      );
  } else if (f.kind === "days") {
    if (typeof input === "string") {
      if (!input.trim() || input.length > 20000) throw Error("Dias inválidos.");
    } else if (
      !Array.isArray(input) ||
      !input.length ||
      input.length > 10000 ||
      !input.every(Number.isSafeInteger) ||
      new Set(input).size !== input.length
    )
      throw Error("Dias devem ser texto ou lista de inteiros distintos.");
  } else if (f.kind === "select") {
    if (f.key === "continuousInfusion") {
      if (typeof input === "boolean") return input;
      if (input === "true" || input === "false") return input === "true";
      throw Error("Infusão contínua deve ser booleano ou select true/false.");
    }
    if (typeof input !== "string" || !f.options?.some(o => o.value === input))
      throw Error("Opção clínica não reconhecida.");
  }
  return input;
}
function validateFrequency(scope: unknown, inherited?: unknown): void {
  if (!object(scope)) return;
  const ext = object(scope.extensions) ? scope.extensions : {};
  const effective = { ...ext, ...scope };
  const containers = [
    effective,
    ...["administrationFrequency", "frequency"].flatMap(k =>
      object(effective[k]) ? [effective[k] as Obj] : []
    ),
  ];
  const pick = (k: string) => {
    const values = containers.filter(c => own(c, k)).map(c => c[k]);
    if (
      k === "administrationsPerDay" &&
      own(effective, "frequency") &&
      !object(effective.frequency)
    )
      values.push(effective.frequency);
    if (values.some(v => canonical(v) !== canonical(values[0])))
      throw Error("Conflito de frequência no mesmo escopo.");
    return values[0];
  };
  const parent = object(inherited)
    ? {
        ...(object(inherited.extensions) ? inherited.extensions : {}),
        ...inherited,
      }
    : {};
  const base = (key: string) => {
    const containers = [
      parent,
      ...["administrationFrequency", "frequency"].flatMap(k =>
        object(parent[k]) ? [parent[k] as Obj] : []
      ),
    ];
    const values = containers.filter(c => own(c, key)).map(c => c[key]);
    if (
      key === "administrationsPerDay" &&
      own(parent, "frequency") &&
      !object(parent.frequency)
    )
      values.push(parent.frequency);
    if (values.some(v => canonical(v) !== canonical(values[0])))
      throw Error("Conflito de frequência herdada.");
    return values[0];
  };
  const localN = pick("administrationsPerDay"),
    localInterval = pick("intervalHours");
  const n = localN !== undefined ? localN : base("administrationsPerDay"),
    interval =
      localInterval !== undefined ? localInterval : base("intervalHours");
  if (
    n !== undefined &&
    n !== null &&
    (!positive(n) || !Number.isSafeInteger(n))
  )
    throw Error("Frequência inválida.");
  if (
    interval !== undefined &&
    interval !== null &&
    (!positive(interval) || (positive(n) && Math.abs(n * interval - 24) > 1e-9))
  )
    throw Error("Intervalo incompatível com frequência declarada.");
  pick("continuousInfusion");
  pick("doseRepresents");
}

/** Changes are rediscovered from the current document, never arbitrary JSON updates. */
export function applyTemplateClinicalChanges<T>(
  document: T,
  changes: TemplateClinicalChange[]
): T {
  if (!Array.isArray(changes) || !changes.length || changes.length > 2000)
    throw Error("Informe ao menos uma alteração clínica válida.");
  const { fields, defaults, arrayLengths } = catalogue(document);
  const allowed = new Map<string, Field>();
  for (const f of fields)
    for (const p of [f.path, ...f.mirroredPaths]) allowed.set(keyOf(p), f);
  const seen = new Set<string>();
  const edits: { field: Field; value: unknown }[] = [];
  for (const change of changes) {
    assertJson(change);
    if (
      !object(change) ||
      Object.keys(change).some(k => !["path", "value"].includes(k)) ||
      !own(change, "value") ||
      !Array.isArray(change.path) ||
      !change.path.length ||
      change.path.some(p => typeof p !== "string" || !p || unsafe.has(p))
    )
      throw Error("Alteração clínica/path inválidos.");
    const f = allowed.get(keyOf(change.path));
    if (!f)
      throw Error(
        "Path não permitido ou campo protegido/ausente no documento atual."
      );
    if (seen.has(keyOf(f.path)))
      throw Error("Paths duplicados, inclusive espelhos, não são permitidos.");
    seen.add(keyOf(f.path));
    edits.push({ field: f, value: validateValue(f, change.value) });
  }
  if (edits.every(e => canonical(e.field.value) === canonical(e.value)))
    throw Error("Nenhuma alteração clínica foi informada.");
  const output = structuredClone(document);
  const write = (path: string[], value: unknown) => {
    let node: any = output;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      const prefix = path.slice(0, i + 1);
      if (!own(node, k)) {
        if (Array.isArray(node)) {
          const parentDefault = defaults.get(keyOf(path.slice(0, i)));
          if (!Array.isArray(parentDefault) || !/^\d+$/.test(k))
            throw Error("Índice de materialização inválido.");
          for (let j = node.length; j <= Number(k); j++)
            node.push(structuredClone(parentDefault[j]));
        } else {
          const value = defaults.get(keyOf(prefix));
          node[k] =
            value !== undefined
              ? structuredClone(
                  Array.isArray(value)
                    ? value.slice(0, arrayLengths.get(keyOf(prefix)) ?? 0)
                    : value
                )
              : /^\d+$/.test(path[i + 1])
                ? []
                : {};
        }
      }
      node = node[k];
      if (!object(node) && !Array.isArray(node))
        throw Error("Pai clínico inválido; não substituir conteúdo explícito.");
    }
    node[path.at(-1)!] = structuredClone(value);
  };
  // Only when antiemesis is explicitly edited, materialize the canonical object and all
  // existing mirrors from the same safe default, preserving archival/product extras.
  if (edits.some(e => e.field.section === "antiemetics")) {
    for (const [key, value] of Array.from(defaults.entries())) {
      const path: string[] = JSON.parse(key);
      if (path.at(-1) === "antiemetics") write(path, value);
    }
  }
  for (const { field, value } of edits)
    for (const path of [field.path, ...field.mirroredPaths]) write(path, value);
  for (const { field } of edits)
    for (const p of field.frequencyScopes ?? []) {
      const scheduleIndex = p.lastIndexOf("schedule");
      const drugPath =
        scheduleIndex >= 0
          ? p.slice(
              0,
              scheduleIndex - (p[scheduleIndex - 1] === "extensions" ? 1 : 0)
            )
          : undefined;
      validateFrequency(
        readPath(output, p),
        drugPath ? readPath(output, drugPath) : undefined
      );
    }
  // Structural aliases must remain equivalent after optional-parent creation too.
  catalogue(output);
  return output;
}
