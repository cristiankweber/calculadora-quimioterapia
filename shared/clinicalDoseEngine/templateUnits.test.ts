import { describe, expect, it } from "vitest";
import { calculateDrugDose } from "./index";
describe("Unidades adicionais são dimensionalmente preservadas", () => {
  it.each([
    ["mcg/m²", 150, 270],
    ["UI/m²", 1200, 2160],
    ["mcg", 150, 150],
  ])("calcula %s sem converter para mg", (unit, baseDose, expected) => {
    expect(
      calculateDrugDose({
        baseDose: baseDose as number,
        doseUnit: unit as any,
        bsa: 1.8,
        weight: 70,
      })
    ).toBe(expected);
  });
});
