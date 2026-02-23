import { describe, expect, it } from "vitest";
import {
  calculateHydration,
  calculateElectrolyteReplacements,
  calculateTransfusionSupport,
} from "./hydrationSupport";

// ═══════════════════════════════════════════════════════════════════════════════
// TESTES DE HIDRATAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateHydration", () => {
  const baseInput = {
    weight: 70,
    bsa: 1.8,
    egfr: 90,
    hasCardiacDisease: false,
    hasRenalImpairment: false,
  };

  it("detecta protocolo com cisplatina e gera esquema de hidratação intensiva", () => {
    const result = calculateHydration({ ...baseInput, protocolName: "DHAP" });
    expect(result.protocolType).toBe("cisplatin_high");
    expect(result.schemes.length).toBeGreaterThanOrEqual(2);
    expect(result.totalVolume).toBeGreaterThan(1500);
    expect(result.schemes.some((s) => s.phase === "pre")).toBe(true);
    expect(result.schemes.some((s) => s.phase === "post")).toBe(true);
    expect(result.monitoring.length).toBeGreaterThan(0);
  });

  it("detecta metotrexato alta dose e inclui alcalinização", () => {
    const result = calculateHydration({ ...baseInput, protocolName: "HD-MTX" });
    expect(result.protocolType).toBe("methotrexate_hd");
    expect(result.schemes.length).toBeGreaterThanOrEqual(2);
    // Deve incluir NaHCO3 nos aditivos
    const hasAlkalinization = result.schemes.some(
      (s) => s.additives?.some((a) => a.includes("NaHCO3"))
    );
    expect(hasAlkalinization).toBe(true);
    // Deve ter alerta sobre pH urinário
    expect(result.alerts.some((a) => a.message.includes("pH"))).toBe(true);
  });

  it("detecta ifosfamida e inclui MESNA", () => {
    const result = calculateHydration({ ...baseInput, protocolName: "Ifosfamida alta dose" });
    expect(result.protocolType).toBe("ifosfamide");
    const hasMesna = result.schemes.some((s) => s.phaseLabel.includes("MESNA"));
    expect(hasMesna).toBe(true);
    expect(result.alerts.some((a) => a.message.includes("MESNA"))).toBe(true);
  });

  it("detecta ciclofosfamida alta dose (Hyper-CVAD A)", () => {
    const result = calculateHydration({ ...baseInput, protocolName: "Hyper-CVAD Parte A" });
    expect(result.protocolType).toBe("cyclophosphamide_hd");
    const hasMesna = result.schemes.some((s) => s.phaseLabel.includes("MESNA"));
    expect(hasMesna).toBe(true);
  });

  it("gera hidratação padrão para protocolos como R-CHOP", () => {
    const result = calculateHydration({ ...baseInput, protocolName: "R-CHOP" });
    expect(result.protocolType).toBe("standard");
    expect(result.schemes.length).toBeGreaterThanOrEqual(1);
    expect(result.totalVolume).toBeGreaterThan(0);
  });

  it("retorna 'none' para protocolos sem necessidade de hidratação especial", () => {
    const result = calculateHydration({ ...baseInput, protocolName: "Rituximab monoterapia" });
    expect(result.protocolType).toBe("none");
    expect(result.schemes.length).toBe(0);
    expect(result.totalVolume).toBe(0);
  });

  it("reduz volume em 30% para cardiopatas", () => {
    const normalResult = calculateHydration({ ...baseInput, protocolName: "DHAP", hasCardiacDisease: false });
    const cardiacResult = calculateHydration({ ...baseInput, protocolName: "DHAP", hasCardiacDisease: true });

    expect(cardiacResult.totalVolume).toBeLessThan(normalResult.totalVolume);
    expect(cardiacResult.alerts.some((a) => a.message.includes("cardiopata"))).toBe(true);
  });

  it("gera alerta para paciente com insuficiência renal", () => {
    const result = calculateHydration({
      ...baseInput,
      protocolName: "DHAP",
      egfr: 40,
      hasRenalImpairment: true,
    });
    expect(result.alerts.some((a) => a.message.includes("eGFR"))).toBe(true);
  });

  it("gera esquemas com volumes proporcionais à SC do paciente", () => {
    const smallPatient = calculateHydration({ ...baseInput, bsa: 1.4, protocolName: "DHAP" });
    const largePatient = calculateHydration({ ...baseInput, bsa: 2.2, protocolName: "DHAP" });

    expect(largePatient.totalVolume).toBeGreaterThan(smallPatient.totalVolume);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTES DE ELETRÓLITOS
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateElectrolyteReplacements", () => {
  const baseInput = {
    weight: 70,
    egfr: 90,
    hasCardiacDisease: false,
  };

  describe("Potássio", () => {
    it("identifica hipocalemia grave (K < 2.5 = critical)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, potassium: 2.2 });
      const k = results.find((r) => r.electrolyte.includes("Potássio"));
      expect(k).toBeDefined();
      expect(k!.status).toBe("critical");
      expect(k!.replacements.length).toBeGreaterThan(0);
      expect(k!.alerts.some((a) => a.includes("HIPOCALEMIA GRAVE"))).toBe(true);
    });

    it("identifica hipocalemia leve-moderada (K 3.0-3.5)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, potassium: 3.2 });
      const k = results.find((r) => r.electrolyte.includes("Potássio"));
      expect(k!.status).toBe("low");
      expect(k!.replacements.length).toBeGreaterThan(0);
    });

    it("identifica potássio normal (K 3.5-5.5)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, potassium: 4.2 });
      const k = results.find((r) => r.electrolyte.includes("Potássio"));
      expect(k!.status).toBe("normal");
      expect(k!.replacements.length).toBe(0);
    });

    it("identifica hipercalemia grave (K > 6.5)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, potassium: 7.0 });
      const k = results.find((r) => r.electrolyte.includes("Potássio"));
      expect(k!.status).toBe("critical_high");
      expect(k!.alerts.some((a) => a.includes("HIPERCALEMIA GRAVE"))).toBe(true);
    });

    it("alerta para cardiopatas com hipocalemia", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, potassium: 2.8, hasCardiacDisease: true });
      const k = results.find((r) => r.electrolyte.includes("Potássio"));
      expect(k!.alerts.some((a) => a.includes("CARDIOPATA"))).toBe(true);
    });
  });

  describe("Magnésio", () => {
    it("identifica hipomagnesemia grave (Mg < 1.0)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, magnesium: 0.8 });
      const mg = results.find((r) => r.electrolyte.includes("Magnésio"));
      expect(mg!.status).toBe("critical");
      expect(mg!.alerts.some((a) => a.includes("HIPOMAGNESEMIA GRAVE"))).toBe(true);
    });

    it("identifica magnésio normal", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, magnesium: 2.0 });
      const mg = results.find((r) => r.electrolyte.includes("Magnésio"));
      expect(mg!.status).toBe("normal");
    });

    it("alerta para insuficiência renal", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, magnesium: 1.5, egfr: 25 });
      const mg = results.find((r) => r.electrolyte.includes("Magnésio"));
      expect(mg!.alerts.some((a) => a.includes("Insuficiência renal"))).toBe(true);
    });
  });

  describe("Cálcio Ionizado", () => {
    it("identifica hipocalcemia grave (CaI < 0.9)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, calciumIonized: 0.85 });
      const ca = results.find((r) => r.electrolyte.includes("Cálcio"));
      expect(ca!.status).toBe("critical");
      expect(ca!.alerts.some((a) => a.includes("HIPOCALCEMIA GRAVE"))).toBe(true);
    });

    it("identifica hipercalcemia grave (CaI > 1.6)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, calciumIonized: 1.7 });
      const ca = results.find((r) => r.electrolyte.includes("Cálcio"));
      expect(ca!.status).toBe("critical_high");
      expect(ca!.alerts.some((a) => a.includes("HIPERCALCEMIA GRAVE"))).toBe(true);
    });
  });

  describe("Fósforo", () => {
    it("identifica hipofosfatemia grave (P < 1.0)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, phosphorus: 0.8 });
      const p = results.find((r) => r.electrolyte.includes("Fósforo"));
      expect(p!.status).toBe("critical");
      expect(p!.alerts.some((a) => a.includes("HIPOFOSFATEMIA GRAVE"))).toBe(true);
    });

    it("identifica hiperfosfatemia (lise tumoral)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, phosphorus: 8.0 });
      const p = results.find((r) => r.electrolyte.includes("Fósforo"));
      expect(p!.status).toBe("critical_high");
      expect(p!.alerts.some((a) => a.includes("HIPERFOSFATEMIA GRAVE"))).toBe(true);
    });
  });

  describe("Sódio", () => {
    it("identifica hiponatremia grave (Na < 120)", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, sodium: 115 });
      const na = results.find((r) => r.electrolyte.includes("Sódio"));
      expect(na!.status).toBe("critical");
      expect(na!.alerts.some((a) => a.includes("HIPONATREMIA GRAVE"))).toBe(true);
      // Deve mencionar limite de correção
      expect(na!.replacements[0]?.notes).toContain("8-10 mEq/L");
    });

    it("identifica sódio normal", () => {
      const results = calculateElectrolyteReplacements({ ...baseInput, sodium: 140 });
      const na = results.find((r) => r.electrolyte.includes("Sódio"));
      expect(na!.status).toBe("normal");
    });
  });

  it("retorna array vazio quando nenhum eletrólito é informado", () => {
    const results = calculateElectrolyteReplacements(baseInput);
    expect(results.length).toBe(0);
  });

  it("calcula múltiplos eletrólitos simultaneamente", () => {
    const results = calculateElectrolyteReplacements({
      ...baseInput,
      potassium: 2.8,
      magnesium: 1.2,
      calciumIonized: 1.0,
    });
    expect(results.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTES DE SUPORTE TRANSFUSIONAL
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateTransfusionSupport", () => {
  const baseInput = {
    weight: 70,
    isBleeding: false,
    isPreProcedure: false,
    isBMT: false,
    isImmunosuppressed: false,
    hasFever: false,
  };

  describe("Concentrado de Hemácias", () => {
    it("indica transfusão para Hb < 7 (threshold restritivo AABB)", () => {
      const results = calculateTransfusionSupport({ ...baseInput, hemoglobin: 6.5 });
      const rbc = results.find((r) => r.product === "rbc");
      expect(rbc!.indicated).toBe(true);
      expect(rbc!.urgency).toBe("routine");
      expect(rbc!.threshold).toBe(7.0);
    });

    it("indica transfusão imediata para Hb < 5", () => {
      const results = calculateTransfusionSupport({ ...baseInput, hemoglobin: 4.5 });
      const rbc = results.find((r) => r.product === "rbc");
      expect(rbc!.indicated).toBe(true);
      expect(rbc!.urgency).toBe("immediate");
      expect(rbc!.alerts.some((a) => a.includes("ANEMIA GRAVE"))).toBe(true);
    });

    it("não indica transfusão para Hb >= 7 sem sangramento", () => {
      const results = calculateTransfusionSupport({ ...baseInput, hemoglobin: 8.0 });
      const rbc = results.find((r) => r.product === "rbc");
      expect(rbc!.indicated).toBe(false);
    });

    it("usa threshold 8.0 para sangramento ativo", () => {
      const results = calculateTransfusionSupport({ ...baseInput, hemoglobin: 7.5, isBleeding: true });
      const rbc = results.find((r) => r.product === "rbc");
      expect(rbc!.indicated).toBe(true);
      expect(rbc!.threshold).toBe(8.0);
      expect(rbc!.urgency).toBe("immediate");
    });

    it("usa threshold 8.0 para pré-procedimento", () => {
      const results = calculateTransfusionSupport({ ...baseInput, hemoglobin: 7.5, isPreProcedure: true });
      const rbc = results.find((r) => r.product === "rbc");
      expect(rbc!.indicated).toBe(true);
      expect(rbc!.threshold).toBe(8.0);
    });

    it("inclui hemácias irradiadas para TMO", () => {
      const results = calculateTransfusionSupport({ ...baseInput, hemoglobin: 6.0, isBMT: true });
      const rbc = results.find((r) => r.product === "rbc");
      expect(rbc!.specialRequirements.some((r) => r.includes("IRRADIADAS"))).toBe(true);
      expect(rbc!.specialRequirements.some((r) => r.includes("FILTRADAS"))).toBe(true);
    });
  });

  describe("Concentrado de Plaquetas", () => {
    it("indica transfusão profilática para Plaq < 10.000", () => {
      const results = calculateTransfusionSupport({ ...baseInput, platelets: 8000 });
      const plt = results.find((r) => r.product === "platelets");
      expect(plt!.indicated).toBe(true);
      expect(plt!.threshold).toBe(10000);
    });

    it("indica transfusão imediata para Plaq < 5.000", () => {
      const results = calculateTransfusionSupport({ ...baseInput, platelets: 3000 });
      const plt = results.find((r) => r.product === "platelets");
      expect(plt!.indicated).toBe(true);
      expect(plt!.urgency).toBe("immediate");
      expect(plt!.alerts.some((a) => a.includes("PLAQUETOPENIA GRAVE"))).toBe(true);
    });

    it("não indica transfusão para Plaq >= 10.000 sem sangramento", () => {
      const results = calculateTransfusionSupport({ ...baseInput, platelets: 15000 });
      const plt = results.find((r) => r.product === "platelets");
      expect(plt!.indicated).toBe(false);
    });

    it("usa threshold 50.000 para sangramento ativo", () => {
      const results = calculateTransfusionSupport({ ...baseInput, platelets: 30000, isBleeding: true });
      const plt = results.find((r) => r.product === "platelets");
      expect(plt!.indicated).toBe(true);
      expect(plt!.threshold).toBe(50000);
    });

    it("usa threshold 20.000 para paciente com febre", () => {
      const results = calculateTransfusionSupport({ ...baseInput, platelets: 15000, hasFever: true });
      const plt = results.find((r) => r.product === "platelets");
      expect(plt!.indicated).toBe(true);
      expect(plt!.threshold).toBe(20000);
    });

    it("inclui plaquetas irradiadas para imunossuprimidos", () => {
      const results = calculateTransfusionSupport({ ...baseInput, platelets: 5000, isImmunosuppressed: true });
      const plt = results.find((r) => r.product === "platelets");
      expect(plt!.specialRequirements.some((r) => r.includes("IRRADIADAS"))).toBe(true);
    });

    it("normaliza valor de plaquetas em x10³/µL", () => {
      // 8 x10³/µL = 8000/mm³
      const results = calculateTransfusionSupport({ ...baseInput, platelets: 8 });
      const plt = results.find((r) => r.product === "platelets");
      expect(plt!.indicated).toBe(true);
      expect(plt!.currentValue).toBe(8000);
    });
  });

  it("retorna array vazio quando nenhum valor é informado", () => {
    const results = calculateTransfusionSupport(baseInput);
    expect(results.length).toBe(0);
  });

  it("calcula hemácias e plaquetas simultaneamente", () => {
    const results = calculateTransfusionSupport({
      ...baseInput,
      hemoglobin: 6.0,
      platelets: 5000,
    });
    expect(results.length).toBe(2);
    expect(results.some((r) => r.product === "rbc")).toBe(true);
    expect(results.some((r) => r.product === "platelets")).toBe(true);
  });
});
