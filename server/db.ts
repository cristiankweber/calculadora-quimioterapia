import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  patients,
  InsertPatient,
  Patient,
  prescriptions,
  InsertPrescription,
  Prescription,
  protocolUsage,
  InsertProtocolUsage,
  institutionSettings,
  InsertInstitutionSettings,
  InstitutionSettings,
  customProtocols,
  CustomProtocol,
  InsertCustomProtocol,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── Conexão com o banco ────────────────────────────────────────────────────

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Obtém instância do Drizzle, criando-a sob demanda.
 * Em caso de falha, loga e retorna null (graceful degradation).
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.error("[Database] Falha ao conectar:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Obtém instância do Drizzle ou lança exceção.
 * Usar em operações de escrita onde falha silenciosa é inaceitável.
 */
async function requireDb(): Promise<ReturnType<typeof drizzle>> {
  const db = await getDb();
  if (!db) {
    throw new Error(
      "[Database] Banco de dados indisponível. Verifique DATABASE_URL."
    );
  }
  return db;
}

// ─── Usuários ───────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Pacientes ──────────────────────────────────────────────────────────────

export async function createPatient(
  patient: InsertPatient
): Promise<Patient> {
  const db = await requireDb();

  const result = await db.insert(patients).values(patient);
  const insertedId = result[0].insertId;

  const inserted = await db
    .select()
    .from(patients)
    .where(eq(patients.id, insertedId))
    .limit(1);
  return inserted[0]!;
}

export async function getPatientsByUserId(
  userId: number
): Promise<Patient[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .orderBy(desc(patients.updatedAt));
}

export async function getPatientById(
  id: number
): Promise<Patient | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);
  return result[0];
}

export async function updatePatient(
  id: number,
  data: Partial<InsertPatient>
): Promise<void> {
  const db = await requireDb();
  await db.update(patients).set(data).where(eq(patients.id, id));
}

export async function deletePatient(id: number): Promise<void> {
  const db = await requireDb();
  await db.delete(patients).where(eq(patients.id, id));
}

// ─── Prescrições ────────────────────────────────────────────────────────────

export async function createPrescription(
  prescription: InsertPrescription
): Promise<Prescription> {
  const db = await requireDb();

  const result = await db.insert(prescriptions).values(prescription);
  const insertedId = result[0].insertId;

  const inserted = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.id, insertedId))
    .limit(1);
  return inserted[0]!;
}

export async function getPrescriptionsByUserId(
  userId: number,
  limit = 50
): Promise<Prescription[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.userId, userId))
    .orderBy(desc(prescriptions.createdAt))
    .limit(limit);
}

export async function getPrescriptionsByPatientId(
  patientId: number
): Promise<Prescription[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.patientId, patientId))
    .orderBy(desc(prescriptions.createdAt));
}

export async function getPrescriptionById(
  id: number
): Promise<Prescription | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.id, id))
    .limit(1);
  return result[0];
}

export async function getPrescriptionByPrescriptionId(
  prescriptionId: string
): Promise<Prescription | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.prescriptionId, prescriptionId))
    .limit(1);
  return result[0];
}

// ─── Estatísticas ───────────────────────────────────────────────────────────

export async function recordProtocolUsage(
  usage: InsertProtocolUsage
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(protocolUsage).values(usage);
}

export async function getProtocolUsageStats(userId?: number) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(protocolUsage);

  if (userId) {
    query = query.where(eq(protocolUsage.userId, userId)) as any;
  }

  const results = await query
    .orderBy(desc(protocolUsage.usedAt))
    .limit(100);
  return results;
}

// ─── Configurações Institucionais ───────────────────────────────────────────

export async function getInstitutionSettings(
  userId: number
): Promise<InstitutionSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(institutionSettings)
    .where(eq(institutionSettings.userId, userId))
    .limit(1);
  return result[0];
}

export async function upsertInstitutionSettings(
  userId: number,
  settings: Partial<InsertInstitutionSettings>
): Promise<void> {
  const db = await requireDb();

  const values: InsertInstitutionSettings = {
    userId,
    ...settings,
  };

  await db
    .insert(institutionSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: settings,
    });
}

// ─── Estatísticas Avançadas ─────────────────────────────────────────────────

