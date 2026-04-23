/**
 * Financial analytics router — variance alerts + benchmarks for the Cockpit.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { computeVarianceAlerts, buildBenchmarkTable } from "../financial-analytics";

const TENANT_ID = 1;

export const financialAnalyticsRouter = router({
  varianceAlerts: protectedProcedure
    .input(z.object({ fiscalYear: z.string().default(String(new Date().getFullYear())) }))
    .query(async ({ input }) => {
      return await computeVarianceAlerts(TENANT_ID, input.fiscalYear);
    }),

  benchmarks: protectedProcedure.query(async () => {
    return await buildBenchmarkTable(TENANT_ID);
  }),
});
