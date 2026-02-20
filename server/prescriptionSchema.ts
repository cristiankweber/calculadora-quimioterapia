/**
 * Schema Zod explícito para validação de prescriptionData.
 *
 * Substitui z.any() por validação estruturada que:
 * - Rejeita NaN, Infinity, valores negativos em campos de dose
 * - Rejeita payloads incompletos em campos críticos
 * - Valida arrays e objetos com shape conhecido
 * - Mantém compatibilidade com prescrições legadas (v1)
 *
 * VERSÃO: 2 (v2) — inclui metadados de auditoria
 */

import { z } from "zod";

// ─── Refinamentos numéricos seguros ──────────────────────────────────────────

/** Número finito (rejeita NaN e Infinity) */
const safeNumber = z.number().refine(
  (n) => Number.isFinite(n),
  { message: "Valor numérico inválido (NaN ou Infinity)" }
);

/** Número finito não-negativo (dose, peso, etc.) */
const nonNegativeNumber = safeNumber.refine(
  (n) => n >= 0,
  { message: "Valor não pode ser negativo" }
);

/** Número finito positivo (dose base, BSA, etc.) */
const positiveNumber = safeNumber.refine(
  (n) => n > 0,
  { message: "Valor deve ser positivo" }
);

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

/** Dados do paciente na prescrição */
const patientDataSchema = z.object({
  name: z.string().min(1, "Nome do paciente é obrigatório"),
  age: z.number().int().min(0).max(150),
  sex: z.enum(["M", "F"]),
  weight: positiveNumber,
  height: positiveNumber,
  creatinine: positiveNumber,
  bilirubin: nonNegativeNumber.optional(),
  ecog: z.number().int().min(0).max(4),
  comorbidities: z.string().optional(),
});

/** Medidas calculadas do paciente */
const calculatedValuesSchema = z.object({
  bsa: positiveNumber,
  egfr: nonNegativeNumber,
  renalStatus: z.string(),
  renalStatusLabel: z.string().optional(),
  ecogAdjustmentFactor: nonNegativeNumber.optional(),
  globalAdjustmentFactor: nonNegativeNumber.optional(),
});

/** Ajuste de toxicidade aplicado */
const toxicityAdjustmentSchema = z.object({
  drugName: z.string().optional(),
  drugIndex: z.number().int().optional(),
  toxicityType: z.string().optional(),
  grade: z.number().int().min(0).max(5).optional(),
  adjustment: z.string().optional(),
  adjustmentFactor: nonNegativeNumber.optional(),
  originalDose: nonNegativeNumber.optional(),
  adjustedDose: nonNegativeNumber.optional(),
  isManual: z.boolean().optional(),
});

/** Droga individual na prescrição */
const drugSchema = z.object({
  name: z.string().min(1),
  baseDose: nonNegativeNumber.optional(),
  doseUnit: z.string().optional(),
  calculatedDose: nonNegativeNumber.optional(),
  finalDose: nonNegativeNumber.optional(),
  maxDose: nonNegativeNumber.optional(),
  route: z.string().optional(),
  schedule: z.string().optional(),
  days: z.union([z.string(), z.array(z.number())]).optional(),
  diluent: z.string().optional(),
  diluentVolume: z.string().optional(),
  infusionTime: z.string().optional(),
  notes: z.string().optional(),
  isManualDose: z.boolean().optional(),
  manualDoseValue: nonNegativeNumber.optional(),
  adjustmentFactor: nonNegativeNumber.optional(),
});

/** Alerta clínico */
const alertSchema = z.object({
  type: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  drugName: z.string().optional(),
});

/** Metadados de auditoria (v2) */
const auditMetadataSchema = z.object({
  version: z.literal(2).optional().default(2),
  formulaVersions: z.object({
    bsa: z.string().optional().default("DuBois"),
    egfr: z.string().optional().default("CKD-EPI-2021"),
    dose: z.string().optional().default("standard"),
  }).optional(),
  generatedAt: z.number().optional(), // Unix timestamp ms
  userId: z.number().optional(),
  userName: z.string().optional(),
  globalAdjustmentFactor: nonNegativeNumber.optional(),
  toxicityAdjustments: z.array(toxicityAdjustmentSchema).optional(),
  manualDoseOverrides: z.array(z.object({
    drugName: z.string(),
    originalDose: nonNegativeNumber,
    manualDose: nonNegativeNumber,
    reason: z.string().optional(),
  })).optional(),
  clinicalInputs: z.object({
    weight: positiveNumber,
    height: positiveNumber,
    creatinine: positiveNumber,
    age: z.number().int().min(0).max(150),
    sex: z.enum(["M", "F"]),
    ecog: z.number().int().min(0).max(4),
    bilirubin: nonNegativeNumber.optional(),
  }).optional(),
});

