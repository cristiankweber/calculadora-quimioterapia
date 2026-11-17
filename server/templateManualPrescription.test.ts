import { describe, expect, it } from "vitest";
import { validateActiveTemplatePrescription } from "./activeTemplatePrescription";
import {
  createPrescriptionInputSchema,
  normalizeLegacyPayload,
} from "./prescriptionSchema";
import { resolveClinicalProtocol } from "../shared/clinicalProtocols/resolver";
import { mapResolvedTemplateDrugs } from "../shared/clinicalProtocols/templates";
import { calculateBSA } from "../shared/clinicalDoseEngine";
import type { ClinicalProtocolDocument } from "../shared/clinicalProtocols/types";

function setup(extra: Record<string, unknown> = {}) {
  const document: ClinicalProtocolDocument = {
    id: "manual-server-fixture",
    name: "Synthetic",
    indication: "Software only",
    cycles: 2,
    cycleLength: 21,
    templateUsage: {
      kind: "user_managed",
      status: "active",
      prescriptionEnabled: true,
    },
    sourceDocument: { id: "original", unrelated: { keep: [1, 2] } },
    drugs: [
      {
        id: "d",
        name: "Drug",
        dose: 20,
        doseUnit: "mg",
        route: "IV",
        days: "1",
        schedule: [
          {
            dose: 20,
            days: [1],
            administrationsPerDay: 2,
            doseRepresents: "per_24_hours",
          },
        ],
        ...extra,
      },
    ],
  };
  const patient = {
    name: "Fictício",
    age: 40,
    sex: "M" as const,
    weight: 70,
    height: 170,
    creatinine: 1,
    ecog: 0,
  };
  const r = resolveClinicalProtocol(document, {
    cycle: 1,
    day: 1,
    weight: 70,
    bsa: calculateBSA(70, 170),
    egfr: 0,
  });
  // Set context-derived identity from the real server inputs rather than a client-provided calculation.
  const payload: any = {
    patientId: 1,
    patientName: "Fictício",
    protocolName: "Synthetic",
    cycle: 1,
    bsa: 1.8,
    egfr: 90,
    renalStatus: "green",
    prescriptionData: {
      patient,
      protocol: {
        id: "template-test",
        name: "Synthetic",
        templateContext: { cycle: 1, day: 1 },
      },
      calculatedValues: { bsa: 1.8, egfr: 90, renalStatus: "green" },
      drugs: mapResolvedTemplateDrugs(r).map(d => ({ ...d, baseDose: d.dose })),
      audit: {
        version: 2,
        manualDoseOverrides: [
          {
            rowKey: "forged",
            drugName: "Fake",
            originalDose: 99,
            manualDose: 88,
            reason: "client audit",
          },
        ],
      },
    },
  };
  const stored = {
    userId: 7,
    protocolId: "template-test",
    name: "Synthetic",
    isActive: 1,
    clinicalDocument: document,
    clinicalPackage: { version: "user-protocol-template-1.0" },
  };
  return { document, payload, stored };
}
const adjusted = () => {
  const s = setup();
  Object.assign(s.payload.prescriptionData.drugs[0], {
    finalDose: 7.5,
    prescribedDailyDose: 15,
    adjustmentReason: "  decisão individual  ",
    isManualDose: false,
  });
  return s;
};

