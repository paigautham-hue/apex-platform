# chairman-surface

> Last updated: 2026-04-21

## Purpose

The Chairman's dedicated surfaces — until the cascade widens
`/team` to "any leader assesses their reports."

`/chairman` is the fund-wide dashboard: KPIs, zone health,
perception gaps, chain health, pending submissions, CEO
reflections, chronic deferrals, AI insights, cycle controls.
`/chairman/assess` is the per-target write surface: score each
dimension, write guidance notes.

Both are Chairman/Admin-only by RBAC (server-side
`isChairmanOrAdmin` check). The client surfaces also hide for
non-Chairman viewers via `useViewer().tier === 'CHAIRMAN'`.

## Scope

- Files in this map: 2 pages (~1,000 lines total)
- tRPC reads/writes: extensive — most governance endpoints

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/ChairmanDashboard.tsx` | Fund-wide read dashboard. 4 KPI cards, zone-health grid, perception-gap table, chain-health grid, pending-submissions table, CEO reflections, chronic-deferrals table, AI insights, cycle-control buttons. ~665 lines. | `ChairmanDashboard` (default) |
| `client/src/pages/ChairmanAssess.tsx` | Per-target write surface. Target picker → per-dimension card with score slider + note textarea. Submit per dimension or submit-all-at-once. ~337 lines. | `ChairmanAssess` (default) |

## Functions

### `client/src/pages/ChairmanDashboard.tsx`

- **`ChairmanDashboard()`** — Top-level. Pulls:
  - `governance.getActiveCycle` → `cycleId`
  - `governance.listCycles` → for recent-cycles fallback
  - `governance.listFeedbackTypes`
  - `governance.listRoles`, `tenant.listOrgUnits`, `person.list`
  - `governance.listAssessments({ cycleId })`,
    `listAssignments({ cycleId })`,
    `listReflections({ cycleId })`,
    `listInsights({ cycleId })`
  - `governance.listChronicDeferrals` (Round-1 addition)
  
  Renders:
  - Header with cycle month + status + action buttons (Run
    Commitment Tracker, Generate Insights, Close Cycle, Reveal
    Scores — each calls a mutation).
  - 4 KPI cards (Fund Vitality, Submissions, Perception Gaps,
    Reflections).
  - Zone Health (Hull/Deck/Mast averages — see
    `ZONE_FOR_ROLE_TYPE` map).
  - Top Perception Gaps table (largest 5).
  - Chain Health grid.
  - Pending Submissions table.
  - CEO Reflections (read-only summary).
  - Chronic Deferrals table.
  - AI Insights cards.

### `client/src/pages/ChairmanAssess.tsx`

- **`ChairmanAssess()`** — Top-level. RBAC:
  `governance.amIChairman` query — renders lock screen if false.
  Loading guard for `amIChairman === undefined` (Round-2 fix).
  
  Data:
  - `governance.getActiveCycle`, `listFeedbackTypes`, `listRoles`,
    `tenant.listOrgUnits`, `person.list`.
  - On target select: `getAssessmentsForTarget({ cycleId,
    targetType, targetId })`. **Filters client-side to
    `feedbackType.key === 'chairman'` only** (blind-assessment
    pattern — Chairman doesn't see self-ratings).
  
  Per-dimension card:
  - Score slider (1-10), saves on `valueCommit`.
  - Note textarea, saves on blur. Writes
    `governance.upsertAssessment` with `submit: false` per
    dimension; "Submit Cycle" sets `submit: true` on all.

## Data Touched

- Reads from: `governanceCycles`, `governanceAssessments`,
  `assessmentAssignments`, `feedbackTypes`, `companyReflections`,
  `chairmanGuidance`, `aiInsights`, `dependencyChains`, `persons`,
  `roles`, `orgUnits`, `mandateJournals` (chronic deferrals).
- Writes to: `governanceAssessments`, `chairmanGuidance`,
  `governanceCycles` (status), `aiInsights` (via batch jobs).

## External Dependencies

- `react`, `wouter`, `lucide-react`, `@radix-ui/*` (Slider,
  Tabs, Dialog).

## Internal Conventions

1. **Both pages gate on `isChairmanOrAdmin` server-side AND
   `amIChairman` client-side.** Defense in depth. The server-side
   gate is the security boundary; the client-side gate is the UX
   surface.
2. **`ChairmanAssess` filters to `feedbackType.key === 'chairman'`
   client-side.** Don't fetch other feedback types' rows — they're
   filtered post-fetch (Round-2 cleanup item).
3. **Cycle controls are step-wise.** The Chairman sees only the
   button for the *next* valid state transition (Close from OPEN,
   Reveal from CLOSED). No "force-revert" affordance.
4. **AI batch-job buttons fire mutations with toast feedback.**
   Run Commitment Tracker / Generate Insights are async; the
   toast shows counts on success.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `governance-cycle.md` | All cycle / assessment / assignment endpoints. |
| `mandate-journals.md` | Chronic-deferral readouts. |
| `company-reflections.md` | Reflections panel. |
| `chairman-guidance.md` | Guidance write surface. |
| `ai-insights.md` *(planned)* | Insights panel + batch-run mutations. |
| `ai-commitment.md` *(planned)* | listChronicDeferrals + runCommitmentTracker. |
| `auth-rbac.md` | `isChairmanOrAdmin`, `amIChairman`. |
| `scope.md` | `useViewer`, `listRoles`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `shell-layout.md` | `DashboardLayout` wraps both. |

## Fragility Notes

### `ZONE_FOR_ROLE_TYPE` map is hardcoded

Hull = critical operations, Deck = day-to-day, Mast = strategy.
The mapping `roleType → zone` lives inline in
`ChairmanDashboard.tsx`. If we add a new roleType in
`drizzle/schema.ts`, the dashboard silently classifies it as
"unknown." Defense: extract the mapping to `shared/constants.ts`.

### Perception-gap computation is client-side

The dashboard reads `listAssessments` and computes gaps in JS
(`Math.abs(chairman.score - self.score)`). This is expensive at
scale but trivial at 27 users. Move to server-side aggregation if
the dashboard ever feels slow.

### `ChairmanAssess` doesn't show prior cycle context

When the Chairman is rating a CXO, they don't see the CXO's
mandate journal alongside the score slider. They have to navigate
to the CXO's `/me` (which they can't directly — that's the CXO's
view). Phase 2 1:1-prep work adds the context panel.

### Cycle-control button label changes mid-fetch

If the Chairman taps "Close Cycle" and the mutation is in flight,
the button shows pending state. If `governance.getActiveCycle`
refetches before the mutation lands, the button briefly disappears
(the next-state hasn't updated). Minor flicker.

### "Reveal Scores" is destructive-ish

Once revealed, perception gaps become visible to every target.
No undo. The button has no confirmation modal. Phase 1 Tier B
adds one.

### Chronic-deferrals only flags exact-match plan items

Defined in `ai-commitment.md`. Same risk re-cited because the
Chairman dashboard surfaces the result.
