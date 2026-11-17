import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { customProtocols, type CustomProtocol } from "../drizzle/schema";
import {
  applyTemplateDoseChanges,
  listTemplateDoseFields,
} from "../shared/clinicalProtocols/templateDoseRevision";
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
export const templateDoseRevisionInputSchema = z
  .object({
    id: idSchema,
    expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
    changes: z
      .array(
        z
          .object({
            path: z.array(z.string().min(1).max(255)).min(1).max(64),
            dose: z.number().finite().positive(),
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
export type TemplateDoseRevisionInput = z.infer<
  typeof templateDoseRevisionInputSchema
>;
export interface TemplateDoseRevisionAudit {
  reason: string;
  parentProtocolId: string;
  priorHash: string;
  authorUserId: number;
  timestamp: number;
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
        "Somente templates do usuário permitem esta revisão; rascunhos permanecem somente consulta.",
    });
  if (row.isActive !== 1)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Esta versão já foi arquivada. Reabra a versão ativa e revise as doses.",
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
async function requireDatabase() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco indisponível; nenhuma revisão foi salva.",
    });
  return db;
}
function assertUserId(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new TRPCError({ code: "UNAUTHORIZED" });
}

/** Browser receives server's full-document hash, never node:crypto or a client-computed partial hash. */
export async function prepareTemplateDoseRevision(id: number, userId: number) {
  assertUserId(userId);
  idSchema.parse(id);
  const db = await requireDatabase();
  const [row] = await db
    .select()
    .from(customProtocols)
    .where(and(eq(customProtocols.id, id), eq(customProtocols.userId, userId)))
    .limit(1);
  assertOwnedTemplate(row, id, userId);
  try {
    // Validate intact source/envelope too; merely resembling an active template is insufficient.
    exportProtocolPackage([row]);
    return {
      id: row.id,
      expectedHash: protocolContentSha256(row.clinicalDocument),
      fields: listTemplateDoseFields(row.clinicalDocument),
    };
  } catch (error) {
    return badRequest(error);
  }
}

/** No prescription/snapshot writes. Insert and old-version soft archive share the row-lock transaction. */
export async function reviseTemplateDoses(
  input: TemplateDoseRevisionInput,
  userId: number
) {
  assertUserId(userId);
  const parsed = templateDoseRevisionInputSchema.safeParse(input);
  if (!parsed.success) return badRequest(parsed.error);
  const { id, expectedHash, changes, reason } = parsed.data;
  const db = await requireDatabase();
  return db.transaction(async tx => {
    // Include owner in the locking query; test again after select to defend an unscoped adapter.
    // Do not filter isActive here: a concurrent revision must report CONFLICT after the lock.
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
          "O conteúdo foi alterado. Reabra o editor; nenhuma dose foi sobrescrita.",
      });
    const revision: TemplateDoseRevisionAudit = {
      reason,
      parentProtocolId: row.protocolId,
      priorHash,
      authorUserId: userId,
      timestamp: Date.now(),
    };
    let next;
    try {
      const document = applyTemplateDoseChanges(row.clinicalDocument, changes);
      // Append chain at the editable root only. All source metadata and prior audit remain intact.
      // A prior templateDoseRevision is retained in the chain instead of overwritten/lost.
      const previous = document.templateDoseRevision;
      document.templateDoseRevision =
        previous === undefined ? revision : { ...revision, previous };
      const candidate = { ...row, clinicalDocument: document };
      // Converter is the sole identity/validation contract; never downgrade to legacy or derive a random id.
      [next] = convertImportToDbRecords(
        exportProtocolPackage([candidate]),
        userId,
        { isSystem: 0 }
      );
      if (!next || !next.protocolId || next.protocolId === row.protocolId)
        throw new Error(
          "A revisão precisa produzir uma identidade nova e distinta."
        );
    } catch (error) {
      return badRequest(error);
    }
    const [insert] = await tx.insert(customProtocols).values(next);
    const newId = insert.insertId;
    if (!Number.isSafeInteger(newId) || newId <= 0)
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
    return {
      id: newId,
      protocolId: next.protocolId,
      revision: documentRevision(next.clinicalDocument, revision),
    };
  });
}
function documentRevision(
  document: unknown,
  fallback: TemplateDoseRevisionAudit
): TemplateDoseRevisionAudit & { previous?: unknown } {
  return (
    ((document as Record<string, unknown>)
      ?.templateDoseRevision as TemplateDoseRevisionAudit & {
      previous?: unknown;
    }) ?? fallback
  );
}

export const templateDoseRevisionRouter = router({
  prepare: protectedProcedure
    .input(z.object({ id: idSchema }).strict())
    .query(({ input, ctx }) =>
      prepareTemplateDoseRevision(input.id, ctx.user.id)
    ),
  update: protectedProcedure
    .input(templateDoseRevisionInputSchema)
    .mutation(({ input, ctx }) => reviseTemplateDoses(input, ctx.user.id)),
});
