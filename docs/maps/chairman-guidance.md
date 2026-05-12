# chairman-guidance

> Last updated: 2026-04-21

## Purpose

The **Chairman's written feedback** to a target (a CXO, CEO, or
portfolio company) for a specific cycle, optionally scoped to a
single dimension. Distinct from `governanceAssessments` (the
numeric ratings) — guidance is the *qualitative* commentary that
goes alongside.

In Phase 4+, when the cascade is fully realised, this is **any
leader's guidance** to their report — not just Chairman→CXO. The
table is generic enough; the routing layer just needs to widen.

## Scope

- Files in this map: 3 (server + 1 client page)
- tRPC endpoints: 2 (`createGuidance`, `getGuidanceForTarget`)
- Tables touched: `chairmanGuidance`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers.ts` (guidance endpoints, ~1201-1252) | `createGuidance`, `getGuidanceForTarget` in `governanceRouter`. | (mounted at `appRouter.governance.*`) |
| `server/db.ts` (guidance helpers, ~1170-1192) | `createChairmanGuidance`, `getChairmanGuidanceForTarget`. | See `db-layer.md`. |
| `client/src/pages/ChairmanAssess.tsx` | The Chairman's assess-and-write page. After scoring a dimension, the Chairman can write a guidance note that gets stamped to `chairmanGuidance`. | `ChairmanAssess` (default export) |
| `client/src/pages/MyBridge.tsx`, `MyIsland.tsx` | Render guidance back to the target (read-only) once cycle is `REVEALED`. | (see `mandate-journals.md`, `company-reflections.md`) |

## Functions

### `server/routers.ts` — guidance endpoints

- **`createGuidance({ tenantId, cycleId, targetType, targetId,
  dimensionKey?, guidanceText })`** — Append-only insert (no
  upsert; each guidance note is a separate row to preserve audit
  trail). RBAC: `isChairmanOrAdmin`. The procedure resolves the
  Chairman's `personId` via `getPersonByUserId` and stores it as
  `chairmanPersonId`.

- **`getGuidanceForTarget({ tenantId, cycleId, targetType,
  targetId })`** — Returns all guidance rows for the target this
  cycle. RBAC: caller must be the target (the person the role
  belongs to, or the CEO of the company), the Chairman, or in
  the target's leader chain.

### `server/db.ts` — guidance helpers

- **`createChairmanGuidance(g: InsertChairmanGuidance)`** at
  `:1170` — Plain insert. No composite-key uniqueness; multiple
  guidance notes per target/cycle/dimension are allowed.

- **`getChairmanGuidanceForTarget(targetType, targetId, cycleId,
  tenantId)`** at `:1176` — Returns all rows matching the target
  composite key.

### `client/src/pages/ChairmanAssess.tsx`

The Chairman's primary write surface. Renders:

1. **Target picker** at top (CXO role, CEO role, or portfolio
   company).
2. **Per-dimension card** — score slider (writes
   `governanceAssessments`) + note textarea (writes
   `chairmanGuidance` on blur or explicit save).
3. **Submit Cycle** button — stamps every dimension's assessment
   with `submittedAt: new Date()`. Guidance is already stored.

## Data Touched

- `chairmanGuidance` — read+write.
- `persons` — read (chairman person resolution).
- `roles`, `orgUnits` — read (target resolution for display).

## External Dependencies

- `drizzle-orm`, `@trpc/server`, `zod` — server.
- `react`, `wouter`, `sonner` — client.

## Internal Conventions

1. **Append-only writes.** Each "save" creates a new row. Don't
   model guidance as an upsert — the audit trail is the point.
   If the Chairman re-writes a guidance note, the prior version
   stays in the table.

2. **`dimensionKey` is optional.** A guidance note can be
   - dimension-scoped (`dimensionKey="Revenue Growth"`)
   - target-level (no dimension — overall feedback for that CXO
     this cycle)

3. **Visibility is cycle-state-dependent.** Targets see their
   guidance only when:
   - The cycle is `REVEALED`, OR
   - The feedback type used for the matching assessment has
     visibility rule `IMMEDIATE` and the Chairman has submitted
     the matching score.

   Concretely: the Chairman's guidance is locked behind the same
   `reveal-gating.ts` rule as the Chairman's score.

4. **RBAC reads are tighter than writes.** Only Chairman/Admin can
   write. Reads are scoped to the target + their direct manager
   + Chairman + Admin (per master plan §5.8 RBAC matrix v3).

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `chairmanGuidance`, `persons`, `roles`, `orgUnits` types. |
| `db-layer.md` | `createChairmanGuidance`, `getChairmanGuidanceForTarget`, `getPersonByUserId`, `isChairmanOrAdmin`. |
| `governance-cycle.md` | Cycle endpoints + the reveal-gating semantics. |
| `auth-rbac.md` | `protectedProcedure`, `isChairmanOrAdmin`. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | `ChairmanAssess.tsx` writes here. |
| `me-surface.md` | `MyBridge`/`MyIsland` render the read-back. |
| `ai-insights.md` | Guidance text is a signal source for `360_SYNTHESIS` insights (cross-referenced narrative). |
| `ai-ask.md` | Guidance is one of the indexed corpora in the RAG pipeline. |

## Fragility Notes

### Append-only means no edit, no delete

A Chairman who realises they wrote the wrong guidance can't edit
it. They have to write a new note that says "Disregard previous —
correct guidance is X." **Awkward** — but it's the right default
for an audit trail. **Worth adding** a "supersede" relation
(`supersedes: int(nullable)`) on a future migration so the UI can
visually mark stale notes.

### Visibility is split between two reveal gates

The Chairman's *score* visibility goes through
`reveal-gating.ts`. The Chairman's *guidance* visibility goes
through the same gate, but the gating logic is duplicated — once
when filtering `governanceAssessments`, once when filtering
`chairmanGuidance`. **Drift risk:** if the score visibility rule
changes (e.g. adding a new visibility enum), the guidance read
endpoint might not update. **Defense:** Phase 1 Tier A should
unify both behind a shared `isVisibleToTarget(target, assessor,
cycle)` helper.

### `dimensionKey` doesn't link to the matching assessment

A guidance row has a free-text `dimensionKey` string. If the
`roles.successMetrics` array changes (rename a mandate), the
guidance row's `dimensionKey` doesn't update — the join becomes
broken. **Same risk as `mandateJournals`** (see
`mandate-journals.md` fragility "`dimensionKey` strings can
drift"). Migration helper needed when mandates are renamed.

### No upper bound on guidance volume

A Chairman could write 50 guidance notes per dimension per cycle.
The UI shows the latest in `MyBridge` but the API returns all.
**Practical impact:** rare today. **At scale** (full cascade), a
diligent leader who writes once a week would accumulate ~50
guidance rows per cycle per report. Worth surfacing only the most
recent N in the UI.

### Guidance can be written for a target outside the writer's authority

`createGuidance` is gated by `isChairmanOrAdmin`. **No explicit
target-scope check.** The Chairman can write guidance for anyone
in the tenant, which is correct for the Chairman. **But when
cascade arrives** (Phase 1 Tier A) — a CEO writing guidance for
their CFO — we need a target-scope check (`canAssessTarget` or
similar). **Today the endpoint is too permissive** for non-
Chairman writers; gate accordingly when widening.

### `getGuidanceForTarget` doesn't filter by visibility

The server returns all guidance for the target. **Visibility
filtering happens client-side.** Same over-fetch concern as
`getAssessmentsForTarget` (see `governance-cycle.md` fragility).
**Phase 1 Tier A** should server-side-gate.

### No author identity surfaced to the target

The Chairman's guidance shows up as "Chairman's note" in
`MyBridge` / `MyIsland`. **By design** — anonymity isn't the
intent (the Chairman is the only writer for now), but the UI
doesn't display "from: Gautham Pai." **When cascade widens** to
"any leader writes guidance to their report," the target needs to
see who wrote it. **Today: assumed Chairman.**

### Guidance written pre-CLOSED is visible only post-REVEALED — but the Chairman might forget the cycle state

A Chairman writes guidance mid-cycle while the cycle is `OPEN`.
The target can't see it yet. The Chairman might assume the target
*has* seen it and follow up — but the target hasn't. **A UX
gotcha**, not a fragility per se. **Defense:** `ChairmanAssess`
should indicate "this guidance will become visible after [cycle
reveal date]."
