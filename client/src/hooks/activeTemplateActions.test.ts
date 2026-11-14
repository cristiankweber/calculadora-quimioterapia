import { describe, expect, it } from "vitest";
import * as actions from "./usePrescriptionActions";
const build = (context: any) =>
  (actions as any).buildPrescriptionDataV2?.(context);
const context = () => ({
  patientData: {
    name: "Fictício",
    age: 80,
    sex: "M",
    weight: 70,
    height: 170,
    creatinine: 1,
    bilirubin: 0,
    ecog: 3,
    comorbidities: "",
  },
  calculatedValues: {
    bsa: 1.8,
    egfr: 90,
    renalStatus: "green",
    ecogAdjustmentFactor: 0.65,
    globalAdjustmentFactor: 0.585,
  },
  selectedProtocol: {
    id: "template-local-abc",
    name: "Fixture",
    indication: "Teste",
    cycles: 6,
    cycleLength: 21,
    emetogenicRisk: "low",
    isUserTemplate: true,
    templateContext: { cycle: 2, phaseId: "fase-explicita", day: 3 },
    specialAlerts: [],
  },
  selectedCycle: 2,
  calculatedDrugs: [
    {
      name: "Filgrastim",
      dose: 5,
      doseUnit: "mcg/kg",
      calculatedDose: 350,
      resultUnit: "mcg",
      route: "SC",
      days: "3",
      frequency: 1,
      dailyDose: 350,
      timeOrigin: "cycle_day_one",
      doseRepresents: "per_administration",
    },
  ],
  antiemetics: null,
  toxicities: { neuropatia: 3 },
});
describe("Payload real de templates mantém contexto e não inventa ajustes", () => {
  it("preserva contexto, frequência, unidade calculada e total diário", () => {
    const p = build(context());
    expect(p).toBeDefined();
    expect(p?.protocol.templateContext).toEqual({
      cycle: 2,
      phaseId: "fase-explicita",
      day: 3,
    });
    expect(p?.drugs[0]).toMatchObject({
      baseDose: 5,
      finalDose: 350,
      doseUnit: "mcg/kg",
      resultUnit: "mcg",
      frequency: 1,
      dailyDose: 350,
      timeOrigin: "cycle_day_one",
    });
  });
  it("não registra fator genérico ou dose por kg como ajuste manual do template", () => {
    const p = build(context());
    expect(p?.audit.formulaVersions.dose).toBe("schedule-aware-template-1.0");
    expect(p?.audit.globalAdjustmentFactor).toBe(1);
    expect(p?.audit.manualDoseOverrides).toBeUndefined();
    expect(p?.audit.toxicityAdjustments).toBeUndefined();
  });
});
