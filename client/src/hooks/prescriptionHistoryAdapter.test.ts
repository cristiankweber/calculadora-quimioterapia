import { describe, it, expect } from "vitest";
import {
  readPrescriptionHistory,
  preparePrescriptionReuse,
} from "./prescriptionHistoryAdapter";
import type { PatientData, Protocol } from "@/types/calculator";
const patient = {
  name: "Fictício",
  age: 50,
  sex: "M",
  weight: 70,
  height: 170,
  creatinine: 1,
  bilirubin: 1,
  ecog: 0,
  comorbidities: "",
  calvertGfrAbsolute: 99,
} as PatientData;
const current = {
  id: "custom-fixture",
  name: "Cadastro atual",
  cycles: 6,
  cycleLength: 21,
  drugs: [{ name: "Atual", dose: 20, doseUnit: "mg", route: "IV", days: "1" }],
} as Protocol;
describe("Histórico v1/v2 é snapshot, não cadastro executável", () => {
  it("lê v1 de string sem perder biometria, dose manual e ciclo", () => {
    const s = readPrescriptionHistory(
      JSON.stringify({
        patientData: patient,
        protocol: { id: current.id, name: "Versão antiga" },
        cycle: 3,
        calculatedDrugs: [
          {
            name: "Anterior",
            dose: 10,
            doseUnit: "mg/m²",
            calculatedDose: 7,
            resultUnit: "mg",
            days: "D1",
            route: "IV",
          },
        ],
      })
    );
    expect(s.patient).toMatchObject({ name: "Fictício", weight: 70 });
    expect(s.cycle).toBe(3);
    expect(s.drugs[0]).toMatchObject({
      name: "Anterior",
      baseDose: 10,
      finalDose: 7,
      resultUnit: "mg",
      days: "D1",
    });
    expect(s.protocol).not.toHaveProperty("drugs");
  });
  it("preserva dias numéricos v2 em uma descrição legível, inclusive D0", () => {
    const s = readPrescriptionHistory({
      patient,
      protocol: {
        id: current.id,
        cycle: 2,
        templateContext: {
          cycle: 2,
          phaseId: "fase",
          day: 0,
          gfrForCalvert: 80,
        },
      },
      drugs: [
        {
          name: "Fixture",
          finalDose: 0.005,
          resultUnit: "mg",
          days: [0, 1],
          frequency: 2,
          dailyDose: 0.01,
        },
      ],
    });
    expect(s.context).toMatchObject({
      cycle: 2,
      phaseId: "fase",
      day: 0,
      gfrForCalvert: 80,
    });
    expect(s.drugs[0]).toMatchObject({
      finalDose: 0.005,
      days: "0, 1",
      frequency: 2,
      dailyDose: 0.01,
    });
  });
  it("lê o campo schedule quando days não está registrado", () => {
    const s = readPrescriptionHistory({
      patient,
      protocol: { id: current.id },
      drugs: [{ name: "Fixture", finalDose: 7, schedule: "D1-D3" }],
    });
    expect(s.drugs[0].days).toBe("D1-D3");
  });
  it("para nova execução usa só o cadastro atual íntegro, limpa GFR e não altera o snapshot", () => {
    const original = {
      patient,
      protocol: {
        id: current.id,
        name: "Antigo",
        cycle: 2,
        templateContext: {
          cycle: 2,
          phaseId: "fase",
          day: 0,
          gfrForCalvert: 80,
        },
      },
      drugs: [{ name: "Antigo", finalDose: 7 }],
    };
    const s = readPrescriptionHistory(original);
    const reuse = preparePrescriptionReuse(patient, s, [current]);
    expect(reuse.protocol?.drugs).toEqual(current.drugs);
    expect(reuse.patient.calvertGfrAbsolute).toBeUndefined();
    expect(reuse.context).toEqual({ cycle: 2, phaseId: "fase", day: 0 });
    expect(original.protocol.templateContext.gfrForCalvert).toBe(80);
    expect(original.drugs[0].finalDose).toBe(7);
  });
  it("sem cadastro íntegro nunca transforma o protocolo parcial em nova prescrição", () => {
    const s = readPrescriptionHistory({
      patient,
      protocol: { id: current.id, cycle: 2 },
      drugs: [],
    });
    expect(preparePrescriptionReuse(patient, s, []).protocol).toBeNull();
    expect(
      preparePrescriptionReuse(patient, s, [
        { id: current.id, name: "Parcial" } as Protocol,
      ]).protocol
    ).toBeNull();
  });
});

it("não associa snapshot de identidade diferente ao paciente atual na reutilização", () => {
  const s = readPrescriptionHistory({
    patient: { ...patient, name: "Outra identidade" },
    protocol: { id: current.id, cycle: 4 },
    drugs: [{ name: "Antigo", finalDose: 7 }],
  });
  const reuse = preparePrescriptionReuse(patient, s, [current]);
  expect(reuse.patient.name).toBe("Fictício");
  expect(reuse.protocol).toBeNull();
  expect(reuse.context).toEqual({ cycle: 1 });
  expect(reuse.warning).toMatch(/identidade|diverge/i);
});
it("mantém idade atual do cadastro autorizado, sem reescrever o snapshot antigo", () => {
  const original = {
    patient: { ...patient, age: 49 },
    protocol: { id: current.id, cycle: 2 },
    drugs: [],
  };
  const reuse = preparePrescriptionReuse(
    patient,
    readPrescriptionHistory(original),
    [current]
  );
  expect(reuse.patient.age).toBe(50);
  expect(original.patient.age).toBe(49);
});
