# observations

> Last updated: 2026-04-21

## Purpose

The **observation timeline** — the canonical store of "noticing"
events: a manager logs feedback about a report, a peer captures
a moment about a peer, a meeting auto-generates an observation,
a Friday pulse-check writes a mood observation. Observations
power data-sufficiency signals, AI review drafts, and the RAG
retriever.

Per master plan §5.4 — observations + decisions + reflections
together form the evidence layer.

## Scope

- Files: 1 capture flow + 1 timeline component + 1 router section
- tRPC endpoints: 5 (`observation.create`, `getByPerson`,
  `getMyObservations`, `getRecent`, `getByTenant`, `getTemplates`)
- Tables touched: `observations`, `persons` (data-sufficiency)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Capture.tsx` | ~373 lines. Voice-first universal capture surface. When the AI classifies intent as OBSERVATION it routes to `observation.create`. See `voice-capture.md` for the full Capture flow. | `Capture` (default) |
| `client/src/components/ObservationTimeline.tsx` | Chronological feed of observations about a subject (used on PersonProfile, /team, /me). | `ObservationTimeline` |

## Functions

### `observationRouter` (server/routers.ts:255+)

- **`create`** — Mutation. `{ tenantId, subjectPersonId, text
  (min 10), voiceTranscript?, direction, valueTags?[],
  performanceTags?[], templateUsed?, source, meetingId? }`.
  Stamps `observerPersonId = caller`. **Then** recomputes the
  subject's data sufficiency via
  `updatePersonDataSufficiency(subjectPersonId, observationCount,
  uniqueObserverCount)`.
- **`getByPerson`** — Observations where subject = person.
  Default limit 50.
- **`getMyObservations`** — Caller's own outgoing observations.
- **`getRecent`** — Tenant-wide feed (limit 20).
- **`getByTenant`** — Analytics tap (limit 1000).
- **`getTemplates`** — `publicProcedure` returning hard-coded
  `OBSERVATION_TEMPLATES` (situational prompts).

## Data Touched

- Writes: `observations` (insert), `persons.dataSufficiency*`
  (update on every create).
- Reads: `observations` (per subject / observer / tenant).

## External Dependencies

- `OBSERVATION_TEMPLATES` from `shared/observation-templates.ts`.

## Internal Conventions

1. **Five `source` enums:** QUICK_NOTE / VOICE_MEMO /
   WEEKLY_PULSE / MEETING_LOGGER / TEMPLATE. Always set explicitly.
2. **`direction` is tri-value:** POSITIVE / NEEDS_IMPROVEMENT /
   NEUTRAL. Used for sentiment trends + radar charts.
3. **Min text length 10 chars.** Prevents accidental empty rows.
4. **Data sufficiency recompute on every write.** Two metrics:
   total observation count + unique observer count. Drives the
   "enough signal to review?" flag on `persons`.
5. **`templateUsed` records which prompt** — for analytics on
   template effectiveness.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `createObservation`, `getObservationsBy*`, `updatePersonDataSufficiency`. |
| `auth-rbac.md` | `protectedProcedure` / `publicProcedure`. |
| `voice-capture.md` | Capture flow routes OBSERVATION intent here. |
| `data-model.md` | `observations` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `ai-review.md` | Pulls observations for review draft. |
| `ai-ask.md` | RAG retrieves observations on every query. |
| `meetings.md` | `MEETING_LOGGER` source observations. |
| `reflections.md` | `WEEKLY_PULSE` source observations. |
| `people-pages.md` | PersonProfile renders timeline. |
| `team-surface.md` | Team observations feed. |
| `analytics.md` | Tenant-wide observation analytics. |

## Fragility Notes

### `getByPerson` / `getRecent` have no viewer-scope filter

Any authenticated user can list observations about any other
person by id, or fetch the recent feed for the whole tenant.
**Phase 1 Tier A blocker** — gate via `canViewPerson` / scope.

### `create` doesn't check observer→subject relationship

A CEO can write observations about a peer CEO. A CXO can write
about anyone in the tenant. Acceptable for fund-wide observers
(Chairman); problem otherwise. **Phase 1 Tier B** — scope check
on subject.

### Data sufficiency recompute is O(N) on every write

`getObservationsBySubject` returns all rows then computes
counts. At 1000 observations per person, every new write reads
1000 rows. **Defense:** Phase 2 maintain a counter via
incremental update.

### `getRecent` limit-20 feeds are not paginated

Phase 1 Tier C add cursor-based pagination.

### `voiceTranscript` is stored unredacted

Raw transcripts may contain off-topic personal content. **Phase
2** PII redaction at write time.

### Templates are tenant-blind

`OBSERVATION_TEMPLATES` is a shared constant — every tenant gets
the same prompts. **Phase 2** allow tenant override via
`templates` table.

### No update / delete on observations

An observation written in error is permanent. Acceptable for
audit but harsh on accidental misclicks. **Phase 1 Tier C**
soft-delete with reason.

### `direction` and pulse-check mood are coarse

A 5-point mood scale would help trends; today it's 3-value.
Covered in `reflections.md` fragilities.
