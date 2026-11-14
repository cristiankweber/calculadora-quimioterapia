import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  exportClinicalProtocols,
  importClinicalProtocols,
  syncClinicalLibrary,
} from "../clinicalProtocolStorage";
import { parseProtocolImport } from "../seedSystemProtocols";

export const clinicalProtocolsRouter = router({
  syncLibrary: protectedProcedure.mutation(({ ctx }) => syncClinicalLibrary(ctx.user.id)),
  import: protectedProcedure
    .input(z.object({ jsonData: z.string().min(1).max(10_000_000) }))
    .mutation(({ ctx, input }) => {
      // Validation errors are BAD_REQUEST; storage/unavailability failures remain server errors.
      try { parseProtocolImport(input.jsonData); }
      catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Formato inválido." });
      }
      return importClinicalProtocols(ctx.user.id, input.jsonData);
    }),
  exportAll: protectedProcedure.mutation(({ ctx }) => exportClinicalProtocols(ctx.user.id)),
  exportSelected: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      try { return await exportClinicalProtocols(ctx.user.id, input.ids); }
      catch (error) {
        if (error instanceof Error && error.message === "Protocolo não encontrado ou sem permissão.") {
          throw new TRPCError({ code: "NOT_FOUND", message: error.message });
        }
        throw error;
      }
    }),
});
