import { describe, expect, it } from "vitest";
import clinicalPackage from "../data/clinicalProtocols.json";

// Importação dinâmica permite uma falha de contrato explícita antes de o módulo existir.
const module = await import("./antiemetics").catch(() => ({
  projectTemplateAntiemetics: undefined,
}));
function project(
  document: unknown,
  risk?: "high" | "moderate" | "low" | "minimal"
) {
  expect(
    typeof module.projectTemplateAntiemetics,
    "projetor puro deve existir"
  ).toBe("function");
  return module.projectTemplateAntiemetics!(document, risk);
}

const complete = {
  day1: [" TEXTO_D1 "],
  days2to4: ["TEXTO_D2D4"],
  rescue: ["TEXTO_RESGATE"],
  alerts: ["TEXTO_ALERTA"],
  timeReference: " TEXTO_REFERENCIA_DIAS ",
};

describe("projectTemplateAntiemetics — somente ordens explícitas atuais", () => {
  it("preserva textos fornecidos, risco canônico e origem temporal sem mudar o documento", () => {
    const document = {
      emetogenicRisk: "high",
      antiemetics: complete,
      review: { status: "approved" },
    };
    const before = JSON.stringify(document);
    expect(project(document, "low")).toEqual({
      risk: "high",
      day1: ["TEXTO_D1"],
      days2to4: ["TEXTO_D2D4"],
      rescue: ["TEXTO_RESGATE"],
      alerts: ["TEXTO_ALERTA"],
      timeReference: "TEXTO_REFERENCIA_DIAS",
    });
    expect(JSON.stringify(document)).toBe(before);
  });

  it.each(["high", "moderate", "low", "minimal"] as const)(
    "risco %s nunca gera medicamento padrão",
    risk => {
      const result = project({}, risk);
      expect(result.risk).toBe(risk);
      expect(result.day1).toEqual([]);
      expect(result.days2to4).toEqual([]);
      expect(result.rescue).toEqual([]);
      expect(result.alerts).toHaveLength(3);
      expect(result.alerts.join(" ")).toMatch(/Dia 1/);
      expect(result.alerts.join(" ")).toMatch(/Dias 2-4/);
      expect(result.alerts.join(" ")).toMatch(/Resgate/);
      expect(result.alerts.join(" ")).toMatch(
        /Não informado — conferir\/cadastrar/
      );
    }
  );

  it.each([undefined, null, [], "inválido", 5, true])(
    "documento desconhecido %j é seguro e não consulta arquivos",
    document => {
      const result = project(document, "high");
      expect(result.day1).toEqual([]);
      expect(result.days2to4).toEqual([]);
      expect(result.rescue).toEqual([]);
      expect(result.alerts).toHaveLength(3);
    }
  );

  it.each([
    undefined,
    null,
    "TEXTO_NAO_ARRAY",
    {},
    ["", "   "],
    [null, 7, false],
  ])(
    "seções ausentes/inválidas %j geram avisos individuais, não ordens",
    value => {
      const result = project({
        antiemetics: {
          day1: value,
          days2to4: value,
          rescue: value,
          alerts: value,
        },
      });
      expect(result.day1).toEqual([]);
      expect(result.days2to4).toEqual([]);
      expect(result.rescue).toEqual([]);
      expect(result.alerts).toHaveLength(3);
    }
  );

  it.each(["day1", "days2to4", "rescue"] as const)(
    "exige referência temporal explícita quando %s está preenchido",
    key => {
      const result = project({
        antiemetics: { [key]: ["TEXTO_ORDEM"], alerts: ["TEXTO_ALERTA"] },
      });
      expect(result[key]).toEqual(["TEXTO_ORDEM"]);
      expect(result.timeReference).toBeUndefined();
      expect(result.alerts.join(" ")).toMatch(
        /Referência temporal não informada/
      );
      expect(result.alerts).toContain("TEXTO_ALERTA");
    }
  );

  it("raiz canônica explícita vence extensions; nunca escolhe a fonte arquivada", () => {
    const result = project({
      antiemetics: complete,
      extensions: { antiemetics: { ...complete, day1: ["TEXTO_EXT_ANTIGO"] } },
      sourceDocument: { antiemetics: { ...complete, day1: ["TEXTO_ARQUIVO"] } },
    });
    expect(result.day1).toEqual(["TEXTO_D1"]);
    expect(JSON.stringify(result)).not.toContain("TEXTO_EXT_ANTIGO");
    expect(JSON.stringify(result)).not.toContain("TEXTO_ARQUIVO");
  });

  it("raiz null explícita não revive ordens de extensions ou sourceDocument", () => {
    const result = project({
      antiemetics: null,
      extensions: { antiemetics: complete },
      sourceDocument: { antiemetics: complete },
    });
    expect(result.day1).toEqual([]);
    expect(result.alerts).toHaveLength(3);
  });

  it("suporta extensions atual somente quando não existe raiz canônica", () => {
    expect(project({ extensions: { antiemetics: complete } }).day1).toEqual([
      "TEXTO_D1",
    ]);
  });

  it("BuEM real sem cadastro antiemético mantém todas as ordens vazias e avisos visíveis", () => {
    const buem = clinicalPackage.protocols.find(
      document => document.name === "BuEM"
    )!;
    const before = JSON.stringify(buem);
    const result = project(buem, "high");
    expect(result.risk).toBe("high");
    expect(result.day1).toEqual([]);
    expect(result.days2to4).toEqual([]);
    expect(result.rescue).toEqual([]);
    expect(result.alerts).toHaveLength(3);
    expect(JSON.stringify(buem)).toBe(before);
  });
});
