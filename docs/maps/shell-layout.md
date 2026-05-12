# shell-layout

> Last updated: 2026-04-21

## Purpose

The **app shell** — `App.tsx` wires the router and global
providers; `DashboardLayout` provides the sidebar + topbar
chrome around every authenticated page; plus the floating
action button, mobile bottom nav, command palette, error
boundary, and notification center.

This is the "everything outside the page content" map.

## Scope

- Files: 1 entry + 1 layout + 6 chrome components
- tRPC endpoints: 0 directly (sub-components call their own)
- Tables touched: 0

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/App.tsx` | ~259 lines. Wouter `Switch`/`Route` table for every page. Wraps in `ThemeProvider`, `TooltipProvider`, `ErrorBoundary`, mounts `Toaster`, `CommandPalette`, `FloatingActionButton`, `MobileBottomNav`. | `App` (default), `Router` |
| `client/src/components/DashboardLayout.tsx` | ~467 lines. Sidebar nav + topbar. Hosts `NotificationCenter` (bell), profile menu, theme toggle. Redirects to `/onboarding` if `preferences.onboardingCompleted = false`. | `DashboardLayout` (default) |
| `client/src/components/CommandPalette.tsx` | ~218 lines. Cmd+K palette — quick nav + actions + search-mocked. | `CommandPalette` |
| `client/src/components/FloatingActionButton.tsx` | ~159 lines. Bottom-right plus button → /capture. Voice + camera + quick-note shortcuts on tap. | `FloatingActionButton` |
| `client/src/components/MobileBottomNav.tsx` | ~128 lines. iOS-style 5-tab bottom nav (Me / Capture / Ask / Trust / People). Only visible <md breakpoint. | `MobileBottomNav` |
| `client/src/components/ErrorBoundary.tsx` | ~62 lines. React error boundary with fallback UI. | `ErrorBoundary` |
| `client/src/components/NotificationCenter.tsx` | Bell dropdown. See `notifications.md`. | `NotificationCenter` |

## Functions

### `App.tsx`

- **`Router`** — Wouter routing table. Onboarding route is
  bare (no layout); all others are wrapped in `DashboardLayout`.
- Provider order: ThemeProvider → TooltipProvider → ErrorBoundary
  → Router → globals.

### `DashboardLayout.tsx`

- **Onboarding redirect** — `preferences.checkOnboarding`
  on mount; redirects if incomplete and not already on
  `/onboarding`.
- **Sidebar nav** — role-aware items (Chairman sees
  `/chairman`; everyone sees `/me`, `/ask`, etc.).
- **Topbar** — Logo, breadcrumb, notification bell, theme,
  profile menu.

## Data Touched

- Reads (via sub-components):
  - `preferences.checkOnboarding`
  - `useViewer()` for role-aware nav
  - `notification.getMyNotifications`

## External Dependencies

- `wouter` router.
- `sonner` toaster.

## Internal Conventions

1. **`/` is public landing.** No layout, no auth gate. Everything
   under DashboardLayout is auth-gated by `ProtectedRoute`-equivalent
   (today the auth check is in `useViewer` + per-page redirects).
2. **Theme is dark/light toggle.** No system-pref auto today.
3. **CommandPalette listens for Cmd+K globally.** Single-instance.
4. **MobileBottomNav uses iOS-style** — fixed bottom, safe-area
   inset.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| Every page module | App routes them. |
| `preferences.md` | Onboarding redirect. |
| `notifications.md` | NotificationCenter. |
| `auth-rbac.md` | useViewer for nav gating. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| Every authenticated page | Rendered inside DashboardLayout. |

## Fragility Notes

### Auth gating is per-page, not centralized

`App.tsx` doesn't enforce auth — each page does its own
`useViewer` check. A new page added without the check is
publicly accessible. **Phase 1 Tier A** introduce a
`ProtectedRoute` wrapper used by App.tsx.

### Route table is monolithic

All ~40 routes are inline in `App.tsx`. Code-split per route
would shrink initial bundle. **Phase 2** `React.lazy` + Suspense.

### `DashboardLayout` re-fetches preferences every mount

On every route change inside the layout, the layout remounts and
re-checks preferences. Wasteful. **Defense:** lift to a context.

### CommandPalette mock results

The "search" inside CommandPalette is stubbed — doesn't query
real data. **Phase 2** wire to `/ask` or a dedicated search endpoint.

### ErrorBoundary doesn't report

Errors render fallback locally but aren't sent anywhere. **Phase
2** wire to Sentry / observability.

### FAB obscures content on narrow screens

Bottom-right floating button can overlap "save" affordances on
forms. **Phase 1 Tier C** add safe-zone padding to form pages.

### MobileBottomNav tabs are hard-coded

If we rename `/trust` → `/inbox`, the nav silently breaks.
**Defense:** `shared/const.ts` should export route constants.
