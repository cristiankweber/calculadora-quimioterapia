import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrintablePrescription from "@/components/PrintablePrescription";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import * as generators from "./pdfGenerator";
import type { Drug, Protocol } from "@/types/calculator";
import type { PdfSections } from "@/components/PdfPreviewModal";
import clinicalPackage from "@shared/data/clinicalProtocols.json";

// Só substitui a inserção do portal, indisponível no SSR; conteúdo e componentes reais.
vi.mock("@radix-ui/react-dialog", async importOriginal => {
  const original =
    await importOriginal<typeof import("@radix-ui/react-dialog")>();
  return {
    ...original,
    Portal: ({ children }: { children: React.ReactNode }) => children,
  };
});

const archive = {
  dilutionInfo: [
    {
      drugName: "TEXTO_DROGA",
      drugId: "D01",
      diluent: "TEXTO_DILUENTE_ARQUIVADO",
      validationStatus: "TEXTO_STATUS_ARQUIVADO",
    },
  ],
};
const document = {
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
  sourceDocument: archive,
  dilutionInfo: [
    {
      drugName: "TEXTO_DROGA",
      drugId: "D01",
      diluent: "TEXTO_DILUENTE_ATUAL",
      volume: "TEXTO_VOLUME",
      infusionTime: "TEXTO_TEMPO_INFUSAO",
      stability: "TEXTO_ESTABILIDADE",
      specialInstructions: "TEXTO_INSTRUCOES",
      validationStatus: "TEXTO_STATUS_ATUAL",
    },
  ],
};
const protocol: Protocol = {
  id: "TEXTO_PROTOCOLO",
  name: "TEXTO_PROTOCOLO",
  indication: "TEXTO_INDICACAO",
  cycles: 1,
  cycleLength: 1,
  drugs: [],
  emetogenicRisk: "high",
  specialAlerts: [],
  prophylaxis: [],
  nursingCare: [],
  renalAdjustments: [],
  hepaticAdjustments: [],
  hematologicAdjustments: [],
  isUserTemplate: true,
  clinicalDocument: document,
};
const drug = {
  id: "D01",
  name: "TEXTO_DROGA",
  dose: 1,
  doseUnit: "mg",
  route: "IV",
  days: "TEXTO_DIAS",
  calculatedDose: 0.000123456789,
  resultUnit: "mg",
  observations: "TEXTO_NOTA_BASELINE",
} as Drug;
const data = {
  patient: {
    name: "TEXTO_PACIENTE",
    age: 50,
    sex: "M" as const,
    weight: 70,
    height: 170,
    creatinine: 1,
    bilirubin: 1,
    ecog: 0 as const,
    comorbidities: "",
  },
  calculatedValues: {
    bsa: 1.8,
    egfr: 90,
    renalStatus: "green" as const,
    renalStatusLabel: "TEXTO_RENAL",
    ecogAdjustmentFactor: 1,
    globalAdjustmentFactor: 1,
  },
  protocol,
  cycle: 1,
  drugs: [drug],
  antiemetics: {
    risk: "high" as const,
    day1: ["TEXTO_D1"],
    days2to4: ["TEXTO_D2D4"],
    rescue: ["TEXTO_RESGATE"],
    alerts: ["TEXTO_ALERTA_ANTI"],
    timeReference: "TEXTO_REFERENCIA_TEMPORAL",
  },
};
const sections: PdfSections = {
  patientData: false,
  calculatedValues: false,
  protocol: false,
  drugs: true,
  antiemetics: true,
  specialAlerts: false,
  prophylaxis: false,
  nursingCare: false,
  doseAdjustments: false,
  hydration: false,
  electrolytes: false,
  transfusion: false,
};

