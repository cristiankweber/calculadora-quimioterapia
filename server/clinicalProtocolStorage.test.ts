import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as seed from "./seedSystemProtocols";
import { customProtocols } from "../drizzle/schema";

const raw = readFileSync(new URL("../shared/data/clinicalProtocols.json", import.meta.url), "utf8");
const library = JSON.parse(raw);
const draft = () => structuredClone(library);
const legacy = () => ({
  version: "1.0", exportedAt: "2026-11-13T00:00:00Z", extraEnvelope: { kept: true },
  protocols: [{ id: "local-1", name: "Teste fictício", indication: "Teste de software", cycles: 6,
    cycleLength: 21, emetogenicRisk: "low", extraProtocol: { kept: 0 },
    drugs: [{ name: "Fictícia", dose: 1, doseUnit: "mg/m²", route: "IV", days: "1",
      calculatedDose: 0, unknownDrug: { keep: "" } }] }],
});
// New functions are accessed dynamically so RED is an assertion failure, not a module import error.
const exportPackage = (records: any[]) => (seed as any).exportProtocolPackage(records);

// External I/O only: a transaction-aware in-memory double interprets Drizzle query predicates.
const dbState = vi.hoisted(() => ({ rows: [] as any[], available: true, failBatch: false, batches: 0 }));
vi.mock("./db", () => ({ getDb: async () => dbState.available ? fakeDb : null }));
function predicateMatches(expr: any, row: any): boolean {
  const chunks = expr?.queryChunks ?? [];
  const column = chunks.find((x: any) => x?.name && x?.table);
  const param = chunks.find((x: any) => x?.constructor?.name === "Param");
  if (column && param) return row[column.name] === param.value;
  if (column) {
    const values = chunks.flatMap((x: any) => Array.isArray(x) ? x : []).filter((x: any) => x?.constructor?.name === "Param").map((x: any) => x.value);
    if (values.length) return values.includes(row[column.name]);
  }
  const children = chunks.filter((x: any) => x?.queryChunks);
  return children.every((x: any) => predicateMatches(x, row));
}
function queryDb(rows: any[]): any {
  return {
    select: () => ({ from: (table: any) => {
      const result: any = {
        where: (condition: any) => {
          result.data = table === customProtocols ? rows.filter(row => predicateMatches(condition, row)) : [{ id: 71 }];
          return result;
        },
        for: () => result,
        limit: (n: number) => { result.data = result.data.slice(0, n); return result; },
        then: (resolve: any, reject: any) => Promise.resolve(result.data).then(resolve, reject), data: [],
      };
      return result;
    } }),
    insert: () => ({ values: async (batch: any[]) => {
      dbState.batches++;
      if (dbState.failBatch && dbState.batches === 2) throw new Error("simulated batch failure");
      for (const value of batch) {
        if (rows.some(row => row.protocolId === value.protocolId)) throw new Error("duplicate identity");
        rows.push({ id: rows.length + 1, ...structuredClone(value) });
      }
    } }),
  };
}
const fakeDb: any = {
  ...queryDb(dbState.rows),
  transaction: async (fn: any) => {
    const working = structuredClone(dbState.rows);
    const result = await fn(queryDb(working));
    dbState.rows.splice(0, dbState.rows.length, ...working);
    return result;
  },
};

beforeEach(() => {
  dbState.rows.splice(0); dbState.available = true; dbState.failBatch = false; dbState.batches = 0;
});

