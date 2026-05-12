# team-surface

> Last updated: 2026-04-21

## Purpose

`/team` is the **manager's view of their direct reports** — fractal
across tiers. Chairman sees the CXOs+CEOs. A CEO sees their
leadership team. A CXO sees their function. A function head (when
modelled) sees their managers. Same UI, scoped data.

The page is where leaders assess their reports during the cycle, see
who's lagging on submissions, and (Phase 2) open 1:1 prep briefs.

## Scope

- Files in this map: 1 page + helper components (rendered inline)
- tRPC reads: 4 (`scope.listDirectReports`,
  `scope.getTeamSubmissionStatus`, `governance.getActiveCycle`, plus
  `PrimaryActionCard`'s embedded reads)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Team.tsx` | The `/team` page. Renders identity + cycle banner + PrimaryActionCard + a grid of `DirectReportCard`s. | `Team` (default) |

`DirectReportCard` is a sub-component defined inline in `Team.tsx`.

## Functions

### `client/src/pages/Team.tsx`

- **`Team()`** at `:28` — Top-level. Reads `useViewer`,
  `scope.listDirectReports`, `scope.getTeamSubmissionStatus`,
  `governance.getActiveCycle`. Builds a per-report status map keyed
  by `personId`. Renders empty-state if `directReports.length === 0`
  (with a "Back to My Bridge" button).
- **`DirectReportCard({ member, status, onOpen })`** — Inline card
  showing the report's avatar + name + role + current cycle status
  (journal+rating progress). `onOpen` navigates to
  `/people/<personId>`.

## Data Touched

- Read-only: `persons` (via `scope.listDirectReports`),
  `roles`, `governanceAssessments` (via
  `getTeamSubmissionStatus`), `mandateJournals` (same),
  `governanceCycles` (active cycle), `aiInsights` (via
  `PrimaryActionCard`).

## External Dependencies

- `react`, `wouter`, `lucide-react`, `@radix-ui/*`.

## Internal Conventions

1. **The team-view is read-only.** Assess writes happen on
   `/chairman/assess` today; Phase 1 Tier A widens to "any leader
   uses `/team` to assess their reports."
2. **`DirectReportCard` shows submission status, not score
   content.** The leader doesn't see the report's self-rating until
   they've assessed (per blind-assessment principle).
3. **"No reports" empty state has a single CTA back to `/me`** —
   don't link to /governance-admin (most ICs can't act there).

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `scope.md` | `useViewer`, `listDirectReports`, `getTeamSubmissionStatus`. |
| `governance-cycle.md` | `getActiveCycle`. |
| `rhythm-engine.md` | `PrimaryActionCard` (embedded). |
| `me-surface.md` | The "Back to My Bridge" navigation. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `shell-layout.md` | `DashboardLayout` wraps `/team`. |
| `people-pages.md` | `DirectReportCard.onOpen` → `/people/<id>` (the person profile detailed in `people-pages.md`). |
| `chairman-surface.md` *(planned cascade)* | When cascade lands, `/team` becomes the universal assess-your-reports surface; `/chairman/assess` becomes a special case. |

## Fragility Notes

### Cascade not yet realised

Phase 1 Tier A introduces "Assess your team" on `/team`. Today the
page is read-only for non-Chairman viewers. The Chairman uses
`/chairman/assess` separately. **When the cascade lands**, the
page will need an assess flow that reuses the `ChairmanAssess` UI
scoped to direct reports.

### N+1 on submission status

`getTeamSubmissionStatus` does one query per direct report. For
small teams (~5) this is fine; for a CEO with 50+ ICs it gets
slow. See `scope.md` fragility "N+1 in getTeamSubmissionStatus."

### No "team-wide bulk action"

A CEO can't bulk-assess (e.g. "give all 5 reports a 7 on Team &
Culture"). Each assessment is one-by-one. **Defensible** —
bulk-assess undermines the deliberateness of rating. But worth
considering a "carry forward last cycle's score" affordance.

### `PrimaryActionCard` may surface a focus that takes the leader off `/team`

If the leader has a pending self-rating on their own mandates,
the PrimaryActionCard says "open your Bridge" and links to `/me`.
The leader came to `/team` to assess others but is redirected.
**Acceptable** — the rhythm-engine prioritises self over team.
Worth a UI hint ("you'll come back to /team after").
