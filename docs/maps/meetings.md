# meetings

> Last updated: 2026-04-21

## Purpose

The **lightweight meeting log** — capture 1:1s, team meetings,
reviews, and calibration sessions. Today's flow: manager opens
`Meetings.tsx`, picks a participant, types notes + sentiment,
hits save → creates a `meetings` row + an `observations` row
linked back. `MeetingTimer.tsx` is a side-utility for live
session timing.

Phase 2 will expand this into a full **1:1 prep surface** with
agenda assist (per master plan §6 and `MERIDIAN_REFERENCE.md`
meeting-templates pattern).

## Scope

- Files: 1 page + 1 component
- tRPC endpoints: 3 (`meeting.create`, `meeting.start`,
  `meeting.getMyMeetings`)
- Tables touched: `meetings`, `observations`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Meetings.tsx` | ~275 lines. Form for logging a meeting (participant, type, scheduledAt, notes, actionItems[], sentiment). List of caller's past meetings. Pre-fills suggested 1:1 cadence from `directReports`. | `Meetings` (default) |
| `client/src/components/MeetingTimer.tsx` | Live session timer widget; calls `meeting.start` then surfaces elapsed time. | `MeetingTimer` |

## Functions

### `meetingRouter` (server/routers.ts:579+)

- **`create`** — Mutation. Creates `meetings` row + synthesises a
  follow-up `observations` row with `source: 'MEETING_LOGGER'`,
  `meetingId` linkback, and a direction mapped from sentiment
  (POSITIVE → POSITIVE, CHALLENGING → NEEDS_IMPROVEMENT, NEUTRAL
  → NEUTRAL).
- **`start`** — Mutation. Live-start a session — creates the
  meetings row with `startedAt: now`; no observation yet (added
  later via `create` flow or skipped).
- **`getMyMeetings`** — Caller's meetings as manager.

## Data Touched

- Writes: `meetings`, `observations`.
- Reads: `meetings` (own).

## External Dependencies

- shadcn UI.

## Internal Conventions

1. **Every meeting log creates an observation.** Meetings without
   observations are anomalous (the timer-only path).
2. **Sentiment → observation.direction mapping is hard-coded.**
   Change in `routers.ts:616`.
3. **`source: 'MEETING_LOGGER'`** on observations distinguishes
   from manual `/capture` observations.
4. **Caller is always the manager.** Subject = participant. No
   support today for logging a meeting you were a participant in
   (vs. organiser).

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `createMeeting`, `createObservation`, `getMeetingsByManager`. |
| `observations.md` | The linked observation row. |
| `data-model.md` | `meetings`, `observations` schemas. |
| `auth-rbac.md` | `protectedProcedure`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `me-surface.md` | Meeting count on dashboard. |
| `observations.md` | Meeting-sourced observations appear in timeline. |
| `people-pages.md` | PersonProfile shows meetings the viewer had with that person. |

## Fragility Notes

### `subjectPersonId` not scope-checked

`create` accepts any `participantPersonId` and writes both the
meeting and an observation about that person. No
`canViewPerson(scope, participantPersonId)` check. A CXO can log
a 1:1 with a CEO they don't manage. **Phase 1 Tier B blocker.**

### `start` doesn't pair to a `create`/finalise

A live-started meeting has `startedAt` but no notes. There's no
"finalise" mutation to attach notes after the timer ends — the
user has to use `create` separately, creating a second row.
**Defense:** Phase 2 merge `start` + `create` into a `finalise`
flow.

### Sentiment-to-direction mapping is lossy

CHALLENGING → NEEDS_IMPROVEMENT lumps "I gave hard feedback" and
"they're struggling" into one bucket. **Phase 2** split or remove
the auto-observation and let the user write it explicitly.

### Mass `(result as any)[0]?.insertId || 0`

`meetingId: 0` when insertId is missing breaks the observation's
linkback. Drizzle MySQL returns `{ insertId }` on the result
object directly (not `[0].insertId`). Likely bug — review.

### No two-way attendance

`participantPersonId` is single. Team meetings (`TEAM` type) only
record the manager + one other. **Phase 2** array-typed
participants.

### Calendar-source meetings duplicate

`server/calendar.ts` (planned wire-up) may sync external calendar
events into `meetings`. No dedup. **Phase 2** add
`externalEventId` unique constraint.
