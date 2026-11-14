import { describe, expect, it } from "vitest";
import clinicalData from "../data/clinicalProtocols.json";
import type {
  ClinicalContext,
  ClinicalDrug,
  ClinicalProtocolDocument,
} from "./types";
import * as api from "./resolver";

const resolve = (
  document: ClinicalProtocolDocument,
  context: ClinicalContext
) => api.resolveClinicalProtocol(document, context);
const protocols = clinicalData.protocols as ClinicalProtocolDocument[];
const real = (id: string) => protocols.find(p => p.id === id)!;
const drug = (extra: Partial<ClinicalDrug> = {}): ClinicalDrug => ({
  id: "d",
  name: "Fármaco",
  dose: 10,
  doseUnit: "mg",
  route: "IV",
  days: "1",
  administrationFrequency: {
    administrationsPerDay: 1,
    continuousInfusion: false,
    doseRepresents: "per_administration",
  },
  schedule: [{ dose: 10, days: [1] }],
  ...extra,
});
const doc = (
  drugs: ClinicalDrug[] = [drug()],
  extra: Partial<ClinicalProtocolDocument> = {}
): ClinicalProtocolDocument => ({
  id: "fixture",
  name: "Fixture explícita",
  indication: "Teste de contrato, não protocolo clínico",
  cycles: 6,
  cycleLength: 28,
  drugs,
  calculationPolicy: { automaticPrescriptionAllowed: false },
  review: { status: "draft_not_institutionally_approved" },
  ...extra,
});
const active = (
  p: ClinicalProtocolDocument,
  context: ClinicalContext,
  id = p.drugs[0]?.id
) =>
  resolve(p, context)?.rows.filter(
    r => r.source.id === id && r.status !== "not_scheduled"
  ) ?? [];

it("exporta as três operações contratadas, sem implementação de fallback", () => {
  expect(api.resolveClinicalProtocol).toBeTypeOf("function");
  expect(api.getClinicalPrescriptionBlock).toBeTypeOf("function");
  expect(api.formatClinicalFrequency).toBeTypeOf("function");
});

