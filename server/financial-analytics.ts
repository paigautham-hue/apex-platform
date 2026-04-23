/**
 * financial-analytics.ts — Cockpit variance + benchmarking helpers.
 *
 * Used by /financial-cockpit and the board-pack export.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  metrics,
  metricValues,
  orgUnits,
  plans,
  type OrgUnit,
} from "../drizzle/schema";

export type Variance = "ON_TRACK" | "WATCH" | "OFF_TRACK";

export interface VarianceAlert {
  orgUnitId: number;
  orgUnitName: string;
  metricName: string;
  metricId: number;
  targetValue: number;
  ytdActual: number;
  variancePct: number;
  variance: Variance;
}

/**
 * Compute variance alerts across all companies for a given fiscal period.
 * variance: ON_TRACK if within 5%, WATCH if within 20%, OFF_TRACK if >20% off
 * (only ALERT for negative variances on positive-target metrics).
 */
export async function computeVarianceAlerts(
  tenantId: number,
  fiscalYear: string
): Promise<VarianceAlert[]> {
  const db = await getDb();
  if (!db) return [];

  const companies = await db
    .select()
    .from(orgUnits)
    .where(and(eq(orgUnits.tenantId, tenantId), eq(orgUnits.type, "PORTFOLIO_COMPANY")));
  if (companies.length === 0) return [];

  // For each company, find revenue/EBITDA/PBT metrics + YTD values
  const alerts: VarianceAlert[] = [];

  for (const co of companies) {
    // Find plans for this company
    const allPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.orgUnitId, co.id));
    const planIds = allPlans.map(p => p.id);
    if (planIds.length === 0) continue;

    const coMetrics = await db
      .select()
      .from(metrics)
      .where(and(eq(metrics.tenantId, tenantId), inArray(metrics.planId, planIds)));

    for (const m of coMetrics) {
      if (!m.targetValue) continue;
      // Get YTD cumulative actual
      const values = await db
        .select()
        .from(metricValues)
        .where(eq(metricValues.metricId, m.id));
      const ytd = values
        .filter(v => v.periodType === "CUMULATIVE_YTD" || v.periodType === "QUARTERLY")
        .reduce((sum, v) => sum + Number(v.actualValue), 0);
      const target = Number(m.targetValue);
      if (target === 0) continue;
      const variancePct = ((ytd - target) / target) * 100;
      const isNegativeTarget = m.isNegativeTarget;
      const effectivePct = isNegativeTarget ? -variancePct : variancePct;

      let variance: Variance = "ON_TRACK";
      if (Math.abs(effectivePct) > 20) variance = "OFF_TRACK";
      else if (Math.abs(effectivePct) > 5) variance = "WATCH";

      // Only alert on negative variance
      if (effectivePct < -5) {
        alerts.push({
          orgUnitId: co.id,
          orgUnitName: co.name,
          metricName: m.name,
          metricId: m.id,
          targetValue: target,
          ytdActual: ytd,
          variancePct,
          variance,
        });
      }
    }
  }

  // Sort: most off-track first
  return alerts.sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct));
}

export interface BenchmarkRow {
  orgUnitId: number;
  orgUnitName: string;
  industrySector: string | null;
  lifecycleStage: string | null;
  fyRevenue: number;
  fyEbitda: number;
  ebitdaPct: number;
  yoyGrowthPct: number | null;
}

/**
 * Cross-company benchmark — sortable by sector, growth, margin.
 */
export async function buildBenchmarkTable(tenantId: number): Promise<BenchmarkRow[]> {
  const db = await getDb();
  if (!db) return [];

  const companies = await db
    .select()
    .from(orgUnits)
    .where(and(eq(orgUnits.tenantId, tenantId), eq(orgUnits.type, "PORTFOLIO_COMPANY")));

  const rows: BenchmarkRow[] = [];

  for (const co of companies) {
    const allPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.orgUnitId, co.id));
    const planIds = allPlans.map(p => p.id);
    if (planIds.length === 0) {
      rows.push({
        orgUnitId: co.id,
        orgUnitName: co.name,
        industrySector: co.industrySector,
        lifecycleStage: co.lifecycleStage,
        fyRevenue: 0,
        fyEbitda: 0,
        ebitdaPct: 0,
        yoyGrowthPct: null,
      });
      continue;
    }
    const coMetrics = await db
      .select()
      .from(metrics)
      .where(and(eq(metrics.tenantId, tenantId), inArray(metrics.planId, planIds)));
    const revMetric = coMetrics.find(m => /revenue/i.test(m.name));
    const ebitMetric = coMetrics.find(m => /ebitda/i.test(m.name));

    let fyRevenue = 0;
    let fyEbitda = 0;
    if (revMetric) {
      const vals = await db.select().from(metricValues).where(eq(metricValues.metricId, revMetric.id));
      fyRevenue = vals.reduce((s, v) => s + Number(v.actualValue), 0);
    }
    if (ebitMetric) {
      const vals = await db.select().from(metricValues).where(eq(metricValues.metricId, ebitMetric.id));
      fyEbitda = vals.reduce((s, v) => s + Number(v.actualValue), 0);
    }
    const ebitdaPct = fyRevenue > 0 ? (fyEbitda / fyRevenue) * 100 : 0;

    rows.push({
      orgUnitId: co.id,
      orgUnitName: co.name,
      industrySector: co.industrySector,
      lifecycleStage: co.lifecycleStage,
      fyRevenue,
      fyEbitda,
      ebitdaPct,
      yoyGrowthPct: null,
    });
  }

  return rows;
}
