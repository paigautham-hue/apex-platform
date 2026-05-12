# APEX — Master Plan

> The strategic source of truth for APEX. Every contributor (human or
> agent) reads this first. Every direction change updates this file in
> the same commit as the code change.
>
> Last updated: 2026-04-21 (v3 — added §3.10 Security baseline, §4
> routine/non-routine definition + IC detail + measurement plan, §5.3
> cascade reading rule, §5.7 notification channel matrix + quiet hours,
> §5.8 RBAC tightening, Phase 1 sub-prioritization, §8 owners +
> decide-by dates + 2 new decisions, §10 Success Metrics, §11 Risk
> Register, §12 Plan Change Process, §13 Glossary; principle "Failure
> modes are designed" renumbered to §3.11)

---

## 0. What this document is

This is the end-state vision for APEX and the phased path to get there.
It is opinionated and exclusionary — it documents what APEX **is**, what
it **is not**, and what we will deliberately defer or refuse to build.

When this file and the code disagree, **this file wins** until the code
catches up. When this file and a subsystem map (`docs/maps/*.md`)
disagree on day-to-day truth, the map wins for *that subsystem*, and
this file gets updated to reflect the new direction.

---

## 1. End-State Vision

> APEX is the cascading, voice-first, AI-coached **performance operating
> system** for the Manipal Evergreen Fund and the 13 portfolio companies
> it governs.

When APEX is done:

- **The same monthly rhythm runs at every leader↔reports layer.** The
  Chairman runs it on the MD, CXOs, and portfolio CEOs. Each portfolio
  CEO runs it on their leadership team. Each function head runs it on
  their managers. Each manager runs it on their ICs. **One pattern.
  Many scopes.**
- **Voice is the primary interface.** A senior leader on a phone in a
  car can log progress, plan next month, self-rate, capture an
  observation, query a peer's status, or write guidance — all by
  speaking, in under 5 minutes per cycle.
- **The AI has memory.** It remembers what you said last cycle, what
  patterns it has noticed about you, what your Chairman said three
  cycles ago. Every coaching conversation builds on the last. Memory
  is auditable — you can see what the AI knows about you, edit it,
  delete it.
- **The AI is a coach, not a prescriber.** It surfaces patterns and
  asks targeted questions. It does not tell you what to do. It does
  not score you — only humans score humans.
- **Multi-scope analytics, one UI.** Fund analytics for the Chairman /
  MD. Company analytics for each CEO. Function analytics for each CXO.
  Team analytics for each manager. Person analytics for any leader on
  their report. Same modules, scoped data.
- **Trust is explicit.** Every piece of data shows who can see it,
  who wrote it, when it was last verified, what cycle it came from.
  Privacy badges are everywhere. Provenance is one click away.
- **Mobile-native.** Capacitor-wrapped iOS app. Lock-screen control
  of active voice sessions. Push notifications that actually deliver.
  PWA on Android.
- **Calibration is a ritual, not an emergency.** AI prepares the
  calibration meeting with inconsistencies, edge cases, evidence —
  CHRO and Chairman walk through the brief, not raw data.

### Target population

- **27 fund-level users:** 1 Chairman, 1 MD, 11 CXOs, 13 portfolio
  CEOs, plus the support roles (Chief of Staff, Sagar, etc.).
- **~150 company-level users** as the cascade lands: each portfolio
  company's 5-8 person leadership team.
- **~500 users at full saturation** if the cascade extends to
  function/team heads inside portfolio companies.

APEX is **not** built for 5,000+ user enterprises. It's built for the
specific shape of a holding-company governance structure with ~500
total monthly users at the outside.

**Beyond ~500 users** (multiple holding companies, or MEF growing past
its current portfolio): APEX does not scale by adding nodes. It scales
by becoming multi-tenant in the conventional sense — separate
deployments, separate data planes, SSO federated to the holding
company's IdP, an audit-log retention policy that meets the regulatory
ask of the strictest jurisdiction in scope. That work is Phase 5+ and
requires the readiness checklist in §6 to land first.

---

## 2. Current State (as of 2026-04-21)

The gap between where APEX is now and the end-state above. This section
is the anchor: every Phase milestone is a delta against this snapshot.
**Update this section whenever a major capability ships or a known tech
debt is paid down.**

### ✅ Built and stable

- **Identity, org tree, multi-tenant schema.** `users`, `tenants`,
  `persons`, `orgUnits` (with hierarchy via `parentOrgUnitId`), `roles`
  (with `reportsToRoleId`). Every table has `tenantId`.
- **Governance cycle schema + machinery.** 9 governance tables
  (`feedbackTypes`, `governanceCycles`, `governanceAssessments`,
  `assessmentAssignments`, `mandateJournals`, `companyReflections`,
  `chairmanGuidance`, `dependencyChains`, `aiInsights`). State machine
  DRAFT → OPEN → CLOSED → REVEALED. Cycle CRUD, assessment CRUD,
  assignment generation by rule (self/chairman/peer/upward) all wired
  through `server/routers.ts:governanceRouter`.
- **Chairman flow end-to-end.** `ChairmanDashboard` (KPIs, zone health,
  perception gaps, chain health, chronic deferrals, AI insights),
  `ChairmanAssess` (blind assessment per dimension), `GovernanceAdmin`
  (cycle launch, assignment generation, feedback-type config).
- **`/me`, `/team`, `/group` fractal pages.** `Me.tsx`, `Team.tsx`,
  `Group.tsx` render the same rhythm UI scoped by viewer tier. Driven
  by `useViewer()` + `server/scope.ts`.
- **MyBridge + MyIsland.** CXO mandate cards (`Log` / `Plan` /
  `Self-rate` / `Chairman view` tabs) + CEO 6-dimension Island with the
  5-field reflection form. Plan-to-log tracking via prior-cycle journal
  fetch.
- **Financial Cockpit.** 13 portfolio companies, FY27 budget vs YTD
  actuals, inline-edit Q1-Q4 actuals (gated by `canEditCompanyFinancials`
  to that company's CEO or Chairman/Admin), variance bands.
- **360 Feedback hub.** `ThreeSixty.tsx` with radar chart (stable
  `type_{feedbackTypeId}` dataKeys), per-feedback-type aggregation,
  blind-feedback handling.
- **Voice tap-to-talk capture.** `Capture.tsx` + `server/ai-voice-intent.ts`
  + `server/routers/voice.ts`. Web Speech API + LLM intent
  classification + parse → confirm flow.
- **Trust & access control.** `accessGrants`, `accessChallenges`,
  `AccessGrants.tsx`, `AccessChallenge.tsx`, `TrustInbox.tsx`,
  `server/routers/accessControl.ts`. Revoke + challenge + admin
  resolution workflows.
- **Notifications.** `notifications` table, `server/governance-notifications.ts`,
  `NotificationCenter.tsx`, browser push wired. Per-user preferences
  (`userPreferences` table, `NotificationPreferences.tsx`).
- **Onboarding wizard.** `Onboarding.tsx` 5-step flow with
  `FirstCycleWelcome.tsx`. DashboardLayout auto-redirects when
  `checkOnboarding` returns `{completed: false}`.
- **AI surfaces — primary.** `server/ai-ask.ts` (RAG over governance
  data), `server/ai-insights-generator.ts` (5 insight categories at
  cycle close), `server/ai-commitment.ts` (chronic-deferral detection),
  `server/ai-review.ts` (legacy review draft generation),
  `server/ai-deliberation.ts` + `AIDeliberationPanel.tsx`.
- **Rhythm engine.** `server/rhythm-engine.ts` + `server/routers/rhythm.ts`.
  Computes daily focus for `PrimaryActionCard` — uses cycle state,
  assignment status, journal completion, and AI insight severity.
- **Dark oceanic theme.** Ship-metaphor visual identity. Default theme.
- **Evergreen Fund seed.** `server/seed-evergreen.ts` — 1 chairman,
  1 MD, 11 CXOs, 13 portfolio companies, 5 dependency chains, 3
  feedback types. Idempotent.
- **Documentation & MAPS discipline.** `MASTER_PLAN.md` (this file),
  `PROJECT_MAP.md`, `docs/maps/_template.md`, `MERIDIAN_REFERENCE.md`.
  Pre-push hook (`.husky/pre-push`) runs `check-map-drift.mjs` +
  `check-map-orphans.mjs` in strict mode.

### 🟡 Built but needs hardening

- **Agentic memory.** `server/agentic-memory.ts` (313 lines),
  `server/routers/memory.ts` (233 lines) exists. Schema and retrieval
  are basic. Phase 3 expands to Meridian-grade (confidence decay,
  contradiction detection, dedup, bi-temporal, provenance, embeddings,
  verification UI). See `docs/MERIDIAN_REFERENCE.md` §3.
- **Voice intent + dispatch.** Functional but one-shot — no multi-turn
  dialogue, no destination-confirmation card after AI routing. Trust
  hinge for voice. Phase 2 expansion.
- **`/today` vs `/me`.** Two surfaces overlap; need explicit distinction
  (`/today` = daily focus, `/me` = monthly workspace). Phase 1.
- **Empty states.** Some pages have them, others bare-render. Phase 1
  unifies via shared `EmptyState` component.
- **Submit flows.** No confirmation modal on Submit Month for
  MyBridge/MyIsland. Risk of accidental submission. Phase 1.

### 🚧 Partially built

- **Cascade.** `roles.reportsToRoleId` exists in schema but the cascade
  isn't fully realized: `/team`'s "Assess your team" tab doesn't exist
  yet; `canAssessTarget` helper doesn't exist yet; chairman-only RBAC
  checks (`isChairmanOrAdmin`) gate most write paths. Phase 1 generalizes.
- **Calibration.** `calibrationSessions` table is in the schema but no
  UI surfaces it. CHRO has no calibration workflow today. Phase 4.

### ⏳ Planned but not started

- **Continuous duplex voice agent.** No WebRTC + Realtime API today.
  Phase 4.
- **Mobile native (Capacitor + iOS).** Web-only today. Phase 4.
- **1:1 prep agent.** Phase 2.
- **AI coach card on `/me`.** Phase 3.
- **Communication style memory for Chairman.** Phase 3.
- **Unified `/analytics` with scope picker.** Phase 5+ (after cascade).
- **SSO/SAML, MFA, formal audit log retention policy.** Phase 5+,
  triggered by adding the second holding company or by external audit.

### 🔴 Known tech debt

These are explicit, ranked by blast radius:

1. **`TENANT_ID = 1` hardcoded in ~9 client files.** Documented
   violation of principle §3.6 (tenant isolation) and §3.4 (multi-tenant
   via scope). Acceptable while MEF is APEX's only tenant. **Must be
   addressed before APEX is offered to a second holding company.**
   When triggered: extract `tenantId` from auth context
   (`useViewer().tenantId`) on the client; require `tenantId` in every
   tRPC input that touches tenant-scoped data; remove the constant from
   every page. See §8 Open Decisions for the trigger criteria.
2. **Legacy review tables coexist with governance cycle tables.**
   `assessments`, `reviews` (the old MILESTONE/QUARTERLY/ANNUAL flow)
   still drive `Reflections.tsx`, `ReviewDraftPreview.tsx`. We chose to
   keep them while the new governance cycle stabilises. Reconcile when
   the cascade is real and the new flow has 3+ months of clean data.
3. **No structured observability today.** `console.log` / `console.warn`
   sprinkled across server modules. No metrics, no traces, no per-user
   activity log beyond `auditLogs`. Principle §3.9 commits us to fix
   this; concretely scoped in Phase 2.
4. **Notification fan-out is per-event, not digested.** Phase 1
   replaces this with a daily digest.
5. **Voice classifier confidence isn't surfaced to the user.** Trust
   hinge. Phase 2 fixes alongside the destination card.

---

## 3. Non-Negotiable Principles

Principles 1-8 are listed in order of priority when they collide.
Principles 9-11 are enabling principles — they apply across all the
above rather than collide with them.

1. **Privacy & trust scaffolding before features.** Every new write
   must answer: who can see this, when does it become visible, what
   cycle does it belong to, who wrote it, when was it last verified.
   If a feature can't answer those questions cleanly, the feature
   doesn't ship.

2. **One pattern, many scopes (cascade).** A new feature must not be
   "Chairman-only" or "CEO-only" unless there is a structural reason.
   The default is: any leader can do this on their reports. Scope is
   a parameter, not a hardcode.

3. **Voice-first inputs.** New write surfaces ship with a voice path
   alongside the form. The voice path uses the existing `voice.*`
   pipeline and respects the parse → preview → confirm contract.

4. **Multi-tenant via scope, not via separate DBs.** APEX is one
   tenant (Manipal Evergreen Fund). Companies are `orgUnits` with
   scope-aware queries. We will not split into per-company databases.

5. **AI is a coach, not a prescriber, not a scorer, not a ranker.**
   - AI surfaces patterns ("Two cycles ago your gap on Margin was 3;
     this cycle it's 1. The pattern is closing.").
   - AI **never** rates people. Only humans rate humans.
   - AI **never** ranks people. Ranking is a softer form of rating
     that's just as politically charged.
   - AI never says "you should do X." It asks "is this what you're
     seeing?"

6. **Tenant isolation is a hard invariant.** Every read and write
   filters by `tenantId`. No id-only lookups. No "I'll add the filter
   later." Reviewed every PR. (Known tech debt: §2's `TENANT_ID = 1`
   client hardcoding — acceptable until trigger event.)

7. **Monthly rhythm is the heartbeat.** Daily and weekly UIs serve the
   monthly cycle. We do not add quarterly-only or annual-only features
   without anchoring them in a monthly equivalent.

8. **MAPS-first workflow.** Before changing code, read the relevant
   subsystem map. After changing code, update the map in the same
   commit. The `check-map-drift` hook enforces this on push.

9. **Observability is a feature.** Every meaningful event in APEX
   produces a record:
   - Every write logs `(actor personId, action verb, target type+id,
     tenantId, timestamp, optional reason)` to `auditLogs`.
   - Every AI decision (intent classification, insight generation,
     coach card content, voice-route destination) logs the model
     version, prompt hash, output, confidence, and downstream action.
   - Every RBAC denial logs `(actor, attempted action, denied reason)`.
   - Slow queries (>500ms) emit a warning with the SQL fingerprint.
   - These records support debugging, calibration, and the future
     audit-trail UI that lets a user see "what did the AI do with what
     I said?"
   
   The audit-log surface is **not optional** for new features. If a
   feature can't tell you what it did and why, it's not ready.

10. **Security has a baseline.** A short, concrete list — not a vague
    aspiration:
    - **Authentication:** SSO/SAML federation when a second holding
      company onboards. Until then, the existing JWT-cookie flow stays.
    - **MFA:** required for any user with admin role OR with the
      Chairman/Group-CEO role. Optional but encouraged for all others.
    - **Session timeout:** 12-hour idle for fund-level users; 1-hour
      idle for sensitive admin pages (`/governance-admin`,
      `/admin`).
    - **Audit log retention:** 7 years for `auditLogs` rows referencing
      financial actuals, assessments, guidance, or memory deletes.
      90 days for everything else. Stored in immutable form
      (append-only table, no UPDATE/DELETE except by a documented
      retention-policy job).
    - **Data classification:** every column in `drizzle/schema.ts` is
      tagged in a comment as `PUBLIC` / `INTERNAL` / `RESTRICTED` /
      `CONFIDENTIAL`. Financial actuals and chairman guidance are
      CONFIDENTIAL. Person observations are RESTRICTED. Org-unit
      structure is INTERNAL.
    - **Sensitive operations** (revoke access grant, hard-delete
      memory, change a person's `tenantId`, escalate to admin role):
      require 2FA confirmation when MFA is enabled.
    - **Backups:** nightly DB snapshot retained 30 days; weekly retained
      1 year. Restore tested quarterly.

    These are minimums. Tighter requirements (e.g. data residency in
    India) come from individual deployments and are layered on top.

11. **Failure modes are designed.** Every async path has a defined
    failure behavior:
    - **LLM down or rate-limited:** Voice classifier falls back to a
      keyword router or a "we couldn't understand — pick a destination"
      form. AI coach cards show the last-cached summary with a
      "refreshing…" indicator. Insight generation queues and retries.
    - **Voice misclassification:** Two-step parse → preview → confirm
      gives the user a veto. Low-confidence parses *require* a confirm
      tap; high-confidence ones allow a quick implicit confirm.
    - **DB down:** Read endpoints return 503 with a "service degraded"
      banner; write endpoints reject explicitly. No silent partial
      writes.
    - **Notification fan-out failure:** Per-user delivery records exist
      so we know which delivery failed. Retry semantics are explicit.
    - **Voice session timeout:** Continuous duplex agents resume via
      session-handle pattern (Gemini Live's pattern). State is
      reconciled, not lost.
    - **Cycle deadline passed without submission:** No data loss. User
      sees "late submission" badge. Chairman can still see the late
      submissions in the calibration brief.
    - **Memory contradiction:** Bi-temporal `invalidatedAt` instead of
      destructive overwrite. The user can see both versions and choose.
    
    "It works on the happy path" is not a shipped feature.

---

## 4. Personas & Frictionless Flow Targets

A "frictionless" flow means **minutes between intent and outcome** —
how long it takes a persona to go from opening APEX to having
accomplished the task they came for.

- **Routine ceilings** are the budget for **monthly cycle work** each
  persona does **every** cycle. If a CXO can't get through their
  Bridge in their routine ceiling, the system isn't working for them.
- **Non-routine ceilings** are the budget for **quarterly or episodic
  flows** — calibration sessions, board prep, cycle launch, a tough
  guidance conversation. These happen less often but cost more time.
  We accept higher minutes because the cognitive load is real.

Voice budgets the same minutes but assumes the user is talking, not
typing — a 30-second voice log replaces a 90-second form fill.

| Persona | Count | Primary surface | Routine ceiling | Non-routine ceiling |
|---|---:|---|---:|---:|
| Chairman | 1 | `/chairman` | 8 min/cycle | 45 min for calibration |
| MD / Group CEO | 1 | `/group` + `/team` | 15 min/cycle | 30 min weekly rhythm |
| Portfolio CEO | 13 | `/me` (→ MyIsland) + `/team` | 12 min self + 25 min for team | 20 min board prep |
| Fund CXO | 11 | `/me` (→ MyBridge) + `/team` | 8 min self + 20 min for team | 15 min cross-CXO sync |
| CHRO (Pramod) | 1 | `/governance-admin` + `/me` + `/team` | 10 min self + 20 min cycle ops | 60 min calibration |
| Company-level leader (function head, manager) | ~120 | `/me` + `/team` | 8 min self + 15 min for team | — |
| Company-level IC | ~350 | `/me` (simple) | 5 min self | — |
| Admin (technical) | 1-2 | `/admin` + `/governance-admin` | episodic | 30 min cycle launch |

**Voice path target**: any routine ceiling above is achievable by
voice in under 60% of the time budget (e.g. CXO 8-min ceiling → ≤5
min by voice). The form path stays for users who prefer it.

### What an IC actually does in APEX

The IC persona is the simplest and the most numerous (~350 at full
saturation). To avoid confusion, here's their concrete loop:

- **Once a month**, an IC opens `/me` and:
  - Reviews the mandates / OKRs their manager has set for them
    (read-only — managers own the mandate text; ICs respond to it).
  - Adds 1-3 short journal entries on what they did against each
    mandate this month.
  - Self-rates 1-10 on each mandate.
  - Optionally adds a free-text reflection (private to them).
- **Once a week** (opt-in): receives a weekly digest notification
  with one nudge if they haven't logged yet.
- **Their manager** sees their cycle status on the manager's `/team`
  page and assesses them at cycle close. The IC sees the assessment
  + manager guidance after reveal.

ICs do NOT use `/team` (they have no direct reports), `/group`, the
Financial Cockpit, or `/governance-admin`. The sidebar hides those
items for IC viewers.

### How we measure the ceilings

Time-budget targets are unfalsifiable without telemetry. APEX
instruments four event classes, written to a `userActivityEvents`
table *(planned, Phase 2 deliverable)*:

| Event | When emitted | Used to measure |
|---|---|---|
| `page_view` | Every page mount | Time on `/me` etc. |
| `cycle_action` | Journal/plan/rating/reflection write, assess submit | Per-cycle effort by persona |
| `voice_path_used` | Mic tap → confirm | Voice adoption + voice-vs-form ratio |
| `cycle_complete` | Submit Month finishes | Total minutes-from-cycle-open to submission |

Quarterly review of telemetry against the persona table. Targets
revised in this file (§4) when reality diverges. See §10 for the
specific metrics derived from these events.

---

## 5. Architecture End-State

### 5.1 Data model

The schema converges on these table groups:

**Identity & org**
- `users`, `tenants`, `persons`, `orgUnits`, `roles`
- `roleMandateVersions` *(planned)* — versioned mandates per role

**Rhythm core (governance cycles)**
- `feedbackTypes`, `governanceCycles`, `governanceAssessments`,
  `assessmentAssignments`
- `mandateJournals`, `companyReflections`, `chairmanGuidance`
- `dependencyChains`, `aiInsights`

**Legacy review system (kept, but secondary)**
- `assessments`, `reviews`, `meetings`, `selfReflections`,
  `observations`, `evidence`, `memories`, `calibrationSessions`

**Plans / metrics**
- `plans`, `metrics`, `metricValues`, `financialUploads`,
  `financialTemplates`, `incentiveConfigs`, `incentiveComputations`

**Goals / decisions / notifications**
- `decisions`, `notifications`, `userPreferences`

**Access control**
- `accessGrants`, `accessChallenges`

**Audit + telemetry**
- `auditLogs`

**AI memory & voice (some exist, some planned)**
- `agenticMemories` *(exists — needs hardening to Meridian-grade)*
- `voiceSessions`, `voiceSessionActions` *(planned)*

Every table has `tenantId`. Most have `createdAt` / `updatedAt`. New
tables follow this convention without exception.

### 5.2 Scope model

The unit of scope is a node in the org tree (`orgUnits`). Every viewer
has:

- `personId` — who they are
- `tier` — `IC` / `MANAGER` / `CXO` / `CEO` / `GROUP_CEO` / `CHRO` /
  `CHAIRMAN` (derived from their role.roleType)
- `directReportPersonIds` — who reports to them directly (from
  `roles.reportsToRoleId`)
- `ownedOrgUnitIds` — which org units they lead (CEO → their company)
- `isFundWide` — true for Chairman, MD, CHRO, Admin

A "scope" in any analytics or list query is a subtree of `orgUnits`.
Queries take `rootOrgUnitId` and recurse. RBAC permits a viewer to
query at most their `ownedOrgUnitIds` subtree (or the fund-wide root
if `isFundWide`).

### 5.3 Cascade

The single most important architectural commitment.

> **The Chairman is just a role. The pattern is leader↔reports.**

For any assessor X and target Y, an assessment is permitted iff one of:
- X is the chairman/admin
- Y reports to X directly or transitively
- X and Y are in a peer-feedback assignment generated for the cycle
- Y is owned by an org unit X owns (e.g. CEO ↔ their company)

This check lives in `server/db.ts:canAssessTarget` (planned) and is
the single chokepoint for all assessment writes. `chairman/assess`
becomes a special case of "assess your reports" with `assessor =
chairman`. Every leader gets the same UI on `/team`.

**Reading rule (separate from writing):**

For any viewer V looking at assessment data about target Y, the read
is permitted iff one of:
- V is Y (you can always read assessments about you)
- V is Chairman / Admin
- V is in Y's leader chain (transitive `reportsToRoleId`)
- V owns the org unit Y belongs to (CEO reading their company's data)
- V is the assessor (you can read what you wrote)
- An explicit `accessGrant` row scopes V to Y's org unit

Critically, this does **not** include peer assessors reading each
other's blind feedback — peer assessments stay anonymous to the
target and to other peers. The `feedbackTypes.isBlind` flag enforces
this at the API layer.

Reading guidance notes follows the same rule, with one tightening:
when a chairman guidance row is `dimensionKey`-scoped, only viewers
who can see that dimension's assessments can see the guidance.

### 5.4 Voice agent layer

Two surfaces:

**Tier 1 — Capture (tap-to-talk)** *(exists, needs polish)*
- `Capture.tsx` + `voice.classifyIntent` + `voice.dispatchIntent`
- MediaRecorder → Whisper → LLM intent parse → preview → confirm →
  routed write
- Visual feedback: pulsing button, waveform, "Listening…" /
  "Processing…", duration timer
- Handles ~10 capture intents (journal, plan, self-rating,
  observation, reflection, decision, meeting note, quick note,
  assess-report, write-guidance)

**Tier 2 — Coach (continuous duplex)** *(planned)*
- WebRTC + OpenAI Realtime API (`gpt-realtime-2`)
- Ephemeral token minted server-side
- ~25 tools exposed via `tool_choice: "auto"` — capture +
  assess + read + cycle ops + drafting + navigation
- Compressed system prompt (~3K tokens), detail-on-demand via
  `lookup_*` tools (Meridian's lesson)
- `VoiceCallContext` singleton; one active session per viewer
- iOS lock-screen control via `MPNowPlayingInfoCenter`
- Audio session category `.duckOthers` (iOS 17+)
- Silent-buffer audio priming inside the mic-tap gesture (iOS
  Safari fix)

### 5.5 Agentic memory layer

End-state: a single canonical `agenticMemories` table with rich fields
(scope, category, key, value, rationale, citations, confidence,
embedding, keywords, subjectPersonId, subjectCompanyId, isPinned,
validFrom, invalidatedAt, sourceType, sourceId, linkedMemoryIds).

**Categories for APEX** (narrower than Meridian's, fitted to our
rhythm):
- `mandate` — versioned role expectations
- `observation` — behavioral evidence about a person
- `commitment` — what someone said they'd do
- `pattern` — repeated AI-detected patterns (chronic deferrals,
  perception gaps, growth themes)
- `guidance` — written or verbal coaching notes

**Retrieval**: keyword + recency + confidence first. Add embeddings +
RRF when keyword-only retrieval feels insufficient (likely Phase 3).

**Background jobs**:
- **Monthly consolidation** — runs at cycle close. LLM-merges old
  similar memories into higher-confidence summaries.
- **Quality scoring** — nightly. Confidence decay (30d × 0.95 →
  180d × 0.70). Exempt categories: `mandate`, `relationship_core`,
  user-set preferences.
- **Write-time dedup** — 0.92 cosine threshold check on insert.

**Verification surface** at `/memory` — every user sees what the AI
knows about them, can approve / edit / **hard-delete**. The subject of
a memory has a non-negotiable right to delete it (not just invalidate);
that right is in `userPreferences` and the audit log records the
deletion event. This is the trust hinge.

### 5.6 AI coaching layer

Four surfaces, sequenced by trust depth:

1. **Per-user growth thread on `/me`** — read-only weekly AI summary
   of "your growth this cycle." Pulls from agenticMemories.
2. **Manager 1:1 prep** — clickable from any person profile. 90-sec
   briefing of last cycle's plan-to-log gap, recent observations, open
   guidance, suggested topics.
3. **Calibration co-pilot for CHRO/Chairman** — pre-cycle-close brief
   surfacing inconsistencies, edge cases, outcomes correlation hints.
4. **Weekly voice check-in** *(opt-in)* — agent asks 3 targeted
   questions per week, transcribes into a private reflection,
   surfaces patterns over time.

### 5.7 Notifications + rhythm

**Architecture:**

- One notification table (`notifications`), daily digest cadence
  (not per-event blast).
- Per-user delivery records: each notification row has a `deliveries`
  child table tracking `(channel, status, attemptedAt, deliveredAt,
  failureReason)`. We know which delivery on which channel succeeded
  or failed.
- Retry semantics: failed deliveries are retried twice (exponential
  backoff, capped at 4 hours). After 3 attempts the delivery is
  marked `permanently_failed` and the user can read the notification
  in-app on next session.

**Event types:**

- `cycle_open`, `cycle_close`, `cycle_revealed`
- `deadline_T7`, `deadline_T3`, `deadline_T1`
- `chairman_submitted_for_you` (target-scoped)
- `perception_gaps_revealed`
- `weekly_pulse_nudge`
- `chronic_deferral_flag`
- `calibration_prep_ready`
- `assignment_overdue`

**Channels:**

| Channel | When used | Default per persona |
|---|---|---|
| **In-app inbox** | Always (read at `/notifications` and on every dashboard) | All users |
| **Browser push** | Real-time on `cycle_open`, `cycle_revealed`, `assignment_overdue` (high urgency) | Opt-in via `NotificationPreferences.tsx` |
| **iOS push** | Same as browser push, on the Capacitor app *(Phase 4)* | Opt-in |
| **Email digest** | Daily 8am local. Bundles all in-app notifications from the prior 24h *(Phase 2)* | Opt-in; default off for ICs, default on for fund-level users |
| **SMS** | Chairman/CHRO-only, only on `deadline_T1` + cycle status changes *(Phase 4)* | Opt-in; default off |

**Quiet hours:**

- Per-user `quietHoursStart` and `quietHoursEnd` in `userPreferences`
  (existing).
- During quiet hours, push channels (browser/iOS) are silenced;
  notifications still arrive in-app and queue for the morning digest.
- SMS bypasses quiet hours only when severity = `CRITICAL` (deadline
  passed for the Chairman on a fund-wide cycle).
- Server-side delivery uses each user's local timezone (already on
  `userPreferences`).

**Per-category opt-out:**

Users can opt out of any event type except `cycle_close` and
`perception_gaps_revealed` — those are governance-critical and
non-mutable. Opting out of `weekly_pulse_nudge` is fine and common.

**Cost ceiling:** SMS has a real per-message cost. Per-user SMS
budget = 5 messages/month. Above that, the system writes only
in-app + email. (See §8 Open Decisions on the LLM cost ceiling for
the analog policy on AI calls.)

### 5.8 RBAC matrix

| Action | Who can do it |
|---|---|
| Read own `/me` | anyone authenticated |
| Read `/team` | anyone with `directReportPersonIds.length > 0` |
| Read `/group` | viewer's owned subtree OR `isFundWide` |
| Write journal/plan/rating about self | anyone |
| Assess a report | leader↔reports tree (via `canAssessTarget`) |
| Write guidance | leader↔reports tree |
| Open/close/reveal cycle | Chairman / Admin |
| Configure feedback types | Chairman / Admin |
| Generate assignments | Chairman / Admin |
| Run AI batch jobs (commitment tracker, insights gen) | Chairman / Admin |
| Edit financial actuals for a company | CEO of that company / Chairman / Admin |
| Read agenticMemories about a person, scoped to `pattern` / `observation` / `commitment` categories | the person + their **direct manager** + Chairman / Admin |
| Read `mandate` / `guidance` memories about a person | the person + their direct manager + Chairman / Admin (broader chain still excluded — even a grandparent manager doesn't see direct-manager guidance unless it's escalated to them) |
| Read memories about a person scoped to `private` reflections | the person only |
| Edit an agentic memory | the person it's about (subject) |
| Hard-delete an agentic memory | the person it's about (subject); audit log records the event |
| Read AccessGrants | tenant members |
| Revoke an AccessGrant | grant creator / Admin (with tenant check) |

All write endpoints route through `server/db.ts` RBAC helpers
(`isChairmanOrAdmin`, `canEditCompanyFinancials`, `canAssessTarget`).
No write skips RBAC. Every check filters by `tenantId`.

---

## 6. Build Phases

Phases are **sequenced** — each unlocks the next. Don't build later
phases before earlier ones land.

### Phase 0 — Docs bootstrap *(shipped 2026-04-21)*

`MASTER_PLAN.md`, `PROJECT_MAP.md`, `docs/maps/_template.md`,
`MERIDIAN_REFERENCE.md`, drift + orphan scripts, husky pre-push,
CLAUDE.md rewrite, MAPS-first memory rule. ✅

### Phase 1 — Stabilize what exists, ship cascade *(now → 4 weeks)*

**Goal:** every leader runs the cycle on their reports using the same
UI the Chairman uses. Stop being "Chairman's app."

**Phase 1 is too packed to ship as one batch. Sub-prioritized into
three tiers — ship Tier A before any Tier B work begins.**

**Tier A — cascade foundation (must ship first):**

- [ ] `server/db.ts:canAssessTarget(assessorPersonId, targetType,
      targetId)` — generalized RBAC for assessment writes.
- [ ] Reading rule helper (§5.3) — `canReadAssessment(viewer, target)`
      single chokepoint for assessment reads.
- [ ] `/team` gains an "Assess your team" tab → reuses
      `ChairmanAssess.tsx` shape, scoped to direct reports.
- [ ] Notification triggers fan out based on the leader↔reports
      chain, not Chairman-only.
- [ ] Subsystem maps written for the foundation batch (data-model,
      db-layer, auth-rbac, scope, cascade) — unblocks every later
      change.

**Definition of done for Tier A:** a CEO at MGPS can assess their
direct reports using the same UI the Chairman uses, and the writes
flow through one `canAssessTarget` chokepoint. Subsystem maps for
the foundation are ✅.

**Tier B — UX polish on top of cascade:**

- [ ] PrimaryActionCard recognizes "you have N reports to assess this
      cycle" and links accordingly.
- [ ] `/me` and `/today` deduped — `/today` becomes the daily-focus
      surface, `/me` is the monthly workspace.
- [ ] EmptyState component applied to 6 highest-traffic empty states.
- [ ] Submit confirmation modal on MyBridge / MyIsland / team-assess.
- [ ] Cycle-complete moment after submit.

**Tier C — adjacent improvements (parallelizable with Tier B):**

- [ ] Voice capture destination confirmation card (Meridian pattern).
- [ ] Notification digest (replace per-event blast) + per-user
      delivery records + retry semantics.
- [ ] Subsystem maps written for the remaining ~35 subsystems
      (rhythm core, universal surfaces, voice, AI, financial,
      governance ops, adjacent flows, access control, notifications,
      onboarding, calendar, admin, seed, shell).

**Definition of done for the whole phase:** a CEO at MGPS can open
APEX, see their company dashboard, assess each of their 4 direct
reports, submit, and the same flow that updates the fund-level
`aiInsights` table also updates the company-level analytics. Same UI
used by the Chairman. All 40 subsystem maps are ✅. Voice capture
shows destination confirmation. Notifications are daily-digest, not
per-event.

**Definition of done:** a CEO at MGPS can open APEX, see their company
dashboard, assess each of their 4 direct reports, submit, and the same
flow that updates the fund-level `aiInsights` table also updates the
company-level analytics. Same UI used by the Chairman.

### Phase 2 — Voice agent v1 + verification + 1:1 prep + observability *(weeks 5-10)*

**Goal:** voice does the heavy lifting; users trust where the AI puts
what they said; managers have AI-prepped briefings before any 1:1;
every meaningful event is logged.

- [ ] Voice destination card with "Saved to: <path> · [View] [Capture
      another]" — applied to all 10 capture intents.
- [ ] Voice agent multi-turn dialogue (Meridian pattern, not one-shot).
- [ ] Mic always available — floating button on every page, mobile
      bottom nav.
- [ ] iOS audio priming + `.duckOthers` audio session.
- [ ] `/memory` verification surface (read-only first; edit/reject in
      Phase 3).
- [ ] 1:1 prep button on every PersonProfile — generates 90-sec brief
      from memories + recent observations + last cycle gap.
- [ ] Privacy badge component applied to every user-writable surface.
- [ ] **Observability scaffolding** (per §3.9):
  - [ ] AuditLogger helper in `server/_core/audit.ts` for typed audit
        log writes (`logWrite`, `logAIDecision`, `logRBACDeny`).
  - [ ] Every governance write calls `logWrite`.
  - [ ] Every AI surface (intent classifier, insight generator, coach
        cards, voice route) calls `logAIDecision`.
  - [ ] Every RBAC failure calls `logRBACDeny`.
  - [ ] Slow-query warning (>500ms) via Drizzle middleware.
- [ ] **Failure-mode hardening** (per §3.10):
  - [ ] LLM-down fallback for voice classifier (keyword router).
  - [ ] LLM-down fallback for coach cards (last-cached summary).
  - [ ] Notification delivery records + retry semantics.
  - [ ] Documented service-degraded banner on read endpoint failures.

**Definition of done:** a CXO captures a thought by voice in a car,
sees confirmation of where it went, opens 1:1 prep before meeting
their direct report, reads the AI brief in under 90 seconds. Every
AI decision in the last 7 days can be answered with "model X said Y
with confidence Z; the user accepted/rejected/edited the result."

### Phase 3 — Agentic memory + AI coach *(weeks 11-18)*

**Goal:** the AI remembers you across cycles; the coaching feels
continuous.

- [ ] Harden `agenticMemories` table to full Meridian schema (rich
      fields, bi-temporal, provenance, hard-delete supported per §5.5).
- [ ] Write-time dedup + keyword-only retrieval first.
- [ ] Monthly consolidation job (runs at cycle close).
- [ ] Quality scoring job (nightly).
- [ ] `/memory` page gains approve / edit / **hard-delete** controls
      (with audit log entry on every delete).
- [ ] AI coach card on `/me` — read-only weekly summary of "your
      growth this cycle."
- [ ] Communication Style Memory for the Chairman — learn his
      guidance-note style; offer voice-drafted notes in his voice.
- [ ] Embedding generation + hybrid retrieval (only if keyword-only
      retrieval proves insufficient).

**Definition of done:** an AI coach card on every CXO's `/me`,
referencing facts from prior cycles ("Last cycle your gap on Margin
closed by 2 points. The pattern that closed it: weekly cost-out
documentation."). Memory survives across sessions and is editable by
the subject.

### Phase 4 — Mobile + calibration + voice coach *(weeks 19-26)*

**Goal:** APEX is a real iOS app; calibration is a guided ritual;
voice goes continuous.

- [ ] Capacitor wrapper, App Store deploy.
- [ ] Push notifications (iOS).
- [ ] `MPNowPlayingInfoCenter` lock-screen integration.
- [ ] WebRTC + OpenAI Realtime continuous voice agent.
- [ ] `VoiceCallContext` global singleton + active-call pill.
- [ ] Calibration page (`/calibration`) using existing
      `calibrationSessions` table. CHRO-driven workflow with AI
      pre-brief.
- [ ] Outcomes correlation hints in calibration (directional only —
      n=13 is small).

**Definition of done:** APEX is on the App Store. Chairman closes a
cycle from the phone while in a taxi. Calibration meeting is run from
an AI-generated brief that takes ~20 minutes instead of ~120.

### Phase 5+ — Discovery-driven *(weeks 27+)*

Will not commit specific items until Phase 1-4 land. Candidate work:
- Multi-language voice (Hindi for some portfolio companies)
- Slack/Teams integration for nudges
- Outcomes correlation as a deliberate analytics surface (n grows
  with cascade)
- Investor-facing snapshots (board pack auto-generation)
- **Multi-tenant onboarding readiness:** pay down the
  `TENANT_ID = 1` debt (§2 item 1), add SSO/SAML, formal audit log
  retention, data-classification controls. Triggered by a second
  holding company adopting APEX.

### Phase dependencies

```
Phase 0 (docs)              ← shipped
        ↓
Phase 1 (cascade)           ← prerequisite for everything
        ↓
        ├──→ Phase 2 (voice + verify + 1:1 + observability)
        ↓
        └──→ Phase 3 (memory + coach)  [needs Phase 2 observability]
                ↓
                Phase 4 (mobile + calibration + duplex voice)
                        ↓
                        Phase 5+ (multi-tenant + integrations + discovery)
```

---

## 7. What APEX Is NOT (the anti-list)

Strict no's. Re-debate these only with a written rationale that
updates this section.

- **Not multi-tenant SaaS.** One tenant (MEF) today. The schema
  supports multi-tenant; the client hardcoding does not. Onboarding a
  second holding company is a Phase 5+ effort with its own readiness
  checklist (§6 Phase 5+).
- **Not generic HR.** No payroll, no benefits, no recruiting funnel.
  Other tools own these.
- **Not annual review software.** Performance ≠ APEX. APEX is the
  rhythm; the annual review is a side-output of the rhythm. The legacy
  `assessments` table with MILESTONE/QUARTERLY/ANNUAL types is kept
  for transitional purposes but is not the primary lens.
- **Not OKR software.** APEX uses mandates (qualitative, evolving),
  not OKRs. The schema includes `plans.type = OKR` as an optional
  plan type for company-internal goal cascading but it is not the
  primary surface.
- **Not a public product.** No marketing site, no public docs, no
  signup flow.
- **Not deeply integrated with enterprise stacks.** No Workday,
  Lattice, BambooHR, Greenhouse. We may export CSVs.
- **Not a goal-tracker for personal life.** Meridian does that.
- **Not real-time collaborative editing.** Single-author flow per
  field is fine for monthly cycles. (Open Decision §8: confirm
  before Phase 2 ships whether co-authoring is genuinely not needed
  on company reflections.)
- **Not an LLM-curated rating.** AI never rates a person. AI never
  ranks a person. Humans rate humans (per §3.5).

---

## 8. Open Decisions

Living list. Add items here when you flag a decision the project
hasn't made; close items by linking the answer.

Each row has an **owner** (who decides) and a **by** date (when the
decision needs to land — usually the start of the phase that would
otherwise block on it). Owners: **GP** = Gautham Pai (Chairman, default
product owner); **MD** = Abhay (operating decisions); **CHRO** =
Pramod (HR policy decisions); **ENG** = whoever is the lead engineer
on the relevant subsystem; **PROD** = whoever wears the product hat
this week (no formal role yet).

| # | Decision | Owner | By | Status |
|---|---|---|---|---|
| 1 | **iOS-first vs PWA-first** — PWA → Capacitor in Phase 4 is the default. Should iOS jump to Phase 2 if mobile usage data demands? | GP + PROD | Start of Phase 2 | open |
| 2 | **Whisper vs Web Speech API** — Meridian uses S3-upload-then-Whisper; we use Web Speech in `Capture.tsx`. Test side-by-side before Phase 2 voice work commits to one path. | ENG | Start of Phase 2 | open |
| 3 | **Notification delivery channels** — email digest? SMS for Chairman-only urgent? Slack? Current: in-app + browser push. See §5.7 for the proposed channel matrix; confirm before Phase 1 Tier C. | GP + MD | Phase 1 Tier C kickoff | open (proposed in §5.7) |
| 4 | **Cycle alignment across cascade levels** — fund-wide cycle is monthly. Can a portfolio company run an extra mid-month sub-cycle? Default: no. Override case: TBD. | GP | Phase 1 done | open |
| 5 | **Agentic memory deletion vs invalidation** — hard delete or soft `invalidatedAt`? | ENG | Phase 3 start | **decided in §5.5**: hard delete for subject's own memories; soft for AI-derived; audit log on both |
| 6 | **Multi-tenant trigger** — what flips us into Phase 5+ multi-tenant work? | GP | when externally triggered | proposed: "a second holding company signs written commitment" |
| 7 | **Company-specific dimensions** — `/my-island` uses 6 hardcoded dims. Should companies override via `orgUnits.customMetrics`? | GP + CHRO | Phase 1 Tier B | open |
| 8 | **Co-authoring on company reflections** — CEO + CFO drafting the company reflection together. Default: no. | GP | Phase 2 start | open |
| 9 | **HR data import** — ingest from an existing Manipal HRIS, or stick with manual seed + Onboarding? | CHRO + ENG | Phase 4 (cascade-to-IC) | open |
| 10 | **Non-English voice** — Hindi/Kannada support for portfolio company leaders. Whisper supports both; classifier prompts are English-only today. | GP + CHRO | Phase 5+ trigger | deferred |
| 11 | **Data retention policy** — durations for journals, observations, memories, audit logs. Mandatory before second-tenant onboarding. | GP + Legal | Multi-tenant trigger | open |
| 12 | **User offboarding** — what happens to data when a CXO/CEO leaves? Soft-delete vs export-and-purge vs anonymise. Mandatory before first attrition event. | CHRO + Legal | First attrition event | open |
| 13 | **LLM cost ceiling** — budget at full saturation. Monitoring + alerts. Critical before Phase 3 (memory + coach surfaces multiply call rate). | ENG + GP | Phase 3 kickoff | open |
| 14 | **2FA / MFA enforcement scope** (per §3.10 security baseline) — when and for whom? | GP + ENG | Phase 5+ trigger | proposed: required for admin role + Chairman/Group-CEO |
| 15 | **Audit-log retention specifics** — 7 years for financial/assessment/guidance/memory-delete events, 90 days otherwise (per §3.10). Confirm with legal counsel. | GP + Legal | Multi-tenant trigger | proposed in §3.10 |

When a decision is **decided**, change `open` → `decided YYYY-MM-DD by NAME` and add a one-line rationale. Do not delete the row — the audit trail matters.

---

## 9. Document discipline

Living rules for this file and the maps:

1. **Read this file first** before starting any non-trivial change
   in APEX. Especially when working in a subsystem you haven't
   touched in 2+ weeks.
2. **Update this file in the same commit** as any direction change.
   Direction = "what APEX does, what it doesn't do, what phase we
   are in, what's now open." Implementation detail goes in the maps.
3. **Subsystem maps live in `docs/maps/`.** Each has a Purpose, Files,
   Functions, Data Touched, Conventions, Fragility Notes, Forward &
   Backward Dependencies. See `docs/maps/_template.md`.
4. **The `PROJECT_MAP.md` index** in this directory lists every
   subsystem and where to find its map.
5. **Drift enforcement is strict.** `scripts/check-map-drift.mjs`
   runs in `.husky/pre-push`. If you change a source file that lives
   in a map's scope and don't update the map, the push fails. Bypass
   only with `SKIP_MAPS_LINT=1` and an explanation in the PR body.
6. **Orphan enforcement is strict.** `scripts/check-map-orphans.mjs`
   flags any source file not referenced in at least one map. New
   files must be added to a map (or a new map created).

---

---

## 10. Success Metrics

How we know APEX is working — for real, not by vibes. Each metric has
a **target**, a **measured-from event** (telemetry source per §4
measurement plan), and a **review cadence**.

### System-level (the only ones the Chairman should care about)

| Metric | Target | Measured from | Review |
|---|---|---:|---|
| **Cycle submission completeness** | ≥95% of expected submissions per cycle | `cycle_complete` events / expected from `assessmentAssignments` | Monthly at cycle close |
| **Calibration meeting length** | ≤60 min (current ad-hoc ≈ 120 min) | manual timer; CHRO logs in `calibrationSessions.durationMinutes` | Quarterly |
| **Time from cycle-open to majority-submission** | ≤21 days (target: 70% submit by day 21 of a 30-day cycle) | First `cycle_complete` event per user, vs `governanceCycles.openDate` | Monthly |
| **Perception-gap closure over 3 cycles** | At least 60% of `gap ≥ 2` instances close by 1+ point within 3 cycles | Pair-wise gap delta in `governanceAssessments` for same (target, dim, feedbackType) tuple over time | Quarterly |
| **Chronic-deferral rate** | <10% of plan items deferred 3+ cycles | `aiInsights` rows of type `COMMITMENT_TRACKING` / total plan items | Quarterly |

### Per-persona ceilings (proves the friction targets in §4)

| Metric | Target | Measured from | Review |
|---|---|---:|---|
| **Median CXO cycle-completion minutes** | ≤8 min routine | `cycle_complete` minus first `cycle_action` of the cycle, per CXO | Monthly |
| **Median CEO cycle-completion minutes (self + island)** | ≤12 min | same, per CEO | Monthly |
| **Voice-vs-form ratio** | ≥40% of writes via voice by end of Phase 2 | `voice_path_used` events / total `cycle_action` events | Monthly during Phase 2; quarterly after |
| **PrimaryActionCard click-through** | ≥60% of CTAs clicked by their owner within 24h of impression | telemetry on `PrimaryActionCard` mount → outbound nav | Monthly |

### AI trust (proves the coaching layer is actually trusted)

| Metric | Target | Measured from | Review |
|---|---|---:|---|
| **Memory verification rate** | ≥80% of AI-extracted memories are reviewed by their subject within 30 days | `agenticMemories.needsVerification` cleared timestamp vs created | Monthly during Phase 3 |
| **Voice intent acceptance rate** | ≥85% of voice classifications accepted without edit | `voice.dispatchIntent` outcomes: accept vs edit vs reject | Monthly |
| **Coach card dismiss rate** | ≤25% of AI coach cards dismissed within 60 sec of impression (signals bad output) | `aiInsights` view + dismiss events | Monthly during Phase 3 |
| **1:1 prep usage** | ≥50% of leaders open a 1:1 prep brief within 7 days of any 1:1 meeting | telemetry on `/people/:id` 1:1-prep button | Monthly during Phase 2-3 |

### Reliability (proves the failure-mode design is real)

| Metric | Target | Measured from | Review |
|---|---|---:|---|
| **p99 page load** | <3 sec | server access logs + RUM | Weekly |
| **LLM call success rate** | ≥99% over rolling 7 days | `aiDecisions` log per §3.9 | Weekly |
| **Notification delivery rate** | ≥98% within target channel | `notificationDeliveries.status` | Weekly |
| **Voice classification fallback rate** | <5% (i.e. ≥95% don't need the keyword-router fallback) | `voiceClassifications` log | Weekly during Phase 2 |

**These metrics drive the master plan.** When a target is consistently
missed for 2+ review cycles, the next phase's scope re-opens. Don't
celebrate shipping if the metrics don't move.

---

## 11. Risk Register

Top risks that could derail APEX. Each has a **likelihood** × **impact**
rating (1-5 each) and a **mitigation owner**. Review quarterly.

| # | Risk | Likelihood | Impact | Score | Mitigation | Owner |
|---|---|---:|---:|---:|---|---|
| R1 | **LLM cost spike** at Phase 3 (memory + coach surfaces multiply call rate). | 4 | 4 | 16 | Per-user LLM budget + alerts wired into Phase 3. Caching layer for repeated prompts. Open Decision §8 #13. | ENG |
| R2 | **Chairman attrition risk** — the Chairman is the lynchpin of the rhythm. If he steps away, the cycle stops. | 2 | 5 | 10 | Cascade design (§5.3) makes the rhythm work for every leader, not just the Chairman. The MD is the operational owner; the Chairman is the ceremonial one. By Phase 1's end the Chairman is *important* but not *required* for any monthly cycle to close. | GP + MD |
| R3 | **Manus's parallel changes diverging from this plan.** Manus pushes to main directly; if the plan diverges from what Manus is building, we get architectural drift. | 4 | 4 | 16 | Both Claude and Manus read `MASTER_PLAN.md` + relevant subsystem maps before changing code. The MAPS-first hook (§9) is the safety net. Quarterly architecture review against the plan. | GP + ENG |
| R4 | **Voice agent unreliability** breaks the trust hinge. Users stop using voice; the friction targets collapse. | 3 | 5 | 15 | Multi-layer defense: parse → preview → confirm always available. Voice destination card. Confidence-aware UI. Per §3.10, LLM-down fallback always available. Phase 2 instrument the acceptance rate metric (§10). | ENG |
| R5 | **Privacy violation incident** — AI surfaces something to the wrong viewer. | 2 | 5 | 10 | Single chokepoint per RBAC concern (`canAssessTarget`, `canReadAssessment`, `canEditCompanyFinancials`). Every read filters by `tenantId`. Audit log on every RBAC deny (§3.9). Penetration test scheduled at Phase 4 close. | ENG |
| R6 | **Cycle deadline conflicts with portfolio company operating realities.** A CEO is on the road during deadline week. | 3 | 3 | 9 | Cycle structure tolerates late submission (per §3.10). Calibration brief surfaces the late-submitter so the Chairman knows. Phase 2 deadline-T7/T3/T1 reminders give early warning. | CHRO |
| R7 | **Senior leaders abandon the app** because it feels like more work, not less. | 3 | 5 | 15 | Friction-target metrics (§10) are the early warning. Voice path is the primary mitigation. Submit confirmation, EmptyState, Cycle-complete moment — all the Phase 1 polish is here. If after Phase 2 voice adoption is <30%, halt new feature work and re-design the capture flow. | GP + PROD |
| R8 | **Regulatory ask for data residency** (India / portfolio company jurisdiction). | 2 | 4 | 8 | Open Decision §8 #11 (data retention) and §3.10 security baseline both anticipate this. Multi-tenant Phase 5+ will likely require per-deployment residency anyway. | GP + Legal |
| R9 | **Schema migration breaks production data.** Especially as cascade introduces new RBAC checks against existing rows. | 3 | 4 | 12 | Migrations run in shadow first against a prod snapshot. RBAC changes ship with a feature flag for 1 cycle before becoming the default. Drizzle migration review checklist in the relevant subsystem map. | ENG |
| R10 | **AI hallucination in a coach surface** — the AI tells a CXO they're improving on Margin when their data shows they're not. | 3 | 4 | 12 | Coach cards cite the data behind their claim (provenance per §5.5). User can challenge any claim (links to the supporting memory/observation/cycle). Memory contradiction detection (§3.10) catches the AI when it contradicts known facts. | ENG |

**Top 3 to actively manage:** R1, R3, R4 (all scored 15-16).

**Review cadence:** quarterly, in the Chairman's calibration meeting.
New risks logged here as discovered. Risks don't go away — they're
reweighted.

---

## 12. Plan Change Process

When this plan changes, follow this:

1. **Direction change** (something in §1, §3, §5, §6, §7 changes):
   - Open a PR with the change to `MASTER_PLAN.md`.
   - Include rationale in the PR body — what triggered the change,
     what alternative was considered.
   - Update affected subsystem maps in the same PR if the change
     ripples down.
   - The Chairman (or his designated PROD owner) approves direction
     changes. Engineering approves implementation-detail-only changes.

2. **Status change** (an item in §2 Current State moves bucket, an
   open decision in §8 gets decided, a phase milestone ticks off):
   - Update `MASTER_PLAN.md` in the same commit as the underlying
     code/decision change. No separate doc-only PR needed.
   - For decided items in §8, change `open` → `decided YYYY-MM-DD by
     NAME` with a one-line rationale. **Do not delete the row.**

3. **Adding a new open decision or risk:**
   - Anyone can add. Append to the bottom of the relevant table.
   - Assign an owner and a by-date even if approximate.

4. **Recurring reviews (calendar):**
   - **Weekly:** reliability metrics (§10 last subsection).
   - **Monthly at cycle close:** persona-ceiling metrics + system
     metrics + cycle-completeness review.
   - **Quarterly:** risk register (§11) + perception-gap closure +
     full architecture review against §5.
   - **Annually:** rewrite §1 Vision and §3 Principles if anything has
     fundamentally shifted. Most years this is a no-op.

5. **When the plan and reality disagree:**
   - Plan vs subsystem map → map wins for that subsystem; queue
     master-plan update.
   - Plan vs code → plan wins until code catches up.
   - Plan vs metric data → re-open the relevant section; data wins.

6. **Versioning:**
   - Bump the "Last updated" timestamp at the top on any meaningful
     change.
   - Major rewrites (e.g. v1 → v2 → v3) note what changed at the
     top, summary-style.

---

## 13. Glossary

Terms used throughout this plan and the subsystem maps. When in
doubt, this section is the source of truth — if a term in the code
diverges from this glossary, update one of them (and update this
glossary if the code's meaning is the right one).

- **APEX** — this app. The Manipal Evergreen Fund's monthly governance
  operating system.
- **MEF** — Manipal Evergreen Fund. APEX's first (and currently only)
  tenant.
- **Cascade** — the architectural commitment that the same monthly
  rhythm runs at every leader↔reports layer (Chairman ↔ CXOs/CEOs;
  CEO ↔ their leadership; manager ↔ their ICs). One pattern, many
  scopes. See §5.3.
- **Scope** — a node in the org tree (`orgUnits`) defining the
  subtree a viewer can see. See §5.2.
- **Tier** — a viewer's role-derived class (`IC`/`MANAGER`/`CXO`/
  `CEO`/`GROUP_CEO`/`CHRO`/`CHAIRMAN`). Drives which surfaces and
  data the viewer accesses.
- **Cycle** — a monthly governance instance (`governanceCycles` row).
  States: `DRAFT` → `OPEN` → `CLOSED` → `REVEALED`. See §5.1, §5.7.
- **Rhythm** — the recurring monthly pattern (log → plan → self-rate
  → leader-rate → reveal → close → calibrate). The system organizes
  around it.
- **Mandate** — a single role's expected outcome, captured as a
  string in `roles.successMetrics` (and planned for versioning via
  `roleMandateVersions`). What a CXO commits to deliver.
- **Bridge / Captain's Log / Next Heading** — ship metaphor for the
  CXO workspace. Bridge = mandate cards page; Captain's Log = monthly
  journal entry per mandate; Next Heading = next-month plan.
- **Island** — ship metaphor for the CEO's company-scoped workspace
  (`MyIsland.tsx`).
- **Hull / Deck / Mast** — ship metaphor for org-zone classification
  (Hull = critical operations; Deck = day-to-day execution; Mast =
  strategic direction). Used in zone-health rollups.
- **Perception gap** — the difference between a self-rating and a
  leader-rating on the same target/dimension/cycle. Surfaced as an
  `aiInsight` of type `PERCEPTION_GAP` when ≥ 2.
- **Chain (dependency chain)** — a named ordered set of roles whose
  collective performance affects a fund-level outcome. Defined in
  `dependencyChains`. Chains have "weakest-link" health rollups.
- **Mandate journal / Plan-to-log tracking** — the comparison of last
  month's plan items against this month's log to flag what was
  addressed, partially addressed, deferred, or never mentioned.
- **Reveal** — the cycle state transition that makes leader-ratings
  visible to the target. Triggers notifications.
- **Calibration** — the meeting where CHRO + Chairman walk through
  inconsistencies in a closed cycle before final reveal. Backed by
  `calibrationSessions`.
- **Fractal pages** — `/me`, `/team`, `/group` — same UI shape, data
  scoped by viewer tier. Chairman's `/me` is structurally identical
  to an IC's `/me`; only the data differs.
- **PrimaryActionCard** — the AI-driven "your single most important
  action right now" card that sits at the top of `/me`, `/team`, and
  `/group`. Computed by `server/rhythm-engine.ts`.
- **Insights Inbox** — the AI-generated insight queue per viewer.
  `aiInsights` rows filtered by viewer scope.
- **Memory subject** — the person an `agenticMemory` row is *about*
  (`subjectPersonId`), distinct from the user who wrote it. Subjects
  have hard-delete rights on memories about them (§5.5).
- **Provenance** — a memory's link back to the raw interaction that
  produced it (`sourceType` + `sourceId`). Clickable.
- **Bi-temporal** — a memory has two time axes: when the claim is
  true in the real world (`validFrom`) vs when the system stops
  treating it as current (`invalidatedAt`). Used to handle
  contradictions without destructive overwrite.
- **Parse → preview → confirm** — the voice capture contract. AI
  parses the utterance, UI shows the user what's about to be saved
  + where, user accepts/edits/dismisses.
- **Tap-to-talk** vs **continuous duplex** — voice modes. Tap-to-talk
  is one-shot recording + parse. Continuous duplex is a back-and-forth
  conversation via WebRTC + Realtime API.
- **Destination card** — the post-capture confirmation showing where
  the AI routed what you said ("Saved to: My Bridge → Revenue Growth
  → Captain's Log").
- **Tenant** — currently one (MEF). Architecturally pluralizable when
  trigger condition fires (§8 #6).
- **Tenant-ID hardcoding** — the known tech debt where ~9 client files
  hardcode `TENANT_ID = 1`. Must be paid down before a second tenant.
- **`canAssessTarget(assessor, target)`** — the single chokepoint for
  assessment-write RBAC. Returns true iff the cascade rule permits.
  See §5.3.
- **`canReadAssessment(viewer, target)`** — the same idea for reads.
  Phase 1 Tier A deliverable.
- **`isChairmanOrAdmin(userId, tenantId)`** — gate for cycle ops,
  guidance writes, AI batch jobs.
- **`canEditCompanyFinancials(userId, tenantId, orgUnitId)`** — gate
  for inline-edit on the Financial Cockpit.
- **Subsystem map** — a `.md` file under `docs/maps/` documenting one
  concern area's files, functions, data, dependencies, fragilities.
  See `docs/maps/_template.md`.
- **Drift** — a state where a subsystem map's referenced source files
  changed but the map didn't. Pre-push hook fails on it.
- **Orphan** — a source file not referenced in any subsystem map.
  Pre-push hook fails on it.

---

*End of master plan. See `docs/PROJECT_MAP.md` for the subsystem index,
`docs/maps/` for per-subsystem details, and `docs/MERIDIAN_REFERENCE.md`
for the Meridian patterns we'll port.*
