import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as seed from "./seedSystemProtocols";
import {
  getClinicalPrescriptionBlock,
  resolveClinicalProtocol,
} from "../shared/clinicalProtocols/resolver";
import drafts from "../shared/data/clinicalProtocols.json";

const source = JSON.parse(
  readFileSync(
    new URL(
      "../tests/fixtures/user-templates-source-2026-11-14.json",
      import.meta.url
    ),
    "utf8"
  )
);
const convert = (raw: unknown): any => {
  expect((seed as any).convertToUserTemplatePackage).toBeTypeOf("function");
  return (seed as any).convertToUserTemplatePackage(raw);
};
const one = () => ({
  version: "2.18",
  references: [{ id: "test", url: "https://example.invalid" }],
  protocols: [
    {
      id: "test",
      name: "Software fixture",
      indication: "Not for clinical use",
      cycles: 2,
      cycleLength: 21,
      drugs: [
        {
          id: "drug",
          name: "Fixture",
          dose: 10,
          doseUnit: "mg/m²",
          route: "IV",
          days: "1",
          administrationFrequency: { administrationsPerDay: 1 },
          schedule: [{ dose: 10, days: [1] }],
        },
      ],
    },
  ],
});

// Catches lost source/envelope fields, conflated plans and accidental fake approval.
describe("lossless user template conversion", () => {
  it("keeps a descriptive BrECADD calendar unresolved instead of inventing day/frequency", () => {
    const p = structuredClone(source.packages[1]);
    p.protocols = [p.protocols[0]];
    p.protocols[0].drugs[0].days = "1 ou 2 conforme resposta";
    const result = convert(p);
    expect(result.protocols[0].drugs[0].schedule).toBeUndefined();
    const resolution = resolveClinicalProtocol(result.protocols[0], {
      cycle: 1,
      bsa: 2,
      weight: 70,
    });
    expect(resolution.rows[0].status).toBe("blocked");
    expect(resolution.prescriptionBlocked).toBe(true);
  });
  it.each(["UI", "UI/kg", "UI/m²", "mg/m2"])(
    "preserves explicit %s without treating it as milligrams",
    doseUnit => {
      const p = one();
      p.protocols[0].drugs[0].doseUnit = doseUnit;
      const result = convert(p);
      const resolution = resolveClinicalProtocol(result.protocols[0], {
        cycle: 1,
        bsa: 2,
        weight: 70,
      });
      expect(resolution.rows[0].doseUnit).toBe(doseUnit);
      expect(resolution.rows[0].resultUnit).toBe(
        doseUnit.startsWith("UI") ? "UI" : "mg"
      );
      expect(resolution.prescriptionBlocked).toBe(false);
    }
  );
  it("converts the actual 51+2 documents, keeping separate original envelopes and every original field", () => {
    const original = structuredClone(source);
    const result = convert(source);
    expect(result.packages.map((p: any) => p.protocols.length)).toEqual([
      51, 2,
    ]);
    for (let p = 0; p < 2; p++) {
      const { protocols, ...envelope } = original.packages[p];
      expect(result.packages[p].version).toBe("user-protocol-template-1.0");
      expect(result.packages[p].sourceEnvelope).toEqual(envelope);
      expect(result.packages[p].metadata).toMatchObject({
        importMode: "user_template",
        sourceVersion: envelope.version,
        sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      for (let d = 0; d < protocols.length; d++) {
        const document = result.packages[p].protocols[d];
        expect(document.sourceDocument).toEqual(protocols[d]);
        expect(document.templateUsage).toEqual({
          kind: "user_managed",
          status: "active",
          prescriptionEnabled: true,
        });
        expect(document.review).toEqual(protocols[d].review);
        expect(document.extensions).toEqual(protocols[d].extensions);
        if (p === 0) expect(document.drugs).toEqual(protocols[d].drugs);
      }
    }
    expect(result.packages[1].protocols.map((d: any) => d.cycles)).toEqual([
      4, 6,
    ]);
    expect(result.packages[1].protocols[0].id).not.toBe(
      result.packages[1].protocols[1].id
    );
    expect(seed.validateImportFormat(result)).toEqual([]);
    expect(source).toEqual(original);
  });
  it("maps only explicit static BrECADD calendars and keeps maxDose numeric", () => {
    const result = convert(source);
    const document = result.packages[1].protocols[0];
    expect(document.drugs).toHaveLength(6);
    expect(document.drugs[1].schedule).toEqual([
      {
        dose: 150,
        doseUnit: "mg/m²",
        days: [1, 2, 3],
        timeOrigin: "cycle_day_one",
        administrationsPerDay: 1,
        doseRepresents: "per_administration",
      },
    ]);
    expect(document.drugs[4].schedule[0].days).toEqual([2, 3]);
    expect(document.drugs[0].maxDose).toBe(180);
    const resolution = resolveClinicalProtocol(document, {
      cycle: 1,
      day: 1,
      bsa: 2,
      weight: 120,
    });
    expect(resolution.prescriptionBlocked).toBe(false);
    expect(
      resolution.rows.find(r => r.source.name === "Brentuximabe Vedotina")
        ?.calculatedDose
    ).toBe(180);
    expect(
      resolution.rows.find(r => r.source.name === "Etoposídeo")?.calculatedDose
    ).toBe(300);
    expect(document.specialAlerts).toEqual(
      source.packages[1].protocols[0].specialAlerts
    );
  });
  it("stores bounded deterministic owner-scoped template identities and losslessly roundtrips mixed exports", () => {
    const normalized = convert(source);
    const records = seed.convertImportToDbRecords(normalized, 71);
    expect(records).toHaveLength(53);
    expect(
      records.every(
        r => r.protocolId.startsWith("template-") && r.protocolId.length <= 128
      )
    ).toBe(true);
    expect(
      seed.convertImportToDbRecords(normalized, 71).map(r => r.protocolId)
    ).toEqual(records.map(r => r.protocolId));
    expect(
      seed.convertImportToDbRecords(normalized, 72)[0].protocolId
    ).not.toBe(records[0].protocolId);
    expect(seed.exportProtocolPackage(records)).toEqual(normalized);
    const changed = structuredClone(source);
    changed.packages[0].exportedAt = "2099-01-01";
    expect(
      seed.convertImportToDbRecords(convert(changed), 71)[0].protocolId
    ).toBe(records[0].protocolId);
    changed.packages[0].references[0].title = "changed source";
    expect(
      seed.convertImportToDbRecords(convert(changed), 71)[0].protocolId
    ).not.toBe(records[0].protocolId);
    const mixed: any = seed.exportProtocolPackage([
      ...records,
      ...seed.convertImportToDbRecords(drafts as any, 71),
    ]);
    expect(mixed.packages).toHaveLength(3);
    expect(seed.validateImportFormat(mixed)).toEqual([]);
  });
  it("keeps all original drafts strict even with a templateUsage payload", () => {
    expect(seed.validateImportFormat(drafts)).toEqual([]);
    for (const d of drafts.protocols)
      expect(getClinicalPrescriptionBlock(d as any).length).toBeGreaterThan(0);
    const spoofed: any = structuredClone(drafts);
    spoofed.protocols[0].templateUsage = {
      kind: "user_managed",
      status: "active",
      prescriptionEnabled: true,
    };
    expect(seed.validateImportFormat(spoofed).length).toBeGreaterThan(0);
    const edited: any = structuredClone(drafts);
    edited.protocols[0].calculationPolicy.automaticPrescriptionAllowed = true;
    expect(seed.validateImportFormat(edited).length).toBeGreaterThan(0);
  });
  it.each([0, -1, NaN, Infinity])(
    "rejects malformed template dose %s",
    dose => {
      const p = one();
      p.protocols[0].drugs[0].dose = dose;
      expect(() => convert(p)).toThrow();
    }
  );
  it("rejects invalid nested units and missing dose rather than using sourceDocument to bypass validation", () => {
    const p: any = one();
    p.protocols[0].extensions = {
      phaseLibrary: [
        {
          id: "p",
          name: "p",
          drugs: [{ ...p.protocols[0].drugs[0], doseUnit: "bad" }],
        },
      ],
    };
    expect(() => convert(p)).toThrow();
    p.protocols[0].extensions.phaseLibrary[0].drugs[0].doseUnit = "mg";
    delete p.protocols[0].extensions.phaseLibrary[0].drugs[0].dose;
    expect(() => convert(p)).toThrow();
  });
  it("preserves null sourced dose without fabricating an age decision and leaves resolution blocked", () => {
    const p: any = one();
    p.protocols[0].drugs[0].dose = null;
    p.protocols[0].drugs[0].schedule[0].dose = null;
    const normalized = convert(p);
    expect(seed.validateImportFormat(normalized)).toEqual([]);
    expect(normalized.protocols[0].sourceDocument).toEqual(p.protocols[0]);
    const result = resolveClinicalProtocol(normalized.protocols[0], {
      cycle: 1,
      bsa: 2,
    });
    expect(result.rows[0].status).toBe("blocked");
    expect(result.rows[0].calculatedDose).toBeNull();
  });
  it("rejects source versions other than explicit 2.18/BrECADD and never converts legacy or drafts implicitly", () => {
    const p: any = one();
    p.version = "1.0";
    expect(() => convert(p)).toThrow();
    expect(() => convert(drafts)).toThrow();
    expect(() => seed.parseProtocolImport(JSON.stringify(source))).toThrow();
  });
});
