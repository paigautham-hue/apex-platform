# group-surface

> Last updated: 2026-04-21

## Purpose

`/group` is the **fund-wide / company-tree drill view** —
recursive. Chairman/GROUP_CEO/CHRO sees the full fund tree; a CEO
sees their company subtree; a CXO sees their function subtree.

Used for navigation ("who leads MGPS?") and aggregation
("companies in INCUBATE stage with no Chairman score this cycle").

## Scope

- Files in this map: 1 page
- tRPC reads: `scope.getOrgTree`, `scope.getViewer` (via
  `useViewer`)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Group.tsx` | The `/group` page. Renders identity strip + cycle banner + PrimaryActionCard + the org-tree drill view. Supports drill-in via `drillRoot` local state — clicking a unit card narrows the tree. | `Group` (default) |

## Functions

### `client/src/pages/Group.tsx`

- **`Group()`** at `:30` — Reads `useViewer`,
  `scope.getOrgTree(rootOrgUnitId: drillRoot)`. Builds a hierarchy
  from the flat tree:
  - `topLevel` = units whose `parentOrgUnitId` is null or not in
    the visible set.
  - `childrenOf(id)` for drill-down.
  - `rolesByOrgUnit`, `personById` maps for leader lookup.
  - Each top-level card shows: unit name + type badge +
    lifecycle-stage badge + leader avatar + child count + role
    count + "Drill in" / "Open leader" buttons.

## Data Touched

- Read-only: `orgUnits`, `roles`, `persons`.

## External Dependencies

- `react`, `wouter`, `lucide-react`, `@radix-ui/*`.

## Internal Conventions

1. **`drillRoot` is local state.** Reset on navigate-away.
   `getOrgTree` re-runs when it changes — query cache handles
   dedup.
2. **The page doesn't render fund-wide metrics inline.** That
   belongs on `analytics.md` (planned). The /group page is
   *navigational*, not analytical.
3. **The Chairman / GROUP_CEO see the holding company as the
   root.** Other tiers see their owned subtree.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `scope.md` | `useViewer`, `getOrgTree`. |
| `org-tree.md` *(this map's sibling)* | `orgUnits`, `roles`, `persons` types. |
| `rhythm-engine.md` | `PrimaryActionCard`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `shell-layout.md` | `DashboardLayout` wraps `/group`. |
| `people-pages.md` | "Open leader" link → `/people/<id>`. |

## Fragility Notes

### `getOrgTree` RBAC hole (already in scope.md)

The server endpoint doesn't validate `rootOrgUnitId` against viewer
scope. **Phase 1 Tier A blocker.** Re-cited here because `/group`
is the only caller.

### No fund-wide metrics inline

A user lands on `/group` expecting "show me how the fund is
doing." Today they get a tree. Phase 5+ `analytics.md` adds a
metrics row above the tree (fund vitality, perception-gap count,
chronic-deferral count, financial variance — see master plan
§10 success metrics).

### Drill-up only goes to "top" not "one level up"

The "Up to top" button resets `drillRoot` to null. A user drilling
3 levels deep can't go up one level — they jump to the top. **A
small UX flaw**. Worth tracking a drill-path stack in state.