afterEach(() => vi.unstubAllGlobals());
function visibleText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
}
async function pdf(input = data, filter = sections) {
  let blob: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: (value: Blob) => {
      blob = value;
      return "blob:clinical-output";
    },
    revokeObjectURL: () => {},
  });
  vi.stubGlobal("window", { open: () => ({ onload: null, print: () => {} }) });
  await generators.generatePrescriptionPDF({ ...input, sections: filter });
  expect(blob).toBeInstanceOf(Blob);
  return visibleText(await blob!.text());
}
function print(input = data, filter = sections) {
  vi.stubGlobal("React", React);
  return visibleText(
    renderToStaticMarkup(
      createElement(PrintablePrescription, { ...input, sections: filter })
    )
  );
}
function preview(input = data) {
  vi.stubGlobal("React", React);
  return visibleText(
    renderToStaticMarkup(
      createElement(PdfPreviewModal, {
        ...input,
        open: true,
        onOpenChange: () => {},
        onConfirmPdf: () => {},
        onConfirmPrint: () => {},
      })
    )
  );
}
function copy(input = data) {
  const generator = (
    generators as unknown as {
      generatePrescriptionText?: (input: typeof data) => string;
    }
  ).generatePrescriptionText;
  expect(typeof generator, "gerador compartilhado da cópia deve existir").toBe(
    "function"
  );
  return generator!({ ...input });
}

for (const [name, output] of [
  ["PDF", pdf],
  ["impressão", print],
  ["prévia", preview],
  ["cópia", copy],
] as const) {
  describe(`${name} — dados clínicos atuais em saída real`, () => {
    it("preserva o risco antiemético já adaptado quando difere do cadastro legado", async () => {
      const text = await output({
        ...data,
        protocol: { ...protocol, emetogenicRisk: "minimal" },
      });
      expect(text).toContain("Risco Alto");
      expect(text).not.toContain("Risco Mínimo");
    });

    it("leva as três seções, alertas e referência temporal explícita junto com o risco", async () => {
      const text = await output();
      for (const literal of [
        "TEXTO_D1",
        "TEXTO_D2D4",
        "TEXTO_RESGATE",
        "TEXTO_ALERTA_ANTI",
        "TEXTO_REFERENCIA_TEMPORAL",
        "Referência temporal",
        "Risco Alto",
      ])
        expect(text).toContain(literal);
      expect(text).not.toContain("Pré-QT");
      expect(text).not.toContain("Dia da Quimioterapia");
    });

    it("BuEM real sem antieméticos não exibe Nenhum nem infere uma ordem", async () => {
      const buem = clinicalPackage.protocols.find(
        document => document.name === "BuEM"
      )!;
      const text = await output({
        ...data,
        protocol: {
          ...protocol,
          name: buem.name,
          clinicalDocument: { ...buem, templateUsage: document.templateUsage },
        },
        antiemetics: {
          risk: "high",
          day1: [],
          days2to4: [],
          rescue: [],
          alerts: [],
          timeReference: "",
        },
      });
      expect(text).toContain("Não informado — conferir/cadastrar");
      expect(text).toContain("Dia 1");
      expect(text).toContain("Dias 2-4");
      expect(text).toMatch(/Resgate|resgate/);
      // O aviso farmacêutico legítimo diz "Nenhum parâmetro universal aplicado".
      // A regressão proibida é transformar ausência de antiemese em "Nenhum".
      expect(
        text.slice(text.toLocaleUpperCase().indexOf("PROFILAXIA ANTIEMÉTICA"))
      ).not.toContain("Nenhum");
      expect(text).not.toContain("TEXTO_D1");
      expect(text).not.toContain("Ondansetrona");
    });

    it("com ordens sem referência temporal apresenta aviso, sem supor origem de D1", async () => {
      const text = await output({
        ...data,
        antiemetics: { ...data.antiemetics, timeReference: "" },
      });
      expect(text).toContain("Referência temporal não informada");
      expect(text).toContain("TEXTO_D1");
    });

    it("edição farmacêutica atual vence fonte arquivada sem mudar dose ou notas", async () => {
      const before = JSON.stringify(archive);
      const text = await output();
      for (const literal of [
        "TEXTO_DILUENTE_ATUAL",
        "TEXTO_VOLUME",
        "TEXTO_TEMPO_INFUSAO",
        "TEXTO_ESTABILIDADE",
        "TEXTO_INSTRUCOES",
        "Status farmacêutico informado",
        "TEXTO_STATUS_ATUAL",
        "0.000123456789 mg",
        "TEXTO_NOTA_BASELINE",
      ])
        expect(text).toContain(literal);
      expect(text).not.toContain("TEXTO_DILUENTE_ARQUIVADO");
      expect(JSON.stringify(archive)).toBe(before);
    });

    it("dilutionInfo [] é ausência deliberada, nunca restaura o arquivo histórico", async () => {
      const text = await output({
        ...data,
        protocol: {
          ...protocol,
          clinicalDocument: { ...document, dilutionInfo: [] },
        },
      });
      expect(text).toContain(
        "Dados farmacêuticos não fornecidos para este medicamento"
      );
      expect(text).not.toContain("TEXTO_DILUENTE_ARQUIVADO");
      expect(text).not.toContain("TEXTO_DILUENTE_ATUAL");
    });

    it("drugId estável prevalece sobre nome alterado e nomes duplicados", async () => {
      const text = await output({
        ...data,
        protocol: {
          ...protocol,
          clinicalDocument: {
            ...document,
            dilutionInfo: [
              {
                drugId: "OUTRO",
                drugName: drug.name,
                diluent: "TEXTO_OUTRA_IDENTIDADE",
              },
              {
                drugId: "D01",
                drugName: "TEXTO_NOME_ANTERIOR",
                diluent: "TEXTO_IDENTIDADE_ESTAVEL",
              },
            ],
          },
        },
      });
      expect(text).toContain("TEXTO_IDENTIDADE_ESTAVEL");
      expect(text).not.toContain("TEXTO_OUTRA_IDENTIDADE");
    });

    it("múltiplas entradas com mesmo nome sem identidade exigem desambiguação", async () => {
      const text = await output({
        ...data,
        drugs: [{ ...drug, id: undefined } as Drug],
        protocol: {
          ...protocol,
          clinicalDocument: {
            ...document,
            dilutionInfo: [
              { drugName: drug.name, diluent: "TEXTO_AMBIGUO_A" },
              { drugName: drug.name, diluent: "TEXTO_AMBIGUO_B" },
            ],
          },
        },
      });
      expect(text).toContain("Dados farmacêuticos ambíguos");
      expect(text).not.toContain("TEXTO_AMBIGUO_A");
      expect(text).not.toContain("TEXTO_AMBIGUO_B");
    });
  });
}

