import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { predictToxicity, getModelMetrics } from "./toxicityModel";
import {
  createPrescriptionInputSchema,
  validateDoseSafety,
  normalizeLegacyPayload,
  type PrescriptionDataV2,
} from "./prescriptionSchema";
import {
  calculateBSA,
  calculateEGFR,
  classifyRenalFunction,
} from "../shared/clinicalDoseEngine";

// ─── Constantes de validação ────────────────────────────────────────────────

/** Tolerância para divergência BSA/eGFR entre frontend e backend (%) */
const CLINICAL_DIVERGENCE_THRESHOLD = 5;

// ─── Helpers de auditoria ───────────────────────────────────────────────────

/**
 * Registra divergência clínica em log estruturado.
 * Nunca expõe dados sensíveis do paciente — apenas métricas numéricas.
 */
function logClinicalDivergence(
  prescriptionId: string,
  field: string,
  clientValue: number,
  serverValue: number,
  percentDiff: number
) {
  console.warn(
    JSON.stringify({
      level: "WARN",
      event: "clinical_divergence",
      prescriptionId,
      field,
      clientValue: Number(clientValue.toFixed(2)),
      serverValue: Number(serverValue.toFixed(2)),
      percentDiff: Number(percentDiff.toFixed(2)),
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Registra tentativa de persistência bloqueada.
 */
function logBlockedPersistence(
  reason: string,
  prescriptionId: string,
  errors: string[]
) {
  console.error(
    JSON.stringify({
      level: "ERROR",
      event: "blocked_persistence",
      reason,
      prescriptionId,
      errorCount: errors.length,
      // Não logar erros completos para evitar expor dados clínicos
      errorSummary: errors.map((e) => e.substring(0, 80)),
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Enriquece prescriptionData com metadados de auditoria do servidor.
 */
function enrichAuditMetadata(
  data: PrescriptionDataV2,
  userId: number,
  userName: string | null | undefined,
  serverBSA: number,
  serverEGFR: number
): PrescriptionDataV2 {
  return {
    ...data,
    audit: {
      ...data.audit,
      version: 2,
      formulaVersions: {
        bsa: "DuBois",
        egfr: "CKD-EPI-2021",
        dose: "standard",
      },
      generatedAt: Date.now(),
      userId,
      userName: userName ?? undefined,
      globalAdjustmentFactor: data.calculatedValues.globalAdjustmentFactor,
      clinicalInputs: {
        weight: data.patient.weight,
        height: data.patient.height,
        creatinine: data.patient.creatinine,
        age: data.patient.age,
        sex: data.patient.sex,
        ecog: data.patient.ecog as 0 | 1 | 2 | 3 | 4,
        bilirubin: data.patient.bilirubin,
      },
      // Preservar toxicityAdjustments e manualDoseOverrides do frontend
      toxicityAdjustments: data.audit?.toxicityAdjustments,
      manualDoseOverrides: data.audit?.manualDoseOverrides,
    },
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Pacientes ──────────────────────────────────────────────────────────
  patients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPatientsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPatientById(input.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          age: z.number(),
          sex: z.enum(["M", "F"]),
          weight: z.number(),
          height: z.number(),
          creatinine: z.number(),
          bilirubin: z.number(),
          ecog: z.number().min(0).max(4),
          comorbidities: z.string().optional(),
          cumulativeDoxorubicin: z.number().optional(),
          cumulativeDaunorubicin: z.number().optional(),
          cumulativeIdarubicin: z.number().optional(),
          cumulativeEpirubicin: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const patientData = {
          ...input,
          userId: ctx.user.id,
          creatinine: input.creatinine.toFixed(2),
          bilirubin: input.bilirubin.toFixed(2),
        };
        return await db.createPatient(patientData);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          age: z.number().optional(),
          sex: z.enum(["M", "F"]).optional(),
          weight: z.number().optional(),
          height: z.number().optional(),
          creatinine: z.number().optional(),
          bilirubin: z.number().optional(),
          ecog: z.number().min(0).max(4).optional(),
          comorbidities: z.string().optional(),
          cumulativeDoxorubicin: z.number().optional(),
          cumulativeDaunorubicin: z.number().optional(),
          cumulativeIdarubicin: z.number().optional(),
          cumulativeEpirubicin: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (data.creatinine !== undefined) {
          updateData.creatinine = data.creatinine.toFixed(2);
        }
        if (data.bilirubin !== undefined) {
          updateData.bilirubin = data.bilirubin.toFixed(2);
        }
        await db.updatePatient(id, updateData as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePatient(input.id);
        return { success: true };
      }),
  }),

  // ─── Prescrições ────────────────────────────────────────────────────────
  prescriptions: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getPrescriptionsByUserId(ctx.user.id, input?.limit);
      }),

    getByPatient: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPrescriptionsByPatientId(input.patientId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPrescriptionById(input.id);
      }),

    getByPrescriptionId: protectedProcedure
      .input(z.object({ prescriptionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getPrescriptionByPrescriptionId(
          input.prescriptionId
        );
      }),

    /**
     * Cria uma nova prescrição com validação rigorosa.
     *
     * Fluxo:
     * 1. Validação Zod estruturada (rejeita NaN, Infinity, negativos)
     * 2. Validação de segurança de doses
     * 3. Revalidação de BSA/eGFR no backend (mesmas fórmulas)
     * 4. Registro de divergências cliente/servidor
     * 5. Enriquecimento com metadados de auditoria
     * 6. Persistência
     */
    create: protectedProcedure
      .input(createPrescriptionInputSchema)
      .mutation(async ({ ctx, input }) => {
        const prescriptionId = `RX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // ── 1. Validação de segurança de doses ──
        const doseErrors = validateDoseSafety(input.prescriptionData.drugs);
        if (doseErrors.length > 0) {
          logBlockedPersistence(
            "invalid_doses",
            prescriptionId,
            doseErrors
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Doses inválidas detectadas: ${doseErrors.length} erro(s). Verifique os valores e tente novamente.`,
          });
        }

        // ── 2. Revalidação de BSA/eGFR no backend ──
        const { patient } = input.prescriptionData;
        const serverBSA = calculateBSA(patient.weight, patient.height);
        const serverEGFR = calculateEGFR(
          patient.creatinine,
          patient.age,
          patient.sex
        );

        // Verificar divergência BSA
        if (serverBSA > 0 && input.bsa > 0) {
          const bsaDiff =
            (Math.abs(serverBSA - input.bsa) / serverBSA) * 100;
          if (bsaDiff > CLINICAL_DIVERGENCE_THRESHOLD) {
            logClinicalDivergence(
              prescriptionId,
              "BSA",
              input.bsa,
              serverBSA,
              bsaDiff
            );
          }
        }

        // Verificar divergência eGFR
        if (serverEGFR > 0 && input.egfr > 0) {
          const egfrDiff =
            (Math.abs(serverEGFR - input.egfr) / serverEGFR) * 100;
          if (egfrDiff > CLINICAL_DIVERGENCE_THRESHOLD) {
            logClinicalDivergence(
              prescriptionId,
              "eGFR",
              input.egfr,
              serverEGFR,
              egfrDiff
            );
          }
        }

        // ── 3. Enriquecer com metadados de auditoria ──
        const enrichedData = enrichAuditMetadata(
          input.prescriptionData,
          ctx.user.id,
          ctx.user.name,
          serverBSA,
          serverEGFR
        );

        // ── 4. Persistir ──
        const prescriptionRecord = {
          prescriptionId,
          userId: ctx.user.id,
          patientId: input.patientId,
          patientName: input.patientName,
          protocolName: input.protocolName,
          cycle: input.cycle,
          bsa: input.bsa.toFixed(2),
          egfr: input.egfr.toFixed(2),
          renalStatus: input.renalStatus,
          prescriptionData: enrichedData,
        };

        await db.recordProtocolUsage({
          userId: ctx.user.id,
          protocolId: input.protocolName,
          protocolName: input.protocolName,
          indication: undefined,
        });

        return await db.createPrescription(prescriptionRecord);
      }),

    /**
     * Lê uma prescrição e normaliza payload legado se necessário.
     * Prescrições v1 são convertidas para v2 na leitura (sem alterar o banco).
     */
    getWithNormalization: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prescription = await db.getPrescriptionById(input.id);
        if (!prescription) return null;

        // Tentar normalizar payload legado
        const normalized = normalizeLegacyPayload(
          prescription.prescriptionData
        );

        return {
          ...prescription,
          prescriptionDataNormalized: normalized,
          isLegacyFormat: normalized === null,
        };
      }),
  }),

  // ─── Estatísticas ───────────────────────────────────────────────────────
  stats: router({
    protocolUsage: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProtocolUsageStats(ctx.user.id);
    }),

    topProtocols: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(10) }))
      .query(async ({ ctx, input }) => {
        return await db.getTopProtocols(ctx.user.id, input.limit);
      }),

    protocolsByIndication: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProtocolsByIndication(ctx.user.id);
    }),

    toxicityStats: protectedProcedure.query(async ({ ctx }) => {
      return await db.getToxicityStats(ctx.user.id);
    }),

    prescriptionTrends: protectedProcedure
      .input(z.object({ days: z.number().optional().default(30) }))
      .query(async ({ ctx, input }) => {
        return await db.getPrescriptionTrends(ctx.user.id, input.days);
      }),

    overview: protectedProcedure.query(async ({ ctx }) => {
      return await db.getStatsOverview(ctx.user.id);
    }),
  }),

  // ─── Configurações Institucionais ───────────────────────────────────────
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getInstitutionSettings(ctx.user.id);
    }),

    upsert: protectedProcedure
      .input(
        z.object({
          institutionName: z.string().optional(),
          institutionLogo: z.string().optional(),
          prescriberName: z.string().optional(),
          prescriberCRM: z.string().optional(),
          prescriberSpecialty: z.string().optional(),
          headerTemplate: z.string().optional(),
          footerTemplate: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertInstitutionSettings(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Predição de Toxicidade com ML ──────────────────────────────────────
  toxicity: router({
    predict: publicProcedure
      .input(
        z.object({
          age: z.number(),
          creatinine: z.number(),
          bilirubin: z.number(),
          ecog: z.number(),
          hasComorbidities: z.boolean(),
          protocolName: z.string(),
          protocolRisk: z.enum(["low", "moderate", "high", "very_high"]),
        })
      )
      .query(({ input }) => {
        return predictToxicity(input);
      }),

    metrics: publicProcedure.query(() => {
      return getModelMetrics();
    }),
  }),
});

export type AppRouter = typeof appRouter;
