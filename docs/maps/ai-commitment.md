# ai-commitment

> Last updated: 2026-04-21

## Purpose

The **commitment tracker** — classifies whether last cycle's plan
items were addressed in this cycle's log. Surfaces "chronic
deferrals" (commitments deferred 3+ consecutive cycles) on the
Chairman dashboard.

This is the LLM-driven half of plan-to-log tracking. The
human-checkbox half is `mandate-journals.md:markPriorPlanItem`.

## Scope

- Files: 1 server module
- tRPC endpoints: 2 (`runCommitmentTracker`,
  `listChronicDeferrals`)
- Tables touched: `mandateJournals`, `governanceCycles`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/ai-commitment.ts` | ~278 lines. `classifyPlanItems` calls the LLM with structured output. `runCommitmentTrackerForCycle` orchestrates per-journal classification. `findChronicDeferrals` + `findChronicDeferralsForTenant` walk the recent N cycles for chronic patterns. In-memory lock prevents concurrent runs. | `classifyPlanItems`, `runCommitmentTrackerForCycle`, `findChronicDeferrals`, `findChronicDeferralsForTenant` |
| `server/routers.ts` (`governanceRouter.runCommitmentTracker`, `listChronicDeferrals`) | The 2 endpoints. Chairman/Admin only. | (mounted) |

## Functions

### `server/ai-commitment.ts`

- **`classifyPlanItems(priorItems, logText)`** — LLM call with
  JSON schema. Output: per-item verdict `ADDRESSED` / `PARTIAL` /
  `DEFERRED` / `NOT_MENTIONED`. **Round-1 fix:** strict length +
  value validation. Returns `null` (caller skips) on length
  mismatch or invalid verdict — no longer silently corrupts
  `completedNextMonth` by misaligning.

- **`runCommitmentTrackerForCycle(tenantId, cycleId)`** —
  Iterates current-cycle journals, finds each one's prior-cycle
  sibling, calls `classifyPlanItems`, writes back to prior
  journal's `planItems.completedNextMonth`. **Round-1 fix:**
  in-memory `runningCommitmentTracker` Set lock prevents
  duplicate concurrent runs (and duplicate LLM spend).

- **`findChronicDeferrals(tenantId, personId, N)`** — Walks last N
  cycles' planItems for the person. Naive substring matching on
  normalized item text. Flags items that appear in every cycle
  window without `completedNextMonth=true`.

- **`findChronicDeferralsForTenant(tenantId, N)`** — Fan-out across
  every person in the tenant.

## Data Touched

- `mandateJournals` — read (current + prior cycle) and write
  (via `updateJournalPlanItems` on prior cycle).
- `governanceCycles` — read (cycle ordering).
- `persons` — read (chronic-deferrals fan-out).

## External Dependencies

- LLM gateway.
- `drizzle-orm`.

## Internal Conventions

1. **Run at cycle close.** The commitment tracker is meaningful
   only when the current cycle has logs to compare against. Cron/
   admin-triggered, not background.
2. **Lock per (tenantId, cycleId).** No concurrent runs.
3. **Strict LLM output validation.** Length mismatch returns
   null; downstream skip.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `ai-llm-gateway.md` | `invokeLLM`. |
| `db-layer.md` | `getLastMandateJournal`, `updateJournalPlanItems`, `getPersonsByTenant`. |
| `mandate-journals.md` | `mandateJournals.planItems` shape. |
| `auth-rbac.md` | Chairman/Admin gate. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | Run Commitment Tracker button + Chronic Deferrals table. |
| `ai-insights.md` | `findChronicDeferralsForTenant` results feed `COMMITMENT_TRACKING` insights. |

## Fragility Notes

### Chronic deferral matching is substring-based

A plan item rephrased between cycles ("close Bharti deal" vs "land
Bharti agreement") may not match. The deferral isn't flagged.
**Defense:** Phase 3 — use embedding similarity for matching.

### `forwardCommitments` (company reflections) not scanned

The commitment tracker only scans `mandateJournals.planItems`. A
CEO's company-level `forwardCommitments` are invisible.
**Phase 3 unification** scans both.

### Cycle ordering assumes monotonic `cycleId`

`getLastMandateJournal` orders by `cycleId DESC`. Same fragility as
mandate-journals.md "Plan-to-log lookup uses cycleId DESC not
month DESC."

### Cost per run

Each journal classification is one LLM call. A full tenant scan
at 27 users × 7 mandates = 189 LLM calls per cycle. ~$0.30 per
run. Acceptable.

### In-memory lock doesn't survive server restart

If the server restarts mid-run, the lock disappears. **Acceptable
today** (small user base, short runs). Phase 3 add a DB-backed
lock.
