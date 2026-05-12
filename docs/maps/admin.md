# admin

> Last updated: 2026-04-21

## Purpose

The **admin console** at `/admin` — tenant-level configuration:
org-units CRUD, people directory (read), access-challenge
resolution, calibration session bootstrap (Phase 4 placeholder).

Distinct from `governance-admin.md` (which is the Chairman cycle
control panel). Admin role required.

## Scope

- Files: 1 page (large, tabbed)
- tRPC endpoints called: `tenant.listOrgUnits`,
  `tenant.createOrgUnit`, `person.list`,
  `calibration.listSessions`, `calibration.startSession`,
  `accessControl.adminListAllChallenges`,
  `accessControl.resolveChallenge`
- Tables touched: `orgUnits`, `accessChallenges`,
  `calibrationSessions` (via routers)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Admin.tsx` | ~531 lines. Tabs: Org Units, People, Calibration (scaffold), Access Challenges. | `Admin` (default) |

## Functions

### Page-level

- **Org units tab** — create / list. `createOrgUnit` mutation
  via `tenant.createOrgUnit`.
- **People tab** — read-only directory. Links to PersonProfile.
- **Access challenges tab** — filter by status (ALL / PENDING /
  RESOLVED / DISMISSED). Resolution textarea + RESOLVE /
  DISMISS buttons. Requires ≥5 char resolution note.
- **Calibration tab** — scaffold UI; calls
  `calibration.startSession` (router exists per
  `calibration.md`; UI is placeholder).

## Data Touched

- Writes: `orgUnits`, `accessChallenges` (resolution),
  `calibrationSessions` (start).
- Reads: same + `persons`.

## External Dependencies

- shadcn UI.

## Internal Conventions

1. **Admin-only.** Frontend doesn't guard explicitly — relies
   on backend `adminProcedure`. UI shows error toasts on
   permission denial.
2. **Tab-scoped queries.** Challenges query has
   `enabled: selectedTab === "challenges"` to avoid eager load.
3. **Calibration UI is forward-looking** — Phase 4. The router
   exists; UI is hopeful.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `access-control.md` | Challenge resolution path. |
| `org-tree.md` | Org-units CRUD. |
| `people-pages.md` | People directory link. |
| `calibration.md` *(planned)* | Calibration tab. |
| `auth-rbac.md` | Admin gate. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| (none — leaf admin surface) | |

## Fragility Notes

### No org-unit edit / archive

Created org-units are forever. Bad data lingers. **Phase 1 Tier
C** add edit + archive.

### Challenge resolution is irrevocable

Once RESOLVED or DISMISSED, no undo. A wrong dismissal is
permanent. **Phase 2** soft-revert with audit trail.

### Calibration tab references unbuilt router

`calibration.listSessions` + `calibration.startSession` exist
per the planned Phase 4 work. Today they may be no-op or
missing. **Verify** before relying.

### People tab read-only

Admin can't deactivate / role-change people from here. Has to
go via DB. **Phase 2** add lifecycle controls.

### Tab state lost on refresh

Local `useState("org-units")`. Phase 1 Tier C — encode in URL
query.

### Resolution note ≥5 char is lenient

"asdfg" passes. **Phase 2** require a structured outcome enum +
note.

### No bulk operations

Resolving 20 challenges = 20 clicks. **Phase 2** select-all.
