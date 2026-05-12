# agentic-memory

> Last updated: 2026-04-21

## Purpose

The **AI long-term memory store** — categorised, org-scoped
memories about people / companies / functions, retrieved via
hybrid (semantic + recency + confidence + category) scoring.
Phase 1 minimal port from Meridian's `agentic-memory.ts`; Phase 3
hardens it to Meridian-grade (bi-temporal, write-time consolidation,
quality scoring, monthly compaction).

Per master plan §5.5 — every AI surface that says "the user
told me X last week" or "this CEO usually defers commitments
about Z" reads from here. User has hard-delete rights on memories
about them (§5.5 trust contract).

See `MERIDIAN_REFERENCE.md` §3 for the full Meridian schema we're
porting from incrementally.

## Scope

- Files: 1 server module + 1 router
- tRPC endpoints: 5 (`store`, `retrieve`, `aboutMe`,
  `pendingVerification`, `verify`, `update`)
- Tables touched: `agenticMemories`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/agentic-memory.ts` | ~313 lines. Store with embedding-based dedup (cosine ≥ 0.92 merges into existing row). Hybrid retrieval. Verification flow. Embedding via Forge `/v1/embeddings` (`text-embedding-3-small`); keyword fallback when no embedding. | `generateEmbedding`, `storeMemory`, `retrieveMemoriesHybrid`, `formatMemoriesForPrompt`, `verifyMemory`, `MemoryCategory`, `OrgScope` |
| `server/routers/memory.ts` | ~233 lines. tRPC router with scope-gated CRUD + verify. Default subject filter prevents broad retrieval — non-fund-wide viewers retrieving without `subjectPersonId` get scoped to themselves. | `memoryRouter` |

## Functions

### `server/agentic-memory.ts`

- **`generateEmbedding(text)`** — POSTs to Forge `/v1/embeddings`
  (`text-embedding-3-small`). Returns `number[]` or `null` on
  failure / missing key / empty text. Caller treats null as "fall
  back to keyword matching."

- **`storeMemory(input)`** — Two-stage dedup:
  1. **Exact-hash dedup** — `sourceHash =
     sha256(category|memoryKey|memoryValue)`. If exists → return
     existing id, `deduped: true`.
  2. **Embedding near-dup** — generate embedding, compare cosine
     vs candidates in same `(tenant, category, orgScope)`. If
     ≥ 0.92 → merge citations + bump confidence on existing row,
     return existing id.
  3. Otherwise insert new with `needsVerification: true`.

- **`retrieveMemoriesHybrid(opts)`** — Pulls candidates filtered
  by `tenantId` + optional `subjectPersonId` + `subjectOrgUnitId`
  + `orgScopes` + `categories`, **excludes expired**. Scores each
  via weighted blend (semantic 0.6 + confidence 0.2 + recency 0.1
  + category 0.1). Returns top-N. Falls back to keyword overlap
  when no embedding.

- **`formatMemoriesForPrompt(memories)`** — Groups by category,
  returns markdown ready for LLM prompt injection (`**FACT:**\n-
  key: value`).

- **`verifyMemory(memoryId, verifierPersonId, approve)`** —
  Approve → set `verified=true, needsVerification=false`. Reject →
  hard delete. Auth happens at the router level.

### `server/routers/memory.ts`

- **`store`** — Mutation. Auth: caller must `canViewPerson` for
  `subjectPersonId` (or `canViewOrgUnit`). FUND-scope writes
  require `scope.isFundWide`.
- **`retrieve`** — Query. Same auth as store. **Defensive
  default:** if non-fund-wide caller omits `subjectPersonId`,
  defaults to caller's own person id (prevents accidental broad
  retrieval).
- **`aboutMe`** — Returns memories where `subjectPersonId =
  caller`. The "memories about me" inbox per §5.5.
- **`pendingVerification`** — Returns `needsVerification=true`
  rows filtered to subjects the caller has authority over.
- **`verify`** — Approve or reject (delete). Caller must be the
  subject OR have authority over the subject. **Subject can
  always delete their own memories** (the §5.5 hard-delete right).
- **`update`** — Edit value / confidence. Same auth as verify.

## Data Touched

- Reads + writes `agenticMemories`.

## External Dependencies

- Forge `/v1/embeddings` (`text-embedding-3-small`). Optional —
  store/retrieve degrade gracefully to keyword matching.
- `drizzle-orm`, `node:crypto` (sha256 for sourceHash).

## Internal Conventions

1. **`sourceHash` is the exact-dedup key** —
   `sha256(category|memoryKey|memoryValue)`. Don't include
   citations in the hash (they accumulate over time).
2. **`needsVerification: true` is the default.** Every new
   AI-generated memory is unverified until a human approves. UI
   surfaces only verified memories by default.
3. **Hard-delete on reject.** Per §5.5, memories about the
   subject cannot be soft-retained after the subject says no.
4. **FUND scope is privileged.** Writes/retrievals at FUND scope
   require `scope.isFundWide` — i.e., Chairman / Admin.
5. **Confidence is stored as a string** (Drizzle decimal). Always
   cast with `Number()` on read.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `infra.md` | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` for embedding endpoint. |