export async function getTopProtocols(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(protocolUsage)
    .where(eq(protocolUsage.userId, userId))
    .orderBy(desc(protocolUsage.usedAt));

  const counts = new Map<string, { name: string; count: number }>();

  for (const usage of results) {
    const current = counts.get(usage.protocolId) || {
      name: usage.protocolName,
      count: 0,
    };
    current.count++;
    counts.set(usage.protocolId, current);
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getProtocolsByIndication(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(protocolUsage)
    .where(eq(protocolUsage.userId, userId))
    .orderBy(desc(protocolUsage.usedAt));

  const byIndication = new Map<string, number>();

  for (const usage of results) {
    const indication = usage.indication || "Não especificada";
    byIndication.set(indication, (byIndication.get(indication) || 0) + 1);
  }

  return Array.from(byIndication.entries()).map(([indication, count]) => ({
    indication,
    count,
  }));
}

export async function getToxicityStats(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Será implementado quando toxicidades forem registradas
  return [];
}

export async function getPrescriptionTrends(userId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const results = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.userId, userId))
    .orderBy(desc(prescriptions.createdAt));

  const byDay = new Map<string, number>();

  for (const prescription of results) {
    if (prescription.createdAt < cutoffDate) continue;

    const dateKey = prescription.createdAt.toISOString().split("T")[0];
    byDay.set(dateKey, (byDay.get(dateKey) || 0) + 1);
  }

  return Array.from(byDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Protocolos Customizados ───────────────────────────────────────────────

export async function createCustomProtocol(
  data: InsertCustomProtocol
): Promise<CustomProtocol> {
  const db = await requireDb();
  const result = await db.insert(customProtocols).values(data);
  const insertedId = result[0].insertId;
  const inserted = await db
    .select()
    .from(customProtocols)
    .where(eq(customProtocols.id, insertedId))
    .limit(1);
  return inserted[0]!;
}

export async function getCustomProtocolsByUserId(
  userId: number
): Promise<CustomProtocol[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(customProtocols)
    .where(eq(customProtocols.userId, userId))
    .orderBy(desc(customProtocols.updatedAt));
}

export async function getCustomProtocolById(
  id: number
): Promise<CustomProtocol | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(customProtocols)
    .where(eq(customProtocols.id, id))
    .limit(1);
  return result[0];
}

export async function getActiveCustomProtocolsByUserId(
  userId: number
): Promise<CustomProtocol[]> {
  const db = await getDb();
  if (!db) return [];
  const all = await db
    .select()
    .from(customProtocols)
    .where(eq(customProtocols.userId, userId))
    .orderBy(desc(customProtocols.updatedAt));
  return all.filter((p) => p.isActive === 1);
}

export async function updateCustomProtocol(
  id: number,
  data: Partial<InsertCustomProtocol>
): Promise<void> {
  const db = await requireDb();
  await db.update(customProtocols).set(data).where(eq(customProtocols.id, id));
}

export async function deleteCustomProtocol(id: number): Promise<void> {
  const db = await requireDb();
  // Soft delete
  await db
    .update(customProtocols)
    .set({ isActive: 0 })
    .where(eq(customProtocols.id, id));
}

export async function hardDeleteCustomProtocol(id: number): Promise<void> {
  const db = await requireDb();
  await db.delete(customProtocols).where(eq(customProtocols.id, id));
}

export async function getStatsOverview(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      totalPrescriptions: 0,
      totalPatients: 0,
      totalProtocols: 0,
      recentActivity: 0,
    };
  }

  const [prescriptionsList, patientsList, protocolsList] = await Promise.all([
    db.select().from(prescriptions).where(eq(prescriptions.userId, userId)),
    db.select().from(patients).where(eq(patients.userId, userId)),
    db.select().from(protocolUsage).where(eq(protocolUsage.userId, userId)),
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentActivity = prescriptionsList.filter(
    (p) => p.createdAt >= sevenDaysAgo
  ).length;

  const uniqueProtocols = new Set(protocolsList.map((p) => p.protocolId));

  return {
    totalPrescriptions: prescriptionsList.length,
    totalPatients: patientsList.length,
    totalProtocols: uniqueProtocols.size,
    recentActivity,
  };
}
