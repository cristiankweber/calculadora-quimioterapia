import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal } from "drizzle-orm/mysql-core";

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
  creatinine: decimal("creatinine", { precision: 6, scale: 2 }).notNull(), // mg/dL (valor real, ex: 1.20)
  bilirubin: decimal("bilirubin", { precision: 6, scale: 2 }).notNull(), // mg/dL (valor real, ex: 0.80)
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
  prescriptionId: varchar("prescriptionId", { length: 64 }).notNull().unique(), // ID único para rastreabilidade (QR code)
  userId: int("userId").notNull(), // Prescritor
  patientId: int("patientId").notNull(),
  patientName: varchar("patientName", { length: 255 }).notNull(),
  protocolName: varchar("protocolName", { length: 255 }).notNull(),
  cycle: int("cycle").notNull(),
  // Valores calculados
  bsa: decimal("bsa", { precision: 6, scale: 2 }).notNull(), // m² (ex: 1.85)
  egfr: decimal("egfr", { precision: 6, scale: 2 }).notNull(), // mL/min/1.73m² (ex: 60.00)
  renalStatus: varchar("renalStatus", { length: 20 }).notNull(),
  // Dados completos em JSON
  prescriptionData: json("prescriptionData").notNull(), // Todos os dados da prescrição
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
 * Tabela de alertas de toxicidade registrados
 * Rastreia toxicidades reportadas durante prescrições
 */
export const toxicityAlerts = mysqlTable("toxicity_alerts", {
  id: int("id").autoincrement().primaryKey(),
  prescriptionId: int("prescriptionId").notNull(),
  userId: int("userId").notNull(),
  toxicityType: varchar("toxicityType", { length: 100 }).notNull(),
  toxicityGrade: int("toxicityGrade").notNull(), // 0-5 (CTCAE)
  doseAdjustment: varchar("doseAdjustment", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ToxicityAlert = typeof toxicityAlerts.$inferSelect;
export type InsertToxicityAlert = typeof toxicityAlerts.$inferInsert;

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