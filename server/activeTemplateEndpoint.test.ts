import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { normalizeLegacyPayload } from "./prescriptionSchema";
const state = vi.hoisted(() => ({ writes: [] as any[] }));
vi.mock("./_core/env", () => ({ ENV: {} }));
vi.mock("./_core/notification", () => ({ notifyOwner: () => { throw new Error("Notification prohibited"); } }));
vi.mock("./db", () => ({
  getPatientById: async (id: number, userId: number) =>
    id === 1 && userId === 7 ? {
      id, userId, name: "Fictício", age: 40, sex: "M", weight: 70, height: 170,
      creatinine: "1.00", bilirubin: "0.00", ecog: 0, comorbidities: null,
      cumulativeDoxorubicin: 0, cumulativeDaunorubicin: 0, cumulativeIdarubicin: 0, cumulativeEpirubicin: 0,
      createdAt: new Date(), updatedAt: new Date(),
    } : undefined,
  getCustomProtocolByProtocolId: async (id: string) =>
    id === "template-owned-abc"
      ? {
          id: 42,
          userId: 7,
          protocolId: id,
          name: "R-DHAP",
          isActive: 1,
          clinicalPackage: { version: "user-protocol-template-1.0" },
          clinicalDocument: {
            id: "OWNED",
            name: "R-DHAP",
            indication: "Fixture",
            cycles: 1,
            cycleLength: 21,
            templateUsage: {
              kind: "user_managed",
              status: "active",
              prescriptionEnabled: true,
            },
            drugs: [
              {
                id: "a",
                name: "Droga A",
                dose: 10,
                doseUnit: "mg",
                route: "VO",
                days: "1",
                administrationFrequency: {
                  administrationsPerDay: 2,
                  doseRepresents: "per_administration",
                  continuousInfusion: false,
                },
                schedule: [{ dose: 10, days: [1] }],
              },
            ],
          },
        }
      : undefined,
  createPrescription: async (record: any) => {
    state.writes.push(record);
    return { id: 9, ...record };
  },
  recordProtocolUsage: async () => undefined,
}));
const ctx = {
  user: {
    id: 7,
    openId: "fictitious",
    name: "Prescritor fictício",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: {},
} as any;
const input = () => ({
  patientId: 1,
  patientName: "Fictício",
  protocolName: "R-DHAP",
  cycle: 1,
  bsa: 1.81,
  egfr: 97.6,
  renalStatus: "green",
  prescriptionData: {
    patient: {
      name: "Fictício",
      age: 40,
      sex: "M" as const,
      weight: 70,
      height: 170,
      creatinine: 1,
      ecog: 0,
    },
    protocol: {
      id: "template-owned-abc",
      name: "R-DHAP",
      templateContext: { cycle: 1, day: 1 },
    },
    calculatedValues: { bsa: 1.81, egfr: 97.6, renalStatus: "green" },
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
        doseRepresents: "per_administration",
      },
    ],
  },
});
beforeEach(() => state.writes.splice(0));
describe("Endpoint revalida autoridade e seleção de templates antes da persistência", () => {
  it("persiste template próprio resolvido com auditoria do registro e contexto", async () => {
    const result = await appRouter
      .createCaller(ctx)
      .prescriptions.create(input());
    expect(result.prescriptionId).toMatch(/^RX-/);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].prescriptionData.templateAudit).toMatchObject({
      recordId: 42,
      validatedByUserId: 7,
      context: { cycle: 1, day: 1 },
      status: "user_template_requires_prescriber_validation",
    });
    expect(state.writes[0].prescriptionData.audit.formulaVersions.dose).toBe(
      "schedule-aware-template-1.0"
    );
    expect(
      normalizeLegacyPayload(state.writes[0].prescriptionData)
    ).toHaveProperty("templateAudit.recordId", 42);
  });
  it("não aceita nome conhecido com ID de template falso", async () => {
    const p = input();
    p.prescriptionData.protocol.id = "template-missing";
    await expect(
      appRouter.createCaller(ctx).prescriptions.create(p)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.writes).toHaveLength(0);
  });
  it("não aceita adulteração de dose de template de propriedade do usuário", async () => {
    const p = input();
    p.prescriptionData.drugs[0].finalDose = 11;
    await expect(
      appRouter.createCaller(ctx).prescriptions.create(p)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toHaveLength(0);
  });
});
