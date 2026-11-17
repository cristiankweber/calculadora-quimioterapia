import * as React from "react";
import { act, create } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtocolManager from "./ProtocolManager";
import { TemplateDoseRevisionDialog } from "./TemplateDoseRevisionDialog";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  records: [] as any[],
  updates: [] as any[],
  invalidations: [] as string[],
  queryInputs: [] as any[],
  prepared: null as any,
  mutationOptions: null as any,
  queryError: null as any,
  pending: false,
  closed: 0,
}));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      customProtocols: {
        list: {
          invalidate: async () => {
            state.invalidations.push("list");
          },
        },
        listActive: {
          invalidate: async () => {
            state.invalidations.push("listActive");
          },
        },
      },
      templateDoseRevision: {
        prepare: {
          invalidate: async () => {
            state.invalidations.push("prepare");
          },
        },
      },
    }),
    customProtocols: {
      list: { useQuery: () => ({ data: state.records, isLoading: false }) },
      ...Object.fromEntries(
        [
          "create",
          "update",
          "delete",
          "restore",
          "export",
          "exportAll",
          "import",
          "seedSystem",
        ].map(k => [
          k,
          {
            useMutation: () => ({
              isPending: false,
              mutate: () => {
                throw Error("Legacy write forbidden");
              },
            }),
          },
        ])
      ),
    },
    templateDoseRevision: {
      prepare: {
        useQuery: (input: any) => {
          state.queryInputs.push(input);
          return {
            data: state.prepared,
            error: state.queryError,
            isLoading: false,
          };
        },
      },
      update: {
        useMutation: (options: any) => {
          state.mutationOptions = options;
          return {
            mutate: (input: any) => state.updates.push(input),
            isPending: state.pending,
          };
        },
      },
    },
  },
}));
// Only the portal boundary is replaced; all form behavior and inputs are real.
vi.mock("@/components/ui/dialog", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/ui/dialog")>()),
  Dialog: ({ children, open }: any) =>
    open ? React.createElement("div", null, children) : null,
  ...Object.fromEntries(
    [
      "DialogContent",
      "DialogHeader",
      "DialogTitle",
      "DialogDescription",
      "DialogFooter",
    ].map(k => [
      k,
      ({ children }: any) => React.createElement("div", null, children),
    ])
  ),
}));
const record = () => ({
  id: 42,
  userId: 7,
  name: "Fictício",
  indication: "Software",
  protocolId: "template-test",
  cycles: 1,
  cycleLength: 21,
  emetogenicRisk: "minimal",
  createdAt: new Date(),
  isActive: 1,
  drugs: [],
  clinicalPackage: { version: "user-protocol-template-1.0" },
  clinicalDocument: {
    drugs: [],
    templateUsage: {
      kind: "user_managed",
      status: "active",
      prescriptionEnabled: true,
    },
  },
});
const text = (node: any): string =>
  typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(text).join("")
      : text(node?.children ?? []);
let renderer: ReturnType<typeof create>;
const renderDialog = async (id = 42) => {
  await act(async () => {
    renderer = create(
      React.createElement(TemplateDoseRevisionDialog, {
        id,
        onClose: () => {
          state.closed++;
        },
      })
    );
  });
  return renderer!;
};
const edit = async (inputIndex: number, value: string) => {
  await act(async () =>
    renderer.root
      .findAllByType("input")
      [inputIndex].props.onChange({ target: { value } })
  );
};
const reason = async (value: string) => {
  await act(async () =>
    renderer.root.findByType("textarea").props.onChange({ target: { value } })
  );
};
const saveButton = () =>
  renderer.root
    .findAllByType("button")
    .find(b =>
      text(b.toJSON?.() ?? { children: b.children }).includes(
        "Criar nova versão"
      )
    )!;
