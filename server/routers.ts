import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { predictToxicity, getModelMetrics } from "./toxicityModel";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Pacientes
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
      .input(z.object({
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
      }))
      .mutation(async ({ ctx, input }) => {
        const patientData = {
          ...input,
          userId: ctx.user.id,
          // Drizzle DECIMAL requer string
          creatinine: input.creatinine.toFixed(2),
          bilirubin: input.bilirubin.toFixed(2),
        };
        return await db.createPatient(patientData);
      }),

    update: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        // Converter para string (Drizzle DECIMAL requirement)
        if (data.creatinine !== undefined) {
          updateData.creatinine = data.creatinine.toFixed(2);
        }
        if (data.bilirubin !== undefined) {
          updateData.bilirubin = data.bilirubin.toFixed(2);
        }
        await db.updatePatient(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePatient(input.id);
        return { success: true };
      }),
  }),

  // Prescrições
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

    create: protectedProcedure
      .input(z.object({
        patientId: z.number(),
        patientName: z.string(),
        protocolName: z.string(),
        cycle: z.number(),
        bsa: z.number(),
        egfr: z.number(),
        renalStatus: z.string(),
        prescriptionData: z.any(), // Todos os dados da prescrição em JSON
      }))
      .mutation(async ({ ctx, input }) => {
        // Gerar ID único para rastreabilidade
        const prescriptionId = `RX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const prescriptionRecord = {
          prescriptionId,
          userId: ctx.user.id,
          patientId: input.patientId,
          patientName: input.patientName,
          protocolName: input.protocolName,
          cycle: input.cycle,
          bsa: input.bsa.toFixed(2), // DECIMAL requer string
          egfr: input.egfr.toFixed(2),
          renalStatus: input.renalStatus,
          prescriptionData: input.prescriptionData,
        };
        
        await db.recordProtocolUsage({
          userId: ctx.user.id,
          protocolId: input.protocolName,
          protocolName: input.protocolName,
          indication: undefined,
        });
        
        return await db.createPrescription(prescriptionRecord);
      }),
  }),

  // Estatísticas
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

  // Configurações Institucionais
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getInstitutionSettings(ctx.user.id);
    }),

    upsert: protectedProcedure
      .input(z.object({
        institutionName: z.string().optional(),
        institutionLogo: z.string().optional(),
        prescriberName: z.string().optional(),
        prescriberCRM: z.string().optional(),
        prescriberSpecialty: z.string().optional(),
        headerTemplate: z.string().optional(),
        footerTemplate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertInstitutionSettings(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // Predição de Toxicidade com ML
  toxicity: router({
    predict: publicProcedure
      .input(z.object({
        age: z.number(),
        creatinine: z.number(),
        bilirubin: z.number(),
        ecog: z.number(),
        hasComorbidities: z.boolean(),
        protocolName: z.string(),
        protocolRisk: z.enum(['low', 'moderate', 'high', 'very_high']),
      }))
      .query(({ input }) => {
        return predictToxicity(input);
      }),

    metrics: publicProcedure.query(() => {
      return getModelMetrics();
    }),
  }),
});

export type AppRouter = typeof appRouter;
