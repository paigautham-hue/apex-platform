# onboarding

> Last updated: 2026-04-21

## Purpose

The **first-time user experience** — a step-through tour that
explains APEX's core concepts (mandates, cycles, captain's log,
chairman dashboard) and ends with the first cycle welcome.
Redirects new users to `/onboarding` from `DashboardLayout`
until `preferences.onboardingCompleted = true`.

## Scope

- Files: 1 page + 1 component
- tRPC endpoints called: `preferences.checkOnboarding`,
  `preferences.completeOnboarding`
- Tables touched: `userPreferences` (via preferences router)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Onboarding.tsx` | ~418 lines. Multi-step tour: welcome → governance cycle explainer → captain's log → role tour → first-cycle preview → complete. | `Onboarding` (default) |
| `client/src/components/FirstCycleWelcome.tsx` | ~200 lines. Modal shown on first /me view AFTER onboarding — surfaces the active cycle and primary action. | `FirstCycleWelcome` |

## Functions

### Page-level (Onboarding.tsx)

- **Step state machine** — Local React state, no persistence.
  Refresh restarts from step 1 (mild fragility — see notes).
- **`completeOnboarding` mutation** — On final step, marks
  preferences and navigates to `/me`.

### `DashboardLayout` (`client/src/components/DashboardLayout.tsx`)

- **Redirect logic** — On mount, calls
  `preferences.checkOnboarding`. If `false` and current route ≠
  `/onboarding`, redirects.

## Data Touched

- Reads: `userPreferences.onboardingCompleted` via router.
- Writes: same flag via `completeOnboarding`.

## External Dependencies

- `preferences.md` for state.
- `wouter` for routing.

## Internal Conventions

1. **Single completion flag.** No per-step progress persistence.
2. **Redirect is one-way.** Once completed, returning to
   `/onboarding` is allowed but the redirect won't force-route.
3. **`FirstCycleWelcome` is a separate concern** — fires once
   after onboarding via local-storage flag (not `userPreferences`
   today).

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `preferences.md` | `checkOnboarding`, `completeOnboarding`. |
| `shell-layout.md` | DashboardLayout redirect. |
| `me-surface.md` | FirstCycleWelcome rendered there. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| (none — leaf) | |

## Fragility Notes

### Refresh mid-onboarding restarts from step 1

No step persistence. Users who refresh halfway lose progress.
**Phase 1 Tier C** persist `onboardingStep` in
`userPreferences` or local-storage.

### Redirect race: cycle data not yet loaded

On first paint, `checkOnboarding` may not have resolved.
DashboardLayout renders content briefly before redirecting.
**Defense:** loading spinner during pref-check. Confirm.

### `FirstCycleWelcome` flag in local storage = device-bound

User completes onboarding on desktop, opens mobile, sees the
welcome again. **Phase 2** move flag to server-side preference.

### Content is hard-coded English

Tour copy lives in JSX. Tenant override / i18n not supported.

### No analytics on step abandonment

A user who drops out at step 3 isn't tracked. **Phase 2** event
emit per step into auditLogs.

### "Skip onboarding" path

UI may or may not expose this; if skipped, the user enters with
defaults. **Defense:** make sure `completeOnboarding` is called
even on skip.

### Onboarding doesn't seed any data

Pure UX. If a new tenant has no cycles seeded, the first-cycle
welcome shows an empty state and the user is stuck. **Phase 1
Tier B** — bootstrap a placeholder cycle in
`seed-and-migrations.md` flow.
