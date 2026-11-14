import { describe, expect, it } from "vitest";
import { calculateHydration, type HydrationInput } from "./hydrationSupport";
const base = {
  weight: 70,
  bsa: 1.8,
  egfr: 90,
  hasCardiacDisease: false,
  hasRenalImpairment: false,
};
function run(
  protocolName: string,
  drugs: Array<{
    name: string;
    dose: number;
    doseUnit: string;
    administrationsPerDay?: number;
  }>
) {
  return calculateHydration({ ...base, protocolName, drugs } as HydrationInput);
}
describe("Hidratação pelas drogas efetivas", () => {
  it("R-ICE com ifosfamida e carboplatina não gera cisplatina", () => {
    expect(
      run("R-ICE", [
        { name: "Ifosfamida", dose: 5000, doseUnit: "mg/m²" },
        { name: "Carboplatina", dose: 5, doseUnit: "AUC" },
      ]).protocolType
    ).toBe("ifosfamide");
  });
  it("FLAG-Ida sem ifosfamida não gera prevenção de cistite por nome", () => {
    expect(
      run("FLAG-Ida", [
        { name: "Fludarabina", dose: 30, doseUnit: "mg/m²" },
        { name: "Citarabina", dose: 2000, doseUnit: "mg/m²" },
      ]).protocolType
    ).toBe("none");
  });
  it("R-DHAP contendo apenas carboplatina não gera cisplatina", () => {
    expect(
      run("R-DHAP", [{ name: "Carboplatina", dose: 5, doseUnit: "AUC" }])
        .protocolType
    ).toBe("standard");
  });
  it("nenhuma droga programada no dia não cai no nome do protocolo", () => {
    expect(run("R-DHAP", []).schemes).toEqual([]);
  });
  it("agentes com requisitos diferentes não somam esquemas nem escolhem prioridade silenciosa", () => {
    const result = run("SMILE", [
      { name: "Metotrexato", dose: 2000, doseUnit: "mg/m²" },
      { name: "Ifosfamida", dose: 1500, doseUnit: "mg/m²" },
    ]);
    expect(result.schemes).toEqual([]);
    expect(
      result.alerts.filter(a => a.type === "warning").length
    ).toBeGreaterThan(0);
    expect(result.protocolLabel).toContain("múltiplos");
  });
  it("cisplatina declarada dispara hidratação sem depender do nome", () => {
    expect(
      run("Variante institucional", [
        { name: "Cisplatina", dose: 100, doseUnit: "mg/m²" },
      ]).protocolType
    ).toBe("cisplatin_high");
  });
  it("seleção de fase/dose não resolvida não produz esquema mesmo com cisplatina", () => {
    const result = calculateHydration({
      ...base,
      protocolName: "R-DHAP",
      selectionResolved: false,
      drugs: [{ name: "Cisplatina", dose: 100, doseUnit: "mg/m²" }],
    } as HydrationInput);
    expect(result.schemes).toEqual([]);
    expect(result.protocolLabel).toContain("não resolvida");
  });
});
