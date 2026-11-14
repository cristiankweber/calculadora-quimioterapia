import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CalculatedValuesDisplay from "./CalculatedValues";
import type { CalculatedValues } from "@/types/calculator";
// JSX legado usa React em escopo global; o teste renderiza o componente real.
Object.assign(globalThis, { React });
const values = {
  bsa: 1.8,
  egfr: 90,
  renalStatus: "green",
  renalStatusLabel: "Dose completa",
  ecogAdjustmentFactor: 0.75,
  globalAdjustmentFactor: 0.75,
} as CalculatedValues;
const html = () =>
  renderToStaticMarkup(
    React.createElement(CalculatedValuesDisplay, {
      values,
      referenceOnly: true,
    } as any)
  );
describe("Medidas de referência não sugerem ajuste de prescrição", () => {
  it("não apresenta percentual ECOG/idade ou dose completa para rascunhos", () => {
    const rendered = html();
    expect(rendered).not.toContain("ECOG + Idade");
    expect(rendered).not.toContain("Dose completa");
    expect(rendered).toContain("Sem ajuste automático");
  });
  it("identifica corretamente eGFR indexado, distinto de GFR absoluto para Calvert", () => {
    expect(html()).toContain("mL/min/1,73 m²");
    expect(html()).toContain("não substitui GFR absoluto");
  });
});
