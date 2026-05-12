# rhythm-engine

> Last updated: 2026-04-21

## Purpose

The **Rhythm Layer** — computes "what should THIS person do right
now?" for any viewer on any page. Drives:

- `PrimaryActionCard` on `/me`, `/team`, `/group` (the single most
  important UI card per master plan §4)
- Weekly pulse prompts
- Cycle deadline reminders (cron-friendly)
- Meeting prep cards (planned Phase 2)

The engine takes the messy reality (multiple cycles, multiple
assignments, multiple insights, deadlines) and returns one focused
`DailyFocus` object per person per day. The selection priority is
deterministic and documented.

## Scope

- Files in this map: 3
- tRPC endpoints: 2 (`getMyDailyFocus`, `markFocus`)
- Tables touched: `dailyFocusLog`, `aiInsights`, `governanceCycles`,
  `governanceAssessments`, `assessmentAssignments`,
  `mandateJournals`, `notifications`, `persons`, `roles`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/rhythm-engine.ts` | The pure-ish engine — `computeDailyFocus`, `recordDailyFocus`, `sendCycleDeadlineNotifications`. Priority order is hardcoded; selection logic is testable. | `DailyFocusKind`, `DailyFocus`, `computeDailyFocus`, `recordDailyFocus`, `sendCycleDeadlineNotifications` |
| `server/routers/rhythm.ts` | tRPC router exposing two endpoints. | `rhythmRouter` |
| `client/src/components/PrimaryActionCard.tsx` | The UI card that consumes `getMyDailyFocus`. Renders the focus title + body + CTA button + optional voice-prompt button. Has a client-side fallback if the server query is in flight (computes a less-rich focus from cached cycle data). | `PrimaryActionCard` (default export) |

## Functions

### `server/rhythm-engine.ts`

- **`DailyFocusKind`** (type) at `:33` — Union of 6:
  `INSIGHT | CYCLE_DEADLINE | PENDING_ASSESSMENT | EMPTY_JOURNAL |
  PULSE | GREETING`.

- **`DailyFocus`** (interface) at `:42` — The output object:
  `{ kind, urgency (0-100), title, body, ctaPath, ctaLabel,
    voicePrompt?, insightId? }`.

- **`computeDailyFocus(tenantId, personId)`** at `:60` — The
  workhorse. Walks 6 priority tiers in order and returns the first
  match:

  | Tier | Source | Trigger |
  |---:|---|---|
  | 1 | Critical AI insights (`aiInsights.severity='CRITICAL' AND status='NEW'`) | `surfaceToPersonIds` array contains the person (or is empty = surfaced to all). |
  | 2 | Cycle deadline pressure | Active OPEN cycle with `deadlineDate ≤ 7 days` away AND person has unsubmitted assessments. |
  | 3 | Pending assessments | Person has at least one `assessmentAssignments.status IN ('PENDING','IN_PROGRESS')` in the active cycle. |
  | 4 | Empty mandate journals | Person has no `mandateJournals` rows for the active cycle. |
  | 5 | Pulse | If it's been ≥ 7 days since last meaningful action. |
  | 6 | Greeting | Default "say hello, capture a thought" fallback. |

  Side effects: 4-6 DB reads (one per tier evaluated). Bails as
  soon as a tier matches.

- **`recordDailyFocus(tenantId, personId)`** — Wraps
  `computeDailyFocus` and writes the result to `dailyFocusLog`
  (upserting on `(personId, dateString)`). Returns the focus.
  Idempotent within a day — same person hitting the endpoint twice
  on the same day gets the same row (the *first* one computed —
  subsequent calls return the cached row).

- **`sendCycleDeadlineNotifications(tenantId)`** — A cron-friendly
  helper. Scans the active cycle's deadline, finds users with
  unsubmitted assessments, and writes `notifications` rows with
  type `REMINDER`. Designed to be called once per day from a
  scheduler. **Not currently wired to a scheduler** — Phase 1
  Tier C TODO.

### `server/routers/rhythm.ts`

- **`getMyDailyFocus`** at `:18` (`protectedProcedure.query`) —
  Resolves `ctx.user.id → person` via
  `getPersonByUserIdOrEmail`. Calls `recordDailyFocus`. Returns
  the `DailyFocus` (or null if no person).

- **`markFocus({ action: 'VIEWED'|'ACTED'|'DISMISSED' })`** at
  `:30` (`protectedProcedure.mutation`) — Updates today's
  `dailyFocusLog` row with the action + timestamp. Used by
  `PrimaryActionCard` to track engagement (per master plan §10
  "PrimaryActionCard click-through" metric).

### `client/src/components/PrimaryActionCard.tsx`

(~286 lines — large.) Renders the daily focus card. Key behaviors:

- Calls `trpc.rhythm.getMyDailyFocus.useQuery` with `staleTime:
  60_000`.
- Calls `trpc.rhythm.markFocus.useMutation` to record `VIEWED` on
  mount (debounced via a `useRef` to fire only once per kind
  change).
- Has a **client-side fallback** that computes a less-rich focus
  from cached cycle data when the server query is in flight. This
  is the reason `PrimaryActionCard.tsx` reads from
  `governance.getActiveCycle`, `governance.getMyJournals`,
  `governance.getMyAssessments`, `person.getMyProfile` directly —
  not because it should, but because it has to render *something*
  while waiting. Phase 2 may remove the fallback if the server
  endpoint is fast enough.
- Renders the title + body + CTA button. If `voicePrompt` is
  present, also renders a "Talk it through" button that navigates
  to `/capture?voice=true&prompt=...`.

## Data Touched

- `dailyFocusLog` — read+write (the focus cache).
- `aiInsights` — read (tier 1).
- `governanceCycles` — read (tier 2 + 3).
- `governanceAssessments` — read (tier 2 — submission status).
- `assessmentAssignments` — read (tier 3).
- `mandateJournals` — read (tier 4).
- `notifications` — write (deadline notifications fan-out).
- `persons`, `roles` — read (for the greeting tier's name lookup).

## External Dependencies

- `drizzle-orm` — `and`, `eq`, `gte`, `lte`, `desc`, `isNull`,
  `inArray`.
- `@trpc/server`, `zod` — endpoint plumbing.

## Internal Conventions

1. **Priority order is hardcoded and deterministic.** Don't add
   a "fancier" scoring algorithm without explicit design discussion.
   The 6-tier ladder is the contract; reordering it changes user
   behaviour.

2. **One `DailyFocus` per person per day.** The cache layer
   (`dailyFocusLog`) ensures idempotency within a day. **A person
   doesn't get a different focus card if they refresh the page** —
   they get the same card until tomorrow. (Exception: if they tap
   `markFocus({ action: 'ACTED' })`, future fetches may surface a
   different tier — but that's user-driven.)

3. **The engine reads, the engine doesn't mutate (except
   `dailyFocusLog` cache writes).** It doesn't change cycle state,
   doesn't write assessments, doesn't generate notifications
   inline. `sendCycleDeadlineNotifications` is a separate function
   that runs on a cadence, not as a side effect of computing focus.

4. **Server prefers server-computed focus; client fallback is a
   safety net.** When both produce different answers (rare —
   server has more data), trust the server. The client fallback
   exists to render *something* during the server-side fetch.

5. **`markFocus` is fire-and-forget from the UI's perspective.**
   The user's interaction with the focus card shouldn't block on
   the write. Errors are logged but not shown.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `dailyFocusLog`, `aiInsights`, `governanceCycles`, `governanceAssessments`, `assessmentAssignments`, `mandateJournals`, `notifications`, `persons`, `roles` types. |
| `db-layer.md` | `getDb`, `getPersonByUserIdOrEmail`. |
| `governance-cycle.md` | `governanceCycles` semantics (state machine), `governanceAssessments` submission state. |
| `mandate-journals.md` | `mandateJournals` rows for the empty-journal tier. |
| `ai-insights.md` *(planned)* | `aiInsights.severity` + `surfaceToPersonIds` for tier 1. |
| `notifications.md` *(planned)* | `notifications` table for the deadline fan-out. |
| `auth-rbac.md` | `protectedProcedure`. |
| `scope.md` | (`useViewer()` not used here directly — but the client `PrimaryActionCard.tsx` consumes via parent pages.) |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| `me-surface.md` | Embeds `PrimaryActionCard` at the top of `/me`. |
| `team-surface.md` | Same — top of `/team`. |
| `group-surface.md` | Same — top of `/group`. |
| `chairman-surface.md` | `PrimaryActionCard` on `/chairman` (planned). |
| `analytics.md` *(planned)* | `dailyFocusLog` engagement data feeds the §10 success metrics. |

## Fragility Notes

### Priority order assumes the 6 tiers are mutually exclusive

If a person has BOTH a critical insight AND a deadline-pressure
trigger, they see the insight. **They never see the deadline
warning** until the insight is dismissed or downgraded. **In
practice:** rare. **A real concern when** AI insights become
common — a person could miss a deadline because an insight kept
hogging the focus. **Defense:** add a tier-1 override condition
("deadline ≤ 1 day always wins over insights").

### `dailyFocusLog` cache is keyed by `(personId, dateString)`

The `dateString` is `new Date().toISOString().slice(0,10)`. **In
UTC.** A user in IST (UTC+5:30) sees their "today" roll at 5:30 AM
local time. **Minor UX issue:** at 11 PM IST, the cache says
"today" but the user feels it's late at night. **Defense:** when
Phase 1 Tier C wires per-user timezone, compute the date in the
user's local TZ.

### `markFocus` doesn't return the updated row

`PrimaryActionCard` records `VIEWED` on mount, but the UI doesn't
re-fetch. If a fresh tier becomes available mid-session (e.g. a
new AI insight is generated), the user won't see it until they
navigate away and back. **Defense:** invalidate
`getMyDailyFocus` on every `markFocus` action.

### Engine reads are sequential

The 6 tiers are checked in order; if tier 1 misses, we read tier
2's tables, etc. **Each tier is 1-2 DB reads.** For a typical
"no critical insight, has cycle deadline" user, the engine does
3-5 reads. **At scale** this is meaningful; **today** it's fine.

### `sendCycleDeadlineNotifications` isn't wired

The function exists but no scheduler calls it. The notification
fan-out is currently **manual via admin action** or **implicit via
the cycle state machine** (`updateCycleStatus → notifyCycleOpen`).
The T-7 / T-3 / T-1 deadline reminders specified in master plan
§5.7 don't actually fire today. **Phase 1 Tier C deliverable**:
wire a scheduler (cron, Bull queue, or Express interval).

### Client fallback can mismatch server-computed focus

When the network is slow, `PrimaryActionCard.tsx`'s client fallback
computes a focus that may differ from what the server would
return. The user briefly sees the fallback, then sees the
server-computed version. **Visual flicker** — a Phase 1 Tier B
polish item: render a skeleton during the fetch instead.

### `surfaceToPersonIds` empty-array means "everyone"

In tier 1, `aiInsights.surfaceToPersonIds = []` is interpreted as
"surface to all persons." A non-empty array narrows. **A real
fragility:** a buggy insight generator that forgets to populate
`surfaceToPersonIds` ends up surfaced to every user. **Defense:**
the insight generators (in `ai-insights.md`) need to always
populate this field explicitly. **Today** the empty-default is the
intent for fund-wide insights — but the contract should be
documented in the schema column comment.

### No "snooze" affordance

A user who taps `markFocus({ action: 'DISMISSED' })` doesn't see
the same focus again — but they also don't see anything else for
the rest of the day (the cache is keyed by `(personId, date)` and
returns the dismissed row's data). **Effectively:** dismissing
the daily focus = hiding the PrimaryActionCard for the rest of
the day. **Probably not the intent.** Worth re-evaluating: maybe
dismiss should bump to the next-priority tier, not hide entirely.

### `recordDailyFocus` is idempotent — but only on first call wins

The first call of the day for a person writes the row. Subsequent
calls return the cached row. **But:** if the cached row is from a
prior fetch where, say, an insight was tier-1 and has since been
downgraded, the user sees a stale focus all day. **Defense:**
invalidate the day's row when an upstream input (insight,
assignment, deadline) changes. **Not implemented today** — accept
"daily" granularity.
