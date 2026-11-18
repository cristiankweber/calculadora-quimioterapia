import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ClinicalProtocolPanel from "./ClinicalProtocolPanel";
import type { ClinicalProtocolDocument } from "@shared/clinicalProtocols/types";

const base: ClinicalProtocolDocument = {
  id: "CONTENT-FICTION",
  name: "Template fictício",
  indication: "Software only",
  cycles: 1,
  cycleLength: 21,
  drugs: [],
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
  emetogenicRisk: "high",
  sourceDocument: {
    dilutionInfo: [{ drugName: "Agente fictício", diluent: "ARQUIVO ANTIGO" }],
  },
  dilutionInfo: [{ drugName: "Agente fictício", diluent: "DILUENTE REVISADO" }],
  prophylaxis: ["PROFILAXIA CADASTRADA"],
  nursingCare: ["ENFERMAGEM CADASTRADA"],
};
function render(document: ClinicalProtocolDocument) {
  return renderToStaticMarkup(
    React.createElement(ClinicalProtocolPanel, {
      document,
      context: { cycle: 1 },
      onContextChange: () => {},
      resolution: {
        rows: [],
        issues: [],
        cycleLength: 21,
        prescriptionBlocked: true,
      },
    })
  );
}
function visibleSection(html: string, name: string) {
  const section = html.match(
    new RegExp(`<section[^>]*aria-label="${name}"[^>]*>([\\s\\S]*?)</section>`)
  );
  expect(section, `Seção visível ${name}`).not.toBeNull();
  return section![1];
}
describe("Painel mostra conteúdo clínico da versão atual, não da fonte arquivada", () => {
  it("farmacotécnica revisada prevalece sem apagar o original", () => {
    const before = structuredClone(base);
    const section = visibleSection(
      render(base),
      "Informações farmacêuticas fornecidas"
    );
    expect(section).toContain("DILUENTE REVISADO");
    expect(section).not.toContain("ARQUIVO ANTIGO");
    expect(base).toEqual(before);
  });
  it("lista explicitamente vazia não ressuscita a farmacotécnica arquivada", () => {
    const section = visibleSection(
      render({ ...base, dilutionInfo: [] }),
      "Informações farmacêuticas fornecidas"
    );
    expect(section).not.toContain("ARQUIVO ANTIGO");
    expect(section).toContain("Dados farmacêuticos não fornecidos");
  });
  it("profilaxias e enfermagem cadastradas ficam em seções visíveis", () => {
    const html = render(base);
    expect(
      visibleSection(html, "Profilaxias Obrigatórias/Recomendadas")
    ).toContain("PROFILAXIA CADASTRADA");
    expect(visibleSection(html, "Cuidados de Enfermagem")).toContain(
      "ENFERMAGEM CADASTRADA"
    );
  });
  it("antiemese cadastrada e referência temporal chegam ao painel sem esquema genérico", () => {
    const section = visibleSection(
      render({
        ...base,
        antiemetics: {
          day1: ["PRÉ-QT CADASTRADO"],
          days2to4: ["SEGUIMENTO CADASTRADO"],
          rescue: ["RESGATE CADASTRADO"],
          alerts: ["NOTA CADASTRADA"],
          timeReference:
            "Dias relativos à administração selecionada, não ao D0",
        },
      }),
      "Antieméticos cadastrados"
    );
    for (const text of [
      "PRÉ-QT CADASTRADO",
      "SEGUIMENTO CADASTRADO",
      "RESGATE CADASTRADO",
      "NOTA CADASTRADA",
      "não ao D0",
    ])
      expect(section).toContain(text);
    expect(section).not.toMatch(/ondansetrona|dexametasona|aprepitanto/i);
  });
  it("antiemese ausente é não informada, não uma decisão de não indicar", () => {
    const section = visibleSection(render(base), "Antieméticos cadastrados");
    expect(section).toMatch(/não informad[oa]/i);
    expect(section).not.toMatch(/>Nenhum</);
    expect(section).not.toMatch(/ondansetrona|dexametasona|aprepitanto/i);
  });
});
