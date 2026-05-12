# db-layer

> Last updated: 2026-04-21

## Purpose

`server/db.ts` is the **single chokepoint** between the application
code and the database. Every read, write, and RBAC primitive lives
here. Routers in `server/routers.ts` and `server/routers/*.ts` call
helpers from this file; they do **not** call Drizzle's `db.select`
directly (except for tightly scoped inline queries with a documented
reason).

This map covers `server/db.ts` itself. The schema it operates on is
documented in `data-model.md`. The RBAC helpers it exposes are also
documented (with their consumers) in `auth-rbac.md`.

## Scope

- Files in this map: 1
- Exported helpers: ~80
- Tables touched: all 46 tables in `drizzle/schema.ts`
- Lines: 1,482

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/db.ts` | Drizzle connection management + every CRUD helper + RBAC primitives + upsert flows for governance tables + audit helpers. Grouped by concern with comment banners. | See "Functions" below — organised by section banner. |

## Functions

The file is organised into ~25 sections marked with comment banners
(`// ============`). The sections, in source order, are:

### 1. Connection (`getDb`, lines 30-54)

- **`getDb()`** at `server/db.ts:44` — Lazy-initialise the Drizzle
  client from `process.env.DATABASE_URL`. Memoised in module-scope
  `_db`. Returns `null` on connection failure (every caller checks
  this and bails gracefully — read endpoints return `[]` /
  `undefined`, write endpoints throw `"Database not available"`).
  - Signature: `getDb(): Promise<ReturnType<typeof drizzle> | null>`
  - Callers: every other function in this file.
  - Side effects: module-state mutation on first call; logs a
    warning on connect failure.

### 2. User management (lines 56-135)

- **`upsertUser(user)`** at `:60` — Upsert by `openId`. Updates name,
  email, loginMethod, lastSignedIn if user exists; inserts otherwise.
  Used by the auth callback on sign-in. Nullable-field-by-nullable-
  field assignment pattern to avoid overwriting good values with
  undefined.
- **`getUserByOpenId(openId)`** at `:119` — Lookup by the auth
  provider's stable id.
- **`getUserById(id)`** at `:130` — Lookup by internal id.

### 3. Tenants (lines 137-160)

- `createTenant`, `getTenantBySlug`, `getTenantById`. All
  straightforward CRUD; today only used by the seed script and by
  `tenant-context.ts` (the single-tenant context-resolver).

### 4. OrgUnits + Persons + Roles (lines 162-329)

The cascade-critical section. Every function takes `tenantId` for
isolation (a hard invariant — see "Fragility Notes" below).

**OrgUnits:**
- `createOrgUnit(orgUnit)` at `:166`
- `getOrgUnitsByTenant(tenantId)` at `:173`
- `getOrgUnitById(id, tenantId)` at `:179` ← **always** takes tenantId

**Persons:**
- `createPerson(person)` at `:190`
- `getPersonById(id, tenantId)` at `:197` ← **always** takes tenantId
- `getPersonByUserId(userId, tenantId)` at `:208` — Used by every
  router that resolves `ctx.user.id` → person record.
- `getPersonByUserIdOrEmail(userId, email, tenantId)` at `:222` —
  Onboarding fallback when a fresh user signs in without a person row.
- `getPersonsByTenant(tenantId)` at `:244`
- `updatePersonDataSufficiency(personId, evidenceCount, sourceCount)`
  at `:250` — Updates `dataSufficiencyLevel` based on count thresholds
  (level 0-4 mapping is hardcoded here).

**Roles:**
- `createRole(role)` at `:265`
- `getRoleById(id, tenantId)` at `:272` ← **always** takes tenantId
- `getRolesByTenant(tenantId)` at `:283`
- **`isChairmanOrAdmin(userId, tenantId)`** at `:293` — **The most
  important RBAC primitive in the codebase.** Returns `true` if the
  user has `users.role = 'admin'` OR their current role is
  `CHAIRMAN` / `GROUP_CEO`. Used by every Chairman-gated mutation.
  - Signature: `isChairmanOrAdmin(userId: number, tenantId: number):
    Promise<boolean>`
  - Callers: most write mutations in `governanceRouter`, plus
    `governance-notifications.ts` and the cycle-status transitions.
  - Side effects: DB read (3 queries: user row, person row, role row).
  - **Performance:** called once per mutation. Acceptable. If hot
    path emerges, memoise per-request.
