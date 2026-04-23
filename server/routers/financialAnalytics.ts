/**
 * Financial analytics router — variance alerts + benchmarks for the Cockpit.
 *
 * Auth-gated: only fund-wide viewers (Chairman / Group CEO) get the full
 * picture. CEOs see only their own company's variance. Anyone else
 * receives an empty list to avoid leaking cross-portfolio financials.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { resolveViewerScope } from "../scope";
import { computeVarianceAlerts, buildBenchmarkTable } from "../financial-analytics";

const TENANT_ID = 1;

export const financialAnalyticsRouter = router({
  varianceAlerts: protectedProcedure
    .input(z.object({ fiscalYear: z.string().default(String(new Date().getFullYear())) }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) return [];
      const scope = await resolveViewerScope(person, TENANT_ID);
      const all = await computeVarianceAlerts(TENANT_ID, input.fiscalYear);
      if (scope.isFundWide) return all;
      // Non-fund-wide: filter to companies the viewer owns (CEO sees only their company)
      return all.filter(a => scope.ownedOrgUnitIds.includes(a.orgUnitId));
    }),

  benchmarks: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) return [];
    const scope = await resolveViewerScope(person, TENANT_ID);
    if (!scope.isFundWide) {
      // Benchmarks compare across companies — restricted to fund-wide viewers
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cross-company benchmarks require fund-wide authority",
      });
    }
    return await buildBenchmarkTable(TENANT_ID);
  }),
});
