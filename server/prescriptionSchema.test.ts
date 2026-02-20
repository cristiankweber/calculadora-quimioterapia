/**
 * Testes de segurança e integridade para o schema de prescrições.
 *
 * Cobre:
 * - Rejeição de NaN, Infinity, negativos em doses
 * - Validação de campos obrigatórios
 * - Normalização de payloads legados (v1 → v2)
 * - validateDoseSafety
 * - createPrescriptionInputSchema
 */

import { describe, expect, it } from "vitest";
import {
  prescriptionDataSchemaV2,
  createPrescriptionInputSchema,
  validateDoseSafety,
  normalizeLegacyPayload,
} from "./prescriptionSchema";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function validPatient() {
  return {
    name: "João Silva",
    age: 55,
    sex: "M" as const,
    weight: 70,
    height: 170,
    creatinine: 1.0,
    bilirubin: 0.8,
    ecog: 1,
  };
}

function validProtocol() {
  return {
    id: "FOLFOX-6",
    name: "FOLFOX-6",
    category: "Colorretal",
    indication: "Câncer Colorretal Metastático",
    emetogenicRisk: "moderate",
    cycle: 1,
    totalCycles: 12,
  };
}

function validCalculatedValues() {
  return {
    bsa: 1.81,
    egfr: 94.6,
    renalStatus: "green",
    renalStatusLabel: "Normal",
    ecogAdjustmentFactor: 1.0,
    globalAdjustmentFactor: 1.0,
  };
}

function validDrug(overrides: Record<string, unknown> = {}) {
  return {
    name: "Oxaliplatina",
    baseDose: 85,
    doseUnit: "mg/m²",
    calculatedDose: 153.85,
    finalDose: 153.85,
    route: "IV",
    days: "1",
    ...overrides,
  };
}

function validPrescriptionData() {
  return {
    patient: validPatient(),
    protocol: validProtocol(),
    calculatedValues: validCalculatedValues(),
    drugs: [validDrug()],
    audit: {
      version: 2 as const,
      formulaVersions: {
        bsa: "DuBois",
        egfr: "CKD-EPI-2021",
        dose: "standard",
      },
      generatedAt: Date.now(),
    },
  };
}

// ─── prescriptionDataSchemaV2 ───────────────────────────────────────────────

