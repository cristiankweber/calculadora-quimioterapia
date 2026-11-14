import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { customProtocols } from "../drizzle/schema";
import drafts from "../shared/data/clinicalProtocols.json";
import { convertImportToDbRecords } from "./seedSystemProtocols";

const sourceText = readFileSync(
  new URL(
    "../tests/fixtures/user-templates-source-2026-11-14.json",
    import.meta.url
  ),
  "utf8"
);
const state = vi.hoisted(() => ({
  rows: [] as any[],
  failBatch: false,
  batches: 0,
}));
// Only replace external DB I/O. Real importer, validation, export and Drizzle conditions are exercised.
vi.mock("./db", () => ({ getDb: async () => db }));
function matches(expression: any, row: any): boolean {
  const chunks = expression?.queryChunks ?? [];
  const column = chunks.find((chunk: any) => chunk?.name && chunk?.table);
  const parameter = chunks.find(
    (chunk: any) => chunk?.constructor?.name === "Param"
  );
  if (column && parameter) return row[column.name] === parameter.value;
  if (column) {
    const values = chunks
      .flatMap((chunk: any) => (Array.isArray(chunk) ? chunk : []))
      .filter((chunk: any) => chunk?.constructor?.name === "Param")
      .map((chunk: any) => chunk.value);
    if (values.length) return values.includes(row[column.name]);
  }
  return chunks
    .filter((chunk: any) => chunk?.queryChunks)
    .every((chunk: any) => matches(chunk, row));
}
function query(rows: any[]): any {
  return {
    select: () => ({
      from: (table: any) => {
        const result: any = {
          data: [],
          where: (condition: any) => {
            result.data =
              table === customProtocols
                ? rows.filter(row => matches(condition, row))
                : [{ id: 71 }];
            return result;
          },
          for: () => result,
          limit: (n: number) => {
            result.data = result.data.slice(0, n);
            return result;
          },
          then: (resolve: any, reject: any) =>
            Promise.resolve(result.data).then(resolve, reject),
        };
        return result;
      },
    }),
    insert: () => ({
      values: async (batch: any[]) => {
        state.batches++;
        if (state.failBatch && state.batches === 2)
          throw new Error("test rollback");
        for (const value of batch)
          rows.push({ id: rows.length + 1, ...structuredClone(value) });
      },
    }),
  };
}
const db: any = {
  ...query(state.rows),
  transaction: async (operation: any) => {
    const working = structuredClone(state.rows);
    const result = await operation(query(working));
    state.rows.splice(0, state.rows.length, ...working);
    return result;
  },
};
beforeEach(() => {
  state.rows.splice(0);
  state.failBatch = false;
  state.batches = 0;
});

describe("explicit template import storage", () => {
  it("imports exactly 53 templates only with authorized mode, idempotently without overwriting previous drafts", async () => {
    const storage: any = await import("./clinicalProtocolStorage");
    state.rows.push(
      ...convertImportToDbRecords(drafts as any, 71).map((r, index) => ({
        id: index + 1,
        ...r,
      }))
    );
    const previous = structuredClone(state.rows);
    await expect(
      storage.importClinicalProtocols(71, sourceText)
    ).rejects.toThrow();
    expect(state.rows).toEqual(previous);
    expect(
      await storage.importClinicalProtocols(71, sourceText, {
        importMode: "user_template",
      })
    ).toEqual({ imported: 53, skipped: 0, total: 53 });
    expect(
      await storage.importClinicalProtocols(71, sourceText, {
        importMode: "user_template",
      })
    ).toEqual({ imported: 0, skipped: 53, total: 53 });
    expect(state.rows.slice(0, 52)).toEqual(previous);
    expect(
      state.rows
        .slice(52)
        .every(
          row =>
            row.protocolId.startsWith("template-") &&
            row.userId === 71 &&
            row.clinicalPackage.version === "user-protocol-template-1.0"
        )
    ).toBe(true);
    const exported: any = await storage.exportClinicalProtocols(71);
    expect(exported.packages.map((p: any) => p.protocols.length)).toEqual([
      52, 51, 2,
    ]);
  });
  it("rolls back all 53 templates on a middle-batch failure", async () => {
    const storage: any = await import("./clinicalProtocolStorage");
    state.failBatch = true;
    await expect(
      storage.importClinicalProtocols(71, sourceText, {
        importMode: "user_template",
      })
    ).rejects.toThrow("test rollback");
    expect(state.rows).toEqual([]);
  });
  it("exports a selected template losslessly with original envelope and refuses foreign selection", async () => {
    const storage: any = await import("./clinicalProtocolStorage");
    await storage.importClinicalProtocols(71, sourceText, {
      importMode: "user_template",
    });
    const selected: any = await storage.exportClinicalProtocols(71, [1]);
    expect(selected.protocols[0]).toEqual(state.rows[0].clinicalDocument);
    expect(selected.sourceEnvelope.version).toBe("2.18");
    await expect(storage.exportClinicalProtocols(72, [1])).rejects.toThrow();
  });
});
