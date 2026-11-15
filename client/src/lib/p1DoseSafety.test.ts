import { describe, it, expect } from "vitest";
import { drugPrescriptionOutput } from "./pdfGenerator";
import {
  calculateDrugDose,
  calculateDrugDoseLegacy,
} from "@shared/clinicalDoseEngine";
import type { Protocol, Drug } from "@/types/calculator";
const protocol = {
  id: "custom-precision",
  name: "Fixture",
  drugs: [],
  cycles: 1,
  cycleLength: 21,
} as unknown as Protocol;
const drug = (dose: number) =>
  ({
    name: "Fixture",
    dose,
    doseUnit: "mg",
    calculatedDose: dose,
    resultUnit: "mg",
    dailyDose: dose,
    frequency: 1,
    route: "IV",
    days: "1",
  }) as Drug;
describe("P1: dose positiva não vira zero nos documentos", () => {
  it.each([0.005, 0.001, 0.0000001])(
    "preserva %s mg no resultado e total diário",
    dose => {
      const out = drugPrescriptionOutput(drug(dose), protocol);
      expect(out.calculated).toBe(`${dose} mg`);
      expect(out.details).toContain(`Total de 24h: ${dose} mg/24h`);
    }
  );
  it("não arredonda dose fixa pequena a zero no motor legado", () => {
    expect(
      calculateDrugDose({
        baseDose: 0.005,
        doseUnit: "mg",
        bsa: 1.8,
        weight: 70,
      })
    ).toBe(0.005);
  });
});
describe("P1: Calvert requer grandeza absoluta explícita", () => {
  it("não usa eGFR indexado passado ao contrato genérico", () => {
    expect(
      calculateDrugDose({
        baseDose: 5,
        doseUnit: "AUC",
        bsa: 2.28,
        weight: 100,
        egfr: 86.2,
      })
    ).toBe(0);
  });
  it("não retorna AUC como se fosse dose em mg quando GFR está ausente", () => {
    expect(calculateDrugDoseLegacy(5, "AUC", 1.8, 70)).toBe(0);
  });
  it("aceita GFR absoluto sem multiplicação pela SC", () => {
    expect(
      calculateDrugDose({
        baseDose: 5,
        doseUnit: "AUC",
        bsa: 2.28,
        weight: 100,
        gfrAbsolute: 113.6,
      } as any)
    ).toBe(693);
  });
  it.each([0, -1, NaN, Infinity])(
    "recusa GFR absoluto inválido %s",
    gfrAbsolute => {
      expect(
        calculateDrugDose({
          baseDose: 5,
          doseUnit: "AUC",
          bsa: 2.28,
          weight: 100,
          gfrAbsolute,
        } as any)
      ).toBe(0);
    }
  );
});

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import DrugsTable from "@/components/DrugsTable";
it("o botão da dose calculada preserva 0.005 UI, não exibe 0.0 UI", () => {
  vi.stubGlobal("React", React);
  try {
    const small = {
      ...drug(0.005),
      doseUnit: "UI/m²",
      resultUnit: "UI",
    } as Drug;
    const html = renderToStaticMarkup(
      React.createElement(DrugsTable, { drugs: [small] })
    );
    const buttons = (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [])
      .join(" ")
      .replace(/<!--.*?-->/g, "");
    expect(buttons).toContain("0.005 UI");
    expect(buttons).not.toContain("0.0 UI");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("AUC sem entrada absoluta não é exibida como uma dose administrável 0.0 mg", () => {
  vi.stubGlobal("React", React);
  try {
    const pending = { ...drug(0), dose: 5, doseUnit: "AUC" } as Drug;
    const html = renderToStaticMarkup(
      React.createElement(DrugsTable, { drugs: [pending] })
    );
    const buttons = (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [])
      .join(" ")
      .replace(/<!--.*?-->/g, "");
    expect(buttons).toContain("Não calculada");
    expect(buttons).not.toContain("0.0 mg");
  } finally {
    vi.unstubAllGlobals();
  }
});

import { templatePrescriptionMetadata } from "./pdfGenerator";
it("identifica nos metadados o GFR absoluto explicitamente usado pelo legado", () => {
  const metadata = templatePrescriptionMetadata({
    ...protocol,
    calvertGfrAbsolute: 113.6,
    drugs: [{ ...drug(693), dose: 5, doseUnit: "AUC" }],
  } as Protocol).join("\n");
  expect(metadata).toContain("113.6 mL/min");
  expect(metadata).toContain("GFR absoluto");
});

it("arredondamento não ultrapassa teto absoluto pequeno nem promove 0.054 mg a 0.1 mg", () => {
  expect(
    calculateDrugDose({
      baseDose: 0.09,
      doseUnit: "mg",
      bsa: 1.8,
      weight: 70,
      maxDose: 0.054,
    })
  ).toBe(0.054);
  expect(
    calculateDrugDose({ baseDose: 0.054, doseUnit: "mg", bsa: 1.8, weight: 70 })
  ).toBe(0.054);
});
