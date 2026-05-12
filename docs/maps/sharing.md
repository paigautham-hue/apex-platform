# sharing

> Last updated: 2026-04-21

## Purpose

The **no-account share-link system** — a fund-wide leader
generates a token-protected share link (optional password) for a
**board pack**, **company report**, or **role report**. A
recipient opens the link in any browser and sees a JSON
snapshot — no APEX login required.

Per master plan §5.7 — external board members shouldn't need
accounts to read what's already authorised for them.

## Scope

- Files: 1 router
- tRPC endpoints: ~4 (`create`, `revoke`, `listMine`, plus
  `publicProcedure` resolution endpoints)
- Tables touched: `shareLinks` + read sources (assessments,
  journals, insights, cycles, orgUnits)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers/share.ts` | ~279 lines. Resource-scoped auth on `create` (board pack = fund-wide; company = canViewOrgUnit; role = canViewPerson on role.personId). Token + optional bcrypt password. Resolution endpoint is `publicProcedure`. | `shareRouter` |

## Functions

### `shareRouter`

- **`create`** — Auth-gated by resource type. Generates token via
  `crypto.randomBytes`. Optional password hashed. Stores
  `expiresInHours` (default 168, max 720 = 30 days).
- **`resolve(token, password?)`** — `publicProcedure`. Validates
  token + expiry + password. Builds a snapshot:
  - BOARD_PACK → variance alerts + benchmark table + recent
    insights
  - COMPANY_REPORT → company assessments + journals + insights
  - ROLE_REPORT → person assessments + journals
- **`revoke`** — Granter or admin only.
- **`listMine`** — Caller's created links.

## Data Touched

- Writes: `shareLinks`.
- Reads: `shareLinks`, `orgUnits`, `governanceAssessments`,
  `mandateJournals`, `aiInsights`, `governanceCycles` + uses
  `computeVarianceAlerts`, `buildBenchmarkTable` from
  `financial-analytics.ts`.

## External Dependencies

- `node:crypto` for token generation + password hashing.
- `financial-analytics.md` for board-pack content.

## Internal Conventions

1. **Tokens are opaque random strings.** Never derived from
   resourceId.
2. **Default expiry: 7 days.** Max: 30 days. UI should warn at
   creation that links expire.
3. **Resource-specific authorization at create time.** Resolution
   endpoint trusts the token.
4. **JSON snapshot, not live data.** Resolution returns the
   state at request time — no live binding.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `scope.md` | `canViewOrgUnit`, `canViewPerson`, `isFundWide`. |
| `financial-analytics.md` | Board-pack content. |
| `data-model.md` | `shareLinks` schema. |
| `db-layer.md` | Person + role helpers. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | "Share board pack" button. |
| `people-pages.md` | "Share role report" button. |

## Fragility Notes

### Snapshot leaks future-relevant data

If a board pack is shared, the data at resolve time includes
WHATEVER is in the DB right then. If the link is opened next
month after new sensitive insights were added, those leak too —
the granter intended a Q1 snapshot but the recipient sees
real-time. **Phase 1 Tier B** — freeze snapshot to JSON on
create.

### Password is hashed but no rate-limit on resolve

Attacker can grind passwords. **Phase 2** add IP-keyed rate
limit on the public resolution endpoint.

### Token in URL leaks via referer

Standard URL-token risk. **Defense:** add `Referrer-Policy:
no-referrer` to share-link resolution responses; advise
recipients not to forward links.

### `publicProcedure` is unauthenticated

Anyone with the token reads. Trade-off for no-account share. Just
documented.

### No view audit on share-link reads

Unlike `trust-inbox.md` `entryViews`, share-link opens aren't
logged to the owner's "who saw my data." **Phase 1 Tier B** —
log to a separate `shareLinkViews` table at minimum.

### Expiry isn't validated at resolve... wait, it is

The router checks `expiresAt > now` during resolve. Good.
Revocation is `status: REVOKED` and also checked. Good.

### Board-pack-vs-company-vs-role JSON shapes differ

The resolution endpoint returns three different shapes. Consumer
must switch on resourceType. **Phase 2** unify via a discriminated
union DTO.
