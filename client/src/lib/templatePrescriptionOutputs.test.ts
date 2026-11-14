import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrintablePrescription from "@/components/PrintablePrescription";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import { generatePrescriptionPDF } from "./pdfGenerator";
import type { Drug, Protocol } from "@/types/calculator";

// A portal requires DOM insertion, unavailable in SSR. Only that environmental
// boundary is replaced; the dialog, preview, sections and drug rows remain real.
vi.mock("@radix-ui/react-dialog", async importOriginal => {
  const original =
    await importOriginal<typeof import("@radix-ui/react-dialog")>();
  return {
    ...original,
    Portal: ({ children }: { children: React.ReactNode }) => children,
  };
});

const templateDocument = {
  name: "Template de teste",
  sourceVersion: "2.18",
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
  extensions: {
    phaseLibrary: [
      { id: "CON", name: "Consolidação" },
      { id: "IND", name: "Indução" },
    ],
  },
  dilutionInfo: [
    {
      drugName: "Fármaco teste",
      diluent: "Diluente específico",
      volume: "50 mL",
      infusionTime: "20 minutos",
      stability: "Conferir produto",
    },
  ],
};
const protocol = {
  id: "TEST",
  name: "Template de teste",
  indication: "Fictícia",
  cycles: 6,
  cycleLength: 21,
  drugs: [],
  emetogenicRisk: "minimal",
  specialAlerts: ["Alerta específico"],
  prophylaxis: ["Profilaxia específica"],
  nursingCare: ["Cuidado específico"],
  renalAdjustments: ["Ajuste específico"],
  hepaticAdjustments: [],
  hematologicAdjustments: [],
  isUserTemplate: true,
  templateContext: { cycle: 2, phaseId: "CON", day: 0, gfrForCalvert: 82 },
  clinicalDocument: templateDocument,
} as Protocol;
const drug = {
  name: "Fármaco teste",
  dose: 5,
  doseUnit: "mcg/kg",
  calculatedDose: 350,
  resultUnit: "mcg",
  frequency: 2,
  dailyDose: 700,
  route: "SC",
  days: "D0",
  timeOrigin: "transplant_day_zero",
} as Drug;
const data = {
  patient: {
    name: "Fictício",
    age: 50,
    sex: "M" as const,
    weight: 70,
    height: 170,
    creatinine: 1,
    bilirubin: 0.8,
    ecog: 0 as const,
    comorbidities: "",
  },
  calculatedValues: {
    bsa: 1.8,
    egfr: 90,
    renalStatus: "green" as const,
    renalStatusLabel: "Normal",
    ecogAdjustmentFactor: 1,
    globalAdjustmentFactor: 1,
  },
  protocol,
  cycle: 1,
  drugs: [drug],
  antiemetics: {
    risk: "minimal" as const,
    day1: ["Antiemético específico"],
    days2to4: [],
    rescue: [],
    alerts: [],
  },
};
const sections = {
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
};
afterEach(() => vi.unstubAllGlobals());

async function pdf(input = data, filter?: typeof sections) {
  let captured: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      captured = blob;
      return "blob:captured";
    },
    revokeObjectURL: () => {},
  });
  vi.stubGlobal("window", { open: () => ({ onload: null, print: () => {} }) });
  await generatePrescriptionPDF({ ...input, sections: filter });
  return captured!.text();
}
function print(input = data, filter?: typeof sections) {
  vi.stubGlobal("React", React);
  return renderToStaticMarkup(
    createElement(PrintablePrescription, {
      ...input,
      sections: filter,
    } as React.ComponentProps<typeof PrintablePrescription>)
  );
}
function preview(input = data) {
  vi.stubGlobal("React", React);
  return renderToStaticMarkup(
    createElement(PdfPreviewModal, {
      ...input,
      open: true,
      onOpenChange: () => {},
      onConfirmPdf: () => {},
      onConfirmPrint: () => {},
    })
  );
}
function visibleText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
}

