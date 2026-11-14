import { describe, expect, it } from "vitest";
import { resolveClinicalProtocol } from "./resolver";
import type { ClinicalProtocolDocument } from "./types";
describe("Unidade e base da etapa resolvida", () => {
  it("transmite a unidade da agenda e a definição de dose de 24h para a interface e suporte", () => {
    const document = {
      id: "UNIT-FIXTURE",
      name: "Teste explícito de unidade",
      indication: "Teste",
      cycles: 1,
      cycleLength: 21,
      review: { status: "draft_not_institutionally_approved" },
      calculationPolicy: { automaticPrescriptionAllowed: false },
      drugs: [
        {
          id: "drug",
          name: "Fármaco",
          dose: 10,
          doseUnit: "mg/m²",
          route: "IV",
          days: "1",
          administrationFrequency: {
            administrationsPerDay: 2,
            doseRepresents: "per_administration",
          },
          schedule: [
            {
              dose: 20,
              doseUnit: "mcg/kg",
              days: [1],
              doseRepresents: "per_24_hours",
            },
          ],
        },
      ],
    } as ClinicalProtocolDocument;
    const result = resolveClinicalProtocol(document, {
      cycle: 1,
      day: 1,
      bsa: 1.8,
      weight: 70,
    });
    expect(result.rows[0]).toMatchObject({
      doseUnit: "mcg/kg",
      resultUnit: "mcg",
      doseRepresents: "per_24_hours",
      calculatedDose: 700,
      dailyDose: 1400,
    });
  });
});