- `getActiveRoleByPerson(personId)` at `:313` — One row per person
  has `isActive=true`. Caller assumes this invariant.
- `getDirectReports(roleId)` at `:322` — Lists roles whose
  `reportsToRoleId = roleId AND isActive = true`. **The query that
  enables cascade.**

### 5. Plans + Metrics + MetricValues (lines 329-389)

- `createPlan`, `getPlansByOwner` (no tenantId — by ownerPersonId
  alone, predates the tenantId convention), `getPlanById`,
  `getPlansByTenant`.
- `createMetric`, `getMetricsByPlan` (joined to a plan, not directly
  tenant-scoped — the plan provides the tenant gate).
- `createMetricValue`, `getMetricValues`. Time-series writes that
  drive the financial cockpit.

### 6. Evidence + Observations + Reflections (lines 391-477)

- `createEvidence` (returns the new `id` directly — unusual; most
  creates return the Drizzle `result`).
- `getEvidenceByPerson`, `getEvidenceByTenant`.
- `createObservation`, `getObservationsBySubject`,
  `getObservationsByObserver`, `getRecentObservations`.
- `createSelfReflection`, `getSelfReflectionsByPerson`.

**Note:** `getSelfReflectionsByPerson` does **not** filter on
`visibility`. The caller is responsible for visibility gating. See
the Fragility Note "selfReflections visibility leak."

### 7. Memories (legacy, lines 480-501)

- `createMemory`, `getMemoriesByPerson`. These touch the legacy
  `memories` table, not `agenticMemories`. See `agentic-memory.md`
  for the new system.

### 8. Assessments + Reviews (legacy, lines 503-548)

- `createAssessment`, `getAssessmentsByPerson` — the old
  MILESTONE/QUARTERLY/ANNUAL flow.
- `createReview`, `getReviewsByPerson`, `updateReview` — living
  review drafts.

### 9. Meetings (lines 551-571)

- `createMeeting`, `getMeetingsByManager`.

### 10. Incentives (lines 573-613)

- `createIncentiveConfig`, `getIncentiveConfigByOrgUnit`.
- `createIncentiveComputation`, `getIncentiveComputations`.

### 11. Calibration sessions (lines 615-634)

- `createCalibrationSession`, `getCalibrationSessionsByOrgUnit`.
- **No UI surfaces these today.** Phase 4 builds `/calibration`.

### 12. Decisions (lines 637-656)

- `createDecision`, `getDecisionsByOwner`.

### 13. Notifications (lines 659-687)

- `createNotification`, `getNotificationsByPerson`,
  `markNotificationAsRead`. The 3-per-day cap is **not enforced
  here**; it's a UI-side filter today. Phase 1 Tier C fixes that.

### 14. Financial uploads (lines 690-739)

- `createFinancialUpload`, `getFinancialUploadsByOrgUnit`,
  `checkDuplicateUpload` (by `fileHash`), `createFinancialTemplate`,
  `getFinancialTemplatesByOrgUnit`.

### 15. Audit (lines 742-763)

- `createAuditLog`, `getAuditLogsByEntity`. **Currently
  under-called.** Per master plan principle §3.9, Phase 2 wires this
  into every governance mutation, every AI decision, and every RBAC
  deny.

### 16. Feedback types (lines 765-820)

- `getFeedbackTypesByTenant` (active only),
- `getFeedbackTypeByKey` (lookup by `key` string),
- `createFeedbackType`,
- `updateFeedbackType` (partial),
- `listAllFeedbackTypes` (includes inactive — for the admin page).

### 17. Governance cycles (lines 821-877)

- `createGovernanceCycle`,
- `getGovernanceCyclesByTenant`,
- `getActiveGovernanceCycle` (status = OPEN, single row expected),
- `getGovernanceCycleByMonth` (looks up by `month` YYYY-MM string),
- `updateGovernanceCycleStatus(cycleId, status, tenantId)`.

### 18. Governance assessments (lines 879-953)

**The hot path for the rhythm core.**

