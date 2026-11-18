import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { customProtocols, type CustomProtocol } from "../drizzle/schema";
import {
  applyTemplateClinicalChanges,
  listTemplateClinicalFields,
} from "../shared/clinicalProtocols/templateClinicalRevision";
import {
  isActiveTemplateDocument,
  USER_TEMPLATE_VERSION,
} from "../shared/clinicalProtocols/templates";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  convertImportToDbRecords,
  exportProtocolPackage,
  protocolContentSha256,
} from "./seedSystemProtocols";

const idSchema = z.number().int().positive().max(2147483647);
// Values are a bounded union of the editor's scalar/list kinds; no arbitrary object payloads.
const valueSchema = z.union([
  z.string().max(20000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(20000)).max(2000),
  z.array(z.number().finite()).max(10000),
]);
export const templateClinicalRevisionInputSchema = z
  .object({
    id: idSchema,
    expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
    changes: z
      .array(
        z
          .object({
            path: z.array(z.string().min(1).max(255)).min(1).max(64),
            value: valueSchema,
          })
          .strict()
      )
      .min(1)
      .max(2000),
    reason: z
      .string()
      .trim()
      .min(1, "Motivo de revisão obrigatório.")
      .max(2000),
  })
  .strict();
export type TemplateClinicalRevisionInput = z.infer<
  typeof templateClinicalRevisionInputSchema
>;
export interface TemplateClinicalRevisionAudit {
  reason: string;
  parentProtocolId: string;
  priorHash: string;
  authorUserId: number;
  /** UTC milliseconds since Unix epoch. */
  timestamp: number;
  previous?: unknown;
}
function assertOwnedTemplate(
  row: CustomProtocol | undefined,
  id: number,
  userId: number
): asserts row is CustomProtocol & {
  clinicalDocument: Record<string, unknown>;
  clinicalPackage: Record<string, unknown>;
} {
  if (!row || row.id !== id || row.userId !== userId)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Template não encontrado para este usuário.",
    });
  if (
    !row.clinicalDocument ||
    row.clinicalPackage?.version !== USER_TEMPLATE_VERSION ||
    !isActiveTemplateDocument(row.clinicalDocument)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Somente templates ativos do usuário permitem revisão clínica; fontes/rascunhos permanecem somente consulta.",
    });
  if (row.isActive !== 1)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Esta versão já foi arquivada. Reabra a versão ativa.",
    });
}
const badRequest = (error: unknown): never => {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      error instanceof Error ? error.message : "Documento/revisão inválidos.",
    cause: error,
  });
};
function assertUserId(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new TRPCError({ code: "UNAUTHORIZED" });
}
async function requireDatabase() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco indisponível; nenhuma revisão foi salva.",
    });
  return db;
}
export async function prepareTemplateClinicalRevision(
  id: number,
  userId: number
) {
  assertUserId(userId);
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return badRequest(parsed.error);
  const db = await requireDatabase();
  const [row] = await db
    .select()
    .from(customProtocols)
    .where(and(eq(customProtocols.id, id), eq(customProtocols.userId, userId)))
    .limit(1);
  assertOwnedTemplate(row, id, userId);
  try {
    exportProtocolPackage([row]);
    return {
      id: row.id,
      name: row.name,
      expectedHash: protocolContentSha256(row.clinicalDocument),
      fields: listTemplateClinicalFields(row.clinicalDocument),
    };
  } catch (error) {
    return badRequest(error);
  }
}

/** Owner + full-document hash guarded revision. Never writes prescriptions, sources or snapshots. */
export async function reviseTemplateClinical(
  input: TemplateClinicalRevisionInput,
  userId: number
) {
  assertUserId(userId);
  const parsed = templateClinicalRevisionInputSchema.safeParse(input);
  if (!parsed.success) return badRequest(parsed.error);
  const { id, expectedHash, changes, reason } = parsed.data;
  const db = await requireDatabase();
  return db.transaction(async tx => {
    // Do not filter isActive here: after waiting for the row lock a concurrent revision conflicts.
    const [row] = await tx
      .select()
      .from(customProtocols)
      .where(
        and(eq(customProtocols.id, id), eq(customProtocols.userId, userId))
      )
      .limit(1)
      .for("update");
    assertOwnedTemplate(row, id, userId);
    const priorHash = protocolContentSha256(row.clinicalDocument);
    if (priorHash !== expectedHash)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "O conteúdo foi alterado. Reabra o editor; nenhuma alteração foi sobrescrita.",
      });
    let revision: TemplateClinicalRevisionAudit = {
      reason,
      parentProtocolId: row.protocolId,
      priorHash,
      authorUserId: userId,
      timestamp: Date.now(),
    };
    let next;
    try {
      const document = applyTemplateClinicalChanges(
        row.clinicalDocument,
        changes
      );
      if (document.templateClinicalRevision !== undefined)
        revision = { ...revision, previous: document.templateClinicalRevision };
      document.templateClinicalRevision = revision;
      // Sole existing identity/validation contract, including integrity of preserved source/envelope.
      [next] = convertImportToDbRecords(
        exportProtocolPackage([{ ...row, clinicalDocument: document }]),
        userId,
        { isSystem: 0 }
      );
      if (!next || !next.protocolId || next.protocolId === row.protocolId)
        throw Error("A revisão precisa produzir identidade nova e distinta.");
    } catch (error) {
      return badRequest(error);
    }
    const [insert] = await tx.insert(customProtocols).values(next);
    if (!Number.isSafeInteger(insert.insertId) || insert.insertId <= 0)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Não foi possível confirmar a nova identidade; transação revertida.",
      });
    const [archived] = await tx
      .update(customProtocols)
      .set({ isActive: 0 })
      .where(
        and(
          eq(customProtocols.id, id),
          eq(customProtocols.userId, userId),
          eq(customProtocols.isActive, 1)
        )
      );
    if (archived.affectedRows !== 1)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Não foi possível arquivar a versão anterior; transação revertida.",
      });
    return { id: insert.insertId, protocolId: next.protocolId, revision };
  });
}
export const templateClinicalRevisionRouter = router({
  prepare: protectedProcedure
    .input(z.object({ id: idSchema }).strict())
    .query(({ input, ctx }) =>
      prepareTemplateClinicalRevision(input.id, ctx.user.id)
    ),
  update: protectedProcedure
    .input(templateClinicalRevisionInputSchema)
    .mutation(({ input, ctx }) => reviseTemplateClinical(input, ctx.user.id)),
});
