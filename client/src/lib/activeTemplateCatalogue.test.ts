import { describe, expect, it } from "vitest";
import { getClinicalCatalogue, mapStoredProtocol } from "./clinicalCatalogue";
import { getPrescriptionBlockReason } from "@shared/clinicalProtocols/library";
const record = () => ({
  userId: 7,
  protocolId: "template-local-abc",
  isActive: 1,
  name: "R-CHOP",
  clinicalPackage: { version: "user-protocol-template-1.0" },
  clinicalDocument: {
    id: "HEM-007",
    name: "R-CHOP",
    indication: "Teste",
    cycles: 6,
    cycleLength: 21,
    templateUsage: {
      kind: "user_managed",
      status: "active",
      prescriptionEnabled: true,
    },
    drugs: [],
  },
});
describe("Templates ativos são separados dos rascunhos e disponíveis no catálogo", () => {
  it("mantém template na biblioteca própria mesmo se o ID clínico coincide com o rascunho", () => {
    const result = getClinicalCatalogue("templates" as any, [record()]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "template-local-abc",
      libraryKind: "templates",
      isUserTemplate: true,
    });
  });
  it("não mantém bloqueio geral pelo nome do rascunho em um template importado próprio", () => {
    expect(getPrescriptionBlockReason(mapStoredProtocol(record()))).toBeNull();
  });
  it("preserva o bloqueio do rascunho estático sem uma importação de template", () => {
    expect(
      getPrescriptionBlockReason({ id: "clinical-HEM-007", name: "R-CHOP" })
    ).not.toBeNull();
  });
});
