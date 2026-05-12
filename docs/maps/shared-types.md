# shared-types

> Last updated: 2026-04-21

## Purpose

The **shared types + constants + generic UI primitives** —
everything imported by both client and server, plus the shadcn
component library wrapper. This map is intentionally
catch-all: the small files that don't merit their own map but
collectively underpin everything.

## Scope

- Files: `shared/types.ts`, `shared/const.ts`,
  `shared/constants.ts`, `shared/observation-templates.ts`,
  `client/src/lib/*`, `client/src/components/ui/*`, theming.
- tRPC endpoints: 0
- Tables touched: 0

## Files

| File | Purpose | Key exports |
|---|---|---|
| `shared/types.ts` | Cross-cutting TypeScript types — `ViewerScope`, `TenantContext`, etc. Imported by both client + server. | (types) |
| `shared/const.ts` | Enum constants — feedback-type keys, observation sources, status enums. | (consts) |
| `shared/constants.ts` | Fund-level constants — core values, role-rank ordering, dimension keys. | (consts) |
| `shared/observation-templates.ts` | `OBSERVATION_TEMPLATES` array — situational prompts. | `OBSERVATION_TEMPLATES` |
| `client/src/lib/trpc.ts` | React Query + tRPC client setup. | `trpc`, `trpcClient` |
| `client/src/lib/utils.ts` | `cn()` Tailwind class merger. | `cn` |
| `client/src/components/ui/*` | shadcn primitives (Button, Card, Dialog, Select, Tabs, Table, …). Generated via `pnpm dlx shadcn add`. | each primitive |
| `client/src/contexts/ThemeContext.tsx` | Dark/light theme provider. | `ThemeProvider`, `useTheme` |
| `client/src/hooks/useViewer.ts` | `useViewer()` returning `{ viewer, isLoading, refetch }`. See `auth-rbac.md`. | `useViewer` |

## Functions

- **`cn(...classnames)`** — `clsx` + `tailwind-merge`. Use
  everywhere a className is computed.
- **`trpc`** — React-Query bindings.

## Data Touched

None.

## External Dependencies

- `@trpc/react-query`, `@tanstack/react-query`.
- `clsx`, `tailwind-merge`.
- shadcn UI (Radix-based primitives).

## Internal Conventions

1. **Shared types are the source of truth** for cross-cutting
   shapes. Don't redefine `ViewerScope` per-file.
2. **Constants over magic strings.** Feedback-type keys,
   observation sources, dimension keys all live in `shared/`.
3. **shadcn components are owned source.** They're copied into
   the repo, not depended on. Customise freely; document changes.
4. **`cn` everywhere.** No raw string concatenation for
   classNames.
5. **Theme is HSL CSS vars** (`--background`, `--foreground`,
   etc.) — see Tailwind config + `index.css`.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| (none — leaf) | |

**Forward:**

| Other subsystem | What they use |
|---|---|
| *(all client + server modules)* | Types + constants. |
| Every UI page | shadcn primitives. |

## Fragility Notes

### Type drift between server payload and client expectation

Server returns Drizzle row objects with `decimal` columns as
strings; client `shared/types.ts` may type them as `number`.
Per-consumer cast bandaids. **Phase 2** generate a DTO layer
that converts at the tRPC boundary.

### Constants split across three files

`const.ts`, `constants.ts`, `observation-templates.ts` aren't
clearly demarcated. **Phase 1 Tier C** consolidate into
`shared/const/<concern>.ts` and re-export.

### shadcn primitives diverge from upstream

We've customised some (Button variants, Card padding). On a
shadcn update, manual reconciliation needed. **Defense:**
document customisations in component-level comments.

### `cn` doesn't validate Tailwind class names

A typo silently produces no style. **Defense:** Tailwind IntelliSense
+ CI lint via tailwindcss-classname-checker. Not wired today.

### `useViewer` calls tRPC unconditionally

Even on public routes, the hook tries to fetch viewer. Logged-out
path returns null gracefully. Acceptable but wasted call.

### Theme context doesn't persist preference

`ThemeProvider` reads/writes localStorage but doesn't tie to
`userPreferences`. Cross-device drift. **Phase 2** sync to
preferences.

### `trpc.ts` has no error-link

Failed requests bubble as React-Query errors per call. No global
toast on 401/500. **Phase 2** add `errorLink` for centralized
handling (auth refresh, generic toast).
