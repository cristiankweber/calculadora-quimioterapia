import React from "react";
import { act, create } from "react-test-renderer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Calculator from "@/pages/Calculator";
import PatientForm from "@/components/PatientForm";
import ProtocolSelector from "@/components/ProtocolSelector";
import PatientHistoryDB from "@/components/PatientHistoryDB";
import HydrationCalculator from "@/components/HydrationCalculator";
import ToxicityAssessment from "@/components/ToxicityAssessment";
import ClinicalProtocolPanel from "@/components/ClinicalProtocolPanel";
import DrugsTable from "@/components/DrugsTable";
import { buildPrescriptionDataV2 } from "@/hooks/usePrescriptionActions";
const io = vi.hoisted(() => ({ protocols: [] as any[] }));
vi.mock("wouter", () => ({ useLocation: () => ["/", () => {}] }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    settings: { get: { useQuery: () => ({ data: null }) } },
    customProtocols: {
      listActive: { useQuery: () => ({ data: io.protocols }) },
    },
    patients: {
      create: {
        useMutation: () => ({ mutateAsync: async () => ({ id: 123 }) }),
      },
    },
    prescriptions: {
      create: {
        useMutation: () => ({
          mutateAsync: async () => ({ prescriptionId: "RX" }),
        }),
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
// Presentational children are inert: their real parent/hook state and callbacks stay under test.
vi.mock("@/components/PatientForm", () => ({
  default: function PatientForm() {
    return null;
  },
}));
vi.mock("@/components/ProtocolSelector", () => ({
  default: function ProtocolSelector() {
    return null;
  },
}));
vi.mock("@/components/PatientHistoryDB", () => ({
  default: function PatientHistoryDB() {
    return null;
  },
}));
vi.mock("@/components/HydrationCalculator", () => ({
  default: function HydrationCalculator() {
    return null;
  },
}));
vi.mock("@/components/ToxicityAssessment", () => ({
  default: function ToxicityAssessment() {
    return null;
  },
}));
vi.mock("@/components/ClinicalProtocolPanel", () => ({
  default: function ClinicalProtocolPanel() {
    return null;
  },
}));
vi.mock("@/components/DrugsTable", () => ({
  default: function DrugsTable() {
    return null;
  },
}));
vi.mock("@/components/CalculatedValues", () => ({ default: () => null }));
vi.mock("@/components/ProphylaxisAlerts", () => ({ default: () => null }));
vi.mock("@/components/DilutionInfo", () => ({ default: () => null }));
vi.mock("@/components/ToxicityPrediction", () => ({
  ToxicityPredictionWithMetrics: () => null,
}));
vi.mock("@/components/EmergencyModal", () => ({ default: () => null }));
vi.mock("@/components/PdfPreviewModal", () => ({ default: () => null }));
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
const drug = {
  name: "DRUG",
  dose: 10,
  doseUnit: "mg/m²" as const,
  route: "IV",
  days: "D1",
};
const protocol = {
  id: "ficticio-local",
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
const values = {
  bsa: 1.8,
  egfr: 90,
  globalAdjustmentFactor: 1,
  ecogAdjustmentFactor: 1,
  renalStatus: "green" as const,
  renalStatusLabel: "Normal",
};
let root: any;
const props = (type: any) => root.root.findByType(type).props;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  io.protocols.length = 0;
  act(() => {
    root = create(React.createElement(Calculator));
  });
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("troca explícita A→B limpa override/ciclo/toxicidade e suporte sem aguardar debounce", () => {
  act(() => props(PatientHistoryDB).onLoadPatient(patient, undefined, 101));
  act(() => props(ProtocolSelector).onProtocolChange(protocol));
  act(() => vi.advanceTimersByTime(300));
  act(() => {
    props(DrugsTable).onDoseChange(0, 7);
    props(ProtocolSelector).onCycleChange(5);
    props(ToxicityAssessment).onToxicityChange("neuropatia", 3);
  });
  const epochA = props(HydrationCalculator).sessionKey;
  act(() =>
    props(PatientHistoryDB).onLoadPatient(
      { ...patient, name: "FICTICIO-B", weight: 90 },
      undefined,
      202
    )
  );
  expect(props(DrugsTable).drugs).toEqual([]);
  expect(props(ProtocolSelector).selectedCycle).toBe(1);
  expect(props(ToxicityAssessment).toxicities).toEqual({});
  expect(props(HydrationCalculator).sessionKey).not.toBe(epochA);
  act(() => vi.advanceTimersByTime(300));
  expect(props(DrugsTable).drugs[0].calculatedDose).toBeGreaterThan(20);
});
it("reutiliza cadastro íntegro por ID, lê paciente/ciclo/contexto v2, mas não GFR nem doses do passado", () => {
  io.protocols = [{ ...protocol, protocolId: protocol.id, isActive: 1 }];
  act(() => root.update(React.createElement(Calculator)));
  const payload = buildPrescriptionDataV2({
    patientData: { ...patient, name: "FICTICIO-B" },
    calculatedValues: values,
    selectedProtocol: {
      ...protocol,
      templateContext: { cycle: 2, phaseId: "FASE", day: 0, gfrForCalvert: 82 },
    },
    selectedCycle: 2,
    calculatedDrugs: [{ ...drug, calculatedDose: 7 }],
    antiemetics: null,
    toxicities: {},
  });
  act(() =>
    props(PatientHistoryDB).onLoadPatient(
      { ...patient, name: "FICTICIO-B" },
      payload,
      202
    )
  );
  expect(props(PatientForm).data.name).toBe("FICTICIO-B");
  expect(props(PatientForm).data.calvertGfrAbsolute).toBeUndefined();
  expect(props(ProtocolSelector).selectedCycle).toBe(2);
  expect(props(ProtocolSelector).selectedProtocol.drugs).toEqual([drug]);
  act(() => vi.advanceTimersByTime(300));
  expect(props(DrugsTable).drugs[0].calculatedDose).not.toBe(7);
  expect(payload.protocol.templateContext?.gfrForCalvert).toBe(82);
});
it("snapshot de protocolo inexistente nunca vira entidade executável e exibe aviso", () => {
  const payload = buildPrescriptionDataV2({
    patientData: patient,
    calculatedValues: values,
    selectedProtocol: protocol,
    selectedCycle: 2,
    calculatedDrugs: [{ ...drug, calculatedDose: 7 }],
    antiemetics: null,
    toxicities: {},
  });
  act(() => props(PatientHistoryDB).onLoadPatient(patient, payload, 202));
  expect(props(ProtocolSelector).selectedProtocol).toBeNull();
  expect(JSON.stringify(root.toJSON())).toMatch(
    /não.*encontrado|indisponível/i
  );
});
