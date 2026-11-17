import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createCourt, getCourtStatusHistory, listCourts, updateCourtStatus } from "./db";

const courtStatus = z.enum(["open", "closed", "playing"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  courts: router({
    list: publicProcedure
      .input(
        z
          .object({
            city: z.string().optional(),
            region: z.string().optional(),
            status: courtStatus.optional(),
            sportType: z.string().optional(),
          })
          .optional(),
      )
      .query(({ input }) => listCourts(input ?? {})),
    statusHistory: publicProcedure
      .input(z.object({ courtId: z.number().int().positive() }))
      .query(({ input }) => getCourtStatusHistory(input.courtId)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(3).max(180),
          city: z.string().trim().min(2).max(120),
          region: z.string().trim().min(2).max(120),
          address: z.string().trim().min(5),
          sportType: z.string().trim().min(2).max(80),
          description: z.string().trim().max(1000).optional(),
          status: courtStatus.default("open"),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await createCourt({
            ...input,
            description: input.description || null,
            lastStatusUpdate: new Date(),
            createdBy: ctx.user.id,
            latitude: input.latitude?.toString() ?? null,
            longitude: input.longitude?.toString() ?? null,
          });
        } catch (error) {
          console.error("[Courts] Failed to create court", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível cadastrar a quadra." });
        }
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          courtId: z.number().int().positive(),
          status: courtStatus,
          note: z.string().trim().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await updateCourtStatus(input.courtId, ctx.user.id, input.status, input.note);
        } catch (error) {
          console.error("[Courts] Failed to update status", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível atualizar o status." });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
