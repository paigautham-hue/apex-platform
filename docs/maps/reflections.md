# reflections

> Last updated: 2026-04-21

## Purpose

The **private reflections + weekly pulse-checks** — two related
self-capture flows:

1. **`Reflections.tsx`** — long-form journaled reflections, typed
   (ACHIEVEMENT / LEARNING / CHALLENGE_OVERCOME / etc.) with
   visibility control (private / shared with manager / included
   in review).
2. **`WeeklyPulseCheck.tsx`** — Friday lightweight check-in
   prompt (mood + brief observation), rendered with the
   `PulseCheckTrends.tsx` chart for the manager view.

Both write distinct table targets: reflections → `selfReflections`,
pulse checks → `observations` (with a pulse-check `source` tag).

## Scope

- Files: 2 pages + 1 trends component
- tRPC endpoints: 2 (`reflection.create`,
  `reflection.getMyReflections`) + `observation.create` for pulse
- Tables touched: `selfReflections`, `observations`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Reflections.tsx` | ~124 lines. Type picker + textarea + visibility selector. Lists prior reflections. | `Reflections` (default) |
| `client/src/pages/WeeklyPulseCheck.tsx` | ~169 lines. Friday lightweight check-in. Picks a person (self by default), mood, short note. Writes via `observation.create`. | `WeeklyPulseCheck` (default) |
| `client/src/components/PulseCheckTrends.tsx` | Time-series chart of mood/sentiment scores from pulse-check observations. | `PulseCheckTrends` |

## Functions

### `reflectionRouter` (server/routers.ts:464+)

- **`create`** — Mutation. `{ tenantId, type, text (min 10),
  attachments?[], visibility? }`. Stamps `personId = caller`,
  defaults visibility to `PRIVATE_DRAFT`.
- **`getMyReflections`** — Caller's reflections.

### Page-level

- **`createObservation` (WeeklyPulseCheck)** — uses standard
  `observation.create` mutation; sets source/direction to encode
  mood.

## Data Touched

- Writes: `selfReflections`, `observations`.
- Reads: `selfReflections` (own).

## External Dependencies

- `recharts` (PulseCheckTrends).

## Internal Conventions

1. **Reflections are owner-private by default.** `PRIVATE_DRAFT`
   = nobody else sees. `SHARED_WITH_MANAGER` = manager only.
   `INCLUDED_IN_REVIEW` = surfaces in `ai-review.md` draft.
2. **Pulse checks are observations, not reflections.** Pulse =
   short, structured, recurring; reflection = long, free-form.
3. **Min text length: 10 chars on reflections.** Pulse has no
   minimum.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `createSelfReflection`, `getSelfReflectionsByPerson`, `createObservation`. |
| `observations.md` | Pulse checks are observations. |
| `auth-rbac.md` | `protectedProcedure`. |
| `data-model.md` | `selfReflections`, `observations` schemas. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `ai-review.md` | Reads `INCLUDED_IN_REVIEW` reflections. |
| `me-surface.md` | Reflection count on dashboard. |
| `team-surface.md` | Manager sees `SHARED_WITH_MANAGER`. |
| `analytics.md` | Pulse-check sentiment trends. |

## Fragility Notes

### Visibility is the only auth signal

`SHARED_WITH_MANAGER` doesn't actually check WHO the caller's
manager is. Anyone in management role could in theory fetch
shared reflections if a read endpoint exposed them. Today only
`getMyReflections` exists (caller-scoped) so the risk is
theoretical. **Phase 1 Tier B**: when a `getForReport` endpoint
is added, it MUST enforce manager-relationship via scope.

### `INCLUDED_IN_REVIEW` is silent

The user toggles it but there's no AI-review confirmation that
the reflection landed. **Phase 2** show "1 reflection included
in your Q1 review draft" indicator.

### Pulse and reflection don't cross-reference

A pulse check entry and a same-day reflection are isolated.
**Acceptable** (different cognitive flows) but a future
"timeline" view would benefit from joined display.

### `getMyReflections` returns all visibility levels

Including `INCLUDED_IN_REVIEW` rows the user may have forgotten
they marked. Defense: list shows visibility badge. UI improvement
only.

### No edit / delete

Created reflections are immutable. **Phase 1 Tier C** add
soft-delete (`status: ARCHIVED`).

### Pulse-check trends mix mood and observation direction

Direction is a tri-value (POSITIVE / NEUTRAL / NEEDS_IMPROVEMENT)
which is coarser than a 1-5 mood scale. Charts plot direction
mapped to numbers, losing nuance. **Phase 2** add an explicit
`moodScore` column on `observations`.