describe("prescriptionDataSchemaV2", () => {
  it("aceita payload válido completo", () => {
    const result = prescriptionDataSchemaV2.safeParse(validPrescriptionData());
    expect(result.success).toBe(true);
  });

  it("rejeita NaN em dose de droga", () => {
    const data = validPrescriptionData();
    data.drugs[0].finalDose = NaN;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita Infinity em dose de droga", () => {
    const data = validPrescriptionData();
    data.drugs[0].calculatedDose = Infinity;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita dose negativa em droga", () => {
    const data = validPrescriptionData();
    data.drugs[0].finalDose = -10;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita BSA negativa", () => {
    const data = validPrescriptionData();
    data.calculatedValues.bsa = -1;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita eGFR negativa", () => {
    const data = validPrescriptionData();
    data.calculatedValues.egfr = -5;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita peso zero", () => {
    const data = validPrescriptionData();
    data.patient.weight = 0;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita altura negativa", () => {
    const data = validPrescriptionData();
    data.patient.height = -170;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita creatinina zero", () => {
    const data = validPrescriptionData();
    data.patient.creatinine = 0;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita nome do paciente vazio", () => {
    const data = validPrescriptionData();
    data.patient.name = "";
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita nome do protocolo vazio", () => {
    const data = validPrescriptionData();
    data.protocol.name = "";
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita array de drogas vazio", () => {
    const data = validPrescriptionData();
    data.drugs = [];
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita ECOG fora do range (> 4)", () => {
    const data = validPrescriptionData();
    data.patient.ecog = 6 as any;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita ECOG negativo", () => {
    const data = validPrescriptionData();
    data.patient.ecog = -1 as any;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejeita idade > 150", () => {
    const data = validPrescriptionData();
    data.patient.age = 200;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("aceita sexo M e F", () => {
    const dataM = validPrescriptionData();
    dataM.patient.sex = "M";
    expect(prescriptionDataSchemaV2.safeParse(dataM).success).toBe(true);

    const dataF = validPrescriptionData();
    dataF.patient.sex = "F";
    expect(prescriptionDataSchemaV2.safeParse(dataF).success).toBe(true);
  });

  it("rejeita sexo inválido", () => {
    const data = validPrescriptionData();
    (data.patient as any).sex = "X";
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("aceita campos opcionais ausentes", () => {
    const data = validPrescriptionData();
    delete (data as any).preMedications;
    delete (data as any).alerts;
    delete (data as any).notes;
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("aceita droga com campos opcionais", () => {
    const data = validPrescriptionData();
    data.drugs = [
      validDrug({
        maxDose: 200,
        diluent: "SF 0.9%",
        diluentVolume: "250 mL",
        infusionTime: "2h",
        notes: "Proteger da luz",
        isManualDose: false,
      }),
    ];
    const result = prescriptionDataSchemaV2.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ─── validateDoseSafety ─────────────────────────────────────────────────────

describe("validateDoseSafety", () => {
  it("retorna vazio para doses válidas", () => {
    const errors = validateDoseSafety([
      { name: "Oxaliplatina", finalDose: 153.85 },
      { name: "5-FU", finalDose: 2000 },
    ]);
    expect(errors).toHaveLength(0);
  });

  it("detecta NaN em finalDose", () => {
    const errors = validateDoseSafety([
      { name: "Oxaliplatina", finalDose: NaN },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Oxaliplatina");
    expect(errors[0]).toContain("não-finito");
  });

  it("detecta Infinity em calculatedDose", () => {
    const errors = validateDoseSafety([
      { name: "5-FU", calculatedDose: Infinity },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("5-FU");
  });

  it("detecta dose negativa", () => {
    const errors = validateDoseSafety([
      { name: "Cisplatina", finalDose: -50 },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("negativa");
  });

  it("ignora drogas sem dose definida", () => {
    const errors = validateDoseSafety([
      { name: "Dexametasona" },
    ]);
    expect(errors).toHaveLength(0);
  });

  it("detecta múltiplos erros", () => {
    const errors = validateDoseSafety([
      { name: "Drug1", finalDose: NaN },
      { name: "Drug2", finalDose: -10 },
      { name: "Drug3", finalDose: Infinity },
    ]);
    expect(errors).toHaveLength(3);
  });

  it("usa fallback: calculatedDose quando finalDose ausente", () => {
    const errors = validateDoseSafety([
      { name: "Drug", calculatedDose: NaN },
    ]);
    expect(errors).toHaveLength(1);
  });

  it("usa fallback: baseDose quando calculatedDose ausente", () => {
    const errors = validateDoseSafety([
      { name: "Drug", baseDose: -5 },
    ]);
    expect(errors).toHaveLength(1);
  });
});

// ─── normalizeLegacyPayload ─────────────────────────────────────────────────

describe("normalizeLegacyPayload", () => {
  it("retorna null para input null", () => {
    expect(normalizeLegacyPayload(null)).toBeNull();
  });

  it("retorna null para input undefined", () => {
    expect(normalizeLegacyPayload(undefined)).toBeNull();
  });

  it("retorna null para string", () => {
    expect(normalizeLegacyPayload("not an object")).toBeNull();
  });

  it("retorna null para objeto sem campos esperados", () => {
    expect(normalizeLegacyPayload({ foo: "bar" })).toBeNull();
  });

  it("normaliza payload v2 válido", () => {
    const data = validPrescriptionData();
    const result = normalizeLegacyPayload(data);
    expect(result).not.toBeNull();
    expect(result!.patient.name).toBe("João Silva");
  });

  it("retorna null para payload v1 incompleto", () => {
    const data = {
      patient: validPatient(),
      // Falta protocol, drugs, calculatedValues
    };
    expect(normalizeLegacyPayload(data)).toBeNull();
  });
});

// ─── createPrescriptionInputSchema ──────────────────────────────────────────

describe("createPrescriptionInputSchema", () => {
  function validInput() {
    return {
      patientId: 1,
      patientName: "João Silva",
      protocolName: "FOLFOX-6",
      cycle: 1,
      bsa: 1.81,
      egfr: 94.6,
      renalStatus: "green",
      prescriptionData: validPrescriptionData(),
    };
  }

  it("aceita input válido completo", () => {
    const result = createPrescriptionInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejeita patientId negativo", () => {
    const input = validInput();
    input.patientId = -1;
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita patientId zero", () => {
    const input = validInput();
    input.patientId = 0;
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita patientName vazio", () => {
    const input = validInput();
    input.patientName = "";
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita protocolName vazio", () => {
    const input = validInput();
    input.protocolName = "";
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita cycle zero", () => {
    const input = validInput();
    input.cycle = 0;
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita BSA NaN", () => {
    const input = validInput();
    input.bsa = NaN;
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita eGFR negativa", () => {
    const input = validInput();
    input.egfr = -10;
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita renalStatus vazio", () => {
    const input = validInput();
    input.renalStatus = "";
    const result = createPrescriptionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
