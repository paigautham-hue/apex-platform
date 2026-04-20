/**
 * AI Insights generator (Phase 4.3)
 *
 * Batch process triggered by the Chairman dashboard ("Generate insights"
 * button) or, when a scheduler is wired up, automatically after a cycle
 * closes. Writes derived insights into the aiInsights table, tagged with
 * cycleId, severity, and insightType. The Chairman dashboard already
 * reads from aiInsights so freshly-generated rows appear immediately.
 *
 * Insight types covered here:
 *   PERCEPTION_GAP      — self vs chairman score deltas
 *   COMMITMENT_TRACKING — chronic deferrals
 *   ENGAGEMENT_PATTERN  — missing journals / submissions
 *   CHAIN_RISK          — chains with weak links
 *   FINANCIAL_MISMATCH  — companies far from FY27 budget
 */

import * as db from "./db";
import { findChronicDeferralsForTenant } from "./ai-commitment";

type Severity = "INFO" | "WARNING" | "CRITICAL";

async function writeInsight(
  tenantId: number,
  cycleId: number | null,
  insight: {
    insightType:
      | "PERCEPTION_GAP"
      | "COMMITMENT_TRACKING"
      | "ENGAGEMENT_PATTERN"
      | "CHAIN_RISK"
      | "FINANCIAL_MISMATCH"
      | "TREND_ALERT"
      | "360_SYNTHESIS";
    targetType: "ROLE" | "COMPANY" | "CHAIN" | "FUND" | null;
    targetId: number | null;
    text: string;
    severity: Severity;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await db.createAiInsight({
      tenantId,
      cycleId,
      insightType: insight.insightType,
      targetType: insight.targetType,
      targetId: insight.targetId,
      insightText: insight.text,
      severity: insight.severity,
      metadata: insight.metadata ?? null,
    });
  } catch (err) {
    console.warn("[insights] failed to write", insight.insightType, err);
  }
}

export async function generatePerceptionGapInsights(tenantId: number, cycleId: number) {
  const feedbackTypesAll = await db.getFeedbackTypesByTenant(tenantId);
  const selfType = feedbackTypesAll.find((t) => t.key === "self");
  const chairmanType = feedbackTypesAll.find((t) => t.key === "chairman");
  if (!selfType || !chairmanType) return 0;

  const assessments = await db.getAssessmentsByCycle(cycleId, tenantId);
  const byKey = new Map<
    string,
    { self?: typeof assessments[0]; chairman?: typeof assessments[0]; targetType: string; targetId: number; dimensionKey: string }
  >();
  for (const a of assessments) {
    if (a.feedbackTypeId !== selfType.id && a.feedbackTypeId !== chairmanType.id) continue;
    const k = `${a.targetType}:${a.targetId}:${a.dimensionKey}`;
    const entry = byKey.get(k) ?? {
      targetType: a.targetType,
      targetId: a.targetId,
      dimensionKey: a.dimensionKey,
    };
    if (a.feedbackTypeId === selfType.id) entry.self = a;
    else entry.chairman = a;
    byKey.set(k, entry);
  }

  let count = 0;
  for (const [, v] of byKey) {
    if (v.self?.score == null || v.chairman?.score == null) continue;
    const gap = Math.abs(v.chairman.score - v.self.score);
    if (gap < 2) continue;
    const severity: Severity = gap >= 3 ? "CRITICAL" : "WARNING";
    await writeInsight(tenantId, cycleId, {
      insightType: "PERCEPTION_GAP",
      targetType: v.targetType as "ROLE" | "COMPANY",
      targetId: v.targetId,
      text: `Perception gap of ${gap} on "${v.dimensionKey}" — self ${v.self.score}/10 vs chairman ${v.chairman.score}/10.`,
      severity,
      metadata: { selfScore: v.self.score, chairmanScore: v.chairman.score, gap },
    });
    count += 1;
  }
  return count;
}

export async function generateCommitmentInsights(tenantId: number, cycleId: number) {
  const chronic = await findChronicDeferralsForTenant(tenantId, 3);
  let count = 0;
  for (const c of chronic) {
    await writeInsight(tenantId, cycleId, {
      insightType: "COMMITMENT_TRACKING",
      targetType: null,
      targetId: c.personId,
      text: `${c.personName} has been carrying the commitment "${c.item}" on mandate "${c.dimensionKey}" across the last 3 cycles without completion. Chronic deferral.`,
      severity: "WARNING",
      metadata: { personId: c.personId, cycleIds: c.cycleIds, dimensionKey: c.dimensionKey },
    });
    count += 1;
  }
  return count;
}

