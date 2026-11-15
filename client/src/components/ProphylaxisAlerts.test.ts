import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import ProphylaxisAlerts from "./ProphylaxisAlerts";
import type { Protocol } from "@/types/calculator";
const lists = [
  "specialAlerts",
  "prophylaxis",
  "nursingCare",
  "renalAdjustments",
  "hepaticAdjustments",
  "hematologicAdjustments",
] as const;
const protocol = (): Protocol => ({
  id: "display-fixture",
  name: "Protocolo fictício",
  indication: "Teste de apresentação",
  cycles: 1,
  cycleLength: 21,
  drugs: [],
  emetogenicRisk: "minimal",
  specialAlerts: [],
  prophylaxis: [],
  nursingCare: [],
  renalAdjustments: [],
  hepaticAdjustments: [],
  hematologicAdjustments: [],
});
const html = (p: Protocol | null) =>
  renderToStaticMarkup(
    React.createElement(ProphylaxisAlerts, { protocol: p, antiemetics: null })
  );
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => vi.unstubAllGlobals());
describe("ProphylaxisAlerts não quebra por metadados clínicos ausentes", () => {
  it("preserva o estado sem protocolo selecionado", () =>
    expect(html(null)).toContain("Selecione um protocolo"));
  it.each(lists)("tolera %s ausente sem inferir uma recomendação", field => {
    const p = protocol();
    delete (p as any)[field];
    const result = html(p);
    expect(result).toContain("Profilaxias e Cuidados");
    expect(result).toMatch(/não informad|incomplet|ausent/i);
    expect(p).not.toHaveProperty(field);
  });
  it.each(lists)("tolera %s nulo preservando o objeto original", field => {
    const p = protocol();
    (p as any)[field] = null;
    expect(() => html(p)).not.toThrow();
    expect((p as any)[field]).toBeNull();
  });
  it("tolera protocolo mínimo recebido sem listas", () => {
    expect(
      html({
        id: "minimal",
        name: "Fictício mínimo",
        drugs: [],
      } as unknown as Protocol)
    ).toContain("Profilaxias e Cuidados");
  });
  it("não tenta renderizar objetos ou números como instruções clínicas", () => {
    const p = protocol();
    (p as any).specialAlerts = [null, 2, { invalid: true }, "Alerta válido"];
    (p as any).prophylaxis = "campo inválido";
    const result = html(p);
    expect(result).toContain("Alerta válido");
    expect(result).not.toContain("[object Object]");
    expect(p.specialAlerts).toHaveLength(4);
  });
  it("preserva alertas, profilaxia e ajustes textuais válidos", () => {
    const p = protocol();
    p.specialAlerts = ["Alerta explícito da fonte"];
    p.prophylaxis = ["Profilaxia explícita da fonte"];
    p.renalAdjustments = ["Ajuste renal da fonte"];
    p.hepaticAdjustments = ["Ajuste hepático da fonte"];
    p.hematologicAdjustments = ["Ajuste hematológico da fonte"];
    const result = html(p);
    for (const text of [
      ...p.specialAlerts,
      ...p.prophylaxis,
      ...p.renalAdjustments,
      ...p.hepaticAdjustments,
      ...p.hematologicAdjustments,
    ])
      expect(result).toContain(text);
    expect(result).not.toMatch(/dados.*incomplet/i);
  });
});