| `db-layer.md` | `getPersonByUserIdOrEmail`, `getPersonById`. |
| `scope.md` | `resolveViewerScope`, `canViewPerson`, `canViewOrgUnit`. |
| `data-model.md` | `agenticMemories` schema. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `ai-ask.md` *(planned wire-up)* | Phase 3 — RAG pipeline reads relevant memories for prompt injection. |
| `ai-deliberation.md` *(planned)* | Persona evidence-gathering reads memories. |
| `voice-realtime.md` *(planned)* | Realtime voice session warm-starts with retrieved memories. |
| `me-surface.md` *(planned)* | `/memory` verification surface (Phase 3). |

## Fragility Notes

### No write-time consolidation (Meridian-grade)

Today: dedup is per-write (exact hash + cosine 0.92). Meridian's
fuller pattern compacts a category to ≤ K rows by clustering at
write-time. Without this, the store grows linearly. **Phase 3**
port the consolidation routine from `MERIDIAN_REFERENCE.md §3`.

### No bi-temporal versioning

A memory edit overwrites the value in place. We lose the prior
value. Meridian stores `validFrom` / `validTo` for time-travel
queries (e.g., "what did we believe about Vishal in Q1?").
**Phase 3** add bi-temporal columns and `update` writes a new row
rather than mutating.

### No quality-scoring scheduler

Meridian has a nightly job that recomputes confidence based on
contradiction signals, age, and access frequency. APEX doesn't
yet — confidence is static after write. **Phase 3** port the
scheduler.

### Embedding is a remote call on every store

`storeMemory` blocks on `generateEmbedding` for near-dup check.
If Forge is slow, every memory write is slow. **Defense:**
Forge timeout via `fetch` default (no explicit cap today — add).
Phase 3 batch embed.

### Embedding stored as JSON number array

`embeddingVector: number[]` is JSON-serialised in MySQL. ~6KB
per memory (1536 dims × 4 chars). At 10K memories ~60MB, which
isn't huge but the cosine scan loads up to 200 rows × 6KB =
1.2MB per retrieve. **Phase 3** vector index (pgvector or
external service).

### Keyword fallback is coarse

When embedding fails, scoring uses token-hit ratio against
key+value. Misses synonyms, misspellings, paraphrase. **Defense:**
keyword fallback is a "better than zero" path; should not be the
default. Monitor `forge embeddings` error rate.

### `pendingVerification` doesn't expose memories with no subject

A FUND-scope memory has `subjectPersonId=null`. The
fund-wide-allowed branch returns all pending rows; the
person-scoped branch filters by `inArray(subjectPersonId,
allowed)`. **Edge case:** null subjects (org-unit-scoped) won't
match `inArray` → invisible to non-fund-wide verifiers.
**Acceptable today** — only Chairman writes FUND-scope memories.

### Hard-delete on reject loses audit trail

Per §5.5 contract this is intentional, but it means we can't
reconstruct "what was the rejected memory." **Defense:** Phase 2
AuditLogger captures the value at delete time in `auditLogs`
before the row is removed.

### Default subject in `retrieve` could mask data

Non-fund-wide caller omitting `subjectPersonId` is silently
scoped to themselves. If a manager *thinks* they're querying
broadly but isn't, results look empty. **Defense:** UI surfaces
the effective scope ("Searching: about you"). Phase 2 add this
hint.
