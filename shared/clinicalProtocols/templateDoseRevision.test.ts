import { describe, expect, it } from "vitest";
import {
  applyTemplateDoseChanges,
  listTemplateDoseFields,
} from "./templateDoseRevision";

const document = () => ({
  drugs: [
    {
      id: "a",
      name: "Agente A",
      dose: 10,
      doseUnit: "mg/m²",
      route: "IV",
      days: "1",
      maxDose: 100,
      administrationFrequency: { administrationsPerDay: 2 },
      schedule: [
        { dose: 5, doseUnit: "mg", days: [1, 2], cycleFrom: 1, cycleTo: 2 },
        { dose: null, days: [3], doseDecision: "Decidir" },
      ],
      extensions: {
        schedule: [
          { dose: 5, doseUnit: "mg", days: [1, 2], cycleFrom: 1, cycleTo: 2 },
          { dose: null, days: [3], doseDecision: "Decidir" },
        ],
      },
    },
  ],
  extensions: {
    phaseLibrary: [
      {
        id: "p",
        name: "Consolidação",
        drugs: [
          {
            id: "b",
            name: "Agente B",
            dose: 0.01,
            doseUnit: "mcg/kg",
            route: "VO",
            days: "8",
          },
        ],
      },
    ],
  },
  sourceDocument: {
    drugs: [{ dose: 999 }],
    phaseLibrary: [{ drugs: [{ dose: 999 }] }],
  },
  sourceEnvelope: { drugs: [{ dose: 888 }] },
  archive: { drugs: [{ dose: 777 }] },
  revisionAudit: { drugs: [{ dose: 666 }] },
  metadata: { drugs: [{ dose: 555 }] },
  references: [{ drugs: [{ dose: 444 }] }],
});

