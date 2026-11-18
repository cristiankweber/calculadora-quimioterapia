import * as React from "react";
import { act, create } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ClinicalEditor from "./TemplateClinicalRevisionDialog";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  updates: [] as any[],
  events: [] as string[],
  pending: false,
  options: null as any,
}));
// Only the external tRPC boundary is mocked. All form controls and rendering are real.
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      customProtocols: {
        list: {
          invalidate: async () => {
            state.events.push("list");
          },
        },
        listActive: {
          invalidate: async () => {
            state.events.push("listActive");
          },
        },
      },
      templateClinicalRevision: {
        prepare: {
          invalidate: async () => {
            state.events.push("prepare");
          },
        },
      },
    }),
    templateClinicalRevision: {
      update: {
        useMutation: (options: any) => {
          state.options = options;
          return {
            isPending: state.pending,
            mutate: (payload: any) => {
              state.updates.push(payload);
            },
          };
        },
      },
    },
  },
}));
const field = (
  path: string[],
  label: string,
  kind: string,
  value: unknown,
  extra = {}
) => ({
  path,
  mirroredPaths: [],
  label,
  section: "general",
  kind,
  value,
  ...extra,
});
const fixture = () => ({
  id: 42,
  name: "Fixture de software",
  expectedHash: "hash-do-servidor",
  fields: [
    field(["name"], "Nome", "text", "Fixture de software"),
    field(
      ["drugs", "0", "schedule", "0", "dose"],
      "Agente A · Fase 2 · Dias 8 · Dose (mg)",
      "number",
      0.01,
      { section: "drugs" }
    ),
    field(
      ["drugs", "0", "continuousInfusion"],
      "Infusão contínua",
      "select",
      false,
      {
        section: "drugs",
        options: [
          { value: "false", label: "Não" },
          { value: "true", label: "Sim" },
        ],
      }
    ),
    field(["drugs", "0", "days"], "Dias estruturados", "days", [1, 8], {
      section: "drugs",
    }),
    field(["alerts"], "Alertas", "textList", ["Original", "Outro"], {
      section: "alerts",
    }),
    field(["notes"], "Observações", "text", undefined, { nullable: true }),
    field(["limit"], "Limite opcional", "number", null, { nullable: true }),
  ],
});
let renderer: ReturnType<typeof create> | undefined;
const text = (node: any): string =>
  typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(text).join("")
      : text(node?.children ?? []);
async function render(prepared = fixture(), extra = {}) {
  await act(async () => {
    renderer = create(
      React.createElement(ClinicalEditor.TemplateClinicalRevisionForm, {
        prepared,
        onClose: () => {
          state.events.push("close");
        },
        ...extra,
      } as any)
    );
  });
}
const control = (label: string) => {
  const found = renderer!.root.findAll(
    node => typeof node.type === "string" && node.props["aria-label"] === label
  )[0];
  expect(found, `Controle editável ausente: ${label}`).toBeDefined();
  return found;
};
async function edit(label: string, value: string) {
  await act(async () => {
    control(label).props.onChange({ target: { value } });
  });
}
const button = (label: string) =>
  renderer!.root
    .findAllByType("button")
    .find(
      node =>
        node.props["aria-label"] === label || text(node.children) === label
    )!;
async function reason() {
  await edit("Motivo da revisão", " Revisão de software ");
}
async function save() {
  await act(async () => {
    button("Criar nova versão").props.onClick();
  });
}
beforeEach(() => {
  state.updates = [];
  state.events = [];
  state.pending = false;
  state.options = null;
});
afterEach(async () => {
  if (renderer)
    await act(async () => {
      renderer!.unmount();
    });
  renderer = undefined;
});

