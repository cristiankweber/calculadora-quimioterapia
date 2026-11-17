import { describe, expect, it } from "vitest";
import { resolveClinicalProtocol } from "./resolver";
import { mapResolvedTemplateDrugs } from "./templates";
import type { ClinicalProtocolDocument } from "./types";

const fixture = (): ClinicalProtocolDocument => ({
  id: "manual-fixture",
  name: "Synthetic only",
  indication: "Software",
  cycles: 3,
  cycleLength: 21,
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
  drugs: [
    {
      id: "d",
      name: "Same name",
      dose: 20,
      doseUnit: "mg",
      route: "IV",
      days: "1, 2",
      schedule: [
        {
          dose: 20,
          days: [1],
          administrationsPerDay: 2,
          doseRepresents: "per_24_hours",
        },
        {
          dose: 40,
          days: [2],
          administrationsPerDay: 2,
          doseRepresents: "per_24_hours",
        },
      ],
    },
  ],
});
const resolve = (doc = fixture(), day?: number) =>
  resolveClinicalProtocol(doc, { cycle: 1, day });
const api = async () => {
  const module = await import("./manualAdjustments").catch(() => ({}));
  expect((module as any).applyTemplateManualAdjustments).toBeTypeOf("function");
  return (module as any).applyTemplateManualAdjustments as (
    r: ReturnType<typeof resolve>,
    o: any[]
  ) => { drugs: any[]; issues: string[] };
};

// Catches filtered-index/name identities that target a different stage after day/phase changes.
describe("templateManual row identity", () => {
  it("keeps original schedule positions when filtering days", () => {
    const all = resolve();
    const day2 = resolve(fixture(), 2);
    expect((all.rows[0] as any).rowKey).toBeTypeOf("string");
    expect((all.rows[1] as any).rowKey).not.toBe((all.rows[0] as any).rowKey);
    // Context is included, so compare same selected day with/without a preceding excluded stage.
    const doc = fixture();
    const selected = resolve(doc, 2);
    doc.drugs[0].schedule![0].cycleFrom = 2;
    expect((resolve(doc, 2).rows[0] as any).rowKey).toBe(
      (selected.rows[0] as any).rowKey
    );
    expect(day2.rows[0].dose).toBe(40);
  });
  it("distinguishes duplicate names and original document/phase positions", () => {
    const doc = fixture();
    doc.drugs.push({ ...structuredClone(doc.drugs[0]), id: "other" });
    const keys = resolve(doc, 1).rows.map(row => (row as any).rowKey);
    expect(new Set(keys).size).toBe(2);
    doc.phaseLibrary = [
      { id: "p", name: "Phase", drugs: [doc.drugs[0]] },
      { id: "q", name: "Phase", drugs: [doc.drugs[0]] },
    ];
    const p = resolveClinicalProtocol(doc, { cycle: 1, day: 1, phaseId: "p" });
    const q = resolveClinicalProtocol(doc, { cycle: 1, day: 1, phaseId: "q" });
    expect((p.rows[0] as any).rowKey).not.toBe((q.rows[0] as any).rowKey);
  });
  it("changes identity across document and clinical context", () => {
    const doc = fixture();
    const baseline = (resolve(doc, 1).rows[0] as any).rowKey;
    doc.id = "new-version";
    expect((resolve(doc, 1).rows[0] as any).rowKey).not.toBe(baseline);
    expect(
      (resolveClinicalProtocol(fixture(), { cycle: 2, day: 1 }).rows[0] as any)
        .rowKey
    ).not.toBe(baseline);
  });
});