for (const [name, output] of [
  ["PDF", pdf],
  ["impressão", print],
  ["preview", preview],
] as const) {
  describe(`${name} — contrato real de saída dos templates`, () => {
    // Detecta fixar mg, usar a unidade da base ou multiplicar novamente o total diário.
    it("mostra unidade calculada, frequência e total de 24h já resolvido", async () => {
      const text = visibleText(await output());
      expect(text).toContain("350.0 mcg");
      expect(text).toContain("2 administrações/24h");
      expect(text).toContain("700.0 mcg/24h");
      expect(text).not.toContain("350.0 mg");
      expect(text).not.toContain("350.0 mcg/kg");
      expect(text).not.toContain("1400.0");
      expect(text).toContain("transplant_day_zero");
    });

    // Detecta perder o contexto selecionado ou ler ciclo legado em vez do templateContext.
    it("leva contexto explícito, versão e disclaimer sem afirmar homologação", async () => {
      const text = visibleText(await output());
      expect(text).toContain(
        "Template do usuário — validar antes de administrar"
      );
      expect(text).toContain("Versão de origem: 2.18");
      expect(text).toContain("Ciclo selecionado: 2");
      expect(text).toContain("Fase: Consolidação (CON)");
      expect(text).toContain("Dia selecionado: 0");
      expect(text).toContain("GFR para Calvert: 82 mL/min");
      expect(text).toContain("não equivale a homologação institucional");
      expect(text).not.toContain("Fase: Indução");
    });

    // Detecta mostrar a versão interna do template em vez da versão da fonte importada.
    it("usa sourceEnvelope/metadata do pacote real em vez da versão interna de template", async () => {
      const { sourceVersion: _version, ...original } = templateDocument;
      const imported = {
        ...protocol,
        clinicalDocument: { ...original, sourceDocument: original },
        clinicalPackage: {
          version: "user-protocol-template-1.0",
          metadata: { sourceVersion: "2.18" },
          sourceEnvelope: { version: "2.18" },
        },
      } as Protocol;
      const text = visibleText(await output({ ...data, protocol: imported }));
      expect(text).toContain("Versão de origem: 2.18");
      expect(text).not.toContain(
        "Versão de origem: user-protocol-template-1.0"
      );
    });

    // Detecta inventar diluente/estabilidade ou omitir status ausente no formato 2.18.
    it("reproduz farmacotécnica da droga selecionada com status técnico não informado", async () => {
      const text = visibleText(await output());
      expect(text).toContain("Diluente específico");
      expect(text).toContain("50 mL");
      expect(text).toContain("20 minutos");
      expect(text).toContain("Conferir produto");
      expect(text).toContain("Status farmacêutico: não informado");
      expect(text).not.toContain("48 horas");
    });

    it("não aplica parâmetros farmacêuticos de outra droga quando dados estão ausentes", async () => {
      const text = visibleText(
        await output({
          ...data,
          drugs: [{ ...drug, name: "Sem farmacotécnica" }],
        })
      );
      expect(text).toContain(
        "Dados farmacêuticos não fornecidos para este medicamento"
      );
      expect(text).not.toContain("Diluente específico");
      expect(text).not.toContain("50 mL");
    });

    it("não troca cálculo ausente ou total de infusão por zero ou dose base", async () => {
      const unresolved = {
        ...drug,
        calculatedDose: undefined,
        dailyDose: null,
        doseRepresents: "total_for_this_infusion",
      } as Drug;
      const text = visibleText(await output({ ...data, drugs: [unresolved] }));
      expect(text).toContain("Não calculada");
      expect(text).toContain("Total desta infusão, não taxa horária");
      expect(text).not.toContain("0.0 mcg");
      expect(text).not.toContain("700.0");
    });
  });
}

describe("Compatibilidade e filtros de saída", () => {
  it("impressão com filtro completo inclui as seções fornecidas ao preview", () => {
    const text = visibleText(
      print(data, {
        ...sections,
        specialAlerts: true,
        prophylaxis: true,
        nursingCare: true,
        doseAdjustments: true,
      })
    );
    expect(text).toContain("Alerta específico");
    expect(text).toContain("Profilaxia específica");
    expect(text).toContain("Cuidado específico");
    expect(text).toContain("Ajuste específico");
  });

  it("mantém dose legada calculada em mg sem adicionar metadados de template", async () => {
    const legacy = {
      ...protocol,
      isUserTemplate: undefined,
      templateContext: undefined,
      clinicalDocument: undefined,
    } as Protocol;
    const text = visibleText(
      await pdf({
        ...data,
        protocol: legacy,
        drugs: [
          {
            name: "Legado",
            dose: 20,
            doseUnit: "mg/m²",
            calculatedDose: 36,
            route: "IV",
            days: "D1",
          },
        ],
      })
    );
    expect(text).toContain("36.0 mg");
    expect(text).not.toContain("Template do usuário");
  });

  // Detecta imprimir seções desmarcadas no preview.
  it("impressão e PDF respeitam filtro sem remover aviso de revisão do template", async () => {
    for (const html of [print(data, sections), await pdf(data, sections)]) {
      const text = visibleText(html);
      expect(text).not.toContain("Antiemético específico");
      expect(text).not.toContain("Profilaxia específica");
      expect(text).not.toContain("Alerta específico");
      expect(text).not.toContain("Cuidado específico");
      expect(text).toContain(
        "Template do usuário — validar antes de administrar"
      );
      expect(text).toContain("350.0 mcg");
    }
  });

  it("escape de texto importado impede HTML executável na farmacotécnica", async () => {
    const unsafe = {
      ...protocol,
      clinicalDocument: {
        ...templateDocument,
        dilutionInfo: [
          {
            drugName: "Fármaco teste",
            diluent: "<script>alert(1)</script>",
            validationStatus: "pending",
          },
        ],
      },
    } as Protocol;
    const html = await pdf({ ...data, protocol: unsafe });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(visibleText(html)).toContain("Status farmacêutico: pending");
  });
});

describe("Templates não apresentam estimativa renal como ajuste automático", () => {
  it("mantém eGFR indexado e não mostra fator genérico como dose autorizada", async () => {
    for (const html of [print(), preview(), await pdf()]) {
      expect(html).toMatch(/mL\/min\/1\.73\s*m²/);
      expect(html).toContain("Estimativa renal indexada");
      expect(html).not.toContain("Fator de Ajuste Global:");
      expect(html).not.toContain("Fator de Ajuste:");
    }
  });
});
