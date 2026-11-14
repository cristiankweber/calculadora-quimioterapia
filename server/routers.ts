import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { predictToxicity, getModelMetrics } from "./toxicityModel";
import {
  getPrescriptionBlockReason,
  isEnrichedClinicalDocument,
} from "../shared/clinicalProtocols/library";
import {
  exportClinicalProtocols,
  importClinicalProtocols,
  syncClinicalLibrary,
} from "./clinicalProtocolStorage";
import { clinicalProtocolsRouter } from "./routers/clinicalProtocols";
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
      errorSummary: errors.map(e => e.substring(0, 80)),
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
  clinicalProtocols: clinicalProtocolsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
        return await db.getPrescriptionByPrescriptionId(input.prescriptionId);
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
        const sourceId = input.prescriptionData.protocol.id;
        const storedProtocol = sourceId
          ? await db.getCustomProtocolByProtocolId(sourceId)
          : undefined;
        if (storedProtocol && storedProtocol.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Protocolo não encontrado para este usuário.",
          });
        }
        const clinicalBlock =
          getPrescriptionBlockReason(input.prescriptionData.protocol) ??
          getPrescriptionBlockReason(input.protocolName) ??
          (storedProtocol
            ? getPrescriptionBlockReason({
                id: storedProtocol.protocolId,
                name: storedProtocol.name,
                clinicalDocument: storedProtocol.clinicalDocument,
              })
            : null);
        if (clinicalBlock)
          throw new TRPCError({ code: "FORBIDDEN", message: clinicalBlock });
        const prescriptionId = `RX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // ── 1. Validação de segurança de doses ──
        const doseErrors = validateDoseSafety(input.prescriptionData.drugs);
        if (doseErrors.length > 0) {
          logBlockedPersistence("invalid_doses", prescriptionId, doseErrors);
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
          const bsaDiff = (Math.abs(serverBSA - input.bsa) / serverBSA) * 100;
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

  // ─── Protocolos Customizados ─────────────────────────────────────────
  customProtocols: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getCustomProtocolsByUserId(ctx.user.id);
    }),

    listActive: protectedProcedure.query(async ({ ctx }) => {
      return await db.getActiveCustomProtocolsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomProtocolById(input.id);
      }),

    create: protectedProcedure
      .input(
        z
          .object({
            name: z.string().min(1, "Nome é obrigatório").max(255),
            indication: z.string().min(1, "Indicação é obrigatória").max(512),
            cycles: z.number().int().min(1).default(1),
            cycleLength: z.number().int().min(1).default(21),
            emetogenicRisk: z
              .enum(["high", "moderate", "low", "minimal"])
              .default("moderate"),
            drugs: z
              .array(
                z
                  .object({
                    name: z.string().min(1),
                    dose: z.number().min(0),
                    doseUnit: z.enum([
                      "mg/m²",
                      "mg/kg",
                      "mg",
                      "AUC",
                      "mcg/kg",
                      "cGy",
                    ]),
                    maxDose: z.number().optional(),
                    route: z.string().min(1),
                    days: z.string().min(1),
                    observations: z.string().optional(),
                    emetogenicRisk: z
                      .enum(["high", "moderate", "low", "minimal"])
                      .optional(),
                    renalAdjustment: z.string().optional(),
                    hepaticAdjustment: z.string().optional(),
                  })
                  .strict()
              )
              .min(1, "Pelo menos uma droga é obrigatória"),
            specialAlerts: z.array(z.string()).optional(),
            prophylaxis: z.array(z.string()).optional(),
            nursingCare: z.array(z.string()).optional(),
            renalAdjustments: z.array(z.string()).optional(),
            hepaticAdjustments: z.array(z.string()).optional(),
            hematologicAdjustments: z.array(z.string()).optional(),
            dilutionInfo: z
              .array(
                z.object({
                  drugName: z.string(),
                  diluent: z.string(),
                  volume: z.string(),
                  infusionTime: z.string(),
                  stability: z.string(),
                  specialInstructions: z.string(),
                })
              )
              .optional(),
          })
          .strict()
      )
      .mutation(async ({ ctx, input }) => {
        // Gerar protocolId único baseado no nome
        const slug = input.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const protocolId = `custom-${slug}-${Date.now().toString(36)}`;

        const record = {
          userId: ctx.user.id,
          protocolId,
          name: input.name,
          indication: input.indication,
          cycles: input.cycles,
          cycleLength: input.cycleLength,
          emetogenicRisk: input.emetogenicRisk,
          drugs: input.drugs,
          specialAlerts: input.specialAlerts ?? [],
          prophylaxis: input.prophylaxis ?? [],
          nursingCare: input.nursingCare ?? [],
          renalAdjustments: input.renalAdjustments ?? [],
          hepaticAdjustments: input.hepaticAdjustments ?? [],
          hematologicAdjustments: input.hematologicAdjustments ?? [],
          dilutionInfo: input.dilutionInfo ?? [],
          isActive: 1,
        };

        return await db.createCustomProtocol(record as any);
      }),

    update: protectedProcedure
      .input(
        z
          .object({
            id: z.number(),
            name: z.string().min(1).max(255).optional(),
            indication: z.string().min(1).max(512).optional(),
            cycles: z.number().int().min(1).optional(),
            cycleLength: z.number().int().min(1).optional(),
            emetogenicRisk: z
              .enum(["high", "moderate", "low", "minimal"])
              .optional(),
            drugs: z
              .array(
                z
                  .object({
                    name: z.string().min(1),
                    dose: z.number().min(0),
                    doseUnit: z.enum([
                      "mg/m²",
                      "mg/kg",
                      "mg",
                      "AUC",
                      "mcg/kg",
                      "cGy",
                    ]),
                    maxDose: z.number().optional(),
                    route: z.string().min(1),
                    days: z.string().min(1),
                    observations: z.string().optional(),
                    emetogenicRisk: z
                      .enum(["high", "moderate", "low", "minimal"])
                      .optional(),
                    renalAdjustment: z.string().optional(),
                    hepaticAdjustment: z.string().optional(),
                  })
                  .strict()
              )
              .optional(),
            specialAlerts: z.array(z.string()).optional(),
            prophylaxis: z.array(z.string()).optional(),
            nursingCare: z.array(z.string()).optional(),
            renalAdjustments: z.array(z.string()).optional(),
            hepaticAdjustments: z.array(z.string()).optional(),
            hematologicAdjustments: z.array(z.string()).optional(),
            dilutionInfo: z
              .array(
                z.object({
                  drugName: z.string(),
                  diluent: z.string(),
                  volume: z.string(),
                  infusionTime: z.string(),
                  stability: z.string(),
                  specialInstructions: z.string(),
                })
              )
              .optional(),
          })
          .strict()
      )
      .mutation(async ({ ctx, input }) => {
        // Verificar se o protocolo pertence ao usuário
        const existing = await db.getCustomProtocolById(input.id);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Protocolo não encontrado ou sem permissão.",
          });
        }

        if (isEnrichedClinicalDocument(existing.clinicalDocument)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Documento clínico versionado: exporte e revise o JSON completo, depois importe uma nova versão. O formulário legado não preserva fases e calendários.",
          });
        }
        const { id, ...data } = input;
        const updates =
          existing.clinicalDocument &&
          existing.clinicalPackage?.version === "1.0"
            ? {
                ...data,
                clinicalDocument: {
                  ...existing.clinicalDocument,
                  ...Object.fromEntries(
                    Object.entries(data).filter(
                      ([, value]) => value !== undefined
                    )
                  ),
                },
              }
            : data;
        await db.updateCustomProtocol(id, updates as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getCustomProtocolById(input.id);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Protocolo não encontrado ou sem permissão.",
          });
        }
        await db.deleteCustomProtocol(input.id);
        return { success: true };
      }),

    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getCustomProtocolById(input.id);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Protocolo não encontrado ou sem permissão.",
          });
        }
        await db.updateCustomProtocol(input.id, { isActive: 1 });
        return { success: true };
      }),

    // Intercâmbio clínico sem perda; endpoints anteriores preservados para a UI.
    export: protectedProcedure
      .input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await exportClinicalProtocols(ctx.user.id, input.ids);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error ? error.message : "Falha na exportação.",
          });
        }
      }),
    exportAll: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await exportClinicalProtocols(ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "Falha na exportação.",
        });
      }
    }),
    import: protectedProcedure
      .input(z.object({ jsonData: z.string().min(1).max(5_000_000) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await importClinicalProtocols(ctx.user.id, input.jsonData);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error ? error.message : "Falha na importação.",
          });
        }
      }),
    seedSystem: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await syncClinicalLibrary(ctx.user.id);
        return {
          ...result,
          message: `${result.imported} documento(s) revisado(s) adicionado(s); ${result.skipped} já presentes. Nenhum personalizado foi substituído. Prescrição dos rascunhos continua bloqueada.`,
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "Falha na sincronização.",
        });
      }
    }),
  }),

  // ─── Predição de Toxicidade com ML ────────────────────────────────────────
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