describe("farmacotécnica atual e compatibilidade histórica", () => {
  it("extensions atual é consultado quando root não existe; sourceDocument só se ambos ausentes", () => {
    const { dilutionInfo: _omit, ...root } = document;
    const current = generators.drugPrescriptionOutput(drug, {
      ...protocol,
      clinicalDocument: {
        ...root,
        extensions: { dilutionInfo: document.dilutionInfo },
      },
    });
    expect(current.pharmaceutical.join(" ")).toContain("TEXTO_DILUENTE_ATUAL");
    expect(current.pharmaceutical.join(" ")).not.toContain(
      "TEXTO_DILUENTE_ARQUIVADO"
    );
    const historical = generators.drugPrescriptionOutput(drug, {
      ...protocol,
      clinicalDocument: root,
    });
    expect(historical.pharmaceutical.join(" ")).toContain(
      "TEXTO_DILUENTE_ARQUIVADO"
    );
  });

  it.each([null, undefined, {}, "TEXTO_INVALIDO"])(
    "valor root explícito %j não revive arquivo",
    dilutionInfo => {
      const result = generators.drugPrescriptionOutput(drug, {
        ...protocol,
        clinicalDocument: { ...document, dilutionInfo },
      });
      expect(result.pharmaceutical.join(" ")).toContain(
        "Dados farmacêuticos não fornecidos"
      );
      expect(result.pharmaceutical.join(" ")).not.toContain(
        "TEXTO_DILUENTE_ARQUIVADO"
      );
    }
  );

  it("PDF e impressão respeitam desativação explícita da seção antiemética", async () => {
    for (const text of [
      await pdf(data, { ...sections, antiemetics: false }),
      print(data, { ...sections, antiemetics: false }),
    ]) {
      expect(text).not.toContain("TEXTO_D1");
      expect(text).not.toContain("TEXTO_ALERTA_ANTI");
      expect(text).not.toContain("TEXTO_REFERENCIA_TEMPORAL");
    }
  });

  it("HTML PDF escapa texto da referência temporal e dos alertas", async () => {
    const text = await pdf({
      ...data,
      antiemetics: {
        ...data.antiemetics,
        alerts: ["<script>TEXTO_ALERTA_XSS</script>"],
        timeReference: "<script>TEXTO_TEMPO_XSS</script>",
      },
    });
    expect(text).toContain("&lt;script&gt;TEXTO_ALERTA_XSS&lt;/script&gt;");
    expect(text).toContain("&lt;script&gt;TEXTO_TEMPO_XSS&lt;/script&gt;");
  });
});
