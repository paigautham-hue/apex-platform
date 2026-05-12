# governance-cycle

> Last updated: 2026-04-21

## Purpose

The **monthly governance cycle is APEX's heartbeat.** This map covers
the cycle state machine, the per-assessor write path, the assignment
distribution machinery, the feedback-type configuration system, and
the reveal-gating engine that decides who sees what when.

Without this subsystem, APEX is just a database of org charts. With
it, the monthly rhythm (per master plan §1, §3.7) runs.

## Scope

- Files in this map: 4
- tRPC endpoints documented: ~25 in `governanceRouter`
- Tables touched: 4 governance-core tables (`governanceCycles`,
  `governanceAssessments`, `assessmentAssignments`, `feedbackTypes`)
- Plus: `dependencyChains`, `aiInsights` (read here, written
  elsewhere)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers.ts` (the `governanceRouter` sub-router, lines ~815-1480) | The single sub-router that owns cycle ops, assessment writes, assignment generation, feedback-type CRUD, plus convenience reads for chairman dashboard. Mounted on `appRouter.governance`. | `governanceRouter` (the export is implicit via the merged `appRouter`) |
| `server/reveal-gating.ts` | Tier-agnostic visibility enforcement. Replaces the original chairman-hardcoded reveal logic. Honors `feedbackTypes.visibilityRule` for ANY assessor tier (self / chairman / peer / upward / future). | `VisibilityContext`, `isAssessmentVisibleToTarget`, `filterVisibleAssessments` |
| `server/360-engine.ts` | 360-feedback orchestration (the cross-tier aggregation layer that uses governance assessments as its source). **Detailed in `360-feedback.md`** — listed here because it's a primary consumer of this map's data. | (see `360-feedback.md`) |
| `server/routers/threeSixty.ts` | 360-feedback tRPC endpoints. **Detailed in `360-feedback.md`.** | (see `360-feedback.md`) |

## Functions

### `server/routers.ts` — `governanceRouter` (the cycle endpoints)

Organised in source order. Every procedure is `protectedProcedure`
unless noted.

**Cycles (CRUD + state machine):**

- **`listCycles({ tenantId })`** at `:817` — Returns all cycles for
  a tenant, sorted by `month` descending.
- **`getActiveCycle({ tenantId })`** at `:823` — Returns the
  cycle with `status='OPEN'` (or null). One row max.
- **`getCycleByMonth({ month, tenantId })`** at `:829`.
- **`createCycle({ tenantId, month, openDate?, deadlineDate? })`**
  at `:835` — **Gated by `isChairmanOrAdmin`**. Inserts a `DRAFT`
  cycle. The `month` is a `YYYY-MM` string.
- **`updateCycleStatus({ cycleId, tenantId, status })`** at `:856`
  — **Gated by `isChairmanOrAdmin`**. Mutates the cycle's state
  through `DRAFT → OPEN → CLOSED → REVEALED`. Side effect: on
  `OPEN`, fires `governanceNotifications.notifyCycleOpen` (fan-out
  to every person). On `REVEALED`, fires `notifyCycleReveal`. Both
  are fire-and-forget.
- **`amIChairman({ tenantId })`** at `:883` — Cheap client-side
  gate. Returns the boolean from `db.isChairmanOrAdmin(ctx.user.id,
  tenantId)`.

**Feedback types:**

- **`listFeedbackTypes({ tenantId })`** at `:890` — Active types
  only, ordered by `sortOrder`.
- **`listAllFeedbackTypes({ tenantId })`** at `:896` — Includes
  inactive (for admin UI).
- **`createFeedbackType(...)`** at `:902` — **Chairman/Admin only.**
  Inserts a new feedback type (peer, upward, custom).
- **`updateFeedbackType({ id, tenantId, patch })`** at `:940` —
  **Chairman/Admin only.** Partial update.

**Assessment writes:**

- **`upsertAssessment({ ... })`** at `:982` — The big one. Takes
  `tenantId`, `cycleId`, `targetType` (`ROLE`/`COMPANY`/`CHAIN`),
  `targetId`, `dimensionKey`, `feedbackTypeId`, `score`, `rag`,
  `note`, `confidenceNote`, and a `submit: boolean` flag.
  - Resolves the caller's `person` via `getPersonByUserId`.
  - Calls `db.upsertGovernanceAssessment(...)` — matches on the
    composite logical key (assessor+cycle+target+dimension+
    feedbackType), updates if found, inserts otherwise.
  - If `submit: true` AND `feedbackType.key === 'chairman'`,
    notifies the target via
    `governanceNotifications.notifyChairmanSubmittedForRoleTarget`
    or `...ForCompanyTarget`.
- **`getMyAssessments({ tenantId, cycleId })`** at `:1080` — Returns
  assessments the caller has authored this cycle. Used by /my-bridge
  /my-island to rehydrate.
- **`getAssessmentsForTarget({ tenantId, cycleId, targetType,
  targetId })`** at `:1090` — Used by ChairmanAssess + ThreeSixty
  + perception-gap computation in ChairmanDashboard.
- **`listAssessments({ tenantId, cycleId })`** at `:1444` — Returns
  every assessment in the cycle. Used by ChairmanDashboard for
  fund-wide rollups.

**Assignments:**

- **`getMyAssignments({ tenantId, cycleId })`** at `:1108` — Returns
  assignments where the caller is the assessor.
- **`listAssignments({ tenantId, cycleId })`** at `:1115` — All
  assignments in the cycle. Used by ChairmanDashboard pending-
  submissions table.
- **`generateAssignments({ tenantId, cycleId, feedbackTypeKey,
  perAssessor?, dueDate? })`** at `:1188` — **Chairman/Admin only.**
  Synthesises assignments based on the feedback-type rule:
    - `self` — assigns every CXO/CEO/GROUP_CEO/GROUP_CHRO role to
      themselves; CEOs additionally assigned their company.
    - `chairman` — assigns the Chairman role to every CXO/CEO/company.
    - `peer` — randomly picks `perAssessor` peers per CXO.
    - `upward` — every CEO is assigned every CXO.
  - **Dedup:** the procedure checks existing assignments by
    `(assessorPersonId, targetType, targetId, feedbackTypeId)` and
    skips dupes. Returns `{ count, skipped }`.
- **`markPriorPlanItem({...})`** — covered in
  `mandate-journals.md`.

**Mandate journals + company reflections + chairman guidance:**

These live in this router but are detailed in their own maps:

- **`upsertJournal`** — see `mandate-journals.md`.
- **`getMyJournals`**, **`getLastJournal`** — see
  `mandate-journals.md`.
- **`upsertReflection`** — see `company-reflections.md`.
- **`getReflection`**, **`listReflections`** — see
  `company-reflections.md`.
- **`createGuidance`** — see `chairman-guidance.md`.
- **`getGuidanceForTarget`** — see `chairman-guidance.md`.

**Other governance-router endpoints (cross-cutting reads):**

- **`listFinancialSummaries`** — covered in `financial-cockpit.md`.
- **`canEditCompanyFinancials`**, **`writeQuarterlyActual`** —
  `financial-cockpit.md`.
- **`listChains`** — `org-tree.md` (dependency chains).
- **`listInsights`**, **`listInsightsForTarget`** —
  `ai-insights.md`.
- **`listRoles`** — covered here as a chairman-dashboard helper, but
  the role read pattern is documented in `org-tree.md`.
- **`runCommitmentTracker`** — `ai-commitment.md`.
- **`listChronicDeferrals`** — `ai-commitment.md`.
- **`runInsightGeneration`** — `ai-insights.md`.

### `server/reveal-gating.ts`

- **`VisibilityContext`** (interface) at `:30` — `{ tenantId,
  feedbackType, cycle, assignments[] }`. The minimal state needed
  to decide visibility.

- **`isAssessmentVisibleToTarget(assessment, ctx)`** — Returns
  boolean. Logic per `feedbackType.visibilityRule`:
  - `IMMEDIATE` — always true.
  - `AFTER_ALL_SUBMIT` — true only when every `assignment` for this
    target+feedbackType has `status='SUBMITTED'`.
  - `AFTER_DEADLINE` — true only when `cycle.deadlineDate` is in
    the past.
  - `ADMIN_RELEASE` — true only when `cycle.status === 'REVEALED'`.
  - Plus the `autoRevealThresholdPct` override: if percentage of
    expected assessors that have submitted ≥ threshold AND
    deadline passed, reveal anyway.

- **`filterVisibleAssessments(assessments, ctx)`** — Convenience
  wrapper that filters an array.

## Data Touched

- `governanceCycles` — read+write (cycle state machine)
- `governanceAssessments` — read+write (the hot path)
- `assessmentAssignments` — read+write (generated by Chairman/Admin)
- `feedbackTypes` — read+write (admin config)
- `persons`, `roles`, `orgUnits` — read (target resolution + RBAC)
- `aiInsights` — read (Chairman dashboard rollups)
- `dependencyChains` — read (chain-health computation)
- `dailyFocusLog` — read indirectly via `rhythm-engine.md`

## External Dependencies

- `drizzle-orm` — `and`, `eq`, `inArray`, `desc`, `gte`, `lte`.
- `@trpc/server` — `TRPCError`.
- `zod` — input validation on every procedure.

## Internal Conventions

1. **Cycle state machine is one-way.** `DRAFT → OPEN → CLOSED →
   REVEALED`. The router enforces this; it doesn't permit
   backwards transitions. (If you need to "reopen" a cycle, the
   right move is creating a new one — preserves history.)

2. **Exactly one cycle is `OPEN` per tenant** at any time. The
   admin UI prevents opening a new cycle while one is open. The
   router doesn't *enforce* this invariant — the UI does — so
   "two open cycles" is a state to recover from manually, not a
   panic.

3. **Every cycle write is RBAC-gated**:
   - Cycle state transitions: `isChairmanOrAdmin`.
   - Feedback type CRUD: `isChairmanOrAdmin`.
   - Assignment generation: `isChairmanOrAdmin`.
   - Assessment upsert: caller's person must match `assessor` (via
     `getPersonByUserId` → `person.id`). Phase 1 Tier A adds
     `canAssessTarget` to enforce the cascade rule (today the
     write isn't gated by reports-to relationship).

4. **`feedbackType.key` is the canonical lookup,** not its `id`.
   The seed creates `self`/`chairman`/`md`; admin can add `peer`/
   `upward`/custom. Code that needs "the chairman feedback type"
   uses `getFeedbackTypeByKey('chairman', tenantId)`.

5. **`reveal-gating.ts` is the single chokepoint for visibility.**
   Don't write ad-hoc "is this visible?" logic anywhere else.
   Every consumer (target rehydrating their own assessments,
   ChairmanDashboard rendering perception gaps, ThreeSixty
   aggregating cross-type scores) goes through this module.

6. **Notifications on cycle state transitions are fire-and-forget**
   (`.catch(() => {})` after the call). Per master plan §3.11,
   notification delivery failures shouldn't block the cycle state
   change.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | All governance-core table types + their `Insert<>` shapes. |
| `db-layer.md` | `getGovernanceCyclesByTenant`, `getActiveGovernanceCycle`, `getGovernanceCycleByMonth`, `createGovernanceCycle`, `updateGovernanceCycleStatus`, `getFeedbackTypesByTenant`, `getFeedbackTypeByKey`, `createFeedbackType`, `updateFeedbackType`, `listAllFeedbackTypes`, `upsertGovernanceAssessment`, `getAssessmentsByAssessor`, `getAssessmentsForTarget`, `getAssessmentsByCycle`, `createAssessmentAssignments`, `getAssignmentsForAssessor`, `getAssignmentsByCycle`, `updateAssignmentStatus`, `getPersonByUserId`, `isChairmanOrAdmin`. |
| `auth-rbac.md` | `protectedProcedure`, `ctx.user`, `isChairmanOrAdmin`. |
| `scope.md` | (Reads only — `governanceRouter` doesn't currently use `useViewer`; Phase 1 Tier A will add `canAssessTarget` here.) |
| `tenant-context.md` | (Indirectly — most endpoints take `tenantId` as input, hardcoded to 1 in client today.) |
| `notifications.md` *(planned)* | `governance-notifications.ts:notifyCycleOpen`, `notifyCycleReveal`, `notifyChairmanSubmittedForRoleTarget`, `notifyChairmanSubmittedForCompanyTarget`. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| `mandate-journals.md` | `getActiveCycle`, `governanceCycles.id`, the cycle state machine. |
| `company-reflections.md` | Same as above. |
| `chairman-guidance.md` | Same as above + `governanceAssessments` (guidance is anchored to a cycle and optional dimension). |
| `360-feedback.md` | `governanceAssessments` + `reveal-gating.ts` for the aggregation pipeline. |
| `rhythm-engine.md` | `governanceCycles` (active cycle, deadline pressure), `governanceAssessments` (pending self-ratings), `assessmentAssignments` (pending assignments). |
| `ai-insights.md` | All cycle data for the insight generators. |
| `ai-commitment.md` | `mandateJournals` (plan items), via `governanceCycles` for cycle-relative lookups. |
| `chairman-surface.md`, `me-surface.md`, `team-surface.md`, `governance-admin.md` | All the cycle/feedbackType/assignment endpoints. |
| `financial-cockpit.md` | Reads `governanceCycles` only for active-cycle context — does not write here. |
| `analytics.md` | Aggregates `governanceAssessments` across cycles. |

## Fragility Notes

### Cycle state transitions don't enforce ordering

The router accepts any `status` value in `updateCycleStatus`. If a
Chairman accidentally clicks "REVEALED" before "CLOSED", the
state jumps and the `notifyCycleReveal` fan-out fires. **Defense:**
the admin UI only renders the "next" transition button — but the
API permits any. **Worth tightening** at the router layer: reject
non-sequential transitions unless admin.

### Two-OPEN-cycle race

If the admin UI is glitchy and a Chairman opens two cycles in the
same minute (e.g. clicked twice on a slow network), the router
inserts both as `OPEN`. `getActiveCycle` returns the latest by
`month DESC` — but `governanceNotifications` already fired for the
older one. **Defense:** add a uniqueness constraint at the DB layer
on `(tenantId, status='OPEN')`. Today this is not enforced;
collision rate is low.

### `generateAssignments` peer-random uses `Math.random()`

The peer-feedback assignment is `pick(pool, n, ...)` with
`Math.random()`-based shuffle. Re-running the generator produces a
different assignment set. **Intentional** — admin can re-roll if a
peer set is unworkable. But: if assignments have already been
written (status `PENDING` / `IN_PROGRESS` / `SUBMITTED`),
re-running creates duplicates (deduped within a single call,
but not across calls). The router's dedup check filters within the
batch only. **A second run can add new peer assignments to existing
assessors** — confusing if the admin doesn't realize. UI should
warn before re-running.

### `upsertAssessment` still has a check-then-insert race

Inherited from `db.upsertGovernanceAssessment`. Two concurrent
submits for the same composite logical key both fail the existence
check and both attempt insert. The MySQL unique constraint (if
present) catches one. Otherwise dupes are possible. **The
`upsertCompanyReflection` fix wasn't ported here.** See `db-layer.md`
fragility note "Check-then-insert races on upserts."

### `feedbackType.key` collisions are not enforced

Two feedback types with `key='peer'` in the same tenant can exist —
the DB has an index on `(tenantId, key)` but not a unique
constraint. **Defense:** the admin UI is the only path to create
feedback types and prevents duplicates. **Hardening:** add a
`unique('feedbackTypes_tenantId_key_unique', ['tenantId', 'key'])`
in the schema.

### `getAssessmentsForTarget` returns ALL assessments — visibility filtering happens client-side

The endpoint returns every assessment for the target/cycle (across
all feedback types). The caller is expected to filter by
`feedbackTypeId` and apply visibility rules via `reveal-gating.ts`
client-side. **This is a real over-fetch risk** — a target could
read pre-reveal Chairman scores via direct API call. **Defense:**
move visibility into the read endpoint (Phase 1 Tier A blocker).

### `reveal-gating` requires loaded `assignments` to compute `AFTER_ALL_SUBMIT`

The `VisibilityContext` needs the full assignment set for the
target/feedbackType to compute "have all submitted?" If the caller
passes an incomplete `assignments` array, the function silently
under-reports. **Defense:** always pass the full
`getAssignmentsByCycle(...).filter(byTarget+byFeedbackType)`
result.

### `assessmentAssignments` doesn't reflect the cascade design

Assignments are pre-generated by the admin. They don't auto-update
when a person's `reportsToRoleId` changes mid-cycle (e.g. an org
restructure). The assignment set is a snapshot. **Acceptable
today** — cycles are one month long. **A real concern when** mid-
cycle restructures happen during a calibration handover.

### `amIChairman` is a hot-path query

Called on every client page that renders Chairman-gated UI. The
underlying `isChairmanOrAdmin` does 3 DB reads. Multiplied by every
page nav, this adds up. The client caches it via react-query
defaults (5-min staleTime via tRPC), so practical impact is minor —
but if it ever feels slow, the right cache is per-session, not
per-render.

### No audit log on cycle state transitions

Per master plan §3.9 observability principle, every cycle state
change should emit an audit log entry. Today it doesn't. Phase 2's
AuditLogger work covers this.

### `markPriorPlanItem` lives in `governanceRouter` but operates on `mandateJournals`

Architectural surprise. The endpoint to mark a prior-cycle plan
item as completed lives next to the cycle endpoints, not next to
the journal endpoints. **Discovery friction** — see
`mandate-journals.md` which re-documents it. The cross-reference is
intentional: the operation is cycle-relative (you mark *this
cycle's* completion of *last cycle's* plan).
