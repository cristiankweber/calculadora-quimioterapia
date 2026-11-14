import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import {
  parseProtocolImport,
  convertImportToDbRecords,
  exportProtocolPackage,
} from "./seedSystemProtocols";
const state = vi.hoisted(() => ({ records: new Map<number, any>() }));
vi.mock("./db", () => ({
  createCustomProtocol: async (data: any) => {
    const r = { id: 43, ...data };
    state.records.set(r.id, r);
    return r;
  },
  getCustomProtocolById: async (id: number) => state.records.get(id),
  updateCustomProtocol: async (id: number, data: any) => {
    const r = state.records.get(id);
    if (!r) throw Error("Registro inexistente");
    state.records.set(id, { ...r, ...data });
  },
}));
const ctx = {
  user: {
    id: 7,
    openId: "unit-test",
    name: "Teste sem validade clínica",
    role: "user",
  },
  req: { protocol: "https", headers: {} },
  res: {},
} as any;
const input = () => ({
  name: "Protocolo fictício de unidade",
  indication: "TESTE",
  cycles: 1,
  cycleLength: 21,
  emetogenicRisk: "low" as const,
  drugs: [
    {
      name: "Agente fictício em UI",
      dose: 1200,
      doseUnit: "UI/m²",
      maxDose: 2000,
      route: "IV",
      days: "1",
    },
  ],
});
beforeEach(() => state.records.clear());
describe("UI/m² pode ser cadastrada e editada sem reinterpretação de dose", () => {
  it("aceita UI/m² no cadastro e conserva a dose máxima em UI no registro devolvido", async () => {
    const r = await appRouter
      .createCaller(ctx)
      .customProtocols.create(input() as any);
    expect(r.drugs).toEqual(input().drugs);
  });
  it("aceita trocar uma droga de mg para UI/m² no editor de protocolo simples", async () => {
    state.records.set(43, {
      id: 43,
      userId: 7,
      protocolId: "custom-independent",
      name: "Fixture",
      drugs: [{ ...input().drugs[0], doseUnit: "mg" }],
    });
    const caller = appRouter.createCaller(ctx);
    await caller.customProtocols.update({
      id: 43,
      drugs: input().drugs,
    } as any);
    const r = await caller.customProtocols.get({ id: 43 });
    expect(r.drugs).toEqual(input().drugs);
  });
  it("importa e exporta UI/m² sem trocar pela unidade mg", () => {
    const p = parseProtocolImport(
      JSON.stringify({ version: "1.0", protocols: [input()] })
    );
    const r = convertImportToDbRecords(p, 7);
    const exported = exportProtocolPackage(r as any);
    expect((exported as any).protocols[0].drugs[0]).toMatchObject({
      dose: 1200,
      doseUnit: "UI/m²",
      maxDose: 2000,
    });
  });
});
