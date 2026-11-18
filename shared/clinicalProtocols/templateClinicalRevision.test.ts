import { describe, expect, it } from "vitest";
import library from "../data/clinicalProtocols.json";
import {
  applyTemplateClinicalChanges,
  listTemplateClinicalFields,
} from "./templateClinicalRevision";

const document = (): any => ({
  name: "Teste",
  indication: "Somente software",
  drugs: [
    {
      id: "a",
      name: "Agente A",
      dose: 10,
      doseUnit: "mg",
      route: "IV",
      days: "1",
      maxDose: 100,
      administrationFrequency: {
        administrationsPerDay: 2,
        intervalHours: 12,
        continuousInfusion: false,
        doseRepresents: "per_administration",
      },
      schedule: [
        {
          dose: 5,
          days: [1, 2],
          timeOrigin: "cycle_day_one",
          phase: "induction",
          unknown: { retained: true },
        },
        { dose: null, days: [3], doseDecision: "Pendente" },
      ],
      extensions: {
        schedule: [
          {
            dose: 5,
            days: [1, 2],
            timeOrigin: "cycle_day_one",
            phase: "induction",
            unknown: { retained: true },
          },
          { dose: null, days: [3], doseDecision: "Pendente" },
        ],
      },
    },
  ],
  phaseLibrary: [
    {
      id: "p",
      name: "Fase",
      drugs: [
        {
          id: "b",
          name: "Agente B",
          dose: 2,
          doseUnit: "mg/kg",
          route: "VO",
          days: "2",
        },
      ],
    },
  ],
  extensions: {
    phaseLibrary: [
      {
        id: "p",
        name: "Fase",
        drugs: [
          {
            id: "b",
            name: "Agente B",
            dose: 2,
            doseUnit: "mg/kg",
            route: "VO",
            days: "2",
          },
        ],
      },
    ],
  },
  dilutionInfo: [
    {
      drugId: "a",
      drugName: "Agente A",
      diluent: "original",
      validationStatus: "pending",
      source: { preserved: true },
      unknown: 42,
    },
  ],
  calculationPolicy: { automaticPrescriptionAllowed: false },
  review: { requiresMedicalApproval: true },
  sourceDocument: { drugs: [{ dose: 999 }], prophylaxis: ["Fonte"] },
  archive: { drugs: [{ dose: 888 }] },
  dose: 123,
});
const edit = (path: string[], value: unknown) => ({ path, value });
const field = (d: unknown, path: string[]) =>
  listTemplateClinicalFields(d).find(
    f => JSON.stringify(f.path) === JSON.stringify(path)
  );

