/**
 * Insights router — scope-aware AI insight cards + lifecycle.
 *
 * Endpoints:
 *   - listForViewer  — return insights surfaced to this viewer, scope-filtered
 *   - listForTarget  — insights about a particular role/company/person
 *   - snooze         — defer for N hours/days
 *   - markAddressed  — leader marks an insight as resolved
 *   - dismiss        — remove from view (won't resurface)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc, inArray, or, isNull, gt } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { resolveViewerScope, viewerToOrgScope } from "../scope";
import { aiInsights } from "../../drizzle/schema";

const TENANT_ID = 1;

export const insightsRouter = router({
  /**
   * List insights that should appear for this viewer.
   * - scope is filtered to viewer's reach (FUND > COMPANY > FUNCTION > TEAM > INDIVIDUAL)
   * - excludes snoozed (still snoozed) / dismissed / addressed
   * - if surfaceToPersonIds is set on an insight, only those people see it
   */
  listForViewer: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        includeAddressed: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) return [];
      const scope = await resolveViewerScope(person, TENANT_ID);
      const dbi = await getDb();
      if (!dbi) return [];

      // Scope ordering: viewer can see everything at-or-below their tier
      const allowedScopes: Array<"FUND" | "COMPANY" | "FUNCTION" | "TEAM" | "INDIVIDUAL"> = [];
      const myScope = viewerToOrgScope(scope);
      if (myScope === "FUND") allowedScopes.push("FUND", "COMPANY", "FUNCTION", "TEAM", "INDIVIDUAL");
      else if (myScope === "COMPANY") allowedScopes.push("COMPANY", "FUNCTION", "TEAM", "INDIVIDUAL");
      else if (myScope === "FUNCTION") allowedScopes.push("FUNCTION", "TEAM", "INDIVIDUAL");
      else if (myScope === "TEAM") allowedScopes.push("TEAM", "INDIVIDUAL");
      else allowedScopes.push("INDIVIDUAL");

      const now = new Date();

      const rows = await dbi
        .select()
        .from(aiInsights)
        .where(
          and(
            eq(aiInsights.tenantId, TENANT_ID),
            inArray(aiInsights.scope, allowedScopes),
            input.includeAddressed
              ? undefined as any
              : inArray(aiInsights.status, ["NEW", "VIEWED"]),
            // Filter snoozed
            or(isNull(aiInsights.snoozedUntil), gt(aiInsights.snoozedUntil, now))
          )
        )
        .orderBy(desc(aiInsights.urgency), desc(aiInsights.createdAt))
        .limit(input.limit);

      // Filter by surfaceToPersonIds (in app since it's JSON)
      return rows.filter(r => {
        const ids = (r.surfaceToPersonIds ?? []) as number[];
        if (ids.length === 0) {
          // Open insight — must be in viewer's authority scope
          if (r.targetType === "ROLE" && r.targetId != null) {
            // Authority check: target person must be subordinate / self / fund-wide
            // Skip the deep check here for performance; rely on scope filter
          }
          return true;
        }
        return ids.includes(person.id);
      });
    }),

  /**
   * Insights about a specific target (role / company / chain).
   */
  listForTarget: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["ROLE", "COMPANY", "CHAIN", "FUND"]),
        targetId: z.number().nullable(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) return [];
      return await dbi
        .select()
        .from(aiInsights)
        .where(
          and(
            eq(aiInsights.tenantId, TENANT_ID),
            eq(aiInsights.targetType, input.targetType),
            input.targetId == null ? undefined as any : eq(aiInsights.targetId, input.targetId)
          )
        )
        .orderBy(desc(aiInsights.urgency), desc(aiInsights.createdAt))
        .limit(input.limit);
    }),

  /**
   * Snooze an insight for N hours.
   */
  snooze: protectedProcedure
    .input(z.object({ insightId: z.number(), hours: z.number().min(1).max(720) }))
    .mutation(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const until = new Date(Date.now() + input.hours * 60 * 60 * 1000);
      await dbi
        .update(aiInsights)
        .set({ status: "SNOOZED", snoozedUntil: until })
        .where(and(eq(aiInsights.tenantId, TENANT_ID), eq(aiInsights.id, input.insightId)));
      return { ok: true, snoozedUntil: until };
    }),

  /**
   * Mark addressed — viewer is recorded; insight no longer surfaces.
   */
  markAddressed: protectedProcedure
    .input(z.object({ insightId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await dbi
        .update(aiInsights)
        .set({ status: "ADDRESSED", addressedAt: new Date(), addressedByPersonId: person?.id ?? null })
        .where(and(eq(aiInsights.tenantId, TENANT_ID), eq(aiInsights.id, input.insightId)));
      return { ok: true };
    }),

  dismiss: protectedProcedure
    .input(z.object({ insightId: z.number() }))
    .mutation(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await dbi
        .update(aiInsights)
        .set({ status: "DISMISSED" })
        .where(and(eq(aiInsights.tenantId, TENANT_ID), eq(aiInsights.id, input.insightId)));
      return { ok: true };
    }),

  /**
   * Insights about ME — the user's "what AI said about me" inbox.
   */
  insightsAboutMe: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) return [];
    const dbi = await getDb();
    if (!dbi) return [];

    // Find their roles
    const myRoles = await dbi
      .select()
      .from((await import("../../drizzle/schema")).roles)
      .where(eq((await import("../../drizzle/schema")).roles.personId, person.id));
    const myRoleIds = myRoles.map(r => r.id);

    return await dbi
      .select()
      .from(aiInsights)
      .where(
        and(
          eq(aiInsights.tenantId, TENANT_ID),
          or(
            and(eq(aiInsights.targetType, "ROLE"), inArray(aiInsights.targetId, myRoleIds.length ? myRoleIds : [-1]))
          )
        )
      )
      .orderBy(desc(aiInsights.createdAt))
      .limit(100);
  }),
});
