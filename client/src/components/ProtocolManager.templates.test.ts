import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtocolManager from "./ProtocolManager";
const state = vi.hoisted(() => ({ documents: [] as any[] }));
vi.mock("@/lib/trpc", () => {
  const noWrites = {
    mutate: () => {
      throw Error("Gravação bloqueada");
    },
    isPending: false,
  };
  const resources = Object.fromEntries(
    [
      "create",
      "update",
      "delete",
      "restore",
      "export",
      "exportAll",
      "import",
      "seedSystem",
    ].map(k => [k, { useMutation: () => noWrites }])
  );
  return {
    trpc: {
      useUtils: () => ({
        customProtocols: { list: { invalidate: async () => undefined } },
      }),
      customProtocols: {
        ...resources,
        list: { useQuery: () => ({ data: state.documents, isLoading: false }) },
      },
    },
  };
});
const record = () => ({
  id: 1,
  userId: 1,
  protocolId: "template-abc",
  name: "Fixture clínico",
  indication: "Teste",
  cycles: 1,
  cycleLength: 21,
  emetogenicRisk: "minimal",
  isActive: 1,
  createdAt: new Date(),
  drugs: [],
  clinicalPackage: { version: "user-protocol-template-1.0" },
  clinicalDocument: {
    id: "a",
    name: "Fixture",
    drugs: [
      {
        id: "b",
        name: "Droga",
        dose: 10,
        doseUnit: "mg",
        route: "VO",
        days: "1",
        schedule: [{ dose: 10, days: [1] }],
      },
    ],
    templateUsage: {
      kind: "user_managed",
      status: "active",
      prescriptionEnabled: true,
    },
  },
});
beforeEach(() => {
  state.documents = [record()];
});
describe("Gerenciador distingue templates ativos de rascunhos", () => {
  it("mostra template ativo e mantém revisão por JSON sem falsa etiqueta de rascunho", () => {
    const html = renderToStaticMarkup(React.createElement(ProtocolManager));
    expect(html).toContain("Template ativo");
    expect(html).not.toContain("Rascunho · somente consulta");
  });
  it("mantém um rascunho anterior em somente consulta", () => {
    state.documents[0].clinicalDocument = {
      id: "a",
      name: "Rascunho",
      review: { institutionalApproval: false },
      drugs: [],
    };
    state.documents[0].clinicalPackage = {
      version: "2.1-source-reconciled-clinical-draft",
    };
    const html = renderToStaticMarkup(React.createElement(ProtocolManager));
    expect(html).toContain("Rascunho · somente consulta");
    expect(html).not.toContain("Template ativo");
  });
});
