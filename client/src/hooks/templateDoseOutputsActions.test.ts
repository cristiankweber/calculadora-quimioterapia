import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrescriptionActions } from "./usePrescriptionActions";
import type {
  Drug,
  Protocol,
  PatientData,
  CalculatedValues,
} from "@/types/calculator";
// Only remote persistence and user-facing notifications are replaced; all clinical logic is real.
vi.mock("@/lib/trpc", () => ({
  trpc: {
    patients: {
      create: {
        useMutation: () => ({
          mutateAsync: async () => {
            throw new Error("DB não autorizada no teste");
          },
        }),
      },
    },
    prescriptions: {
      create: {
        useMutation: () => ({
          mutateAsync: async () => {
            throw new Error("DB não autorizada no teste");
          },
        }),
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { success: () => {}, error: () => {}, warning: () => {} },
}));
const patient: PatientData = {
  name: "FICTÍCIO",
  age: 40,
  sex: "M",
  weight: 70,
  height: 170,
  creatinine: 1,
  bilirubin: 0,
  ecog: 0,
  comorbidities: "",
};
const values: CalculatedValues = {
  bsa: 1.8,
  egfr: 90,
  renalStatus: "green",
  renalStatusLabel: "Teste",
  ecogAdjustmentFactor: 1,
  globalAdjustmentFactor: 1,
};
const protocol: Protocol = {
  id: "template-fixture",
  name: "Fixture",
  indication: "Teste",
  cycles: 2,
  cycleLength: 21,
  drugs: [],
  renalAdjustments: [],
  hepaticAdjustments: [],
  hematologicAdjustments: [],
  prophylaxis: [],
  nursingCare: [],
  specialAlerts: [],
  emetogenicRisk: "minimal",
  isUserTemplate: true,
  clinicalDocument: {
    templateUsage: {
      kind: "user_managed",
      status: "active",
      prescriptionEnabled: true,
    },
    calculationPolicy: {},
  },
};
const drug: Drug = {
  name: "Fictícia",
  dose: 5,
  doseUnit: "mcg/kg",
  calculatedDose: 350,
  finalDose: 175,
  rowKey: "row-0",
  adjustmentReason: "x",
  isManualDose: true,
  dailyDose: 700,
  prescribedDailyDose: 350,
  resultUnit: "mcg",
  frequency: 2,
  route: "SC",
  days: "D1",
};
let actions: ReturnType<typeof usePrescriptionActions>;
let root: ReturnType<typeof create>;
let copied: string;
let prints: number;
function Probe({
  drugs = [drug],
  scope = "A",
  issues = [],
}: {
  drugs?: Drug[];
  scope?: string;
  issues?: string[];
}) {
  actions = usePrescriptionActions({
    patientData: patient,
    calculatedValues: values,
    selectedProtocol: protocol,
    selectedCycle: 1,
    calculatedDrugs: drugs,
    antiemetics: null,
    toxicities: {},
    sessionKey: scope,
    clinicalIssues: issues,
  });
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  copied = "";
  prints = 0;
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  vi.stubGlobal("window", {
    print: () => {
      prints++;
    },
  });
});
afterEach(() => {
  if (root) act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Ações de saída respeitam final e contexto vivo", () => {
  it("copia final, baseline, motivo e total diário final usando o mesmo formatter", () => {
    act(() => {
      root = create(React.createElement(Probe));
    });
    act(() => actions.handleCopyPrescription());
    expect(copied).toContain("Fictícia: 175.0 mcg SC");
    expect(copied).toContain("Dose calculada pelo protocolo: 350.0 mcg");
    expect(copied).toContain("Ajuste manual — motivo: x");
    expect(copied).toContain("Total de 24h: 350.0 mcg/24h");
  });
  it.each([
    { finalDose: 0 },
    { finalDose: NaN },
    { finalDose: -1 },
    { finalDose: 175, adjustmentReason: " " },
    { finalDose: 175, rowKey: undefined },
    { finalDose: 501, maxDose: 500 },
  ])("recusa dose final inválida ou ajuste sem auditoria (%j)", change => {
    act(() => {
      root = create(
        React.createElement(Probe, { drugs: [{ ...drug, ...change }] })
      );
    });
    expect(actions.validateBeforeAction("copiar")).toBe(false);
    act(() => actions.handleCopyPrescription());
    expect(copied).toBe("");
  });
  it("mantém bloqueio de seleção parcial mesmo com final válido", () => {
    act(() => {
      root = create(
        React.createElement(Probe, { issues: ["Seleção pendente"] })
      );
    });
    expect(actions.validateBeforeAction("imprimir")).toBe(false);
  });
  it("mudança de contexto cancela impressão agendada sem chamar window.print", () => {
    act(() => {
      root = create(React.createElement(Probe));
    });
    act(() => actions.handlePrint());
    expect(actions.showPrint).toBe(true);
    act(() => root.update(React.createElement(Probe, { scope: "B" })));
    expect(actions.showPrint).toBe(false);
    act(() => vi.advanceTimersByTime(80));
    expect(prints).toBe(0);
  });
});