describe("safe clinical template editing", () => {
  it("discovers numeric doses and addable clinical fields, but never identities, archives, gates or null decisions", () => {
    const fields = listTemplateClinicalFields(document());
    expect(
      fields.filter(f => f.path.at(-1) === "dose").map(f => f.value)
    ).toEqual([10, 5, 2]);
    expect(field(document(), ["drugs", "0", "observations"])).toMatchObject({
      kind: "text",
      section: "drugs",
      value: "",
    });
    expect(field(document(), ["drugs", "0", "maxDose"])).toMatchObject({
      kind: "number",
      value: 100,
    });
    expect(
      field(document(), ["phaseLibrary", "0", "drugs", "0", "renalAdjustment"])
        ?.mirroredPaths
    ).toEqual([
      ["extensions", "phaseLibrary", "0", "drugs", "0", "renalAdjustment"],
    ]);
    expect(
      fields.some(f =>
        ["sourceDocument", "archive", "calculationPolicy", "review"].some(p =>
          f.path.includes(p)
        )
      )
    ).toBe(false);
    expect(
      fields.some(
        f =>
          f.path.at(-1) === "id" ||
          f.path.join(".") === "dose" ||
          f.path.join(".") === "drugs.0.name"
      )
    ).toBe(false);
    expect(
      field(document(), ["phaseLibrary", "0", "drugs", "0", "maxDose"])
    ).toBeUndefined();
  });
  it("edits clinical text/day/unit/dose while retaining every other stage property and mirror", () => {
    const d = document();
    const before = structuredClone(d);
    const revised = applyTemplateClinicalChanges(d, [
      edit(["drugs", "0", "route"], "SC"),
      edit(["drugs", "0", "observations"], "Declarado"),
      edit(["drugs", "0", "schedule", "0", "days"], [-1, 0, 1]),
      edit(["drugs", "0", "schedule", "0", "dose"], 7),
      edit(["drugs", "0", "schedule", "0", "doseUnit"], "mcg"),
    ]);
    expect(revised.drugs[0].schedule[0]).toEqual({
      dose: 7,
      days: [-1, 0, 1],
      doseUnit: "mcg",
      timeOrigin: "cycle_day_one",
      phase: "induction",
      unknown: { retained: true },
    });
    expect(revised.drugs[0].extensions.schedule).toEqual(
      revised.drugs[0].schedule
    );
    expect(revised.drugs[0].schedule[1]).toEqual(before.drugs[0].schedule[1]);
    expect(revised.sourceDocument).toEqual(before.sourceDocument);
    expect(revised.calculationPolicy).toEqual(before.calculationPolicy);
    expect(d).toEqual(before);
  });
  it("materializes optional antiemesis without inferring treatment or dropping extension extras", () => {
    const d = document();
    d.extensions.antiemetics = {
      day1: ["prévio"],
      days2to4: [],
      rescue: [],
      alerts: [],
      timeReference: "D0",
      extra: { keep: true },
    };
    const prepared = field(d, ["antiemetics", "day1"]);
    expect(prepared).toMatchObject({
      kind: "textList",
      value: ["prévio"],
      mirroredPaths: [["extensions", "antiemetics", "day1"]],
    });
    const r = applyTemplateClinicalChanges(d, [
      edit(["antiemetics", "day1"], ["Ordem explícita"]),
      edit(["antiemetics", "rescue"], []),
    ]);
    expect(r.antiemetics).toEqual({
      day1: ["Ordem explícita"],
      days2to4: [],
      rescue: [],
      alerts: [],
      timeReference: "D0",
      extra: { keep: true },
    });
    expect(r.extensions.antiemetics).toEqual(r.antiemetics);
    expect(field(document(), ["antiemetics", "rescue"])?.value).toEqual([]);
  });
  it("adds ID-linked pharmacy rows only when edited, preserving existing entry provenance and counts in mirrors", () => {
    const d = document();
    d.extensions.dilutionInfo = structuredClone(d.dilutionInfo);
    const before = structuredClone(d);
    const fields = listTemplateClinicalFields(d);
    expect(
      fields.find(f => f.path.join(".") === "dilutionInfo.1.diluent")?.label
    ).toContain("Agente B");
    expect(d).toEqual(before);
    const r = applyTemplateClinicalChanges(d, [
      edit(["dilutionInfo", "0", "volume"], "Volume declarado"),
      edit(["dilutionInfo", "1", "diluent"], "Produto informado"),
    ]);
    expect(r.dilutionInfo[0]).toMatchObject({
      drugId: "a",
      drugName: "Agente A",
      source: { preserved: true },
      unknown: 42,
      volume: "Volume declarado",
    });
    expect(r.dilutionInfo[1]).toMatchObject({
      drugId: "b",
      drugName: "Agente B",
      diluent: "Produto informado",
    });
    expect(r.extensions.dilutionInfo).toEqual(r.dilutionInfo);
    expect(r.phaseLibrary).toEqual(before.phaseLibrary);
  });
  it("supports existing status rather than inventing validationStatus", () => {
    const d = document();
    d.dilutionInfo[0].status = "draft";
    delete d.dilutionInfo[0].validationStatus;
    expect(field(d, ["dilutionInfo", "0", "status"])?.kind).toBe("text");
    expect(field(d, ["dilutionInfo", "0", "validationStatus"])).toBeUndefined();
  });
  it("writes frequency scalars coherently and converts select true/false only to booleans", () => {
    const d = document();
    const booleanField = field(d, [
      "drugs",
      "0",
      "administrationFrequency",
      "continuousInfusion",
    ]);
    expect(booleanField).toMatchObject({
      kind: "select",
      value: false,
      options: [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ],
    });
    const r = applyTemplateClinicalChanges(d, [
      edit(
        ["drugs", "0", "administrationFrequency", "administrationsPerDay"],
        3
      ),
      edit(["drugs", "0", "administrationFrequency", "intervalHours"], 8),
      edit(
        ["drugs", "0", "administrationFrequency", "continuousInfusion"],
        "false"
      ),
    ]);
    expect(r.drugs[0].administrationFrequency).toEqual({
      administrationsPerDay: 3,
      intervalHours: 8,
      continuousInfusion: false,
      doseRepresents: "per_administration",
    });
    expect(() =>
      applyTemplateClinicalChanges(d, [
        edit(
          ["drugs", "0", "administrationFrequency", "administrationsPerDay"],
          3
        ),
      ])
    ).toThrow(/frequência|interval/i);
  });
  it.each([0, -1, 1.5, Infinity, "2"])(
    "rejects invalid administrations/day %s",
    value => {
      expect(() =>
        applyTemplateClinicalChanges(document(), [
          edit(
            ["drugs", "0", "administrationFrequency", "administrationsPerDay"],
            value
          ),
        ])
      ).toThrow();
    }
  );
  it.each([[], [1, 1], [1.5], [NaN], ["1"]].map(value => [value]))(
    "rejects malformed array days %j",
    value => {
      expect(() =>
        applyTemplateClinicalChanges(document(), [
          edit(["drugs", "0", "schedule", "0", "days"], value),
        ])
      ).toThrow();
    }
  );
  it.each([
    ["dose"],
    ["sourceDocument", "drugs", "0", "dose"],
    ["archive", "drugs", "0", "dose"],
    ["drugs", "0", "name"],
    ["drugs", "0", "id"],
    ["drugs", "0", "schedule", "1", "dose"],
    ["review", "requiresMedicalApproval"],
    ["__proto__", "polluted"],
    ["drugs", "00", "route"],
  ])("rejects protected or forged path %j", (...parts) => {
    expect(() =>
      applyTemplateClinicalChanges(document(), [edit(parts, "forged")])
    ).toThrow();
    expect(({} as any).polluted).toBeUndefined();
  });
  it("rejects duplicate aliases and refuses no-op revisions atomically", () => {
    const d = document();
    const before = structuredClone(d);
    expect(() =>
      applyTemplateClinicalChanges(d, [
        edit(["drugs", "0", "schedule", "0", "days"], [4]),
        edit(["drugs", "0", "extensions", "schedule", "0", "days"], [4]),
      ])
    ).toThrow(/duplicad|espelho/i);
    expect(() =>
      applyTemplateClinicalChanges(d, [edit(["drugs", "0", "route"], "IV")])
    ).toThrow(/nenhuma/i);
    expect(() => applyTemplateClinicalChanges(d, [])).toThrow();
    expect(d).toEqual(before);
  });
  it("fails closed on conflicting root/extension data even when an unrelated field is edited", () => {
    const d = document();
    d.extensions.phaseLibrary[0].drugs[0].route = "IV";
    expect(() => listTemplateClinicalFields(d)).toThrow(/conflito/i);
    expect(() =>
      applyTemplateClinicalChanges(d, [edit(["prophylaxis"], ["declarado"])])
    ).toThrow(/conflito/i);
  });
  it("rejects custom prototypes, cyclic/non-JSON inputs and unsafe keys rather than cloning away them", () => {
    const d = document();
    d.extra = Object.create({ inherited: true });
    expect(() => listTemplateClinicalFields(d)).toThrow();
    const cyclic = document();
    cyclic.extra = cyclic;
    expect(() => listTemplateClinicalFields(cyclic)).toThrow();
    const unsafe = document();
    unsafe.extra = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(() => listTemplateClinicalFields(unsafe)).toThrow();
  });
  it("preserves BuEM source stage/origin/frequency/gates while allowing declared observations, pharmacy and antiemesis", () => {
    const buem = structuredClone(
      library.protocols.find(p => p.name === "BuEM")!
    );
    const original = structuredClone(buem);
    const r = applyTemplateClinicalChanges(buem, [
      edit(["drugs", "0", "observations"], "Revisão de software"),
      edit(["dilutionInfo", "0", "infusionTime"], "Tempo declarado"),
      edit(["antiemetics", "day1"], ["Ordem declarada"]),
    ]);
    expect(r.drugs[0].schedule).toEqual([
      { dose: 1.6, days: [-6, -5, -4], timeOrigin: "transplant_day_zero" },
    ]);
    expect(r.drugs[0].administrationFrequency).toEqual({
      administrationsPerDay: 2,
      continuousInfusion: false,
      doseRepresents: "per_administration",
      intervalHours: 12,
    });
    expect(r.calculationPolicy).toEqual(original.calculationPolicy);
    expect(r.review).toEqual(original.review);
    expect(r.sources).toEqual(original.sources);
    expect(r.revisionHistory).toEqual(original.revisionHistory);
    expect(buem).toEqual(original);
  });
});

