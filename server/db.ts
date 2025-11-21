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
  InstitutionSettings
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

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
      values.role = 'admin';
      updateSet.role = 'admin';
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

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Funções de Pacientes =====

export async function createPatient(patient: InsertPatient): Promise<Patient> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(patients).values(patient);
  const insertedId = result[0].insertId;
  
  const inserted = await db.select().from(patients).where(eq(patients.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getPatientsByUserId(userId: number): Promise<Patient[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(patients).where(eq(patients.userId, userId)).orderBy(desc(patients.updatedAt));
}

export async function getPatientById(id: number): Promise<Patient | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  return result[0];
}

export async function updatePatient(id: number, data: Partial<InsertPatient>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(patients).set(data).where(eq(patients.id, id));
}

export async function deletePatient(id: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(patients).where(eq(patients.id, id));
}

// ===== Funções de Prescrições =====

export async function createPrescription(prescription: InsertPrescription): Promise<Prescription> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(prescriptions).values(prescription);
  const insertedId = result[0].insertId;
  
  const inserted = await db.select().from(prescriptions).where(eq(prescriptions.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getPrescriptionsByUserId(userId: number, limit = 50): Promise<Prescription[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(prescriptions).where(eq(prescriptions.userId, userId)).orderBy(desc(prescriptions.createdAt)).limit(limit);
}

export async function getPrescriptionsByPatientId(patientId: number): Promise<Prescription[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(prescriptions).where(eq(prescriptions.patientId, patientId)).orderBy(desc(prescriptions.createdAt));
}

export async function getPrescriptionById(id: number): Promise<Prescription | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1);
  return result[0];
}

export async function getPrescriptionByPrescriptionId(prescriptionId: string): Promise<Prescription | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(prescriptions).where(eq(prescriptions.prescriptionId, prescriptionId)).limit(1);
  return result[0];
}

// ===== Funções de Estatísticas =====

export async function recordProtocolUsage(usage: InsertProtocolUsage): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db.insert(protocolUsage).values(usage);
}

export async function getProtocolUsageStats(userId?: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Retorna estatísticas agregadas de uso de protocolos
  // Se userId for fornecido, filtra por usuário
  let query = db.select().from(protocolUsage);
  
  if (userId) {
    query = query.where(eq(protocolUsage.userId, userId)) as any;
  }

  const results = await query.orderBy(desc(protocolUsage.usedAt)).limit(100);
  return results;
}

// ===== Funções de Configurações Institucionais =====

export async function getInstitutionSettings(userId: number): Promise<InstitutionSettings | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(institutionSettings).where(eq(institutionSettings.userId, userId)).limit(1);
  return result[0];
}

export async function upsertInstitutionSettings(userId: number, settings: Partial<InsertInstitutionSettings>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const values: InsertInstitutionSettings = {
    userId,
    ...settings,
  };

  await db.insert(institutionSettings).values(values).onDuplicateKeyUpdate({
    set: settings,
  });
}

// ===== Funções de Estatísticas Avançadas =====

export async function getTopProtocols(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Agrupa protocolos por nome e conta quantas vezes foram usados
  const results = await db
    .select()
    .from(protocolUsage)
    .where(eq(protocolUsage.userId, userId))
    .orderBy(desc(protocolUsage.usedAt));

  // Agregar manualmente (Drizzle não tem GROUP BY nativo em todos os dialetos)
  const counts = new Map<string, { name: string; count: number }>();
  
  for (const usage of results) {
    const current = counts.get(usage.protocolId) || { name: usage.protocolName, count: 0 };
    current.count++;
    counts.set(usage.protocolId, current);
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getProtocolsByIndication(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const results = await db
    .select()
    .from(protocolUsage)
    .where(eq(protocolUsage.userId, userId))
    .orderBy(desc(protocolUsage.usedAt));

  // Agregar por indicação
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
  if (!db) {
    return [];
  }

  // Por enquanto retorna array vazio - será implementado quando toxicidades forem registradas
  // No futuro, buscar da tabela toxicityAlerts
  return [];
}

export async function getPrescriptionTrends(userId: number, days = 30) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Buscar prescrições dos últimos N dias
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const results = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.userId, userId))
    .orderBy(desc(prescriptions.createdAt));

  // Filtrar por data e agregar por dia
  const byDay = new Map<string, number>();
  
  for (const prescription of results) {
    if (prescription.createdAt < cutoffDate) continue;
    
    const dateKey = prescription.createdAt.toISOString().split('T')[0];
    byDay.set(dateKey, (byDay.get(dateKey) || 0) + 1);
  }

  return Array.from(byDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
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

  // Contar atividade recente (últimos 7 dias)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentActivity = prescriptionsList.filter(
    p => p.createdAt >= sevenDaysAgo
  ).length;

  // Contar protocolos únicos
  const uniqueProtocols = new Set(protocolsList.map(p => p.protocolId));

  return {
    totalPrescriptions: prescriptionsList.length,
    totalPatients: patientsList.length,
    totalProtocols: uniqueProtocols.size,
    recentActivity,
  };
}