- **`upsertGovernanceAssessment(a)`** at `:883` — Matches on
  `(tenantId, cycleId, assessorPersonId, targetType, targetId,
  dimensionKey, feedbackTypeId)`. If found, updates `score`, `rag`,
  `note`, `confidenceNote`, `submittedAt`. Else inserts.
  - Signature: `upsertGovernanceAssessment(a:
    InsertGovernanceAssessment)`
  - Callers: `governance.upsertAssessment` mutation.
  - Side effects: DB read + DB update OR insert.
  - **Race condition risk:** classic check-then-insert. Two
    concurrent submits for the same logical key would both fail the
    existence check and both insert. We accepted this risk in v1
    because per-user single-author submits make collisions rare. The
    `upsertCompanyReflection` fix in Round-1 added an
    `ER_DUP_ENTRY` retry; this function has not been hardened in
    the same way. **Worth porting that fix.**
- `getAssessmentsByAssessor(assessorPersonId, cycleId, tenantId)`,
- `getAssessmentsForTarget(targetType, targetId, cycleId, tenantId)`
  — Used by `ChairmanAssess` to re-hydrate prior scores AND by
  perception-gap computation,
- `getAssessmentsByCycle(cycleId, tenantId)` — Used by
  `ChairmanDashboard` for fund-wide aggregations.

### 19. Assessment assignments (lines 955-1003)

- `createAssessmentAssignments(assignments[])` — Bulk insert. Empty
  array short-circuits.
- `getAssignmentsForAssessor`, `getAssignmentsByCycle`,
- `updateAssignmentStatus`.

### 20. Mandate journals (lines 1005-1081)

- **`upsertMandateJournal(j)`** at `:1009` — Matches on
  `(tenantId, personId, cycleId, dimensionKey)`. Updates `logText`,
  `planText`, `planItems`, `roleId`, `orgUnitId`. Inserts on miss.
  - **Same race-condition class as `upsertGovernanceAssessment`.**
- `getMandateJournalsByPersonAndCycle(personId, cycleId, tenantId)`,
- **`updateJournalPlanItems(journalId, planItems, tenantId)`** —
  Used by `markPriorPlanItem` to flag items as
  completed/not-completed retrospectively.
- **`getLastMandateJournal(personId, dimensionKey, beforeCycleId,
  tenantId)`** — The plan-to-log tracker's data source. Finds the
  most-recent journal whose `cycleId < beforeCycleId`. Used by
  MyBridge / MyIsland to show "last cycle's plan" alongside this
  cycle's log.

### 21. Company reflections (lines 1083-1164)

- **`upsertCompanyReflection(r)`** at `:1087` — Matches on
  `(tenantId, orgUnitId, cycleId)`. **Has a Round-1 fix:** the
  insert path catches `ER_DUP_ENTRY` and retries as an update,
  closing the check-then-insert race. The update path now writes
  `ceoPersonId` (was missed in v1).
- `getCompanyReflection(orgUnitId, cycleId, tenantId)`,
- `getCompanyReflectionsByCycle(cycleId, tenantId)`.

### 22. Chairman guidance (lines 1166-1192)

- `createChairmanGuidance(g)` — Append-only; no upsert needed.
- `getChairmanGuidanceForTarget(targetType, targetId, cycleId,
  tenantId)`.

### 23. Dependency chains (lines 1194-1210)

- `getDependencyChainsByTenant`, `createDependencyChain`.

### 24. AI insights (lines 1212-1230 + 1340-1356)

- `createAiInsight(i)`,
- `getAiInsightsByCycle(cycleId, tenantId)` — ordered by
  `severity DESC, createdAt DESC`,
- `getAiInsightsByTarget(targetType, targetId, tenantId)`.

### 25. RBAC + Financial Cockpit support (lines 1232-1356)

- **`canEditCompanyFinancials(userId, tenantId, orgUnitId)`** at
  `:1235` — Returns true iff `isChairmanOrAdmin(userId, tenantId)`
  OR the user's current role is `CEO` with `orgUnitId` matching.
  Single chokepoint for cockpit inline edits + `upsertReflection`
  ownership check.
- **`upsertQuarterlyActual({ tenantId, orgUnitId, metricName,
  periodDate, actualValue })`** at `:1257` — Resolves the FINANCIAL
  plan for that company, then the named metric within it, then
  upserts the `metricValues` row matching on `(metricId,
  periodType='QUARTERLY', periodDate)`. **Throws** if the plan or
  metric doesn't exist (caller catches and toasts the error).
