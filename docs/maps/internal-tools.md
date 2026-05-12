# internal-tools

> Last updated: 2026-04-21

## Purpose

Internal / dev-only surfaces — not part of the user-facing flow.
Documented so future contributors don't mistake them for product.

## Scope

- Files: ~4 components + 1 server cache
- tRPC endpoints: 0 (read-only utilities)
- Tables touched: 0

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/components/Map.tsx` | ~155 lines. Visual sitemap / nav explorer for dev — NOT the codebase MAPS documentation. Possibly dead code; verify. | `Map` |
| `client/src/components/ProfileViewAudit.tsx` | ~117 lines. Dev tool to inspect ProfileView state. Visible only under feature flag. | `ProfileViewAudit` |
| `client/src/pages/ComponentShowcase.tsx` | ~1437 lines. A gallery of every UI component (shadcn + custom) for design QA. Reached at `/components`. | `ComponentShowcase` (default) |
| `server/query-cache.ts` | ~116 lines. In-memory LRU for repeated DB reads (TTL-keyed). Used by hot paths like `resolveViewerScope`. | `getCached`, `setCached`, `invalidate` |

## Functions

### `server/query-cache.ts`

- **`getCached(key)` / `setCached(key, value, ttlMs)` /
  `invalidate(prefix)`** — Map-backed LRU. No persistence; lost
  on restart.

### Client components

- **`Map.tsx`** — Renders a visual graph; verify it's still
  reachable / wired before treating as live.
- **`ProfileViewAudit.tsx`** — Debug overlay.
- **`ComponentShowcase`** — Tabs by category (form / display /
  feedback / overlay). Useful for spotting style regressions.

## Data Touched

- `query-cache.ts` caches RESULTS of DB reads, doesn't write.

## External Dependencies

- None unique.

## Internal Conventions

1. **Dev-only routes** should be gated by `import.meta.env.DEV`
   or a feature flag. Currently `ComponentShowcase` may be
   publicly routed at `/components` — check + gate before
   prod-deploy.
2. **`query-cache.ts` is process-local.** Multi-instance
   deployments don't share. Acceptable today.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| (none of consequence) | |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `scope.md` | Uses `query-cache.ts` for scope resolution caching. |
| Various server modules | Cache hot reads. |

## Fragility Notes

### Cache invalidation is the unsolved problem

`query-cache.ts` TTL is the only safety net. If a person's
reportsToRoleId changes, cached scopes are stale until TTL
expires. **Defense:** call `invalidate("scope:")` from any
write that mutates roles / orgUnits.

### `ComponentShowcase` may be publicly routed

1437 lines of internal UI shouldn't be in the prod bundle.
**Action:** confirm route gating; lazy-load if exposed.

### `Map.tsx` is name-collision-prone

`Map` is a JS built-in. Imports must use named/aliased import.
Rename to `SitemapView` Phase 2.

### `ProfileViewAudit` may leak data

Debug tools can render raw scope / RBAC info. Make sure it
requires `viewer.user.role === 'admin'` and `import.meta.env.DEV`.

### Cache key naming is informal

No naming convention enforced. Risk of collisions. **Phase 2**
introduce typed key builders.
