/**
 * 360 router — fractal cycle generation + ensure peer/upward feedback types exist.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { resolveViewerScope } from "../scope";
import { generate360Assignments } from "../360-engine";
import { feedbackTypes } from "../../drizzle/schema";

const TENANT_ID = 1;

export const threeSixtyRouter = router({
  /**
   * Ensure peer/upward feedback types exist (idempotent).
   * Run once per tenant before triggering 360.
   */
  ensureFeedbackTypes: protectedProcedure.mutation(async ({ ctx }) => {
    const dbi = await getDb();
    if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const existing = await dbi
      .select()
      .from(feedbackTypes)
      .where(eq(feedbackTypes.tenantId, TENANT_ID));

    const ensure = async (key: string, label: string, isBlind: boolean) => {
      if (existing.some(e => e.key === key)) return;
      await dbi.insert(feedbackTypes).values({
        tenantId: TENANT_ID,
        key,
        label,
        visibilityRule: "AFTER_ALL_SUBMIT",
        isBlind,
        cadence: "MONTHLY",
        isActive: true,
        sortOrder: 10,
      });
    };
    await ensure("peer", "Peer Assessment", true);
    await ensure("upward", "Upward Feedback", true);
    await ensure("downward", "Leader Assessment", false);
    return { ok: true };
  }),

  /**
   * Trigger a 360 cycle on the calling viewer's team.
   * Only leaders with direct reports can call this.
   */
  triggerForMyTeam: protectedProcedure
    .input(
      z.object({
        cycleId: z.number(),
        includePeer: z.boolean().default(true),
        includeUpward: z.boolean().default(true),
        includeDownward: z.boolean().default(true),
        deadlineDays: z.number().min(1).max(60).default(14),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);
      if (scope.directReportPersonIds.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You don't have direct reports — nothing to 360.",
        });
      }
      if (!scope.primaryRole) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active role" });
      }
      return await generate360Assignments({
        tenantId: TENANT_ID,
        cycleId: input.cycleId,
        leaderRoleId: scope.primaryRole.id,
        includePeer: input.includePeer,
        includeUpward: input.includeUpward,
        includeDownward: input.includeDownward,
        deadlineDays: input.deadlineDays,
      });
    }),
});
