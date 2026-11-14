import { describe, expect, it } from "vitest";
import { createPrescriptionInputSchema } from "./prescriptionSchema";
const input = () => ({
  patientId: 1,
  patientName: "Fictício",
  protocolName: "R-DHAP",
  cycle: 1,
  bsa: 1.8,
  egfr: 90,
  renalStatus: "green",
  prescriptionData: {
    patient: {
      name: "Fictício",
      age: 40,
      sex: "M",
      weight: 70,
      height: 170,
      creatinine: 1,
      ecog: 0,
    },
    protocol: {
      id: "template-external-abc",
      name: "R-DHAP",
      templateContext: {
        cycle: 1,
        phaseId: "phase-explicit",
        day: 2,
        gfrForCalvert: 80,
      },
    },
    calculatedValues: { bsa: 1.8, egfr: 90, renalStatus: "green" },
    drugs: [
      {
        name: "Dose teste",
        baseDose: 20,
        doseUnit: "mcg/m²",
        resultUnit: "mcg",
        calculatedDose: 36,
        finalDose: 36,
        route: "SC",
        days: "2",
        frequency: 1,
        dailyDose: 36,
        timeOrigin: "cycle_day_one",
        doseRepresents: "per_administration",
      },
    ],
  },
});
describe("Contrato do template é validado no registro server-side", () => {
  it("aceita o identificador de template para revalidação server-side e preserva contexto", () => {
    const r = createPrescriptionInputSchema.safeParse(input());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.prescriptionData.protocol).toHaveProperty(
        "templateContext",
        { cycle: 1, phaseId: "phase-explicit", day: 2, gfrForCalvert: 80 }
      );
      expect(r.data.prescriptionData.drugs[0]).toMatchObject({
        resultUnit: "mcg",
        frequency: 1,
        dailyDose: 36,
        timeOrigin: "cycle_day_one",
      });
    }
  });
  it("não aceita o mesmo nome quando o identificador é um rascunho antigo", () => {
    const x = input();
    x.prescriptionData.protocol.id = "clinical-HEM-019";
    expect(createPrescriptionInputSchema.safeParse(x).success).toBe(false);
  });
});
