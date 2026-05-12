# tenant-context

> Last updated: 2026-04-21

## Purpose

The single function that answers "which tenant is this request for?"
Today APEX is single-tenant (MEF, id 1). The whole point of this file
is to **localise** that decision so that when we go multi-tenant (per
master plan §8 #6, Phase 5+), we change one function and remove the
~9 hardcoded `TENANT_ID = 1` constants from the routers.

## Scope

- Files in this map: 1
- Lines: 27
- Exports: 2 (`tenantIdForRequest`, `SINGLETON_TENANT_ID_EXPORT`)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/tenant-context.ts` | Single-tenant resolver with a documented migration plan for multi-tenancy. | `tenantIdForRequest`, `SINGLETON_TENANT_ID_EXPORT` |

## Functions

### `server/tenant-context.ts`

- **`tenantIdForRequest(ctx: { user: User | null })`** at `:21` —
  Returns the tenant id for the calling user.
  - Signature: `tenantIdForRequest(ctx): Promise<number>`
  - Today: always returns `SINGLETON_TENANT_ID = 1`. Ignores `ctx`.
  - Callers: very few today. Most routers hardcode `const TENANT_ID
    = 1` inline. **Phase 5+ migration replaces those with this
    function.**
  - Side effects: none (pure today; will become async DB read when
    multi-tenant).

- **`SINGLETON_TENANT_ID_EXPORT`** at `:26` — Exports the constant
  `1` for callers that need the literal (e.g. seed script).

## Data Touched

- `tenants` — not read today. When multi-tenant: this function will
  resolve `user → tenant` via `persons.userId` join.

## External Dependencies

None today. When multi-tenant: may need `drizzle-orm`,
`@trpc/server`, etc.

## Internal Conventions

1. **Routers should call `tenantIdForRequest(ctx)` — not hardcode
   `TENANT_ID = 1`.** The hardcoded constants are the known
   tech-debt #1 in master plan §2. They were added because the
   function was authored when the rest of the codebase had already
   shipped with the constant; the migration is a Phase 5+ effort.

2. **Don't put business logic in this file.** It's a resolver. If
   you need RBAC, scope, or anything else, do it elsewhere and
   pass the resolved `tenantId` in.

3. **Migration plan** (from the file's own docstring):
   1. Update `tenantIdForRequest()` to read from a JWT claim,
      subdomain, or explicit `persons.userId → persons.tenantId`
      join.
   2. Remove the `SINGLETON_TENANT_ID` fallback — throw instead.
   3. Search-and-replace `const TENANT_ID = 1;` in every router and
      every client page with `const tenantId = await
      tenantIdForRequest(ctx);` (server) or
      `useViewer().tenantId` (client).
   4. Run `pnpm check` to verify no stragglers.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `User` type from `drizzle/schema`. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| **Every router subsystem** *(eventually)* | `tenantIdForRequest(ctx)`. Today only a handful of routers actually call it — most still hardcode `TENANT_ID = 1`. |
| `seed-and-migrations.md` *(planned)* | `SINGLETON_TENANT_ID_EXPORT` for the seed script's tenant scoping. |

## Fragility Notes

### Single-tenant constant is duplicated across the codebase

The `TENANT_ID = 1` constant appears in:

- `server/tenant-context.ts:19` (canonical, this map)
- `client/src/pages/*.tsx` — ~9 files (the master-plan-§2 tech debt)
- `server/routers/scope.ts:15` (`const TENANT_ID = 1`)
- Possibly other server files (audit with `grep -rn "TENANT_ID = 1"`)

These should all converge on `tenantIdForRequest(ctx)` on the
server, and `useViewer().tenantId` (planned addition to
`useViewer`) on the client. **Don't add new hardcoded constants.**

### `tenantIdForRequest` is async but does no I/O today

The signature returns `Promise<number>` even though the
implementation is sync. This is **intentional** — callers must
already await the result, which means the multi-tenant migration
(which will add DB reads) won't change call sites' shape. Don't
"optimise" by making it sync; that locks in a breaking change for
Phase 5+.

### No tests today

The function is trivial enough that a unit test seems silly, but
when the multi-tenant migration happens, the test surface here will
grow (resolution from JWT claims, subdomain parsing, fallback
behaviors, error cases). **Add tests when adding logic.**

### `ctx.user` is the user-scope id, not the person-scope id

Per `auth-rbac.md`'s fragility notes: `ctx.user.id` is `users.id`,
not `persons.id`. When the multi-tenant resolution becomes "look up
the user's tenant via `persons.userId`," remember that a single
`users` row could correspond to **multiple** `persons` rows (one
per tenant they belong to). The future implementation needs to
either:
- Pick one via a default-tenant column on `users`, or
- Pass an explicit `targetTenantId` from the client (e.g.
  subdomain), or
- Surface a tenant-picker on sign-in for multi-tenant users.

Document the choice in the function's JSDoc when made.