describe("calendário explícito sem fallback de dose", () => {
  it("BuEM real: 1,6 mg/kg por administração 12/12h D-6 a D-4", () => {
    const p = real("HEM-002");
    for (const day of [-6, -5, -4]) {
      const rows = active(
        p,
        { cycle: 1, day, weight: 70, bsa: 2 },
        "HEM-002-D01"
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        dose: 1.6,
        calculatedDose: 112,
        dailyDose: 224,
        frequency: 2,
        resultUnit: "mg",
        status: "ready",
        timeOrigin: "transplant_day_zero",
      });
      expect(api.formatClinicalFrequency(rows[0])).toContain("12/12h");
    }
    expect(active(p, { cycle: 1, day: -3, weight: 70 }, "HEM-002-D01")).toEqual(
      []
    );
    expect(active(p, { cycle: 1, day: 0, weight: 70 }, "HEM-002-D01")).toEqual(
      []
    );
    expect(active(p, { cycle: 2, day: -6, weight: 70 }, "HEM-002-D01")).toEqual(
      []
    );
  });

  it("R-DHAP real: Ara-C 2000 mg/m² x2 não é dose diária dividida", () => {
    const p = protocols.find(p => p.name.startsWith("R-DHAP"))!;
    const d = p.drugs.find(d => /Citarabina/i.test(d.name))!;
    const row = active(p, { cycle: 1, day: 2, bsa: 2 }, d.id)[0];
    expect(row).toMatchObject({
      dose: 2000,
      calculatedDose: 4000,
      dailyDose: 8000,
      frequency: 2,
    });
  });

  it.each([
    [1, 1, 0.16],
    [1, 8, 0.8],
    [1, 15, 48],
    [1, 22, 48],
    [4, 1, 48],
    [4, 15, 48],
    [10, 1, 48],
  ])("Epcoritamab real C%d D%d preserva dose %s mg", (cycle, day, dose) => {
    const p = protocols.find(p => /Epcoritamab/i.test(p.name))!;
    expect(active(p, { cycle, day })[0]).toMatchObject({
      dose,
      calculatedDose: dose,
      resultUnit: "mg",
    });
  });

  it("Epcoritamab C4D8 não retorna dose principal e calendário omitido não soma ramp-up", () => {
    const p = protocols.find(p => /Epcoritamab/i.test(p.name))!;
    expect(active(p, { cycle: 4, day: 8 })).toEqual([]);
    const rows = active(p, { cycle: 1 });
    expect(rows.map(r => r.dose)).toEqual([0.16, 0.8, 48]);
    expect(rows.map(r => r.days)).toEqual(["1", "8", "15, 22"]);
  });

  it.each([
    [1, 20],
    [8, 50],
    [15, 100],
    [22, 200],
    [29, 400],
    [45, 400],
  ])(
    "Venetoclax real dia de tratamento %d, sem reset para ciclo administrativo",
    (day, dose) => {
      expect(active(real("HEM-028"), { cycle: 2, day })[0]).toMatchObject({
        dose,
        calculatedDose: dose,
        timeOrigin: "treatment_start",
      });
    }
  );

  it("Isa-VRd real ciclo 5 passa de 42 para 28 dias e exclui bortezomibe", () => {
    const p = real("HEM-039");
    expect(resolve(p, { cycle: 5, day: 15, weight: 70 })?.cycleLength).toBe(28);
    expect(
      active(p, { cycle: 5, day: 15, weight: 70 }, "HEM-039-D01")[0]
        .calculatedDose
    ).toBe(700);
    expect(active(p, { cycle: 5, day: 1, bsa: 2 }, "HEM-039-D02")).toEqual([]);
    expect(active(p, { cycle: 5, day: 29, weight: 70 }, "HEM-039-D01")).toEqual(
      []
    );
  });

  it("interpreta faixas negativas somente dentro de agenda explícita, sem fallback de days principal", () => {
    const p = doc([
      drug({
        dose: 2,
        schedule: [
          { dose: 2, days: "D-2 a D0, D+3", timeOrigin: "transplant_day_zero" },
        ],
        days: "D-2 a D0, D+3",
        timeOrigin: "transplant_day_zero",
      }),
    ]);
    expect(active(p, { cycle: 1, day: 0 })[0]?.calculatedDose).toBe(2);
    expect(active(p, { cycle: 1, day: -1 })[0]?.calculatedDose).toBe(2);
    expect(active(p, { cycle: 1, day: 1 })).toEqual([]);
    expect(
      active(
        doc([drug({ schedule: undefined, days: "Se necessário no dia 1" })]),
        { cycle: 1, day: 1 }
      )[0]?.status
    ).toBe("blocked");
  });

  it("dose e days principais nunca substituem uma agenda estruturada ausente", () => {
    const result = resolve(
      doc([drug({ schedule: undefined, days: "1", dose: 10 })]),
      { cycle: 1, day: 1 }
    );
    expect(result.rows[0]).toMatchObject({
      status: "blocked",
      calculatedDose: null,
    });
  });

  it("sentinela 999 não é limite de um tratamento explicitamente contínuo", () => {
    const result = resolve(
      doc(
        [
          drug({
            schedule: [
              {
                dose: 10,
                dayFrom: 1,
                repeatEveryDays: 1,
                timeOrigin: "treatment_start",
              },
            ],
          }),
        ],
        {
          cycles: 999,
          cycleDefinition: {
            kind: "continuous_treatment",
            plannedCycles: null,
          },
        }
      ),
      { cycle: 1000, day: 28001 }
    );
    expect(result.rows[0]).toMatchObject({
      status: "ready",
      calculatedDose: 10,
      timeOrigin: "treatment_start",
    });
  });

  it.each([
    [5, true],
    [6, false],
    [12, true],
    [19, true],
    [20, false],
  ])("repetição explícita com limites: D%d agendado=%s", (day, scheduled) => {
    const p = doc([
      drug({
        schedule: [{ dose: 2, dayFrom: 5, dayTo: 19, repeatEveryDays: 7 }],
      }),
    ]);
    expect(active(p, { cycle: 1, day }).length > 0).toBe(scheduled);
  });

  it("não usa dose principal quando schedule é vazio ou dose da etapa é null", () => {
    expect(
      active(doc([drug({ schedule: [] })]), { cycle: 1, day: 1 })[0]
    ).toMatchObject({ status: "blocked", calculatedDose: null });
    expect(
      active(doc([drug({ dose: 99, schedule: [{ dose: null, days: [1] }] })]), {
        cycle: 1,
        day: 1,
      })[0]
    ).toMatchObject({ dose: null, status: "blocked", calculatedDose: null });
  });

  it("separa etapas de infusão mesmo no mesmo dia", () => {
    const original = real("HEM-036");
    const p = doc(
      original.drugs.filter(d => /Metotrexato — etapa/.test(d.name))
    );
    const rows = resolve(p, { cycle: 1, day: 10, bsa: 2 })!.rows.filter(r =>
      /Metotrexato — etapa/.test(r.source.name)
    );
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.calculatedDose)).toEqual([600, 5400]);
    expect(
      rows.every(r => /infusão/i.test(api.formatClinicalFrequency(r)))
    ).toBe(true);
    expect(
      resolve(original, { cycle: 1, day: 10, bsa: 2 })!
        .rows.filter(r => /Metotrexato — etapa/.test(r.source.name))
        .every(r => r.status === "blocked")
    ).toBe(true);
  });
});

