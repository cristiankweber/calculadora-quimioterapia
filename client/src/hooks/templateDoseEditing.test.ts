import React from "react";
import { act, create } from "react-test-renderer";
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resolveClinicalProtocol } from "@shared/clinicalProtocols/resolver";
import type { ClinicalProtocolDocument } from "@shared/clinicalProtocols/types";
import {
  useTemplateDoseAdjustments,
  buildTemplateSupportDrugs,
} from "./useTemplateDoseAdjustments";

beforeAll(() => {
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
      name: "Ciclofosfamida fictícia",
      dose: 60,
      doseUnit: "mg/kg",
      route: "IV",
      days: "D1",
      schedule: [
        {
          days: [1],
          dose: 60,
          doseUnit: "mg/kg",
          administrationsPerDay: 2,
          doseRepresents: "per_24_hours",
        },
      ],
      administrationFrequency: {
        administrationsPerDay: 2,
        doseRepresents: "per_24_hours",
      },
      maxDose: 5000,
      maxDoseUnit: "mg",
    },
  ],
  templateUsage: {
    kind: "user_managed",
    status: "active",
    prescriptionEnabled: true,
  },
};
const resolution = resolveClinicalProtocol(document, {
  cycle: 1,
  bsa: 1.8,
  weight: 70,
});
let root: ReturnType<typeof create> | undefined;
let current: ReturnType<typeof useTemplateDoseAdjustments>;
const renders: Array<ReturnType<typeof useTemplateDoseAdjustments>> = [];
function Probe({
  scopeKey,
  enabled = true,
}: {
  scopeKey: string;
  enabled?: boolean;
}) {
  current = useTemplateDoseAdjustments({ scopeKey, resolution, enabled });
  renders.push(current);
  return null;
}
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  renders.length = 0;
});

describe("Ajuste individual vinculado ao contexto", () => {
  it("aplica final por rowKey, preserva baseline e restaura explicitamente", () => {
    act(() => {
      root = create(React.createElement(Probe, { scopeKey: "A" }));
    });
    const key = current!.drugs[0].rowKey!;
    act(() => {
      expect(
        current!.confirm({ rowKey: key, finalDose: 1050, reason: "Toxicidade" })
      ).toEqual([]);
    });
    expect(current!.drugs[0]).toMatchObject({
      calculatedDose: 2100,
      finalDose: 1050,
      dailyDose: 4200,
      prescribedDailyDose: 2100,
      adjustmentReason: "Toxicidade",
      isManualDose: true,
    });
    act(() => current!.restore(key));
    expect(current!.drugs[0]).toMatchObject({
      calculatedDose: 2100,
      finalDose: 2100,
      prescribedDailyDose: 4200,
    });
    expect(current!.overrides).toEqual([]);
  });
  it("nenhum render do novo contexto contém ajuste antigo, nem após voltar A→B→A", () => {
    act(() => {
      root = create(React.createElement(Probe, { scopeKey: "A" }));
    });
    act(() =>
      current!.confirm({
        rowKey: current!.drugs[0].rowKey!,
        finalDose: 1000,
        reason: "x",
      })
    );
    const staleConfirm = current!.confirm;
    renders.length = 0;
    act(() => root!.update(React.createElement(Probe, { scopeKey: "B" })));
    expect(renders.length).toBeGreaterThan(0);
    expect(
      renders.every(
        value =>
          value.overrides.length === 0 && value.drugs[0]?.finalDose === 2100
      )
    ).toBe(true);
    act(() =>
      expect(
        staleConfirm({
          rowKey: current!.drugs[0].rowKey!,
          finalDose: 1000,
          reason: "x",
        }).length
      ).toBeGreaterThan(0)
    );
    act(() => root!.update(React.createElement(Probe, { scopeKey: "A" })));
    expect(current!.overrides).toEqual([]);
    expect(current!.drugs[0].finalDose).toBe(2100);
  });
  it("bloqueia zero, NaN, motivo vazio, linha inexistente e teto absoluto sem alterar a dose", () => {
    act(() => {
      root = create(React.createElement(Probe, { scopeKey: "A" }));
    });
    const key = current!.drugs[0].rowKey!;
    for (const override of [
      { rowKey: key, finalDose: 0, reason: "x" },
      { rowKey: key, finalDose: NaN, reason: "x" },
      { rowKey: key, finalDose: 1000, reason: " " },
      { rowKey: "ausente", finalDose: 1000, reason: "x" },
      { rowKey: key, finalDose: 5001, reason: "x" },
    ]) {
      act(() => expect(current!.confirm(override).length).toBeGreaterThan(0));
      expect(current!.drugs[0].finalDose).toBe(2100);
      expect(current!.overrides).toEqual([]);
    }
  });
  it("desabilitar seleção limpa ajuste e impede confirmar callbacks anteriores", () => {
    act(() => {
      root = create(React.createElement(Probe, { scopeKey: "A" }));
    });
    const key = current!.drugs[0].rowKey!;
    act(() => current!.confirm({ rowKey: key, finalDose: 1000, reason: "x" }));
    const staleConfirm = current!.confirm;
    act(() =>
      root!.update(
        React.createElement(Probe, { scopeKey: "A", enabled: false })
      )
    );
    expect(current!.overrides).toEqual([]);
    act(() =>
      expect(
        staleConfirm({ rowKey: key, finalDose: 1000, reason: "x" }).length
      ).toBeGreaterThan(0)
    );
    act(() => root!.update(React.createElement(Probe, { scopeKey: "A" })));
    expect(current!.drugs[0].finalDose).toBe(2100);
  });
  it("suporte recebe base normalizada proporcional ao final sem repetir frequência do total de 24h", () => {
    const output = buildTemplateSupportDrugs(resolution, [
      {
        name: "Ciclofosfamida fictícia",
        dose: 60,
        doseUnit: "mg/kg",
        calculatedDose: 2100,
        finalDose: 1050,
        rowKey: (resolution.rows[0] as any).rowKey,
        route: "IV",
        days: "D1",
      },
    ]);
    expect(output).toEqual([
      {
        name: "Ciclofosfamida fictícia",
        dose: 30,
        doseUnit: "mg/kg",
        administrationsPerDay: 1,
      },
    ]);
  });
});
