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
