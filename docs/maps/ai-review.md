# ai-review

> Last updated: 2026-04-21

## Purpose

The **legacy living-review-draft pipeline** — generates a draft
performance review for a person from their observations + evidence
+ plans + values-alignment signals. Predates the governance-cycle
flow; kept transitionally per master plan §7 anti-list.

When the cascade is fully realised and the governance cycle has
3+ months of clean data, the living-review system can probably be
sunset. Until then it's the only path for the older
MILESTONE/QUARTERLY/ANNUAL review type.

## Scope

- Files: 1 page + 2 server modules
- tRPC endpoints: 3 (`review.getDraftByPerson`, `saveDraft`,
  `finalize`)
- Tables touched: `reviews`, `assessments`, `observations`,
  `evidence`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/ReviewDraftPreview.tsx` | The page where a manager edits the AI-generated draft for a report. Section-by-section editing with voice input. | `ReviewDraftPreview` (default) |
| `server/ai-review.ts` | The draft generation pipeline. ~263 lines. Builds prompt from observations + plans + values, calls LLM with structured output (JSON schema for full review shape), returns the draft. | `generateReview`, `assessValuesAlignment` |
| `server/living-review-draft.ts` | Lifecycle wrapper — saving drafts, marking as final, version tracking. | (functions per use case) |
| `server/routers.ts` (`appRouter.review.*`) | The 3 endpoints. | (mounted) |

## Functions

### `server/ai-review.ts`

- **`generateReview({ personId, tenantId, periodStart,
  periodEnd })`** — Pulls observations + evidence + plans for the
  person in the period. Prompts the LLM with the structured-output
  schema (summary, strengths, development areas, values
  alignment, overall rating 1-5, confidence 0-1). Returns
  `GeneratedReview`.

- **`assessValuesAlignment({ personId, tenantId })`** — Sub-call
  that scores the person against the fund's core values from
  `shared/constants.ts`. **Was previously a Math.random() stub
  in v1; Round-2 fix replaced with a real LLM call that requests
  JSON output and falls back to score=0 + observation excerpts
  when the model doesn't return usable data.**

## Data Touched

- `reviews` — read+write.
- `assessments` — read+write (legacy assessment rows).
- `observations` — read.
- `evidence` — read.
- `plans` — read.
- `persons` — read.

## External Dependencies

- LLM gateway.
- `drizzle-orm`.

## Internal Conventions

1. **Append-only draft history** — saving a draft creates a new
   version; the old one stays.
2. **`finalize` is a one-way state transition** — once final,
   the draft is locked. New reviews require a new period.
3. **`status` enum:** DRAFT / IN_REVIEW / FINAL.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `ai-llm-gateway.md` | LLM call. |
| `db-layer.md` | `getReviewsByPerson`, `updateReview`, plus observation / evidence / plan helpers. |
| `data-model.md` | `reviews`, `assessments` schemas. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `people-pages.md` | (Could link to review draft, but doesn't today.) |

## Fragility Notes

### Coexists with governance cycle

The living-review system and the governance-cycle system are
parallel review paths. **No reconciliation logic** — a person can
have both a 2024-Q4 quarterly review (legacy) and a 2026-Apr
cycle assessment (new). The AI surfaces don't combine them.
**Master plan §2 known tech debt #2.**

### `assessValuesAlignment` previously returned random scores

Round-2 fix replaced the Math.random() stub with a real LLM call.
**Be aware that historical `assessments` rows generated before
the fix may contain fabricated scores.** A cleanup migration to
re-score them or mark them as low-confidence is worth queuing.

### `generateReview` is expensive

Bundles up to 1000 observations + plans + values evaluation in
one LLM call. Cost per draft ~$0.10. **Defensive coding:** cache
the draft (already done via `reviews.aiGeneratedDraft` JSON
column), don't regenerate on every page load.

### Period boundaries aren't strict

A reviewer can ask for an arbitrary period start/end. If they pick
a period that straddles a cycle boundary, observations from both
cycles are included. **Acceptable** — the reviewer chose the
period.
