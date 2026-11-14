import { describe, expect, it } from "vitest";
import { getClinicalPrescriptionBlock, resolveClinicalProtocol } from "./resolver";
import type { ClinicalProtocolDocument } from "./types";

const helpers = async (): Promise<any> => {
  const mod = await import("./templates").catch(() => ({}));
  expect((mod as any).isActiveTemplateDocument).toBeTypeOf("function");
  return mod;
};
const fixture = (): ClinicalProtocolDocument => ({
  id: "fixture", name: "Test only", indication: "Software", cycles: 2, cycleLength: 21,
  templateUsage: { kind: "user_managed", status: "active", prescriptionEnabled: true },
  drugs: [{ id: "x", name: "Test drug", dose: 100, doseUnit: "mg/m²", route: "IV", days: "1", schedule: [{ dose: 60, doseUnit: "mg/m²", days: [1], administrationsPerDay: 2, doseRepresents: "per_24_hours" }] }],
});

// Catches accidental draft release, unpromoted/conflicting extensions and partial unsafe outputs.
describe("user template execution", () => {
  it.each(["doseDecision", "doseSelectionDecision", "ageTable"])("blocks promoted root decision %s instead of ignoring a required choice", async key => {
    const h = await helpers(); const doc = fixture();
    doc.extensions = { [key]: key === "ageTable" ? [{ age: 1, dose: 10 }] : "Explicit selection required" };
    const result = resolveClinicalProtocol(doc, { cycle: 1, bsa: 2 });
    expect(result.prescriptionBlocked).toBe(true);
    expect(h.mapResolvedTemplateDrugs(result)).toEqual([]);
  });
  it("blocks a zero stage dose rather than emitting a ready zero application", async () => {
    const h = await helpers(); const doc = fixture();
    doc.drugs[0].schedule![0].dose = 0;
    const result = resolveClinicalProtocol(doc, { cycle: 1, bsa: 2 });
    expect(result.rows[0].status).toBe("blocked");
    expect(result.prescriptionBlocked).toBe(true);
    expect(h.mapResolvedTemplateDrugs(result)).toEqual([]);
  });
  it("removes only the institutional gate for active user templates, not draft/disabled templates", async () => {
    const h = await helpers();
    const doc = fixture();
    expect(h.isActiveTemplateDocument(doc)).toBe(true);
    expect(getClinicalPrescriptionBlock(doc)).toEqual([]);
    expect(doc.review).toBeUndefined();
    for (const usage of [undefined, { kind: "user_managed", status: "draft", prescriptionEnabled: true }, { kind: "user_managed", status: "active", prescriptionEnabled: false }, { kind: "institutional", status: "active", prescriptionEnabled: true }]) {
      const d = { ...doc, templateUsage: usage };
      expect(h.isActiveTemplateDocument(d)).toBe(false);
      expect(getClinicalPrescriptionBlock(d).length).toBeGreaterThan(0);
    }
  });
  it("promotes extension phases and drug decisions into a derived document without mutating originals", async () => {
    const h = await helpers(); const doc = fixture();
    doc.extensions = { phaseLibrary: [{ id: "phase", name: "Phase", drugs: [{ ...doc.drugs[0], extensions: { doseDecision: "Requires explicit age table" } }] }] };
    const original = structuredClone(doc);
    const execution = h.getTemplateExecutionDocument(doc);
    expect(execution).not.toBe(doc);
    expect(execution.phaseLibrary).toHaveLength(1);
    expect(execution.phaseLibrary[0].drugs[0].doseDecision).toBe("Requires explicit age table");
    expect(doc).toEqual(original);
    expect(resolveClinicalProtocol(doc, { cycle: 1, bsa: 2 }).rows).toEqual([]);
    const selected = resolveClinicalProtocol(doc, { cycle: 1, phaseId: "phase", bsa: 2 });
    expect(selected.rows[0].source.doseDecision).toBe("Requires explicit age table");
    expect(selected.rows[0].status).toBe("blocked");
  });
  it("blocks differing explicit root/extension phases rather than selecting one", async () => {
    const h = await helpers(); const doc = fixture();
    doc.phaseLibrary = [{ id: "root", name: "Root", drugs: doc.drugs }];
    doc.extensions = { phaseLibrary: [{ id: "other", name: "Other", drugs: doc.drugs }] };
    const result = resolveClinicalProtocol(doc, { cycle: 1, phaseId: "root", bsa: 2 });
    expect(result.prescriptionBlocked).toBe(true);
    expect(h.getTemplatePrescriptionIssues(doc, { cycle: 1, phaseId: "root", bsa: 2 }, result).length).toBeGreaterThan(0);
    expect(h.mapResolvedTemplateDrugs(result)).toEqual([]);
    expect(doc.phaseLibrary[0].id).toBe("root");
  });
  it("allows equal roots but blocks explicit null root vs extension decision", async () => {
    const h = await helpers(); const doc = fixture();
    doc.extensions = { phaseLibrary: [{ id: "p", name: "P", drugs: doc.drugs }] };
    doc.phaseLibrary = structuredClone((doc.extensions as any).phaseLibrary);
    const result = resolveClinicalProtocol(doc, { cycle: 1, phaseId: "p", bsa: 2 });
    expect(h.getTemplatePrescriptionIssues(doc, { cycle: 1, phaseId: "p", bsa: 2 }, result)).toEqual([]);
    doc.drugs[0].doseDecision = null;
    doc.drugs[0].extensions = { doseDecision: "age selection" };
    const conflict = resolveClinicalProtocol(doc, { cycle: 1, phaseId: "p", bsa: 2 });
    expect(conflict.prescriptionBlocked).toBe(true);
  });
  it("maps stage dose without BSA, calculated per-application and explicit 24h total", async () => {
    const h = await helpers(); const doc = fixture();
    const result = resolveClinicalProtocol(doc, { cycle: 1, bsa: 2 });
    expect(h.getTemplatePrescriptionIssues(doc, { cycle: 1, bsa: 2 }, result)).toEqual([]);
    expect(h.mapResolvedTemplateDrugs(result)).toEqual([expect.objectContaining({ id: "x", name: "Test drug", dose: 60, doseUnit: "mg/m²", calculatedDose: 60, resultUnit: "mg", dailyDose: 120, frequency: 2, doseRepresents: "per_24_hours", timeOrigin: "cycle_day_one" })]);
    const mapped = h.mapResolvedTemplateDrugs(result)[0];
    expect(mapped.observations).toContain("cycle_day_one");
    expect(mapped.observations).toContain("2 administração");
    expect(mapped.observations).toMatch(/24\s*h.*120|120.*24\s*h/);
    expect(mapped.maxDose).toBeUndefined();
  });
  it("never emits a partial list if one selected row is unresolved", async () => {
    const h = await helpers(); const doc = fixture();
    doc.drugs.push({ ...doc.drugs[0], id: "unresolved", dose: null, schedule: [{ dose: null, days: [1], administrationsPerDay: 1 }] });
    const result = resolveClinicalProtocol(doc, { cycle: 1, bsa: 2 });
    expect(result.rows[0].status).toBe("ready");
    expect(h.getTemplatePrescriptionIssues(doc, { cycle: 1, bsa: 2 }, result).length).toBeGreaterThan(0);
    expect(h.mapResolvedTemplateDrugs(result)).toEqual([]);
  });
  it("requires a valid phase and at least one ready row, and never releases referenceOnly", async () => {
    const h = await helpers(); const doc = fixture();
    let result = resolveClinicalProtocol(doc, { cycle: 1, day: 2, bsa: 2 });
    expect(h.getTemplatePrescriptionIssues(doc, { cycle: 1, day: 2, bsa: 2 }, result).length).toBeGreaterThan(0);
    doc.referenceOnly = true;
    result = resolveClinicalProtocol(doc, { cycle: 1, bsa: 2 });
    expect(h.getTemplatePrescriptionIssues(doc, { cycle: 1, bsa: 2 }, result).length).toBeGreaterThan(0);
    doc.referenceOnly = false; doc.phaseLibrary = [{ id: "p", name: "Phase", drugs: doc.drugs }];
    result = resolveClinicalProtocol(doc, { cycle: 1, phaseId: "p", bsa: 2 });
    expect(h.getTemplatePrescriptionIssues(doc, { cycle: 1, phaseId: "invalid", bsa: 2 }, result).length).toBeGreaterThan(0);
  });
});
