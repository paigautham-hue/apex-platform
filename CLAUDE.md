# CLAUDE.md — APEX

Agent operating rules for the APEX platform. This file is short by
design. The strategic document lives at `docs/MASTER_PLAN.md`; the
day-to-day codebase index lives at `docs/PROJECT_MAP.md`. The
original V1 product brief is archived at `docs/ARCHIVE_V1_BRIEF.md`
for historical context.

---

## How to start any task

1. **Read `docs/MASTER_PLAN.md` first** if it has been more than
   ~14 days since you last read it, or if the user is asking you to
   change product direction.
2. **Open `docs/PROJECT_MAP.md`** and find the subsystem your task
   touches.
3. **Read the relevant subsystem map(s)** under `docs/maps/`. Pay
   close attention to:
   - The **Fragility Notes** section — that's where the landmines are.
   - The **Forward & Backward Dependencies** section — that's how you
     find out who else you might break.
4. **Then start the work.**
5. **Before you commit:** update the subsystem map(s) you touched.
   File inventory changes, function changes, data-touched changes,
   fragility-note additions, and forward/backward dependency edges
   all belong in the same commit as the code change.
6. **`git push`** — the `.husky/pre-push` hook runs
   `scripts/check-map-orphans.mjs` + `scripts/check-map-drift.mjs`
   in **strict mode**. If they fail, fix the maps and push again.
   Bypass only with `SKIP_MAPS_LINT=1` and a documented reason.

---

## Hard rules

These are non-negotiable. Treat them as compiler errors.

1. **MAPS-first workflow.** Read maps before changing code; update
   maps in the same commit as code. The pre-push hook enforces this.
2. **Tenant isolation.** Every read and write must filter by
   `tenantId`. No id-only lookups. RBAC primitives in `server/db.ts`
   (`isChairmanOrAdmin`, `canEditCompanyFinancials`,
   `canAssessTarget`) are the chokepoints.
3. **AI never rates a person.** Only humans rate humans. AI surfaces
   patterns and asks questions.
4. **Privacy & provenance on every write.** Every new user-writable
   field shows who can see it, when it becomes visible, who wrote it,
   what cycle it belongs to. If you can't answer those, the feature
   isn't ready to ship.
5. **One pattern, many scopes.** New features default to "any leader
   can do this on their reports." Don't hardcode Chairman-only or
   CEO-only without a structural reason.
6. **No new top-level pages without a subsystem map.** Add a row to
   `PROJECT_MAP.md` AND create the map file in the same commit.
7. **Voice path alongside the form.** New write surfaces ship with a
   voice intent declared in `server/routers/voice.ts` and a parse →
   preview → confirm contract.
8. **Push to `main` directly.** This project has authorized direct
   pushes to main. No feature-branch / PR ceremony.

---

## Workflow shortcuts

- `pnpm check:maps` — audit every subsystem map for drift +
  orphans, one-shot.
- `pnpm check:maps:drift` — drift check only (PR mode).
- `pnpm check:maps:orphans` — orphan check only (PR mode).
- `pnpm check` — TypeScript type-check.
- `pnpm test` — vitest test suite.
- `pnpm dev` — local dev server.

---

## Conventions cheatsheet

- **Tech stack:** React 19 + Vite 7 (client), Express + tRPC v11
  (server), MySQL + Drizzle ORM, jose (JWT), pnpm.
- **Routers** live in `server/routers/` (sub-routers) merged into
  `server/routers.ts` (root `appRouter`).
- **DB queries** live in `server/db.ts`. Routers call db helpers,
  not Drizzle directly (except for tightly-scoped inline queries
  with documented reasons).
- **AI calls** go through `server/_core/llm.ts`. Do not call
  OpenAI / Gemini / Anthropic SDKs directly elsewhere.
- **Schema changes** require a new migration via `pnpm db:push`.
- **Frontend state** flows through tRPC hooks
  (`trpc.routerName.procedureName.useQuery / useMutation`). No
  direct fetch.
- **Routes** are added to `client/src/App.tsx` inside the
  `<Switch>`, wrapped in `<DashboardLayout>` unless the page owns
  its own shell.
- **Tenant scoping** in the client is currently hardcoded
  `TENANT_ID = 1`. Don't fix this opportunistically — it's a
  systemic migration that needs its own plan.

---

## When in doubt

- The user's intent comes before the literal task description.
  Re-read what they actually want.
- If the master plan and a subsystem map disagree, the map wins for
  that subsystem and the master plan gets a follow-up update.
- If the master plan and the code disagree, the master plan wins
  until the code catches up.
- If a subsystem map and the code disagree, the map is the *intent*
  — fix the code to match, or update the map with a clear rationale.
- If `.husky/pre-push` fails, the right move is to update the map,
  not to bypass.

---

*See `docs/MASTER_PLAN.md` for vision, phases, and what APEX is not.*  
*See `docs/PROJECT_MAP.md` for the per-subsystem index.*  
*See `docs/ARCHIVE_V1_BRIEF.md` for the original V1 product brief.*
