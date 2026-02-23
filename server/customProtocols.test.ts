import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/**
 * Cria um contexto autenticado para testes de protocolos customizados.
 */
function createAuthContext(userId = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

/**
 * Cria um contexto não autenticado (sem usuário).
 */
function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

/** Payload mínimo válido para criar um protocolo */
const validProtocolInput = {
  name: "R-CHOP Teste",
  indication: "Linfoma Difuso de Grandes Células B",
  cycles: 6,
  cycleLength: 21,
  emetogenicRisk: "moderate" as const,
  drugs: [
    {
      name: "Rituximabe",
      dose: 375,
      doseUnit: "mg/m²" as const,
      maxDose: 750,
      route: "IV",
      days: "1",
      observations: "Infusão lenta na primeira dose",
      emetogenicRisk: "low" as const,
    },
    {
      name: "Ciclofosfamida",
      dose: 750,
      doseUnit: "mg/m²" as const,
      route: "IV",
      days: "1",
    },
  ],
  specialAlerts: ["Risco de síndrome de lise tumoral", "Monitorar função cardíaca"],
  prophylaxis: ["Aciclovir 400mg 12/12h", "Sulfametoxazol-Trimetoprima 3x/semana"],
  nursingCare: ["Monitorar sinais vitais a cada 15 min durante infusão de Rituximabe"],
  renalAdjustments: ["Reduzir Ciclofosfamida 50% se ClCr < 30 mL/min"],
  hepaticAdjustments: ["Reduzir Doxorrubicina se bilirrubina > 3x LSN"],
  hematologicAdjustments: ["Adiar ciclo se neutrófilos < 1000/mm³"],
  dilutionInfo: [
    {
      drugName: "Rituximabe",
      diluent: "SF 0,9%",
      volume: "500 mL",
      infusionTime: "4 horas (1ª dose), 90 min (subsequentes)",
      stability: "24h em temperatura ambiente",
      specialInstructions: "Não agitar. Proteger da luz direta.",
    },
  ],
};

describe("customProtocols router", () => {
  describe("input validation", () => {
    it("rejeita protocolo sem nome", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = { ...validProtocolInput, name: "" };
      await expect(caller.customProtocols.create(input)).rejects.toThrow();
    });

    it("rejeita protocolo sem drogas", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = { ...validProtocolInput, drugs: [] };
      await expect(caller.customProtocols.create(input)).rejects.toThrow();
    });

    it("rejeita droga com dose negativa", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        ...validProtocolInput,
        drugs: [
          {
            name: "Teste",
            dose: -10,
            doseUnit: "mg/m²" as const,
            route: "IV",
            days: "1",
          },
        ],
      };
      await expect(caller.customProtocols.create(input)).rejects.toThrow();
    });

    it("rejeita unidade de dose inválida", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        ...validProtocolInput,
        drugs: [
          {
            name: "Teste",
            dose: 100,
            doseUnit: "invalid_unit" as any,
            route: "IV",
            days: "1",
          },
        ],
      };
      await expect(caller.customProtocols.create(input)).rejects.toThrow();
    });

    it("rejeita risco emetogênico inválido", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = { ...validProtocolInput, emetogenicRisk: "invalid" as any };
      await expect(caller.customProtocols.create(input)).rejects.toThrow();
    });

    it("rejeita ciclos com valor zero", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = { ...validProtocolInput, cycles: 0 };
      await expect(caller.customProtocols.create(input)).rejects.toThrow();
    });

    it("aceita protocolo válido com todos os campos opcionais", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Esse teste valida que o input é aceito pelo Zod.
      // A mutação em si falhará por não ter DB, mas o input deve passar validação.
      const input = {
        name: "Protocolo Mínimo",
        indication: "Teste",
        drugs: [
          {
            name: "Droga A",
            dose: 100,
            doseUnit: "mg/m²" as const,
            route: "IV",
            days: "1",
          },
        ],
      };

      // O erro deve ser de DB (não de validação)
      try {
        await caller.customProtocols.create(input);
      } catch (e: any) {
        // Se o erro é de validação Zod, ele terá code BAD_REQUEST
        // Se é de DB, terá outro código
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("authorization", () => {
    it("rejeita listagem sem autenticação", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.customProtocols.list()).rejects.toThrow();
    });

    it("rejeita criação sem autenticação", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.customProtocols.create(validProtocolInput)
      ).rejects.toThrow();
    });

    it("rejeita exclusão sem autenticação", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.customProtocols.delete({ id: 1 })
      ).rejects.toThrow();
    });

    it("rejeita atualização sem autenticação", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.customProtocols.update({ id: 1, name: "Novo Nome" })
      ).rejects.toThrow();
    });

    it("rejeita restauração sem autenticação", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.customProtocols.restore({ id: 1 })
      ).rejects.toThrow();
    });
  });

  describe("dilutionInfo validation", () => {
    it("aceita dilutionInfo com todos os campos", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        ...validProtocolInput,
        dilutionInfo: [
          {
            drugName: "Rituximabe",
            diluent: "SF 0,9%",
            volume: "500 mL",
            infusionTime: "4 horas",
            stability: "24h",
            specialInstructions: "Proteger da luz",
          },
          {
            drugName: "Ciclofosfamida",
            diluent: "SG 5%",
            volume: "250 mL",
            infusionTime: "30 min",
            stability: "12h",
            specialInstructions: "",
          },
        ],
      };

      // Validação deve passar; erro será de DB
      try {
        await caller.customProtocols.create(input);
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("aceita protocolo sem dilutionInfo", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { dilutionInfo, ...input } = validProtocolInput;

      try {
        await caller.customProtocols.create(input);
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("dose adjustments validation", () => {
    it("aceita múltiplos ajustes de dose", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        ...validProtocolInput,
        renalAdjustments: [
          "Reduzir 25% se ClCr 30-60 mL/min",
          "Reduzir 50% se ClCr < 30 mL/min",
          "Contraindicado se ClCr < 10 mL/min",
        ],
        hepaticAdjustments: [
          "Reduzir 25% se bilirrubina 1.5-3x LSN",
          "Reduzir 50% se bilirrubina > 3x LSN",
        ],
        hematologicAdjustments: [
          "Adiar se neutrófilos < 1000/mm³",
          "Reduzir 25% se neutropenia G3 no ciclo anterior",
        ],
      };

      try {
        await caller.customProtocols.create(input);
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("update validation", () => {
    it("aceita atualização parcial (apenas nome)", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Deve passar validação Zod, falhar por DB/permissão
      try {
        await caller.customProtocols.update({ id: 999, name: "Novo Nome" });
      } catch (e: any) {
        // Esperamos NOT_FOUND (DB) ou erro de conexão, não BAD_REQUEST
        expect(["NOT_FOUND", "INTERNAL_SERVER_ERROR"]).toContain(e.code);
      }
    });

    it("aceita atualização com novas drogas", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.customProtocols.update({
          id: 999,
          drugs: [
            {
              name: "Nova Droga",
              dose: 200,
              doseUnit: "mg/m²" as const,
              route: "IV",
              days: "1-3",
            },
          ],
        });
      } catch (e: any) {
        expect(["NOT_FOUND", "INTERNAL_SERVER_ERROR"]).toContain(e.code);
      }
    });

    it("rejeita atualização com id inválido (não número)", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.customProtocols.update({ id: "abc" as any, name: "Teste" })
      ).rejects.toThrow();
    });
  });
});
