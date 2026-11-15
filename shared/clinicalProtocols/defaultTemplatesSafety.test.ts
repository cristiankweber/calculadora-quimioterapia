import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import { convertToUserTemplatePackage } from "../../server/seedSystemProtocols";
import { resolveClinicalProtocol } from "./resolver";
import { getTemplateExecutionDocument, mapResolvedTemplateDrugs } from "./templates";
import type { ClinicalContext, ClinicalProtocolDocument } from "./types";

const raw = JSON.parse(readFileSync(new URL("../../tests/fixtures/user-templates-source-2026-11-14.json", import.meta.url), "utf8"));
const converted: any = convertToUserTemplatePackage(raw);
const documents: ClinicalProtocolDocument[] = converted.packages.flatMap((p: any) => p.protocols);
// Bounded deterministic contract sweep, not medical adjudication of individual protocols.
// Catches source mutation, nonfinite output and partial release of blocked/default selections.
describe("53 default user templates: invariant classes", () => {
  it.each(documents)("$name preserves source and all-or-nothing safety across explicit contexts", document => {
    const before = structuredClone(document);
    const execution = getTemplateExecutionDocument(document);
    const phases = execution.phaseLibrary?.map(phase => phase.id) ?? [];
    const contexts: ClinicalContext[] = [1, 2, 4, 5, 6, 18].flatMap(cycle =>
      [undefined, -6, 0, 1, 2, 8, 15, 29, 100].flatMap(day =>
        [undefined, ...phases].map(phaseId => ({ cycle, day, phaseId, bsa: 2, weight: 70, gfrForCalvert: 60 }))));
    for (const context of contexts) {
      const resolution = resolveClinicalProtocol(document, context);
      expect(resolution).toEqual(resolveClinicalProtocol(document, context));
      const output = mapResolvedTemplateDrugs(resolution);
      if (resolution.prescriptionBlocked) expect(output).toEqual([]);
      else expect(output).toHaveLength(resolution.rows.filter(row => row.status === "ready").length);
      for (const row of resolution.rows) {
        expect(["ready", "blocked", "not_scheduled"]).toContain(row.status);
        expect(row.calculatedDose === null || Number.isFinite(row.calculatedDose)).toBe(true);
        expect(row.dailyDose === null || Number.isFinite(row.dailyDose)).toBe(true);
        if (row.status !== "ready") expect(row.calculatedDose).toBeNull();
        if (row.status === "blocked") expect(row.issues.length).toBeGreaterThan(0);
      }
    }
    expect(document).toEqual(before);
  });
});
