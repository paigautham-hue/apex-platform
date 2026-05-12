# me-surface

> Last updated: 2026-04-21

## Purpose

`/me` is the **personal monthly workspace** — fractal across every
tier. For a CEO, it embeds `MyIsland`; for a CXO, it embeds
`MyBridge`; for an IC, it shows a simplified mandate view; for new
users it shows `FirstCycleWelcome`. Composed of: identity strip,
`CycleStatusBanner`, `PrimaryActionCard`, `InsightsInbox`, then
the appropriate workspace shell.

`/today` is the **daily focus surface** — distinct in intent
(daily) but currently overlaps with `/me`. Phase 1 Tier B
disambiguates: `/today` becomes today's briefing, `/me` stays the
monthly workspace. Both maps documented here.

## Scope

- Files in this map: 5
- tRPC calls: read-only against `person`, `governance`, `rhythm`,
  `scope`, `notification` routers.

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Me.tsx` | Fractal `/me` page. Reads `useViewer()` and decides whether to render `MyBridge`, `MyIsland`, or `FirstCycleWelcome` based on tier + cycle + mandates. | `Me` (default) |
| `client/src/pages/MyBridge.tsx` | CXO mandate-cards page. Detailed in `mandate-journals.md`. | `MyBridge` |
| `client/src/pages/MyIsland.tsx` | CEO company-dimension page + reflection form. Detailed in `mandate-journals.md` + `company-reflections.md`. | `MyIsland` |
| `client/src/pages/TodayFeed.tsx` | Daily briefing surface. Currently overlaps with `/me`; Phase 1 Tier B dedupes. | `TodayFeed` (default) |
| `client/src/components/FirstCycleWelcome.tsx` | Empty-state shell for new users (no cycle, no mandates, or admin awaits action). Renders different copy by viewer tier. | `FirstCycleWelcome` |

## Functions

### `client/src/pages/Me.tsx`

- **`Me()`** at `:29` — Top-level page component. Pulls
  `useViewer`, `useAuth`, `governance.getActiveCycle`. Logic:
  - `viewer.tier === 'CEO' && ownedOrgUnitIds.length > 0` →
    render `MyIsland`.
  - Otherwise, if `hasRoleMandates && activeCycle` →
    render `MyBridge`.
  - Else → render `FirstCycleWelcome` with `isAdmin`,
    `hasCycle`, `hasMandates`, `cycleMonth`, `userFirstName`
    props.
  - Header strip: Avatar + name + tier badge + primaryRole.title.
  - Always-rendered scaffolding (above the workspace): `CycleStatusBanner`, `PrimaryActionCard`, `InsightsInbox`.

### `client/src/pages/TodayFeed.tsx`

- **`TodayFeed()`** — Daily briefing card. Renders:
  - "Today's Focus" hero (delegates to `PrimaryActionCard`).
  - Pending notifications (top 3 unread from
    `notification.getMyNotifications`).
  - Recent observations (last 5 from `observation.getRecent`).
  - Quick links to /me, /capture, /people.
  - Has its own profile-fetch + retry logic (Round-2 fix —
    `retry: 1` on `getMyProfile`, explicit error render path).

### `client/src/components/FirstCycleWelcome.tsx`

- **`FirstCycleWelcome({ isAdmin, hasCycle, hasMandates,
  cycleMonth, userFirstName })`** — Renders one of three copy
  variants:
  - **Admin, no cycle:** "Welcome aboard. Open the first cycle to
    start the rhythm" → CTA to `/governance-admin`.
  - **Non-admin, no cycle:** "The fund cycle hasn't started yet.
    Capture an observation while you wait" → CTA to `/capture`.
  - **No mandates configured:** "Your role doesn't have mandates
    yet. Ask an admin to populate them" → CTA to `/people/me`.

## Data Touched

- Read-only against `persons`, `roles`, `governanceCycles`,
  `mandateJournals`, `governanceAssessments`, `notifications`,
  `observations`, `aiInsights`, `dailyFocusLog`.

## External Dependencies

- `react`, `wouter`, `framer-motion` (animations on the identity
  strip), `lucide-react`, `sonner` (toasts), `@radix-ui/*` (Avatar,
  Badge).

## Internal Conventions

1. **`useViewer()` is called once at the top.** Don't sprinkle it
   through children — pass `viewer` down.
2. **`/me` doesn't fetch its own profile** — `useViewer()` already
   resolves it. `TodayFeed` is the only page in this map that calls
   `person.getMyProfile` directly.
3. **`PrimaryActionCard` is the only visible "what should I do?"
   card.** Don't add competing focus cards on `/me` — pile-on
   destroys the "one clear next action" principle.
4. **Cycle-state-dependent rendering goes through `activeCycle`.**
   Don't compute cycle state from individual rows (e.g. "any
   journal with submittedAt").

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `scope.md` | `useViewer()`. |
| `auth-rbac.md` | `useAuth()`. |
| `governance-cycle.md` | `getActiveCycle`. |
| `mandate-journals.md` | Embeds `MyBridge` / `MyIsland`. |
| `company-reflections.md` | Embeds `MyIsland`'s reflection form. |
| `rhythm-engine.md` | Embeds `PrimaryActionCard`. |
| `notifications.md` *(planned)* | `notification.getMyNotifications`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `shell-layout.md` | `DashboardLayout` wraps `/me`, `/today`. |

## Fragility Notes

### `/me` vs `/today` overlap

Both render PrimaryActionCard. A user lands on /today after sign-in
(default redirect from `useAuth`) but the workspace they need is
on /me. Phase 1 Tier B clearly distinguishes the two: /today =
daily briefing, /me = monthly workspace.

### `Me.tsx` decides the workspace inline

The branch logic (CEO → Island; else → Bridge; else → Welcome)
lives inline. If a user's tier changes mid-session (rare —
typically requires sign-out), the rendered workspace doesn't
update. Acceptable today.

### `FirstCycleWelcome` doesn't cover every empty state

There are three empty-state variants but the matrix is wider
(admin with mandates but no cycle vs non-admin with cycle but no
mandates vs etc.). Some combinations fall through to the default
copy. Phase 1 Tier B EmptyState refactor.

### TodayFeed has its own retry config

Per Round-2 fix, `getMyProfile` in `TodayFeed.tsx` has `retry: 1`
and an error render path. `Me.tsx` doesn't have the same — it
relies on `useViewer` and the user-error path that `Me` shows is
just "Could not load your profile" with no retry. **Inconsistency
worth aligning.**