beforeEach(() => {
  state.records = [record()];
  state.updates = [];
  state.invalidations = [];
  state.queryInputs = [];
  state.queryError = null;
  state.pending = false;
  state.closed = 0;
  state.prepared = {
    id: 42,
    expectedHash: "a".repeat(64),
    fields: [
      {
        path: ["drugs", "0", "dose"],
        mirroredPaths: [],
        dose: 10,
        drugName: "Agente A",
        unit: "mg/m²",
        period: "Dose-padrão · Dias: 1",
      },
      {
        path: ["drugs", "0", "schedule", "0", "dose"],
        mirroredPaths: [["drugs", "0", "extensions", "schedule", "0", "dose"]],
        dose: 0.01,
        drugName: "Agente A",
        unit: "mg",
        period: "Agenda · Fase: Consolidação · Dias: 8",
      },
    ],
  };
});
describe("template dose revision UI", () => {
  it("offers doses-only revision for active template, while drafts/archived remain blocked", () => {
    expect(
      renderToStaticMarkup(React.createElement(ProtocolManager))
    ).toContain("Editar doses-padrão");
    state.records[0].isActive = 0;
    expect(
      renderToStaticMarkup(React.createElement(ProtocolManager))
    ).not.toContain("Editar doses-padrão");
    state.records[0].isActive = 1;
    state.records[0].clinicalPackage.version =
      "2.1-source-reconciled-clinical-draft";
    delete state.records[0].clinicalDocument.templateUsage;
    expect(
      renderToStaticMarkup(React.createElement(ProtocolManager))
    ).not.toContain("Editar doses-padrão");
  });
  it("shows editable main/agenda doses, explicit units and periods from protected prepare", async () => {
    await renderDialog();
    expect(state.queryInputs[0]).toEqual({ id: 42 });
    const output = text(renderer.toJSON());
    expect(output).toContain("Agente A");
    expect(output).toContain("mg/m²");
    expect(output).toContain("Consolidação");
    expect(renderer.root.findAllByType("input")).toHaveLength(2);
  });
  it("sends only changed path doses plus server hash and reason, preserving tiny decimal precision", async () => {
    await renderDialog();
    await edit(1, "0.012345");
    await reason("Motivo médico");
    await act(async () => saveButton().props.onClick());
    expect(state.updates).toEqual([
      {
        id: 42,
        expectedHash: "a".repeat(64),
        changes: [
          { path: ["drugs", "0", "schedule", "0", "dose"], dose: 0.012345 },
        ],
        reason: "Motivo médico",
      },
    ]);
  });
  it.each(["", "0", "-1", "NaN", "Infinity", "1e999"])(
    "does not submit invalid dose %s",
    async value => {
      await renderDialog();
      await edit(0, value);
      await reason("Motivo médico");
      expect(saveButton().props.disabled).toBe(true);
      expect(state.updates).toEqual([]);
    }
  );
  it("requires reason and an actual changed dose", async () => {
    await renderDialog();
    await reason("Motivo médico");
    expect(saveButton().props.disabled).toBe(true);
    await edit(0, "12");
    await reason("   ");
    expect(saveButton().props.disabled).toBe(true);
  });
  it("invalidates both lists and clears/closes the editor after success", async () => {
    await renderDialog();
    await edit(0, "12");
    await reason("Motivo médico");
    await act(async () =>
      state.mutationOptions.onSuccess({
        id: 43,
        protocolId: "template-new",
        revision: {},
      })
    );
    expect(state.invalidations).toEqual(
      expect.arrayContaining(["list", "listActive", "prepare"])
    );
    expect(state.closed).toBe(1);
  });
  it("closes/clears stale drafts on conflict without retrying the rejected changes", async () => {
    await renderDialog();
    await edit(0, "12");
    await reason("Motivo médico");
    await act(async () =>
      state.mutationOptions.onError({
        message: "Atualize",
        data: { code: "CONFLICT" },
      })
    );
    expect(state.closed).toBe(1);
    expect(state.updates).toEqual([]);
  });
  it("renders prepare failure without a save form", async () => {
    state.prepared = null;
    state.queryError = { message: "Template arquivado" };
    await renderDialog();
    expect(text(renderer.toJSON())).toContain("Template arquivado");
    expect(renderer.root.findAllByType("input")).toHaveLength(0);
  });
  it("remounting another id clears doses/reason from the previous template", async () => {
    await renderDialog();
    await edit(0, "12");
    await reason("Motivo anterior");
    await act(async () => renderer.unmount());
    state.prepared = {
      ...state.prepared,
      id: 43,
      expectedHash: "b".repeat(64),
    };
    await renderDialog(43);
    expect(renderer.root.findByType("textarea").props.value).toBe("");
    expect(renderer.root.findAllByType("input")[0].props.value).toBe("10");
  });
});
