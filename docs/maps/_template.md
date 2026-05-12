# [Subsystem Name]

> **Template — copy this when adding a new subsystem map.** Filename
> starts with `_` so the drift / orphan checks skip it. Don't ship a
> map that's still using template placeholders.
>
> Last updated: YYYY-MM-DD

## Purpose

One paragraph. What does this subsystem **do** from a user / product
lens? Avoid implementation detail here — that goes in Files /
Functions below.

Example (`governance-cycle.md`):

> Implements the monthly governance rhythm: open → log → plan →
> self-rate → leader-rate → reveal → close → calibrate. The state
> machine and access control for every assessment write live here.

## Scope

- Files in this map: `<count>`
- Functions/procedures indexed: see `## Functions` below
- Tables touched: see `## Data Touched` below

> Counts are advisory. The Files / Functions / Data Touched sections
> below are the source of truth.

## Files

| File | Purpose | Key exports |
|---|---|---|
| `path/to/file.ts` | One-line description of why this file exists *in this subsystem*. NOT the auto-extracted first comment of the file. | `exportName1`, `exportName2` |

**Conventions:**
- Wrap each path in single backticks. The drift + orphan checks scan
  for that exact form.
- Purpose is the file's role in **this subsystem**, not its source
  header.
- Key exports: comma-separated identifiers. Tests can list `-`.

## Functions

### `path/to/file.ts`

- `functionName()` at `path/to/file.ts:LINE` — one-line description
  of what the function does. Not a paraphrase of the signature.
  - Signature: `function name(args): ReturnType` (copy from source)
  - Callers: ACTUAL importers / call sites (e.g.,
    `server/routers.ts:processBatch`). Don't list noise. If unexported,
    write `Callers: internal to <enclosing function>.`
  - Dependencies: third-party packages (`zod`, `drizzle-orm`, etc.)
    AND internal modules.
  - Side effects: DB read / DB insert / DB update / DB delete / LLM
    call / external HTTP / S3 write / file I/O / client state
    mutation / timer/background work / none.

> **DO NOT** ship entries with `[NEEDS REVIEW]` or auto-generator
> placeholders. Replace with real prose or drop the entry if the
> function is noise (every inline `useMutation.onSuccess` does not
> deserve its own row — be selective).

## Data Touched

- `tableName` — read / write / read+write context. Annotate:
  - The userId / tenantId scope (`directly` vs `transitively via
    plans.tenantId`)
  - Whether the write is gated by a feature flag
  - Any deploy-order risk (raw-SQL pattern, missing columns)

> Sort alphabetically. Drop tables not actually touched by code in
> this map's scope.

## External Dependencies

- `package-name` — top-level npm packages this subsystem depends on.

> Skip universal deps like `react` unless something specific in the
> subsystem depends on them. Skip `vitest` unless the subsystem owns
> its test fixtures.

## Internal Conventions

Subsystem-specific rules. Examples:

- "Use `server/_core/llm.ts`; do not call provider SDKs directly."
- "Every new tRPC procedure here MUST gate on `isChairmanOrAdmin`."
- "Voice intents declared here must register a JSON schema in
  `voice.classifyIntent`."

## Forward & Backward Dependencies

The single most important practical section. **Lists every cross-
subsystem dependency in both directions** so changes here don't
silently break callers elsewhere.

**This subsystem depends on (Backward — things we read / call):**

| Other subsystem | What we use from it |
|---|---|
| `db-layer.md` | `getPersonByUserId`, `isChairmanOrAdmin` |
| `agentic-memory.md` | `retrieveMemories` (read-only) |

**Other subsystems that depend on this (Forward — things that read /
call us):**

| Other subsystem | What they use from us |
|---|---|
| `me-surface.md` | calls `governance.getActiveCycle`, reads `assessment` data |
| `chairman-surface.md` | calls `governance.updateCycleStatus` |

> Both lists must be kept in sync. When a forward dependency is added
> in another subsystem's map (their Backward list), the corresponding
> Forward entry MUST land here in the same commit.

## Fragility Notes

> **The most important section.** Document non-obvious coupling,
> known traps, deploy-order risks, race conditions, and "this looks
> fine but breaks if X" gotchas. **Never ship a map with only the
> placeholder "Non-obvious coupling. Add entries as discovered." —
> a Fragility-Notes-only-placeholder map is the #1 audit failure
> pattern.**

### `<concise title of the gotcha>`

A few sentences explaining the gotcha, when it bit us, and the
defense:

> Example: "Cycle state machine transitions trigger
> `governanceNotifications.notifyCycleOpen` synchronously inside the
> tRPC mutation. If the notifications fan-out becomes slow (it's
> fire-and-forget now), revisit; for now the `void
> .catch(() => {})` is intentional."

Add new entries as discovered. Old entries stay unless the gotcha is
demonstrably gone (with a PR link).