describe("fases explicitamente selecionadas", () => {
  const a = drug();
  const b = drug({ id: "b", name: "Outra fase" });
  const phased = doc([a], {
    phaseLibrary: [
      {
        id: "a",
        name: "A",
        drugRefs: ["d"],
        scheduleOverrides: [{ drugId: "d", days: [8, 15] }],
        support: [{ name: "Suporte não ativo", dose: 100, doseUnit: "mg" }],
      },
      { id: "b", name: "B", drugs: [b] },
      { id: "empty", name: "Vazia", drugs: [] },
    ],
  });

  it.each([undefined, "inexistente", ""])(
    'fase não selecionada/ inválida "%s" não herda drogas principais',
    phaseId => {
      const result = resolve(phased, { cycle: 1, day: 1, phaseId })!;
      expect(result.rows).toEqual([]);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.prescriptionBlocked).toBe(true);
    }
  );

  it("seleciona drugRefs e substitui dias sem concatenar outra fase ou suporte", () => {
    expect(active(phased, { cycle: 1, day: 1, phaseId: "a" })).toEqual([]);
    const result = resolve(phased, { cycle: 1, day: 8, phaseId: "a" })!;
    expect(
      result.rows.filter(r => r.status === "ready").map(r => r.source.id)
    ).toEqual(["d"]);
    expect(result.rows[0].source).toBe(a);
    expect(result.rows[0].days).toBe("8, 15");
    expect(result.issues.some(i => /suporte/i.test(i))).toBe(true);
    expect(
      active(phased, { cycle: 1, day: 1, phaseId: "b" }, "b")
    ).toHaveLength(1);
  });

  it("fase válida vazia e biblioteca vazia são pendências, nunca fallback", () => {
    expect(resolve(phased, { cycle: 1, phaseId: "empty" })).toMatchObject({
      rows: [],
      prescriptionBlocked: true,
    });
    expect(
      resolve(phased, { cycle: 1, phaseId: "empty" })!.issues.length
    ).toBeGreaterThan(0);
    expect(
      resolve(doc([a], { phaseLibrary: [] }), { cycle: 1, phaseId: "a" })!.rows
    ).toEqual([]);
  });

  it("referência de droga inexistente não permite seleção parcial silenciosa", () => {
    const result = resolve(
      doc([a], {
        phaseLibrary: [{ id: "a", name: "A", drugRefs: ["d", "missing"] }],
      }),
      { cycle: 1, phaseId: "a" }
    )!;
    expect(
      result.rows.every(
        r => r.status === "blocked" && r.calculatedDose === null
      )
    ).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("BFM real não ignora titulação inicial, dose por idade ou seleção de braço", () => {
    const result = resolve(real("HEM-033"), {
      cycle: 1,
      day: 1,
      phaseId: "BFM-IA",
      bsa: 2,
    })!;
    expect(result.rows.find(r => r.source.id === "HEM-033-D01")).toMatchObject({
      status: "blocked",
      calculatedDose: null,
      dailyDose: null,
    });
    expect(result.issues.some(i => /initialTitration/.test(i))).toBe(true);
    expect(result.issues.some(i => /programSelection/.test(i))).toBe(true);
  });

  it("BFM prednisona: fixture de aritmética com dose diária explícita divide em três doses", () => {
    const source = real("HEM-033").drugs.find(d => d.name === "Prednisona")!;
    // No inference about when titration ends: isolated explicit arithmetic fixture only.
    const p = doc([
      drug({
        dose: source.dose,
        doseUnit: source.doseUnit,
        administrationFrequency: source.administrationFrequency,
        schedule: [{ dose: 60, days: [8] }],
      }),
    ]);
    expect(active(p, { cycle: 1, day: 8, bsa: 2 })[0]).toMatchObject({
      dose: 60,
      calculatedDose: 40,
      dailyDose: 120,
      frequency: 3,
      resultUnit: "mg",
    });
  });
});

describe("unidades, precisão e frequência", () => {
  it.each([
    ["mg", 0.16, {}, 0.16, "mg"],
    ["mg/m²", 10, { bsa: 2 }, 20, "mg"],
    ["mg/kg", 1.6, { weight: 70 }, 112, "mg"],
    ["UI/m²", 5000, { bsa: 2 }, 10000, "UI"],
    ["mcg", 150, { bsa: 2 }, 150, "mcg"],
    ["mcg/m²", 150, { bsa: 2 }, 300, "mcg"],
    ["mcg/kg", 5, { weight: 70 }, 350, "mcg"],
    ["cGy", 200, { bsa: 2, weight: 70 }, 200, "cGy"],
    ["AUC", 5, { gfrForCalvert: 60 }, 425, "mg"],
  ])(
    "%s mantém base explícita e unidade de saída",
    (doseUnit, dose, context, want, resultUnit) => {
      const p = doc([
        drug({ doseUnit, dose, schedule: [{ dose, days: [1] }] }),
      ]);
      expect(active(p, { cycle: 1, day: 1, ...context })[0]).toMatchObject({
        calculatedDose: want,
        resultUnit,
      });
    }
  );

  it("AUC nunca substitui GFR absoluto explícito por eGFR indexada", () => {
    const p = doc([
      drug({ doseUnit: "AUC", dose: 5, schedule: [{ dose: 5, days: [1] }] }),
    ]);
    const row = active(p, { cycle: 1, day: 1, egfr: 90, bsa: 2 })[0];
    expect(row).toMatchObject({ status: "blocked", calculatedDose: null });
    expect(row.issues.join(" ")).toContain("gfrForCalvert");
    expect(
      active(p, { cycle: 1, day: 1, gfrForCalvert: 0 })[0].calculatedDose
    ).toBe(125);
  });

  it.each([null, NaN, Infinity, -1])("dose inválida %s não vira zero", dose => {
    expect(
      active(doc([drug({ dose, schedule: [{ dose, days: [1] }] })]), {
        cycle: 1,
        day: 1,
      })[0]
    ).toMatchObject({
      dose: null,
      calculatedDose: null,
      dailyDose: null,
      status: "blocked",
    });
  });

  it.each([null, NaN, Infinity, 0, -1, 1.5])(
    "frequência inválida %s não recebe default",
    administrationsPerDay => {
      const p = doc([
        drug({
          administrationFrequency: {
            administrationsPerDay,
            doseRepresents: "per_24_hours",
          },
        }),
      ]);
      expect(active(p, { cycle: 1, day: 1 })[0]).toMatchObject({
        frequency: null,
        calculatedDose: null,
        dailyDose: null,
        status: "blocked",
      });
    }
  );

  it.each([{ bsa: 0 }, { bsa: NaN }, { bsa: -1 }, {}])(
    "SC ausente/inválida bloqueia cálculo %j",
    context => {
      expect(
        active(doc([drug({ doseUnit: "mg/m²" })]), {
          cycle: 1,
          day: 1,
          ...context,
        })[0]
      ).toMatchObject({ calculatedDose: null, status: "blocked" });
    }
  );

  it("frequency numérica explícita é aceita, mas ausência e null não", () => {
    expect(
      active(
        doc([drug({ administrationFrequency: undefined, frequency: 2 })]),
        { cycle: 1, day: 1 }
      )[0]
    ).toMatchObject({ frequency: 2, calculatedDose: 10, dailyDose: 20 });
    expect(
      active(
        doc([drug({ administrationFrequency: undefined, frequency: null })]),
        { cycle: 1, day: 1 }
      )[0]
    ).toMatchObject({ frequency: null, calculatedDose: null });
  });

  it.each(["per_24_hours", "total_for_this_infusion"])(
    "infusão contínua %s nunca divide nem converte para taxa",
    doseRepresents => {
      const p = doc([
        drug({
          administrationFrequency: {
            administrationsPerDay: 2,
            continuousInfusion: true,
            doseRepresents,
          },
        }),
      ]);
      const row = active(p, { cycle: 1, day: 1 })[0];
      expect(row).toMatchObject({
        calculatedDose: 10,
        dailyDose: doseRepresents === "per_24_hours" ? 10 : null,
        resultUnit: "mg",
      });
      expect(api.formatClinicalFrequency(row)).toMatch(/infusão/i);
      expect(api.formatClinicalFrequency(row)).not.toMatch(/12\/12h/);
    }
  );

  it("total_for_this_infusion não contínuo também não fraciona", () => {
    const p = doc([
      drug({
        administrationFrequency: {
          administrationsPerDay: 3,
          continuousInfusion: false,
          doseRepresents: "total_for_this_infusion",
        },
      }),
    ]);
    expect(active(p, { cycle: 1, day: 1 })[0]).toMatchObject({
      calculatedDose: 10,
      dailyDose: null,
    });
  });

  it("cap numérico explícito por administração respeita unidade final", () => {
    const row = active(
      doc([drug({ doseUnit: "mg/m²", maxDose: 2, frequency: 1 })]),
      { cycle: 1, day: 1, bsa: 2 }
    )[0];
    expect(row).toMatchObject({ calculatedDose: 2, dailyDose: 2 });
  });

  it("nenhum ajuste genérico ECOG, renal ou toxicidade é aplicado", () => {
    const p = doc([
      drug({
        doseUnit: "mg/m²",
        renalAdjustment: "reduzir 50%",
        toxicity: 4,
        ecog: 4,
      }),
    ]);
    expect(
      active(p, { cycle: 1, day: 1, bsa: 2, egfr: 10 })[0].calculatedDose
    ).toBe(20);
  });
});

describe("seleções não suportadas falham seguro", () => {
  const unsupported = [
    "conditionalDoses",
    "selectionRequired",
    "chooseExactlyOneDay",
    "alternatives",
    "phaseBreak",
    "doseSelectionRequired",
    "ageDoseTable",
    "interactionSchedules",
    "initialTitration",
    "doseLevelSelection",
    "arms",
    "treatmentArms",
    "alternativeSchedule",
    "conditionalExtraDays",
    "taper",
  ];
  it.each(unsupported)(
    "campo de droga %s bloqueia sem usar dose principal",
    key => {
      const row = active(
        doc([drug({ [key]: key.endsWith("Required") ? true : [{ dose: 5 }] })]),
        { cycle: 1, day: 1 }
      )[0];
      expect(row).toMatchObject({
        status: "blocked",
        calculatedDose: null,
        dailyDose: null,
      });
      expect(row.issues.join(" ")).toContain(key);
    }
  );

  it.each(unsupported)(
    "campo de etapa %s bloqueia sem ignorar seleção",
    key => {
      const row = active(
        doc([drug({ schedule: [{ dose: 10, days: [1], [key]: true }] })]),
        { cycle: 1, day: 1 }
      )[0];
      expect(row).toMatchObject({ status: "blocked", calculatedDose: null });
      expect(row.issues.join(" ")).toContain(key);
    }
  );

  it("contexto não selecionável impede fallback mesmo com dose e dia explícitos", () => {
    const p = doc([
      drug({ schedule: [{ dose: 5, days: [1], context: "sem_inibidor" }] }),
    ]);
    expect(active(p, { cycle: 1, day: 1 })[0]).toMatchObject({
      status: "blocked",
      calculatedDose: null,
    });
  });

  it("phase em schedule exige identificação exata sem adivinhar pelo ciclo", () => {
    const p = doc([
      drug({ schedule: [{ dose: 5, days: [1], phase: "consolidação" }] }),
    ]);
    expect(active(p, { cycle: 1, day: 1 })[0]?.status).toBe("blocked");
    expect(
      active(p, { cycle: 1, day: 1, phaseId: "consolidação" })[0]
        ?.calculatedDose
    ).toBe(5);
    expect(active(p, { cycle: 1, day: 1, phaseId: "outra" })).toEqual([]);
  });

  it.each(["arms", "doseLevelSelection", "phaseBreak", "programSelection"])(
    "seleção de documento %s impede cálculo de linhas",
    key => {
      expect(
        active(doc([drug()], { [key]: { requiresSelection: true } }), {
          cycle: 1,
          day: 1,
        })[0]
      ).toMatchObject({ status: "blocked", calculatedDose: null });
    }
  );

  it.each([0, -1, 1.5, NaN, Infinity])(
    "ciclo inválido %s bloqueia, sem fallback",
    cycle => {
      const result = resolve(doc(), { cycle, day: 1 })!;
      expect(result.prescriptionBlocked).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.rows.every(r => r.calculatedDose === null)).toBe(true);
    }
  );

  it("agenda com dose sobreposta conflitante bloqueia em vez de escolher primeira", () => {
    const p = doc([
      drug({
        schedule: [
          { dose: 5, days: [1] },
          { dose: 10, days: [1] },
        ],
      }),
    ]);
    expect(
      active(p, { cycle: 1, day: 1 }).every(
        r => r.status === "blocked" && r.calculatedDose === null
      )
    ).toBe(true);
  });

  it("chave desconhecida da agenda não é ignorada", () => {
    const row = active(
      doc([
        drug({
          schedule: [{ dose: 10, days: [1], mysterySelector: "braço A" }],
        }),
      ]),
      { cycle: 1, day: 1 }
    )[0];
    expect(row).toMatchObject({ status: "blocked", calculatedDose: null });
    expect(row.issues.join(" ")).toContain("mysterySelector");
  });

  it("dose sobreposta também bloqueia calendário agrupado com dia omitido", () => {
    const p = doc([
      drug({
        schedule: [
          { dose: 5, days: [1, 8] },
          { dose: 10, dayFrom: 8, dayTo: 15 },
        ],
      }),
    ]);
    const rows = active(p, { cycle: 1 });
    expect(rows).toHaveLength(2);
    expect(
      rows.every(r => r.status === "blocked" && r.calculatedDose === null)
    ).toBe(true);
  });

  it.each([
    "mysterySelector",
    "futureAlternatives",
    "randomArmSelection",
    "doseLevelTable",
  ])("novo seletor de droga %s não pode ser descartado", key => {
    expect(
      active(doc([drug({ [key]: [1, 2] })]), { cycle: 1, day: 1 })[0]
    ).toMatchObject({ status: "blocked", calculatedDose: null });
  });

  it("administrationFrequency explicitamente null não herda frequency secundária", () => {
    const d = {
      ...drug(),
      administrationFrequency: null,
      frequency: 1,
    } as unknown as ClinicalDrug;
    expect(active(doc([d]), { cycle: 1, day: 1 })[0]).toMatchObject({
      status: "blocked",
      frequency: null,
      calculatedDose: null,
    });
  });

  it("doseRepresents explicitamente null não recebe per_administration", () => {
    const d = drug({
      administrationFrequency: {
        administrationsPerDay: 1,
        doseRepresents: null,
      } as unknown as ClinicalDrug["administrationFrequency"],
    });
    expect(active(doc([d]), { cycle: 1, day: 1 })[0]).toMatchObject({
      status: "blocked",
      calculatedDose: null,
    });
  });

  it("pendência de seleção não desaparece em dia sem dose", () => {
    const result = resolve(
      doc([drug({ conditionalDoses: [{ dose: 20, days: [2] }] })]),
      { cycle: 1, day: 2 }
    )!;
    expect(result.rows.every(r => r.calculatedDose === null)).toBe(true);
    expect(result.rows[0]).toMatchObject({ status: "blocked", dose: null });
    expect(result.issues.join(" ")).toContain("conditionalDoses");
  });

  it.each([NaN, Infinity, 1.5])("dia inválido %s nunca calcula", day => {
    const result = resolve(doc(), { cycle: 1, day })!;
    expect(result.prescriptionBlocked).toBe(true);
    expect(result.rows.every(r => r.calculatedDose === null)).toBe(true);
  });

  it("origem temporal desconhecida requer contexto adicional, não dias do ciclo", () => {
    const row = active(
      doc([
        drug({
          schedule: [{ dose: 5, days: [1], timeOrigin: "after_lab_recovery" }],
        }),
      ]),
      { cycle: 1, day: 1 }
    )[0];
    expect(row).toMatchObject({ status: "blocked", calculatedDose: null });
    expect(row.issues.join(" ")).toContain("timeOrigin");
  });

  it("agenda com alternativa desconhecida fora do dia não libera etapa principal", () => {
    const p = doc([
      drug({
        schedule: [
          { dose: 10, days: [1] },
          { dose: 20, days: [2], chooseExactlyOneDay: [1, 2] },
        ],
      }),
    ]);
    expect(active(p, { cycle: 1, day: 1 })[0]).toMatchObject({
      status: "blocked",
      calculatedDose: null,
    });
  });

  it("requiresExplicitSelection da fase é satisfeito por phaseId exato", () => {
    const p = doc([], {
      phaseLibrary: [
        {
          id: "phase",
          name: "Fase",
          requiresExplicitSelection: true,
          drugs: [drug()],
        },
      ],
    });
    expect(
      active(p, { cycle: 1, phaseId: "phase", day: 1 }, "d")[0]
    ).toMatchObject({ status: "ready", calculatedDose: 10 });
  });
});