describe("clinical optional and mirror boundaries", () => {
  it("converts explicit select choice on previously absent continuousInfusion without default writes", () => {
    const d = document();
    delete d.drugs[0].administrationFrequency.continuousInfusion;
    const before = structuredClone(d);
    expect(
      field(d, ["drugs", "0", "administrationFrequency", "continuousInfusion"])
        ?.value
    ).toBe("");
    const r = applyTemplateClinicalChanges(d, [
      edit(
        ["drugs", "0", "administrationFrequency", "continuousInfusion"],
        "false"
      ),
    ]);
    expect(r.drugs[0].administrationFrequency.continuousInfusion).toBe(false);
    expect(d).toEqual(before);
    expect(r.antiemetics).toBeUndefined();
  });
  it("keeps frequency scalar and object aliases equivalent without altering unrelated declarations", () => {
    const d = document();
    d.drugs[0].administrationsPerDay = 2;
    d.drugs[0].frequency = 2;
    const f = field(d, ["drugs", "0", "administrationsPerDay"]);
    expect(f?.mirroredPaths).toContainEqual([
      "drugs",
      "0",
      "administrationFrequency",
      "administrationsPerDay",
    ]);
    expect(f?.mirroredPaths).toContainEqual(["drugs", "0", "frequency"]);
    const r = applyTemplateClinicalChanges(d, [
      edit(["drugs", "0", "administrationsPerDay"], 3),
      edit(["drugs", "0", "administrationFrequency", "intervalHours"], 8),
    ]);
    expect(r.drugs[0].frequency).toBe(3);
    expect(r.drugs[0].administrationFrequency.administrationsPerDay).toBe(3);
  });
  it("validates extension-only frequency interval coherence rather than hiding it", () => {
    const d = document();
    d.drugs[0].extensions.administrationFrequency =
      d.drugs[0].administrationFrequency;
    delete d.drugs[0].administrationFrequency;
    expect(() =>
      applyTemplateClinicalChanges(d, [
        edit(
          [
            "drugs",
            "0",
            "extensions",
            "administrationFrequency",
            "administrationsPerDay",
          ],
          3
        ),
      ])
    ).toThrow(/interval|frequência/i);
  });
  it("does not create incomplete root pharmacy mirrors when pharmacy exists only in extensions", () => {
    const d = document();
    d.extensions.dilutionInfo = d.dilutionInfo;
    delete d.dilutionInfo;
    const r = applyTemplateClinicalChanges(d, [
      edit(["dilutionInfo", "0", "infusionTime"], "Tempo autoral"),
    ]);
    expect(r.dilutionInfo).toEqual(r.extensions.dilutionInfo);
    expect(r.dilutionInfo).toHaveLength(1);
    expect(r.dilutionInfo[0]).toMatchObject({
      drugId: "a",
      drugName: "Agente A",
      source: { preserved: true },
      unknown: 42,
    });
  });
  it("preserves root/extension structured antiemetic extras on optional-field creation", () => {
    const d = document();
    d.antiemetics = { extra: { kept: true } };
    d.extensions.antiemetics = structuredClone(d.antiemetics);
    const r = applyTemplateClinicalChanges(d, [
      edit(["antiemetics", "day1"], ["Ordem autoral"]),
    ]);
    expect(r.antiemetics.extra).toEqual({ kept: true });
    expect(r.extensions.antiemetics).toEqual(r.antiemetics);
  });
  it.each(["bogus", true, 1, {}, []])(
    "rejects unrecognized origin %j",
    value => {
      expect(() =>
        applyTemplateClinicalChanges(document(), [
          edit(["drugs", "0", "schedule", "0", "timeOrigin"], value),
        ])
      ).toThrow();
    }
  );
});

