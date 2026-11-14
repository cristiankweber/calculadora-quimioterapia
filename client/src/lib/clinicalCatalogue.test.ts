import { describe, expect, it } from "vitest";
import { getClinicalCatalogue, mapStoredProtocol } from "./clinicalCatalogue";

describe("Catálogo de seleção clínica", () => {
  it("seleção padrão expõe documentos com política e calendário, não doses legadas", () => {
    const catalogue = getClinicalCatalogue("reviewed", []);
    const dhap = catalogue.find(p => p.clinicalDocument?.id === "HEM-019");
    expect(dhap?.clinicalDocument?.name).toContain("cisplatina");
    expect(dhap?.drugs).toEqual([]);
    const policy = dhap?.clinicalDocument?.calculationPolicy as Record<
      string,
      unknown
    >;
    expect(policy?.automaticPrescriptionAllowed).toBe(false);
  });
  it("não mistura cadastros legados ou duplicatas sincronizadas na biblioteca revisada", () => {
    const catalogue = getClinicalCatalogue("reviewed", [
      {
        protocolId: "system-r-dhap",
        name: "R-DHAP",
        isActive: 1,
        drugs: [],
        cycles: 1,
        cycleLength: 21,
      },
    ]);
    expect(catalogue.filter(p => p.libraryKind === "legacy")).toHaveLength(0);
    expect(
      catalogue.filter(p => p.clinicalDocument?.id === "HEM-019")
    ).toHaveLength(1);
  });
  it("documento armazenado preserva campos desconhecidos sem cair em dose padrão", () => {
    const doc = {
      id: "EXTERNAL",
      name: "Externo",
      indication: "Teste",
      drugs: [{ name: "Dose não decidida", dose: null }],
      calculationPolicy: { automaticPrescriptionAllowed: false },
      futureClinicalField: { choice: "required" },
    };
    const mapped = mapStoredProtocol({
      protocolId: "external",
      name: "Externo",
      clinicalDocument: doc,
      clinicalPackage: { version: "v2" },
      drugs: [],
      cycles: 1,
      cycleLength: 21,
    });
    expect(mapped.clinicalDocument).toEqual(doc);
    expect(mapped.drugs).toEqual([]);
    expect(mapped.clinicalPackage?.version).toBe("v2");
  });
  it("mantém personalizados independentes separados dos legados conhecidos", () => {
    const catalogue = getClinicalCatalogue("custom", [
      {
        protocolId: "independent",
        name: "Personalizado independente",
        indication: "Uso institucional",
        drugs: [
          { name: "Droga", dose: 2, doseUnit: "mg", route: "VO", days: "1" },
        ],
        cycles: 1,
        cycleLength: 21,
        isActive: 1,
      },
      {
        protocolId: "old",
        name: "R-DHAP",
        drugs: [],
        cycles: 1,
        cycleLength: 21,
        isActive: 1,
      },
    ]);
    expect(catalogue.map(p => p.id)).toEqual(["independent"]);
    expect(catalogue[0].drugs[0].dose).toBe(2);
  });
});
