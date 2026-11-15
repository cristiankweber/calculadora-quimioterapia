import { describe, expect, it } from "vitest";
import { convertToUserTemplatePackage, protocolContentSha256, validateImportFormat } from "./seedSystemProtocols";
import { validateActiveTemplatePrescription } from "./activeTemplatePrescription";
import { resolveClinicalProtocol } from "../shared/clinicalProtocols/resolver";
import { getTemplatePrescriptionIssues, mapResolvedTemplateDrugs } from "../shared/clinicalProtocols/templates";
import type { ClinicalProtocolDocument } from "../shared/clinicalProtocols/types";

const drug = (extra: Record<string, unknown> = {}) => ({
  id: "d", name: "Fármaco sintético", dose: 10, doseUnit: "mg", route: "IV", days: "1",
  administrationFrequency: { administrationsPerDay: 2 }, schedule: [{ dose: 10, days: [1] }], ...extra,
});
const raw = (d = drug(), extra: Record<string, unknown> = {}, version = "2.18") => ({ version, protocols: [{
  id: "synthetic", name: version === "1.0" ? "BrECADD sintético" : "Software fixture", indication: "Sem uso clínico",
  cycles: 4, cycleLength: 21, drugs: [d], ...extra,
}] });
const make = (d = drug(), extra: Record<string, unknown> = {}) =>
  (convertToUserTemplatePackage(raw(d, extra)) as any).protocols[0] as ClinicalProtocolDocument;
const context = { cycle: 1, day: 1, bsa: 2, weight: 70 };
function request(document: ClinicalProtocolDocument, dose = 10, unit = "mg") {
  return {
    patientId: 1, patientName: "Fictício", protocolName: document.name, cycle: 1, bsa: 1.81, egfr: 97.6, renalStatus: "green",
    prescriptionData: {
      patient: { name: "Fictício", age: 40, sex: "M", weight: 70, height: 170, creatinine: 1, ecog: 0 },
      protocol: { id: "template-test", name: document.name, templateContext: { cycle: 1, day: 1 } },
      calculatedValues: { bsa: 1.81, egfr: 97.6, renalStatus: "green" },
      drugs: [{ name: "Fármaco sintético", baseDose: dose, calculatedDose: dose, finalDose: dose, doseUnit: unit,
        resultUnit: unit, route: "IV", days: "1", frequency: 2, dailyDose: dose * 2, timeOrigin: "cycle_day_one" }],
    },
  };
}
const stored = (document: ClinicalProtocolDocument) => ({ userId: 7, protocolId: "template-test", name: document.name,
  isActive: 1, clinicalDocument: document, clinicalPackage: { version: "user-protocol-template-1.0" } });

// Catches placement-dependent gates: selecting a phase is not selecting dose/titration.
describe("P1-04 decisions fail closed at every executable scope", () => {
  for (const key of ["ageTable", "doseDecision", "initialTitration", "doseLevelTable", "interactionSchedules", "mysterySelector"]) {
    for (const scope of ["document", "phase", "drug", "schedule"]) {
      it.each([false, true])(`${key} in ${scope}, extensions=%s blocks output and backend`, extension => {
        const value = key === "doseDecision" ? "Escolher explicitamente" : [{ dose: 2 }];
        const decision = extension ? { extensions: { [key]: value } } : { [key]: value };
        let d = drug(); let extra: Record<string, unknown> = {}; let selected: any = context;
        if (scope === "document") extra = decision;
        if (scope === "drug") d = drug(decision);
        if (scope === "schedule") d = drug({ schedule: [{ dose: 10, days: [1], ...decision }] });
        if (scope === "phase") { extra = { phaseLibrary: [{ id: "p", name: "P", drugs: [d], ...decision }] }; selected = { ...context, phaseId: "p" }; }
        const document = make(d, extra); const before = structuredClone(document);
        const resolution = resolveClinicalProtocol(document, selected);
        expect(resolution.prescriptionBlocked).toBe(true);
        expect(getTemplatePrescriptionIssues(document, selected, resolution).join(" ")).toContain(key);
        expect(mapResolvedTemplateDrugs(resolution)).toEqual([]);
        const payload = request(document); Object.assign(payload.prescriptionData.protocol.templateContext, scope === "phase" ? { phaseId: "p" } : {});
        expect(() => validateActiveTemplatePrescription(payload as any, stored(document), 7)).toThrow(/não resolvida/);
        expect(document).toEqual(before);
      });
    }
  }
  it("ignores archival decisions and decisions in an unselected phase", () => {
    const document = make(drug(), { sourceNotes: "Referência", phaseLibrary: [
      { id: "p", name: "P", requiresExplicitSelection: true, drugs: [drug()] },
      { id: "q", name: "Q", initialTitration: [{ dose: 2 }], drugs: [drug()] },
    ] });
    const resolution = resolveClinicalProtocol(document, { ...context, phaseId: "p" });
    expect(resolution.prescriptionBlocked).toBe(false);
    expect(resolution.rows[0].calculatedDose).toBe(10);
  });
});

