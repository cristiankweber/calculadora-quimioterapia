import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

// External I/O only: route middleware, schema, normalization and template re-execution stay real.
// The intentionally unscoped fake catches loss of handler defense even if SQL normally scopes rows.
const state = vi.hoisted(() => ({
  patients: new Map<number, any>(), prescriptions: new Map<number, any>(),
  protocols: new Map<number, any>(), writes: [] as any[], usages: [] as any[], calls: [] as any[],
}));
vi.mock("./_core/env", () => ({ ENV: {} }));
vi.mock("./_core/notification", () => ({ notifyOwner: () => { throw new Error("Notification prohibited"); } }));
vi.mock("./db", () => ({
  getPatientById: async (...args: any[]) => { state.calls.push(["patient", ...args]); return state.patients.get(args[0]); },
  getPatientsByUserId: async (userId: number) => [...state.patients.values()].filter(p => p.userId === userId),
  updatePatient: async (id: number, data: any, userId: number) => { state.writes.push(["update", id, userId, data]); if (state.patients.has(id)) Object.assign(state.patients.get(id), data); },
  deletePatient: async (id: number, userId: number) => { state.writes.push(["delete", id, userId]); state.patients.delete(id); },
  getPrescriptionsByPatientId: async (...args: any[]) => { state.calls.push(["rxPatient", ...args]); return [...state.prescriptions.values()].filter(p => p.patientId === args[0]); },
  getPrescriptionsByUserId: async (userId: number) => [...state.prescriptions.values()].filter(p => p.userId === userId),
  getPrescriptionById: async (...args: any[]) => { state.calls.push(["rxId", ...args]); return state.prescriptions.get(args[0]); },
  getPrescriptionByPrescriptionId: async (...args: any[]) => { state.calls.push(["rxPublicId", ...args]); return [...state.prescriptions.values()].find(p => p.prescriptionId === args[0]); },
  getCustomProtocolById: async (...args: any[]) => { state.calls.push(["protocol", ...args]); return state.protocols.get(args[0]); },
  getCustomProtocolByProtocolId: async (id: string) => [...state.protocols.values()].find(p => p.protocolId === id),
  createPrescription: async (data: any) => { state.writes.push(data); return { id: 90, ...data }; },
  recordProtocolUsage: async (data: any) => { state.usages.push(data); },
}));
const now = new Date("2026-11-14T12:00:00Z");
const patient = (id: number, userId: number, name: string) => ({
  id, userId, name, age: 40, sex: "M", weight: 70, height: 170,
  creatinine: "1.00", bilirubin: "0.00", ecog: 0, comorbidities: null,
  cumulativeDoxorubicin: 0, cumulativeDaunorubicin: 0, cumulativeIdarubicin: 0, cumulativeEpirubicin: 0,
  createdAt: now, updatedAt: now,
});
const caller = (id = 7, role = "user") => appRouter.createCaller({
  user: { id, openId: `fictitious-${id}`, name: "Prescritor fictício", role, email: null,
    loginMethod: "test", createdAt: now, updatedAt: now, lastSignedIn: now },
  req: { protocol: "https", headers: {} }, res: {},
} as any);
const payload = (template = true): any => ({
  patientId: 71, patientName: "Paciente A", protocolName: "Template fictício", cycle: 1,
  bsa: 1.81, egfr: 97.6, renalStatus: "green",
  prescriptionData: {
    patient: { name: "Paciente A", age: 40, sex: "M", weight: 70, height: 170, creatinine: 1, ecog: 0 },
    protocol: template ? { id: "template-owned-test", name: "Template fictício", templateContext: { cycle: 1, day: 1 } } : { name: "Template fictício" },
    calculatedValues: { bsa: 1.81, egfr: 97.6, renalStatus: "green" },
    drugs: [{ name: "Droga A", baseDose: 10, doseUnit: "mg", resultUnit: "mg", calculatedDose: 10, finalDose: 10,
      route: "VO", days: "1", frequency: 2, dailyDose: 20, timeOrigin: "cycle_day_one", doseRepresents: "per_administration" }],
  },
});
beforeEach(() => {
  state.patients.clear(); state.prescriptions.clear(); state.protocols.clear();
  state.writes.length = 0; state.usages.length = 0; state.calls.length = 0;
  state.patients.set(71, patient(71, 7, "Paciente A"));
  state.patients.set(81, patient(81, 8, "Paciente B"));
  for (const [id, userId, patientId] of [[73, 7, 71], [83, 8, 81]]) state.prescriptions.set(id, {
    id, userId, patientId, prescriptionId: `RX-${id}`, patientName: `Paciente ${userId === 7 ? "A" : "B"}`,
    protocolName: "Template fictício", cycle: 1, bsa: "1.81", egfr: "97.60", renalStatus: "green",
    prescriptionData: payload().prescriptionData, createdAt: now,
  });
  state.protocols.set(42, {
    id: 42, userId: 7, protocolId: "template-owned-test", name: "Template fictício", isActive: 1,
    clinicalPackage: { version: "user-protocol-template-1.0" },
    clinicalDocument: { id: "OWNED", name: "Template fictício", indication: "Fixture", cycles: 1, cycleLength: 21,
      templateUsage: { kind: "user_managed", status: "active", prescriptionEnabled: true },
      drugs: [{ id: "a", name: "Droga A", dose: 10, doseUnit: "mg", route: "VO", days: "1",
        administrationFrequency: { administrationsPerDay: 2, doseRepresents: "per_administration", continuousInfusion: false },
        schedule: [{ dose: 10, days: [1] }] }], },
  });
  state.protocols.set(82, { ...state.protocols.get(42), id: 82, userId: 8, protocolId: "custom-private-b", name: "Privado B" });
});