- `getFinancialSummariesByTenant(tenantId)` at `:1321` — Joins
  `plans → metrics → metricValues` filtered to
  `plans.category='FINANCIAL'`. Flat result that the client
  aggregates per company.

### 26. Access control (lines 1358-1403)

- `getAccessGrantsByTenant`,
- `getAccessGrantsByUser(userId, tenantId)`,
- `createAccessGrant(data)`,
- **`revokeAccessGrant(id, tenantId, revokedByUserId)`** — Round-1
  fix: now takes `tenantId` to prevent cross-tenant id guessing.
- **`getAccessGrantById(id, tenantId)`** — Round-1 fix: now takes
  `tenantId`.

### 27. Access challenges (lines 1405-1437)

- `getAccessChallengesByUser`,
- `getAccessChallengesByTenant`,
- `createAccessChallenge`,
- `resolveAccessChallenge(id, resolvedByUserId, resolution, status)`.

### 28. User preferences + onboarding (lines 1438-end)

- `getUserPreferences(userId)`,
- `upsertUserPreferences(userId, data)` — Partial-update upsert.
- `adminGetAllChallenges(status?)` — Admin bulk read.
- `markOnboardingComplete(userId)` — Wrapper that sets
  `onboardingCompleted=true` + `onboardingCompletedAt=now`.

## Data Touched

Every table in `drizzle/schema.ts`. See `data-model.md` for shapes.

## External Dependencies

- `drizzle-orm` — `eq`, `and`, `desc`, `asc`, `gte`, `lte`, `sql`,
  `inArray` operators.
- `drizzle-orm/mysql2` — `drizzle` (client constructor).
- `mysql2` (transitive) — actual DB driver.

## Internal Conventions

These conventions hold across every helper. Violations are
review-blocking.

1. **Every read takes `tenantId`** (or is tenant-agnostic by design,
   in which case the lack of `tenantId` is documented in the JSDoc
   on the function). After Round-1, the previously-broken
   `getPersonById(id)` / `getRoleById(id)` / `getOrgUnitById(id)` /
   `getAccessGrantById(id)` all take `tenantId` explicitly.

2. **Every helper awaits `getDb()` and bails gracefully on null.**
   Reads return `[]` or `undefined`; writes throw `"Database not
   available"`. Routers catch the throw and surface a TRPCError.

3. **Composite-key upserts use the check-then-update-else-insert
   pattern**:
   ```ts
   const existing = await db.select().from(table)
     .where(and(...keyFilters)).limit(1);
   if (existing.length > 0) {
     return await db.update(table).set({...}).where(eq(table.id, existing[0].id));
   }
   return await db.insert(table).values({...});
   ```
   `upsertCompanyReflection` additionally catches `ER_DUP_ENTRY` and
   retries as an update — this is the gold-standard pattern. Port
   to other upserts when concurrent-submit races are observed.

4. **RBAC primitives return `Promise<boolean>`.** They never throw —
   the caller throws a `TRPCError({ code: 'FORBIDDEN' })` if
   appropriate.

