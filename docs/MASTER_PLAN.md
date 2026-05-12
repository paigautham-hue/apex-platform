# APEX — Master Plan

> The strategic source of truth for APEX. Every contributor (human or
> agent) reads this first. Every direction change updates this file in
> the same commit as the code change.
>
> Last updated: 2026-04-21

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

---

## 2. Non-Negotiable Principles

Listed in order of priority when they collide.

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

5. **AI is a coach, not a prescriber, not a scorer.**
   - AI surfaces patterns ("Two cycles ago your gap on Margin was 3;
     this cycle it's 1. The pattern is closing.").
   - AI **never** rates people. Only humans rate humans.
   - AI never says "you should do X." It asks "is this what you're
     seeing?"

6. **Tenant isolation is a hard invariant.** Every read and write
   filters by `tenantId`. No id-only lookups. No "I'll add the filter
   later." Reviewed every PR.

7. **Monthly rhythm is the heartbeat.** Daily and weekly UIs serve the
   monthly cycle. We do not add quarterly-only or annual-only features
   without anchoring them in a monthly equivalent.

8. **MAPS-first workflow.** Before changing code, read the relevant
   subsystem map. After changing code, update the map in the same
   commit. The `check-map-drift` hook enforces this on push.

---

## 3. Personas & Frictionless Flow Targets

A "frictionless" flow means **minutes between intent and outcome**. For
each persona we specify the ceiling for routine cycle work; longer
ceilings are acceptable for non-routine flows like calibration.

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

---

## 4. Architecture End-State

### 4.1 Data model

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

### 4.2 Scope model

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

### 4.3 Cascade

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

### 4.4 Voice agent layer

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

### 4.5 Agentic memory layer

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
knows about them, can approve / edit / reject. **This is the trust
hinge.**

### 4.6 AI coaching layer

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

### 4.7 Notifications + rhythm

- One notification table, daily digest cadence (not per-event blast).
- Event types: cycle-open, cycle-close, deadline-T7/T3/T1,
  chairman-submitted-for-you, perception-gaps-revealed,
  weekly-pulse-nudge, chronic-deferral-flag, calibration-prep-ready.
- Per-user preferences (existing `userPreferences` table) control
  category opt-in/out and quiet hours.
- Browser push (already wired) + iOS push (Capacitor) when app ships.

### 4.8 RBAC matrix

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
| Read all agenticMemories about a person | the person + their leader chain + Chairman / Admin |
| Edit/delete an agentic memory | the person it's about |
| Read AccessGrants | tenant members |
| Revoke an AccessGrant | grant creator / Admin (with tenant check) |

All write endpoints route through `server/db.ts` RBAC helpers
(`isChairmanOrAdmin`, `canEditCompanyFinancials`, `canAssessTarget`).
No write skips RBAC. Every check filters by `tenantId`.

---

## 5. Build Phases

Phases are **sequenced** — each unlocks the next. Don't build later
phases before earlier ones land.

### Phase 1 — Stabilize what exists, ship cascade *(now → 4 weeks)*

**Goal:** every leader runs the cycle on their reports using the same
UI the Chairman uses. Stop being "Chairman's app."

- [ ] `server/db.ts:canAssessTarget(assessorPersonId, targetType,
      targetId)` — generalized RBAC for assessment writes.
- [ ] `/team` gains an "Assess your team" tab → reuses
      `ChairmanAssess.tsx` shape, scoped to direct reports.
- [ ] PrimaryActionCard recognizes "you have N reports to assess this
      cycle" and links accordingly.
- [ ] Notification triggers fan out based on the leader↔reports
      chain, not Chairman-only.
- [ ] `/me` and `/today` deduped — `/today` becomes the daily-focus
      surface, `/me` is the monthly workspace.
- [ ] Voice capture destination confirmation card (Meridian pattern).
- [ ] EmptyState component applied to 6 highest-traffic empty states.
- [ ] Submit confirmation modal on MyBridge / MyIsland / team-assess.
- [ ] Cycle-complete moment after submit.
- [ ] Notification digest (replace per-event blast).

**Definition of done:** a CEO at MGPS can open APEX, see their company
dashboard, assess each of their 4 direct reports, submit, and the same
flow that updates the fund-level `aiInsights` table also updates the
company-level analytics. Same UI used by the Chairman.

### Phase 2 — Voice agent v1 + verification + 1:1 prep *(weeks 5-10)*

**Goal:** voice does the heavy lifting; users trust where the AI puts
what they said; managers have AI-prepped briefings before any 1:1.

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

**Definition of done:** a CXO captures a thought by voice in a car,
sees confirmation of where it went, opens 1:1 prep before meeting
their direct report, reads the AI brief in under 90 seconds.

### Phase 3 — Agentic memory + AI coach *(weeks 11-18)*

**Goal:** the AI remembers you across cycles; the coaching feels
continuous.

- [ ] Harden `agenticMemories` table to full Meridian schema (rich
      fields, bi-temporal, provenance).
- [ ] Write-time dedup + keyword-only retrieval first.
- [ ] Monthly consolidation job (runs at cycle close).
- [ ] Quality scoring job (nightly).
- [ ] `/memory` page gains approve / edit / reject controls.
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

---

## 6. What APEX Is NOT (the anti-list)

Strict no's. Re-debate these only with a written rationale that
updates this section.

- **Not multi-tenant SaaS.** One tenant (MEF). One deployment.
- **Not generic HR.** No payroll, no benefits, no recruiting funnel.
  Other tools own these.
- **Not annual review software.** Performance ≠ APEX. APEX is the
  rhythm; the annual review is a side-output of the rhythm.
- **Not OKR software.** APEX uses mandates (qualitative, evolving),
  not OKRs.
- **Not a public product.** No marketing site, no public docs, no
  signup flow.
- **Not deeply integrated with enterprise stacks.** No Workday,
  Lattice, BambooHR, Greenhouse. We may export CSVs.
- **Not a goal-tracker for personal life.** Meridian does that.
- **Not real-time collaborative editing.** Single-author flow per
  field is fine for monthly cycles.
- **Not an LLM-curated rating.** AI never rates a person. Humans
  rate humans.

---

## 7. Open Decisions

Living list. Add items here when you flag a decision the project
hasn't made; close items by linking the answer.

- [ ] **iOS-first vs PWA-first** — currently planned as PWA → Capacitor
      wrap in Phase 4. Should iOS become Phase 2 if usage demands?
- [ ] **Whisper vs Web Speech API** for voice transcription accuracy
      — Meridian uses S3-upload-then-Whisper for capture; we have
      Web Speech in Capture. Test side-by-side at some point.
- [ ] **Notification delivery surface** — email digest? SMS for
      Chairman-only urgent? Slack? Currently in-app + browser push.
- [ ] **Cycle alignment across cascade levels** — fund-wide cycle is
      monthly. Should portfolio companies be allowed to run an extra
      mid-month sub-cycle? Default: no. Override case: TBD.
- [ ] **Agentic memory deletion vs invalidation** — when a user
      rejects a memory, hard delete or soft (`invalidatedAt`)? Lean
      toward soft for audit trail.

---

## 8. Document discipline

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

*End of master plan. See `docs/PROJECT_MAP.md` for the subsystem index
and `docs/maps/` for per-subsystem details.*
