import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getCustomProtocolByProtocolId: async (id: string) =>
    id === "external-saved"
      ? {
          userId: 1,
          protocolId: id,
          name: "Documento externo",
          clinicalDocument: {
            id: "EXT",
            name: "Documento externo",
            calculationPolicy: { automaticPrescriptionAllowed: false },
          },
        }
      : undefined,
  recordProtocolUsage: async () => undefined,
  createPrescription: async () => ({
    id: 9,
    prescriptionId: "RX-INVALID",
    clinicalDocumentWasIgnored: true,
  }),
}));
const now = new Date();
const ctx = {
  user: {
    id: 1,
    openId: "test",
    name: "Equipe fictícia",
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

describe("Bloqueio server-side por documento armazenado", () => {
  it("não aceita rascunho armazenado quando o cliente remove campos clínicos do payload", async () => {
    const caller = appRouter.createCaller(ctx);
    const input = {
      patientId: 1,
      patientName: "Fictício",
      protocolName: "Documento externo",
      cycle: 1,
      bsa: 1.8,
      egfr: 90,
      renalStatus: "green",
      prescriptionData: {
        patient: {
          name: "Fictício",
          age: 40,
          sex: "M" as const,
          weight: 70,
          height: 175,
          creatinine: 1,
          ecog: 0,
        },
        protocol: { id: "external-saved", name: "Documento externo" },
        calculatedValues: { bsa: 1.8, egfr: 90, renalStatus: "green" },
        drugs: [{ name: "Droga", finalDose: 100 }],
      },
    };
    await expect(caller.prescriptions.create(input)).rejects.toThrow(
      /rascunho|homolog|bloquead/i
    );
  });
});
