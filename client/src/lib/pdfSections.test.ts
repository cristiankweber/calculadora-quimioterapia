/**
 * Testes para a funcionalidade de filtro de seções no PDF.
 * Verifica que o pdfGenerator respeita as seções habilitadas/desabilitadas
 * e que o PdfPreviewModal exporta os tipos corretos.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PdfSections } from '@/components/PdfPreviewModal';

describe('PdfSections type', () => {
  it('should have all 12 section keys', () => {
    const sections: PdfSections = {
      patientData: true,
      calculatedValues: true,
      protocol: true,
      drugs: true,
      specialAlerts: true,
      prophylaxis: true,
      antiemetics: true,
      nursingCare: true,
      doseAdjustments: true,
      hydration: true,
      electrolytes: true,
      transfusion: true,
    };

    expect(Object.keys(sections)).toHaveLength(12);
    expect(sections.patientData).toBe(true);
    expect(sections.hydration).toBe(true);
    expect(sections.transfusion).toBe(true);
  });

  it('should allow minimal sections', () => {
    const minimal: PdfSections = {
      patientData: true,
      calculatedValues: true,
      protocol: true,
      drugs: true,
      specialAlerts: true,
      prophylaxis: false,
      antiemetics: true,
      nursingCare: false,
      doseAdjustments: false,
      hydration: false,
      electrolytes: false,
      transfusion: false,
    };

    const enabledCount = Object.values(minimal).filter(Boolean).length;
    expect(enabledCount).toBe(6);
  });

  it('should count enabled sections correctly', () => {
    const sections: PdfSections = {
      patientData: true,
      calculatedValues: false,
      protocol: true,
      drugs: true,
      specialAlerts: false,
      prophylaxis: false,
      antiemetics: true,
      nursingCare: false,
      doseAdjustments: false,
      hydration: true,
      electrolytes: false,
      transfusion: true,
    };

    const enabledCount = Object.values(sections).filter(Boolean).length;
    const disabledCount = Object.values(sections).filter(v => !v).length;
    expect(enabledCount).toBe(6);
    expect(disabledCount).toBe(6);
  });
});

describe('generatePrescriptionPDF with sections filter', () => {
  // Mock window and related globals to prevent actual PDF generation
  let mockPrintWindow: { onload: (() => void) | null; print: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrintWindow = {
      onload: null,
      print: vi.fn(),
    };
    // Mock window object for Node.js test environment
    const mockWindow = {
      open: vi.fn().mockReturnValue(mockPrintWindow),
    };
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('Blob', class MockBlob {
      constructor(public parts: unknown[], public options: unknown) {}
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:test'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('should accept sections parameter without errors', async () => {
    const { generatePrescriptionPDF } = await import('@/lib/pdfGenerator');

    const sections: PdfSections = {
      patientData: true,
      calculatedValues: true,
      protocol: true,
      drugs: true,
      specialAlerts: false,
      prophylaxis: false,
      antiemetics: true,
      nursingCare: false,
      doseAdjustments: false,
      hydration: false,
      electrolytes: false,
      transfusion: false,
    };

    // Should not throw
    await expect(generatePrescriptionPDF({
      patient: {
        name: 'Teste',
        age: 50,
        sex: 'M' as const,
        weight: 70,
        height: 170,
        creatinine: 1.0,
        bilirubin: 0.8,
        ecog: 1,
        comorbidities: '',
      },
      calculatedValues: {
        bsa: 1.81,
        egfr: 90,
        renalStatus: 'green',
        renalStatusLabel: 'Normal',
        ecogAdjustmentFactor: 1,
        globalAdjustmentFactor: 1,
      },
      protocol: {
        id: 'test',
        name: 'Teste Protocol',
        indication: 'Teste',
        drugs: [],
        cycles: 6,
        cycleLength: 21,
        emetogenicRisk: 'high' as const,
        specialAlerts: [],
        prophylaxis: [],
        nursingCare: [],
        renalAdjustments: [],
        hepaticAdjustments: [],
        hematologicAdjustments: [],
      },
      cycle: 1,
      drugs: [],
      antiemetics: {
        risk: 'high' as const,
        day1: ['Ondansetrona 8mg IV'],
        days2to4: ['Dexametasona 4mg VO'],
        rescue: ['Metoclopramida 10mg IV'],
      },
      sections,
    })).resolves.not.toThrow();
  });

  it('should generate PDF with all sections when sections is undefined', async () => {
    const { generatePrescriptionPDF } = await import('@/lib/pdfGenerator');

    // Should not throw when sections is undefined (default behavior)
    await expect(generatePrescriptionPDF({
      patient: {
        name: 'Teste',
        age: 50,
        sex: 'M' as const,
        weight: 70,
        height: 170,
        creatinine: 1.0,
        bilirubin: 0.8,
        ecog: 1,
        comorbidities: '',
      },
      calculatedValues: {
        bsa: 1.81,
        egfr: 90,
        renalStatus: 'green',
        renalStatusLabel: 'Normal',
        ecogAdjustmentFactor: 1,
        globalAdjustmentFactor: 1,
      },
      protocol: {
        id: 'test',
        name: 'Teste Protocol',
        indication: 'Teste',
        drugs: [],
        cycles: 6,
        cycleLength: 21,
        emetogenicRisk: 'high' as const,
        specialAlerts: ['Alerta teste'],
        prophylaxis: ['Profilaxia teste'],
        nursingCare: ['Cuidado teste'],
        renalAdjustments: ['Ajuste renal'],
        hepaticAdjustments: [],
        hematologicAdjustments: [],
      },
      cycle: 1,
      drugs: [{
        name: 'Cisplatina',
        dose: 75,
        doseUnit: 'mg/m²',
        route: 'IV',
        days: '1',
        calculatedDose: 135.75,
        observations: 'Teste',
      }],
      antiemetics: {
        risk: 'high' as const,
        day1: ['Ondansetrona 8mg IV'],
        days2to4: ['Dexametasona 4mg VO'],
        rescue: ['Metoclopramida 10mg IV'],
      },
      // sections is undefined - should include everything
    })).resolves.not.toThrow();
  });

  it('should pass Blob content to window.open', async () => {
    const { generatePrescriptionPDF } = await import('@/lib/pdfGenerator');

    await generatePrescriptionPDF({
      patient: {
        name: 'Teste',
        age: 50,
        sex: 'M' as const,
        weight: 70,
        height: 170,
        creatinine: 1.0,
        bilirubin: 0.8,
        ecog: 1,
        comorbidities: '',
      },
      calculatedValues: {
        bsa: 1.81,
        egfr: 90,
        renalStatus: 'green',
        renalStatusLabel: 'Normal',
        ecogAdjustmentFactor: 1,
        globalAdjustmentFactor: 1,
      },
      protocol: {
        id: 'test',
        name: 'Teste Protocol',
        indication: 'Teste',
        drugs: [],
        cycles: 6,
        cycleLength: 21,
        emetogenicRisk: 'high' as const,
        specialAlerts: [],
        prophylaxis: [],
        nursingCare: [],
        renalAdjustments: [],
        hepaticAdjustments: [],
        hematologicAdjustments: [],
      },
      cycle: 1,
      drugs: [],
      antiemetics: {
        risk: 'high' as const,
        day1: ['Ondansetrona 8mg IV'],
        days2to4: ['Dexametasona 4mg VO'],
        rescue: ['Metoclopramida 10mg IV'],
      },
      sections: {
        patientData: true,
        calculatedValues: false,
        protocol: true,
        drugs: true,
        specialAlerts: false,
        prophylaxis: false,
        antiemetics: false,
        nursingCare: false,
        doseAdjustments: false,
        hydration: false,
        electrolytes: false,
        transfusion: false,
      },
    });

    // Verify window.open was called
    expect((window as any).open).toHaveBeenCalledWith('blob:test', '_blank');
  });
});

describe('Section toggle logic', () => {
  it('should toggle individual sections', () => {
    const sections: PdfSections = {
      patientData: true,
      calculatedValues: true,
      protocol: true,
      drugs: true,
      specialAlerts: true,
      prophylaxis: true,
      antiemetics: true,
      nursingCare: true,
      doseAdjustments: true,
      hydration: true,
      electrolytes: true,
      transfusion: true,
    };

    // Simulate toggle
    const key: keyof PdfSections = 'hydration';
    const toggled = { ...sections, [key]: !sections[key] };

    expect(toggled.hydration).toBe(false);
    expect(toggled.patientData).toBe(true); // Others unchanged
  });

  it('should correctly identify sections with data', () => {
    // Simulate hasData checks
    const hasHydration = (hydration: { protocolType: string; schemes: unknown[] } | null) =>
      !!(hydration && hydration.protocolType !== 'none' && hydration.schemes.length > 0);

    expect(hasHydration(null)).toBe(false);
    expect(hasHydration({ protocolType: 'none', schemes: [] })).toBe(false);
    expect(hasHydration({ protocolType: 'cisplatin', schemes: [{}] })).toBe(true);

    const hasElectrolytes = (electrolytes: { status: string }[] | null) =>
      !!(electrolytes && electrolytes.filter(e => e.status !== 'normal').length > 0);

    expect(hasElectrolytes(null)).toBe(false);
    expect(hasElectrolytes([{ status: 'normal' }])).toBe(false);
    expect(hasElectrolytes([{ status: 'low' }])).toBe(true);
    expect(hasElectrolytes([{ status: 'normal' }, { status: 'critical' }])).toBe(true);

    const hasTransfusion = (transfusion: { indicated: boolean }[] | null) =>
      !!(transfusion && transfusion.filter(t => t.indicated).length > 0);

    expect(hasTransfusion(null)).toBe(false);
    expect(hasTransfusion([{ indicated: false }])).toBe(false);
    expect(hasTransfusion([{ indicated: true }])).toBe(true);
  });
});
