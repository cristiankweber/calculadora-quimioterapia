import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ClinicalProtocolPanel, {
  type ClinicalProtocolPanelProps,
} from "./ClinicalProtocolPanel";

const doc = {
  id: "TEST",
  name: "Protocolo de teste",
  indication: "Dados fictícios",
  cycles: 999,
  cycleDefinition: {
    kind: "continuous_until_progression",
    plannedCycles: null,
  },
  calculationPolicy: { automaticPrescriptionAllowed: false },
  review: {
    status: "draft_not_institutionally_approved",
    unresolvedItems: ["Revisar apresentação comercial"],
  },
  sources: ["REF-1"],
  baselineTests: ["Hemograma basal"],
  monitoring: ["Monitorar função renal"],
  essentialSupportOrders: ["Suporte individual, sem ordem automática"],
  drugs: [],
};
const row = {
  source: {
    id: "D1",
    name: "Citarabina",
    dose: 9999,
    doseUnit: "mg/m²",
    route: "IV",
    administrationFrequency: { intervalHours: 12 },
  },
  dose: 2000,
  calculatedDose: 3600,
  resultUnit: "mg",
  frequency: 2,
  dailyDose: 7200,
  days: "D1 e D2",
  issues: [],
  status: "ready",
  timeOrigin: "cycle_day_one",
};
const resolution = {
  rows: [row],
  issues: [],
  cycleLength: 21,
  prescriptionBlocked: true,
};
function render(
  document = doc,
  result: unknown = resolution,
  context: unknown = { cycle: 1 },
  packageData: Record<string, unknown> = {}
) {
  return renderToStaticMarkup(
    createElement(ClinicalProtocolPanel, {
      document,
      resolution: result,
      context,
      packageData,
      onContextChange: () => {},
    } as ClinicalProtocolPanelProps)
  );
}
function section(html: string, name: string) {
  const match = html.match(
    new RegExp(`<section[^>]*aria-label="${name}"[^>]*>([\\s\\S]*?)</section>`)
  );
  expect(match, `Seção visível ${name}`).not.toBeNull();
  return match![1];
}
function input(html: string, title: string) {
  const result = html
    .match(/<input\b[^>]*>/g)
    ?.find(tag => tag.includes(`title="${title}"`));
  expect(result, `Campo acessível ${title}`).toBeDefined();
  return result!;
}

