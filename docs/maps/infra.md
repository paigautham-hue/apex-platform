# infra

> Last updated: 2026-04-21

## Purpose

The plumbing layer: HTTP server bootstrap, Vite dev-server wiring,
env-var resolution, build/test scripts, system health check
endpoint, and the directories every other subsystem implicitly
depends on (`_core/` for tRPC + auth, `vite.config.ts`,
`drizzle.config.ts`). Nothing in here is product logic; everything is
"what makes APEX runnable."

## Scope

- Files in this map: ~12
- Lines: ~500 across infra files
- npm scripts: 11

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/_core/index.ts` | Express server bootstrap. `startServer()` configures body-parser (50MB limit for uploads), registers OAuth routes, mounts `appRouter` at `/api/trpc`, picks dev-Vite-middleware vs prod-static serve, finds an available port (3000-3019 fallback), starts listening. | `startServer` (called immediately at module load) |
| `server/_core/env.ts` | Env-var bag. `ENV.appId`, `ENV.cookieSecret`, `ENV.databaseUrl`, `ENV.oAuthServerUrl`, `ENV.ownerOpenId`, `ENV.isProduction`, `ENV.forgeApiUrl`, `ENV.forgeApiKey`. Pulled from `process.env` once at import. | `ENV` |
| `server/_core/vite.ts` | Two functions: `setupVite(app, server)` for dev mode (mounts Vite middleware + HMR via the HTTP server), and `serveStatic(app)` for prod mode (serves `client/dist`). | `setupVite`, `serveStatic` |
| `server/_core/systemRouter.ts` | Health-check tRPC router. Mounted at `appRouter.system`. | `systemRouter` |
| `server/_core/sdk.ts` | Auth-provider SDK wrapper. `sdk.authenticateRequest(req)` is the single seam between APEX and the auth provider. | `sdk` |
| `server/_core/llm.ts` | The LLM gateway. **Documented separately in `ai-llm-gateway.md`** but listed here because it's `_core/`. | `invokeLLM`, etc. (see `ai-llm-gateway.md`) |
| `server/_core/cookies.ts` | Session cookie options. **Documented in `auth-rbac.md`.** | `getSessionCookieOptions` |
| `server/_core/oauth.ts` | OAuth callback routes. **Documented in `auth-rbac.md`.** | `registerOAuthRoutes` |
| `server/_core/imageGeneration.ts` | Image generation helper for AI features that need images. | (functions per use case) |
| `server/_core/dataApi.ts` | Generic data-fetching wrapper. | (functions) |
| `server/_core/map.ts` | Map / geolocation helpers. | (functions) |
| `server/_core/notification.ts` | Push-notification dispatch (browser + iOS). Used by `governance-notifications.ts`. | (functions) |
| `server/_core/types/` | Shared server-side type definitions. | type-only |
| `vite.config.ts` | Vite config: React plugin, Tailwind, JSX-loc plugin, Manus-runtime plugin, path aliases, server proxy for `/api`. | default export |
| `drizzle.config.ts` | Drizzle Kit config: schema path, MySQL dialect, env-var DB credentials. | default export |
| `tsconfig.json` + `tsconfig.node.json` *(if exists)* | TypeScript compiler config. | — |
| `vitest.config.ts` | Vitest test runner config. | default export |
| `package.json` | npm scripts, dependencies, husky `prepare`, workspace config. | — |
| `capacitor.config.ts` | Capacitor config for the planned iOS wrapper (Phase 4). | default export |
| `components.json` | shadcn/ui generator config. | — |

## Functions

### `server/_core/index.ts`

- **`isPortAvailable(port)`** at `:11` — Tests if a port is free by
  briefly opening a server on it.
- **`findAvailablePort(startPort)`** at `:21` — Scans `startPort` to
  `startPort + 20` and returns the first available. Throws if all
  20 are busy. Useful in dev when multiple instances run.
- **`startServer()`** at `:30` — Main entry. Wires Express, body
  parser, OAuth, tRPC middleware, Vite or static, then listens.
  Called immediately at file load (last line of the file).

### `server/_core/vite.ts`

- **`setupVite(app, server)`** — Dev-mode middleware. Mounts Vite
  in middleware mode (its server config inherits from the bound
  Express server for HMR), then serves the client HTML with
  on-the-fly module-id rewrites.
- **`serveStatic(app)`** — Prod-mode static-file serving. Serves
  `client/dist/**` and falls back to `index.html` for unknown paths
  (SPA routing).

### `server/_core/env.ts`

- **`ENV`** at `:1` — Frozen-at-import bag of env vars. **Read once;
  don't reach for `process.env` directly in business code.** Adding
  a new env var means: add to `ENV`, document its purpose in this
  map's data section, update `.env.example`.

### `server/_core/systemRouter.ts`

- **`systemRouter`** — Tiny tRPC router with a `health` endpoint
  (returns `{ ok: true }` and current build version). Mounted at
  `appRouter.system`. Used by the Manus runtime for health checks.

### npm scripts (in `package.json`)

- **`pnpm dev`** — `NODE_ENV=development tsx watch
  server/_core/index.ts`. Starts the dev server with hot-reload.
- **`pnpm build`** — Vite build (client) + esbuild bundle (server)
  to `dist/`.
- **`pnpm start`** — `NODE_ENV=production node dist/index.js`. The
  production entrypoint.
- **`pnpm check`** — `tsc --noEmit`. Type-check only, no emit.
- **`pnpm format`** — Prettier write.
- **`pnpm test`** — `vitest run`. The full test suite.
- **`pnpm db:push`** — `drizzle-kit generate && drizzle-kit
  migrate`. The schema migration pipeline.
- **`pnpm seed:evergreen`** — `tsx server/seed-evergreen.ts`. Seeds
  the Evergreen Fund data.
- **`pnpm check:maps`** — Audits drift + orphans across every
  subsystem map. Use one-shot when you want to know overall map
  health.
- **`pnpm check:maps:drift`** — Drift check only (PR mode).
- **`pnpm check:maps:orphans`** — Orphan check only (PR mode).
- **`pnpm prepare`** — `husky`. Installs the `.husky/pre-push` hook
  after `pnpm install`.

## Data Touched

- None directly. `server/_core/index.ts` mounts the tRPC router but
  doesn't read from the DB. `ENV.databaseUrl` is consumed by
  `server/db.ts:getDb()` (documented in `db-layer.md`).

## External Dependencies

- `express` — HTTP server framework.
- `@trpc/server` + `@trpc/server/adapters/express` — tRPC over Express.
- `vite` (dev only) — dev-server with HMR.
- `dotenv` — `.env` file loading.
- `nanoid` — used by Vite middleware for module-id stamping.
- `net` (node built-in) — port availability check.
- `http` (node built-in) — `createServer`.
- `superjson` — tRPC transformer (technically a runtime dep of every
  tRPC call, listed here as the gateway boundary).
- `drizzle-kit` (build-time) — schema → migration generation.
- `vitest` — test runner.
- `prettier` — formatter.
- `husky` — git-hook installer (Phase 0 addition).
- `esbuild` — server bundler for production build.
- `tsx` — TS execution for `pnpm dev` watch loop and scripts.

## Internal Conventions

1. **Don't reach for `process.env` directly in business code.** Add
   the var to `ENV` in `server/_core/env.ts` and import from there.
   This gives one place to grep when env-var migration is needed.

2. **The Express middleware order matters.** Body parser → OAuth
   routes → tRPC middleware → Vite-or-static. Don't reorder; the
   OAuth callback needs body parsing but doesn't go through tRPC.

3. **Port selection is fault-tolerant.** Dev mode finds the first
   available port in `[PORT, PORT+20)`. Prod mode is strict (uses
   the configured `PORT` directly). Don't change this — dev
   tolerance is what lets multiple instances co-exist.

4. **`startServer()` is called at module load,** not exported. The
   process boots by executing `server/_core/index.ts`.

5. **`_core/` is the prefix for "core plumbing."** Routers and
   business logic live above `server/`. **Don't put domain code in
   `_core/`.** Voice agent, governance cycle, AI features all live
   outside.

6. **Vite middleware mode** — Express owns the HTTP server; Vite is
   a middleware on top. This is unusual but lets us share a single
   port for both API and SPA in dev. Don't try to run Vite standalone
   on its own port — the auth cookie scope breaks.

7. **`pnpm` is the package manager. Not npm, not yarn.** Locked via
   `package.json:packageManager`. The lock file
   (`pnpm-lock.yaml`) is the source of truth for versions.

## Forward & Backward Dependencies

**Backward (this map's files depend on):**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | `drizzle.config.ts` references the schema. |
| `auth-rbac.md` | `server/_core/index.ts` registers OAuth routes (`registerOAuthRoutes`) and uses `createContext`. |
| Every router subsystem | `server/_core/index.ts` mounts `appRouter` from `server/routers.ts` — which transitively includes every sub-router. |

**Forward (other subsystems depend on this map):**

| Other subsystem | What they use |
|---|---|
| **Every server-side subsystem map** | `server/_core/llm.ts` (LLM calls), `server/_core/env.ts` (config), and the tRPC middleware that this file mounts. |
| `auth-rbac.md` | `setupVite` → Vite serves the React app that mounts `useAuth`. |
| `seed-and-migrations.md` | `pnpm db:push`, `pnpm seed:evergreen`. |

## Fragility Notes

### `startServer().catch(console.error)` — silent crash on boot failure

The last line of `server/_core/index.ts` is
`startServer().catch(console.error)`. If `startServer()` rejects,
the error is logged and the process exits. **No alerting hookup.**
In production this surfaces as "the app is down" with the cause
buried in stderr. Phase 2's observability work should pipe boot
errors to a structured log destination.

### Body-parser 50MB limit is high

`express.json({ limit: "50mb" })`. Set for `EvidenceUpload` /
`SelfAppraisalCard` (PACE Word/PDF uploads up to 16MB) plus base64
encoding overhead. **Side effect:** any tRPC call that exceeds 50MB
fails with a cryptic message. Reasonable for the intended use; if
we ever need larger uploads, switch to multipart streaming.

### `findAvailablePort` race

If two `pnpm dev` instances start simultaneously, both can pick the
same port in the gap between availability check and `listen()`. One
of them will fail loudly. **In practice:** rare and obvious.

### `ENV` is captured at import time

If `process.env` changes after import (e.g. you load `.env` after
the import), `ENV` will be stale. `dotenv/config` import at the top
of `index.ts` ensures `.env` loads first, but **don't rely on
runtime env changes** — restart the process.

### Vite middleware in production is wrong

`NODE_ENV === "development"` selects Vite middleware. Anything else
(including `NODE_ENV=test` or unset) falls into prod static serving.
The Manus runtime sets `NODE_ENV=production` correctly; local
testing without `NODE_ENV` set produces unexpected behavior. **Set
`NODE_ENV` explicitly** in local prod-style runs.

### `nanoid` is imported in Vite middleware

Imported for module-id stamping. Pinned to `3.3.7` in
`package.json:pnpm.overrides` because newer nanoid versions broke a
Manus runtime tool. **Don't bump nanoid without verifying the
override still applies.**

### `tsx` for the dev watcher

Used because Vite's middleware-mode setup expects a Node-side
runner that can transpile TypeScript on the fly. **Don't replace
with `node --loader` or similar** without testing — module
resolution differs.

### `pnpm prepare` runs husky

Added in the Phase 0 bootstrap. **Anyone who clones the repo and
runs `pnpm install` automatically gets the pre-push hook installed.**
If husky fails (e.g. on a CI environment where `.git` is missing),
`pnpm install` will fail. The fix is `HUSKY=0 pnpm install` in CI
environments without a git context.

### Health endpoint is the only system-level surface

`appRouter.system.health` is the only out-of-band introspection
endpoint. **No DB-connectivity health, no LLM-up health, no
disk-space health.** Phase 2's observability work should add a
richer `system.diagnostics` endpoint.

### `vite.config.ts` and `drizzle.config.ts` are hand-curated

Both files are small but easy to drift if a dependency changes its
config shape. **If a build breaks after a dep bump, check these
configs first** — they're the most opaque part of the infra layer.

### `capacitor.config.ts` exists but iOS isn't wired

The file is there for Phase 4. **Don't touch it casually** — when
we wire iOS, this file is the canonical source of bundle id,
permissions, and plugins. Pre-Phase-4 changes risk drift with
Meridian's mature Capacitor config (see `MERIDIAN_REFERENCE.md` §6).
