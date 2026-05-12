# access-control

> Last updated: 2026-04-21

## Purpose

The **access grants + challenges system** — explicit, time-bound,
auditable extension of viewing rights beyond the cascade.
Examples: an external board member granted VIEW_ONLY access to
one portfolio company for 30 days; a Chairman challenge protocol
("step-up auth") before viewing a sensitive subtree.

Per master plan §5.7 — access is granted-then-audited, never
silently expanded.

## Scope

- Files: 2 pages + 1 router
- tRPC endpoints: 8+ (`listGrants`, `myGrants`, `createGrant`,
  `revokeGrant`, `listMyChallenges`, `listTenantChallenges`,
  `submitChallenge`, ...)
- Tables touched: `accessGrants`, `accessChallenges`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/routers/accessControl.ts` | ~148 lines. Grant CRUD + challenge CRUD. Granter can revoke own grants; admin can revoke any. | `accessControlRouter` |
| `client/src/pages/AccessGrants.tsx` | ~278 lines. List + create + revoke grants. | `AccessGrants` (default) |
| `client/src/pages/AccessChallenge.tsx` | ~225 lines. Step-up auth challenge UI — caller proves intent before crossing a sensitive boundary. | `AccessChallenge` (default) |

## Functions

### `accessControlRouter`

- **`listGrants`** — Tenant-wide grants. Caller must be tenant
  member or admin.
- **`myGrants`** — Grants where caller is grantee.
- **`createGrant`** — `{ tenantId, grantedToEmail,
  targetOrgUnitId, accessLevel (VIEW_ONLY / VIEW_AND_COMMENT /
  FULL_ACCESS), justification?, expiresAt }`. Stamps
  `grantedByUserId = caller`, `status: ACTIVE`.
- **`revokeGrant`** — Only granter or admin.
- **`listMyChallenges`** — Pending challenges for caller.
- **`listTenantChallenges`** — Admin-only audit log.
- **`submitChallenge`** — Caller responds to a step-up
  challenge.

## Data Touched

- Writes: `accessGrants`, `accessChallenges`.
- Reads: same.

## External Dependencies

- `db-layer.md` access-grant helpers.

## Internal Conventions

1. **Three access levels:** VIEW_ONLY / VIEW_AND_COMMENT /
   FULL_ACCESS. Today only VIEW_ONLY is enforced (others map to
   the same read paths).
2. **Grants are tenant-scoped + subtree-targeted.** A grant is
   to ONE `orgUnitId`; cascades downward to its subtree.
3. **Expiry is mandatory.** No infinite grants.
4. **Challenge ≠ grant.** Challenges are friction checkpoints;
   grants are persistent permissions.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | Access-grant + challenge helpers. |
| `auth-rbac.md` | `protectedProcedure`, role-based gates. |
| `scope.md` | Future: scope resolver will read grants. |
| `data-model.md` | `accessGrants`, `accessChallenges` schemas. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `trust-inbox.md` | Surfaces own active grants. |
| `admin.md` | Lists tenant-wide grants. |

## Fragility Notes

### Grants are not yet read by `scope.md`

Today `resolveViewerScope` derives authority purely from role
tree. Active `accessGrants` rows exist but aren't OR-ed into
scope. **Phase 1 Tier A blocker** — wire grants into scope
resolution.

### `createGrant` doesn't verify granter has authority

A CXO can grant access to a subtree they don't own. Today this
silently inserts a row; if scope ever reads grants, this becomes
a privilege-escalation hole. **Phase 1 Tier A** add granter
authority check.

### `accessLevel` distinctions unenforced

VIEW_AND_COMMENT / FULL_ACCESS map to the same code paths as
VIEW_ONLY. **Phase 2** introduce comment + write affordances.

### No grant audit trail beyond row history

Revoking deletes status not the row, but who-saw-what during the
grant lifetime is `entryViews` (see `trust-inbox.md`). The two
should join to "during grant X, viewer saw Y entities." **Phase
2** wire.

### Email-based grantee identity

`grantedToEmail` is the join key. An email typo creates a grant
nobody can use. No email-existence validation. **Phase 1 Tier C**
validate against `users` / `persons` first.

### Expired grants are not auto-revoked

`expiresAt < now` doesn't change `status`. UI must filter.
**Phase 2** scheduler / on-read filter.