describe("formulário clínico completo real", () => {
  it("renderiza controles editáveis por seção e mantém rótulos de fase e resumo protegido", async () => {
    await render();
    expect(control("Agente A · Fase 2 · Dias 8 · Dose (mg)").props.type).toBe(
      "number"
    );
    expect(control("Observações").type).toBe("textarea");
    expect(text(renderer!.toJSON())).toContain("Metadados protegidos");
    expect(text(renderer!.toJSON())).toContain("Fontes");
    expect(
      renderer!.root.findAllByType("details").length
    ).toBeGreaterThanOrEqual(3);
    expect(
      renderToStaticMarkup(
        React.createElement(ClinicalEditor.TemplateClinicalRevisionForm, {
          prepared: fixture(),
          onClose: () => {},
        } as any)
      )
    ).toContain("Prévia das alterações");
  });
  it("envia somente o campo alterado com hash e motivo, sem inventar opcionais ausentes", async () => {
    await render();
    await edit("Agente A · Fase 2 · Dias 8 · Dose (mg)", "0.012345");
    await reason();
    await save();
    expect(state.updates).toEqual([
      {
        id: 42,
        expectedHash: "hash-do-servidor",
        changes: [
          { path: ["drugs", "0", "schedule", "0", "dose"], value: 0.012345 },
        ],
        reason: "Revisão de software",
      },
    ]);
    expect(text(renderer!.toJSON())).toContain("1 campo alterado");
  });
  it("preserva o tipo booleano ao selecionar infusão contínua", async () => {
    await render();
    await edit("Infusão contínua", "true");
    await reason();
    await save();
    expect(state.updates[0].changes).toEqual([
      { path: ["drugs", "0", "continuousInfusion"], value: true },
    ]);
  });
  it("preserva seleções numéricas sem converter enumerações textuais em números", async () => {
    const prepared = fixture();
    prepared.fields = [
      field(["count"], "Seleção numérica", "select", 1, {
        options: [
          { value: "1", label: "Um" },
          { value: "2", label: "Dois" },
        ],
      }),
      field(["timing"], "Referência temporal", "select", "1", {
        options: [
          { value: "1", label: "Um" },
          { value: "2", label: "Dois" },
        ],
      }),
    ];
    await render(prepared);
    await edit("Seleção numérica", "2");
    await edit("Referência temporal", "2");
    await reason();
    await save();
    expect(state.updates[0].changes).toEqual([
      { path: ["count"], value: 2 },
      { path: ["timing"], value: "2" },
    ]);
  });
  it("edita dias em array sem alterar dias expressos como texto", async () => {
    const prepared = fixture();
    prepared.fields.push(field(["textDays"], "Dias textuais", "days", "D1–D3"));
    await render(prepared);
    await edit("Dias estruturados", "2, 9");
    await edit("Dias textuais", "D1–D5");
    await reason();
    await save();
    expect(state.updates[0].changes).toEqual([
      { path: ["drugs", "0", "days"], value: [2, 9] },
      { path: ["textDays"], value: "D1–D5" },
    ]);
  });
  it.each(["2.5", "NaN", "1,,2"])(
    "bloqueia dias estruturados inválidos %s",
    async value => {
      await render();
      await edit("Dias estruturados", value);
      await reason();
      expect(button("Criar nova versão").props.disabled).toBe(true);
    }
  );
  it.each(["", "0", "-1", "Infinity"])(
    "bloqueia dose positiva inválida %s",
    async value => {
      await render();
      await edit("Agente A · Fase 2 · Dias 8 · Dose (mg)", value);
      await reason();
      expect(button("Criar nova versão").props.disabled).toBe(true);
    }
  );
  it("não impõe positividade a um número originalmente negativo", async () => {
    const prepared = fixture();
    prepared.fields = [field(["offset"], "Deslocamento", "number", -2)];
    await render(prepared);
    await edit("Deslocamento", "-3");
    await reason();
    await save();
    expect(state.updates[0].changes).toEqual([{ path: ["offset"], value: -3 }]);
  });
  it("permite apagar explicitamente um número nullable sem transformá-lo em zero", async () => {
    const prepared = fixture();
    prepared.fields[6].value = 12;
    await render(prepared);
    await edit("Limite opcional", "");
    await reason();
    await save();
    expect(state.updates[0].changes).toEqual([
      { path: ["limit"], value: null },
    ]);
  });
  it("adiciona e remove itens individuais sem salvar texto de interface como conteúdo", async () => {
    await render();
    await act(async () => {
      button("Adicionar item em Alertas").props.onClick();
    });
    await edit("Alertas · item 3", "Novo item");
    await act(async () => {
      button("Remover item 1 de Alertas").props.onClick();
    });
    await reason();
    await save();
    expect(state.updates[0].changes).toEqual([
      { path: ["alerts"], value: ["Outro", "Novo item"] },
    ]);
  });
  it("usa campo de uma linha para via e área de texto para instruções", async () => {
    const prepared = fixture();
    prepared.fields = [
      field(["drugs", "0", "route"], "Via", "text", "IV", { section: "drugs" }),
      field(
        ["dilutionInfo", "0", "specialInstructions"],
        "Instruções",
        "text",
        "Texto",
        { section: "administration" }
      ),
    ];
    await render(prepared);
    expect(control("Via").type).toBe("input");
    expect(control("Instruções").type).toBe("textarea");
  });
  it("exige referência temporal ao adicionar uma ordem antiemética", async () => {
    const prepared = fixture();
    prepared.fields = [
      field(["antiemetics", "day1"], "Ordens do dia 1", "textList", [], {
        section: "antiemetics",
      }),
      field(
        ["antiemetics", "timeReference"],
        "Referência temporal",
        "text",
        "",
        { section: "antiemetics" }
      ),
    ];
    await render(prepared);
    await act(async () => {
      button("Adicionar item em Ordens do dia 1").props.onClick();
    });
    await edit("Ordens do dia 1 · item 1", "Ordem declarada");
    await reason();
    expect(button("Criar nova versão").props.disabled).toBe(true);
    expect(text(renderer!.toJSON())).toContain("Informe a referência temporal");
    await edit("Referência temporal", "Dias do ciclo");
    expect(button("Criar nova versão").props.disabled).toBe(false);
  });
  it("não exige referência temporal quando não há ordens antieméticas", async () => {
    const prepared = fixture();
    prepared.fields.push(
      field(["antiemetics", "day1"], "Ordens do dia 1", "textList", [], {
        section: "antiemetics",
      }),
      field(
        ["antiemetics", "timeReference"],
        "Referência temporal",
        "text",
        "",
        { section: "antiemetics" }
      )
    );
    await render(prepared);
    await edit("Nome", "Novo");
    await reason();
    expect(button("Criar nova versão").props.disabled).toBe(false);
  });
  it.each(["", "1, 1"])(
    "não permite calendário estruturado vazio ou duplicado %s",
    async value => {
      await render();
      await edit("Dias estruturados", value);
      await reason();
      expect(button("Criar nova versão").props.disabled).toBe(true);
    }
  );
  it("exige motivo e mudança real, incluindo após reverter o campo", async () => {
    await render();
    await reason();
    expect(button("Criar nova versão").props.disabled).toBe(true);
    await edit("Nome", "Novo nome");
    await edit("Motivo da revisão", "  ");
    expect(button("Criar nova versão").props.disabled).toBe(true);
    await reason();
    await edit("Nome", "Fixture de software");
    expect(button("Criar nova versão").props.disabled).toBe(true);
  });
  it("bloqueia todos os controles e cancelar durante gravação", async () => {
    state.pending = true;
    await render();
    expect(renderer!.root.findByType("fieldset").props.disabled).toBe(true);
    expect(button("Cancelar").props.disabled).toBe(true);
    expect(button("Salvando…").props.disabled).toBe(true);
  });
  it("invalida listas, aguarda onSaved e somente então fecha", async () => {
    await render(fixture(), {
      onSaved: async (result: any) => {
        expect(result).toMatchObject({ id: 43, protocolId: "new" });
        state.events.push("saved");
      },
    });
    await act(async () => {
      await state.options.onSuccess({
        id: 43,
        protocolId: "new",
        revision: {},
      });
    });
    expect(state.events).toEqual([
      "list",
      "listActive",
      "prepare",
      "saved",
      "close",
    ]);
  });
  it("permanece bloqueado até onSaved concluir e não fecha antes da seleção", async () => {
    let release!: () => void;
    const selection = new Promise<void>(resolve => {
      release = resolve;
    });
    await render(fixture(), { onSaved: () => selection });
    let completion!: Promise<void>;
    await act(async () => {
      completion = state.options.onSuccess({
        id: 43,
        protocolId: "new",
        revision: {},
      });
      await Promise.resolve();
    });
    expect(state.events).not.toContain("close");
    expect(button("Salvando…").props.disabled).toBe(true);
    expect(button("Cancelar").props.disabled).toBe(true);
    await act(async () => {
      release();
      await completion;
    });
    expect(state.events.at(-1)).toBe("close");
  });
  it.each(["CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"])(
    "descarta rascunho e fecha na falha protegida %s",
    async code => {
      await render();
      await edit("Nome", "Rascunho local");
      await reason();
      await act(async () => {
        await state.options.onError({
          message: "Versão indisponível",
          data: { code },
        });
      });
      expect(state.events).toContain("close");
      expect(state.events).toContain("prepare");
      expect(state.updates).toEqual([]);
      expect(control("Nome").props.value).toBe("Fixture de software");
    }
  );
  it("mantém rascunho editável e mostra erro em falha não destrutiva", async () => {
    await render();
    await edit("Nome", "Rascunho local");
    await act(async () => {
      await state.options.onError({
        message: "Falha de rede",
        data: { code: "INTERNAL_SERVER_ERROR" },
      });
    });
    expect(text(renderer!.toJSON())).toContain("Falha de rede");
    expect(state.events).not.toContain("close");
    expect(control("Nome").props.value).toBe("Rascunho local");
  });
  it("cancelar limpa rascunho antes de fechar", async () => {
    await render();
    await edit("Nome", "Rascunho local");
    await reason();
    await act(async () => {
      button("Cancelar").props.onClick();
    });
    expect(control("Nome").props.value).toBe("Fixture de software");
    expect(control("Motivo da revisão").props.value).toBe("");
    expect(state.events).toEqual(["close"]);
  });
});
