# incentives

> Last updated: 2026-04-21

## Purpose

The **incentive simulator** — a Chairman/CEO/CXO plays "what if"
with their bonus payout given hypothetical achievement %. Today
the simulator is **pure-client**: no server-side config or
computation persistence. The `incentiveConfigs` /
`incentiveComputations` tables exist in the schema as Phase 2
scaffolding but are unused.

## Scope

- Files: 1 page (client-only computation)
- tRPC endpoints: 0 today (Phase 2 will add)
- Tables touched: 0 today; `incentiveConfigs`,
  `incentiveComputations` reserved for Phase 2

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/IncentiveSimulator.tsx` | ~178 lines. Three inputs: base salary, target bonus %, achievement %. Computes incentive amount via piecewise multiplier (below 80% = 0; 80-100% linear 0→50%; 100-120% linear 50→100%; 120-150% linear 100→150% capped). Output: incentive ₹ + total compensation ₹. | `IncentiveSimulator` (default) |

## Functions

### Page-level (IncentiveSimulator.tsx)

- **`calculateIncentive()`** — Piecewise multiplier:
  - `< 80%` achievement → 0× target bonus
  - `80–100%` → linear 0 → 0.5× (i.e., half pay at threshold,
    full target pay at 100%)
  - `100–120%` → linear 0.5 → 1.0×
  - `120–150%` → linear 1.0 → 1.5×, capped at 1.5×
  
  Returns `targetBonusAmount × multiplier`.

- **`baseSalary`, `targetBonus`, `achievement`** — Local React
  state. No persistence today; refresh resets to defaults
  (₹10L / 30% / 100%).

## Data Touched

None at runtime. Phase 2 schema reserved:

- `incentiveConfigs(tenantId, orgUnitId, fiscalYear, thresholds,
  caps, metrics[])` — per-role / per-company plan
- `incentiveComputations(tenantId, personId, fiscalYear, achievement,
  payout, computedAt)` — historical computations

## External Dependencies

None. Pure JS arithmetic + shadcn UI.

## Internal Conventions

1. **Currency = INR (₹).** Hard-coded.
2. **Pure-client today.** Nothing leaves the browser. Treat as
   a sketchpad, not the system of record.
3. **Schema is reserved.** Don't write to `incentiveConfigs` /
   `incentiveComputations` without first wiring a server-side
   computation + tRPC mutation.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| (none today — pure client) | |
| `financial-cockpit.md` *(planned)* | Phase 2 will pull achievement % from actuals/targets. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| (none today) | |

## Fragility Notes

### Pure-client = no auditability

A Chairman can model any scenario; nothing is logged. **For
sketching it's fine.** When this becomes the system of record
for actual payouts, every computation must persist to
`incentiveComputations` with the inputs + multiplier curve
version, and be append-only.

### Hard-coded multiplier curve

The 80/100/120/150 thresholds and 0/0.5/1.0/1.5 multipliers are
in source. Different companies / roles / years often have
different curves. **Phase 2** read curve from `incentiveConfigs`
keyed by (orgUnit, fiscalYear, roleLevel).

### No tie to actual achievement

The achievement % is typed by the user. There's no link to
`financial-cockpit.md` actuals or governance assessment scores.
A user can model 150% achievement when reality is 70%. **Phase
2** auto-populate from a chosen scorecard.

### Currency assumption

`₹` symbol is hard-coded. Multi-currency (USD for cross-border
acquisitions) needs a currency field on `incentiveConfigs`.

### Single-metric model

Real incentive plans are usually multi-metric (revenue × EBITDA
× qualitative). The simulator flattens to one achievement %.
**Phase 2** support weighted multi-metric input.