// Catches dimensional fallback, hidden nulls and contradictory declarations at one scope.
describe("P1-05 representation precedence and explicit conflicts", () => {
  it.each([false, true])("document policy per_24_hours, extensions=%s, divides daily total", extension => {
    const policy = { calculationPolicy: { doseRepresents: "per_24_hours" } };
    const document = make(drug(), extension ? { extensions: policy } : policy);
    expect(resolveClinicalProtocol(document, context)).toMatchObject({ prescriptionBlocked: false,
      rows: [{ calculatedDose: 5, dailyDose: 10, doseRepresents: "per_24_hours" }] });
  });
  it("phase policy overrides document policy when the phase is explicitly selected", () => {
    const document = make(drug(), { calculationPolicy: { doseRepresents: "per_administration" },
      phaseLibrary: [{ id: "p", name: "P", extensions: { calculationPolicy: { doseRepresents: "per_24_hours" } }, drugs: [drug()] }] });
    expect(resolveClinicalProtocol(document, { ...context, phaseId: "p" }).rows[0]).toMatchObject({ calculatedDose: 5, dailyDose: 10 });
  });
  it.each(["drug", "schedule"])("explicit %s overrides document policy", scope => {
    const d = scope === "drug" ? drug({ doseRepresents: "per_administration" }) : drug({ schedule: [{ dose: 10, days: [1], doseRepresents: "per_administration" }] });
    expect(resolveClinicalProtocol(make(d, { calculationPolicy: { doseRepresents: "per_24_hours" } }), context)).toMatchObject({ prescriptionBlocked: false,
      rows: [{ calculatedDose: 10, dailyDose: 20 }] });
  });
  it.each([
    { calculationPolicy: { doseRepresents: null } },
    { calculationPolicy: { doseRepresents: "per_24_hours" }, extensions: { calculationPolicy: { doseRepresents: "per_administration" } } },
  ])("blocks null/conflicting document policy %j", extra => {
    expect(resolveClinicalProtocol(make(drug(), extra), context).prescriptionBlocked).toBe(true);
  });
  it.each([
    { doseRepresents: "per_24_hours", administrationFrequency: { administrationsPerDay: 2, doseRepresents: "per_administration" } },
    { doseRepresents: null, administrationFrequency: { administrationsPerDay: 2, doseRepresents: "per_24_hours" } },
    { administrationsPerDay: 1, administrationFrequency: { administrationsPerDay: 3 } },
  ])("blocks contradictory stage declarations %j", stage => {
    expect(resolveClinicalProtocol(make(drug({ schedule: [{ dose: 10, days: [1], ...stage }] })), context).prescriptionBlocked).toBe(true);
  });
});

// Catches literal alias comparison and false disjointness inferred from incomparable day numbers.
describe("P1-06 origin compatibility", () => {
  it("allows nonoverlapping schedules expressed with cycle aliases, without changing source", () => {
    const document = make(drug({ schedule: [{ dose: 10, days: [1], timeOrigin: "cycle_start" }, { dose: 20, days: [2], timeOrigin: "cycle_day_one" }] }));
    const before = structuredClone(document);
    const r = resolveClinicalProtocol(document, { cycle: 1 });
    expect(r.prescriptionBlocked).toBe(false);
    expect(r.rows.map(row => row.calculatedDose)).toEqual([10, 20]);
    expect(r.rows.map(row => row.timeOrigin)).toEqual(["cycle_day_one", "cycle_day_one"]);
    expect(document).toEqual(before);
  });
  it.each([undefined, 1, 2])("blocks distinct origins before filtering day=%s without offsets", day => {
    const document = make(drug({ schedule: [{ dose: 10, days: [1], timeOrigin: "cycle_day_one" }, { dose: 20, days: [2], timeOrigin: "treatment_start" }] }));
    const r = resolveClinicalProtocol(document, { cycle: 1, day });
    expect(r.prescriptionBlocked).toBe(true);
    expect(mapResolvedTemplateDrugs(r)).toEqual([]);
    expect(r.issues.join(" ")).toMatch(/origens|contexto temporal/i);
  });
  it("does not compare origins belonging to mutually exclusive cycles", () => {
    const document = make(drug({ schedule: [{ dose: 10, days: [1], cycleTo: 1, timeOrigin: "cycle_day_one" }, { dose: 20, days: [2], cycleFrom: 2, timeOrigin: "treatment_start" }] }));
    expect(resolveClinicalProtocol(document, { cycle: 1 }).prescriptionBlocked).toBe(false);
  });
});

