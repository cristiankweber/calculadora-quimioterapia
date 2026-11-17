import { beforeEach, describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import { resolveClinicalProtocol } from "../shared/clinicalProtocols/resolver";
import { normalizeLegacyPayload } from "./prescriptionSchema";
const state = vi.hoisted(() => ({ writes: [] as any[] }));
vi.mock("./_core/env", () => ({ ENV: {} }));
vi.mock("./_core/notification", () => ({
  notifyOwner: () => {
    throw Error("Notificação proibida no teste");
  },
}));
const document = {
  id: "MANUAL-FIXTURE",
  name: "Template fictício de ajuste",
  indication: "Somente teste",
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
      name: "Dose fictícia",
      dose: 10,
      doseUnit: "mg",
      route: "VO",
      days: "1",
      maxDose: 15,
      administrationFrequency: {
        administrationsPerDay: 2,
        doseRepresents: "per_administration",
        continuousInfusion: false,
      },
      schedule: [{ dose: 10, days: [1] }],
    },
  ],
};
vi.mock("./db", () => ({
  getPatientById: async (id: number, userId: number) =>
    id === 701 && userId === 7
      ? {
          id,
          userId,
          name: "Paciente fictício",
          age: 40,
          sex: "M",
          weight: 70,
          height: 170,
          creatinine: "1",
          bilirubin: "1",
          ecog: 0,
          comorbidities: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : undefined,
  getCustomProtocolByProtocolId: async (id: string) =>
    id === "template-manual-fixture"
      ? {
          id: 42,
          userId: 7,
          protocolId: id,
          name: document.name,
          isActive: 1,
          clinicalPackage: { version: "user-protocol-template-1.0" },
          clinicalDocument: document,
        }
      : undefined,
  createPrescription: async (record: any) => {
    state.writes.push(record);
    return { id: 1, ...record };
  },
  recordProtocolUsage: async () => undefined,
}));
const ctx = {
  user: {
    id: 7,
    openId: "test-only",
    name: "Prescritor fictício",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: {},
} as any;
function input() {
  const row = resolveClinicalProtocol(document, {
    cycle: 1,
    day: 1,
    bsa: 1.81,
    weight: 70,
  }).rows[0] as any;
  return {
    patientId: 701,
    patientName: "Paciente fictício",
    protocolName: document.name,
    cycle: 1,
    bsa: 1.81,
    egfr: 97.6,
    renalStatus: "green",
    prescriptionData: {
      patient: {
        name: "Paciente fictício",
        age: 40,
        sex: "M",
        weight: 70,
        height: 170,
        creatinine: 1,
        ecog: 0,
      },
      protocol: {
        id: "template-manual-fixture",
        name: document.name,
        templateContext: { cycle: 1, day: 1 },
      },
      calculatedValues: { bsa: 1.81, egfr: 97.6, renalStatus: "green" },
      drugs: [
        {
          rowKey: row.rowKey ?? "missing-row-key",
          name: "Dose fictícia",
          baseDose: 10,
          doseUnit: "mg",
          resultUnit: "mg",
          calculatedDose: 10,
          finalDose: 8,
          route: "VO",
          days: "1",
          frequency: 2,
          dailyDose: 20,
          prescribedDailyDose: 16,
          timeOrigin: "cycle_day_one",
          doseRepresents: "per_administration",
          isManualDose: true,
          adjustmentReason: "Ajuste fictício para teste",
        },
      ],
      audit: {
        version: 2,
        manualDoseOverrides: [
          {
            rowKey: "forged",
            drugName: "Falso",
            originalDose: 777,
            manualDose: 666,
            reason: "Auditoria não autoritativa",
          },
        ],
      },
    },
  } as any;
}
beforeEach(() => state.writes.splice(0));
describe("Ajuste individual é persistido somente após revalidação server-side", () => {
  it("mantém baseline 10, ordem 8 e total prescrito 16, preservados na normalização do histórico", async () => {
    await appRouter.createCaller(ctx).prescriptions.create(input());
    expect(state.writes).toHaveLength(1);
    const saved = state.writes[0].prescriptionData;
    expect(saved.drugs[0]).toMatchObject({
      baseDose: 10,
      calculatedDose: 10,
      finalDose: 8,
      dailyDose: 20,
      prescribedDailyDose: 16,
      maxDose: 15,
      isManualDose: true,
      adjustmentReason: "Ajuste fictício para teste",
    });
    expect(saved.audit.manualDoseOverrides).toEqual([
      {
        rowKey: saved.drugs[0].rowKey,
        drugName: "Dose fictícia",
        originalDose: 10,
        manualDose: 8,
        reason: "Ajuste fictício para teste",
      },
    ]);
    expect(normalizeLegacyPayload(saved)?.drugs[0]).toMatchObject({
      calculatedDose: 10,
      finalDose: 8,
      prescribedDailyDose: 16,
      adjustmentReason: "Ajuste fictício para teste",
    });
  });
  it("não usa um máximo informado pelo cliente para ultrapassar o máximo armazenado", async () => {
    const p = input();
    p.prescriptionData.drugs[0].finalDose = 16;
    p.prescriptionData.drugs[0].prescribedDailyDose = 32;
    p.prescriptionData.drugs[0].maxDose = 1000;
    await expect(
      appRouter.createCaller(ctx).prescriptions.create(p)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toHaveLength(0);
  });
  it("dose divergente sem motivo continua recusada", async () => {
    const p = input();
    delete p.prescriptionData.drugs[0].adjustmentReason;
    await expect(
      appRouter.createCaller(ctx).prescriptions.create(p)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toHaveLength(0);
  });
});
