# calendar

> Last updated: 2026-04-21

## Purpose

The **Google + Outlook calendar integration** — OAuth-link a
calendar; cache upcoming events locally; surface meeting prep
cards via the rhythm engine on the day of a 1:1.

Ported from Meridian's calendar pattern. Per master plan §6 —
calendar awareness is what makes the rhythm engine feel
psychic ("you have a 1:1 with Vishal in 30 minutes — here's the
prep").

## Scope

- Files: 1 server module + 1 router
- tRPC endpoints: ~5 (`getOAuthUrl`, `handleCallback`,
  `listConnections`, `disconnect`, `listUpcomingEvents`)
- Tables touched: `calendarTokens`, `calendarEvents`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/calendar.ts` | ~236 lines. OAuth URL generation, code-exchange, token refresh, event fetching from Google + Microsoft Graph APIs. Provider-agnostic interface. | `getOAuthUrl`, `exchangeCode`, plus internal fetch helpers |
| `server/routers/calendar.ts` | ~143 lines. tRPC router mounting the OAuth flow + event listing. | `calendarRouter` |

## Functions

### `server/calendar.ts`

- **`getOAuthUrl(provider, state)`** — Builds the consent URL.
  Throws if env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`,
  Outlook equivalents) missing. State is the CSRF token.
- **`exchangeCode(provider, code)`** — Exchanges auth code for
  `{ accessToken, refreshToken, expiresAt, email }`.
- **Internal:** `refreshAccessToken`, `fetchEventsFor`,
  `upsertCachedEvent` (per-user).

### `server/routers/calendar.ts`

- **`getOAuthUrl`** — Returns provider URL with a random state.
- **`handleCallback`** — Receives `{ provider, code, state }`,
  validates state, writes `calendarTokens`.
- **`listConnections`** — Caller's connected calendars.
- **`disconnect`** — Hard-delete token row.
- **`listUpcomingEvents`** — Caller's cached upcoming events.

## Data Touched

- Writes: `calendarTokens` (insert + refresh-update),
  `calendarEvents` (upsert).
- Reads: same.

## External Dependencies

- Google OAuth2 endpoints, Microsoft Graph.
- Env: `GOOGLE_*`, `OUTLOOK_*` client id/secret/redirect URI.

## Internal Conventions

1. **OAuth scopes are read-only** — `calendar.readonly` and
   `Calendars.Read`. APEX never writes back to user calendars.
2. **State parameter is CSRF protection.** Must be re-validated
   on callback.
3. **Tokens stored encrypted at rest** — *(intended; verify
   `calendarTokens` schema has encrypted column or document the
   gap).*
4. **Event cache TTL** — refresh window driven by `expiresAt`
   on token; no explicit cache expiry on events.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `infra.md` | OAuth env. |
| `db-layer.md` | Token + event helpers. |
| `data-model.md` | `calendarTokens`, `calendarEvents` schemas. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `rhythm-engine.md` | Reads upcoming events to surface meeting-prep tier. |
| `meetings.md` | Phase 2 — auto-create `meetings` rows from calendar events. |

## Fragility Notes

### Tokens at rest

Confirm `calendarTokens.accessToken` / `refreshToken` are
encrypted (KMS or app-level). If plaintext, that's a Phase 1
Tier A blocker. **Action:** audit schema column type +
write-path.

### State validation must be store-backed

If the state is just round-tripped client-side, an attacker can
spoof. **Defense:** store states in a short-TTL server-side
table or signed cookie.

### Refresh-token rotation not implemented

Google rotates refresh tokens on some flows. If APEX doesn't
handle rotation, tokens go stale silently. **Phase 1 Tier B**
implement.

### Event cache can drift from source

If the user moves a meeting, the cached row may not reflect it
until next fetch. **Defense:** refresh on read for events ≤ 24h
out.

### Per-user, not per-tenant tokens

Tokens are personal — if a user changes role, their calendar
follows them. Acceptable.

### Disconnect doesn't revoke at provider

`disconnect` deletes our token row but doesn't call Google /
Microsoft revoke endpoints. Phase 1 Tier C add revocation call.

### Multi-account per user not supported

One connection per provider per user. A user with both work
and personal Google can only link one. Phase 2.

### Time-zone handling

Events stored with their start/end timestamps; UI must convert
to viewer locale. Confirm — bug magnet.

### OAuth not yet wired to UI

Confirm there's a Settings page that triggers `getOAuthUrl`.
Today this may be backend-only — i.e. **dead code until UI
ships**. Track in master plan.
