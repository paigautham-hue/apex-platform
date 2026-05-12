# decisions

> Last updated: 2026-04-21

## Purpose

The **decision log** — capture a decision with its assumptions,
expected outcome, identified risks, and a review date. Lets a
leader come back later and see whether the call worked out.

Per master plan §5.4 — decisions are first-class governance
evidence: they explain WHY metrics moved the way they did.

## Scope

- Files: 1 page
- tRPC endpoints: 2 (`decision.create`, `decision.getMyDecisions`)
- Tables touched: `decisions`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Decisions.tsx` | ~155 lines. Form: decision text (min 10), assumptions[], expected outcome, risks[], review date, linked metric ids. Lists caller's decisions. | `Decisions` (default) |

## Functions

### `decisionRouter` (server/routers.ts:534+)

- **`create`** — Mutation. `{ tenantId, orgUnitId?,
  decisionText, assumptions?[], expectedOutcome?,
  risksIdentified?[], reviewDate?, linkedMetricIds?[] }`.
  Stamps `ownerPersonId = caller`.
- **`getMyDecisions`** — `decisions WHERE ownerPersonId =
  caller`.

## Data Touched

- Writes: `decisions`.
- Reads: `decisions` (own).

## External Dependencies

- shadcn UI.

## Internal Conventions

1. **Append-only.** Decisions are not editable post-creation —
   the audit value depends on it.
2. **`reviewDate` is informational.** No scheduler today wakes
   up to remind the owner; the dashboard surfaces overdue
   reviews on the day.
3. **`linkedMetricIds` is an array, no FK validation.** Stale
   ids quietly become dangling.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `createDecision`, `getDecisionsByOwner`. |
| `data-model.md` | `decisions` schema. |
| `auth-rbac.md` | `protectedProcedure`. |
| `org-tree.md` | `orgUnitId` (optional) |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `me-surface.md` | "Overdue decisions" tier in rhythm engine. |
| `ai-review.md` | Living review references logged decisions. |
| `analytics.md` | Decision count + outcome (when reviewed). |

## Fragility Notes

### No "review outcome" field

A decision can have `reviewDate` but no place to record the
retrospective ("worked / didn't / why"). The whole point of
logging decisions is reviewing them. **Phase 1 Tier B blocker**
— add `reviewedAt`, `outcome` enum, `reviewNotes`.

### `linkedMetricIds[]` not validated

A decision can claim to be linked to metric 999999 that doesn't
exist. **Defense:** Phase 2 router validates ids belong to
caller's accessible plans.

### `orgUnitId` optional and unchecked

When provided, no `canViewOrgUnit` check. **Phase 1 Tier B** add
scope check.

### No "decisions about me" inbox

Subordinates can't see decisions their leader made affecting
them. **Phase 3** ties this into the trust contract — material
decisions surface in the affected person's inbox.

### Review-date overdue isn't bubbled

The rhythm engine (`rhythm-engine.md`) doesn't currently tier
overdue decision reviews. **Phase 1 Tier C** add as Tier 4.

### `expectedOutcome` is unstructured text

Can't be measured against actual outcome programmatically. AI
could compare, but no schema today. Acceptable.
