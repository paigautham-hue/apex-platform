# goals

> Last updated: 2026-04-21

## Purpose

The **goals + plans hierarchy** — `plans` (and their `metrics`)
form the OKR / business-plan cascade: PORTFOLIO_STRATEGY →
BUSINESS_PLAN → ANNUAL_OPERATING_PLAN → FUNCTION_PLAN → OKR →
INDIVIDUAL_GOAL. `parentPlanId` is the cascade pointer.
`Goals.tsx` is the IC-facing surface for individual goals.

Metrics + actuals are documented in `financial-cockpit.md`. This
map covers the **plan** side: what a person is committing to,
weighted, with assumptions.

## Scope

- Files: 1 page
- tRPC endpoints: 4 (`plan.create`, `plan.getMyPlans`,
  `plan.getById`, `plan.getByTenant`)
- Tables touched: `plans`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Goals.tsx` | ~255 lines. Lists `getMyPlans`, lets the caller create new plans (defaults to type INDIVIDUAL_GOAL). | `Goals` (default) |

## Functions

### `planRouter` (server/routers.ts:340+)

- **`create`** — Mutation. Accepts `{ name, type, orgUnitId,
  parentPlanId?, periodStart/End, category, weightPercentage?,
  targets?, assumptions[]? }`. Stamps `ownerPersonId = caller`,
  `status: ACTIVE`. Decimal weight stored as string.
- **`getMyPlans`** — Plans where `ownerPersonId = caller`.
- **`getById`** — Single plan fetch. **No auth check** — caller
  must already know the id.
- **`getByTenant`** — Tenant-wide plan list for analytics.

## Data Touched

- Writes: `plans`.
- Reads: `plans` (own / by id / by tenant).

## External Dependencies

- shadcn UI.

## Internal Conventions

1. **`parentPlanId` is the cascade pointer.** An OKR rolls up to
   a FUNCTION_PLAN, which rolls up to an AOP, etc.
2. **Weight is a percentage (0–100) stored as decimal string.**
3. **Categories are coarse-grained** — FINANCIAL / STRATEGIC /
   OPERATIONAL / SUSTAINABILITY / LEADERSHIP / GOVERNANCE.
4. **`status: ACTIVE` on create.** No archived/draft path today.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `createPlan`, `getPlansByOwner`, `getPlanById`, `getPlansByTenant`. |
| `org-tree.md` | `orgUnitId` defines who owns/scopes the plan. |
| `data-model.md` | `plans` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `financial-cockpit.md` | `plans → metrics → metricValues` chain. |
| `ai-review.md` | Living-review draft pulls plans for the period. |
| `analytics.md` | `getPlansByTenant` for tenant-wide rollups. |
| `me-surface.md` | Plan count + completion on dashboard. |

## Fragility Notes

### `getById` has no scope check

Any authenticated user can fetch any plan by id. **Phase 1 Tier B
blocker** — gate via `canViewOrgUnit` against `plan.orgUnitId`.

### Cascade integrity not enforced

`parentPlanId` can point to any plan, including one in a
different `orgUnit` or `tenant`. No DB-level FK to scope. **Phase
2** add a check constraint or app-level guard.

### Weight isn't validated to sum to 100%

A person can have 6 INDIVIDUAL_GOALs each weighted 50%. **Phase
2** Goals UI shows total + warns; router enforces ≤100%.

### Period-end can predate period-start

No Zod refinement. **Phase 1 Tier C** validate.

### `targets` is `z.any()`

Free-form JSON — the schema doesn't constrain shape. Downstream
consumers (Cockpit, AI review) make assumptions. **Defense:**
Phase 2 introduce a discriminated union.

### No update / archive endpoint

Created plans are forever. **Phase 1 Tier B** add `update` +
`archive` mutations.

### `getMyPlans` doesn't filter by status

Returns ACTIVE + (future) archived. Today only ACTIVE exists so
it's fine, but adding archive without filter changes default UX.