describe("clinical import validation", () => {
  it("accepts the original 52 drafts without changing their hash", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe("3eb9e462aac5359ac42016d25ef3280517a5784ce78604c6334f75a73201fbe8");
    expect(seed.validateImportFormat(library)).toEqual([]);
  });
  it("rejects unsupported versions rather than treating any string as clinical", () => {
    expect(seed.validateImportFormat({ ...legacy(), version: "3.0" }).length).toBeGreaterThan(0);
  });
  it.each([NaN, Infinity, -Infinity])("rejects non-finite dose %s", dose => {
    const p = legacy(); p.protocols[0].drugs[0].dose = dose;
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it("accepts referenceOnly without drugs", () => {
    const p = draft(); p.protocols = [{ ...p.protocols[0], referenceOnly: true, drugs: [] }];
    expect(seed.validateImportFormat(p)).toEqual([]);
  });
  it("validates units and finitude inside phase drugs and schedules", () => {
    const p = draft(); p.protocols = [p.protocols.find((x: any) => x.phaseLibrary)];
    p.protocols[0].phaseLibrary[2].drugs[0].doseUnit = "invalid";
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
    p.protocols[0].phaseLibrary[2].drugs[0].doseUnit = "UI/m²";
    p.protocols[0].phaseLibrary[2].drugs[0].schedule[0].dose = Infinity;
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it.each(["UI/m²", "mcg/m²", "mcg", "mcg/kg"])("accepts explicit source unit %s", doseUnit => {
    const p = draft(); p.protocols = [p.protocols[0]]; p.protocols[0].drugs[0].doseUnit = doseUnit;
    expect(seed.validateImportFormat(p)).toEqual([]);
  });
  it("allows null dose only with a table or an explicit decision, never a bare placeholder", () => {
    const p = draft(); p.protocols = [p.protocols.find((x: any) => x.phaseLibrary)];
    const drug = p.protocols[0].phaseLibrary[2].drugs[3];
    expect(drug.dose).toBeNull(); expect(seed.validateImportFormat(p)).toEqual([]);
    delete drug.ageDoseTable;
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it("rejects clinical policy fields disguised as legacy v1", () => {
    const p: any = legacy(); p.protocols[0].calculationPolicy = { automaticPrescriptionAllowed: false };
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
    expect(() => seed.convertImportToDbRecords(p, 71)).toThrow();
  });
  it.each([
    ["calculationPolicy", "automaticPrescriptionAllowed", true],
    ["calculationPolicy", "requiresScheduleAwareEngine", false],
    ["calculationPolicy", "renalOrHepaticAdjustmentAutomatic", true],
    ["review", "requiresMedicalApproval", false],
    ["review", "requiresPharmacyApproval", false],
    ["review", "calculatorIntegrationTested", true],
  ])("rejects altered safety policy %s.%s", (section, key, value) => {
    const p = draft(); p.protocols = [p.protocols[0]]; p.protocols[0][section][key] = value;
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it.each(["__proto__", "constructor", "prototype"])("rejects pollution key %s in extras", key => {
    const p: any = legacy(); p.extraEnvelope = JSON.parse(`{"${key}":{"polluted":true}}`);
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
    expect(() => seed.convertImportToDbRecords(p, 71)).toThrow();
    expect(({} as any).polluted).toBeUndefined();
  });
  it("rejects scalar protocols and drugs without throwing TypeError", () => {
    expect(seed.validateImportFormat({ version: "1.0", protocols: [null, 4] }).length).toBeGreaterThan(0);
    const p: any = legacy(); p.protocols[0].drugs = [null];
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it("rejects phase drugs with missing core fields rather than assuming an executable default", () => {
    const p = draft(); p.protocols = [p.protocols.find((x: any) => x.phaseLibrary)];
    delete p.protocols[0].phaseLibrary[2].drugs[0].dose;
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it("rejects removed required safety fields", () => {
    const p = draft(); p.protocols = [p.protocols[0]];
    delete p.protocols[0].calculationPolicy.automaticPrescriptionAllowed;
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it("rejects a homologated status disguised in the draft version", () => {
    const p = draft(); p.protocols = [p.protocols[0]];
    p.protocols[0].review.status = "approved";
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
  it("rejects source library IDs demoted to v1 even after stripping clinical fields", () => {
    const p: any = legacy(); p.protocols[0].id = "HEM-001";
    expect(seed.validateImportFormat(p).length).toBeGreaterThan(0);
  });
});

describe("lossless records and export", () => {
  it("stores all documents, all envelopes, raw drugs and unchanged policy", () => {
    const records: any[] = seed.convertImportToDbRecords(library, 71);
    expect(records).toHaveLength(52);
    const { protocols, ...envelope } = library;
    for (let i = 0; i < records.length; i++) {
      expect(records[i].clinicalDocument).toEqual(protocols[i]);
      expect(records[i].clinicalPackage).toEqual(envelope);
      expect(records[i].drugs).toEqual(protocols[i].drugs);
      expect(records[i].isActive).toBe(1); expect(records[i].isSystem).toBe(0);
    }
    expect(exportPackage(records)).toEqual(library);
  });
  it("stores legacy unknown fields without stripping calculatedDose or empty values", () => {
    const p: any = legacy(); const records: any[] = seed.convertImportToDbRecords(p, 71);
    expect(records[0].drugs[0]).toEqual(p.protocols[0].drugs[0]);
    expect(exportPackage(records)).toEqual(p);
  });
  it("maps null/999 cycles and long indication only in list summary", () => {
    const p = draft(); p.protocols = [p.protocols[0], structuredClone(p.protocols[1])];
    p.protocols[0].cycles = null; p.protocols[1].cycles = 999;
    p.protocols[0].indication = "x".repeat(900);
    const records: any[] = seed.convertImportToDbRecords(p, 71);
    expect(records.map(r => r.cycles)).toEqual([1, 1]);
    expect(records[0].indication).toHaveLength(512);
    expect(exportPackage(records)).toEqual(p);
  });
  it("preserves legacy list default 21 without replacing unknown clinical interval by 21", () => {
    const p: any = legacy(); delete p.protocols[0].cycleLength;
    expect(seed.convertImportToDbRecords(p, 71)[0].cycleLength).toBe(21);
    const c = draft(); c.protocols = [c.protocols.find((x: any) => x.cycleLength === null)];
    const rows: any[] = seed.convertImportToDbRecords(c, 71);
    expect(rows[0].cycleLength).toBe(1);
    expect(rows[0].clinicalDocument.cycleLength).toBeNull();
  });
  it("generates deterministic user-scoped IDs with content revisions and canonical ordering", () => {
    const p: any = legacy();
    const a = seed.convertImportToDbRecords(p, 71)[0].protocolId;
    expect(seed.convertImportToDbRecords(p, 71)[0].protocolId).toBe(a);
    expect(seed.convertImportToDbRecords(p, 72)[0].protocolId).not.toBe(a);
    p.protocols[0].drugs[0].dose = 2;
    expect(seed.convertImportToDbRecords(p, 71)[0].protocolId).not.toBe(a);
    const ordered = { protocols: p.protocols, extraEnvelope: p.extraEnvelope, exportedAt: p.exportedAt, version: p.version };
    expect(seed.convertImportToDbRecords(ordered as any, 71)[0].protocolId).toBe(seed.convertImportToDbRecords(p, 71)[0].protocolId);
    expect(a.length).toBeLessThanOrEqual(128);
  });
  it("separates same source/id/version with distinct envelope content", () => {
    const p = draft(); p.protocols = [p.protocols[0]];
    const a = seed.convertImportToDbRecords(p, 71)[0].protocolId;
    p.metadata.extra = "new-reference";
    expect(seed.convertImportToDbRecords(p, 71)[0].protocolId).not.toBe(a);
  });
  it("mixed legacy and clinical export keeps separate exact envelopes and roundtrips", () => {
    const a: any = legacy(); const b = draft(); b.protocols = [b.protocols[0]];
    const records = [...seed.convertImportToDbRecords(a, 71), ...seed.convertImportToDbRecords(b, 71)];
    const exported = exportPackage(records);
    expect(exported.version).toBe("clinical-protocol-collection-1.0");
    expect(exported.packages).toEqual([a, b]);
    expect(seed.validateImportFormat(exported)).toEqual([]);
    const again: any[] = seed.convertImportToDbRecords(exported, 71);
    expect(again.map(r => r.protocolId)).toEqual(records.map(r => r.protocolId));
    expect(exportPackage(again).packages).toEqual([a, b]);
  });
  it("does not silently export clinical documents when their envelope is missing", () => {
    const records: any[] = seed.convertImportToDbRecords(library, 71);
    records[0].clinicalPackage = null;
    expect(() => exportPackage(records)).toThrow();
  });
  it("nullable schema columns keep legacy inserts compatible", () => {
    expect((customProtocols as any).clinicalDocument).toBeDefined();
    expect((customProtocols as any).clinicalDocument?.notNull).toBe(false);
    expect((customProtocols as any).clinicalPackage?.notNull).toBe(false);
  });
});

describe("authenticated storage transactions", () => {
  it("synchronizes only authenticated user's library, idempotently, preserving older rows", async () => {
    const storage: any = await import("./clinicalProtocolStorage").catch(() => ({}));
    expect(storage.syncClinicalLibrary).toBeTypeOf("function");
    dbState.rows.push({ id: 900, userId: 72, protocolId: "legacy-other", isActive: 1 },
      { id: 901, userId: 71, protocolId: "personal-untouched", isActive: 1 });
    const first = await storage.syncClinicalLibrary(71);
    expect(first.imported).toBe(52);
    expect((await storage.syncClinicalLibrary(71)).imported).toBe(0);
    expect(dbState.rows).toHaveLength(54);
    expect(dbState.rows.slice(0, 2)).toEqual([
      { id: 900, userId: 72, protocolId: "legacy-other", isActive: 1 },
      { id: 901, userId: 71, protocolId: "personal-untouched", isActive: 1 },
    ]);
    expect(dbState.rows.slice(2).every(r => r.userId === 71 && r.isSystem === 1 && r.isActive === 1)).toBe(true);
  });
  it("rolls back all batches after a failure without partially syncing", async () => {
    const storage: any = await import("./clinicalProtocolStorage").catch(() => ({}));
    expect(storage.syncClinicalLibrary).toBeTypeOf("function");
    dbState.failBatch = true;
    await expect(storage.syncClinicalLibrary(71)).rejects.toThrow("simulated batch failure");
    expect(dbState.rows).toEqual([]);
  });
  it("imports string idempotently and exports only owned selected IDs", async () => {
    const storage: any = await import("./clinicalProtocolStorage").catch(() => ({}));
    expect(storage.importClinicalProtocols).toBeTypeOf("function");
    expect((await storage.importClinicalProtocols(71, JSON.stringify(legacy()))).imported).toBe(1);
    expect((await storage.importClinicalProtocols(71, JSON.stringify(legacy()))).imported).toBe(0);
    dbState.rows.push({ id: 99, userId: 72, protocolId: "foreign" });
    await expect(storage.exportClinicalProtocols(71, [99])).rejects.toThrow();
    expect(await storage.exportClinicalProtocols(71, [1])).toEqual(legacy());
  });
  it("unavailable DB never reports a successful sync", async () => {
    const storage: any = await import("./clinicalProtocolStorage").catch(() => ({}));
    expect(storage.syncClinicalLibrary).toBeTypeOf("function");
    dbState.available = false;
    await expect(storage.syncClinicalLibrary(71)).rejects.toThrow();
  });
  it("validates all supplied records before writing, including mismatched ownership", async () => {
    const storage: any = await import("./clinicalProtocolStorage");
    const records = seed.convertImportToDbRecords(legacy() as any, 71);
    await expect(storage.persistClinicalProtocolRecords(72, records)).rejects.toThrow();
    expect(dbState.rows).toEqual([]);
  });
  it("rejects changed draft policies at the direct persistence boundary", async () => {
    const storage: any = await import("./clinicalProtocolStorage");
    const p = draft(); p.protocols = [p.protocols[0]];
    const records: any[] = seed.convertImportToDbRecords(p, 71);
    records[0].clinicalDocument.calculationPolicy.automaticPrescriptionAllowed = true;
    await expect(storage.persistClinicalProtocolRecords(71, records)).rejects.toThrow();
    expect(dbState.rows).toEqual([]);
  });
  it("does not allow legacy import to disguise an existing enriched protocol by its source id", async () => {
    const storage: any = await import("./clinicalProtocolStorage");
    const p = draft(); p.protocols = [p.protocols[0]]; p.protocols[0].id = "clinic-local-id";
    await storage.importClinicalProtocols(71, JSON.stringify(p));
    const downgraded: any = legacy(); downgraded.protocols[0].id = "clinic-local-id";
    await expect(storage.importClinicalProtocols(71, JSON.stringify(downgraded))).rejects.toThrow();
    expect(dbState.rows).toHaveLength(1);
  });
  it("all four new routes reject unauthenticated calls", async () => {
    const mod: any = await import("./routers/clinicalProtocols").catch(() => ({}));
    expect(mod.clinicalProtocolsRouter).toBeDefined();
    const caller = mod.clinicalProtocolsRouter.createCaller({ user: null, req: {}, res: {} });
    await expect(caller.syncLibrary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.import({ jsonData: JSON.stringify(legacy()) })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.exportAll()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.exportSelected({ ids: [1] })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("router rejects malformed JSON as BAD_REQUEST before any database call", async () => {
    const { clinicalProtocolsRouter } = await import("./routers/clinicalProtocols");
    const caller = clinicalProtocolsRouter.createCaller({ user: { id: 71 }, req: {}, res: {} } as any);
    await expect(caller.import({ jsonData: "{" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbState.rows).toEqual([]);
  });
});
