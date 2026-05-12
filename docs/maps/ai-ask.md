# ai-ask

> Last updated: 2026-04-21

## Purpose

The **RAG pipeline** — `/ask` is the AI Q&A surface where any
viewer types a natural-language question and gets back an answer
grounded in their permitted slice of APEX data. Parses query →
expands with synonyms → routes to data sources by keyword →
retrieves → reranks → JIT-verifies → generates an answer with
citations.

Per master plan §5.6 AI coaching layer — the conversational
counterpart to the read-only coach card.

## Scope

- Files: 1 page + 1 server module
- tRPC endpoints: 2 (`ask.query`, `ask.getSuggestions`)
- Tables touched: 8+ depending on query routing

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/AskInterface.tsx` | The `/ask` chat interface. Natural-language input, response card with citations, suggested-query chips. Uses `AIChatBox` for streaming display. | `AskInterface` (default) |
| `client/src/components/AIChatBox.tsx` | Streaming chat UI used by AskInterface. | `AIChatBox` |
| `server/ai-ask.ts` | The full RAG pipeline. ~463 lines. `processAskQuery()` runs the 7-step pipeline; `getSuggestedQueries()` returns starter prompts. | `processAskQuery`, `getSuggestedQueries`, `AskQuery`, `AskResponse` |
| `server/routers.ts` (`appRouter.ask.*`) | `query` and `getSuggestions` endpoints. | (mounted) |

## Functions

### `server/ai-ask.ts`

- **`processAskQuery({ question, tenantId, userId, context? })`** —
  The 7-step pipeline:
  1. Parse query (LLM call to extract intent + entities).
  2. Expand with synonyms / related terms.
  3. Route to data sources via keyword matching.
  4. Retrieve evidence (per data source — limited rows per source).
  5. Rerank by relevance.
  6. JIT-verify (check data freshness / quality).
  7. Generate answer with citations via LLM.

- **`routeQuery(expandedQuery)`** — Returns the list of data
  sources to query. Always includes `observations`, `memories`.
  Adds `plans` / `metrics` / `evidence` based on keywords. Phase
  4.1 added governance sources: `governance_assessments`,
  `mandate_journals`, `company_reflections`, `ai_insights`. Note
  `mandate` keyword routes to `mandate_journals` only (Round-2 fix
  removed it from `governance_assessments` to avoid double-source
  fan-out).

- **`getSuggestedQueries(tenantId, userId)`** — Returns ~12 starter
  prompts including governance-aware ones ("Show me the biggest
  perception gaps this month", "Which CEOs have been deferring
  commitments?", etc.).

## Data Touched

Reads (per routing decision):
- `observations`, `memories` (always)
- `plans`, `metrics`, `evidence` (keyword-gated)
- `governance_assessments`, `mandate_journals`,
  `company_reflections`, `ai_insights` (governance keywords)

Writes: none directly. (Phase 2: write AI decisions to
`auditLogs`.)

## External Dependencies

- LLM gateway (`_core/llm.ts`).
- `drizzle-orm` for all the retrieval queries.

## Internal Conventions

1. **Every retrieval limits row count** (50 obs, 100 governance
   assessments, 40 journals, etc.). Don't blow the context window
   on a single source.
2. **Rerank is keyword-based today.** Phase 3 may swap for
   embedding similarity (see Meridian's hybrid retrieval pattern
   in `agentic-memory.md`).
3. **Citations are mandatory.** Every answer must cite at least
   one source row. The `AskResponse.sources` array drives the
   citation UI in `AIChatBox`.
4. **Scope filtering via `tenantId` + viewer scope.** Today most
   retrieval queries filter only by `tenantId` and trust the
   broad ask. **Should** narrow by viewer-scope (don't surface a
   CXO's observations to a peer CXO unless authorised).

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `ai-llm-gateway.md` | `invokeLLM`. |
| `db-layer.md` | All retrieval helpers. |
| `data-model.md` | Every table queried. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `shell-layout.md` | Wraps `/ask`. |

## Fragility Notes

### Retrieval doesn't filter by viewer scope

The retriever filters by `tenantId` but not by what the viewer is
permitted to read. A CXO asking "How is Vishal doing?" can pull
observations about Vishal even if the cascade doesn't authorise
it. **Phase 1 Tier A blocker** — add scope-filtering to retrieval.

### Rerank is naive keyword count

`rerankEvidence` counts keyword occurrences in JSON.stringify(item)
— catches accidental matches in unrelated metadata. Phase 3
embedding rerank fixes this.

### "Show me X" prompts may exceed context window

A query that touches all 4 governance sources retrieves 100+40+20+
30 = 190 rows. Each row stringified is ~500 chars. ~95K chars =
~24K tokens — within Gemini 2.5 Flash's window but tight.
Defense: per-source caps tunable.

### No cost ceiling per user

Heavy users can spam Ask and incur LLM cost. **Open Decision §8 #13.**

### No follow-up / multi-turn

Each query is independent. Conversation memory is on the roadmap
(see `agentic-memory.md`).
