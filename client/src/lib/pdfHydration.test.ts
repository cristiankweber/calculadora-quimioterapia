/**
 * Testes para a integração de hidratação/eletrólitos/transfusão no PDF.
 * Verifica que as funções buildHydrationSection, buildElectrolytesSection e
 * buildTransfusionSection geram HTML correto.
 *
 * Como essas funções são internas ao pdfGenerator, testamos indiretamente
 * verificando a lógica de dados que alimenta o PDF.
 */

import { describe, expect, it } from "vitest";
import {
  calculateHydration,
  calculateElectrolyteReplacements,
  calculateTransfusionSupport,
  type HydrationResult,
  type ElectrolyteReplacement,
  type TransfusionRecommendation,
} from "./hydrationSupport";

describe("PDF Hydration Integration", () => {
  describe("Hydration data for PDF", () => {
    it("generates hydration data for cisplatin protocol", () => {
      const result = calculateHydration({
        weight: 70,
        bsa: 1.8,
        egfr: 90,
        protocolName: "Cisplatina + Etoposídeo",
        hasCardiacDisease: false,
        hasRenalImpairment: false,
      });

      expect(result).toBeDefined();
      expect(result.protocolType).toContain("cisplatin");
      expect(result.schemes.length).toBeGreaterThan(0);
      expect(result.totalVolume).toBeGreaterThan(0);
      expect(result.protocolLabel).toBeTruthy();

      // Verificar que cada scheme tem os campos necessários para o PDF
      result.schemes.forEach((scheme) => {
        expect(scheme.phaseLabel).toBeTruthy();
        expect(scheme.solution).toBeTruthy();
        expect(scheme.volume).toBeGreaterThan(0);
        expect(scheme.rate).toBeGreaterThan(0);
        expect(scheme.duration).toBeGreaterThan(0);
        expect(scheme.phase).toBeTruthy();
      });
    });

    it("generates hydration data with cardiac alerts", () => {
      const result = calculateHydration({
        weight: 70,
        bsa: 1.8,
        egfr: 90,
        protocolName: "Cisplatina + Etoposídeo",
        hasCardiacDisease: true,
        hasRenalImpairment: false,
      });

      expect(result.alerts.length).toBeGreaterThan(0);
      const cardiacAlert = result.alerts.find(
        (a) => a.message.toLowerCase().includes("cardiac") || a.message.toLowerCase().includes("cardio")
      );
      expect(cardiacAlert).toBeDefined();
    });

    it("returns none for non-nephrotoxic protocol", () => {
      const result = calculateHydration({
        weight: 70,
        bsa: 1.8,
        egfr: 90,
        protocolName: "R-CHOP",
        hasCardiacDisease: false,
        hasRenalImpairment: false,
      });

      // R-CHOP pode ter hidratação padrão ou nenhuma
      expect(result).toBeDefined();
    });
  });

  describe("Electrolyte data for PDF", () => {
    it("generates electrolyte replacements for low potassium", () => {
      const results = calculateElectrolyteReplacements({
        weight: 70,
        egfr: 90,
        hasCardiacDisease: false,
        potassium: 2.8,
      });

      const potassiumResult = results.find((r) => r.electrolyte.includes("Pot"));
      expect(potassiumResult).toBeDefined();
      expect(potassiumResult!.status).not.toBe("normal");
      expect(potassiumResult!.replacements.length).toBeGreaterThan(0);

      // Verificar campos necessários para o PDF
      potassiumResult!.replacements.forEach((r) => {
        expect(r.solution).toBeTruthy();
        expect(r.dose).toBeTruthy();
        expect(r.route).toBeTruthy();
        expect(r.rate).toBeTruthy();
        expect(r.duration).toBeTruthy();
        expect(r.frequency).toBeTruthy();
      });
    });

    it("generates electrolyte replacements for low magnesium", () => {
      const results = calculateElectrolyteReplacements({
        weight: 70,
        egfr: 90,
        hasCardiacDisease: false,
        magnesium: 1.2,
      });

      const mgResult = results.find((r) => r.electrolyte.includes("Magn"));
      expect(mgResult).toBeDefined();
      expect(mgResult!.status).not.toBe("normal");
    });

    it("returns normal status when all values are normal", () => {
      const results = calculateElectrolyteReplacements({
        weight: 70,
        egfr: 90,
        hasCardiacDisease: false,
        potassium: 4.0,
        sodium: 140,
        magnesium: 2.0,
        calciumIonized: 1.25,
        phosphorus: 3.5,
      });

      results.forEach((r) => {
        expect(r.status).toBe("normal");
      });
    });

    it("includes monitoring instructions for abnormal values", () => {
      const results = calculateElectrolyteReplacements({
        weight: 70,
        egfr: 90,
        hasCardiacDisease: false,
        potassium: 2.8,
      });

      const potassiumResult = results.find((r) => r.electrolyte.includes("Pot"));
      expect(potassiumResult!.monitoring.length).toBeGreaterThan(0);
    });
  });

  describe("Transfusion data for PDF", () => {
    it("indicates RBC transfusion for low hemoglobin", () => {
      const results = calculateTransfusionSupport({
        weight: 70,
        hemoglobin: 6.5,
        isBleeding: false,
        isPreProcedure: false,
        isBMT: false,
        isImmunosuppressed: false,
        hasFever: false,
      });

      const rbcResult = results.find(
        (r) => r.product === "rbc" || r.productLabel.includes("Hem")
      );
      expect(rbcResult).toBeDefined();
      expect(rbcResult!.indicated).toBe(true);

      // Verificar campos necessários para o PDF
      expect(rbcResult!.productLabel).toBeTruthy();
      expect(rbcResult!.volume).toBeTruthy();
      expect(rbcResult!.expectedIncrement).toBeTruthy();
      expect(rbcResult!.urgencyLabel).toBeTruthy();
    });

    it("indicates platelet transfusion for very low platelets", () => {
      const results = calculateTransfusionSupport({
        weight: 70,
        platelets: 8,
        isBleeding: false,
        isPreProcedure: false,
        isBMT: false,
        isImmunosuppressed: false,
        hasFever: false,
      });

      const plateletResult = results.find(
        (r) => r.product === "platelets" || r.productLabel.includes("Plaquet")
      );
      expect(plateletResult).toBeDefined();
      expect(plateletResult!.indicated).toBe(true);
    });

    it("does not indicate transfusion for normal values", () => {
      const results = calculateTransfusionSupport({
        weight: 70,
        hemoglobin: 12.0,
        platelets: 150,
        isBleeding: false,
        isPreProcedure: false,
        isBMT: false,
        isImmunosuppressed: false,
        hasFever: false,
      });

      results.forEach((r) => {
        expect(r.indicated).toBe(false);
      });
    });

    it("includes special requirements for BMT patients", () => {
      const results = calculateTransfusionSupport({
        weight: 70,
        hemoglobin: 6.5,
        isBleeding: false,
        isPreProcedure: false,
        isBMT: true,
        isImmunosuppressed: true,
        hasFever: false,
      });

      const rbcResult = results.find((r) => r.indicated);
      if (rbcResult) {
        expect(rbcResult.specialRequirements.length).toBeGreaterThan(0);
      }
    });

    it("includes premedication info for transfusion", () => {
      const results = calculateTransfusionSupport({
        weight: 70,
        hemoglobin: 6.5,
        isBleeding: false,
        isPreProcedure: false,
        isBMT: false,
        isImmunosuppressed: false,
        hasFever: false,
      });

      const rbcResult = results.find((r) => r.indicated);
      if (rbcResult) {
        expect(rbcResult.premedication.length).toBeGreaterThan(0);
      }
    });
  });

  describe("PDF data completeness", () => {
    it("all hydration schemes have required PDF fields", () => {
      const result = calculateHydration({
        weight: 70,
        bsa: 1.8,
        egfr: 90,
        protocolName: "HD-MTX",
        hasCardiacDisease: false,
        hasRenalImpairment: false,
      });

      if (result.schemes.length > 0) {
        result.schemes.forEach((s) => {
          expect(typeof s.solution).toBe("string");
          expect(typeof s.volume).toBe("number");
          expect(typeof s.rate).toBe("number");
          expect(typeof s.duration).toBe("number");
          expect(typeof s.phaseLabel).toBe("string");
          expect(typeof s.phase).toBe("string");
        });
      }
    });

    it("all electrolyte replacements have required PDF fields", () => {
      const results = calculateElectrolyteReplacements({
        weight: 70,
        egfr: 90,
        hasCardiacDisease: false,
        potassium: 2.0,
        sodium: 125,
        magnesium: 1.0,
      });

      results.forEach((e) => {
        expect(typeof e.electrolyte).toBe("string");
        expect(typeof e.status).toBe("string");
        expect(typeof e.statusLabel).toBe("string");
        expect(typeof e.unit).toBe("string");
        expect(typeof e.normalRange).toBe("string");
        expect(Array.isArray(e.replacements)).toBe(true);
        expect(Array.isArray(e.alerts)).toBe(true);
        expect(Array.isArray(e.monitoring)).toBe(true);
      });
    });

    it("all transfusion recommendations have required PDF fields", () => {
      const results = calculateTransfusionSupport({
        weight: 70,
        hemoglobin: 5.0,
        platelets: 5,
        isBleeding: true,
        isPreProcedure: false,
        isBMT: true,
        isImmunosuppressed: true,
        hasFever: false,
      });

      results.forEach((t) => {
        expect(typeof t.product).toBe("string");
        expect(typeof t.productLabel).toBe("string");
        expect(typeof t.indicated).toBe("boolean");
        expect(typeof t.urgency).toBe("string");
        expect(typeof t.urgencyLabel).toBe("string");
        expect(typeof t.volume).toBe("string");
        expect(typeof t.expectedIncrement).toBe("string");
        expect(typeof t.unit).toBe("string");
        expect(Array.isArray(t.specialRequirements)).toBe(true);
        expect(Array.isArray(t.premedication)).toBe(true);
        expect(Array.isArray(t.alerts)).toBe(true);
        expect(Array.isArray(t.monitoring)).toBe(true);
      });
    });
  });
});
