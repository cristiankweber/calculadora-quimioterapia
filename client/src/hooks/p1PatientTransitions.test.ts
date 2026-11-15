import React from "react";
import { act, create } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useProtocolDoseCalculation } from "@/hooks/useProtocolDoseCalculation";
import { usePatientCalculations } from "@/hooks/usePatientCalculations";
import {
  buildPrescriptionDataV2,
  usePrescriptionActions,
} from "@/hooks/usePrescriptionActions";
import PatientPrescriptionHistory from "@/components/PatientPrescriptionHistory";

const io = vi.hoisted(() => ({
  saved: [] as any[],
  save: vi.fn(),
  patient: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    patients: { create: { useMutation: () => ({ mutateAsync: io.patient }) } },
    prescriptions: {
      create: { useMutation: () => ({ mutateAsync: io.save }) },
      getByPatient: { useQuery: () => ({ data: io.saved, isLoading: false }) },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
// Dialog portals are DOM-dependent; replace that I/O boundary only, keeping the timeline real.
vi.mock("@/components/ui/dialog", () => {
  const passthrough = ({ children }: any) =>
    React.createElement("div", null, children);
  return {
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogDescription: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogTrigger: passthrough,
    useDialogComposition: () => ({}),
  };
});
const patient = {
  name: "FICTICIO-A",
  age: 50,
  sex: "M" as const,
  weight: 70,
  height: 170,
  creatinine: 1,
  bilirubin: 0.8,
  ecog: 0 as const,
  comorbidities: "",
};
const values = {
  bsa: 1.8,
  egfr: 90,
  globalAdjustmentFactor: 1,
  ecogAdjustmentFactor: 1,
  renalStatus: "green" as const,
  renalStatusLabel: "Normal",
};
const drug = {
  name: "TESTE-DRUG",
  dose: 10,
  doseUnit: "mg/m²" as const,
  route: "IV",
  days: "D1",
};
const protocol = {
  id: "custom-isolated",
  name: "PROTOCOLO-FICTICIO",
  indication: "Fictícia",
  cycles: 6,
  cycleLength: 21,
  drugs: [drug],
  emetogenicRisk: "minimal" as const,
  specialAlerts: [],
  prophylaxis: [],
  nursingCare: [],
  renalAdjustments: [],
  hepaticAdjustments: [],
  hematologicAdjustments: [],
};
const antiemetics = {
  risk: "minimal" as const,
  day1: [],
  days2to4: [],
  rescue: [],
  alerts: [],
};
const context = () => ({
  patientData: patient,
  calculatedValues: values,
  selectedProtocol: protocol,
  selectedCycle: 2,
  calculatedDrugs: [{ ...drug, calculatedDose: 18, resultUnit: "mg" }],
  antiemetics,
  toxicities: {},
});
const roots: any[] = [];
function hook<T>(fn: (props: any) => T, props: any) {
  let result: T;
  let root: any;
  const Harness = (p: any) => {
    result = fn(p);
    return null;
  };
  act(() => {
    root = create(React.createElement(Harness, props));
  });
  roots.push(root);
  return {
    get value() {
      return result!;
    },
    update(p: any) {
      act(() => root.update(React.createElement(Harness, p)));
    },
  };
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  io.saved.length = 0;
  io.patient.mockResolvedValue({ id: 123 });
  io.save.mockResolvedValue({ prescriptionId: "RX-A" });
});
afterEach(() => {
  roots.splice(0).forEach(root => act(() => root.unmount()));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Isolamento de paciente — contratos observáveis", () => {
  it("descarta override de A imediatamente ao mudar epoch, mas preserva edição biométrica de A", () => {
    let input: any = {
      selectedProtocol: protocol,
      calculatedValues: values,
      weight: 70,
      toxicities: {},
      sessionKey: 1,
    };
    const h = hook(useProtocolDoseCalculation, input);
    act(() => h.value.handleDoseChange(0, 7));
    h.update({ ...input, weight: 80, calculatedValues: { ...values, bsa: 2 } });
    expect(h.value.calculatedDrugs[0].calculatedDose).toBe(7);
    h.update({
      ...input,
      sessionKey: 2,
      weight: 90,
      calculatedValues: { ...values, bsa: 2.2 },
    });
    expect(h.value.calculatedDrugs[0].calculatedDose).toBe(22);
  });
  it("não expõe medidas debounced de A no primeiro render de B nem após timer cancelado", () => {
    vi.useFakeTimers();
    const seen: any[] = [];
    const h = hook(
      (p: any) => {
        const result = (usePatientCalculations as any)(p.patient, p.sessionKey);
        seen.push(result.calculatedValues);
        return result;
      },
      { patient, sessionKey: 1 }
    );
    act(() => vi.advanceTimersByTime(300));
    expect(h.value.calculatedValues).not.toBeNull();
    seen.length = 0;
    h.update({
      patient: { ...patient, name: "FICTICIO-B", weight: 90 },
      sessionKey: 2,
    });
    expect(seen[0]).toBeNull();
    expect(h.value.calculatedValues).toBeNull();
    act(() => vi.advanceTimersByTime(299));
    expect(h.value.calculatedValues).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(h.value.calculatedValues?.bsa).toBeGreaterThan(2);
  });
  it("lê revisão de drogas de mesmo ID e não migra override por índice", () => {
    const input: any = {
      selectedProtocol: protocol,
      calculatedValues: values,
      weight: 70,
      toxicities: {},
    };
    const h = hook(useProtocolDoseCalculation, input);
    act(() => h.value.handleDoseChange(0, 7));
    h.update({
      ...input,
      selectedProtocol: {
        ...protocol,
        drugs: [{ ...drug, name: "REVISADO", dose: 20 }],
      },
    });
    expect(h.value.calculatedDrugs[0]).toMatchObject({
      name: "REVISADO",
      calculatedDose: 36,
    });
  });
});
describe("Histórico real v2 e identidade de save", () => {
  it("timeline lê medicamentos, fase, dia zero, ciclo e biometria do builder v2 sem recalcular snapshot", () => {
    const payload = buildPrescriptionDataV2({
      ...context(),
      selectedProtocol: {
        ...protocol,
        templateContext: {
          cycle: 2,
          phaseId: "FASE-FICTICIA",
          day: 0,
          gfrForCalvert: 82,
        },
      },
    });
    payload.drugs[0].finalDose = 7;
    payload.drugs[0].calculatedDose = 7;
    io.saved.push({
      id: 1,
      prescriptionData: payload,
      protocolName: protocol.name,
      cycle: 5,
      createdAt: "2026-01-01",
    });
    const html = renderToStaticMarkup(
      React.createElement(PatientPrescriptionHistory, {
        patientId: 123,
        patientName: patient.name,
      })
    );
    expect(html).toContain("TESTE-DRUG");
    expect(html).toContain("FASE-FICTICIA");
    expect(html).toMatch(/Dia.*0/);
    expect(html).toContain("Ciclo 2");
    expect(html).toContain("70");
    expect(html).toMatch(/7(?:\.0)? mg/);
  });
  it("save anterior não identifica snapshot alterado", async () => {
    const ctx = context();
    const h = hook(usePrescriptionActions, ctx);
    await act(async () => h.value.handleSaveToHistory());
    expect(h.value.prescriptionId).toBe("RX-A");
    h.update({ ...ctx, selectedCycle: 3 });
    expect(h.value.prescriptionId).toBe("");
  });
  it("resposta de save pendente de A não identifica B", async () => {
    let resolve: (value: any) => void = () => {};
    io.save.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    const ctx = context();
    const h = hook(usePrescriptionActions, ctx);
    let pending: Promise<void>;
    await act(async () => {
      pending = h.value.handleSaveToHistory();
      await Promise.resolve();
    });
    h.update({ ...ctx, patientData: { ...patient, name: "FICTICIO-B" } });
    await act(async () => {
      resolve({ prescriptionId: "RX-A" });
      await pending!;
    });
    expect(h.value.prescriptionId).toBe("");
  });
});

describe("Integração Calvert absoluto legado", () => {
  it("AUC não usa eGFR indexado como fallback nem permite ação sem GFR absoluto explícito", () => {
    const aucProtocol = {
      ...protocol,
      drugs: [{ ...drug, dose: 5, doseUnit: "AUC" as const }],
    };
    const input: any = {
      selectedProtocol: aucProtocol,
      calculatedValues: values,
      weight: 70,
      toxicities: {},
    };
    const h = hook(useProtocolDoseCalculation, input);
    expect(h.value.calculatedDrugs[0].calculatedDose).toBeUndefined();
    h.update({ ...input, calvertGfrAbsolute: 100 });
    expect(h.value.calculatedDrugs[0].calculatedDose).toBe(625);
    const actions = hook(usePrescriptionActions, {
      ...context(),
      selectedProtocol: aucProtocol,
      calculatedDrugs: h.value.calculatedDrugs,
    });
    expect(actions.value.validateBeforeAction("salvar")).toBe(false);
    actions.update({
      ...context(),
      selectedProtocol: { ...aucProtocol, calvertGfrAbsolute: 100 },
      calculatedDrugs: h.value.calculatedDrugs,
    });
    expect(actions.value.validateBeforeAction("salvar")).toBe(true);
  });
});

import HydrationCalculator from "@/components/HydrationCalculator";
it("suporte real limpa labs e flags na troca de sessão, preserva biometria na mesma sessão", () => {
  let root: any;
  const input: any = {
    patientData: patient,
    calculatedValues: values,
    selectedProtocol: protocol,
    sessionKey: 1,
  };
  act(() => {
    root = create(React.createElement(HydrationCalculator, input));
  });
  roots.push(root);
  const electrolytes = () =>
    root.root.findAll(
      (node: any) =>
        typeof node.type === "function" &&
        node.props.labValues &&
        !node.props.setIsBleeding
    )[0];
  const transfusion = () =>
    root.root.findAll(
      (node: any) => typeof node.type === "function" && node.props.setIsBleeding
    )[0];
  act(() => {
    electrolytes().props.onLabChange("potassium", "2.0");
    transfusion().props.setIsBleeding(true);
  });
  act(() =>
    root.update(
      React.createElement(HydrationCalculator, {
        ...input,
        patientData: { ...patient, weight: 80 },
      })
    )
  );
  expect(electrolytes().props.labValues.potassium).toBe("2.0");
  expect(transfusion().props.isBleeding).toBe(true);
  act(() =>
    root.update(
      React.createElement(HydrationCalculator, {
        ...input,
        sessionKey: 2,
        patientData: { ...patient, name: "FICTICIO-B" },
      })
    )
  );
  expect(electrolytes().props.labValues.potassium).toBe("");
  expect(transfusion().props.isBleeding).toBe(false);
});

vi.mock("@/components/ui/tabs", () => {
  const passthrough = ({ children }: any) =>
    React.createElement("div", null, children);
  return {
    Tabs: passthrough,
    TabsContent: passthrough,
    TabsList: passthrough,
    TabsTrigger: passthrough,
  };
});

vi.mock("@/components/ui/accordion", () => {
  const passthrough = ({ children }: any) =>
    React.createElement("div", null, children);
  return {
    Accordion: passthrough,
    AccordionContent: passthrough,
    AccordionItem: passthrough,
    AccordionTrigger: passthrough,
  };
});