// Catches server trusting client flags/audit or overwriting final with recalculated baseline.
describe("templateManual authoritative prescription", () => {
  it("returns adjusted final and canonical baseline with a server-derived audit", () => {
    const { payload, stored, document } = adjusted();
    const before = structuredClone(stored);
    const result: any = validateActiveTemplatePrescription(payload, stored, 7);
    expect(result.drugs[0]).toMatchObject({
      dose: 20,
      baseDose: 20,
      calculatedDose: 10,
      finalDose: 7.5,
      dailyDose: 20,
      prescribedDailyDose: 15,
      isManualDose: true,
      adjustmentReason: "decisão individual",
      rowKey: expect.any(String),
    });
    expect(result.manualDoseOverrides).toEqual([
      {
        rowKey: result.drugs[0].rowKey,
        drugName: "Drug",
        originalDose: 10,
        manualDose: 7.5,
        reason: "decisão individual",
      },
    ]);
    expect(result.document).toEqual(document);
    expect(stored).toEqual(before);
  });
  it("derives absence of adjustment instead of trusting client boolean and audit", () => {
    const { payload, stored } = setup();
    payload.prescriptionData.drugs[0].isManualDose = true;
    const result: any = validateActiveTemplatePrescription(payload, stored, 7);
    expect(result.drugs[0]).toMatchObject({
      finalDose: 10,
      isManualDose: false,
      prescribedDailyDose: 20,
    });
    expect(result.manualDoseOverrides).toEqual([]);
  });
  it.each(["", " ", undefined, "x".repeat(1001)])(
    "rejects a final change without valid reason %s",
    adjustmentReason => {
      const { payload, stored } = adjusted();
      payload.prescriptionData.drugs[0].adjustmentReason = adjustmentReason;
      try {
        validateActiveTemplatePrescription(payload, stored, 7);
        expect.fail("Missing/invalid manual reason must block");
      } catch (error) {
        expect(error).toMatchObject({ code: "BAD_REQUEST" });
      }
    }
  );
  it.each([0, -1, NaN, Infinity])(
    "rejects nonpositive/nonfinite final %s even with reason",
    finalDose => {
      const { payload, stored } = adjusted();
      payload.prescriptionData.drugs[0].finalDose = finalDose;
      expect(() =>
        validateActiveTemplatePrescription(payload, stored, 7)
      ).toThrow();
    }
  );
  it.each([
    "baseDose",
    "calculatedDose",
    "dailyDose",
    "frequency",
    "name",
    "route",
    "days",
    "doseUnit",
    "resultUnit",
    "timeOrigin",
    "doseRepresents",
  ])("rejects immutable %s tampering despite explicit manual reason", field => {
    const { payload, stored } = adjusted();
    const drug = payload.prescriptionData.drugs[0];
    drug[field] = typeof drug[field] === "number" ? drug[field] + 1 : "forged";
    expect(() =>
      validateActiveTemplatePrescription(payload, stored, 7)
    ).toThrow();
  });
  it.each([undefined, "", "forged"])(
    "rejects missing/tampered manual rowKey %s",
    rowKey => {
      const { payload, stored } = adjusted();
      payload.prescriptionData.drugs[0].rowKey = rowKey;
      expect(() =>
        validateActiveTemplatePrescription(payload, stored, 7)
      ).toThrow();
    }
  );
  it("rejects orphan row keys even when final is baseline", () => {
    const { payload, stored } = setup();
    payload.prescriptionData.drugs[0].rowKey = "orphan";
    expect(() =>
      validateActiveTemplatePrescription(payload, stored, 7)
    ).toThrow();
  });
  it.each([undefined, 20, 14.999])(
    "requires prescribedDailyDose to equal the derived adjusted total %s",
    prescribedDailyDose => {
      const { payload, stored } = adjusted();
      payload.prescriptionData.drugs[0].prescribedDailyDose =
        prescribedDailyDose;
      expect(() =>
        validateActiveTemplatePrescription(payload, stored, 7)
      ).toThrow();
    }
  );
  it("enforces document cap, not a forged payload maxDose", () => {
    const { payload, stored } = setup({ maxDose: 12, maxDoseUnit: "mg" });
    Object.assign(payload.prescriptionData.drugs[0], {
      finalDose: 13,
      prescribedDailyDose: 26,
      adjustmentReason: "individual",
      maxDose: 999,
    });
    expect(() =>
      validateActiveTemplatePrescription(payload, stored, 7)
    ).toThrow();
  });
  it("keeps total-for-infusion daily baseline and prescribed total null", () => {
    const { payload, stored } = setup({
      schedule: [
        {
          dose: 20,
          days: [1],
          administrationsPerDay: 3,
          continuousInfusion: true,
          doseRepresents: "total_for_this_infusion",
        },
      ],
    });
    Object.assign(payload.prescriptionData.drugs[0], {
      finalDose: 15,
      prescribedDailyDose: null,
      adjustmentReason: "individual",
    });
    const result: any = validateActiveTemplatePrescription(payload, stored, 7);
    expect(result.drugs[0]).toMatchObject({
      calculatedDose: 20,
      finalDose: 15,
      dailyDose: null,
      prescribedDailyDose: null,
    });
    payload.prescriptionData.drugs[0].prescribedDailyDose = 45;
    expect(() =>
      validateActiveTemplatePrescription(payload, stored, 7)
    ).toThrow();
  });
  it("canonicalizes a consistent manualDoseValue alias but rejects a parallel dose", () => {
    const { payload, stored } = adjusted();
    payload.prescriptionData.drugs[0].manualDoseValue = 7.5;
    expect(
      validateActiveTemplatePrescription(payload, stored, 7)?.drugs[0]
        .manualDoseValue
    ).toBe(7.5);
    payload.prescriptionData.drugs[0].manualDoseValue = 9;
    expect(() =>
      validateActiveTemplatePrescription(payload, stored, 7)
    ).toThrow();
  });
  it("keeps legacy baseline-only payload readable without granting manual dose", () => {
    const { payload, stored } = setup();
    delete payload.prescriptionData.drugs[0].rowKey;
    delete payload.prescriptionData.drugs[0].prescribedDailyDose;
    expect(
      validateActiveTemplatePrescription(payload, stored, 7)?.drugs[0]
    ).toMatchObject({ finalDose: 10, prescribedDailyDose: 20 });
  });
  it("preserves manual identity, reason, daily total and audit through schema and normalization", () => {
    const { payload } = adjusted();
    const key = payload.prescriptionData.drugs[0].rowKey;
    payload.prescriptionData.audit.manualDoseOverrides = [
      {
        rowKey: key,
        drugName: "Drug",
        originalDose: 10,
        manualDose: 7.5,
        reason: "decisão individual",
      },
    ];
    const parsed = createPrescriptionInputSchema.parse(payload);
    expect(parsed.prescriptionData.drugs[0]).toMatchObject({
      rowKey: key,
      adjustmentReason: "decisão individual",
      prescribedDailyDose: 15,
    });
    expect(
      parsed.prescriptionData.audit?.manualDoseOverrides?.[0]
    ).toMatchObject({ rowKey: key });
    expect(
      normalizeLegacyPayload(parsed.prescriptionData)?.drugs[0]
    ).toMatchObject({
      rowKey: key,
      finalDose: 7.5,
      calculatedDose: 10,
      prescribedDailyDose: 15,
    });
  });
});