describe("ClinicalProtocolPanel — consulta e simulação, nunca prescrição", () => {
  // Catches removal of the permanent safety boundary, even if upstream flags accidentally allow Rx.
  it("mantém rascunho bloqueado mesmo quando as flags recebidas permitem prescrição", () => {
    const html = render(
      { ...doc, calculationPolicy: { automaticPrescriptionAllowed: true } },
      { ...resolution, prescriptionBlocked: false }
    );
    expect(html).toContain("Rascunho bloqueado");
    expect(html).toContain("Simulação para revisão");
    expect(html).not.toMatch(/type="checkbox"/);
    expect(html).not.toMatch(
      /<(button|a)[^>]*>[^<]*(Salvar|Prescrever|Imprimir|Copiar prescrição|PDF)/i
    );
  });

  // Catches substituting source.dose/0 for unresolved rows, or mixing them into ready doses.
  it("separa bloqueadas e não programadas sem exibir zero ou dose padrão", () => {
    const html = render(doc, {
      ...resolution,
      rows: [
        row,
        {
          ...row,
          source: { ...row.source, name: "Bloqueada" },
          status: "blocked",
          dose: null,
          calculatedDose: null,
          dailyDose: null,
          issues: ["Decisão pendente"],
        },
        {
          ...row,
          source: { ...row.source, name: "Fora do dia" },
          status: "not_scheduled",
          dose: 0,
          calculatedDose: 0,
          dailyDose: 0,
        },
      ],
    });
    const blocked = section(html, "Doses bloqueadas");
    const unscheduled = section(html, "Não programadas");
    expect(blocked).toContain("Não calculada");
    expect(blocked).toContain("Decisão pendente");
    expect(blocked).not.toMatch(/9999|>0 mg</);
    expect(unscheduled).toContain("Não programada");
    expect(unscheduled).not.toMatch(/9999|>0 mg</);
    expect(section(html, "Doses disponíveis para simulação")).not.toContain(
      "Bloqueada"
    );
  });

  // Catches a second daily multiplication and loss of drug-specific units.
  it.each(["mg", "mcg", "UI", "cGy"])(
    "mostra aplicação e total de 24h já resolvidos em %s",
    unit => {
      const html = render(doc, {
        ...resolution,
        rows: [
          { ...row, calculatedDose: 100, dailyDose: 200, resultUnit: unit },
        ],
      });
      const ready = section(html, "Doses disponíveis para simulação");
      expect(ready).toContain(`100 ${unit}`);
      expect(ready).toContain(`200 ${unit}/24h`);
      expect(ready).toContain("2 administrações/24h");
      expect(ready).toContain("12 h");
      expect(ready).toContain("D1 e D2");
      expect(ready).toContain("mg/m²");
      expect(ready).not.toContain(`400 ${unit}/24h`);
    }
  );

  it("identifica infusão contínua como total de 24h e nunca converte em taxa horária", () => {
    const html = render(doc, {
      ...resolution,
      rows: [
        {
          ...row,
          source: {
            ...row.source,
            administrationFrequency: {
              continuousInfusion: true,
              doseRepresents: "per_24_hours",
            },
            administrationDurationMinutes: 1440,
          },
          calculatedDose: 180,
          dailyDose: 180,
          frequency: 1,
        },
      ],
    });
    const ready = section(html, "Doses disponíveis para simulação");
    expect(ready).toContain("Infusão contínua");
    expect(ready).toContain("Total de 24h");
    expect(ready).toContain("1440 min");
    expect(ready).not.toContain("mg/h");
  });

  it("explicita total de 24h dividido sem repetir o total como dose por aplicação", () => {
    const html = render(doc, {
      ...resolution,
      rows: [
        {
          ...row,
          source: {
            ...row.source,
            administrationFrequency: { doseRepresents: "per_24_hours" },
          },
          dose: 40,
          calculatedDose: 20,
          dailyDose: 40,
        },
      ],
    });
    const ready = section(html, "Doses disponíveis para simulação");
    expect(ready).toContain("20 mg");
    expect(ready).toContain("40 mg/24h");
    expect(ready).toContain("Total de 24h dividido");
  });

  it("distingue total de uma infusão de total diário sem gerar taxa horária", () => {
    const html = render(doc, {
      ...resolution,
      rows: [
        {
          ...row,
          source: {
            ...row.source,
            administrationFrequency: {
              continuousInfusion: true,
              doseRepresents: "total_for_this_infusion",
            },
          },
          calculatedDose: 100,
          dailyDose: null,
        },
      ],
    });
    const ready = section(html, "Doses disponíveis para simulação");
    expect(ready).toContain("Total desta infusão");
    expect(ready).not.toContain("Total de 24h / infusão");
    expect(ready).not.toContain("mg/h");
  });

  it("desabilita filtro de dia quando origens de tratamento e fase estão misturadas", () => {
    const html = render(doc, {
      ...resolution,
      rows: [row, { ...row, timeOrigin: "treatment_start" }],
    });
    expect(
      input(
        html,
        "Dia para consulta do calendário; vazio mostra o período completo"
      )
    ).toContain("disabled");
    expect(html).toContain("Origens distintas ou não reconhecidas");
  });

  it("mostra somente suporte da fase explicitamente selecionada", () => {
    const document = {
      ...doc,
      phaseLibrary: [
        { id: "A", name: "Fase A", support: [{ name: "Suporte A" }] },
        { id: "B", name: "Fase B", support: [{ name: "Suporte B" }] },
      ],
    };
    const html = render(document as typeof doc, resolution, {
      cycle: 1,
      phaseId: "B",
    });
    const support = section(html, "Suporte fornecido da fase selecionada");
    expect(support).toContain("Suporte B");
    expect(support).not.toContain("Suporte A");
  });

  // Catches generating a 999-cycle select and inventing a default phase.
  it("usa ciclo numérico sem limite legado 999 e exige escolha explícita de fase", () => {
    const html = render({
      ...doc,
      phaseLibrary: [
        { id: "IND", name: "Indução" },
        { id: "CON", name: "Consolidação" },
      ],
    } as typeof doc);
    const cycle = input(html, "Número do ciclo para simulação");
    expect(cycle).toContain('type="number"');
    expect(cycle).toContain('min="1"');
    expect(cycle).not.toContain('max="999"');
    expect(html).toContain("Selecione uma fase");
    expect(html).toContain("Fase obrigatória");
    expect(html).toContain('aria-required="true"');
    expect(html).toMatch(/<label[^>]*for="[^"]+-phase"/);
    expect(html).not.toContain('data-state="checked"');
    expect(html).not.toContain("Doses disponíveis para simulação");
  });

  // Catches labeling all days as cycle day or clamping negative pre-transplant days.
  it.each([
    ["cycle_day_one", "Dia do ciclo (opcional)"],
    ["treatment_day_one", "Dia do tratamento (opcional)"],
    ["phase_day_one", "Dia da fase (opcional)"],
    ["transplant_day_zero", "Dia relativo ao D0 (opcional)"],
    ["induction_day_one", "Dia relativo à indução (opcional)"],
  ])(
    "rotula origem temporal %s sem bloquear valores negativos",
    (timeOrigin, label) => {
      const html = render(
        doc,
        { ...resolution, rows: [{ ...row, timeOrigin }] },
        { cycle: 1, day: -6 }
      );
      expect(html).toContain(label);
      const day = input(
        html,
        "Dia para consulta do calendário; vazio mostra o período completo"
      );
      expect(day).toContain('value="-6"');
      expect(day).not.toMatch(/min=|required=/);
      expect(html).toContain(timeOrigin);
    }
  );

  // Catches failing to resolve package references or turning arbitrary URLs into executable links.
  it("resolve fontes no pacote e não cria links javascript", () => {
    const html = render(
      doc,
      resolution,
      { cycle: 1 },
      {
        version: "2.1-ficticia",
        references: [
          {
            id: "REF-1",
            title: "Fonte de teste",
            url: "https://example.org/protocol",
            scope: "Somente referência",
          },
        ],
      }
    );
    expect(section(html, "Fontes")).toContain(
      'href="https://example.org/protocol"'
    );
    expect(section(html, "Fontes")).toContain("Fonte de teste");
    expect(html).toContain("2.1-ficticia");
    const unsafe = render(
      doc,
      resolution,
      { cycle: 1 },
      {
        references: [
          {
            id: "REF-1",
            title: "<script>alert(1)</script>",
            url: "javascript:alert(1)",
          },
        ],
      }
    );
    expect(unsafe).not.toContain('href="javascript:');
    expect(unsafe).not.toContain("<script>");
    expect(unsafe).toContain("&lt;script&gt;");
  });

  it("mostra revisão, suporte, variante e dados farmacêuticos sem inventar estabilidade", () => {
    const document = {
      ...doc,
      selectedVariant: {
        sourceId: "REF-1",
        sourcePages: [2],
        requiresInstitutionalApproval: true,
      },
      dilutionInfo: [
        {
          drugName: "Citarabina",
          validationStatus: "product_specific_release_required",
          volume: { min: 50, max: 100 },
          stability: "Produto ainda não validado",
        },
      ],
      rescueProtocol: { clinicalDecision: "Revisão individual" },
    };
    const html = render(document);
    expect(html).toContain("Revisar apresentação comercial");
    expect(html).toContain("Hemograma basal");
    expect(html).toContain("Monitorar função renal");
    expect(html).toContain("Suporte individual, sem ordem automática");
    expect(section(html, "Variante selecionada")).toContain("REF-1");
    expect(section(html, "Informações farmacêuticas fornecidas")).toContain(
      "product_specific_release_required"
    );
    expect(html).toContain("Produto ainda não validado");
    expect(html).toContain("Decisões de fase, dose e suporte");
    expect(html).toContain("Revisão individual");
    expect(html).not.toContain("[object Object]");
    expect(html).not.toContain("48 horas");
  });

  it("explicita ausência de dados farmacêuticos e mantém documentos apenas referenciais consultáveis", () => {
    const html = render({ ...doc, referenceOnly: true } as typeof doc, {
      ...resolution,
      rows: [],
    });
    expect(html).toContain("Somente consulta");
    expect(html).toContain("Nenhuma dose resolvida");
    expect(html).toContain("Dados farmacêuticos não fornecidos");
    expect(html).not.toContain("48 horas");
    expect(html).toContain("Documento completo");
  });

  it("não transforma um resultado ready sem dose em zero", () => {
    const html = render(doc, {
      ...resolution,
      rows: [{ ...row, calculatedDose: null, dailyDose: null }],
    });
    expect(section(html, "Doses disponíveis para simulação")).toContain(
      "Não calculada"
    );
    expect(section(html, "Doses disponíveis para simulação")).not.toMatch(
      />0 mg(?:\/24h)?</
    );
  });

  it("preserva os documentos e os resultados recebidos durante a renderização", () => {
    const before = JSON.stringify({ doc, resolution });
    render();
    expect(JSON.stringify({ doc, resolution })).toBe(before);
  });
});
