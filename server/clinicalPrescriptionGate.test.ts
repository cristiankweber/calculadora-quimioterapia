import { describe, expect, it } from "vitest";
import { createPrescriptionInputSchema } from "./prescriptionSchema";

function payload(name = "R-DHAP", id = "historical-r-dhap") {
  return {
    patientId: 1,
    patientName: "Paciente fictício",
    protocolName: name,
    cycle: 1,
    bsa: 1.8,
    egfr: 90,
    renalStatus: "green",
    prescriptionData: {
      patient: {
        name: "Paciente fictício",
        age: 40,
        sex: "M",
        weight: 70,
        height: 175,
        creatinine: 1,
        ecog: 0,
      },
      protocol: { id, name },
      calculatedValues: { bsa: 1.8, egfr: 90, renalStatus: "green" },
      drugs: [
        {
          name: "Cisplatina",
          baseDose: 100,
          finalDose: 180,
          doseUnit: "mg/m²",
          route: "IV",
        },
      ],
    },
  };
}

describe("Bloqueio de rascunhos em novas prescrições", () => {
  it("bloqueia o R-DHAP histórico mesmo sem os novos campos clínicos", () => {
    expect(createPrescriptionInputSchema.safeParse(payload()).success).toBe(
      false
    );
  });
  it("bloqueia identificador da biblioteca clínica com nome adulterado", () => {
    expect(
      createPrescriptionInputSchema.safeParse(
        payload("Nome adulterado", "clinical-HEM-019")
      ).success
    ).toBe(false);
  });
  it("não deixa nomes externo e interno divergentes contornarem o bloqueio", () => {
    const input = payload("R-DHAP");
    input.prescriptionData.protocol.name = "Protocolo novo";
    expect(createPrescriptionInputSchema.safeParse(input).success).toBe(false);
  });
  it("preserva a política de um rascunho importado de nome não conhecido", () => {
    const input = payload("Documento externo", "external-document");
    Object.assign(input.prescriptionData.protocol, {
      clinicalDocument: {
        id: "EXT-001",
        name: "Documento externo",
        calculationPolicy: { automaticPrescriptionAllowed: false },
        review: { status: "draft_not_institutionally_approved" },
      },
    });
    expect(createPrescriptionInputSchema.safeParse(input).success).toBe(false);
  });
  it("não bloqueia pelo nome um protocolo personalizado fora da biblioteca", () => {
    expect(
      createPrescriptionInputSchema.safeParse(
        payload("Protocolo personalizado independente", "custom-independent")
      ).success
    ).toBe(true);
  });
  it("um arquivo legado sem calendário/política clínica não vira rascunho por estar arquivado em JSON", () => {
    const input = payload(
      "Protocolo personalizado independente",
      "custom-independent"
    );
    Object.assign(input.prescriptionData.protocol, {
      clinicalDocument: {
        id: "custom-independent",
        name: "Protocolo personalizado independente",
        drugs: [{ name: "Droga", dose: 10, doseUnit: "mg" }],
      },
    });
    expect(createPrescriptionInputSchema.safeParse(input).success).toBe(true);
  });
});