describe("Authorization at handlers independently of SQL", () => {
  it("rejects anonymous reads and create before any storage or side effect", async () => {
    const anonymous = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} }, res: {} } as any);
    const operations = [
      () => anonymous.patients.get({ id: 71 }),
      () => anonymous.patients.update({ id: 71, weight: 72 }),
      () => anonymous.patients.delete({ id: 71 }),
      () => anonymous.prescriptions.getByPatient({ patientId: 71 }),
      () => anonymous.prescriptions.getById({ id: 73 }),
      () => anonymous.prescriptions.getByPrescriptionId({ prescriptionId: "RX-73" }),
      () => anonymous.prescriptions.getWithNormalization({ id: 73 }),
      () => anonymous.customProtocols.get({ id: 42 }),
      () => anonymous.prescriptions.create(payload()),
    ];
    for (const operation of operations) await expect(operation()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.calls).toEqual([]); expect(state.writes).toEqual([]); expect(state.usages).toEqual([]);
  });
  it("admin cannot read B prescriptions/protocol or create for B", async () => {
    const admin = caller(7, "admin");
    const operations = [
      () => admin.prescriptions.getByPatient({ patientId: 81 }),
      () => admin.prescriptions.getById({ id: 83 }),
      () => admin.prescriptions.getByPrescriptionId({ prescriptionId: "RX-83" }),
      () => admin.prescriptions.getWithNormalization({ id: 83 }),
      () => admin.customProtocols.get({ id: 82 }),
      () => admin.prescriptions.create({ ...payload(), patientId: 81 }),
    ];
    for (const operation of operations) await expect(operation()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.writes).toEqual([]); expect(state.usages).toEqual([]);
  });
  it("B creates for its own patient with updated labs, without affecting A", async () => {
    const input = payload(false); input.patientId = 81; input.patientName = "Paciente B";
    input.prescriptionData.patient.name = "Paciente B";
    const result = await caller(8).prescriptions.create(input);
    expect(result).toMatchObject({ userId: 8, patientId: 81, patientName: "Paciente B" });
    expect(state.usages).toHaveLength(1);
    expect(state.usages[0].userId).toBe(8);
    expect(state.patients.get(71)).toMatchObject({ name: "Paciente A", userId: 7 });
  });
  it("denies a foreign private protocol even with an owned patient without any writes", async () => {
    const input = payload(false); input.prescriptionData.protocol.id = "custom-private-b";
    await expect(caller().prescriptions.create(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.writes).toEqual([]); expect(state.usages).toEqual([]);
  });
  for (const condition of ["inactive", "draft", "missing", "tamperedDose"]) it(`retains stored template protection for ${condition} after authorizing the patient`, async () => {
    const input = payload();
    if (condition === "inactive") state.protocols.get(42).isActive = 0;
    if (condition === "draft") state.protocols.get(42).clinicalPackage.version = "2.1-source-reconciled-clinical-draft";
    if (condition === "missing") input.prescriptionData.protocol.id = "template-missing";
    if (condition === "tamperedDose") input.prescriptionData.drugs[0].finalDose = 11;
    const code = condition === "draft" ? "FORBIDDEN" : condition === "tamperedDose" ? "BAD_REQUEST" : "NOT_FOUND";
    await expect(caller().prescriptions.create(input)).rejects.toMatchObject({ code });
    expect(state.writes).toEqual([]); expect(state.usages).toEqual([]);
  });
  // Removing the owner check or passing an unscoped ID must disclose/mutate the foreign fixture and fail these tests.
  for (const role of ["user", "admin"]) for (const id of [81, 999]) for (const op of ["get", "update", "delete"] as const) {
    it(`${role}: patients.${op} denies foreign/missing patient ${id} without writes`, async () => {
      const before = structuredClone([...state.patients]);
      await expect(caller(7, role).patients[op]({ id, weight: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect([...state.patients]).toEqual(before);
      expect(state.writes).toEqual([]);
    });
  }
  it("allows owners A and B to read their own patient and sends the owner to SQL", async () => {
    expect(await caller().patients.get({ id: 71 })).toMatchObject({ id: 71, userId: 7 });
    expect(await caller(8).patients.get({ id: 81 })).toMatchObject({ id: 81, userId: 8 });
    expect(state.calls).toContainEqual(["patient", 71, 7]);
    expect(state.calls).toContainEqual(["patient", 81, 8]);
  });
  it("updates and deletes own patient with owner-scoped SQL arguments", async () => {
    await caller().patients.update({ id: 71, weight: 72 });
    expect(state.patients.get(71).weight).toBe(72);
    expect(state.writes[0]).toEqual(["update", 71, 7, { weight: 72 }]);
    await caller().patients.delete({ id: 71 });
    expect(state.patients.has(71)).toBe(false);
    expect(state.writes[1]).toEqual(["delete", 71, 7]);
  });
  for (const id of [83, 999]) for (const op of ["getById", "getByPrescriptionId", "getWithNormalization"] as const) {
    it(`prescriptions.${op} denies foreign/missing prescription ${id}`, async () => {
      const input = op === "getByPrescriptionId" ? { prescriptionId: `RX-${id}` } : { id };
      await expect((caller().prescriptions[op] as any)(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  }
  for (const patientId of [81, 999]) it(`getByPatient denies foreign/missing patient ${patientId}`, async () => {
    await expect(caller().prescriptions.getByPatient({ patientId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("all four prescription reads authorize owners A/B and pass userId to SQL", async () => {
    for (const [userId, id, patientId] of [[7, 73, 71], [8, 83, 81]]) {
      expect(await caller(userId).prescriptions.getById({ id })).toMatchObject({ id, userId });
      expect(await caller(userId).prescriptions.getByPrescriptionId({ prescriptionId: `RX-${id}` })).toMatchObject({ id, userId });
      expect(await caller(userId).prescriptions.getWithNormalization({ id })).toHaveProperty("prescriptionDataNormalized.patient.name");
      expect(await caller(userId).prescriptions.getByPatient({ patientId })).toHaveLength(1);
      expect(state.calls).toContainEqual(["rxId", id, userId]);
      expect(state.calls).toContainEqual(["rxPublicId", `RX-${id}`, userId]);
      expect(state.calls).toContainEqual(["rxPatient", patientId, userId]);
    }
  });
  it("filters contaminated history belonging to another user despite a valid owned patient", async () => {
    state.prescriptions.get(83).patientId = 71;
    expect((await caller().prescriptions.getByPatient({ patientId: 71 })).map(p => p.id)).toEqual([73]);
  });
  it("returns empty history for an existing owned patient with no prescriptions", async () => {
    state.prescriptions.clear();
    expect(await caller().prescriptions.getByPatient({ patientId: 71 })).toEqual([]);
  });
  for (const id of [82, 999]) it(`customProtocols.get denies foreign/missing protocol ${id}`, async () => {
    await expect(caller().customProtocols.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("reads private owned protocol and sends userId to SQL", async () => {
    expect(await caller().customProtocols.get({ id: 42 })).toMatchObject({ userId: 7 });
    expect(state.calls).toContainEqual(["protocol", 42, 7]);
  });
  for (const template of [false, true]) for (const patientId of [81, 999]) it(`create with template=${template} denies patient ${patientId} before any usage or prescription write`, async () => {
    const input = payload(template); input.patientId = patientId;
    await expect(caller().prescriptions.create(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.writes).toEqual([]); expect(state.usages).toEqual([]);
  });
  for (const field of ["headerName", "snapshotName", "age", "sex"]) it(`create rejects inconsistent patient identity (${field}) without writes`, async () => {
    const input = payload();
    if (field === "headerName") input.patientName = "Paciente B";
    else if (field === "snapshotName") input.prescriptionData.patient.name = "Paciente B";
    else input.prescriptionData.patient[field] = field === "age" ? 41 : "F";
    await expect(caller().prescriptions.create(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toEqual([]); expect(state.usages).toEqual([]);
  });
  it("accepts updated clinical measurements/labs without freezing the patient register", async () => {
    const input = payload();
    Object.assign(input.prescriptionData.patient, { weight: 75, height: 171, creatinine: 1.2, bilirubin: 0.8, ecog: 2 });
    input.bsa = 1.88; input.egfr = 78.4;
    await caller().prescriptions.create(input);
    expect(state.writes[0].prescriptionData.patient).toMatchObject({ weight: 75, height: 171, creatinine: 1.2, bilirubin: 0.8, ecog: 2 });
    expect(state.patients.get(71)).toMatchObject({ weight: 70, creatinine: "1.00" });
  });
  it("canonicalizes independently tampered header and JSON BSA/eGFR and renal status", async () => {
    const input = payload(); input.bsa = 8; input.egfr = 999; input.renalStatus = "red";
    Object.assign(input.prescriptionData.calculatedValues, { bsa: 7, egfr: 888, renalStatus: "fabricado", globalAdjustmentFactor: 9 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await caller().prescriptions.create(input);
      expect(state.writes[0]).toMatchObject({ bsa: "1.81", egfr: "97.60", renalStatus: "green" });
      expect(state.writes[0].prescriptionData.calculatedValues).toMatchObject({ bsa: 1.81, egfr: 97.6, renalStatus: "green", globalAdjustmentFactor: 1 });
      expect(state.writes[0].prescriptionData.audit.globalAdjustmentFactor).toBe(1);
    } finally { warn.mockRestore(); }
  });
  it("persists numeric template authority while preserving non-dose fields", async () => {
    const input = payload();
    Object.assign(input.prescriptionData.drugs[0], { baseDose: 10.000000000000002, calculatedDose: 10.000000000000002, finalDose: 10.000000000000002, dailyDose: 20.000000000000004,
      notes: "Revisão do prescritor", diluent: "Fixture", infusionTime: "1h" });
    await caller().prescriptions.create(input);
    expect(state.writes[0].prescriptionData.drugs[0]).toMatchObject({ baseDose: 10, calculatedDose: 10, finalDose: 10, dailyDose: 20,
      notes: "Revisão do prescritor", diluent: "Fixture", infusionTime: "1h" });
  });
});
