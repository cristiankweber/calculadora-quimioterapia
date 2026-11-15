import { describe, it, expect } from "vitest";
import { calculateDrugDose } from "./calculations";

describe("Calvert legado: GFR absoluto explícito em mL/min", () => {
  it.each([
    { auc: 5, gfr: 90, expected: 575 },
    { auc: 5, gfr: 45, expected: 350 },
    { auc: 6, gfr: 80, expected: 630 },
    { auc: 5, gfr: 75, expected: 500 },
    { auc: 5, gfr: 30, expected: 275 },
  ])(
    "AUC $auc e GFR absoluto $gfr produzem $expected mg",
    ({ auc, gfr, expected }) => {
      expect(calculateDrugDose(auc, "AUC", 1.8, 70, 1, undefined, gfr)).toBe(
        expected
      );
    }
  );
  it("sem GFR absoluto retorna estado não calculado, nunca o número AUC em mg", () => {
    expect(calculateDrugDose(5, "AUC", 1.8, 70, 1, undefined)).toBe(0);
  });
  it("mantém o fator de ajuste legado quando uma entrada absoluta foi explicitamente fornecida", () => {
    expect(calculateDrugDose(5, "AUC", 1.8, 70, 0.85, undefined, 90)).toBe(
      488.8
    );
  });
  it("não aplica novamente SC a um GFR já absoluto", () => {
    expect(calculateDrugDose(5, "AUC", 2.28, 100, 1, undefined, 113.6)).toBe(
      693
    );
  });
});
