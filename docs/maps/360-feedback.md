# 360-feedback

> Last updated: 2026-04-21

## Purpose

The **fractal 360 cycle generator** — any leader (Chairman, Group
CEO, CEO, CXO) with direct reports can spin up a 360 round on
their team. Generates `assessmentAssignments` rows so each
subordinate is rated by self / peers / leader (downward) /
subordinates (upward). Same engine reused at every layer of the
org tree.

The actual assessment writes go through the standard
`governance-cycle.md` flow — this map is just the **assignment
generation + feedback-type bookkeeping**. Visualisation lives on
`/threesixty` (radar chart from peer/upward/downward scores) and
on `PersonProfile`.

## Scope

- Files: 1 server module + 1 router + 1 page
- tRPC endpoints: 2 (`ensureFeedbackTypes`, `triggerForMyTeam`)
- Tables touched: `feedbackTypes`, `roles`,
  `assessmentAssignments`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/360-engine.ts` | ~159 lines. `generate360Assignments` builds the cartesian product of (subordinate × feedback type), dedups against existing rows, inserts. **Peer sampling: 3 random peers per subordinate** (`sort(() => Math.random() - 0.5).slice(0, 3)`). | `generate360Assignments` |
| `server/routers/threeSixty.ts` | ~87 lines. tRPC. `ensureFeedbackTypes` (Admin-only, idempotent) seeds peer/upward/downward `feedbackTypes` rows. `triggerForMyTeam` runs the engine against the caller's primary role. | `threeSixtyRouter` |
| `client/src/pages/ThreeSixty.tsx` | ~318 lines. Visualisation page. Radar chart of self vs peer vs upward vs downward across competency dimensions. Drill-down into per-rater verbatim comments. | `ThreeSixty` (default) |

## Functions

### `server/360-engine.ts`

- **`generate360Assignments({ tenantId, cycleId, leaderRoleId,
  includePeer, includeUpward, includeDownward,
  deadlineDays })`** —
  1. Loads active `feedbackTypes` for tenant; matches by key
     (`self`, `peer`, `upward`, `chairman`/`leader`/`downward`).
  2. Loads subordinate roles (`reportsToRoleId = leaderRoleId,
     isActive = true`).
  3. Builds candidate rows: self always; downward (leader →
     each sub); peer (each sub → 3 random peers); upward (each
     sub → leader).
  4. **Dedups** against existing `assessmentAssignments` for the
     cycle by `(assessor, targetType, targetId, feedbackTypeId)`.
  5. Bulk-inserts the fresh rows. Returns `{ created }`.

### `server/routers/threeSixty.ts`

- **`ensureFeedbackTypes`** — Admin-only mutation. Idempotently
  inserts `peer` (blind, monthly), `upward` (blind, monthly),
  `downward` (not blind, monthly) feedback types if absent.
- **`triggerForMyTeam`** — Caller must have direct reports and
  an active primary role. Runs `generate360Assignments`.

## Data Touched

- Reads: `feedbackTypes`, `roles` (reportsToRoleId graph),
  `assessmentAssignments` (for dedup).
- Writes: `feedbackTypes` (one-time bootstrap),
  `assessmentAssignments`.

## External Dependencies

- `drizzle-orm`.

## Internal Conventions

1. **Fractal — same engine, every layer.** Chairman runs on Group
   CEO team, Group CEO runs on CEO team, CEO runs on CXO team.
2. **`reportsToRoleId` is the only structural source.** No
   peer-group table — peers = "same reportsToRoleId."
3. **Peer assessments are blind by default** (`isBlind: true`).
   The aggregate is visible; per-rater identity is not.
4. **Visibility = `AFTER_ALL_SUBMIT`.** Same gating as the rest
   of the governance cycle.
5. **Re-running is idempotent** — dedup key prevents duplicate
   assignments.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `feedbackTypes`, `assessmentAssignments`, `roles`. |
| `db-layer.md` | `getPersonByUserIdOrEmail`. |
| `scope.md` | `directReportPersonIds`, `primaryRole`. |
| `auth-rbac.md` | `adminProcedure` for `ensureFeedbackTypes`. |
| `org-tree.md` | `reportsToRoleId` graph defines peer cohorts. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `governance-cycle.md` | Assignments flow into the standard cycle reveal/submit flow. |
| `chairman-surface.md` | Trigger-360 button on Chairman dashboard. |
| `people-pages.md` | PersonProfile renders 360 radar. |
| `team-surface.md` | Manager triggers 360 on direct reports. |

## Fragility Notes

### Random peer sampling isn't seeded

`peers.sort(() => Math.random() - 0.5).slice(0, 3)` — re-running
on a cycle that has new peers reshuffles. Once an assignment
exists, dedup protects it, but a NEW assignment in a re-run
might pick different peers. **Defense:** acceptable for monthly
cycles; if rigour demanded, seed by `(subId, cycleId)` hash.

### `Math.random` sort is biased

The standard `sort(() => Math.random() - 0.5)` trick isn't a
uniform shuffle (sort comparator violation). Real peer cohorts
in current scope are 3-5 people — bias is irrelevant. **Phase 2**
swap to Fisher-Yates if cohort sizes grow.

### Cohorts < 4 people get fewer than 3 peers

`peers.filter(s => s.id !== sub.id)` may yield only 2 candidates;
`slice(0, 3)` returns all of them. Acceptable — small teams
inherently have less peer signal.

### Feedback-type keys are stringly-typed

`f.key === "self"` etc. A typo on insert breaks the engine
silently (no `feedbackTypeId` → branch skipped). **Defense:**
shared/const.ts exports the key constants — use those.

### `downward` matches three keys

`f.key === "chairman" || f.key === "leader" || f.key ===
"downward"` — historical drift between seed data and rename
attempts. Pick one (`downward`) and migrate; today the OR keeps
backward-compat.

### Generated assignments don't have a triggeredBy field

We don't record WHO ran the 360. If two leaders coincidentally
trigger on overlapping subtrees, the audit trail is muddy.
**Phase 2** add `triggeredByPersonId` column on
`assessmentAssignments`.

### Deadline is uniform per run

All assignments get `dueDate = now + deadlineDays`. No
per-feedback-type customisation. Acceptable today; Phase 2 may
want peer due in 7 days and downward in 14.

### Self assignment created even if subordinate already submitted

Dedup is on `(assessor, target, feedbackType)` so self
assignments don't duplicate, but a subordinate who already
submitted self in this cycle (via the standard flow) is now
shown a SECOND self assignment if the engine fires before that
write lands. **Acceptable race** — extra row is no-op on submit
because of cycle/feedbackType unique key elsewhere.
