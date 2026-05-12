# ai-insights

> Last updated: 2026-04-21

## Purpose

The **AI insight generator** — at cycle close, runs 5 batch
analysers and writes `aiInsights` rows that surface on the
Chairman dashboard (and, via `rhythm-engine`, on per-user
PrimaryActionCard). 5 insight categories: PERCEPTION_GAP,
COMMITMENT_TRACKING, ENGAGEMENT_PATTERN, CHAIN_RISK,
FINANCIAL_MISMATCH.

## Scope

- Files: 1 server module + 1 router + 1 client component
- tRPC endpoints: 3 (`runInsightGeneration`, `listInsights`,
  `listInsightsForTarget`)
- Tables touched: `aiInsights`, many sources

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/ai-insights-generator.ts` | ~260 lines. 5 generator functions + an orchestrator `generateAllInsights`. Writes rows to `aiInsights` with severity (INFO/WARNING/CRITICAL) and `surfaceToPersonIds` for targeting. | `generatePerceptionGapInsights`, `generateCommitmentInsights`, `generateEngagementInsights`, `generateChainRiskInsights`, `generateFinancialMismatchInsights`, `generateAllInsights` |
| `server/routers/insights.ts` | tRPC router for insights. ~254 lines. Listing, marking as read, etc. | `insightsRouter` |
| `server/routers.ts` (`governanceRouter.runInsightGeneration`, `listInsights`, `listInsightsForTarget`) | The batch-run endpoints in the governance router. | (mounted) |
| `client/src/components/InsightsInbox.tsx` | The inbox UI rendered on `/me`. Lists the user's surfaced insights with severity badges + dismiss/act actions. ~135 lines. | `InsightsInbox` |

## Functions

### `server/ai-insights-generator.ts`

- **`generatePerceptionGapInsights(tenantId, cycleId)`** —
  Cross-references self vs chairman assessments on the same
  target/dimension. Flags gaps ≥2 as WARNING / ≥3 as CRITICAL.
  **Round-1 fix:** scores cast with `Number()` (decimals come
  back as strings — see data-model.md fragility).

- **`generateCommitmentInsights(tenantId, cycleId)`** — Calls
  `findChronicDeferralsForTenant` and writes one
  `COMMITMENT_TRACKING` row per chronic.

- **`generateEngagementInsights(tenantId, cycleId)`** — For each
  person, if zero `mandateJournals` rows in cycle → write WARNING.

- **`generateChainRiskInsights(tenantId, cycleId)`** — Per
  dependency chain, computes weakest-link chairman score. Flags
  ≤5 as WARNING / ≤3 as CRITICAL. **Round-1 fix:** when a chain
  has members but no chairman assessments, write INFO insight
  rather than silently skipping.

- **`generateFinancialMismatchInsights(tenantId, cycleId)`** —
  For each portfolio company, computes Q1-YTD vs FY27-budget
  variance. Flags ≥15% off as WARNING / ≥25% as CRITICAL.
  **Round-1 fix:** explicit budget null-check + explicit `number`
  type cast.

- **`generateAllInsights(tenantId, cycleId)`** — Orchestrator;
  runs all 5 in parallel.

## Data Touched

- Writes: `aiInsights`.
- Reads (per generator):
  - Perception: `governanceAssessments` + `feedbackTypes`.
  - Commitment: `mandateJournals` (via `findChronicDeferrals`).
  - Engagement: `mandateJournals` + `persons`.
  - Chain: `dependencyChains` + `governanceAssessments`.
  - Financial: financial summaries via `db.ts`.

## External Dependencies

- LLM gateway (for COMMITMENT_TRACKING text generation —
  optional today).

## Internal Conventions

1. **`surfaceToPersonIds[]`** is the targeting field. Empty array
   means "surface to everyone" (fund-wide insights). Non-empty
   narrows.
2. **Severity drives the UI.** CRITICAL bubbles to
   PrimaryActionCard tier 1; WARNING goes to InsightsInbox; INFO
   is visible only on /chairman.
3. **All inserts go through `db.createAiInsight`** — wrapped in
   try/catch so a single generator failure doesn't block others.
4. **Batch runs at cycle close** (or on-demand from the Chairman
   dashboard).

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `ai-llm-gateway.md` | LLM call. |
| `db-layer.md` | `createAiInsight`, `getAssessmentsByCycle`, `getDependencyChainsByTenant`, `getFinancialSummariesByTenant`, etc. |
| `ai-commitment.md` | `findChronicDeferralsForTenant`. |
| `governance-cycle.md` | Cycle state for triggering generation. |
| `data-model.md` | `aiInsights` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | `listInsights` for the AI Insights panel + Generate Insights button. |
| `rhythm-engine.md` | Tier 1 critical-insight surfacing. |
| `me-surface.md` | `InsightsInbox` rendered on `/me`. |

## Fragility Notes

### `surfaceToPersonIds` empty-default

Empty array means "everyone." A buggy generator that forgets to
populate could surface a private insight to all users.
**Defense:** every generator explicitly populates this field.
**Document the contract** in the schema column comment (see
rhythm-engine.md fragility notes).

### CRITICAL insight surfacing hides cycle-deadline pressure

Per rhythm-engine.md fragility — a CRITICAL insight hides the
deadline warning. A real risk during cycle close: a Chairman-
generated critical insight on cycle-N might obscure the cycle-N+1
deadline.

### LLM cost during regenerate

`runInsightGeneration` regenerates all 5 categories on demand. If
the Chairman clicks repeatedly, cost balloons. No throttle today.
Phase 1 Tier C add a cooldown (e.g. once per hour).

### Insight rows aren't deduped

Re-running on the same cycle creates duplicate rows. The Chairman
dashboard shows the latest but old ones linger in DB. **Defense:**
on re-run, delete prior rows for the cycle first (or version
them).

### No insight expiry today

`aiInsights.createdAt` is the only freshness signal. Old insights
from prior cycles are still in the table. **Acceptable** — the
chairman dashboard filters by `cycleId`. But the
`InsightsInbox` on /me doesn't filter, and a user with months of
unread insights sees a long list.

### Variance computation assumes only QUARTERLY periodType

`generateFinancialMismatchInsights` sums QUARTERLY actuals.
Other periodTypes (MONTHLY, CUMULATIVE_YTD) aren't included. Some
companies may report monthly. Phase 1 Tier C handle multiple
period types.
