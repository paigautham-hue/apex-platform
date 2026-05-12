# evidence-upload

> Last updated: 2026-04-21

## Purpose

The **document upload pipeline** — files (Word, PDF, screenshots,
emails, financial reports) attached to `evidence`, `financialUploads`,
or `selfAppraisals`. Each upload goes through AI extraction
(`server/ai-extraction.ts`) to surface structured data alongside the
raw file.

## Scope

- Files: 2 client pages + 1 helper + 2 server modules
- Tables touched: `evidence`, `financialUploads`,
  `financialTemplates`, `selfAppraisals`, `paceAppraisals`

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/EvidenceUpload.tsx` | Generic evidence upload page. Drag-and-drop, file picker, type selector (SCREENSHOT/EMAIL/DOCUMENT/etc.), upload to S3, kick off AI extraction. | `EvidenceUpload` (default) |
| `client/src/components/DocumentUpload.tsx` | Reusable drag-and-drop card. Used inline in PersonProfile (SelfAppraisalCard) and FinancialCockpit (upload actuals). | `DocumentUpload` |
| `server/ai-extraction.ts` | The extraction pipeline. Detects file type, runs AI (LLM or vision), returns structured `extractedData` JSON. | `extractFromFile` |
| `server/storage.ts` | S3 upload + presigned URL generation. | `storagePut`, `generatePresignedUrl` |
| `server/routers.ts` (`appRouter.financial.*` evidence sub-router + `appraisal.selfAppraisal.*`) | Endpoints: `evidence.list`, `evidence.upload`, `financial.createUpload`, `financial.checkDuplicate`, `appraisal.selfAppraisal.upload/list/delete`. | (mounted) |

## Functions

### `client/src/pages/EvidenceUpload.tsx`

- **`EvidenceUpload()`** — Generic upload page. Reads
  `evidence.list`, mutates via `evidence.upload`. Renders a drag-
  and-drop zone + a list of uploaded evidence + per-row preview of
  extracted data.

### `client/src/components/DocumentUpload.tsx`

- **`DocumentUpload({ onUpload, accept, maxSizeBytes, label })`** —
  Reusable drag-and-drop card. Encapsulates the file → base64 →
  POST flow. Used by PersonProfile SelfAppraisalCard and
  FinancialCockpit.

### `server/ai-extraction.ts`

- **`extractFromFile({ fileBuffer, mimeType, hintType? })`** —
  Multi-modal pipeline:
  - PDF / Word → text via `mammoth` (DOCX) or PDF parser, then LLM
    summarisation with a JSON schema appropriate to `hintType`.
  - Image (screenshots) → vision LLM, then JSON extraction.
  - Returns `{ extractedData, confidenceScores }`.

## Data Touched

- `evidence` — read+write.
- `financialUploads`, `financialTemplates` — read+write.
- `selfAppraisals`, `paceAppraisals` — read+write.

## External Dependencies

- `mammoth` (DOCX to text).
- `docx` (DOCX generation, for export not upload).
- AWS S3 SDK via `server/storage.ts`.
- LLM gateway.

## Internal Conventions

1. **All uploads are deduped by `fileHash`** (SHA-256). The
   `financialUploads` table enforces this; `evidence` doesn't yet.
2. **AI extraction is async-ish** — the upload returns
   immediately; extraction is fire-and-forget. The client polls
   for `extractedData` completion via the row's `processedAt`
   timestamp.
3. **PACE appraisals have their own table** (`paceAppraisals`)
   for the form template, distinct from `selfAppraisals` for
   user submissions.
4. **16MB client-side limit, 50MB server-side limit** for any
   single upload.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | All 5 tables. |
| `db-layer.md` | `createEvidence`, `createFinancialUpload`, `checkDuplicateUpload`, `createFinancialTemplate`, etc. |
| `ai-llm-gateway.md` *(planned)* | LLM call from extraction pipeline. |
| `infra.md` | 50MB body-parser limit, S3 storage config. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `people-pages.md` | PersonProfile.SelfAppraisalCard. |
| `financial-cockpit.md` | Financial actuals upload. |
| `me-surface.md` *(via Capture page)* | Evidence upload as a capture-intent target. |

## Fragility Notes

### AI extraction confidence isn't surfaced to the user

Extraction returns `confidenceScores` per field but the UI doesn't
show "low confidence — please verify" markers. A user uploading a
malformed PACE form sees structured data that may be wrong.
Phase 1 Tier B polish: surface low-confidence fields.

### Dedup is per-tenant, not global

`fileHash` matches within tenant only. Two tenants uploading the
same file each get their own row. Correct behaviour, but worth
knowing for storage cost calculations.

### S3 storage cost is unbounded

No retention policy. Old PACE appraisals from 5 years ago still
live in S3. Master plan §3.10 audit-log retention specifies 7
years for audit logs; uploads should be similar (Open Decision
§8 #11).

### Extraction has no rate limit

A user can upload 50 files in quick succession and pin the LLM
gateway. Phase 1 Tier C: queue extraction jobs, return immediately
with a "processing" indicator.

### `DocumentUpload` doesn't show progress for large files

A 15MB PACE upload takes ~10s on poor mobile networks. The user
sees a spinner with no progress bar. Phase 4 mobile work: add
upload progress.

### Vision-LLM cost on screenshot extraction

Screenshots go through a vision model. Per-screenshot cost is
higher than text extraction. **Open Decision §8 #13** LLM cost
ceiling — needs monitoring before Phase 3.
