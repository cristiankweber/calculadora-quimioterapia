import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ queries: [] as { sql: string; params: unknown[] }[] }));
vi.mock("./_core/env", () => ({ ENV: {} }));
// Real Drizzle query generation/mapping; replace only its external constructor transport.
// The isolated URL sentinel below never reaches mysql2 or a network connection.
vi.mock("drizzle-orm/mysql2", async importOriginal => {
  const actual = await importOriginal<typeof import("drizzle-orm/mysql2")>();
  return { ...actual, drizzle: () => actual.drizzle({
    query: async (query: { sql: string }, params: unknown[]) => {
      state.queries.push({ sql: query.sql, params });
      return query.sql.startsWith("select") ? [[], []] : [{ insertId: 90, affectedRows: 1 }, []];
    },
  } as any) };
});
import * as db from "./db";
beforeEach(() => {
  state.queries.length = 0;
  vi.stubEnv("DATABASE_URL", "isolated-driver-fixture-not-a-real-url");
});
afterEach(() => vi.unstubAllEnvs());

describe("SQL owner defense (real helpers, real SQL compiler, no real SQL execution)", () => {
  // Removing the userId predicate still emits a valid query, but must fail these security assertions.
  const reads: [string, (...args: any[]) => Promise<any>, unknown, string, string][] = [
    ["patient id", db.getPatientById, 71, "patients", "id"],
    ["prescription id", db.getPrescriptionById, 73, "prescriptions", "id"],
    ["prescription public id", db.getPrescriptionByPrescriptionId, "RX-73", "prescriptions", "prescriptionId"],
    ["patient history", db.getPrescriptionsByPatientId, 71, "prescriptions", "patientId"],
    ["private custom protocol", db.getCustomProtocolById, 42, "custom_protocols", "id"],
  ];
  for (const [name, read, id, table, column] of reads) it(`${name} binds resource and owner in the WHERE predicate`, async () => {
    await read(id, 7);
    expect(state.queries).toHaveLength(1);
    const { sql, params } = state.queries[0];
    const where = sql.split(" where ")[1];
    expect(where).toContain(`\`${table}\`.\`${column}\` = ?`);
    expect(where).toContain(`\`${table}\`.\`userId\` = ?`);
    expect(where).toContain(" and ");
    expect(params.slice(0, 2)).toEqual([id, 7]);
  });
  for (const action of ["update", "delete"] as const) it(`patient ${action} has owner predicate even after handler authorization`, async () => {
    if (action === "update") await (db.updatePatient as any)(71, { weight: 72 }, 7);
    else await (db.deletePatient as any)(71, 7);
    const { sql, params } = state.queries[0];
    const where = sql.split(" where ")[1];
    expect(where).toContain("`patients`.`id` = ?");
    expect(where).toContain("`patients`.`userId` = ?");
    expect(params.slice(-2)).toEqual([71, 7]);
  });
  it("re-reads inserted patient only with its owner", async () => {
    await db.createPatient({ userId: 7, name: "Paciente A", age: 40, sex: "M", weight: 70, height: 170, creatinine: "1.00", bilirubin: "0.00", ecog: 0 });
    expect(state.queries[1].sql.split(" where ")[1]).toContain("`patients`.`userId` = ?");
    expect(state.queries[1].params.slice(0, 2)).toEqual([90, 7]);
  });
  it("re-reads inserted prescription only with its owner", async () => {
    await db.createPrescription({ userId: 7, patientId: 71, patientName: "Paciente A", prescriptionId: "RX-fixture", protocolName: "Fixture", cycle: 1, bsa: "1.81", egfr: "97.60", renalStatus: "green", prescriptionData: {} });
    expect(state.queries[1].sql.split(" where ")[1]).toContain("`prescriptions`.`userId` = ?");
    expect(state.queries[1].params.slice(0, 2)).toEqual([90, 7]);
  });
});
