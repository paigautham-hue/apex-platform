# governance-admin

> Last updated: 2026-04-21

## Purpose

The **Chairman/Admin control panel** — single page where the
Chairman bootstraps a tenant's governance machinery: create
cycles, configure feedback types (self/chairman/peer/upward +
custom), seed assessment assignments. Reached at
`/governance-admin`.

Per master plan §5.3 — most cycle launches happen here. The
flip side is `chairman-surface.md` (read-only dashboard) and
`governance-cycle.md` (the cycle runtime itself).

## Scope

- Files: 1 page
- tRPC endpoints called: 8+ via `governanceRouter`
- Tables touched: `governanceCycles`, `feedbackTypes`,
  `assessmentAssignments`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/GovernanceAdmin.tsx` | ~442 lines. Tabs: **Cycles** (create + list), **Feedback Types** (CRUD), **Generate Assignments** (kick off self/chairman/peer/upward for the active cycle). Gated by `amIChairman`. | `GovernanceAdmin` (default) |

## Functions

### Page-level

- **`createCycle` mutation** — `governance.createCycle`. Creates
  a new month-keyed cycle (`status: ACTIVE`).
- **`createFeedbackType` / `updateFeedbackType`** — Per-tenant
  feedback type CRUD (`key`, `label`, `visibilityRule`,
  `cadence`, `isBlind`, `isActive`).
- **`generateAssignments`** — Builds `assessmentAssignments`
  rows for a given feedback type. Returns
  `{ count, skipped }` (skipped = already-existing dedup hits).
- Local state: `newType`, `newMonth`, `assignmentType`,
  `perAssessor`.

## Data Touched

- Writes: `governanceCycles`, `feedbackTypes`,
  `assessmentAssignments`.
- Reads: same + `getActiveCycle` for default cycle context.

## External Dependencies

- `sonner` for toast feedback.
- shadcn UI (Tabs, Table, Select, Switch).

## Internal Conventions

1. **Chairman-only.** Renders a "Not authorised" card for
   anyone else.
2. **Idempotent assignment generation.** The router dedupes by
   `(cycleId, assessor, target, feedbackType)`.
3. **Visibility rule defaults to `AFTER_ALL_SUBMIT`.** Same
   reveal-gating contract as `governance-cycle.md`.
4. **Cadence is informational only on `feedbackTypes`.** Actual
   scheduling lives elsewhere (`rhythm-engine.md`).

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `governance-cycle.md` | `createCycle`, `getActiveCycle`, assignment helpers. |
| `auth-rbac.md` | `amIChairman` gate. |
| `data-model.md` | Cycles + feedback-type schemas. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | Linked from Chairman dashboard. |
| `360-feedback.md` | Manager-trigger path runs through `triggerForMyTeam`, not this page. |
| `rhythm-engine.md` | Reads the cycles created here. |

## Fragility Notes

### "Generate assignments" can re-run unbounded

Each click re-fans across all subordinates. Idempotent (dedup),
but a Chairman who clicks impatiently can spam the DB. **Defense:**
button disables during mutation; UI shows skipped count.

### Feedback-type `key` is a free-text input

A typo (`peer ` with trailing space) creates a parallel type the
engine doesn't match. **Defense:** validate against constant
allowlist in `shared/const.ts`; Phase 2 enforce in router.

### Cycle creation doesn't archive prior

Creating a new cycle with `status: ACTIVE` doesn't auto-close
the prior. `getActiveCycle` returns whichever the DB returns
first. **Defense:** Phase 1 — `createCycle` should transition the
prior cycle to `CLOSED` in the same transaction.

### No "preview" before generating

Generate-assignments commits immediately. A misconfigured
feedback type (wrong `isBlind`) creates real rows that downstream
users see. **Phase 2** add a dry-run mode returning the row count
without insert.

### `perAssessor` field is page-only

The "3 peers per assessor" knob lives in component state and is
sent to the router each call. There's no persistence — a Chairman
who set 5 last cycle has to re-set. **Acceptable** (low-frequency
action).
