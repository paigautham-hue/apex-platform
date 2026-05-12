# mandate-journals

> Last updated: 2026-04-21

## Purpose

The **Captain's Log** layer — what every CXO, CEO, and (eventually)
any leader writes monthly against each of their mandates. Captures
"what I did this month" + "what I plan next month" + a structured
list of plan items that get tracked from cycle to cycle.

This subsystem is the source data for:
- Plan-to-log tracking (did last month's plan actually happen?)
- AI commitment tracker (chronic deferrals across multiple cycles)
- 1:1 prep briefs (manager sees their report's logged progress)
- AI insights (engagement patterns, commitment tracking)

## Scope

- Files in this map: 4 server + 2 client (MyBridge + MyIsland)
- tRPC endpoints: 4 in `governanceRouter`
- Tables touched: `mandateJournals` + cross-reads
  (`governanceCycles`, `governanceAssessments`)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers.ts` (mandate-journal endpoints, ~1130-1163, 1410-1437) | The `upsertJournal`, `getMyJournals`, `getLastJournal`, `markPriorPlanItem` procedures in `governanceRouter`. | (mounted at `appRouter.governance.*`) |
| `server/db.ts` (mandate-journal helpers, ~1009-1081) | `upsertMandateJournal`, `getMandateJournalsByPersonAndCycle`, `updateJournalPlanItems`, `getLastMandateJournal`. | See `db-layer.md`. |
| `client/src/pages/MyBridge.tsx` | The CXO workspace — renders mandate cards with 4-tab UI (Log / Plan / Self-rate / Chairman view). Writes journals on textarea blur. | `MyBridge` (default export) |
| `client/src/pages/MyIsland.tsx` | The CEO workspace — renders company-dimension cards using the same pattern, scoped to `targetType=COMPANY`. | `MyIsland` (default export) |
| `client/src/pages/Me.tsx` | The fractal `/me` page — embeds `MyBridge` or `MyIsland` based on viewer's tier + role. | `Me` (default export) |
| `client/src/components/JournalEditor.tsx` | Inline rich-textarea + voice mic + auto-save shell used by both pages. | `JournalEditor` |
| `client/src/components/VoiceJournalCapture.tsx` | Voice-first capture variant — talks to `server/routers/voice.ts`. **Detailed in `voice-capture.md`.** | (see `voice-capture.md`) |

## Functions

### `server/routers.ts` — journal endpoints in `governanceRouter`

- **`upsertJournal({ tenantId, cycleId, dimensionKey, roleId,
  orgUnitId, logText, planText, planItems })`** — Writes a journal
  row keyed on `(person, cycle, dimensionKey)`. The caller's
  `person.id` is resolved via `getPersonByUserId`; `assessorPersonId`
  is never passed by the client. `roleId` is for CXO mandates;
  `orgUnitId` is for CEO/company dimensions. `planItems` is the
  structured commitment list.
- **`getMyJournals({ tenantId, cycleId })`** — Returns the caller's
  journals for the given cycle. Used by MyBridge / MyIsland to
  rehydrate on mount.
- **`getLastJournal({ tenantId, dimensionKey })`** — Returns the
  caller's most recent journal for a given dimension *across all
  cycles* (descending by `cycleId`). Used by MyBridge / MyIsland's
  plan-to-log tracking — "what did you plan last cycle?"
- **`markPriorPlanItem({ tenantId, dimensionKey, priorCycleId,
  itemIndex, completed })`** at `~1411` — **Lives in governanceRouter
  but operates on `mandateJournals`.** Loads the prior-cycle journal
  for the same `(person, dimensionKey)`, patches
  `planItems[itemIndex].completedNextMonth`, saves via
  `db.updateJournalPlanItems`.
  - This is the user-facing "tick the box" action when reviewing
    last cycle's commitments.

### `server/db.ts` — journal helpers

(Cross-referenced in `db-layer.md`. Re-listed for discoverability.)

- **`upsertMandateJournal(j: InsertMandateJournal)`** at `:1009` —
  Composite-key upsert on `(tenantId, personId, cycleId,
  dimensionKey)`. Update path writes `logText`, `planText`,
  `planItems`, `roleId`, `orgUnitId`.
- **`getMandateJournalsByPersonAndCycle(personId, cycleId,
  tenantId)`** at `:1035` — All journals for one person in one
  cycle.
- **`updateJournalPlanItems(journalId, planItems, tenantId)`** at
  `:1050` — Used by `markPriorPlanItem`.
- **`getLastMandateJournal(personId, dimensionKey, beforeCycleId,
  tenantId)`** at `:1063` — Returns the most recent journal
  before a given cycle (exclusive). Used for the plan-to-log
  side-by-side view.

### `client/src/pages/MyBridge.tsx`

A single React component rendering all of a CXO's mandates as
cards. Each card has 4 tabs (Log / Plan / Self-rate / Chairman view).
Hot path:

1. **Mount:** `useViewer()` → `personId`, `currentRole`. Fetch:
   - `governance.getActiveCycle` — to know which cycle we're in.
   - `governance.getMyJournals` — to rehydrate Log + Plan fields.
   - `governance.getMyAssessments` — to rehydrate Self-rate.
   - `governance.getLastJournal` (per mandate) — to show last
     cycle's plan alongside this cycle's log.

2. **Per-mandate card:** Renders `JournalEditor` for the Log
   textarea + a separate one for the Plan. Each `onBlur` calls
   `governance.upsertJournal` with the current draft. The plan-to-
   log column on the side shows last cycle's `planText` and
   `planItems` with checkboxes that call `markPriorPlanItem`.

3. **Submit Month:** Iterates over every mandate, calls
   `upsertJournal` with `submit: true` (note: the current
   implementation passes `submit` to the *assessment* endpoint;
   `upsertJournal` doesn't gate on submit) AND `upsertAssessment`
   with `submit: true`. Uses `Promise.allSettled` to track partial
   failures (Round-1 fix).

### `client/src/pages/MyIsland.tsx`

Mirror of MyBridge for CEOs. Differences:

- Iterates over 6 hardcoded `DEFAULT_COMPANY_DIMENSIONS` instead of
  `role.successMetrics`.
- Includes the 5-field reflection form (see
  `company-reflections.md`).
- Targets `COMPANY` (the CEO's `currentRole.orgUnitId`) instead of
  `ROLE`.

### `client/src/components/JournalEditor.tsx`

The reusable editor. Takes `value`, `onChange`, `onBlur`, plus an
optional `voicePrompt` prop. Renders a textarea + small voice mic
button.

## Data Touched

- `mandateJournals` — read+write (the hot path).
- `governanceCycles` — read (to find active cycle).
- `governanceAssessments` — read (to rehydrate self-rate state
  alongside the journal — same UI surface).
- `persons` — read (to resolve `ctx.user.id → person.id`).

## External Dependencies

- `drizzle-orm` — `and`, `eq`, `desc`.
- `@trpc/server`, `zod` — endpoint plumbing.
- `react`, `wouter`, `sonner` (toasts) — client-side.

## Internal Conventions

1. **`dimensionKey` is the canonical mandate identifier.** It's the
   raw `roles.successMetrics[i]` string (or a
   `DEFAULT_COMPANY_DIMENSIONS[i]` string for CEO islands). **Don't
   trim, lowercase, or normalize it** — equality is used as the
   logical join across `mandateJournals`, `governanceAssessments`,
   and `chairmanGuidance` rows.

2. **Save on blur, not on every keystroke.** Saving on each keystroke
   would hammer the upsert path. Blur-save is the contract; users
   are trained to see "saving…" toast on blur.

3. **`planItems` is a structured array** of `{ item: string;
   completedNextMonth: boolean | null }`. The `null` is
   "not yet reviewed." The transition `null → true/false` happens
   only via `markPriorPlanItem`.

4. **`upsertJournal` is idempotent for the same composite key.**
   Multiple saves of the same draft are safe — they overwrite the
   same row.

5. **The Chairman view tab is read-only** — it pulls
   `governance.getAssessmentsForTarget(target=ROLE, targetId=
   roleId)` filtered to `feedbackType.key='chairman'`. Visibility
   is enforced via `reveal-gating.ts` (see `governance-cycle.md`).

6. **MyBridge for CXOs and MyIsland for CEOs share the same data
   pattern** — both write `mandateJournals` and
   `governanceAssessments`. The split exists at the UI level only
   (different default dimensions, different target type). When
   adding new fields to the journal, update **both** pages or
   neither.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `mandateJournals`, `governanceCycles`, `governanceAssessments` types. |
| `db-layer.md` | `upsertMandateJournal`, `getMandateJournalsByPersonAndCycle`, `updateJournalPlanItems`, `getLastMandateJournal`, `getPersonByUserId`. |
| `governance-cycle.md` | The cycle endpoints + cycle state machine; the journal endpoints live in the same router. |
| `auth-rbac.md` | `protectedProcedure`, `ctx.user`. |
| `scope.md` | `useViewer()` (used by `Me.tsx` to decide whether to render `MyBridge` or `MyIsland`). |
| `voice-capture.md` *(planned)* | `VoiceJournalCapture.tsx` for voice-first journal writes. |
| `shell-layout.md` *(planned)* | `DashboardLayout` shell that wraps MyBridge/MyIsland. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| `chairman-guidance.md` | Joins `mandateJournals` for "what did the target say they'd do?" alongside chairman writes. |
| `ai-commitment.md` | `mandateJournals.planItems` history across cycles for chronic-deferral detection. |
| `ai-insights.md` | `mandateJournals` engagement signals (journals-logged vs mandates-total). |
| `rhythm-engine.md` | `mandateJournals` empty-state to surface "log this mandate today." |
| `me-surface.md` | Embeds `MyBridge` / `MyIsland`. |
| `360-feedback.md` | Cross-references journal context when surfacing 360 feedback for a target. |

## Fragility Notes

### `markPriorPlanItem` lives in the wrong router

The endpoint operates on `mandateJournals` but lives in
`governanceRouter` (alongside cycle ops). This is a **discoverability
bug** — a contributor looking for journal mutations under
`governance.upsertJournal` won't find `markPriorPlanItem` until they
scroll past every cycle/feedback/assignment endpoint. **Defense:**
this map documents it; consider sub-routering `governanceRouter`
later (`governance.cycle.*`, `governance.journal.*`, etc.).

### `dimensionKey` strings can drift

A mandate string change in `roles.successMetrics` (e.g. fixing a
typo) breaks the composite-key match with existing journal rows.
The journals don't *delete* — but the rehydrate-on-mount logic
(`getMyJournals` → filter by `dimensionKey`) silently drops them.
**Defense:** add a migration helper that updates `mandateJournals.
dimensionKey` whenever `roles.successMetrics` is reordered or
renamed. **Currently absent.** A real Phase 1 risk when admins
start editing mandates.

### `planItems` structure is fragile

If a buggy client write sends `planItems: ["plain string"]`
(missing the object wrapper), the column accepts it (JSON type
doesn't enforce shape). Reads then crash with "Cannot read
properties of undefined (reading 'item')" on the client. **Defense:**
the Zod input schema on `upsertJournal` validates the shape; trust
the server. But raw SQL inserts (e.g. seed scripts) could
bypass — keep an eye when adding new write paths.

### Plan-to-log lookup uses `cycleId DESC` not `month DESC`

`getLastMandateJournal` orders by `cycleId DESC LIMIT 1`. **If
cycle IDs are not monotonic-by-month** (e.g. an old cycle is
inserted via fixup script), the "last cycle" lookup returns the
wrong row. **Defense:** cycles are created in monthly order in
practice. If a fixup is ever needed, also re-seed the related
journal cycle references.

### `Submit Month` may partially fail

The Round-1 fix uses `Promise.allSettled` and toasts a partial-
failure message. **But:** if the journal write succeeds and the
assessment write fails, the user sees their journal saved but the
self-rate not. The UI re-fetches on mount, but in-session the user
might think they submitted everything. **Defense:** show per-
mandate status, not a global toast. Tracked as a Phase 1 Tier B
polish.

### `JournalEditor` blur-save races with autosave debounce

If a user types rapidly and clicks "Submit Month" within ~150ms of
their last keystroke, the blur fires `upsertJournal` with the
*pre-keystroke* state. The submit handler then queues another
`upsertJournal` (via the explicit submit path), which writes the
correct state. **Net:** safe, but two writes per save event.
**Defense:** the dedup-by-composite-key insert behavior absorbs
this. Just be aware of the doubled write traffic.

### `DEFAULT_COMPANY_DIMENSIONS` is hardcoded in MyIsland.tsx

The six dimensions ("Revenue Growth", "Margin & Profitability",
"Operations & Delivery", etc.) are a constant array in the page
file. If a CEO ever wants company-specific dimensions, this needs
to read from `orgUnits.customMetrics` instead. **Master plan §8 #7
is the open decision** — currently default: hardcoded stays.

### Voice path uses a different write

`VoiceJournalCapture.tsx` writes via `server/routers/voice.ts:
dispatchIntent` → `db.upsertMandateJournal`. The flow doesn't go
through `governance.upsertJournal`. **Audit trail is split** — if
Phase 2 wires `AuditLogger`, the voice path must call it too. See
`voice-capture.md` for the parallel path.

### No `submittedAt` on journals

Unlike `governanceAssessments`, `mandateJournals` has no
`submittedAt` field. "Submitted" status is inferred from "is the
matching `governanceAssessments` row submitted?" This works today
but conflates two different lifecycles. **If we ever want
journal-without-rating** (e.g. a CEO logs but doesn't self-rate),
we need an explicit `journalSubmittedAt` or a separate state
column.
