import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { drugPrescriptionOutput } from "@/lib/pdfGenerator";
import { buildPrescriptionDataV2 } from "./usePrescriptionActions";
import {
  readPrescriptionHistory,
  preparePrescriptionReuse,
} from "./prescriptionHistoryAdapter";
import PrintablePrescription from "@/components/PrintablePrescription";
import type {
  Drug,
  Protocol,
  PatientData,
  CalculatedValues,
} from "@/types/calculator";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

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
  name: "Teste",
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
  },
};
const drug = {
  name: "Fictícia",
  dose: 5,
  doseUnit: "mcg/kg",
  calculatedDose: 350,
  finalDose: 175,
  rowKey: "phase-A/drug-1/stage-0",
  adjustmentReason: "Toxicidade documentada",
  isManualDose: true,
  dailyDose: 700,
  prescribedDailyDose: 350,
  resultUnit: "mcg",
  frequency: 2,
  route: "SC",
  days: "D1",
  timeOrigin: "cycle_day_one",
  doseRepresents: "per_administration",
} as Drug;
const context = (drugs: Drug[] = [drug]) => ({
  patientData: patient,
  calculatedValues: values,
  selectedProtocol: protocol,
  selectedCycle: 1,
  calculatedDrugs: drugs,
  antiemetics: null,
  toxicities: {},
});

describe("Dose prescrita nas saídas e snapshot", () => {
  // Detecta emitir baseline como ordem e manter total diário anterior ao ajuste.
  it("emite final como ordem e baseline/motivo como referência", () => {
    const output = drugPrescriptionOutput(drug, protocol);
    expect(output.calculated).toBe("175.0 mcg");
    expect(output.details).toContain(
      "Dose calculada pelo protocolo: 350.0 mcg"
    );
    expect(output.details).toContain(
      "Ajuste manual — motivo: Toxicidade documentada"
    );
    expect(output.details).toContain("Total de 24h: 350.0 mcg/24h");
    expect(output.details).not.toContain("Total de 24h: 700.0 mcg/24h");
  });
  it("protege null explícito da dose diária prescrita, sem fallback numérico", () => {
    const output = drugPrescriptionOutput(
      {
        ...drug,
        prescribedDailyDose: null,
        doseRepresents: "total_for_this_infusion",
      },
      protocol
    );
    expect(output.details.some(line => line.startsWith("Total de 24h:"))).toBe(
      false
    );
    expect(output.details).toContain("Total desta infusão, não taxa horária");
  });
  it("preserva uma quantidade pequena exata e o motivo mínimo de um caractere", () => {
    const output = drugPrescriptionOutput(
      {
        ...drug,
        calculatedDose: 0.000004,
        finalDose: 0.000003,
        adjustmentReason: "x",
        prescribedDailyDose: 0.000006,
      },
      protocol
    );
    expect(output.calculated).toBe("0.000003 mcg");
    expect(output.details).toContain(
      "Dose calculada pelo protocolo: 0.000004 mcg"
    );
    expect(output.details).toContain("Ajuste manual — motivo: x");
  });
  it("não fabrica motivo nem ajuste em uma dose não alterada", () => {
    const output = drugPrescriptionOutput(
      {
        ...drug,
        finalDose: 350,
        isManualDose: false,
        adjustmentReason: undefined,
        prescribedDailyDose: 700,
      },
      protocol
    );
    expect(output.calculated).toBe("350.0 mcg");
    expect(output.details.some(line => line.includes("Ajuste manual"))).toBe(
      false
    );
  });
  it("builder preserva baseline, final, identidade e auditoria real do ajuste", () => {
    const payload = buildPrescriptionDataV2(context());
    expect(payload.drugs[0]).toMatchObject({
      calculatedDose: 350,
      finalDose: 175,
      rowKey: drug.rowKey,
      adjustmentReason: "Toxicidade documentada",
      isManualDose: true,
      dailyDose: 700,
      prescribedDailyDose: 350,
    });
    expect(payload.audit.manualDoseOverrides).toEqual([
      {
        rowKey: drug.rowKey,
        drugName: "Fictícia",
        originalDose: 350,
        manualDose: 175,
        reason: "Toxicidade documentada",
      },
    ]);
  });
  it("dose por kg não é auditoria manual e daily null permanece null", () => {
    const payload = buildPrescriptionDataV2(
      context([
        {
          ...drug,
          finalDose: 350,
          adjustmentReason: undefined,
          isManualDose: false,
          dailyDose: null,
          prescribedDailyDose: null,
        },
      ])
    );
    expect(payload.audit.manualDoseOverrides).toBeUndefined();
    expect(payload.drugs[0].dailyDose).toBeNull();
    expect((payload.drugs[0] as any).prescribedDailyDose).toBeNull();
  });
  it("adapter preserva campos novos, total diário null e notas independentemente do motivo", () => {
    const snapshot = readPrescriptionHistory({
      protocol: { id: protocol.id },
      drugs: [
        {
          ...drug,
          dailyDose: null,
          prescribedDailyDose: null,
          notes: "Orientação farmacêutica",
        },
      ],
    });
    expect(snapshot.drugs[0]).toMatchObject({
      calculatedDose: 350,
      finalDose: 175,
      rowKey: drug.rowKey,
      adjustmentReason: "Toxicidade documentada",
      isManualDose: true,
      dailyDose: null,
      prescribedDailyDose: null,
      notes: "Orientação farmacêutica",
    });
    expect(
      preparePrescriptionReuse(patient, snapshot, [
        {
          ...protocol,
          drugs: [
            {
              name: "Atual",
              dose: 10,
              doseUnit: "mg",
              route: "IV",
              days: "D1",
            },
          ],
        },
      ]).protocol?.drugs
    ).toEqual([
      { name: "Atual", dose: 10, doseUnit: "mg", route: "IV", days: "D1" },
    ]);
  });
  it("impressão SSR real exibe ordem final, baseline e motivo", () => {
    const html = renderToStaticMarkup(
      React.createElement(PrintablePrescription, {
        patient,
        calculatedValues: values,
        protocol,
        cycle: 1,
        drugs: [drug],
        antiemetics: {
          risk: "minimal",
          day1: [],
          days2to4: [],
          rescue: [],
          alerts: [],
        },
      })
    );
    expect(html).toContain("175.0 mcg");
    expect(html).toContain("Dose calculada pelo protocolo: 350.0 mcg");
    expect(html).toContain("Toxicidade documentada");
  });
});
