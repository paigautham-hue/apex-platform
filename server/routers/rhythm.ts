/**
 * Rhythm router — daily focus + cadence triggers.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc } from "drizzle-orm";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { computeDailyFocus, recordDailyFocus, sendCycleDeadlineNotifications } from "../rhythm-engine";
import { dailyFocusLog } from "../../drizzle/schema";

const TENANT_ID = 1;

export const rhythmRouter = router({
  /**
   * Get THIS user's daily focus (computed live + recorded once per day).
   */
  getMyDailyFocus: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) return null;
    return await recordDailyFocus(TENANT_ID, person.id);
  }),

  /**
   * Mark today's focus as viewed/acted/dismissed.
   */
  markFocus: protectedProcedure
    .input(z.object({ action: z.enum(["VIEWED", "ACTED", "DISMISSED"]) }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const today = new Date().toISOString().slice(0, 10);
      const rows = await dbi
        .select()
        .from(dailyFocusLog)
        .where(
          and(
            eq(dailyFocusLog.tenantId, TENANT_ID),
            eq(dailyFocusLog.personId, person.id),
            eq(dailyFocusLog.focusDate, today)
          )
        )
        .limit(1);
      if (rows.length === 0) return { ok: false };
      const row = rows[0];
      const patch =
        input.action === "VIEWED"
          ? { viewedAt: new Date() }
          : input.action === "ACTED"
            ? { actedAt: new Date() }
            : { dismissedAt: new Date() };
      await dbi.update(dailyFocusLog).set(patch).where(eq(dailyFocusLog.id, row.id));
      return { ok: true };
    }),

  /**
   * Engagement summary — last 30 days of daily focus engagement.
   */
  myFocusHistory: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) return [];
    const dbi = await getDb();
    if (!dbi) return [];
    return await dbi
      .select()
      .from(dailyFocusLog)
      .where(and(eq(dailyFocusLog.tenantId, TENANT_ID), eq(dailyFocusLog.personId, person.id)))
      .orderBy(desc(dailyFocusLog.surfacedAt))
      .limit(30);
  }),

  /**
   * Admin: trigger cycle deadline notifications now (also call from a daily cron).
   */
  triggerDeadlineNotifications: adminProcedure.mutation(async () => {
    return await sendCycleDeadlineNotifications(TENANT_ID);
  }),
});
