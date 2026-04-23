/**
 * Reveal gating — enforces feedbackTypes.visibilityRule for ANY assessor tier.
 *
 * Replaces the old chairman-hardcoded logic. Works for self-vs-chairman
 * AND self-vs-CEO AND self-vs-peer-360 AND any future tier.
 *
 * Rules per visibilityRule on the feedbackType:
 *   IMMEDIATE         — always visible
 *   AFTER_ALL_SUBMIT  — visible to target only when ALL assessors of this
 *                       feedbackType+target have submitted
 *   AFTER_DEADLINE    — visible to target only after cycle.deadlineDate
 *   ADMIN_RELEASE     — only visible after cycle.status === "REVEALED"
 *
 * Also honors feedbackType.autoRevealThresholdPct: if percentage of
 * expected assessors that have submitted >= threshold AND deadline passed,
 * reveal anyway.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  governanceAssessments,
  governanceCycles,
  feedbackTypes,
  assessmentAssignments,
  type GovernanceAssessment,
} from "../drizzle/schema";

export interface VisibilityContext {
  tenantId: number;
  cycleId: number;
  viewerPersonId: number;
  // The person who is the SUBJECT of the assessment (e.g., the rated CXO)
  subjectPersonId?: number;
  // Whether the viewer is the subject themselves (gets to see their own
  // assessments AT submit time, not waiting for anyone)
  viewerIsSubject: boolean;
  // Whether the viewer is an assessor for this feedbackType (assessors can
  // always see their OWN ratings)
  viewerIsAssessor: boolean;
}

/**
 * Filter a set of assessments to those the viewer is allowed to see right now.
 */
export async function filterAssessmentsByVisibility(
  assessments: GovernanceAssessment[],
  ctx: VisibilityContext
): Promise<GovernanceAssessment[]> {
  if (assessments.length === 0) return [];
  const db = await getDb();
  if (!db) return assessments; // degraded — show all rather than block

  // Bulk-fetch the feedbackTypes referenced
  const feedbackTypeIds = Array.from(new Set(assessments.map(a => a.feedbackTypeId)));
  const ftRows = feedbackTypeIds.length
    ? await db
        .select()
        .from(feedbackTypes)
        .where(and(eq(feedbackTypes.tenantId, ctx.tenantId), inArray(feedbackTypes.id, feedbackTypeIds)))
    : [];
  const ftById = new Map(ftRows.map(f => [f.id, f]));

  // Bulk-fetch the cycle
  const cycleRows = await db
    .select()
    .from(governanceCycles)
    .where(and(eq(governanceCycles.tenantId, ctx.tenantId), eq(governanceCycles.id, ctx.cycleId)))
    .limit(1);
  const cycle = cycleRows[0];
  const now = new Date();
  const deadlinePassed = cycle?.deadlineDate ? new Date(cycle.deadlineDate) <= now : false;
  const cycleRevealed = cycle?.status === "REVEALED";

  // For each (feedbackType, target) bucket, compute whether reveal threshold
  // has been crossed. We do this by counting submitted assignments / total
  // assignments for that bucket.
  const bucketKey = (a: GovernanceAssessment) => `${a.feedbackTypeId}::${a.targetType}::${a.targetId}`;
  const buckets = new Map<string, GovernanceAssessment[]>();
  for (const a of assessments) {
    const k = bucketKey(a);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(a);
  }

  // Pre-compute submit counts for each bucket from assignments
  const submitStats = new Map<string, { submitted: number; total: number }>();
  for (const [k, items] of Array.from(buckets.entries())) {
    const a0 = items[0];
    const allAssignments = await db
      .select()
      .from(assessmentAssignments)
      .where(
        and(
          eq(assessmentAssignments.tenantId, ctx.tenantId),
          eq(assessmentAssignments.cycleId, ctx.cycleId),
          eq(assessmentAssignments.feedbackTypeId, a0.feedbackTypeId),
          eq(assessmentAssignments.targetType, a0.targetType),
          eq(assessmentAssignments.targetId, a0.targetId)
        )
      );
    const total = allAssignments.length;
    const submitted = allAssignments.filter(x => x.status === "SUBMITTED").length;
    submitStats.set(k, { total, submitted });
  }

  return assessments.filter(a => {
    // Viewer is the assessor — always sees their own
    if (a.assessorPersonId === ctx.viewerPersonId) return true;

    const ft = ftById.get(a.feedbackTypeId);
    const rule = ft?.visibilityRule ?? "AFTER_ALL_SUBMIT";

    // Immediate — always visible
    if (rule === "IMMEDIATE") return true;

    // ADMIN_RELEASE — only when cycle.status === REVEALED
    if (rule === "ADMIN_RELEASE") return cycleRevealed;

    // AFTER_DEADLINE — visible when deadline passed
    if (rule === "AFTER_DEADLINE") {
      if (cycleRevealed) return true;
      return deadlinePassed;
    }

    // AFTER_ALL_SUBMIT — visible when all expected assessors have submitted
    // for THIS feedbackType+target bucket. Auto-reveal threshold applies if
    // deadline has passed.
    if (rule === "AFTER_ALL_SUBMIT") {
      if (cycleRevealed) return true;
      const stats = submitStats.get(bucketKey(a));
      if (!stats || stats.total === 0) return false;
      const pct = (stats.submitted / stats.total) * 100;
      if (stats.submitted === stats.total) return true;
      // Auto-reveal threshold: reveal partial if deadline passed AND pct meets bar
      const threshold = ft?.autoRevealThresholdPct ?? 80;
      if (deadlinePassed && pct >= threshold) return true;
      return false;
    }

    // Default deny
    return false;
  });
}