describe("extension-only parent materialization", () => {
  it("copies the entire existing pharmacy array before editing a canonical root field", () => {
    const d = document();
    d.extensions.dilutionInfo = [
      ...d.dilutionInfo,
      {
        drugId: "b",
        drugName: "Agente B",
        volume: "Existente",
        product: { keep: true },
      },
    ];
    delete d.dilutionInfo;
    const r = applyTemplateClinicalChanges(d, [
      edit(["dilutionInfo", "0", "volume"], "Declarado"),
    ]);
    expect(r.dilutionInfo).toHaveLength(2);
    expect(r.dilutionInfo).toEqual(r.extensions.dilutionInfo);
    expect(r.dilutionInfo[1]).toMatchObject({ product: { keep: true } });
  });
  it("keeps sparse extension antiemesis equivalent while creating canonical root", () => {
    const d = document();
    d.extensions.antiemetics = { day1: ["Existente"], extra: { kept: true } };
    const r = applyTemplateClinicalChanges(d, [
      edit(["antiemetics", "day1"], ["Declarado"]),
    ]);
    expect(r.antiemetics).toEqual(r.extensions.antiemetics);
    expect(r.antiemetics.extra).toEqual({ kept: true });
  });
});

describe("stage frequency coherence", () => {
  it("refuses a stage administrations/day edit that conflicts with the inherited drug interval", () => {
    const d = document();
    expect(() =>
      applyTemplateClinicalChanges(d, [
        edit(
          [
            "drugs",
            "0",
            "schedule",
            "0",
            "administrationFrequency",
            "administrationsPerDay",
          ],
          3
        ),
      ])
    ).toThrow(/frequência|interval/i);
    const r = applyTemplateClinicalChanges(d, [
      edit(
        [
          "drugs",
          "0",
          "schedule",
          "0",
          "administrationFrequency",
          "administrationsPerDay",
        ],
        3
      ),
      edit(
        [
          "drugs",
          "0",
          "schedule",
          "0",
          "administrationFrequency",
          "intervalHours",
        ],
        8
      ),
    ]);
    expect(r.drugs[0].schedule[0].administrationFrequency).toEqual({
      administrationsPerDay: 3,
      intervalHours: 8,
    });
    expect(r.drugs[0].extensions.schedule).toEqual(r.drugs[0].schedule);
  });
});
