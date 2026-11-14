import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
vi.mock("./db", () => ({
  getCustomProtocolById: async () => ({
    id: 1,
    userId: 1,
    protocolId: "reviewed-test",
    name: "Documento externo",
    clinicalDocument: {
      id: "EXT",
      name: "Documento externo",
      calculationPolicy: { automaticPrescriptionAllowed: false },
    },
    clinicalPackage: { version: "2.1-source-reconciled-clinical-draft" },
  }),
  updateCustomProtocol: async () => undefined,
  createCustomProtocol: async () => ({
    id: 2,
    userId: 1,
    name: "Documento externo",
  }),
}));
const now = new Date();
const ctx = {
  user: {
    id: 1,
    openId: "test",
    name: "Fictício",
    email: "test@example.invalid",
    loginMethod: "test",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  },
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;
describe("CRUD legado não remove dados clínicos", () => {
  it("nega alteração parcial de documento enriquecido pelo formulário legado", async () => {
    await expect(
      appRouter
        .createCaller(ctx)
        .customProtocols.update({ id: 1, name: "Nome novo" })
    ).rejects.toThrow(/versionad|documento|JSON|clínic/i);
  });
  it("nega criação com campos clínicos que a rota não interpreta, em vez de removê-los", async () => {
    const input = {
      name: "Documento externo",
      indication: "Teste",
      cycles: 1,
      cycleLength: 21,
      emetogenicRisk: "low" as const,
      drugs: [
        {
          name: "Droga",
          dose: 10,
          doseUnit: "mg" as const,
          route: "VO",
          days: "1",
        },
      ],
      clinicalDocument: {
        calculationPolicy: { automaticPrescriptionAllowed: false },
      },
    };
    await expect(
      appRouter.createCaller(ctx).customProtocols.create(input)
    ).rejects.toThrow();
  });
});
