# ai-llm-gateway

> Last updated: 2026-04-21

## Purpose

The **single chokepoint for every LLM call in APEX.**
`server/_core/llm.ts` exposes `invokeLLM()` which every AI surface
(ask, review, commitment, insights, deliberation, voice intent,
extraction) goes through. Centralised so we can swap providers,
add caching, enforce rate limits, and log AI decisions per master
plan §3.9.

## Scope

- Files in this map: 1 (`server/_core/llm.ts`)
- Provider integrations: Gemini (default), with provider-agnostic
  interface

## Files

| File | Purpose | Key exports |
|---|---|---|
| `server/_core/llm.ts` | `invokeLLM({ messages, response_format?, tools?, ... })`. Provider-agnostic wrapper. Reads `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY` from env. Supports structured JSON output via `response_format: { type: 'json_schema', json_schema: {...} }`. | `invokeLLM`, `InvokeParams`, `InvokeResult`, `Message` |

## Functions

### `invokeLLM(params)`

- **Signature:** `invokeLLM({ messages, model?, tools?,
  tool_choice?, response_format?, temperature?, max_tokens? }):
  Promise<{ choices: [{ message: { content, tool_calls? } }] }>`
- Defaults model to `gemini-2.5-flash`.
- Throws if `BUILT_IN_FORGE_API_KEY` not set.
- Caller responsibility: input messages array, validate output
  shape if expecting structured.

## Data Touched

None directly. Downstream consumers write their own outputs to
varied tables.

## External Dependencies

- Forge API (proxy for Gemini / OpenAI / Anthropic — env-configured).

## Internal Conventions

1. **Every AI call goes through `invokeLLM`.** Don't call OpenAI,
   Gemini, or Anthropic SDKs directly anywhere in the codebase.
2. **Structured output is preferred** for any AI surface that
   produces typed data. Use `response_format: { type:
   'json_schema', json_schema: { strict: true, schema: {...} } }`.
3. **Temperature defaults to provider default.** Override
   explicitly when the surface needs determinism (commitment
   classifier) or creativity (coach summaries).
4. **`max_tokens` defaults to provider default.** Set when prompt
   compression matters (system prompts in voice realtime).
5. **Per master plan §3.9** every call should eventually log
   model + prompt hash + output + confidence + downstream action
   to `auditLogs`. Phase 2 wires the AuditLogger; not done today.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `infra.md` | `ENV.forgeApiUrl`, `ENV.forgeApiKey`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `ai-ask.md` | RAG pipeline calls `invokeLLM`. |
| `ai-review.md` | Living review draft generation. |
| `ai-commitment.md` | Classifier. |
| `ai-insights.md` | Insight generator. |
| `ai-deliberation.md` | Multi-step reasoning. |
| `voice-capture.md` | Intent classification. |
| `evidence-upload.md` | Document extraction. |
| `agentic-memory.md` *(planned)* | Memory enrichment + retrieval re-ranking. |

## Fragility Notes

### Single-provider lock-in via Forge

Forge is Manus's API proxy. If it goes down, every AI surface
fails. **Mitigation:** none today. Phase 2 observability work
should log Forge errors structured so we know when it's degraded.

### No cost tracking

LLM calls aren't priced or counted. Per Open Decision §8 #13 LLM
cost ceiling — needs monitoring before Phase 3 multiplies the
call rate.

### No prompt-cache layer

Identical prompts (e.g. the daily commitment-tracker checking the
same journals) re-call the LLM. Phase 3 should add a prompt-cache
layer keyed on hash. Meridian's `_core/promptCache.ts` is the
reference.

### Structured-output JSON schema strictness varies by provider

`response_format` works well with Gemini but not all providers
support the same shape. If Forge ever routes to a different
backend, structured output may degrade. **Defensive coding:**
every caller validates the output shape with Zod or manual checks
before consuming.

### No retry on transient failures

A single 503 from Forge fails the AI call. **Phase 2** add
retry-with-backoff (3 attempts, 100ms/500ms/2s).
