import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtocolManager from "./ProtocolManager";

const state = vi.hoisted(() => ({ documents: [] as any[] }));
vi.mock("@/lib/trpc", () => {
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
    ].map(key => [
      key,
      {
        useMutation: () => ({
          mutate: () => {
            throw Error("No database writes in UI tests");
          },
          isPending: false,
        }),
      },
    ])
  );
  return {
    trpc: {
      useUtils: () => ({}),
      customProtocols: {
        ...resources,
        list: { useQuery: () => ({ data: state.documents, isLoading: false }) },
      },
    },
  };
});
function record() {
  return {
    id: 17,
    name: "Fixture",
    indication: "Teste",
    cycles: 1,
    cycleLength: 21,
    emetogenicRisk: "minimal",
    isActive: 1,
    createdAt: new Date("2026-01-01"),
    drugs: [],
    clinicalPackage: { version: "user-protocol-template-1.0" },
    clinicalDocument: {
      id: "fixture",
      name: "Fixture",
      drugs: [],
      templateUsage: {
        kind: "user_managed",
        status: "active",
        prescriptionEnabled: true,
      },
    },
  };
}
beforeEach(() => {
  state.documents = [record()];
});
describe("acesso ao editor clínico completo", () => {
  it("oferece edição completa visível e mantém a revisão de doses separada no template ativo", () => {
    const html = renderToStaticMarkup(React.createElement(ProtocolManager));
    expect(html).toMatch(
      /<button[^>]*>[^]*?Editar protocolo completo<\/button>/
    );
    expect(html).toContain("Editar doses-padrão");
    expect(html).not.toContain(
      "Revisões devem ser importadas em JSON completo"
    );
  });
  it("não oferece edição completa para um rascunho clínico", () => {
    state.documents[0].clinicalDocument = {
      id: "draft",
      name: "Draft",
      review: { institutionalApproval: false },
      drugs: [],
    };
    state.documents[0].clinicalPackage.version =
      "2.1-source-reconciled-clinical-draft";
    const html = renderToStaticMarkup(React.createElement(ProtocolManager));
    expect(html).not.toContain("Editar protocolo completo");
    expect(html).toContain("Rascunho · somente consulta");
  });
  it("mantém o editor legado disponível sem oferecer revisão de template ao protocolo legado", () => {
    state.documents[0].clinicalDocument = null;
    state.documents[0].clinicalPackage = null;
    const html = renderToStaticMarkup(React.createElement(ProtocolManager));
    expect(html).not.toContain("Editar protocolo completo");
    expect(html).toContain('title="Editar protocolo"');
  });
  it("não permite revisão do template arquivado", () => {
    state.documents[0].isActive = 0;
    const html = renderToStaticMarkup(React.createElement(ProtocolManager));
    expect(html).not.toContain("Editar protocolo completo");
    expect(html).not.toContain("Editar doses-padrão");
    expect(html).toContain("Restaurar");
  });
});
