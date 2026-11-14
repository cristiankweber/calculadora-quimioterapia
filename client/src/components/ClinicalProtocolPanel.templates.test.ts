import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ClinicalProtocolPanel, {
  type ClinicalProtocolPanelProps,
} from "./ClinicalProtocolPanel";

const document = {
  id: "TEMPLATE-TEST",
  name: "Template fictício",
  indication: "Teste sem paciente",
  cycles: 6,
  cycleLength: 21,
  drugs: [],
  sources: ["REF-TEST"],
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
  sourceVersion: "2.18",
  dilutionInfo: [
    { drugName: "Teste", diluent: "Produto específico", volume: "50 mL" },
  ],
};
const row = {
  source: {
    id: "D1",
    name: "Dose da fase",
    dose: 5,
    doseUnit: "mcg/kg",
    route: "SC",
    days: "D0",
  },
  dose: 5,
  calculatedDose: 350,
  dailyDose: 700,
  resultUnit: "mcg",
  frequency: 2,
  days: "D0",
  status: "ready",
  issues: [],
  timeOrigin: "transplant_day_zero",
};
function render(
  doc: unknown = document,
  context: unknown = { cycle: 2, day: 0 },
  issues: string[] = []
) {
  return renderToStaticMarkup(
    createElement(ClinicalProtocolPanel, {
      document: doc,
      context,
      resolution: {
        rows: [row],
        issues,
        cycleLength: 21,
        prescriptionBlocked: false,
      },
      onContextChange: () => {},
    } as ClinicalProtocolPanelProps)
  );
}

describe("Painel de templates ativos — saída SSR real", () => {
  // Detecta aplicar o bloqueio geral de rascunhos ao template ativo ou afirmar homologação.
  it("permite revisar doses de template ativo sem rotular rascunho ou simulação exclusiva", () => {
    const html = render();
    expect(html).toContain(
      "Template do usuário — validar antes de administrar"
    );
    expect(html).toContain("Doses resolvidas para revisão");
    expect(html).toContain("350 mcg");
    expect(html).toContain("700 mcg/24h");
    expect(html).not.toContain("Rascunho bloqueado");
    expect(html).not.toContain("bloqueio de prescrição é permanente");
    expect(html).not.toContain("Simulação para revisão");
    expect(html).toContain("não equivale a homologação institucional");
  });

  // Detecta perder sourceVersion/status ausente ou transformar dado farmacêutico em aprovação.
  it("mostra versão de origem e status técnico não informado sem fabricar aprovação", () => {
    const html = render();
    expect(html).toContain("2.18");
    expect(html).toContain("Status técnico da revisão: não informado");
    expect(html).toContain("Status farmacêutico: não informado");
    expect(html).toContain("Produto específico");
    expect(html).not.toContain("approved");
  });

  // Detecta suprimir uma pendência concreta ao ativar um template.
  it("mantém pendência concreta e oculta doses até selecionar explicitamente uma fase", () => {
    const html = render(
      {
        ...document,
        extensions: {
          phaseLibrary: [
            { id: "A", name: "Fase A", drugs: [row.source] },
            {
              id: "B",
              name: "Fase B",
              drugs: [{ ...row.source, name: "Alternativa B" }],
            },
          ],
        },
      },
      { cycle: 2 },
      ["GFR absoluto necessário para Calvert"]
    );
    expect(html).toContain("Fase obrigatória: selecione uma fase");
    expect(html).toContain("GFR absoluto necessário para Calvert");
    expect(html).not.toContain("Doses resolvidas para revisão");
    expect(html).not.toContain("350 mcg");
    expect(html).toContain("Template do usuário");
  });

  it("continua tratando documentos sem marcador ativo como rascunhos bloqueados", () => {
    const html = render({ ...document, templateUsage: undefined });
    expect(html).toContain("Rascunho bloqueado");
    expect(html).toContain("bloqueio de prescrição é permanente");
    expect(html).not.toContain(
      "Template do usuário — validar antes de administrar"
    );
  });

  it("identifica versão da fonte no pacote normalizado e não a versão do envelope de template", () => {
    const { sourceVersion: _version, ...original } = document;
    const html = renderToStaticMarkup(
      createElement(ClinicalProtocolPanel, {
        document: { ...original, sourceDocument: original },
        context: { cycle: 1 },
        onContextChange: () => {},
        resolution: {
          rows: [],
          issues: [],
          cycleLength: 21,
          prescriptionBlocked: false,
        },
        packageData: {
          version: "user-protocol-template-1.0",
          metadata: { sourceVersion: "2.18" },
          sourceEnvelope: { version: "2.18" },
        },
      } as ClinicalProtocolPanelProps)
    );
    expect(html).toContain("Versão: 2.18");
    expect(html).not.toContain("Versão: user-protocol-template-1.0");
  });

  // Detecta usar eGFR indexado como GFR absoluto ou não permitir fornecer GFR para AUC.
  it.each([undefined, 82])(
    "AUC oferece campo de GFR absoluto sem presumir eGFR indexado (valor %s)",
    gfrForCalvert => {
      const html = render(
        { ...document, drugs: [{ ...row.source, dose: 5, doseUnit: "AUC" }] },
        { cycle: 1, egfr: 95, gfrForCalvert }
      );
      expect(html).toContain("GFR absoluto para Calvert (mL/min)");
      const field = html.match(
        /<input\b[^>]*title="GFR absoluto explicitamente selecionado para Calvert; não usar eGFR indexado"[^>]*>/
      )?.[0];
      expect(field).toBeDefined();
      expect(field).toContain(`value="${gfrForCalvert ?? ""}"`);
      expect(field).not.toContain('value="95"');
      expect(html).toContain("não preencher a partir do eGFR indexado");
    }
  );

  it("pendências de nível ou idade orientam revisão do JSON completo sem bloqueio geral de rascunho", () => {
    const html = render(document, { cycle: 2 }, ["Seleção de nível pendente"]);
    expect(html).toContain("Seleção de nível pendente");
    expect(html).toContain("Revisar o JSON completo");
    expect(html).not.toContain("Rascunho bloqueado");
  });
});
