/**
 * Commitment Tracker (Phase 4.2)
 *
 * Compares last cycle's planItems against this cycle's logText (per
 * person per mandate dimension) and uses the LLM to classify each
 * item as addressed / partial / deferred / not-mentioned. Writes the
 * result back onto the prior journal's planItems.completedNextMonth
 * field so the plan-to-log checklist on /my-bridge becomes
 * AI-prefilled.
 *
 * Also detects chronic deferrals: items whose intent persists across
 * N consecutive cycles without ever being marked complete.
 */

import { and, desc, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import * as db from "./db";
import { mandateJournals, governanceCycles, persons } from "../drizzle/schema";

type PlanItem = { item: string; completedNextMonth: boolean | null };
type Verdict = "ADDRESSED" | "PARTIAL" | "DEFERRED" | "NOT_MENTIONED";

// In-memory lock to prevent duplicate LLM spend when two admins trigger the
// tracker concurrently for the same (tenant, cycle). Keyed by tenantId:cycleId.
const runningCommitmentTracker = new Set<string>();

async function classifyPlanItems(
  priorItems: PlanItem[],
  logText: string,
): Promise<Verdict[] | null> {
  if (priorItems.length === 0) return [];
  if (!logText || !logText.trim()) {
    return priorItems.map(() => "NOT_MENTIONED");
  }

  const prompt = `Below is a list of commitments someone made last month, followed by their journal entry describing what they actually did this month.

For each commitment, decide whether the journal shows it was:
- ADDRESSED (done or clearly made meaningful progress)
- PARTIAL (some progress but not complete)
- DEFERRED (explicitly pushed to a later cycle)
- NOT_MENTIONED (journal doesn't discuss this commitment at all)

Commitments (numbered):
${priorItems.map((it, i) => `${i + 1}. ${it.item}`).join("\n")}

Journal for the cycle:
"""
${logText.trim()}
"""

Return a JSON object with key "verdicts" — an array of strings the same length as the commitments list.`;

  const resp = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a careful reviewer. Only mark ADDRESSED when the journal provides concrete evidence. When in doubt, prefer PARTIAL or NOT_MENTIONED.",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "commitment_verdicts",
        strict: true,
        schema: {
          type: "object",
          properties: {
            verdicts: {
              type: "array",
              items: { type: "string", enum: ["ADDRESSED", "PARTIAL", "DEFERRED", "NOT_MENTIONED"] },
            },
          },
          required: ["verdicts"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = resp?.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    const verdicts = parsed.verdicts;
    if (!Array.isArray(verdicts)) {
      console.warn("[ai-commitment] LLM response missing 'verdicts' array; skipping classification");
      return null;
    }
    if (verdicts.length !== priorItems.length) {
      // Length mismatch means the verdicts are misaligned with items. Writing
      // them back would corrupt completedNextMonth on the wrong commitments.
      // Skip this journal rather than silently mislabel it.
      console.warn(
        `[ai-commitment] length mismatch: ${verdicts.length} verdicts for ${priorItems.length} items; skipping`,
      );
      return null;
    }
    const validVerdicts: Verdict[] = [];
    const allowed: Verdict[] = ["ADDRESSED", "PARTIAL", "DEFERRED", "NOT_MENTIONED"];
    for (const v of verdicts) {
      if (typeof v !== "string" || !allowed.includes(v as Verdict)) {
        console.warn(`[ai-commitment] invalid verdict value: ${v}; skipping`);
        return null;
      }
      validVerdicts.push(v as Verdict);
    }
    return validVerdicts;
  } catch (err) {
    console.warn("[ai-commitment] failed to parse LLM response:", err);
    return null;
  }
}

/**
 * Scan the active cycle's journals. For each one, find the prior cycle's
 * journal for the same (person, dimension) and run the LLM classifier.
 * Write back to prior journal's planItems.completedNextMonth:
 *   ADDRESSED / PARTIAL -> true
 *   DEFERRED / NOT_MENTIONED -> false
 */
export async function runCommitmentTrackerForCycle(tenantId: number, currentCycleId: number) {
  const lockKey = `${tenantId}:${currentCycleId}`;
  if (runningCommitmentTracker.has(lockKey)) {
    throw new Error("Commitment tracker is already running for this cycle. Please wait for it to finish.");
  }
  runningCommitmentTracker.add(lockKey);
  try {
    return await _runCommitmentTrackerForCycleInner(tenantId, currentCycleId);
  } finally {
    runningCommitmentTracker.delete(lockKey);
  }
}

async function _runCommitmentTrackerForCycleInner(tenantId: number, currentCycleId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const currentJournals = await database
    .select()
    .from(mandateJournals)
    .where(and(eq(mandateJournals.tenantId, tenantId), eq(mandateJournals.cycleId, currentCycleId)));

  let scanned = 0;
  let updated = 0;

  for (const current of currentJournals) {
    const prior = await db.getLastMandateJournal(
      current.personId,
      current.dimensionKey,
      currentCycleId,
      tenantId,
    );
    if (!prior) continue;
    const priorItems = (prior.planItems ?? []) as PlanItem[];
    if (priorItems.length === 0) continue;
    scanned += 1;

    try {
      const verdicts = await classifyPlanItems(priorItems, current.logText ?? "");
      if (verdicts === null) {
        // LLM returned an unusable response — do not patch this journal
        continue;
      }
      const patched = priorItems.map((it, i) => ({
        ...it,
        completedNextMonth:
          verdicts[i] === "ADDRESSED" || verdicts[i] === "PARTIAL"
            ? true
            : verdicts[i] === "DEFERRED" || verdicts[i] === "NOT_MENTIONED"
              ? false
              : it.completedNextMonth,
      }));
      await db.updateJournalPlanItems(prior.id, patched, tenantId);
      updated += 1;
    } catch (err) {
      console.warn("[ai-commitment] classification failed for journal", prior.id, err);
    }
  }

  return { scanned, updated };
}

/**
 * Find chronic deferrals: items that appeared in planItems across
 * `lookbackCycles` consecutive cycles without ever being marked
 * completedNextMonth=true. Matching is intentionally naive (case-
 * insensitive substring overlap on normalised item text) because LLM
 * re-matching is expensive; false-positives are less harmful than
 * false-negatives here.
 */
export async function findChronicDeferrals(
  tenantId: number,
  personId: number,
  lookbackCycles: number = 3,
) {
  const database = await getDb();
  if (!database) return [];

  const cycles = await database
    .select()
    .from(governanceCycles)
    .where(eq(governanceCycles.tenantId, tenantId))
    .orderBy(desc(governanceCycles.month))
    .limit(lookbackCycles);
  if (cycles.length < lookbackCycles) return [];

  const cycleIds = cycles.map((c) => c.id);
  const journals = await database
    .select()
    .from(mandateJournals)
    .where(and(eq(mandateJournals.tenantId, tenantId), eq(mandateJournals.personId, personId)));

  // For each dimension, collect planItems per cycle. Look for item strings
  // that repeat across >= lookbackCycles cycles and never were completed.
  const byDim: Record<string, Record<number, PlanItem[]>> = {};
  for (const j of journals) {
    if (!cycleIds.includes(j.cycleId)) continue;
    const dim = (byDim[j.dimensionKey] ??= {});
    dim[j.cycleId] = (j.planItems ?? []) as PlanItem[];
  }

  const chronic: Array<{ dimensionKey: string; item: string; cycleIds: number[] }> = [];
  const norm = (s: string) => s.trim().toLowerCase();

  for (const [dim, perCycle] of Object.entries(byDim)) {
    if (Object.keys(perCycle).length < lookbackCycles) continue;

    // Start from oldest items in the window; if the same item appears in
    // every cycle AND none of them marked it completed, flag it.
    const allCycleIds = Object.keys(perCycle).map(Number).sort((a, b) => a - b);
    const oldestItems = perCycle[allCycleIds[0]] ?? [];
    for (const base of oldestItems) {
      const baseNorm = norm(base.item);
      if (baseNorm.length < 5) continue;

      const appearsInAll = allCycleIds.every((cid) =>
        (perCycle[cid] ?? []).some((it) => norm(it.item).includes(baseNorm) || baseNorm.includes(norm(it.item))),
      );
      const everCompleted = allCycleIds.some((cid) =>
        (perCycle[cid] ?? []).some(
          (it) =>
            (norm(it.item).includes(baseNorm) || baseNorm.includes(norm(it.item))) &&
            it.completedNextMonth === true,
        ),
      );

      if (appearsInAll && !everCompleted) {
        const already = chronic.find((c) => c.dimensionKey === dim && norm(c.item) === baseNorm);
        if (!already) {
          chronic.push({ dimensionKey: dim, item: base.item, cycleIds: allCycleIds });
        }
      }
    }
  }

  return chronic;
}

/**
 * Scan every person in the tenant for chronic deferrals. Used by the
 * Chairman dashboard summary.
 */
export async function findChronicDeferralsForTenant(tenantId: number, lookbackCycles: number = 3) {
  const database = await getDb();
  if (!database) return [];
  const allPersons = await database.select().from(persons).where(eq(persons.tenantId, tenantId));
  const out: Array<{ personId: number; personName: string; dimensionKey: string; item: string; cycleIds: number[] }> = [];
  for (const p of allPersons) {
    const chronic = await findChronicDeferrals(tenantId, p.id, lookbackCycles);
    for (const c of chronic) {
      out.push({ personId: p.id, personName: p.name, ...c });
    }
  }
  return out;
}