describe("bloqueio de prescrição independente da simulação", () => {
  it("rascunho continua bloqueado mesmo com cálculo de linha pronta", () => {
    const p = doc();
    expect(active(p, { cycle: 1, day: 1 })[0].status).toBe("ready");
    expect(api.getClinicalPrescriptionBlock(p).length).toBeGreaterThan(0);
    expect(resolve(p, { cycle: 1, day: 1 })!.prescriptionBlocked).toBe(true);
  });
  it.each([
    {
      calculationPolicy: { automaticPrescriptionAllowed: false },
      review: { status: "institutionally_approved" },
    },
    {
      calculationPolicy: { automaticPrescriptionAllowed: true },
      referenceOnly: true,
      review: { status: "institutionally_approved" },
    },
    {
      calculationPolicy: { automaticPrescriptionAllowed: true },
      review: { status: "draft_not_institutionally_approved" },
    },
    {
      calculationPolicy: { automaticPrescriptionAllowed: true },
      review: undefined,
    },
  ])("bloqueia política, referência ou ausência de homologação %j", extra => {
    expect(
      api.getClinicalPrescriptionBlock(doc([drug()], extra)).length
    ).toBeGreaterThan(0);
  });
  it("apenas consulta flag explícita já homologada; não efetua homologação", () => {
    const p = doc([drug()], {
      calculationPolicy: { automaticPrescriptionAllowed: true },
      review: { status: "institutionally_approved" },
    });
    expect(api.getClinicalPrescriptionBlock(p)).toEqual([]);
    expect(resolve(p, { cycle: 1, day: 1 })!.prescriptionBlocked).toBe(false);
    expect(
      resolve(p, { cycle: 1, day: 1, bsa: NaN })!.rows[0].calculatedDose
    ).toBe(10);
  });
});