// Catches destructive BrECADD normalization and invented frequency overriding explicit dose bases.
describe("P1-07 lossless BrECADD conversion", () => {
  it("preserves a coherent explicit stage instead of replacing its dose/frequency", () => {
    const source = raw(drug({ dose: 10, days: "2", schedule: [{ dose: 4, days: [2], administrationsPerDay: 2, doseRepresents: "per_24_hours" }] }), {}, "1.0");
    const converted: any = convertToUserTemplatePackage(source);
    expect(converted.protocols[0].drugs[0].schedule).toEqual(source.protocols[0].drugs[0].schedule);
    expect(converted.protocols[0].sourceDocument).toEqual(source.protocols[0]);
    expect(converted.protocols[0].sourceDocumentSha256).toBe(protocolContentSha256(source.protocols[0]));
    expect(resolveClinicalProtocol(converted.protocols[0], { ...context, day: 2 }).rows[0]).toMatchObject({ calculatedDose: 2, dailyDose: 4, frequency: 2 });
  });
  it.each([false, true])("legacy synthesis retains explicit root/extension frequency and base, extension=%s", extension => {
    const explicit = { administrationFrequency: { administrationsPerDay: 2, doseRepresents: "per_24_hours" } };
    const d: any = drug({ schedule: undefined }); delete d.schedule; delete d.administrationFrequency;
    Object.assign(d, extension ? { extensions: explicit } : explicit);
    const converted: any = convertToUserTemplatePackage(raw(d, {}, "1.0"));
    expect(resolveClinicalProtocol(converted.protocols[0], context)).toMatchObject({ prescriptionBlocked: false,
      rows: [{ frequency: 2, calculatedDose: 5, dailyDose: 10 }] });
  });
  it("extension schedule survives conversion and executes its own explicit dose", () => {
    const d: any = drug({ days: "2" }); delete d.schedule;
    d.extensions = { schedule: [{ dose: 4, days: [2], administrationsPerDay: 2 }] };
    const converted: any = convertToUserTemplatePackage(raw(d, {}, "1.0"));
    expect(converted.protocols[0].drugs[0].schedule).toBeUndefined();
    expect(resolveClinicalProtocol(converted.protocols[0], { ...context, day: 2 })).toMatchObject({ prescriptionBlocked: false, rows: [{ calculatedDose: 4, dailyDose: 8 }] });
  });
  it("conflicting legacy days and structured calendar block without rewriting either", () => {
    const source = raw(drug({ schedule: [{ dose: 4, days: [2] }] }), {}, "1.0");
    const converted: any = convertToUserTemplatePackage(source);
    expect(converted.protocols[0].drugs[0].schedule).toEqual([{ dose: 4, days: [2] }]);
    expect(converted.protocols[0].drugs[0].days).toBe("1");
    expect(validateImportFormat(converted)).toEqual([]);
    expect(resolveClinicalProtocol(converted.protocols[0], { ...context, day: 2 }).prescriptionBlocked).toBe(true);
  });
  it("empty explicit schedule never gets synthesized", () => {
    const converted: any = convertToUserTemplatePackage(raw(drug({ schedule: [] }), {}, "1.0"));
    expect(converted.protocols[0].drugs[0].schedule).toEqual([]);
    expect(resolveClinicalProtocol(converted.protocols[0], context).prescriptionBlocked).toBe(true);
  });
});

// Catches unitless 0.01 tolerance, zero/nonfinite inputs and silent clinical rounding.
describe("P1-08 supplied dose precision", () => {
  for (const unit of ["mg", "mcg", "UI"]) {
    for (const field of ["baseDose", "calculatedDose", "finalDose", "dailyDose"]) {
      it.each([0, -0.001, NaN, Infinity, 0.009])(`rejects ${unit} ${field}=%s for a 0.001 positive order`, supplied => {
        const document = make(drug({ dose: 0.001, doseUnit: unit, schedule: [{ dose: 0.001, days: [1] }] }));
        const payload = request(document, 0.001, unit);
        (payload.prescriptionData.drugs[0] as any)[field] = supplied;
        expect(() => validateActiveTemplatePrescription(payload as any, stored(document), 7)).toThrow(/dose|diária/i);
      });
    }
    it(`retains exact small ${unit} result in authoritative return`, () => {
      const document = make(drug({ dose: 0.005, doseUnit: unit, schedule: [{ dose: 0.005, days: [1] }] }));
      expect(validateActiveTemplatePrescription(request(document, 0.005, unit) as any, stored(document), 7)?.drugs[0]).toMatchObject({ dose: 0.005, calculatedDose: 0.005, dailyDose: 0.01 });
    });
  }
  it("accepts representational FP noise but returns the exact reexecuted numbers", () => {
    const document = make(drug({ dose: 0.3, schedule: [{ dose: 0.3, days: [1] }] }));
    const payload = request(document, 0.3); payload.prescriptionData.drugs[0].finalDose = 0.1 + 0.2;
    expect(validateActiveTemplatePrescription(payload as any, stored(document), 7)?.drugs[0].calculatedDose).toBe(0.3);
  });
  it("rejects decimal rounding without an explicit clinical rounding contract", () => {
    const document = make(drug({ dose: 1.2345, schedule: [{ dose: 1.2345, days: [1] }] }));
    const payload = request(document, 1.2345); payload.prescriptionData.drugs[0].finalDose = 1.23;
    expect(() => validateActiveTemplatePrescription(payload as any, stored(document), 7)).toThrow(/dose/i);
  });
});