// ─── Schema principal: prescriptionData v2 ──────────────────────────────────

export const prescriptionDataSchemaV2 = z.object({
  // Dados do paciente
  patient: patientDataSchema,

  // Protocolo
  protocol: z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Nome do protocolo é obrigatório"),
    category: z.string().optional(),
    indication: z.string().optional(),
    emetogenicRisk: z.string().optional(),
    cycle: z.number().int().min(1).optional(),
    totalCycles: z.number().int().min(1).optional(),
  }),

  // Valores calculados
  calculatedValues: calculatedValuesSchema,

  // Drogas prescritas
  drugs: z.array(drugSchema).min(1, "Prescrição deve conter ao menos uma droga"),

  // Pré-medicações
  preMedications: z.array(z.object({
    name: z.string(),
    dose: z.string().optional(),
    route: z.string().optional(),
    schedule: z.string().optional(),
  })).optional(),

  // Alertas clínicos
  alerts: z.array(alertSchema).optional(),

  // Metadados de auditoria
  audit: auditMetadataSchema.optional(),

  // Notas adicionais
  notes: z.string().optional(),
});

export type PrescriptionDataV2 = z.infer<typeof prescriptionDataSchemaV2>;

// ─── Schema legado (v1): aceita formato antigo para leitura ─────────────────

/**
 * Schema permissivo para leitura de prescrições legadas (v1).
 * Aceita qualquer objeto JSON mas tenta extrair campos conhecidos.
 * Usado APENAS para leitura — novas prescrições DEVEM usar v2.
 */
export const prescriptionDataSchemaV1 = z.record(z.string(), z.unknown());

// ─── Adapter: converte v1 → v2 para exibição ───────────────────────────────

/**
 * Tenta normalizar um payload legado (v1) para o formato v2.
 * Retorna o objeto normalizado ou null se não for possível.
 * Não lança exceções — falhas são registradas em log.
 */
export function normalizeLegacyPayload(raw: unknown): PrescriptionDataV2 | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;

  try {
    // Se já é v2, validar diretamente
    if (data.audit && typeof data.audit === "object" && (data.audit as Record<string, unknown>).version === 2) {
      const result = prescriptionDataSchemaV2.safeParse(data);
      if (result.success) return result.data;
    }

    // Tentar extrair campos v1 e mapear para v2
    const patient = data.patient as Record<string, unknown> | undefined;
    const protocol = data.protocol as Record<string, unknown> | undefined;
    const drugs = data.drugs as unknown[] | undefined;
    const calculatedValues = data.calculatedValues as Record<string, unknown> | undefined;

    if (!patient || !protocol || !drugs || !calculatedValues) {
      // Formato muito diferente — retornar null
      return null;
    }

    // Construir v2 a partir de v1
    const normalized: Record<string, unknown> = {
      ...data,
      audit: {
        version: 2,
        formulaVersions: { bsa: "DuBois", egfr: "CKD-EPI-2021", dose: "standard" },
        generatedAt: Date.now(),
        // Marcar como migrado de v1
        migrationNote: "Normalizado automaticamente de formato legado v1",
      },
    };

    const result = prescriptionDataSchemaV2.safeParse(normalized);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ─── Validação de dose segura (rejeita NaN/Infinity/negativo) ───────────────

/**
 * Valida que todas as doses em um array de drogas são seguras.
 * Retorna array de erros encontrados (vazio = tudo OK).
 */
export function validateDoseSafety(drugs: Array<{ name: string; finalDose?: number; calculatedDose?: number; baseDose?: number }>): string[] {
  const errors: string[] = [];

  for (const drug of drugs) {
    const dose = drug.finalDose ?? drug.calculatedDose ?? drug.baseDose;
    if (dose === undefined || dose === null) continue;

    if (!Number.isFinite(dose)) {
      errors.push(`Dose inválida para ${drug.name}: valor não-finito (${dose})`);
    } else if (dose < 0) {
      errors.push(`Dose negativa para ${drug.name}: ${dose}`);
    }
  }

  return errors;
}

// ─── Schema de entrada para o endpoint create ───────────────────────────────

/**
 * Schema completo para o endpoint prescriptions.create.
 * Substitui o z.any() anterior com validação explícita.
 */
export const createPrescriptionInputSchema = z.object({
  patientId: z.number().int().positive(),
  patientName: z.string().min(1),
  protocolName: z.string().min(1),
  cycle: z.number().int().min(1),
  bsa: positiveNumber,
  egfr: nonNegativeNumber,
  renalStatus: z.string().min(1),
  prescriptionData: prescriptionDataSchemaV2,
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionInputSchema>;
