import { describe, it, expect } from "vitest";
import { createPrescriptionInputSchema } from "./prescriptionSchema";
const input = (gfr?: number) => ({
  patientId: 7,
  patientName: "Fictício",
  protocolName: "Fixture independente AUC",
  cycle: 1,
  bsa: 2.28,
  egfr: 86.2,
  renalStatus: "green",
  prescriptionData: {
    patient: {
      name: "Fictício",
      age: 60,
      sex: "M",
      weight: 100,
      height: 190,
      creatinine: 1,
      ecog: 0,
    },
    protocol: {
      id: "custom-independent-auc",
      name: "Fixture independente AUC",
      calvertGfrAbsolute: gfr,
    },
    calculatedValues: { bsa: 2.28, egfr: 86.2, renalStatus: "green" },
    drugs: [
      {
        name: "Fixture AUC",
        baseDose: 5,
        doseUnit: "AUC",
        calculatedDose: 693,
        finalDose: 693,
        resultUnit: "mg",
        route: "IV",
        days: "1",
      },
    ],
  },
});
describe("P1 Calvert no contrato de criação", () => {
  it("não libera AUC apenas porque eGFR indexado é positivo", () => {
    expect(createPrescriptionInputSchema.safeParse(input()).success).toBe(
      false
    );
  });
  it("preserva a entrada absoluta, separada do eGFR de referência", () => {
    const data = createPrescriptionInputSchema.parse(input(113.6));
    expect(data.prescriptionData.protocol).toHaveProperty(
      "calvertGfrAbsolute",
      113.6
    );
    expect(data.prescriptionData.calculatedValues.egfr).toBe(86.2);
  });
  it.each([0, -1, NaN, Infinity])("não aceita GFR absoluto %s", gfr => {
    expect(createPrescriptionInputSchema.safeParse(input(gfr)).success).toBe(
      false
    );
  });
});
