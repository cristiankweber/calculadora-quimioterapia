import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calculator from "@/pages/Calculator";
import PatientForm from "@/components/PatientForm";
import ProtocolSelector from "@/components/ProtocolSelector";
import HydrationCalculator from "@/components/HydrationCalculator";
import ClinicalProtocolPanel from "@/components/ClinicalProtocolPanel";
import type { PatientData, Protocol } from "@/types/calculator";
import type { ClinicalProtocolDocument } from "@shared/clinicalProtocols/types";

const io = vi.hoisted(() => ({ userId: 1, copied: "", records: [] as any[] }));
// Connector/session/navigation I/O only; calculator and all clinical children remain real.
vi.mock("wouter", () => ({ useLocation: () => ["/", () => {}] }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: io.userId } }),
}));
vi.mock("sonner", () => ({
  toast: { success: () => {}, warning: () => {}, error: () => {} },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    settings: { get: { useQuery: () => ({ data: null }) } },
    customProtocols: { listActive: { useQuery: () => ({ data: io.records }) } },
    patients: {
      list: {
        useQuery: () => ({
          data: io.records,
          refetch: () => {},
          isLoading: false,
        }),
      },
      delete: { useMutation: () => ({}) },
      create: {
        useMutation: () => ({
          mutateAsync: async () => {
            throw new Error("Sem DB");
          },
        }),
      },
    },
    prescriptions: {
      create: {
        useMutation: () => ({
          mutateAsync: async () => {
            throw new Error("Sem DB");
          },
        }),
      },
    },
    toxicity: {
      predict: { useQuery: () => ({ data: null, isLoading: false }) },
      metrics: { useQuery: () => ({ data: null, isLoading: false }) },
    },
  },
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
const document: ClinicalProtocolDocument = {
  id: "template-fixture",
  name: "Fixture",
  indication: "Teste",
  cycles: 2,
  cycleLength: 21,
  drugs: [
    {
      id: "one",
      name: "Ciclofosfamida fictícia",
      dose: 60,
      doseUnit: "mg/kg",
      route: "IV",
      days: "D1",
      schedule: [
        {
          days: [1],
          dose: 60,
          doseUnit: "mg/kg",
          administrationsPerDay: 2,
          doseRepresents: "per_24_hours",
        },
      ],
    },
  ],
  calculationPolicy: {},
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
};
const protocol: Protocol = {
  id: document.id,
  name: document.name,
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
  clinicalDocument: document as unknown as Record<string, unknown>,
};
let root: ReturnType<typeof create>;
const props = (type: any) => root.root.findByType(type?.type ?? type).props;
beforeEach(() => {
  io.userId = 1;
  io.copied = "";
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // No DOM frames in react-test-renderer; animation is verified in Chromium, not simulated here.
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: async (text: string) => {
        io.copied = text;
      },
    },
  });
  act(() => {
    root = create(React.createElement(Calculator));
  });
  act(() => props(PatientForm).onChange(patient));
  act(() => props(ProtocolSelector).onProtocolChange(protocol));
  act(() => vi.advanceTimersByTime(300));
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function adjust() {
  const panel = props(ClinicalProtocolPanel);
  expect(panel.doseEditing).toBeDefined();
  const rowKey = panel.resolution.rows[0].rowKey;
  act(() =>
    expect(
      panel.doseEditing.onConfirm({ rowKey, finalDose: 1050, reason: "x" })
    ).toEqual([])
  );
}

describe("Calculadora real propaga ajuste sem vazar contexto", () => {
  it("painel continua baseline, prescrição final e suporte base proporcional", () => {
    adjust();
    expect(props(ClinicalProtocolPanel).resolution.rows[0].calculatedDose).toBe(
      2100
    );
    expect(props(ClinicalProtocolPanel).doseEditing.drugs[0]).toMatchObject({
      calculatedDose: 2100,
      finalDose: 1050,
      dailyDose: 4200,
      prescribedDailyDose: 2100,
    });
    expect(props(HydrationCalculator).effectiveDrugs).toEqual([
      {
        name: "Ciclofosfamida fictícia",
        dose: 30,
        doseUnit: "mg/kg",
        administrationsPerDay: 1,
      },
    ]);
    const copy = root.root
      .findAllByType("button")
      .find(b => b.children.some(child => child === " Copiar"));
    expect(copy).toBeDefined();
    act(() => copy!.props.onClick());
    expect(io.copied).toContain("Ciclofosfamida fictícia: 1050.0 mg");
    expect(io.copied).toContain("Dose calculada pelo protocolo: 2100.0 mg");
    act(() =>
      props(ClinicalProtocolPanel).doseEditing.onRestore(
        props(ClinicalProtocolPanel).resolution.rows[0].rowKey
      )
    );
    expect(props(ClinicalProtocolPanel).doseEditing.drugs[0].finalDose).toBe(
      2100
    );
  });
  it("biometria invalida ajuste antes do debounce, inclusive voltando ao valor anterior", () => {
    adjust();
    act(() => props(PatientForm).onChange({ ...patient, weight: 80 }));
    expect(props(ClinicalProtocolPanel).doseEditing).toBeUndefined();
    act(() => props(PatientForm).onChange(patient));
    act(() => vi.advanceTimersByTime(300));
    expect(props(ClinicalProtocolPanel).doseEditing.drugs[0].finalDose).toBe(
      2100
    );
  });
  it.each(["session-user", "document-revision", "cycle", "day"])(
    "invalida ajuste ao alterar %s",
    change => {
      adjust();
      if (change === "session-user") {
        io.userId = 2;
        act(() => root.update(React.createElement(Calculator)));
      }
      if (change === "document-revision")
        act(() =>
          props(ProtocolSelector).onProtocolChange({
            ...protocol,
            clinicalDocument: { ...document, revision: { id: "nova" } },
          })
        );
      if (change === "cycle")
        act(() => props(ProtocolSelector).onCycleChange(2));
      if (change === "day")
        act(() =>
          props(ClinicalProtocolPanel).onContextChange({
            ...props(ClinicalProtocolPanel).context,
            day: 1,
          })
        );
      expect(props(ClinicalProtocolPanel).doseEditing.drugs[0].finalDose).toBe(
        2100
      );
    }
  );
});