// Catches overwriting calculated/daily baseline, assuming an infusion's daily total, and unsafe partial output.
describe("templateManual shared application", () => {
  it("maps baseline defaults and labels daily notes as BASELINE", () => {
    expect(mapResolvedTemplateDrugs(resolve(fixture(), 1))[0]).toMatchObject({
      calculatedDose: 10,
      finalDose: 10,
      dailyDose: 20,
      prescribedDailyDose: 20,
      isManualDose: false,
      rowKey: expect.any(String),
      observations: expect.stringContaining("BASELINE"),
    });
  });
  it("preserves baseline and derives daily total with trimmed reason without mutating resolution", async () => {
    const apply = await api();
    const r = resolve(fixture(), 1);
    const before = structuredClone(r);
    const result = apply(r, [
      {
        rowKey: (r.rows[0] as any).rowKey,
        finalDose: 7.5,
        reason: "  decisão individual  ",
      },
    ]);
    expect(result.issues).toEqual([]);
    expect(result.drugs[0]).toMatchObject({
      calculatedDose: 10,
      finalDose: 7.5,
      dailyDose: 20,
      prescribedDailyDose: 15,
      isManualDose: true,
      adjustmentReason: "decisão individual",
      dose: 20,
      frequency: 2,
    });
    expect(r).toEqual(before);
    expect(apply(r, []).drugs[0]).toMatchObject({
      finalDose: 10,
      prescribedDailyDose: 20,
      isManualDose: false,
    });
  });
  it.each(["total_for_this_infusion", "per_24_hours"])(
    "derives %s continuous dose without multiplying by administrations",
    async representation => {
      const apply = await api();
      const doc = fixture();
      Object.assign(doc.drugs[0].schedule![0], {
        continuousInfusion: true,
        doseRepresents: representation,
        administrationsPerDay: 3,
      });
      const r = resolve(doc, 1);
      const result = apply(r, [
        {
          rowKey: (r.rows[0] as any).rowKey,
          finalDose: 15,
          reason: "individual",
        },
      ]);
      expect(result.issues).toEqual([]);
      expect(result.drugs[0]).toMatchObject({
        calculatedDose: 20,
        finalDose: 15,
        dailyDose: representation === "per_24_hours" ? 20 : null,
        prescribedDailyDose: representation === "per_24_hours" ? 15 : null,
      });
    }
  );
  it.each([0, -1, NaN, Infinity, -Infinity])(
    "blocks invalid manual dose %s all-or-nothing",
    async finalDose => {
      const apply = await api();
      const r = resolve(fixture(), 1);
      const out = apply(r, [
        { rowKey: (r.rows[0] as any).rowKey, finalDose, reason: "individual" },
      ]);
      expect(out.drugs).toEqual([]);
      expect(out.issues.length).toBeGreaterThan(0);
    }
  );
  it.each([undefined, null, "", "   ", "x".repeat(1001)])(
    "blocks invalid reason without releasing baseline",
    async reason => {
      const apply = await api();
      const r = resolve(fixture(), 1);
      const out = apply(r, [
        { rowKey: (r.rows[0] as any).rowKey, finalDose: 8, reason },
      ]);
      expect(out.drugs).toEqual([]);
      expect(out.issues.length).toBeGreaterThan(0);
    }
  );
  it("blocks duplicate overrides and orphan/tampered row keys", async () => {
    const apply = await api();
    const r = resolve(fixture(), 1);
    const o = {
      rowKey: (r.rows[0] as any).rowKey,
      finalDose: 8,
      reason: "individual",
    };
    for (const overrides of [[o, o], [{ ...o, rowKey: "forged" }]]) {
      const out = apply(r, overrides);
      expect(out.drugs).toEqual([]);
      expect(out.issues.length).toBeGreaterThan(0);
    }
    const duplicate = { ...r, rows: [...r.rows, r.rows[0]] };
    expect(apply(duplicate, [o]).drugs).toEqual([]);
  });
  it("blocks rowKey rewritten in the resolution instead of accepting a matching forged override", async () => {
    const apply = await api();
    const r = resolve(fixture(), 1);
    r.rows[0].rowKey = "forged";
    expect(mapResolvedTemplateDrugs(r)).toEqual([]);
    const result = apply(r, [
      { rowKey: "forged", finalDose: 8, reason: "individual" },
    ]);
    expect(result.drugs).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
  });
  it.each(["draft", "referenceOnly", "pending", "calvert"])(
    "cannot rescue %s through a manual adjustment",
    async variant => {
      const apply = await api();
      const doc = fixture();
      if (variant === "draft") (doc.templateUsage as any).status = "draft";
      if (variant === "referenceOnly") doc.referenceOnly = true;
      if (variant === "pending")
        doc.drugs.push({
          ...doc.drugs[0],
          id: "pending",
          schedule: [{ dose: null, days: [1], administrationsPerDay: 1 }],
        });
      if (variant === "calvert") doc.drugs[0].schedule![0].doseUnit = "AUC";
      const r = resolve(doc, 1);
      const out = apply(r, [
        {
          rowKey: (r.rows[0] as any).rowKey,
          finalDose: 8,
          reason: "individual",
        },
      ]);
      expect(out.drugs).toEqual([]);
      expect(out.issues.length).toBeGreaterThan(0);
    }
  );
  it("enforces stored maximum and keeps ambiguous unit blocked", async () => {
    const apply = await api();
    const doc = fixture();
    doc.drugs[0].maxDose = 12;
    doc.drugs[0].maxDoseUnit = "mg";
    const r = resolve(doc, 1);
    expect(
      apply(r, [
        {
          rowKey: (r.rows[0] as any).rowKey,
          finalDose: 12,
          reason: "individual",
        },
      ]).issues
    ).toEqual([]);
    expect(
      apply(r, [
        {
          rowKey: (r.rows[0] as any).rowKey,
          finalDose: 12.001,
          reason: "individual",
        },
      ]).drugs
    ).toEqual([]);
    doc.drugs[0].maxDoseUnit = "mg/m²";
    expect(resolve(doc, 1).prescriptionBlocked).toBe(true);
    expect(apply(resolve(doc, 1), []).drugs).toEqual([]);
  });
});
