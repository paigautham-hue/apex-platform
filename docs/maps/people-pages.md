# people-pages

> Last updated: 2026-04-21

## Purpose

The **person-centric UI surface** — `/people` (directory) and
`/people/:personId` (profile). The profile is currently the
biggest page in APEX (~1,600 lines) — it bundles person details,
role/mandate edits, observations timeline, self-appraisal upload
(PACE), AI-deliberation panel, and appraisal compare.

Phase 2's "1:1 prep" feature adds a card here.

## Scope

- Files in this map: 2 pages + 3 supporting components
- tRPC reads/writes: extensive — person, observation, appraisal,
  deliberation, plan, metric

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/People.tsx` | Directory page. Avatar grid + search. ~60 lines. | `People` (default) |
| `client/src/pages/PersonProfile.tsx` | Big profile page. ~1,600 lines. Sections: Header + role + reportsTo (edit mode) + Self-Appraisal upload card + AI deliberation panel + observation timeline + mandate editor + 1:1 prep (planned). | `PersonProfile` (default) |
| `client/src/components/ObservationTimeline.tsx` | Renders observations chronologically with positive/negative/neutral badges. | `ObservationTimeline` |
| `client/src/components/AIDeliberationPanel.tsx` | Multi-step AI reasoning UI for hard decisions (e.g. "what should we focus on for this person?"). Detailed in `ai-deliberation.md`. | (see `ai-deliberation.md`) |
| `client/src/components/AppraisalCompareModal.tsx` | Side-by-side comparison of multiple PACE appraisals for a person across years. | `AppraisalCompareModal` |
| `client/src/components/DataSufficiencyBadge.tsx` | Renders a "data sufficiency" badge (0-4 level) based on `persons.dataSufficiencyLevel`. | `DataSufficiencyBadge` |
| `client/src/components/ProfileViewAudit.tsx` | Diagnostic component for admin-debug of profile rendering. | `ProfileViewAudit` |

## Functions

### `client/src/pages/People.tsx`

- **`People()`** — Top-level. Reads `person.list({ tenantId: 1 })`.
  Filters by search query. Avatar grid. Click → `/people/:id`.

### `client/src/pages/PersonProfile.tsx`

Massive component. Sub-sections defined inline:

- **`SelfAppraisalCard({ personId, tenantId })`** at `:22` — PACE
  appraisal upload zone + listing + extracted-data preview.
  Drag-and-drop file zone. Uploads via
  `appraisal.selfAppraisal.upload` (base64-encoded payload,
  16MB limit). Renders extracted KPI rows, header data,
  competencies.
- **`PersonProfile({ personId })`** at top of `:1` — Main wrapper.
  Reads `person.getById`, `observation.getByPerson`,
  `appraisal.selfAppraisal.list`. Renders:
  - Header (avatar, name, role title, reports-to chip, edit
    mode toggle).
  - Mandate editor (inline edit of `roles.successMetrics`,
    voice input via `VoiceInput.tsx`).
  - Self-appraisal upload card.
  - AI deliberation panel.
  - Observation timeline.
  - Appraisal compare modal trigger.

## Data Touched

- `persons` — read (profile), write (edits).
- `roles` — read+write (mandate edits via `updateRoleMandate`).
- `observations` — read.
- `selfAppraisals` — read+write (upload + delete).
- `paceAppraisals` — read.
- `aiDeliberations` — read+write.

## External Dependencies

- `react`, `wouter`, `lucide-react`, `@radix-ui/*`, `sonner`,
  `framer-motion`.

## Internal Conventions

1. **PersonProfile renders a single person, in 2 modes**: viewer
   = subject (self-view) vs viewer ≠ subject (manager/Chairman
   view). UI elements differ but the same component handles both.
2. **Mandate edits go through `updateRoleMandate`.** Voice input
   is available via the inline `VoiceInput`.
3. **PACE uploads are base64-encoded** and capped at 16MB at the
   client. Server has 50MB cap (see `infra.md`); 16MB is the
   effective ceiling.
4. **The directory (`People.tsx`) is intentionally minimal.**
   Search-and-click; doesn't show metrics inline.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `data-model.md` | Multiple tables. |
| `db-layer.md` | Multiple helpers. |
| `org-tree.md` | `personRouter` endpoints + `updateRoleMandate` + `updateReportsTo`. |
| `voice-capture.md` *(planned)* | `VoiceInput` component. |
| `evidence-upload.md` *(planned)* | Document/upload pattern. |
| `ai-deliberation.md` *(planned)* | `AIDeliberationPanel`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `shell-layout.md` | Page wrapping. |
| `me-surface.md`, `team-surface.md`, `group-surface.md` | All link to `/people/<id>`. |

## Fragility Notes

### `PersonProfile.tsx` is 1,600 lines

A single file with multiple inline sub-components. **High
discoverability cost** — finding a specific behaviour requires
scanning. Phase 1 Tier B candidate: extract sub-components to
separate files (`PersonProfileHeader.tsx`,
`MandateEditor.tsx`, etc.).

### PACE upload happens client-side base64 → server

16MB file → ~22MB base64 string → tRPC payload. Slow on poor
mobile networks. Phase 4 mobile work should switch to
multipart/streaming.

### Mandate edits write `successMetrics` as a whole array

Same fragility as `org-tree.md` "concurrent edits race." Two
people editing mandates simultaneously overwrite each other.

### `getByPerson` for observations doesn't paginate

Returns up to 50 observations. A long-tenured person could have
hundreds of observations. Phase 1 Tier B add pagination.

### Self-appraisal upload doesn't verify the file is actually PACE format

The server accepts any .docx or .pdf, runs AI extraction, and
stores. If the file isn't a PACE appraisal, the extraction
silently returns garbage. Phase 1 Tier B add a confidence-
threshold check and surface "doesn't look like a PACE form" if
extraction confidence is low.

### `1:1 prep` button is planned but not built

The Phase 2 plan adds a "Run 1:1 Prep" button at the top of the
profile that generates a 90-second briefing. **Not in the current
file.**
