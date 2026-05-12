# analytics

> Last updated: 2026-04-21

## Purpose

The **tenant-wide analytics dashboard** at `/analytics` — KPI
cards + charts over people, observations, and plans. Distinct
from `chairman-surface.md` (which is governance-cycle focused)
and `financial-cockpit.md` (which is portfolio-financial
focused). This is the "how is the SYSTEM doing?" view.

## Scope

- Files: 1 page (client-side aggregation)
- tRPC endpoints called: 3 (`person.list`,
  `observation.getByTenant`, `plan.getByTenant`)
- Tables touched: 0 directly (reads via existing routers)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Analytics.tsx` | ~252 lines. Pulls full tenant rows, computes aggregations client-side: data-sufficiency distribution, observations-by-month, observation-direction donut, top-5 observed persons. Charts via `recharts`. | `Analytics` (default) |

## Functions

### Page-level

- **`dataSufficiencyData`** — Groups persons by
  `dataSufficiencyLevel` (INSUFFICIENT / EMERGING / SUFFICIENT /
  RICH).
- **`observationsByMonth`** — Bins by month string.
- **`observationDirectionData`** — Counts POSITIVE / NEUTRAL /
  NEEDS_IMPROVEMENT.
- **`topPerformers`** — Top 5 persons by observation count
  (misleadingly named — this is observation _volume_, not
  performance).

## Data Touched

- Reads only.

## External Dependencies

- `recharts`.

## Internal Conventions

1. **Client-side aggregation today.** No server-side analytics
   endpoint. Reasonable while the dataset is small.
2. **Hardcoded `tenantId: 1`.** Single-tenant assumption.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `observations.md` | `getByTenant` (limit 1000). |
| `goals.md` | `plan.getByTenant`. |
| `people-pages.md` | `person.list`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| (none — leaf surface) | |

## Fragility Notes

### "Top performers" is misnamed

It's top by observation _count_, which correlates with being
observed more (often = visibility, sometimes = problem area).
Could mislead a Chairman skimming. **Phase 1 Tier B** rename
to "Most observed" + add a separate "Positive-observation rate"
metric.

### Client-side aggregation breaks at scale

`getByTenant` returns 1000 observations + every person + every
plan to the browser. At 10K rows the page lags. **Phase 2**
server-side aggregation endpoint.

### No filters

No date range, role, function, or company filter. Phase 1 Tier C.

### No scope check on the data

`getByTenant` endpoints expose tenant-wide data to any
authenticated user. Acceptable for analytics if every user is
permitted to see aggregates; problematic if individual rows
expose private observations. Inherits the
`observations.md` fragility about scope.

### Hardcoded `tenantId: 1`

Single-tenant assumption. When multi-tenant lands, swap to
`useViewer().tenantId`.

### `dataSufficiencyLevel` strings hardcoded

Levels assumed to be one of four strings. If schema enum changes
to a new value, the chart just shows a new wedge silently.
Defensive: explicit enum-to-label mapping.
