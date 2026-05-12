# org-tree

> Last updated: 2026-04-21

## Purpose

The **org structure layer** — `orgUnits`, `persons`, `roles`,
plus the `reportsToRoleId` graph and the `dependencyChains` table
that names cross-functional risk corridors. Every cascade decision
(`canAssessTarget`, `directReportPersonIds`, `ownedOrgUnitIds`)
walks structures defined here.

## Scope

- Files in this map: 3 (server scope reader + 2 client-side)
- Tables touched: `orgUnits`, `persons`, `roles`,
  `dependencyChains`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/scope.ts` | Detailed in `scope.md` — re-cited here because it's the main org-tree reader. | (see `scope.md`) |
| `server/routers.ts` (`personRouter`, lines 84-228; `tenantRouter` orgUnit endpoints, 47-78) | Person CRUD + role/reportsTo updates. `updateReportsTo`, `getReportsTo`, `updateRoleMandate`. | (mounted at `appRouter.person.*` + `appRouter.tenant.*`) |
| `client/src/pages/People.tsx` | Lightweight people-list page — just a directory. | `People` (default) |

## Functions

### `server/routers.ts` — personRouter (org-tree-relevant endpoints)

- **`getMyProfile`** at `:85` — Returns the caller's person + role.
- **`getById({ personId, tenantId })`** at `:106` — Get any person
  by id; tenant-gated (Round-1 fix).
- **`list({ tenantId })`** at `:132` — All persons in tenant
  (tenant-membership-gated).
- **`getDirectReports()`** at `:144` — Caller's direct reports
  (via `db.getDirectReports`).
- **`updateReportsTo({ roleId, newReportsToRoleId? })`** at `:164` —
  Update the cascade. **No RBAC gate today** beyond
  `protectedProcedure` — needs an `isChairmanOrAdmin` check (a
  CXO shouldn't be able to remap who reports to whom).
- **`getReportsTo({ roleId })`** at `:201` — Returns the chain
  upward from a role.
- **`updateRoleMandate({ roleId, successMetrics })`** at `:224` —
  Edit a role's mandate list. Should also be Chairman/Admin-only.

### `server/routers.ts` — tenantRouter (orgUnit endpoints)

- **`getCurrent()`** at `:36` — Returns the current tenant.
- **`listOrgUnits({ tenantId })`** at `:47` — All org units.
- **`createOrgUnit(...)`** at `:54` — Chairman/Admin-only
  (Round-1 fix).

### `client/src/pages/People.tsx`

Tiny directory listing of all persons in the tenant. Avatar +
name + role badge. Click → `/people/<id>`. Search box for
filtering. Detailed in `people-pages.md`.

## Data Touched

- `orgUnits` — read+write (Chairman/Admin only).
- `persons` — read+write.
- `roles` — read+write (mandate edits + reportsTo edits).
- `dependencyChains` — read (write happens via the seed or
  governance-admin chain config — not in this map).

## External Dependencies

- `drizzle-orm`, `@trpc/server`, `zod`.

## Internal Conventions

1. **`reportsToRoleId` is the cascade backbone.** Don't model
   "who reports to whom" anywhere else (e.g. in
   `mandateJournals`).
2. **`successMetrics` (mandate list) lives on `roles`.** No
   separate mandates table today. `roleMandateVersions` is the
   planned future (see master plan §5.1).
3. **`dependencyChains.nodeRoleIds` is an ordered array.** Order
   matters — the chain visualisation walks it left-to-right.
4. **`orgUnits.parentOrgUnitId` builds the tree.** No "secondary
   parent" affordance — every unit has exactly one parent (or
   null for the root holding company).

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | All four tables. |
| `db-layer.md` | The corresponding helpers. |
| `scope.md` | Reads the same structures with viewer-scoping. |
| `auth-rbac.md` | RBAC checks. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `me-surface.md`, `team-surface.md`, `group-surface.md`, `chairman-surface.md` | All consume `useViewer()` which is built from these tables. |
| `governance-cycle.md` | `roles.successMetrics` for mandate-based assessment dimensions. |
| `cascade` (Phase 1 Tier A `canAssessTarget`) | Walks `reportsToRoleId` graph. |
| `chairman-surface.md` | Reads `dependencyChains` for the Chain Health panel. |
| `people-pages.md` | Person profile view + mandate edits. |

## Fragility Notes

### `updateReportsTo` and `updateRoleMandate` lack Chairman/Admin gating

Two write endpoints in `personRouter` that mutate the cascade
structure. Both are `protectedProcedure` only. **A CXO could remap
who reports to whom or edit another CXO's mandate.** Phase 1 Tier
A must gate both with `isChairmanOrAdmin`.

### `updateReportsTo` doesn't audit cycle membership

Mid-cycle reportsTo changes don't update `assessmentAssignments`.
A person reassigned to a new manager mid-cycle is still in their
old manager's assignment set. **Acceptable** — assignments are
cycle-snapshots — but worth surfacing in the UI.

### `dependencyChains.nodeRoleIds` doesn't validate that roles exist

A chain can reference role IDs that no longer exist (after a role
is deactivated). Reads silently drop the dangling references but
the chain visualisation shows fewer nodes than expected. **Add
referential integrity check** at write time.

### `successMetrics` is a JSON string array

Edits go through `updateRoleMandate` and replace the entire array.
**Concurrent edits race** — two admins both editing the same
role's mandates at once overwrite each other. Add a `version`
column or use optimistic concurrency.

### No "history" of mandate changes

When `successMetrics` changes, the prior value is lost. Phase 3+
`roleMandateVersions` table appends history.

### `People.tsx` shows all persons — including inactive

The directory doesn't filter `roles.isActive`. Ex-employees appear
with their old role badge. Phase 1 Tier B add a status filter.