5. **Date arithmetic** in this file is minimal — most date logic
   lives in routers. When this file does compare dates (e.g.
   `getLastMandateJournal`'s `cycleId < beforeCycleId`), the
   comparison is on integer ids, not timestamps.

6. **`@ts-nocheck` and `as any` are forbidden.** Type-correctness is
   the chokepoint's contract.

7. **No raw `db.execute(...)` SQL.** All queries go through Drizzle's
   typed query builder. Exception: `upsertCompanyReflection`'s retry
   path catches the MySQL error code by string — that's allowed.

8. **JSDoc on every exported function.** Especially: what
   tenant-scoping the function does, what side effects it has, and
   whether it bails or throws on missing-DB.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | Every table import + every `Insert<T>` type. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| Every router subsystem (governance-cycle, mandate-journals, company-reflections, chairman-guidance, 360-feedback, agentic-memory, ai-insights, financial-cockpit, access-control, notifications, preferences, rhythm-engine, voice-capture, ai-deliberation, calendar, sharing, meetings, reflections, decisions, observations, evidence-upload, ai-review, calibration, incentives, governance-admin, admin, scope) | Each router calls helpers from this file. Add a Backward dep row to your map listing the specific functions. |
| `auth-rbac.md` | Specifically: `isChairmanOrAdmin`, `canEditCompanyFinancials`, `getPersonByUserId`, `getActiveRoleByPerson`, `getDirectReports`. |
| `scope.md` | Specifically: `getDirectReports`, `getOrgUnitsByTenant`, `getRolesByTenant`. |
| `tenant-context.md` | `getTenantById`, `getTenantBySlug`. |
| `seed-and-migrations.md` | Every `create*` helper. |

In short: **almost every other subsystem map has a backward
dependency on this file.** Treat any helper signature change as
having repo-wide blast radius. Update the dependent maps in the
same commit.

## Fragility Notes

### `tenantId` was missing on id-only lookups (FIXED Round-1)

`getPersonById`, `getRoleById`, `getOrgUnitById`, `getAccessGrantById`,
`revokeAccessGrant` all originally took just `id`. A user in tenant A
could read tenant B's rows by guessing an id. **Fixed in Round-1.**
The lesson: **any new id-by-int read added to this file must take
`tenantId`** unless the function is explicitly tenant-agnostic (and
that fact is documented in the JSDoc).

### Check-then-insert races on upserts

`upsertGovernanceAssessment` and `upsertMandateJournal` still have the
classic race: two concurrent calls for the same logical key both miss
the existence check and both try to insert. `upsertCompanyReflection`
was hardened in Round-1 to catch `ER_DUP_ENTRY` and retry; the others
weren't. **In practice, the per-user single-author write model makes
collisions rare** — but a CXO using multiple tabs could trigger this.
Port the `upsertCompanyReflection` pattern when a real collision is
observed.

### `getSelfReflectionsByPerson` does not filter on visibility

The `selfReflections.visibility` enum (`PRIVATE` / `SHARED` /
`IN_REVIEW`) is not enforced by this read. Any router calling
`getSelfReflectionsByPerson` MUST add a visibility filter before
returning to the client. Phase 1 Tier B + Phase 2 privacy work
tightens this.

### `upsertQuarterlyActual` throws on missing plan/metric

If a CEO tries to write an actual for a company that doesn't have a
FINANCIAL plan, or for a metric that doesn't exist on the plan,
this function throws. The caller (`writeQuarterlyActual` in the
governance router) currently surfaces the error to the user via
`toast.error(err.message)`. This is intentional — silently creating
the plan or metric would be a worse failure mode — but the user-
visible message is a developer string. **A Phase 1 Tier B polish
item: surface a friendly error** ("This company has no FY27
financial plan configured. Ask an admin to create one.").

### `getPlansByOwner` predates the tenantId convention

Looked up by `ownerPersonId` alone. Because `personId` is already
tenant-scoped (a person belongs to exactly one tenant), this is
**not** a real isolation hole today — but it's an inconsistency
that complicates the mental model. **Adding `tenantId` to its
signature is a low-risk cleanup**; queue for Phase 1 Tier C.

### `isChairmanOrAdmin` does 3 DB reads per call

Acceptable today (called once per write mutation, ~10× per cycle per
user). At scale (Phase 4+ with the cascade fully populated) this
becomes a per-request hot path. **Memoize per-request** when traffic
grows. Don't memoize across requests — role changes must be visible
immediately.

### No row-level audit log on every mutation today

`createAuditLog` exists but is rarely called. Per master plan
§3.9 (Observability is a feature), Phase 2 introduces an
`AuditLogger` helper that **every** governance mutation will call.
Until then, debugging "who changed this row when" is hard.

### Drizzle's empty-array insert behavior

`createAssessmentAssignments(assignments[])` short-circuits on
empty array. Drizzle's behavior on `db.insert(table).values([])` is
provider-dependent and surprising; we explicitly check and return.
Apply the same guard to any bulk-insert helper added later.

### `getDb()` memoisation can mask connection-string changes

`_db` is a module-scope cache. If `process.env.DATABASE_URL`
changes at runtime (e.g. credential rotation), the cached client
keeps using the old credentials. **Workaround:** restart the
process. **Fix (future):** add a TTL or a connection-pool health
check.
