# trust-inbox

> Last updated: 2026-04-21

## Purpose

The **"who saw my data" surface** — a person opens `/trust` and
sees a 30-day log of who viewed their journal entries, profile,
or other owned entities. Core to the master-plan §5.5 trust
contract: every read of your data is visible to you.

Distinct from `access-control.md` (which is grants + step-up
challenges); this map covers the **passive view audit** via
`entryViews`.

## Scope

- Files: 1 page + 1 router
- tRPC endpoints: 3 (`logView`, `whoSawMyEntries`,
  `viewsOfEntity`)
- Tables touched: `entryViews`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers/trust.ts` | ~151 lines. View logger with 60s dedup window. Owner-scoped read endpoints. | `trustRouter` |
| `client/src/pages/TrustInbox.tsx` | ~142 lines. Last 30 days of views — sortable by viewer, entity, date. | `TrustInbox` (default) |

## Functions

### `trustRouter`

- **`logView`** — Mutation. Front-end fires when viewer opens
  an entity owned by another. Self-views skipped. **60s dedup
  window**: same viewer + same entity within 60s collapses to
  one record.
- **`whoSawMyEntries`** — Views on entities owned by caller in
  last N days (default 30, max 90).
- **`viewsOfEntity`** — Views on a specific entity. Owner-only.

## Data Touched

- Writes: `entryViews` (insert).
- Reads: `entryViews` joined with `persons` for viewer name.

## External Dependencies

- `drizzle-orm`.

## Internal Conventions

1. **Front-end-driven logging.** The view logger is called from
   PersonProfile, JournalEntryView, etc. on mount. Skip if owner
   = viewer.
2. **60s dedup.** Same (viewer, entity) within a minute collapses.
3. **30-day default window** for `whoSawMyEntries`. Capped at 90.
4. **`entityType` is a free string** (`"mandateJournal"`,
   `"personProfile"`, etc.). Coordinate with consumer code.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | Direct `entryViews` query via `dbi`. |
| `auth-rbac.md` | `protectedProcedure`. |
| `data-model.md` | `entryViews` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `me-surface.md` | "Recent views" widget. |
| `people-pages.md` | Fires `logView` when viewing another's profile. |
| `mandate-journals.md` | Fires `logView` when opening a journal entry. |
| `access-control.md` | Phase 2 — join with grants for "during grant X, viewer Y read Z." |

## Fragility Notes

### `logView` is client-trusted

The front-end decides when to log. A malicious viewer who
bypasses the client call never appears in the audit. **Defense:**
combine with server-side logging in read endpoints. Phase 2 —
move logging into the read paths themselves.

### `entityType` is stringly-typed

Typo → orphan rows. **Defense:** `shared/const.ts` should export
the canonical types.

### 60s dedup may underreport

Two distinct intentional opens 30s apart count as one. Trade-off
vs. firehose. Acceptable.

### No retention policy

`entryViews` grows unboundedly. At thousands of views per day,
gigabytes in months. **Phase 2** TTL after 90 days (matches the
read window).

### `whoSawMyEntries` doesn't show entity title

Just (viewerName, entityType, entityId). The user has to click
through to learn what was seen. **Phase 1 Tier C** enrich rows
with entity-title resolution.

### Self-views by user-id, not person-id

The skip-self check uses `viewer.id === ownerPersonId` but the
caller is matched via `getPersonByUserIdOrEmail`. Edge cases
where the same human has multiple person rows (unlikely today)
would log self-views. Acceptable for now.

### No "viewer denied" log

Failed access attempts aren't recorded — only successful views.
A would-be attacker probing is invisible. **Phase 2** add
`accessAttempts` table or merge into auditLogs.
