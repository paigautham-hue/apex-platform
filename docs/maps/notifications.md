# notifications

> Last updated: 2026-04-21

## Purpose

The **notification system** — in-app, opt-in browser push, and
event-driven fan-outs from governance events. Three layers:

1. **`notifications` table** — every notification row.
2. **`governance-notifications.ts`** — event triggers (cycle
   open, reveal, chairman-submitted) that fan out to person sets.
3. **`NotificationCenter` UI** — bell icon dropdown + full list.
4. **Browser push (`PushNotificationSetup`)** — opt-in service
   worker subscription.

Per master plan §5.5 — notification fatigue is a real risk. Hard
cap: `maxNotificationsPerDay` (default 3) + quiet-hours window.

## Scope

- Files: 1 server module + 1 router section + 2 components
- tRPC endpoints: 2 (`notification.getMyNotifications`,
  `markAsRead`) + push subscription via separate flow
- Tables touched: `notifications`, `userPreferences`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/governance-notifications.ts` | ~143 lines. Fire-and-forget event triggers. `notifyCycleOpen`, `notifyCycleReveal`, `notifyChairmanSubmittedForRoleTarget`, etc. Uses `Promise.allSettled` so single failure doesn't block. | `notifyCycleOpen`, `notifyCycleReveal`, `notifyChairmanSubmittedForRoleTarget` |
| `server/routers.ts` (`notificationRouter`) | Lines 507–528. `getMyNotifications` (caller, limit default 50), `markAsRead`. | (mounted) |
| `client/src/components/NotificationCenter.tsx` | ~151 lines. Bell dropdown with unread badge. Polls `getMyNotifications`. | `NotificationCenter` |
| `client/src/components/PushNotificationSetup.tsx` | ~189 lines. Browser-push opt-in. Service worker subscribe + permission prompt. | `PushNotificationSetup` |

## Functions

### `server/governance-notifications.ts`

- **`safeCreateMany`** *(internal)* — `Promise.allSettled` fan-out
  with failure logging.
- **`notifyCycleOpen(tenantId, month)`** — REMINDER to every
  person.
- **`notifyCycleReveal(tenantId, month)`** — INSIGHT to every
  person.
- **`notifyChairmanSubmittedForRoleTarget(tenantId, roleId,
  month)`** — INSIGHT to the role's person.

### `notificationRouter`

- **`getMyNotifications`** — Caller's notifications (limit 50
  default).
- **`markAsRead`** — Flips `readAt`.

## Data Touched

- Writes: `notifications`.
- Reads: `notifications`, `userPreferences` (cap + quiet hours
  honoured at read time, not write).

## External Dependencies

- Browser Push API + service worker.
- `db.createNotification`, `getPersonsByTenant`, `getRoleById`.

## Internal Conventions

1. **Two `type` enum values today:** REMINDER, INSIGHT. Don't
   add new types without coordinating UI + push payload.
2. **Fire-and-forget on triggers.** Caller of the governance
   mutation isn't blocked.
3. **Daily cap enforced on READ, not write.** A user with
   `maxNotificationsPerDay: 3` may have 20 rows in DB but only
   3 surface today.
4. **Quiet hours suppress browser push, not in-app.**

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `createNotification`, `getNotificationsByPerson`. |
| `governance-cycle.md` | Trigger callers. |
| `preferences.md` | Quiet hours + caps. |
| `data-model.md` | `notifications` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `shell-layout.md` | NotificationCenter in topbar. |
| `me-surface.md` | "You have N unread" hint. |
| `rhythm-engine.md` | Reads notifications to surface tier-1 prompts. |

## Fragility Notes

### Daily cap enforced at read time

If a user changes the cap mid-day, prior-suppressed
notifications can re-surface or vanish. **Acceptable** but
counterintuitive.

### `notifyChairmanSubmittedForRoleTarget` doesn't notify peers

Only the subject person sees the notification. Peers / managers
who care about the result aren't told. **Phase 2** broaden when
visibility-rule = `AFTER_ALL_SUBMIT`.

### Push subscription endpoint not in this map

`PushNotificationSetup.tsx` writes to a `pushSubscriptions`
table (or similar) — confirm. **TODO:** if it exists, this map
should reference; if not, browser push is in-memory only.

### `Promise.allSettled` swallows errors

Failures logged via `console.warn` only — no SLO / alert.
**Phase 2** wire to observability.

### No "cycle deadline imminent" notification today

The `governance-notifications` module is wired for cycle-open
and reveal but `sendCycleDeadlineNotifications` (called out in
`governance-cycle.md` fragilities) isn't connected to a
scheduler. **Phase 1 Tier B** wire to cron.

### `actionUrl` is free-text

Stale URLs after route renames produce 404s. Defense: keep
in `shared/const.ts`.

### Notification text is hard-coded English

Tenant override or i18n not supported. Acceptable today.
