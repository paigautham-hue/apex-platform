# auth-rbac

> Last updated: 2026-04-21

## Purpose

Documents APEX's authentication chain (auth provider → server-side
session → tRPC context → React `useAuth` hook) and the RBAC
primitives that gate every meaningful write. The cascade design
(master plan §5.3) is enforced through a small set of named helper
functions; this map names them, points to their callsites, and lists
their fragility.

## Scope

- Files in this map: 8
- RBAC primitives: 3 (`isChairmanOrAdmin`, `canEditCompanyFinancials`,
  `canAssessTarget` *planned*)
- tRPC procedure builders: 3 (`publicProcedure`, `protectedProcedure`,
  `adminProcedure`)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/_core/trpc.ts` | tRPC server bootstrap. Defines the 3 procedure builders and the `requireUser` middleware. | `router`, `publicProcedure`, `protectedProcedure`, `adminProcedure` |
| `server/_core/context.ts` | Builds the per-request `TrpcContext` (`req`, `res`, `user`). Calls `sdk.authenticateRequest(req)` to populate `user`. Catches auth errors silently so public procedures keep working. | `TrpcContext`, `createContext` |
| `server/_core/cookies.ts` | Session cookie config (`getSessionCookieOptions`). | `getSessionCookieOptions` |
| `server/_core/sdk.ts` | Wrapper around the auth provider SDK. Provides `sdk.authenticateRequest`. | `sdk` |
| `server/_core/oauth.ts` | OAuth callback handler. | OAuth route handlers |
| `client/src/_core/hooks/useAuth.ts` | React hook for the authenticated user. Wraps `trpc.auth.me.useQuery` + `trpc.auth.logout.useMutation`. Caches user info to localStorage for SSR-y behaviors. | `useAuth` |
| `server/db.ts` (RBAC primitives — see `db-layer.md`) | `isChairmanOrAdmin`, `canEditCompanyFinancials`. Live here because they're DB-bound. | (already documented in `db-layer.md`) |
| `shared/const.ts` | Auth error strings (`NOT_ADMIN_ERR_MSG`, `UNAUTHED_ERR_MSG`) + cookie name (`COOKIE_NAME`). | `NOT_ADMIN_ERR_MSG`, `UNAUTHED_ERR_MSG`, `COOKIE_NAME` |

## Functions

### `server/_core/trpc.ts`

- **`router`** at `:10` — `t.router` re-export. Used to compose every
  router.
- **`publicProcedure`** at `:11` — Unauthenticated baseline. Used for
  `auth.me` (returns `ctx.user` which may be null) and `auth.logout`.
- **`requireUser`** at `:13` — Middleware that throws
  `TRPCError("UNAUTHORIZED")` if `ctx.user` is null; else passes
  through with a narrowed-non-null `user` on the context.
  - Callers: composes into `protectedProcedure`.
- **`protectedProcedure`** at `:28` — `t.procedure.use(requireUser)`.
  **The default procedure** for every read/write endpoint in APEX.
  Search any router and you'll see it on >95% of procedures.
- **`adminProcedure`** at `:30` — Stricter: requires
  `ctx.user.role === 'admin'`, throws `TRPCError("FORBIDDEN")`
  otherwise. **Lightly used today** — most chairman-gated routes
  use `protectedProcedure` + an inline `isChairmanOrAdmin(...)`
  check because they want to permit Chairman-role users (not just
  the `users.role='admin'` superuser).

### `server/_core/context.ts`

- **`createContext(opts)`** at `:11` — Builds the per-request tRPC
  context. Resolves `ctx.user` via `sdk.authenticateRequest(req)`.
  Swallows auth errors so anonymous requests still get a valid
  context (just with `user: null`).
  - Side effects: auth-provider SDK call.

### `client/src/_core/hooks/useAuth.ts`

- **`useAuth(options?)`** — The single hook every page uses for "am I
  signed in?" Wraps `trpc.auth.me.useQuery`. Side effects:
  - On every render where `meQuery.data` resolves, writes the user
    object to `localStorage["manus-runtime-user-info"]`. This is a
    Manus-runtime contract.
  - `redirectOnUnauthenticated: true` triggers a redirect to
    `getLoginUrl()` when `user` resolves to null.
  - Exposes `logout` — calls `trpc.auth.logout.useMutation` and
    invalidates the `auth.me` query.

### RBAC primitives (live in `server/db.ts`)

See `db-layer.md` for full details. Listed here so this map is the
single discoverable index for "where are the RBAC chokepoints?":

- **`isChairmanOrAdmin(userId, tenantId): Promise<boolean>`** —
  `db.ts:293`. True if `users.role = 'admin'` OR
  `roles.roleType in ('CHAIRMAN', 'GROUP_CEO')` on the user's
  current role. Used by every Chairman-gated mutation.
- **`canEditCompanyFinancials(userId, tenantId, orgUnitId):
  Promise<boolean>`** — `db.ts:1235`. True if `isChairmanOrAdmin`,
  OR the user's current role is `CEO` with matching `orgUnitId`.
  Used by `writeQuarterlyActual`, `upsertReflection`.
- **`canAssessTarget(assessorPersonId, targetType, targetId):
  Promise<boolean>`** — **PLANNED** for Phase 1 Tier A. Will become
  the single chokepoint for assessment writes, enforcing the
  cascade rule (master plan §5.3).

### Auth procedures (in `server/routers.ts`)

- **`appRouter.auth.me`** — `protectedProcedure`-style but uses
  `publicProcedure` to return null for unauthenticated requests
  (the client treats null as "not signed in"). Returns `ctx.user`.
- **`appRouter.auth.logout`** — `publicProcedure` that clears the
  session cookie (`ctx.res.clearCookie(COOKIE_NAME, ...)`).

## Data Touched

- `users` (read in `isChairmanOrAdmin`; written by `upsertUser` on
  sign-in)
- `persons` (read in `isChairmanOrAdmin` and `canEditCompanyFinancials`
  to resolve `userId → personId → currentRoleId`)
- `roles` (read in `isChairmanOrAdmin` and `canEditCompanyFinancials`
  to check `roleType` and `orgUnitId`)

## External Dependencies

- `@trpc/server` — `initTRPC`, `TRPCError`.
- `superjson` — transport serialiser (for Date / Map / Set in tRPC
  payloads).
- `jose` — JWT verification (used by the auth-provider SDK, not
  directly here).
- The auth-provider SDK (Manus runtime) — `sdk.authenticateRequest`.

## Internal Conventions

1. **`protectedProcedure` is the default.** Use it unless there's a
   reason not to. `publicProcedure` is rare (just `auth.me` and
   `auth.logout`). `adminProcedure` is for the few user-management
   endpoints — most "admin work" is gated by `isChairmanOrAdmin`,
   not `adminProcedure`, because the Chairman is not necessarily
   `users.role='admin'`.

2. **RBAC checks happen inside the mutation, not in the procedure
   middleware.** Reason: most RBAC rules depend on the inputs
   (`canEditCompanyFinancials` needs an `orgUnitId`,
   `canAssessTarget` needs a target). Doing them in middleware
   would require parsing input twice.

3. **Throw `TRPCError({ code: 'FORBIDDEN' })` on RBAC failure.**
   Always include a human-readable message. The client surfaces it
   in a toast.

4. **Resolve `ctx.user.id → person` via `getPersonByUserId(userId,
   tenantId)`.** Don't use `ctx.user.id` directly as an APEX-level
   identity — it's the *user* id (auth-provider scope), not the
   *person* id (tenant scope).

5. **Every RBAC primitive filters by `tenantId`.** Same as `db.ts`
   convention.

6. **Audit-log RBAC denies** (per master plan §3.9, Phase 2). Today
   only the throw goes out; in Phase 2, denials get
   `db.createAuditLog({ action: 'RBAC_DENY', ... })` too.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `users`, `persons`, `roles` table types. |
| `db-layer.md` | `getPersonByUserId` (used by callers to resolve user→person before applying RBAC). |
| `infra.md` | The tRPC bootstrap and Express middleware wiring. |
| `shared-types.md` | `NOT_ADMIN_ERR_MSG`, `UNAUTHED_ERR_MSG`, `COOKIE_NAME`. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| Every router subsystem | `protectedProcedure` (the default), plus the RBAC primitives inline. |
| `me-surface.md`, `team-surface.md`, `group-surface.md`, `chairman-surface.md` | `useAuth` for "am I signed in?" + redirect. |
| `tenant-context.md` | Resolves the caller's tenant after `ctx.user` is established. |
| `scope.md` | Uses `getPersonByUserId` + RBAC to build the viewer model. |

## Fragility Notes

### `ctx.user.id` is NOT the APEX person id

`ctx.user.id` is the `users.id` (auth-provider scope). The APEX
identity is `persons.id` — resolved via `getPersonByUserId(ctx.user.id,
tenantId)`. **Common bug class:** writing `assessorPersonId:
ctx.user.id` directly (it's a `users.id`, not a `persons.id`) saves a
wrong number that points to whoever's `persons.id` happens to match
the same int. The seed-script user/person ids are conveniently
aligned for the Chairman row, which has masked this bug in dev.

**Defense:** every router that needs the person id does
```ts
const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
if (!person) throw new TRPCError({ code: 'NOT_FOUND', ... });
```
and then uses `person.id`. Grep `getPersonByUserId` to verify every
new mutation does this.

### `adminProcedure` and `isChairmanOrAdmin` are not the same

- `adminProcedure` middleware checks `users.role === 'admin'`. This
  is the **superuser flag**, granted manually.
- `isChairmanOrAdmin` checks **either** `users.role === 'admin'` **or**
  the person's `currentRoleId` is `CHAIRMAN`/`GROUP_CEO`.

For Chairman-gated mutations (cycle open/close/reveal, guidance
writes, assignment generation), **use `isChairmanOrAdmin`** —
otherwise the actual Chairman can't perform them unless they
separately got the admin flag. The codebase consistently uses
`isChairmanOrAdmin` for these flows.

### `useAuth`'s localStorage write happens on every render

`localStorage.setItem("manus-runtime-user-info", JSON.stringify(...))`
fires every render where `meQuery.data` is resolved. Cheap, but
synchronous. If the user object grows large (it currently is small —
just id/name/email/role), this becomes a measurable cost. Reconsider
if we ever embed structured data in the user row.

### `requireUser` does NOT validate session freshness

The middleware only checks that `ctx.user` is non-null. It doesn't
re-verify the session token's expiry beyond what `sdk.authenticateRequest`
already does. If a session is invalidated mid-request, the request
proceeds. **Real impact: low** — sessions are server-issued JWTs
with their own expiry. **Tighten if** we add a "force log everyone
out" admin action.

### Catch-and-swallow in `createContext`

`createContext` silently catches auth errors so public procedures
work for anonymous users. The downside: a transient auth-provider
outage produces "you're not signed in" UX even for authenticated
users. The localStorage cache in `useAuth` masks this for short
outages. **Worth instrumenting** in Phase 2's observability work —
log the swallowed errors so we know when they happen.

### `useAuth` redirects to `getLoginUrl()` — not customisable per page

If a page wants to redirect somewhere other than the login URL when
the user isn't signed in, it has to handle that itself. Today no
page does this. **If we add public-facing pages** (e.g. a
share-link viewer for an external board member), they'll need a
different unauth-flow.

### Auth procedure `auth.me` retries are disabled

In `useAuth`, `meQuery` has `retry: false, refetchOnWindowFocus:
false`. A transient backend hiccup will surface as "you're not
signed in" without a retry. The localStorage cache (written on every
successful render) is the user-visible fallback. **If localStorage
is cleared** (incognito session, manual clear), a transient outage
shows the login screen. Acceptable today.

### No "switch tenant" support

The auth chain assumes one tenant per user (today). A user with
person rows in multiple tenants would only ever see the "first" one
that comes back from `getPersonByUserId(userId, 1)`. **Phase 5+
multi-tenant work** will need a tenant-picker on sign-in or a
"switch tenant" affordance.
