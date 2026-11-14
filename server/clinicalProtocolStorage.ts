import { and, eq, inArray } from "drizzle-orm";
import { customProtocols, users, type InsertCustomProtocol } from "../drizzle/schema";
import library from "../shared/data/clinicalProtocols.json";
import { getDb } from "./db";
import {
  convertImportToDbRecords,
  exportProtocolPackage,
  parseProtocolImport,
  type AnyProtocolExport,
} from "./seedSystemProtocols";

export const CLINICAL_LIBRARY_SOURCE_SHA256 = "3eb9e462aac5359ac42016d25ef3280517a5784ce78604c6334f75a73201fbe8";

function assertUserId(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Usuário autenticado válido é obrigatório.");
}
async function requireClinicalDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível; nenhum protocolo foi persistido.");
  return db;
}

/**
 * Serializes imports for the authenticated owner using their existing users row.
 * All batches commit atomically. No upsert/update: personalized/legacy records stay intact.
 * A same-version content revision gets a distinct SHA-256 identity in the converter.
 */
export async function persistClinicalProtocolRecords(userId: number, records: InsertCustomProtocol[]) {
  assertUserId(userId);
  if (records.some(record => record.userId !== userId)) throw new Error("Registro não pertence ao usuário autenticado.");
  // Direct callers receive the same policy/JSON checks as the string importer.
  exportProtocolPackage(records);
  const db = await requireClinicalDb();
  return db.transaction(async tx => {
    const owner = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!owner.length) throw new Error("Usuário autenticado não encontrado; sincronização não executada.");
    const existing = await tx.select().from(customProtocols).where(eq(customProtocols.userId, userId));
    for (const incoming of records) {
      if (incoming.clinicalPackage?.version !== "1.0") continue;
      const document = incoming.clinicalDocument;
      const downgrade = existing.some(record => {
        if (record.clinicalPackage?.version !== "2.1-source-reconciled-clinical-draft" || !record.clinicalDocument) return false;
        return (document?.id !== undefined && record.clinicalDocument.id === document.id)
          || record.protocolId === incoming.protocolId || record.name === incoming.name;
      });
      if (downgrade) throw new Error("Importação legada não pode remover a política de um protocolo clínico enriquecido.");
    }
    const known = new Set(existing.map(record => record.protocolId));
    const additions = records.filter(record => {
      if (known.has(record.protocolId)) return false;
      known.add(record.protocolId);
      return true;
    });
    for (let index = 0; index < additions.length; index += 10) {
      await tx.insert(customProtocols).values(additions.slice(index, index + 10));
    }
    return { imported: additions.length, skipped: records.length - additions.length, total: records.length };
  });
}

/** Explicit user action only. Raw source JSON is validated/preserved; never globally seeded. */
export async function syncClinicalLibrary(userId: number) {
  const records = convertImportToDbRecords(library as AnyProtocolExport, userId, { isSystem: 1 });
  const result = await persistClinicalProtocolRecords(userId, records);
  return { ...result, version: library.version, sourceSha256: CLINICAL_LIBRARY_SOURCE_SHA256 };
}

export async function importClinicalProtocols(userId: number, jsonData: string) {
  const data = parseProtocolImport(jsonData);
  return persistClinicalProtocolRecords(userId, convertImportToDbRecords(data, userId));
}

/** All exports use document/envelope JSON; clinical records cannot be demoted to legacy fields. */
export async function exportClinicalProtocols(userId: number, ids?: number[]): Promise<AnyProtocolExport> {
  assertUserId(userId);
  if (ids && (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0))) {
    throw new Error("Selecione identificadores de protocolo válidos.");
  }
  const db = await requireClinicalDb();
  const uniqueIds = ids ? Array.from(new Set(ids)) : undefined;
  const owned = await db.select().from(customProtocols).where(uniqueIds
    ? and(eq(customProtocols.userId, userId), inArray(customProtocols.id, uniqueIds))
    : and(eq(customProtocols.userId, userId), eq(customProtocols.isActive, 1)));
  // Deliberately fail the complete selection, rather than exporting a partial unauthorized list.
  if (uniqueIds && owned.length !== uniqueIds.length) throw new Error("Protocolo não encontrado ou sem permissão.");
  return exportProtocolPackage(owned);
}
