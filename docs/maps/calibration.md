# calibration

> Last updated: 2026-04-21

## Purpose

**Planned-future** — the Chairman/Group-CEO **calibration session**
surface where leaders discuss ratings across direct reports,
adjust for rater bias, and lock final scores. Schema scaffold
exists; **no UI today, no router today.** Phase 4 work per master
plan §6.

## Scope

- Files: 0 today
- tRPC endpoints: 0 today
- Tables touched: `calibrationSessions` (schema only)

## Files

| File | Purpose | Key exports |
|---|---|---|
| *(not built)* | Phase 4 will add `client/src/pages/Calibration.tsx` + `server/routers/calibration.ts` + `server/calibration-engine.ts`. | — |

## Functions

*(none today)*

## Data Touched

- `calibrationSessions` — defined in `drizzle/schema.ts` but no
  reads/writes in production code. Columns sketched: tenantId,
  cycleId, sessionType, participants[], discussedPersonIds[],
  adjustments[], status, lockedAt, lockedByPersonId.

## External Dependencies

*(none today)*

## Internal Conventions

*(to be defined when built)*

1. **Append-only adjustments.** Each rating change must record
   prior + new + rationale (audit, not history-rewriting).
2. **Lock-on-close.** A locked session can't be edited.
3. **Participants from `governance-cycle.md` assignments.**

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `governance-cycle.md` *(planned)* | Reads final assessment scores. |
| `data-model.md` | `calibrationSessions` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| *(none today)* | |

## Fragility Notes

### Schema exists but no enforcement

The `calibrationSessions` table is in `drizzle/schema.ts` and
will appear in migrations. If left empty for too long, schema
drift is likely. **Defense:** Phase 4 build OR drop the table
until needed.

### No connection to `governance-cycle.md` reveal-gating

Calibration must happen AFTER `AFTER_ALL_SUBMIT` but BEFORE
public revelation. Today the reveal flips immediately on last
submission — no calibration window. **Phase 4** introduces a
`CALIBRATION_PENDING` state on the cycle.

### Master plan §6 calls out calibration but ranks it Phase 4

Don't prioritise without explicit user signal. Listed here so
future devs don't think the empty table is dead code.