// One uniform, bounded sweep for every document, no per-protocol clinical judgment.
describe("todos os 52 documentos: determinismo, preservação e Rx bloqueada", () => {
  it.each(protocols)(
    "$id mantém contrato seguro em ciclos, dias e fases",
    p => {
      const before = JSON.stringify(p);
      const allowedSources = [
        ...p.drugs,
        ...(p.phaseLibrary ?? []).flatMap(phase => phase.drugs ?? []),
      ];
      const contexts: ClinicalContext[] = [
        { cycle: 1 },
        { cycle: 2 },
        { cycle: 4 },
        { cycle: 5 },
        { cycle: 18 },
        ...[-6, 0, 1, 8, 15, 29, 100].map(day => ({ cycle: 1, day })),
        ...(p.phaseLibrary ?? []).flatMap(phase => [
          { cycle: 1, phaseId: phase.id },
          { cycle: 1, day: 1, phaseId: phase.id },
        ]),
      ];
      for (const context of contexts) {
        const result = resolve(p, {
          bsa: 2,
          weight: 70,
          egfr: 60,
          ...context,
        })!;
        expect(result).toEqual(
          resolve(p, { bsa: 2, weight: 70, egfr: 60, ...context })
        );
        expect(result.prescriptionBlocked).toBe(true);
        expect(
          result.cycleLength === null ||
            (Number.isFinite(result.cycleLength) && result.cycleLength > 0)
        ).toBe(true);
        if (!p.phaseLibrary && p.drugs.length)
          expect(result.rows.length).toBeGreaterThan(0);
        for (const row of result.rows) {
          expect(allowedSources).toContain(row.source);
          expect(["ready", "not_scheduled", "blocked"]).toContain(row.status);
          expect(
            row.calculatedDose === null || Number.isFinite(row.calculatedDose)
          ).toBe(true);
          expect(row.dailyDose === null || Number.isFinite(row.dailyDose)).toBe(
            true
          );
          if (row.status !== "ready") expect(row.calculatedDose).toBeNull();
          if (row.status === "blocked")
            expect(row.issues.length).toBeGreaterThan(0);
          expect(api.formatClinicalFrequency(row)).toBeTypeOf("string");
        }
      }
      expect(JSON.stringify(p)).toBe(before);
    }
  );
});
