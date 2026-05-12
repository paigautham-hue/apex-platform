# financial-cockpit

> Last updated: 2026-04-21

## Purpose

The **portfolio-company financial dashboard** — Chairman + CEO
surface for entering quarterly actuals against FY budget targets,
viewing variance (ON_TRACK / WATCH / OFF_TRACK), and exporting a
board pack. `Financial.tsx` is the **upload-driven** mirror
(P&L PDFs → AI extraction → metrics) while `FinancialCockpit.tsx`
is the **direct-entry** quarterly grid.

Per master plan §5.2 — financials are first-class governance
signals, surfaced alongside human assessments.

## Scope

- Files: 2 pages + 1 server module + 1 component
- tRPC endpoints: 4+ (`writeQuarterlyActual`,
  `listFinancialSummaries`, `financial.createUpload`,
  `financial.listUploads`)
- Tables touched: `plans`, `metrics`, `metricValues`,
  `financialUploads`, `orgUnits`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/FinancialCockpit.tsx` | ~399 lines. Quarterly grid: rows = companies, cols = metrics × Q1-Q4. Chairman edits actuals inline. Variance badges driven by `varianceColor`/`varianceBadge` (≤5% green / ≤20% amber / >20% red). | `FinancialCockpit` (default) |
| `client/src/pages/Financial.tsx` | ~390 lines. Upload-driven path — CEO uploads quarterly P&L PDFs; evidence-upload pipeline runs AI extraction. Lists prior uploads. | `Financial` (default) |
| `client/src/components/VarianceAlerts.tsx` | Renders the off-track alert ribbon at top of Cockpit. | `VarianceAlerts` |
| `server/financial-analytics.ts` | ~181 lines. `computeVarianceAlerts` (per-company YTD vs target, thresholds 5%/20%), `buildBenchmarkTable` (cross-company sortable benchmark). | `computeVarianceAlerts`, `buildBenchmarkTable`, `Variance`, `VarianceAlert`, `BenchmarkRow` |

## Functions

### `server/financial-analytics.ts`

- **`computeVarianceAlerts(tenantId, fiscalYear)`** — Iterates
  PORTFOLIO_COMPANY org units, joins `plans → metrics →
  metricValues`. Sums `QUARTERLY` + `CUMULATIVE_YTD` periodType
  rows for YTD actual. Computes `(ytd - target) / target * 100`.
  Flips sign if `metric.isNegativeTarget` (e.g. cost metrics).
  Returns alerts only for `effectivePct < -5`. Sorted most
  off-track first.

- **`buildBenchmarkTable(tenantId)`** — Cross-company row per
  PORTFOLIO_COMPANY with FY revenue / EBITDA / EBITDA % /
  industrySector / lifecycleStage. **Today: `yoyGrowthPct`
  always `null`** (not computed). Revenue / EBITDA metric
  selection is **regex-based** (`/revenue/i`, `/ebitda/i`) on
  metric name.

### Page-level (FinancialCockpit.tsx)

- **`writeQuarterlyActual` mutation** — Chairman-only. Writes
  one `metricValues` row per (metric, quarter). Optimistic UI
  via `refetchSummaries` after success.
- **`varianceColor` / `varianceBadge`** — Pure functions for
  green/amber/red rendering.
- **`toNumber` / `fmtCr` / `fmtPct`** — Decimal coercion + ₹
  crore formatting helpers.

## Data Touched

- Reads: `orgUnits` (PORTFOLIO_COMPANY filter), `plans`,
  `metrics`, `metricValues`.
- Writes: `metricValues` (quarterly actuals via Cockpit), or via
  `financial.createUpload` → evidence-upload pipeline writes
  metrics+values asynchronously.

## External Dependencies

- `recharts` for benchmark charts.
- `evidence-upload.md` pipeline for PDF-driven path.

## Internal Conventions

1. **Metric naming convention from seed:** `"<Metric> FY<YY>"`
   (e.g. `"Revenue FY27"`, `"EBITDA FY27"`, `"PBT FY27"`). Both
   the regex matcher and the Cockpit grid rely on this.
2. **YTD = sum of QUARTERLY + CUMULATIVE_YTD.** Avoid double-
   counting by never writing both for the same period.
3. **Cockpit is Chairman-only for writes.** CEOs use the upload
   path. `amIChairman` gates the edit affordance.
4. **Decimal columns return strings.** Always cast with
   `Number()` / `parseFloat` / `toNumber`.
5. **`isNegativeTarget` inverts variance sign.** A cost overrun
   is "off track" even though the raw delta is positive.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `plans`, `metrics`, `metricValues`, `orgUnits` schemas. |
| `db-layer.md` | `listOrgUnits`, financial summary helpers. |
| `auth-rbac.md` | `amIChairman` + `chairmanProcedure` for writes. |
| `evidence-upload.md` | PDF→extraction pipeline for Financial.tsx. |
| `tenant-context.md` | Tenant filter. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | Embeds variance alert ribbon. |
| `ai-insights.md` | `generateFinancialMismatchInsights` reads same data. |
| `ai-ask.md` | RAG retrieves metricValues for financial queries. |
| `incentives.md` | Pulls actuals for achievement %. |

## Fragility Notes

### Regex-based metric selection is brittle

`buildBenchmarkTable` finds revenue/EBITDA via `/revenue/i` and
`/ebitda/i` on metric name. Rename "Revenue FY27" → "Net Revenue
FY27" and benchmark breaks silently. **Defense:** Phase 1 add a
`metricCategory` enum on `metrics` (REVENUE / EBITDA / PBT /
EXPENSE / CUSTOM) instead of name parsing.

### YTD sums QUARTERLY *and* CUMULATIVE_YTD

If a company reports both monthly cumulative AND quarterly
buckets, they double-count. Same fragility as
`ai-insights.md:generateFinancialMismatchInsights`. **Defense:**
seed convention is QUARTERLY only; enforce via a unique constraint
on (metricId, periodType) — not done today.

### `yoyGrowthPct` is always `null`

Benchmark row promises YoY growth but doesn't compute it. UI
shows `—`. **Phase 1 Tier C** wire to prior-FY metrics.

### No locking on actuals after a cycle closes

A Chairman can rewrite Q1 actuals in October. There's no
freeze-after-close. **Acceptable today** (small user base), but
auditors will want immutability. **Phase 2** add an `isLocked`
column + lock on cycle close.

### Variance thresholds are global, not metric-specific

5% / 20% applies to every metric. A 5% miss on PBT is graver than
on a vanity metric. **Phase 2** per-metric thresholds.

### Single fiscalYear param drives variance

`computeVarianceAlerts(tenantId, fiscalYear)` — only one FY at a
time. The Cockpit hard-codes FY27. Switching FYs requires a code
change. **Phase 2** UI selector.

### `targetValue` of 0 silently skipped

`if (target === 0) continue;` — a metric with zero target won't
appear in variance. Mostly correct (avoid divide-by-zero) but
hides "we set no target" bugs. **Defense:** UI badge "no target
set" in the grid.

### CEO upload-path and Chairman direct-entry can collide

If a CEO uploads Q1 P&L AND the Chairman types Q1 actuals, the
later write wins on `metricValues` rows keyed by (metric,
periodDate). No conflict detection. **Phase 2** show "last edited
by X at Y" provenance.
