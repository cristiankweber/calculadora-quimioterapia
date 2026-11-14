import { describe, expect, it } from "vitest";
import { validateActiveTemplatePrescription } from "./activeTemplatePrescription";
const doc = () => ({
  id: "EXT-TEMPLATE",
  name: "R-DHAP",
  indication: "Fixture explícita",
  cycles: 1,
  cycleLength: 21,
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
  drugs: [
    {
      id: "drug-a",
      name: "Droga A",
      dose: 10,
      doseUnit: "mg",
      route: "VO",
      days: "1",
      administrationFrequency: {
        administrationsPerDay: 2,
        doseRepresents: "per_administration",
        continuousInfusion: false,
        intervalHours: 12,
      },
      schedule: [{ dose: 10, days: [1] }],
    },
  ],
});
const stored = () => ({
  userId: 7,
  protocolId: "template-local-abc",
  name: "R-DHAP",
  isActive: 1,
  clinicalDocument: doc(),
  clinicalPackage: { version: "user-protocol-template-1.0" },
});
const payload = () => ({
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
      id: "template-local-abc",
      name: "R-DHAP",
      templateContext: { cycle: 1, day: 1 },
    },
    calculatedValues: { bsa: 1.8, egfr: 90, renalStatus: "green" },
    drugs: [
      {
        name: "Droga A",
        baseDose: 10,
        doseUnit: "mg",
        resultUnit: "mg",
        calculatedDose: 10,
        finalDose: 10,
        route: "VO",
        days: "1",
        frequency: 2,
        dailyDose: 20,
        timeOrigin: "cycle_day_one",
      },
    ],
  },
});
describe("Template usado para prescrever exige registro autorizado e doses revalidadas", () => {
  it("aceita seleção completamente resolvida de template ativo próprio, inclusive nome antes bloqueado", () => {
    const result = validateActiveTemplatePrescription(
      payload() as any,
      stored() as any,
      7
    );
    expect(result).not.toBeNull();
    expect(result?.drugs[0]).toMatchObject({
      calculatedDose: 10,
      frequency: 2,
      dailyDose: 20,
    });
  });
  it("rejeita prefixo de template sem registro armazenado", () => {
    expect(() =>
      validateActiveTemplatePrescription(payload() as any, undefined, 7)
    ).toThrow();
  });
  it("rejeita template pertencente a outro usuário", () => {
    expect(() =>
      validateActiveTemplatePrescription(payload() as any, stored() as any, 8)
    ).toThrow();
  });
  it("não transforma documento rascunho em template usando campos do navegador", () => {
    const s = stored();
    s.clinicalPackage.version = "2.1-source-reconciled-clinical-draft";
    expect(() =>
      validateActiveTemplatePrescription(payload() as any, s as any, 7)
    ).toThrow();
  });
  it("rejeita dose adulterada em uma ordem do template", () => {
    const p = payload();
    p.prescriptionData.drugs[0].finalDose = 15;
    expect(() =>
      validateActiveTemplatePrescription(p as any, stored() as any, 7)
    ).toThrow(/dose/i);
  });
  it("rejeita lista parcial ou vazia sem persistir a seleção", () => {
    const p = payload();
    p.prescriptionData.drugs = [];
    expect(() =>
      validateActiveTemplatePrescription(p as any, stored() as any, 7)
    ).toThrow();
  });
  it("rejeita frequência adulterada mesmo quando a dose por aplicação confere", () => {
    const p = payload();
    p.prescriptionData.drugs[0].frequency = 1;
    expect(() =>
      validateActiveTemplatePrescription(p as any, stored() as any, 7)
    ).toThrow(/frequ|dose|sele/i);
  });
  it("exige contexto e nomes coerentes, sem adotar a fase do cadastro implicitamente", () => {
    const p = payload();
    delete (p.prescriptionData.protocol as any).templateContext;
    expect(() =>
      validateActiveTemplatePrescription(p as any, stored() as any, 7)
    ).toThrow();
  });
  it("rejeita documento referencial que produziria prescrição vazia", () => {
    const s = stored();
    Object.assign(s.clinicalDocument, { referenceOnly: true, drugs: [] });
    expect(() =>
      validateActiveTemplatePrescription(payload() as any, s as any, 7)
    ).toThrow();
  });
});
