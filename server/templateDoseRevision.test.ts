import { beforeEach, describe, expect, it, vi } from "vitest";
import { customProtocols } from "../drizzle/schema";
import {
  convertImportToDbRecords,
  convertToUserTemplatePackage,
  exportProtocolPackage,
  protocolContentSha256,
} from "./seedSystemProtocols";
import { templateDoseRevisionRouter } from "./templateDoseRevision";

const state = vi.hoisted(() => ({
  rows: [] as any[],
  writes: 0,
  locks: 0,
  available: true,
  failArchive: false,
  unscoped: false,
  queue: Promise.resolve(),
}));
vi.mock("./db", () => ({
  getDb: async () => (state.available ? database : null),
}));
function matches(expr: any, row: any): boolean {
  const c = expr?.queryChunks ?? [];
  const col = c.find((x: any) => x?.name && x?.table);
  const param = c.find((x: any) => x?.constructor?.name === "Param");
  if (col && param) return row[col.name] === param.value;
  return c
    .filter((x: any) => x?.queryChunks)
    .every((x: any) => matches(x, row));
}
function storage(rows: any[], transactional = false): any {
  return {
    select: () => ({
      from: (table: any) => {
        if (table !== customProtocols)
          throw Error("Prescriptions/source tables must not be touched");
        const q: any = {
          data: [],
          where: (predicate: any) => {
            q.data = rows.filter(
              row => state.unscoped || matches(predicate, row)
            );
            return q;
          },
          for: (mode: string) => {
            if (!transactional || mode !== "update") throw Error("Unsafe lock");
            state.locks++;
            return q;
          },
          limit: (n: number) => {
            q.data = q.data.slice(0, n);
            return q;
          },
          then: (ok: any, bad: any) =>
            Promise.resolve(structuredClone(q.data)).then(ok, bad),
        };
        return q;
      },
    }),
    insert: (table: any) => ({
      values: async (data: any) => {
        if (!transactional || table !== customProtocols)
          throw Error("Nontransactional write");
        if (rows.some(r => r.protocolId === data.protocolId))
          throw Error("Duplicate identity");
        state.writes++;
        const id = Math.max(0, ...rows.map(r => r.id)) + 1;
        rows.push({
          ...structuredClone(data),
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return [{ insertId: id, affectedRows: 1 }];
      },
    }),
    update: (table: any) => ({
      set: (patch: any) => ({
        where: async (predicate: any) => {
          if (!transactional || table !== customProtocols)
            throw Error("Nontransactional write");
          if (state.failArchive) throw Error("Archive failure");
          const found = rows.filter(row => matches(predicate, row));
          state.writes++;
          for (const r of found) Object.assign(r, structuredClone(patch));
          return [{ affectedRows: found.length }];
        },
      }),
    }),
  };
}
const database: any = {
  ...storage(state.rows),
  transaction: (fn: any) => {
    // Serialize like row locks: the second concurrent transaction observes the first commit.
    const run = state.queue.then(async () => {
      const working = structuredClone(state.rows);
      const result = await fn(storage(working, true));
      state.rows.splice(0, state.rows.length, ...working);
      return result;
    });
    state.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  },
};
const source = () => ({
  version: "2.18",
  references: [{ id: "s", title: "Fictitious" }],
  metadata: { kept: true },
  protocols: [
    {
      id: "fiction",
      name: "Protocolo fictício",
      indication: "Software test only",
      cycles: 2,
      cycleLength: 21,
      extraUnknown: { calendarMustStay: true },
      drugs: [
        {
          id: "a",
          name: "Agente A",
          dose: 10,
          doseUnit: "mg/m²",
          route: "IV",
          days: "1",
          maxDose: 100,
          administrationFrequency: { administrationsPerDay: 2 },
          schedule: [{ dose: 5, days: [1], timeOrigin: "cycle_day_one" }],
          extensions: {
            schedule: [{ dose: 5, days: [1], timeOrigin: "cycle_day_one" }],
          },
        },
      ],
      extensions: {
        phaseLibrary: [
          {
            id: "p",
            name: "Fase",
            drugs: [
              {
                id: "b",
                name: "Agente B",
                dose: 0.01,
                doseUnit: "mg",
                route: "VO",
                days: "2",
              },
            ],
          },
        ],
      },
    },
  ],
});
const caller = (userId: number | null = 7) =>
  templateDoseRevisionRouter.createCaller({
    user: userId === null ? null : { id: userId },
    req: { headers: {} },
    res: {},
  } as any);
const payload = (
  expectedHash = protocolContentSha256(state.rows[0].clinicalDocument)
) => ({
  id: 42,
  expectedHash,
  changes: [{ path: ["drugs", "0", "schedule", "0", "dose"], dose: 7.125 }],
  reason: "Revisão médica justificada",
});
beforeEach(() => {
  const [row] = convertImportToDbRecords(
    convertToUserTemplatePackage(source()),
    7
  );
  state.rows.splice(0, state.rows.length, {
    ...row,
    id: 42,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  state.writes = 0;
  state.locks = 0;
  state.available = true;
  state.failArchive = false;
  state.unscoped = false;
  state.queue = Promise.resolve();
});
describe("isolated template dose revision transaction", () => {
  it("prepare supplies the current full-document SHA-256 and main/agenda/phase fields without writes", async () => {
    const before = structuredClone(state.rows);
    const prepared = await caller().prepare({ id: 42 });
    expect(prepared.id).toBe(42);
    expect(prepared.expectedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prepared.expectedHash).toBe(
      protocolContentSha256(before[0].clinicalDocument)
    );
    expect(prepared.fields.map(f => f.dose)).toEqual([10, 5, 0.01]);
    expect(state.rows).toEqual(before);
    expect(state.writes).toBe(0);
  });
  it("creates distinct active identity, archives old atomically and preserves sources/calendar through export/reimport", async () => {
    const before = structuredClone(state.rows[0]);
    const result = await caller().update(payload());
    expect(result.id).toBe(43);
    expect(result.protocolId).not.toBe(before.protocolId);
    expect(state.locks).toBe(1);
    expect(state.rows[0].isActive).toBe(0);
    expect(state.rows[0]).toEqual({ ...before, isActive: 0 });
    const next = state.rows[1];
    expect(next.userId).toBe(7);
    expect(next.isActive).toBe(1);
    const expectedDoc = structuredClone(before.clinicalDocument);
    expectedDoc.drugs[0].schedule[0].dose = 7.125;
    expectedDoc.drugs[0].extensions.schedule[0].dose = 7.125;
    expectedDoc.templateDoseRevision = result.revision;
    expect(next.clinicalDocument).toEqual(expectedDoc);
    expect(next.clinicalPackage).toEqual(before.clinicalPackage);
    expect(result.revision).toMatchObject({
      reason: "Revisão médica justificada",
      parentProtocolId: before.protocolId,
      priorHash: protocolContentSha256(before.clinicalDocument),
      authorUserId: 7,
    });
    expect(result.revision.timestamp).toBeTypeOf("number");
    expect(Number.isSafeInteger(result.revision.timestamp)).toBe(true);
    expect(result.revision.timestamp).toBeGreaterThan(0);
    expect(next.clinicalDocument.sourceDocument).toEqual(
      before.clinicalDocument.sourceDocument
    );
    const [reimport] = convertImportToDbRecords(
      exportProtocolPackage([next]),
      7
    );
    expect(reimport.protocolId).toBe(result.protocolId);
    expect(reimport.clinicalDocument).toEqual(expectedDoc);
    expect(
      convertImportToDbRecords(exportProtocolPackage([next]), 8)[0].protocolId
    ).not.toBe(result.protocolId);
  });
  it("conflicts on any stale content, including metadata, before writing", async () => {
    const input = payload();
    state.rows[0].clinicalDocument.extraUnknown.calendarMustStay = false;
    const before = structuredClone(state.rows);
    await expect(caller().update(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(state.rows).toEqual(before);
    expect(state.writes).toBe(0);
  });
  it("allows only one revision of the same active content under competing transactions", async () => {
    const input = payload();
    const outcomes = await Promise.allSettled([
      caller().update(input),
      caller().update(input),
    ]);
    expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find(r => r.status === "rejected")).toMatchObject({
      reason: { code: "CONFLICT" },
    });
    expect(state.rows).toHaveLength(2);
    expect(state.rows.filter(r => r.isActive === 1)).toHaveLength(1);
  });
  it("rolls back the new row if archiving fails", async () => {
    state.failArchive = true;
    const before = structuredClone(state.rows);
    await expect(caller().update(payload())).rejects.toThrow();
    expect(state.rows).toEqual(before);
  });
  it("requires auth for prepare and update before storage", async () => {
    await expect(caller(null).prepare({ id: 42 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(null).update(payload())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(state.writes).toBe(0);
    expect(state.locks).toBe(0);
  });
  it("defends cross-user writes even if storage mistakenly returns an unscoped row", async () => {
    state.unscoped = true;
    await expect(caller(8).prepare({ id: 42 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller(8).update(payload())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(state.writes).toBe(0);
    expect(state.rows).toHaveLength(1);
  });
  it("denies drafts and malformed templates without writes", async () => {
    state.rows[0].clinicalPackage.version =
      "2.1-source-reconciled-clinical-draft";
    await expect(caller().update(payload())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.writes).toBe(0);
  });
  it("blocks invalid source integrity rather than downgrading or discarding it", async () => {
    state.rows[0].clinicalDocument.sourceDocument.drugs[0].dose = 999;
    const before = structuredClone(state.rows);
    await expect(caller().update(payload())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(state.rows).toEqual(before);
    expect(state.writes).toBe(0);
  });
  it.each([0, -1, NaN, Infinity, -Infinity])(
    "rejects invalid new dose %s without writes",
    async dose => {
      const input = payload();
      input.changes[0].dose = dose;
      await expect(caller().update(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(state.writes).toBe(0);
    }
  );
  it.each(["", "   "])('rejects blank reason "%s"', async reason => {
    await expect(
      caller().update({ ...payload(), reason })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toBe(0);
  });
  it("rejects forged paths and duplicate aliases atomically", async () => {
    await expect(
      caller().update({
        ...payload(),
        changes: [{ path: ["sourceDocument", "drugs", "0", "dose"], dose: 30 }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller().update({
        ...payload(),
        changes: [payload().changes[0], payload().changes[0]],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toBe(0);
  });
  it("fails closed with no DB rather than claiming a revision was saved", async () => {
    state.available = false;
    await expect(caller().update(payload())).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(state.rows).toHaveLength(1);
  });
});
