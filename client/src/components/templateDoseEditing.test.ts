import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import {
  afterEach,
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import ClinicalProtocolPanel from "./ClinicalProtocolPanel";
import { resolveClinicalProtocol } from "@shared/clinicalProtocols/resolver";
import type { ClinicalProtocolDocument } from "@shared/clinicalProtocols/types";

beforeAll(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterAll(() => vi.unstubAllGlobals());
const document: ClinicalProtocolDocument = {
  id: "template-ficticio",
  name: "Teste",
  indication: "Teste",
  cycles: 2,
  cycleLength: 21,
  drugs: [
    {
      id: "one",
      name: "Nome repetido",
      dose: 0.000004,
      doseUnit: "mcg",
      route: "IV",
      days: "D1",
      schedule: [
        {
          days: [1],
          dose: 0.000004,
          doseUnit: "mcg",
          administrationsPerDay: 2,
        },
      ],
      administrationFrequency: {
        administrationsPerDay: 2,
        doseRepresents: "per_administration",
      },
    },
    {
      id: "two",
      name: "Nome repetido",
      dose: 10,
      doseUnit: "mg",
      route: "IV",
      days: "D1",
      schedule: [
        { days: [1], dose: 10, doseUnit: "mg", administrationsPerDay: 1 },
      ],
      administrationFrequency: {
        administrationsPerDay: 1,
        doseRepresents: "per_administration",
      },
    },
  ],
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
};
const context = { cycle: 1, bsa: 1.8, weight: 70 };
function props(doc = document, issues: string[] = []) {
  const resolution = resolveClinicalProtocol(doc, context);
  resolution.issues.push(...issues);
  return {
    document: doc,
    resolution,
    context,
    onContextChange: () => {},
    doseEditing: {
      scopeKey: "fixture-scope",
      drugs: [],
      onConfirm: (_override: any) => [] as string[],
      onRestore: (_key: string) => {},
    },
  };
}
let root: ReturnType<typeof create> | undefined;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
});

describe("Editor individual do template ativo", () => {
  it("oferece Ajustar dose por linha e separa calculada/prescrita", () => {
    const html = renderToStaticMarkup(
      React.createElement(ClinicalProtocolPanel, props() as any)
    );
    expect(html).toContain("Ajustar dose");
    expect(html).toContain("Dose calculada");
    expect(html).toContain("Dose prescrita");
  });
  it.each(["pending", "draft", "reference", "incomplete"])(
    "não habilita ajuste em %s",
    state => {
      const doc = structuredClone(document);
      const issues = state === "incomplete" ? ["Decisão clínica pendente"] : [];
      if (state === "pending" || state === "draft")
        (doc.templateUsage as any).status = state;
      if (state === "reference") doc.referenceOnly = true;
      const html = renderToStaticMarkup(
        React.createElement(ClinicalProtocolPanel, props(doc, issues) as any)
      );
      expect(html).not.toContain(">Ajustar dose<");
    }
  );
  it("confirma percentual sobre baseline exata, exige motivo e envia rowKey sem confundir nomes", () => {
    const supplied = props();
    let confirmed: any;
    supplied.doseEditing.onConfirm = override => {
      confirmed = override;
      return [];
    };
    act(() => {
      root = create(
        React.createElement(ClinicalProtocolPanel, supplied as any)
      );
    });
    const buttons = () => root!.root.findAllByType("button");
    const label = (node: any) =>
      node.children.filter((c: any) => typeof c === "string").join("");
    const adjust = buttons().filter(b => label(b) === "Ajustar dose");
    expect(adjust).toHaveLength(2);
    act(() => adjust[0].props.onClick());
    const fields = () => root!.root.findAllByType("input");
    const reason = () => root!.root.findByType("textarea");
    const mode = root!.root.findByType("select");
    act(() => mode.props.onChange({ currentTarget: { value: "percentage" } }));
    act(() =>
      fields()
        .find(f => f.props["aria-label"] === "Percentual da dose calculada")!
        .props.onChange({ currentTarget: { value: "75" } })
    );
    expect(
      buttons().find(b => label(b) === "Confirmar ajuste")!.props.disabled
    ).toBe(true);
    act(() => reason().props.onChange({ currentTarget: { value: "x" } }));
    act(() =>
      buttons()
        .find(b => label(b) === "Confirmar ajuste")!
        .props.onClick()
    );
    expect(confirmed).toEqual({
      rowKey: (supplied.resolution.rows[0] as any).rowKey,
      finalDose: 0.000003,
      reason: "x",
    });
    expect(confirmed.rowKey).not.toBe(
      (supplied.resolution.rows[1] as any).rowKey
    );
  });
});