export async function generateEngagementInsights(tenantId: number, cycleId: number) {
  const personsList = await db.getPersonsByTenant(tenantId);
  let count = 0;
  for (const person of personsList) {
    const journals = await db.getMandateJournalsByPersonAndCycle(person.id, cycleId, tenantId);
    if (journals.length === 0) {
      await writeInsight(tenantId, cycleId, {
        insightType: "ENGAGEMENT_PATTERN",
        targetType: null,
        targetId: person.id,
        text: `${person.name} logged zero journal entries this cycle.`,
        severity: "WARNING",
        metadata: { personId: person.id },
      });
      count += 1;
    }
  }
  return count;
}

export async function generateChainRiskInsights(tenantId: number, cycleId: number) {
  const chains = await db.getDependencyChainsByTenant(tenantId);
  if (chains.length === 0) return 0;

  const feedbackTypesAll = await db.getFeedbackTypesByTenant(tenantId);
  const chairmanType = feedbackTypesAll.find((t) => t.key === "chairman");
  if (!chairmanType) return 0;

  const assessments = await db.getAssessmentsByCycle(cycleId, tenantId);
  let count = 0;
  for (const chain of chains) {
    const memberRoleIds = (chain.nodeRoleIds ?? []) as number[];
    const scores: number[] = [];
    for (const roleId of memberRoleIds) {
      const roleScores = assessments
        .filter(
          (a) =>
            a.feedbackTypeId === chairmanType.id &&
            a.targetType === "ROLE" &&
            a.targetId === roleId &&
            a.score != null,
        )
        .map((a) => a.score as number);
      if (roleScores.length > 0) scores.push(roleScores.reduce((x, y) => x + y, 0) / roleScores.length);
    }
    if (scores.length === 0) continue;
    const weakest = Math.min(...scores);
    if (weakest > 5) continue;
    const severity: Severity = weakest <= 3 ? "CRITICAL" : "WARNING";
    await writeInsight(tenantId, cycleId, {
      insightType: "CHAIN_RISK",
      targetType: "CHAIN",
      targetId: chain.id,
      text: `Chain "${chain.name}" has a weak link at ${weakest.toFixed(1)}/10. The chain is only as strong as its weakest node.`,
      severity,
      metadata: { chainName: chain.name, weakest, memberScores: scores },
    });
    count += 1;
  }
  return count;
}

export async function generateFinancialMismatchInsights(tenantId: number, cycleId: number) {
  const summaries = await db.getFinancialSummariesByTenant(tenantId);
  const orgUnits = await db.getOrgUnitsByTenant(tenantId);

  const byCompany = new Map<number, typeof summaries>();
  for (const s of summaries) {
    const list = byCompany.get(s.orgUnitId) ?? [];
    list.push(s);
    byCompany.set(s.orgUnitId, list);
  }

  const toNum = (v: string | number | null | undefined) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };

  let count = 0;
  for (const [orgUnitId, rows] of byCompany) {
    const annualBudget = rows.find(
      (r) => r.metricName === "Revenue FY27" && r.periodType === "ANNUAL",
    );
    const ytdQuarters = rows.filter(
      (r) => r.metricName === "Revenue FY27" && r.periodType === "QUARTERLY",
    );
    if (!annualBudget || ytdQuarters.length === 0) continue;

    const budget = toNum(annualBudget.targetValue);
    const ytd = ytdQuarters
      .map((r) => toNum(r.actualValue) ?? 0)
      .reduce((a, b) => a + b, 0);
    if (!budget || budget <= 0) continue;
    const variancePct = ((ytd - budget) / budget) * 100;
    if (Math.abs(variancePct) < 15) continue;
    const severity: Severity = Math.abs(variancePct) >= 25 ? "CRITICAL" : "WARNING";
    const company = orgUnits.find((u) => u.id === orgUnitId);
    await writeInsight(tenantId, cycleId, {
      insightType: "FINANCIAL_MISMATCH",
      targetType: "COMPANY",
      targetId: orgUnitId,
      text: `${company?.name ?? `Company #${orgUnitId}`} YTD revenue is ${variancePct.toFixed(1)}% off FY27 budget.`,
      severity,
      metadata: { budget, ytd, variancePct },
    });
    count += 1;
  }
  return count;
}

export async function generateAllInsights(tenantId: number, cycleId: number) {
  const [perception, commitment, engagement, chain, financial] = await Promise.all([
    generatePerceptionGapInsights(tenantId, cycleId),
    generateCommitmentInsights(tenantId, cycleId),
    generateEngagementInsights(tenantId, cycleId),
    generateChainRiskInsights(tenantId, cycleId),
    generateFinancialMismatchInsights(tenantId, cycleId),
  ]);
  return { perception, commitment, engagement, chain, financial, total: perception + commitment + engagement + chain + financial };
}
