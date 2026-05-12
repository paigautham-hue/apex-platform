# ai-deliberation

> Last updated: 2026-04-21

## Purpose

The **multi-persona AI panel review** — any leader (Chairman, CEO,
CXO) can run a 5-persona AI panel on any subordinate (role,
company, person). Each persona writes a short verdict; a synthesis
pass aggregates them into a recommendation + action list. Fractal:
same engine runs over role / company / person targets.

Per master plan §5.6 — the "deliberation" surface that gives
leaders structured AI second opinions before high-stakes
decisions (continuation, promotion, capital allocation).

## Scope

- Files: 1 server module + 1 router + 1 client component
- tRPC endpoints: 5 (`run`, `get`, `listForTarget`, `listMine`,
  `listPersonas`)
- Tables touched: `aiDeliberations`, `aiPersonaConfigs` + many
  evidence sources

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/ai-deliberation.ts` | ~323 lines. 5 default personas (ADVOCATE / SKEPTIC / RISK / CFO / CULTURE) + synthesis. Parallel persona LLM calls, then a JSON-output synthesis pass. Writes verdict + synthesis + recommendedActions to `aiDeliberations`. | `runDeliberation`, `DeliberationInput`, `DeliberationTargetType` |
| `server/routers/deliberation.ts` | ~147 lines. tRPC router. Authorizes target via `resolveViewerScope` before run/get/list. | `deliberationRouter` |
| `client/src/components/AIDeliberationPanel.tsx` | ~151 lines. UI for triggering a panel + reading verdicts. Renders persona verdicts in a card grid with synthesis + recommended actions block. | `AIDeliberationPanel` |

## Functions

### `server/ai-deliberation.ts`

- **`runDeliberation({ tenantId, triggeredByPersonId, targetType,
  targetId, cycleId? })`** — Orchestrator. Inserts `aiDeliberations`
  row with `status=RUNNING`. Loads personas (tenant-override via
  `aiPersonaConfigs` or default 5). Gathers evidence (recent
  assessments + journals + observations for the target). Fires
  per-persona LLM calls **in parallel** via `invokeLLM`. Builds a
  verdicts block, calls synthesis LLM with `responseFormat:
  json_object`. Writes verdicts + synthesis + recommendedActions
  to the row; marks `COMPLETE` (or `FAILED` on throw).

- **`runPersona(persona, evidence)`** *(internal)* — One LLM call
  per persona with system prompt = `persona.systemPrompt` and user
  message = evidence block. Returns `PersonaVerdict { personaKey,
  personaLabel, verdict, confidence, cited, modelId }`. On error
  returns a `confidence: 0, modelId: 'error'` placeholder so the
  panel doesn't fail entirely.

- **`gatherEvidence(input)`** *(internal)* — Pulls
  governanceAssessments, mandateJournals, observations, persons,
  roles relevant to `targetId`. Caps row counts to stay within
  context window.

- **`loadPersonas(tenantId)`** *(internal)* — If
  `aiPersonaConfigs` has tenant rows, use those; else use the 5
  defaults above.

### `server/routers/deliberation.ts`

- **`run`** — Mutation. Runs auth: viewer must see the target
  (self / subordinate / fund-wide). Synchronous; ~10-30s.
- **`get`** — Query. Authorizes target after fetch (defense in
  depth — a row's targetId is rechecked against viewer scope).
- **`listForTarget`** — Recent panels for a target. Auth-gated.
- **`listMine`** — Panels the caller triggered.
- **`listPersonas`** — Tenant's persona config rows (for the
  Chairman to customise prompts).

## Data Touched

- Writes: `aiDeliberations` (insert RUNNING → update COMPLETE/
  FAILED).
- Reads:
  - `aiPersonaConfigs` — tenant overrides for personas.
  - `governanceAssessments`, `mandateJournals`, `observations`,
    `persons`, `roles` — evidence gathering.

## External Dependencies

- LLM gateway (`invokeLLM`) — 6 calls per run (5 personas + 1
  synthesis).
- `drizzle-orm`.

## Internal Conventions

1. **Parallel persona calls.** Personas don't see each other's
   verdicts — synthesis is the only place verdicts are combined.
   This is deliberate: prevents groupthink-on-LLM.
2. **Synthesis uses `responseFormat: json_object`.** The synth
   prompt asks for `{ synthesis, recommendedActions[],
   consensusNote }`. Caller parses + tolerates missing fields.
3. **Authorisation is target-based.** Viewer must be able to see
   the target person/role/company. Self-panels permitted (a CEO can
   run a panel on themselves).
4. **Status transitions:** RUNNING → COMPLETE | FAILED. No
   intermediate states; clients poll `get` if they want progress.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `ai-llm-gateway.md` | 6 `invokeLLM` calls per run. |
| `db-layer.md` | `getPersonByUserIdOrEmail`, `getRoleById`. |
| `scope.md` | `resolveViewerScope`, `canViewPerson`, `canViewOrgUnit`. |
| `data-model.md` | `aiDeliberations`, `aiPersonaConfigs` schemas. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `chairman-surface.md` | Chairman triggers panels on CEOs / CXOs. |
| `people-pages.md` | PersonProfile hosts `AIDeliberationPanel` for the role. |
| `team-surface.md` | Manager-on-direct-report panels (planned). |

## Fragility Notes

### Synchronous run blocks the client ~10-30s

The mutation doesn't return until all 6 LLM calls complete. A
client navigating away mid-run sees the call abort but the row
still completes server-side (Promise continues). **Defense:**
client shows a spinner + cached optimistic UI. Phase 2 may switch
to async (kick off + poll) for >15s runs.

### Cost per panel is ~6× a single LLM call

5 personas + synthesis = 6 calls per run. At ~$0.02/call =
~$0.12/run. Heavy use compounds quickly. **Phase 1 Tier C** add
a cooldown (e.g. one panel per target per day) and a tenant
monthly budget.

### Persona prompts hard-coded as defaults

`DEFAULT_PERSONAS` lives in source. If a tenant wants different
personas they must populate `aiPersonaConfigs` rows manually — no
admin UI today. **Phase 2** add a Chairman-only persona editor.

### Single failing persona leaves a placeholder verdict

`runPersona` catches errors and returns `confidence: 0,
modelId: 'error'`. The synthesis still runs and includes the
placeholder. **Defense:** synthesis prompt should be updated to
skip zero-confidence verdicts (today it doesn't).

### Evidence gathering trusts target permission, not row-level

`gatherEvidence` filters by `targetId` but doesn't apply
viewer-scope to observations. A Chairman-triggered panel can pull
a peer-CXO's observations even if normal viewing wouldn't allow.
**Acceptable for Chairman** (fund-wide); **problem for non-Chairman
panel triggerers**. Phase 1 Tier B harden.

### No re-run dedup

Triggering `run` twice on the same target creates two rows.
Acceptable today (cheap to reason about), but Phase 2 may add
cooldown + return existing row if recent.

### Synthesis `JSON.parse` failure swallows result

If the LLM returns malformed JSON, `synthesis` becomes the error
string and `recommendedActions` is empty. **Defense:** UI shows
"Synthesis failed — see persona verdicts." Phase 2 add retry with
stricter prompt.
