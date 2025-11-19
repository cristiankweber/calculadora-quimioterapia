import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de pacientes
 * Armazena informações demográficas e clínicas dos pacientes
 */
export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // ID do usuário que criou o registro
  name: varchar("name", { length: 255 }).notNull(),
  age: int("age").notNull(),
  sex: mysqlEnum("sex", ["M", "F"]).notNull(),
  weight: int("weight").notNull(), // kg
  height: int("height").notNull(), // cm
  creatinine: int("creatinine").notNull(), // mg/dL * 100 (armazenado como int para evitar problemas de precisão)
  bilirubin: int("bilirubin").notNull(), // mg/dL * 100
  ecog: int("ecog").notNull(), // 0-4
  comorbidities: text("comorbidities"),
  // Doses cumulativas de antraciclinas (mg/m²)
  cumulativeDoxorubicin: int("cumulativeDoxorubicin").default(0),
  cumulativeDaunorubicin: int("cumulativeDaunorubicin").default(0),
  cumulativeIdarubicin: int("cumulativeIdarubicin").default(0),
  cumulativeEpirubicin: int("cumulativeEpirubicin").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;

/**
 * Tabela de prescrições
 * Armazena cada prescrição gerada com todos os detalhes
 */
export const prescriptions = mysqlTable("prescriptions", {
  id: int("id").autoincrement().primaryKey(),
  prescriptionId: varchar("prescriptionId", { length: 64 }).notNull().unique(), // ID único para rastreabilidade
  userId: int("userId").notNull(), // Prescritor
  patientId: int("patientId").notNull(),
  patientName: varchar("patientName", { length: 255 }).notNull(),
  protocolId: varchar("protocolId", { length: 64 }).notNull(),
  protocolName: varchar("protocolName", { length: 255 }).notNull(),
  cycle: int("cycle").notNull(),
  // Valores calculados
  bsa: int("bsa").notNull(), // m² * 1000
  egfr: int("egfr").notNull(), // mL/min/1.73m²
  renalStatus: mysqlEnum("renalStatus", ["green", "yellow", "red"]).notNull(),
  // Drogas (JSON array)
  drugs: json("drugs").notNull(), // Array<Drug>
  // Profilaxias (JSON)
  antiemetics: json("antiemetics").notNull(), // AntiemeticProphylaxis
  prophylaxis: json("prophylaxis").notNull(), // string[]
  alerts: json("alerts").notNull(), // string[]
  // Ajustes aplicados
  adjustmentFactor: int("adjustmentFactor").notNull(), // * 100
  toxicityAdjustment: json("toxicityAdjustment"), // Record<string, ToxicityGrade>
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Prescription = typeof prescriptions.$inferSelect;
export type InsertPrescription = typeof prescriptions.$inferInsert;

/**
 * Tabela de estatísticas de uso
 * Registra cada vez que um protocolo é usado
 */
export const protocolUsage = mysqlTable("protocol_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  protocolId: varchar("protocolId", { length: 64 }).notNull(),
  protocolName: varchar("protocolName", { length: 255 }).notNull(),
  indication: varchar("indication", { length: 255 }),
  usedAt: timestamp("usedAt").defaultNow().notNull(),
});

export type ProtocolUsage = typeof protocolUsage.$inferSelect;
export type InsertProtocolUsage = typeof protocolUsage.$inferInsert;

/**
 * Tabela de configurações institucionais
 * Armazena configurações personalizadas por usuário/instituição
 */
export const institutionSettings = mysqlTable("institution_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  institutionName: varchar("institutionName", { length: 255 }),
  institutionLogo: text("institutionLogo"), // URL da imagem
  prescriberName: varchar("prescriberName", { length: 255 }),
  prescriberCRM: varchar("prescriberCRM", { length: 64 }),
  prescriberSpecialty: varchar("prescriberSpecialty", { length: 255 }),
  headerTemplate: text("headerTemplate"), // Template customizado para cabeçalho
  footerTemplate: text("footerTemplate"), // Template customizado para rodapé
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InstitutionSettings = typeof institutionSettings.$inferSelect;
export type InsertInstitutionSettings = typeof institutionSettings.$inferInsert;