# company-reflections

> Last updated: 2026-04-21

## Purpose

The **CEO's monthly structured company reflection** — five lists
(`wentWell`, `didntGoWell`, `risks`, `needsFromFund`,
`forwardCommitments`) written once per cycle per company. Distinct
from the per-dimension mandate journals (see `mandate-journals.md`)
in that this is a single composite reflection on the company as a
whole, owned by the CEO.

The reflection is the most direct input the Chairman has into "what
the CEO thinks is going on" outside of pure ratings. The Chairman
reads it as preparation for cycle reveal and calibration.

## Scope

- Files in this map: 3 (server + 1 client page)
- tRPC endpoints: 3 (`upsertReflection`, `getReflection`,
  `listReflections`)
- Tables touched: `companyReflections`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers.ts` (reflection endpoints, ~1164-1200) | `upsertReflection`, `getReflection`, `listReflections` in `governanceRouter`. | (mounted at `appRouter.governance.*`) |
| `server/db.ts` (reflection helpers, ~1087-1164) | `upsertCompanyReflection` (with the Round-1 dup-key retry), `getCompanyReflection`, `getCompanyReflectionsByCycle`. | See `db-layer.md`. |
| `client/src/pages/MyIsland.tsx` | The CEO's monthly reflection form (alongside the mandate cards covered in `mandate-journals.md`). 5-field input area. | `MyIsland` (default export) |

## Functions

### `server/routers.ts` — reflection endpoints

- **`upsertReflection({ tenantId, cycleId, orgUnitId, wentWell[],
  didntGoWell[], risks[], needsFromFund[], forwardCommitments[]
  })`** — Writes the reflection row keyed on `(orgUnitId, cycleId)`
  (the tenantId is also part of the natural key but only one
  tenant today). All five list fields are `string[]`. Empty arrays
  are valid. RBAC: caller's person must own the company (current
  `canEditCompanyFinancials(userId, tenantId, orgUnitId)` — Round-1
  hardened so a non-owner can't write).

- **`getReflection({ tenantId, cycleId, orgUnitId })`** — Returns
  the reflection row (or null). RBAC: ownership check via
  `canEditCompanyFinancials` (read-side is more permissive — see
  Fragility Notes).

- **`listReflections({ tenantId, cycleId })`** — All reflections in
  the cycle. Used by ChairmanDashboard.

### `server/db.ts` — reflection helpers

(Cross-referenced in `db-layer.md`. Re-listed for discoverability.)

- **`upsertCompanyReflection(r: InsertCompanyReflection)`** at
  `:1087` — **The gold-standard upsert.** Composite-key match on
  `(tenantId, orgUnitId, cycleId)`. The update path now writes
  `ceoPersonId` (was missed in v1). The insert path catches
  `ER_DUP_ENTRY` and retries as an update — this is the only
  upsert in `db.ts` that handles the check-then-insert race.

- **`getCompanyReflection(orgUnitId, cycleId, tenantId)`** at
  `:1139`.

- **`getCompanyReflectionsByCycle(cycleId, tenantId)`** at `:1156`.

### `client/src/pages/MyIsland.tsx` — reflection form

Renders below the dimension cards. 5 inline text areas (one per
list field). Each list is a multi-line textarea where each line
becomes an array entry on save. Save on blur.

## Data Touched

- `companyReflections` — read+write.
- `orgUnits` — read (to resolve company name for display).
- `persons` — read (for `ceoPersonId` resolution).

## External Dependencies

- `drizzle-orm`, `@trpc/server`, `zod` — server.
- `react`, `wouter`, `sonner` — client.

## Internal Conventions

1. **Composite key is `(tenantId, orgUnitId, cycleId)`.** Don't
   model the reflection as person-scoped — companies have one
   reflection per cycle regardless of who the CEO is at the
   moment (continuity through leadership changes).

2. **List fields are stored as JSON arrays of strings.** No
   structure (no per-item priority, no per-item completion). If
   you need structure later (e.g. mark a `risk` as `mitigated`),
   add a sibling table; don't extend the JSON shape — JSON column
   shape changes are silent breakage (see `data-model.md`
   fragility "JSON column shapes are not enforced at DB layer").

3. **All five fields are required on the schema** but accept empty
   arrays. A CEO can submit a reflection with only
   `forwardCommitments` filled — the others default to `[]`.

4. **`ceoPersonId` is set on every upsert.** Round-1 fix — the
   update path was previously missing this, so if a CEO swapped
   mid-cycle the row would carry the old `ceoPersonId`.

5. **Visibility for read** is Chairman+admin+the owning CEO+the
   CEO's direct manager (the MD). **Today** the `getReflection`
   read isn't gated to that scope — it's only gated to
   `canEditCompanyFinancials`. See Fragility Notes.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `companyReflections`, `orgUnits`, `persons` types. |
| `db-layer.md` | `upsertCompanyReflection`, `getCompanyReflection`, `getCompanyReflectionsByCycle`, `getPersonByUserId`, `canEditCompanyFinancials`. |
| `governance-cycle.md` | The cycle endpoints + active cycle resolution. |
| `auth-rbac.md` | `protectedProcedure`, `ctx.user`, `canEditCompanyFinancials`. |
| `scope.md` | `useViewer()` for resolving the CEO's `currentRole.orgUnitId`. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | `listReflections` for the ChairmanDashboard CEO Reflections panel. |
| `ai-insights.md` | Reflection text as a signal for `NEEDS_FROM_FUND` patterns + `RISK` trend detection. |
| `ai-ask.md` | Reflections are one of the indexed corpora for the RAG pipeline (see `server/ai-ask.ts:routeQuery` keyword routing). |
| `me-surface.md` | Embeds `MyIsland.tsx`. |

## Fragility Notes

### `getReflection` read scope is too permissive

`getReflection` is gated by `canEditCompanyFinancials` — but the
function name says "edit," not "read." A non-owner reading a
reflection passes only through the procedure's `protectedProcedure`
gate, with no explicit ownership check at the read level. **Today
this is masked** because the UI never calls `getReflection` for a
company the viewer doesn't own. **The API permits cross-tenant or
cross-company reads** if a client constructs the right call.
Phase 1 Tier A `canReadCompanyReflection` helper closes this.

### Five string-array fields invite "list of bullets" thinking

The reflection schema assumes each list is a flat array of bullet
points. **No structure** — no per-item priority, no per-item link
to a person or commitment, no "this risk was mitigated" status.
Real CEOs often want richer structure ("this risk requires fund
intervention by [date]"). **The right place to add it is a sibling
table** (`reflectionItems`?) not a nested JSON shape.

### `forwardCommitments` overlaps `mandateJournals.planItems`

Both fields represent "things the CEO has committed to." A CEO
might list "Close Bharti deal" as a `forwardCommitments` here AND
as a `planItems` entry on their Revenue mandate. **No dedup** —
the AI commitment tracker (`ai-commitment.md`) only scans
`mandateJournals.planItems` and misses `companyReflections.
forwardCommitments`. **A Phase 3 unification** is in scope.

### `upsertCompanyReflection`'s ER_DUP_ENTRY retry catches a real bug class

Two concurrent submits (e.g. CEO has two browser tabs open and
clicks Submit on both) used to insert duplicate rows. The Round-1
fix catches the MySQL unique-constraint error and retries as an
update. **This is the only upsert with this defense.**
`upsertGovernanceAssessment` and `upsertMandateJournal` still have
the race — see `db-layer.md`. Port the pattern when collisions are
observed.

### No edit history

A CEO can write a reflection, then edit it 28 days later, and the
original is gone. **The audit trail is `auditLogs`**, but that
table is rarely populated today. Phase 2 observability includes
"write a before/after audit log entry on every reflection upsert."
Until then, there's no way to reconstruct what a CEO originally
said vs what they edited later.

### Reflection fields are unbounded strings

Each entry in `wentWell[]` is a free-text string with no length
limit at the DB or API. A user pasting a 50K-word essay would
crash the JSON column write (MySQL `JSON` max ~1GB but practical
limits much lower). **Defense:** Zod schema on
`upsertReflection` could add `z.string().max(2000)` per item.
**Today: not enforced.**

### Empty-reflection write is identical to "the CEO chose not to reflect this cycle"

If a CEO submits with all 5 fields empty arrays, the row exists
with all empty fields. **No way to distinguish** "explicitly
declined to reflect" from "saved an empty form to silence the
deadline reminder." **A Phase 1 Tier B polish:** add a "skip with
reason" affordance for the IC use case (master plan §3.10 failure
modes — "Skip with reason"). Apply same here.