describe("template dose paths stay clinical and preserve source JSON", () => {
  it("does not expose an unrelated top-level document dose as a medication field", () => {
    const d: any = document();
    d.dose = 123;
    d.extensions.dose = 123;
    expect(
      listTemplateDoseFields(d).some(field => field.path.length === 1)
    ).toBe(false);
    expect(() =>
      applyTemplateDoseChanges(d, [{ path: ["dose"], dose: 124 }])
    ).toThrow();
  });
  it("lists main, schedule and extension phase doses with units/period, never nulls or metadata", () => {
    const fields = listTemplateDoseFields(document());
    expect(fields.map(f => [f.path, f.dose, f.unit])).toEqual([
      [["drugs", "0", "dose"], 10, "mg/m²"],
      [["drugs", "0", "schedule", "0", "dose"], 5, "mg"],
      [
        ["extensions", "phaseLibrary", "0", "drugs", "0", "dose"],
        0.01,
        "mcg/kg",
      ],
    ]);
    expect(fields[1].mirroredPaths).toEqual([
      ["drugs", "0", "extensions", "schedule", "0", "dose"],
    ]);
    expect(fields[1].period).toContain("1, 2");
    expect(fields[2].period).toContain("Consolidação");
    expect(fields[2].drugName).toBe("Agente B");
  });
  it("changes just the allowed doses and synchronizes equal mirrors without mutating input", () => {
    const d = document();
    const original = structuredClone(d);
    const revised = applyTemplateDoseChanges(d, [
      { path: ["drugs", "0", "schedule", "0", "dose"], dose: 7.125 },
    ]);
    const expected = structuredClone(original);
    expected.drugs[0].schedule[0].dose = 7.125;
    expected.drugs[0].extensions.schedule[0].dose = 7.125;
    expect(revised).toEqual(expected);
    expect(d).toEqual(original);
  });
  it("synchronizes root and extension phase libraries independently of object key ordering", () => {
    const d: any = document();
    d.phaseLibrary = structuredClone(d.extensions.phaseLibrary);
    d.extensions.phaseLibrary[0] = {
      drugs: d.phaseLibrary[0].drugs,
      name: "Consolidação",
      id: "p",
    };
    const revised = applyTemplateDoseChanges(d, [
      {
        path: ["extensions", "phaseLibrary", "0", "drugs", "0", "dose"],
        dose: 0.02,
      },
    ]);
    expect(revised.phaseLibrary[0].drugs[0].dose).toBe(0.02);
    expect(revised.extensions.phaseLibrary[0].drugs[0].dose).toBe(0.02);
  });
  it("refuses conflicting mirrors rather than selecting or repairing either variant", () => {
    const d = document();
    d.drugs[0].extensions.schedule[0].dose = 6;
    expect(() => listTemplateDoseFields(d)).toThrow(/conflito/i);
    expect(() =>
      applyTemplateDoseChanges(d, [{ path: ["drugs", "0", "dose"], dose: 12 }])
    ).toThrow(/conflito/i);
  });
  it.each([0, -1, NaN, Infinity, -Infinity, "12", null])(
    "rejects nonpositive/nonfinite/non-numeric new dose %s",
    dose => {
      expect(() =>
        applyTemplateDoseChanges(document(), [
          { path: ["drugs", "0", "dose"], dose } as any,
        ])
      ).toThrow();
    }
  );
  it.each(
    [
      ["sourceDocument", "drugs", "0", "dose"],
      ["metadata", "drugs", "0", "dose"],
      ["drugs", "0", "schedule", "1", "dose"],
      ["drugs", "0", "maxDose"],
      ["drugs", "0", "doseUnit"],
      ["drugs", "00", "dose"],
      ["drugs", "0", "missing", "dose"],
      ["__proto__", "dose"],
      ["drugs", "constructor", "prototype", "dose"],
      [],
    ].map(path => [path])
  )("rejects forged/non-dose/null/unsafe path %j", path => {
    const d = document();
    const before = structuredClone(d);
    expect(() => applyTemplateDoseChanges(d, [{ path, dose: 12 }])).toThrow();
    expect(d).toEqual(before);
    expect(({} as any).dose).toBeUndefined();
  });
  it("rejects duplicate paths, including two aliases of the same mirror", () => {
    const path = ["drugs", "0", "schedule", "0", "dose"];
    expect(() =>
      applyTemplateDoseChanges(document(), [
        { path, dose: 12 },
        { path, dose: 13 },
      ])
    ).toThrow();
    expect(() =>
      applyTemplateDoseChanges(document(), [
        { path, dose: 12 },
        {
          path: ["drugs", "0", "extensions", "schedule", "0", "dose"],
          dose: 12,
        },
      ])
    ).toThrow();
  });
  it("does not allow empty or unchanged revisions", () => {
    expect(() => applyTemplateDoseChanges(document(), [])).toThrow();
    expect(() =>
      applyTemplateDoseChanges(document(), [
        { path: ["drugs", "0", "dose"], dose: 10 },
      ])
    ).toThrow();
  });
  it("keeps numeric conditional variants editable without filling nulls or deleting decisions", () => {
    const d: any = document();
    d.drugs[0].conditionalDoses = [
      { dose: 3, days: [4], selection: "Resposta" },
      { dose: null, selection: "Pendente" },
    ];
    d.extensions.optionalAntibody = {
      drug: "Anticorpo",
      dose: 375,
      doseUnit: "mg/m²",
      days: [8],
      selection: "CD20",
    };
    d.extensions.provenance = { schedule: [{ dose: 999 }] };
    const fields = listTemplateDoseFields(d);
    expect(
      fields.filter(f => f.path.includes("conditionalDoses")).map(f => f.dose)
    ).toEqual([3]);
    expect(
      fields.find(f => f.path.includes("optionalAntibody"))?.drugName
    ).toBe("Anticorpo");
    expect(fields.some(f => f.path.includes("provenance"))).toBe(false);
    const revised = applyTemplateDoseChanges(d, [
      { path: ["drugs", "0", "conditionalDoses", "0", "dose"], dose: 4 },
    ]);
    expect(revised.drugs[0].conditionalDoses).toEqual([
      { dose: 4, days: [4], selection: "Resposta" },
      { dose: null, selection: "Pendente" },
    ]);
  });
  it("does not treat arbitrary source-like stage extras as doses inside a clinical dictionary", () => {
    const d: any = document();
    d.drugs[0].interactionSchedules = {
      posaconazole: [
        {
          dose: 2,
          days: [1],
          transcription: { dose: 999, schedule: [{ dose: 888 }] },
          notes: { dose: 777 },
        },
      ],
    };
    d.extensions.CNSProphylaxis = {
      doses: [{ name: "Agente C", dose: 3, unit: "mg", day: 2 }],
      notes: { dose: 555 },
      transcription: { dose: 666 },
    };
    const fields = listTemplateDoseFields(d);
    expect(
      fields
        .filter(f => f.path.includes("interactionSchedules"))
        .map(f => f.dose)
    ).toEqual([2]);
    expect(
      fields.filter(f => f.path.includes("CNSProphylaxis")).map(f => f.dose)
    ).toEqual([3]);
    expect(() =>
      applyTemplateDoseChanges(d, [
        {
          path: [
            "drugs",
            "0",
            "interactionSchedules",
            "posaconazole",
            "0",
            "notes",
            "dose",
          ],
          dose: 3,
        },
      ])
    ).toThrow();
  });
});
