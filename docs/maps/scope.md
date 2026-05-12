# scope

> Last updated: 2026-04-21

## Purpose

The **scope module** is the fractal keystone. Every page (`/me`,
`/team`, `/group`), every router, every AI prompt, and every insight
surface uses this module to answer **"what can THIS viewer see?"**

Without it, the cascade design (master plan §5.3) cannot work — there
would be no single place that resolves a `userId` into a tier, a
subordinate set, an owned org subtree, and a default landing path.

## Scope

- Files in this map: 3
- Tier values: 5 (`CHAIRMAN` / `GROUP_CEO` / `CEO` / `CXO` / `MEMBER`)
- Landing paths: 4 (`me` / `team` / `group` / `today`)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/scope.ts` | Server-side scope resolver. Pure-ish — reads from DB to build the `ViewerScope`, but contains no mutations. | `ViewerScope`, `ViewerTier`, `LandingPath`, `roleTypeToTier`, `landingForTier`, `resolveViewerScope`, `canViewPerson`, `canViewOrgUnit`, `viewerToOrgScope` |
| `server/routers/scope.ts` | tRPC router exposing scope info + per-user landing override + direct reports + org tree + team submission status. | `scopeRouter` |
| `client/src/hooks/useViewer.ts` | React hook wrapping `trpc.scope.getViewer.useQuery`. Cached with `staleTime: 60_000`. Plus client-side helpers `tierLabel`, `canAccessTeamView`, `canAccessGroupView`. | `useViewer`, `tierLabel`, `canAccessTeamView`, `canAccessGroupView`, `ViewerTier`, `LandingPath` |

## Functions

### `server/scope.ts`

- **`ViewerTier`** (type) at `:20` — 5-value union. Derived from
  `roles.roleType` via `roleTypeToTier`. Maps:
  - `CHAIRMAN` → `CHAIRMAN`
  - `GROUP_CEO`, `GROUP_CHRO` → `GROUP_CEO`
  - `CEO` → `CEO`
  - `CXO`, `CHRO`, `CXO_PLUS_ONE` → `CXO`
  - anything else / null → `MEMBER`

- **`LandingPath`** (type) at `:21` — `"me" | "team" | "group" |
  "today"`.

- **`ViewerScope`** (interface) at `:23` — The output of resolution:
  ```
  {
    person: Person;
    primaryRole: Role | null;
    allRoles: Role[];
    tier: ViewerTier;
    defaultLanding: LandingPath;
    ownedOrgUnitIds: number[];      // directly + transitively
    subordinatePersonIds: number[]; // directly + transitively
    directReportPersonIds: number[];
    isFundWide: boolean;
  }
  ```

- **`roleTypeToTier(roleType)`** at `:42` — Pure mapping function.

- **`landingForTier(tier, hasReports)`** at `:64` — Returns the default
  landing path for a tier. Logic:
  - `CHAIRMAN` / `GROUP_CEO` → `"group"`
  - `CEO` / `CXO` → `"team"` if they have direct reports, else `"me"`
  - `MEMBER` → `"me"`

- **`resolveViewerScope(person, tenantId)`** at `:142` — **The
  workhorse function.** Reads:
  1. The person's `currentRoleId` to get `primaryRole`.
  2. All roles where `personId = person.id AND isActive = true` →
     `allRoles`.
  3. Computes `tier` from `primaryRole.roleType`.
  4. Walks the `roles.reportsToRoleId` graph (transitively!) to
     produce `subordinatePersonIds`, `directReportPersonIds`.
  5. Walks the `orgUnits.parentOrgUnitId` graph from the org units
     this person leads to produce `ownedOrgUnitIds`.
  6. Sets `isFundWide` true for CHAIRMAN / GROUP_CEO / admin users.
  7. Computes `defaultLanding`.
  - Side effects: 4-6 DB reads. Cached per-request via the tRPC
    query layer (60s staleTime on the client).
  - Callers: `scopeRouter.getViewer` (the only caller — the React
    layer pulls via the tRPC query, no other server module calls
    this directly).

- **`canViewPerson(viewer, subjectPersonId)`** at `:242` — Returns true
  iff the viewer can see assessments / observations / journals about
  the subject person. Logic: viewer is subject themselves, OR subject
  is in viewer's `subordinatePersonIds`, OR viewer is `isFundWide`.

- **`canViewOrgUnit(viewer, orgUnitId)`** at `:248` — True iff the
  orgUnit is in `viewer.ownedOrgUnitIds`, OR viewer is `isFundWide`.

- **`viewerToOrgScope(viewer)`** at `:256` — Maps a viewer to one of
  `"FUND" | "COMPANY" | "FUNCTION" | "TEAM" | "INDIVIDUAL"` — the
  abstract scope the viewer operates at. Used by analytics surfaces
  to pick the right rollup level.

### `server/routers/scope.ts`

- **`scopeRouter`** at `:18` — 5 procedures:

  - **`getViewer`** at `:24` (`protectedProcedure.query`) — Resolves
    `ctx.user.id → person → ViewerScope`. Honors a user-set landing
    override if `userPreferences.defaultLandingExplicit` is true.
    Returns a flat object the client (`useViewer`) consumes. Throws
    `NOT_FOUND` if the user has no person row.

  - **`setLanding`** at `:78` (`protectedProcedure.mutation`) — Sets
    a user's preferred landing path (`/me`, `/team`, `/group`,
    `/today`). Writes to `userPreferences.defaultLandingPath` +
    `defaultLandingExplicit = true`. Used by a settings page (not
    yet built — planned Phase 1 Tier B).

  - **`listDirectReports`** at `:109` (`protectedProcedure.query`) —
    Returns a list of `{ personId, personName, photoUrl, roleTitle,
    cycleStatus }` for the caller's direct reports. Used by
    `Team.tsx`.

  - **`getOrgTree(rootOrgUnitId?)`** at `:150`
    (`protectedProcedure.query`) — Returns the org subtree the
    viewer can see. If `rootOrgUnitId` is provided, scopes to that
    subtree; otherwise uses the viewer's `ownedOrgUnitIds` (or the
    fund root if `isFundWide`). Returns `{ units, persons, roles }`.
    Used by `Group.tsx`.

  - **`getTeamSubmissionStatus`** at `:234`
    (`protectedProcedure.query`) — For each direct report, returns
    `{ personId, journalsLogged, ratingsSubmitted, submitted }` for
    the active cycle. Used by the team-view status grid.

### `client/src/hooks/useViewer.ts`

- **`useViewer()`** at `:11` — The React hook. Wraps
  `trpc.scope.getViewer.useQuery` with `staleTime: 60_000` (1 min)
  and `retry: 1`. Every fractal page (`/me`, `/team`, `/group`,
  `/chairman/*`, `/financial-cockpit`, etc.) calls this once at mount.
  Returns `{ viewer, isLoading, error, refetch }`.

- **`tierLabel(tier)`** at `:24` — Pure mapping for UI display.

- **`canAccessTeamView(tier, hasReports)`** at `:42` — Client-side
  check for whether to show `/team` in the sidebar. Mirror of
  `landingForTier` logic.

- **`canAccessGroupView(tier, isFundWide)`** at `:48` — Client-side
  check for whether to show `/group`. Mirror of the server's
  `viewer.isFundWide || tier in (CHAIRMAN, GROUP_CEO, CEO)`.

## Data Touched

- `persons` — read by `resolveViewerScope` (person + email-or-userId
  fallback) and by every router endpoint that needs the caller's
  person.
- `roles` — read for `primaryRole`, `allRoles`, and the transitive
  reportsToRoleId walk.
- `orgUnits` — read for the `parentOrgUnitId` walk to compute
  `ownedOrgUnitIds`.
- `userPreferences` — read by `getViewer` for the landing override;
  written by `setLanding`.
- `governanceCycles`, `governanceAssessments`, `mandateJournals`,
  `feedbackTypes` — read by `getTeamSubmissionStatus` for per-report
  cycle progress.

## External Dependencies

- `drizzle-orm` — `and`, `eq`, `inArray`, `desc`.
- `@trpc/server` — `TRPCError`.
- `zod` — input validation.

## Internal Conventions

1. **`useViewer` is called exactly once per page** at the top.
   `viewer` is then passed down or used inline. Don't call
   `useViewer()` in a nested component — it'll just re-trigger the
   query (deduped by react-query but wasteful).

2. **`resolveViewerScope` is the only producer of `ViewerScope`.**
   Don't build a viewer object by hand from raw `persons` /
   `roles` reads — the transitive subordinate / owned-orgUnit walks
   are subtle.

3. **`isFundWide` is the universal escape hatch** for fund-level
   leadership (Chairman, MD, CHRO, admin). When a router needs to
   permit a viewer to bypass the subordinate filter, it checks
   `viewer.isFundWide`, NOT the tier directly.

4. **Tier `MEMBER` covers everyone not in the leadership ladder.**
   IC, manager-without-APEX-recognised-role, etc. UI surfaces hide
   `/team` and `/group` for MEMBER unless `hasReports` overrides
   (rare today).

5. **Landing path can be overridden per user** via
   `userPreferences.defaultLandingPath + defaultLandingExplicit=true`.
   Without the explicit flag, the tier-computed default wins.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `persons`, `roles`, `orgUnits`, `userPreferences`, plus governance tables (`governanceCycles`, `governanceAssessments`, `mandateJournals`, `feedbackTypes`) for the submission-status endpoint. |
| `db-layer.md` | `getDb`, `getPersonByUserIdOrEmail`. |
| `auth-rbac.md` | `protectedProcedure`, `ctx.user`. |
| `preferences.md` *(planned)* | `userPreferences` table + helpers for the landing-override path. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| `me-surface.md` | `useViewer()` (fractal Me page). |
| `team-surface.md` | `useViewer()`, `listDirectReports`, `getTeamSubmissionStatus`. |
| `group-surface.md` | `useViewer()`, `getOrgTree`. |
| `chairman-surface.md` | `useViewer()` (for `isFundWide` and tier checks). |
| `me-surface.md` and `team-surface.md` (PrimaryActionCard) | `viewer.subordinatePersonIds`, `viewer.ownedOrgUnitIds`. |
| `governance-cycle.md` *(planned)* | `viewer` to filter cycle-assignment lists. |
| `agentic-memory.md` *(planned)* | `canViewPerson` for memory-read gating. |
| `analytics.md` *(planned)* | `viewerToOrgScope` to pick rollup level. |
| `shell-layout.md` | `useViewer()`, `tierLabel`, `canAccessTeamView`, `canAccessGroupView` for sidebar visibility. |

## Fragility Notes

### Transitive walks on every `getViewer` call

`resolveViewerScope` walks both the `reportsToRoleId` graph (to
collect subordinates) and the `parentOrgUnitId` graph (to collect
owned org units). For deep trees this could become slow. **Cache
the resolved viewer for ~60s** — both client (`useViewer`'s
`staleTime: 60_000`) and ideally server (not yet implemented).
**Worst case today:** Chairman walks ~50 nodes. Fine.

### `tier === "CXO"` collapses `CXO`, `CHRO`, `CXO_PLUS_ONE`

Three different roleTypes map to one tier. Almost always what we
want — CHRO and CXO_PLUS_ONE are treated like CXOs for UI
purposes. **But:** if you write `if (viewer.tier === "CHRO")` (which
is not a tier value!), TypeScript catches it. If you write
`viewer.primaryRole?.roleType === "CHRO"`, that works. **The
distinction matters for `/governance-admin` + calibration**, which
should be CHRO-only — and that check uses `roleType`, not `tier`.

### `directReportPersonIds` only counts active roles

`getDirectReports` (in `db.ts`) filters `isActive = true`. If a role
is marked inactive (e.g. someone left), they vanish from
subordinates immediately. **Side effect:** historical perception-gap
data about a person who left still references their `personId`, but
their leader no longer "owns" them in the viewer scope. **A
read-permission edge case** that the upcoming `canReadAssessment`
helper (Phase 1 Tier A) needs to handle: should a CXO still see
assessments about an ex-report? **Default proposal: yes, for 90
days post-departure.**

### `isFundWide` doesn't include `CEO` by default

A portfolio CEO does NOT see fund-wide data (financial cockpit
across all 13 companies). They see only their company's subtree.
This is intentional — fund transparency is reserved for fund-level
roles. **But the `canAccessGroupView` helper currently INCLUDES
CEO** — so a CEO can navigate to `/group`, just sees only their
own company. Worth verifying the rendering at `Group.tsx` doesn't
leak cross-company data.

### `getTeamSubmissionStatus` does N+1 queries

Today the implementation pulls direct reports, then for each, pulls
governance assessments + mandate journals. With ~5 direct reports
this is fine. **If a leader's team scales to 50+, this becomes
slow.** Worth batching to a single join when scale demands.

### `setLanding` mutation has no audit

Changing your landing preference is a low-stakes write, but per the
master plan §3.9 observability principle, even small UI-pref mutations
should hit `auditLogs` when Phase 2 wires up the AuditLogger. Track
this as a small TODO.

### `getOrgTree` doesn't enforce viewer scope server-side

The endpoint reads `rootOrgUnitId` from input and returns the subtree.
**It doesn't check that `rootOrgUnitId` is in
`viewer.ownedOrgUnitIds` or that `viewer.isFundWide`.** A user could
pass any `rootOrgUnitId` and get back data outside their scope. **This
is a real RBAC hole** — Phase 1 Tier A must add a `canViewOrgUnit(
viewer, rootOrgUnitId)` check at the top of the handler. Today the
exposure is limited because the only client caller (`Group.tsx`)
passes either the viewer's owned root or a sub-drill that came from a
prior tree response — but server-side validation is the right level.

### `useViewer` retries only once

`trpc.scope.getViewer.useQuery(..., { retry: 1 })`. A flaky network
or a slow first auth resolution surfaces as "viewer not loaded" with
just one retry. The `staleTime: 60_000` caches success, but the first
load is fragile. Combined with `useAuth`'s `retry: false` (see
`auth-rbac.md`), a transient backend hiccup can produce a "you have
no profile" screen.
