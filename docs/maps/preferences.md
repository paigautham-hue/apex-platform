# preferences

> Last updated: 2026-04-21

## Purpose

The **per-user preferences** — notification toggles, quiet hours,
daily caps, browser-push opt-in, onboarding completion flag.
Persists at user level (not person — same human's preferences
follow them across tenants).

## Scope

- Files: 1 router + 1 page
- tRPC endpoints: 4 (`preferences.get`, `save`,
  `completeOnboarding`, `checkOnboarding`, `resetOnboarding`)
- Tables touched: `userPreferences`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers/preferences.ts` | ~64 lines. Defaults baked in when no row exists. Zod-validated time strings (`HH:MM`). | `preferencesRouter` |
| `client/src/pages/NotificationPreferences.tsx` | ~349 lines. Toggles + time pickers + push-opt-in. | `NotificationPreferences` (default) |

## Functions

### `preferencesRouter`

- **`get`** — Returns row or hard-coded defaults: notifyPriorityZero
  / notifyInsights / notifyReminders / notifyMilestones /
  notifyPulseCheck / notifyAchievementSuggestions all true,
  notifyBrowserPush false, quietHours 22:00–08:00,
  maxNotificationsPerDay 3, onboardingCompleted false.
- **`save`** — `upsertUserPreferences`. All fields optional.
- **`completeOnboarding`** — Idempotent flag set.
- **`checkOnboarding`** — Boolean read.
- **`resetOnboarding`** — Wipes the completed flag (used by
  admin for re-tour, dev for testing).

## Data Touched

- Writes: `userPreferences`.
- Reads: same.

## External Dependencies

- Zod regex on time strings.

## Internal Conventions

1. **User-level, not person-level.** Same human's quiet hours
   follow across tenants.
2. **Defaults baked into router**, not the DB. Migrating defaults
   requires code change, not schema change. Trade-off.
3. **Time strings are `HH:MM` 24h.** Frontend must format.
4. **Caller is always the subject.** No "set preferences for
   another user" endpoint.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `getUserPreferences`, `upsertUserPreferences`, `markOnboardingComplete`. |
| `auth-rbac.md` | `protectedProcedure`. |
| `data-model.md` | `userPreferences` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `notifications.md` | Reads cap + quiet hours. |
| `onboarding.md` | Reads `onboardingCompleted` for redirect logic. |

## Fragility Notes

### Defaults drift between router and DB schema

`getUserPreferences` may return a row with fewer columns than
the router defaults. Frontend handles both shapes today; risk on
schema additions. **Defense:** keep defaults in `shared/const.ts`
imported by both router and migration.

### `quietHoursStart/End` allows wraparound but no validation

`22:00–08:00` is wraparound — handled by consumers via
`start > end ? cross-midnight : same-day`. No test for
edge cases (e.g. equal start/end). **Phase 1 Tier C** validate.

### `maxNotificationsPerDay` 1-50 range

Upper bound 50 is arbitrary. Defenders should consider whether
this matches the actual budgeted-notification design.

### No timezone column

Quiet hours assumed user-local but timezone isn't stored.
Browser-push timing uses server time → wrong for non-UTC users.
**Phase 1 Tier B** add `timezone` column.

### `resetOnboarding` has no auth gate beyond `protectedProcedure`

A user can repeatedly reset their own onboarding — annoying for
themselves, not a security issue. Acceptable.

### `onboardingCompletedAt` only set via reset → null

The forward path (`markOnboardingComplete`) stamps the timestamp
but `resetOnboarding` only resets the bool + timestamp explicitly.
Symmetric. Fine.
