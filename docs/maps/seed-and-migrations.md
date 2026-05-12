# seed-and-migrations

> Last updated: 2026-04-21

## Purpose

The **database lifecycle scripts** — Drizzle-generated migration
SQL, one-off "fix the table" migration shims, and the
Evergreen-tenant seed that populates the Manipal fund's actual
org tree, mandates, dependency chains, FY27 plans, and initial
cycle.

## Scope

- Files: 7 Drizzle migrations + 1 seed module + 1 seed entry +
  3 one-off shims
- tRPC endpoints: 0
- Tables touched: all (depending on which script)

## Files

| File | Purpose | Key exports |
|---|---|---|
| `drizzle/0000_eager_scorpion.sql` … `0006_glorious_scarecrow.sql` | Drizzle-generated migrations. Numeric order. Run on `pnpm db:push` / Drizzle Kit. | (SQL DDL) |
| `server/seed-evergreen.ts` | ~609 lines. Populates Manipal Evergreen Fund: orgUnits (fund + holdings + 6 portfolio companies), persons (27 leaders), roles + reportsToRoleId graph, mandates per role, dependencyChains, FY27 plans+metrics, kicks off first cycle. Idempotent. | `seedEvergreen` |
| `server/seed.mjs` | ~259 lines. CLI entry — reads CLI flag, runs `seedEvergreen`. | (CLI) |
| `scripts/migrate-claude-changes.mjs` | One-off SQL applied for Claude's recent schema additions. | (CLI) |
| `scripts/migrate-new-tables.mjs` | One-off — recently-added tables. | (CLI) |
| `scripts/migrate-remaining-tables.mjs` | One-off — backfill. | (CLI) |

## Functions

### `server/seed-evergreen.ts`

- **`seedEvergreen(tenantId)`** — Orchestrator. Inserts/updates in
  deterministic order: tenant → orgUnits → persons → users (auth)
  → roles → roleMandates → dependencyChains → plans → metrics →
  feedbackTypes → cycle 0001 → assessmentAssignments. Each step
  idempotent (UPSERT by stable natural key).

### `server/seed.mjs`

- Parses CLI `--tenant=1 --force`. Calls `seedEvergreen`.

## Data Touched

- Writes: every table touched (see above).
- Reads: existence checks (idempotency).

## External Dependencies

- `drizzle-orm`, MySQL.

## Internal Conventions

1. **Idempotent on natural keys** — re-run is safe. Names + slugs
   are the dedup signal (e.g., orgUnit.name unique per tenant).
2. **Two paths for schema changes:**
   - Drizzle Kit (`pnpm db:generate` then `db:push`) — the right
     way going forward.
   - Hand-rolled `scripts/migrate-*.mjs` — historical. Avoid for
     new work.
3. **Seed is OUR source of truth for the Manipal demo** — the
   names, mandates, plans are real fund data. Treat as canon.
4. **`seed-evergreen.ts` and `drizzle/*.sql` MUST stay in sync.**
   When adding a table, regenerate migrations AND extend the seed
   if a default row is needed.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | Schema source of truth. |
| `db-layer.md` | Helper functions used by seed. |
| `infra.md` | DB connection. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| *(all subsystems eventually)* | The seeded data is what runs the app. |

## Fragility Notes

### Three different migration mechanisms

`drizzle/*.sql`, `scripts/migrate-*.mjs`, and seed-time
"create if not exists" branches all evolve schema. **Risk:**
running them in the wrong order creates drift. **Defense:**
Phase 1 Tier B consolidate — kill the one-off shims, run them
once on the live DB, then delete.

### Seed is monolithic

609 lines, hard to test in isolation. **Phase 2** split into
per-concern seed files (`seed/org-tree.ts`, `seed/cycle.ts`,
etc.).

### Stable natural keys assumed

If a person's name changes mid-life, the seed inserts a NEW
person row. **Defense:** seed uses email as the dedup key for
persons.

### No down-migrations

Drizzle Kit doesn't generate down SQL. Rolling back a bad
migration = restore from backup. **Acceptable** (caveat the
team).

### Local-dev seed has more data than prod

Some past commits dumped sample journals + observations into
seed. **Phase 1 Tier B audit:** seed should produce a
"minimum viable tenant" — leaders + mandates + cycle. NOT
journals (those are user-generated).

### Drizzle relations file may drift

`drizzle/relations.ts` is hand-maintained alongside `schema.ts`.
A new FK in schema without relations update breaks Drizzle joins
silently. **Defense:** review both in same PR.

### Hand-rolled scripts have no idempotency guard

`scripts/migrate-*.mjs` may not be re-runnable. Tag with `applied
at` comment + delete after successful run.

### Seed creates users with default password

Audit: confirm seed-created users either have no password (must
SSO) or have rotated passwords before any prod deploy. **Tier A
blocker if applicable.**
