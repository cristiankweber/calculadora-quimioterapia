import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import DrugsTable from "@/components/DrugsTable";
import { drugPrescriptionOutput } from "./pdfGenerator";
import { calculateDrugDose } from "@shared/clinicalDoseEngine";
import type { Drug, Protocol } from "@/types/calculator";
const drug: Drug = {
  name: "Agente fictício",
  dose: 1200,
  doseUnit: "UI/m²",
  calculatedDose: 2160,
  maxDose: 2500,
  route: "IV",
  days: "1",
};
const protocol: Protocol = {
  id: "custom-unit-test",
  name: "Protocolo fictício",
  indication: "TESTE",
  cycles: 1,
  cycleLength: 21,
  drugs: [drug],
  emetogenicRisk: "low",
  specialAlerts: [],
  prophylaxis: [],
  nursingCare: [],
  renalAdjustments: [],
  hepaticAdjustments: [],
  hematologicAdjustments: [],
};
afterEach(() => vi.unstubAllGlobals());
describe("Unidade física de dose UI/m² é UI nas saídas", () => {
  it("exibe UI na dose calculada da tabela sem reinterpretar o número", () => {
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(
      React.createElement(DrugsTable, { drugs: [drug] })
    );
    expect(html).toMatch(/2160\.0(?:<!-- -->)?\s*(?:<!-- -->)?UI/);
    expect(html).not.toMatch(/2160\.0(?:<!-- -->)?\s*(?:<!-- -->)?mg/);
  });
  it("usa UI no fallback legado compartilhado por PDF e impressão", () => {
    expect(drugPrescriptionOutput(drug, protocol).calculated).toBe("2160.0 UI");
  });
  it("mantém dose por SC e limite absoluto na mesma escala UI", () => {
    expect(
      calculateDrugDose({
        baseDose: 1200,
        doseUnit: "UI/m²",
        bsa: 1.8,
        weight: 70,
      })
    ).toBe(2160);
    expect(
      calculateDrugDose({
        baseDose: 1200,
        doseUnit: "UI/m²",
        bsa: 1.8,
        weight: 70,
        maxDose: 2000,
      })
    ).toBe(2000);
  });
});
