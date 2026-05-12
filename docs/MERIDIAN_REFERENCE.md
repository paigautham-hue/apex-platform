# Meridian Reference — Patterns, Files, and Lessons to Reuse

> APEX is being built alongside Meridian, the AI productivity copilot
> for executives. Meridian has matured several capabilities APEX will
> need — voice agents, agentic memory, communication style learning,
> meeting templates, MAPS discipline. This file catalogs what to port
> and what to study, with exact source file paths in the Meridian repo
> so we don't re-derive any of this from scratch.
>
> Meridian repo (local clone): `My apps/meridian-ref/`
> Meridian repo (remote): `paigautham-hue/meridian` (private)
>
> Last updated: 2026-04-21

---

## How to use this file

When working on an APEX feature whose pattern Meridian already solved:

1. Find the row in the catalog below.
2. Open the referenced Meridian file under `My apps/meridian-ref/`.
3. Read it. Don't blindly copy — Meridian's needs differ in subtle
   ways. Adopt the pattern, simplify for APEX's narrower scope.
4. When you port, cite the Meridian source in the APEX file's header
   comment so the lineage is preserved.

When you finish porting something from this list, mark its row
✅ **ported** with the APEX file path.

---

## 1. MAPS discipline (already ported ✅)

| What | Meridian source | APEX status |
|---|---|---|
| Subsystem map template | `docs/maps/_template.md` | ✅ `docs/maps/_template.md` |
| Drift detection script | `scripts/check-map-drift.mjs` | ✅ `scripts/check-map-drift.mjs` (strict default) |
| Orphan detection script | `scripts/check-map-orphans.mjs` | ✅ `scripts/check-map-orphans.mjs` |
| Pre-push hook | `.husky/pre-push` | ✅ `.husky/pre-push` |
| MAPS-first workflow rule | `CLAUDE.md` rules section | ✅ `CLAUDE.md` + memory file |

Adaptations made for APEX:
- Strict mode by default (Meridian defaults to warn-only).
- Added `shared/` to source-dir prefixes.
- Reference CLAUDE.md → MASTER_PLAN.md / PROJECT_MAP.md.

---

## 2. Voice — two-tier strategy (planned port)

Meridian runs two voice modes in parallel; APEX should adopt the same
split.

### 2a. Tap-to-talk Capture (Tier 1)

> Status: APEX has a partial Capture flow already (`Capture.tsx`,
> `server/routers/voice.ts`). Needs polish to match Meridian's
> two-step parse-→-preview-→-confirm pattern.

| Pattern | Meridian source | Notes |
|---|---|---|
| Universal voice assistant UI | `client/src/components/UniversalVoiceAssistant.tsx` (2,035 lines) | Pulsing button, animated waveform, "Listening…/Processing…" badges, duration timer, 10-minute max with warnings at 8 and 9 min |
| Voice recording hook | `client/src/hooks/useVoiceRecording.ts` | MediaRecorder API, real-time audio level monitoring via AudioContext |
| Voice input button (small inline) | `client/src/components/VoiceInputButton.tsx` | Inline use in forms, "showInlineIndicator" prop |
| Voice OR text input wrapper | `client/src/components/VoiceOrTextInput.tsx` | Switch between voice + text mid-flow |
| Voice capture modal | `client/src/components/VoiceCaptureModal.tsx` | Full-screen overlay for big-tap-to-talk |
| Server intent classification | `server/routers/voiceRouter.ts:parseVoiceIntent` | LLM with structured JSON output for ~10 intent types |
| Audio upload + transcription | `server/routers/voiceRouter.ts:uploadAudio` + `:transcribe` | S3 upload (16MB limit), Whisper API for transcribe |
| Voice transcription core | `server/_core/voiceTranscription.ts` | Whisper wrapper |
| Parsed intent type | `UniversalVoiceAssistant.tsx:68-110` | 70-line typed `ParsedIntent` covering all intent fields |
| Two-step parse→preview→confirm | `UniversalVoiceAssistant.tsx` state machine: `idle → recording → paused → processing → preview → complete/error` | The trust-building UX |
| iOS lock screen bridge | `client/src/lib/nowPlayingBridge.ts` | `startNowPlaying / stopNowPlaying / onRemoteStop` — wraps MPNowPlayingInfoCenter |

**UX lessons from `VOICE_UX_IMPROVEMENTS.md`:**
- Apple-quality feedback: 5 animated bars pulsing with voice intensity, framer-motion smooth transitions, pulsing glow effect, breathing scale animation, mood emoji selectors.
- "User knows exactly what's happening at every moment" — never leave the user wondering if the system is alive.

### 2b. Continuous duplex (Tier 2)

> Status: APEX has no continuous duplex yet. Defer to Phase 4.

| Pattern | Meridian source | Notes |
|---|---|---|
| OpenAI Realtime session router | `server/routers/realtimeRouter.ts` (2,269 lines) | Ephemeral token via `/v1/realtime/client_secrets`, WebRTC flow, rate limit 5/min, 2-min session lock |
| Gemini Live router (alternative) | `server/routers/geminiRouter.ts` *(not shown but exists)* | Backup model path |
| Realtime voice chat client | `client/src/components/RealtimeVoiceChat.tsx` (2,798 lines) | WebRTC peer connection, data channel events |
| Gemini voice chat client | `client/src/components/GeminiVoiceChat.tsx` | Alternative client for Gemini Live |
| Voice action tools | `server/utils/voiceActions.ts` (6,356 lines!) | **70+ tools** with structured JSON schemas; `executeVoiceAction()` dispatcher |
| Active call context | `client/src/contexts/VoiceCallContext.tsx` (218 lines) | Single-active-bot guard, scoped end/start, restore-fn registration |
| Voice activity orb (waveform) | `client/src/components/VoiceActivityOrb.tsx` | Visual feedback during continuous call |
| Voice draft tasks review | `client/src/components/VoiceDraftTasksReview.tsx` | Preview tasks the AI proposed from the call |

**Hard-won lessons** (preserved verbatim from Meridian's own
`voice-bot-analysis.md` and `voice-chat-diagnosis.md`):
- **Echo loops** require multi-layer defense: mic gate while AI
  speaks + post-speech cooldown 700ms + VAD threshold 0.85 +
  silenceDurationMs 800-1200ms + getUserMedia with
  `echoCancellation/noiseSuppression/autoGainControl` + WebRTC (not
  WebSocket relay).
- **System prompt bloat** causes model loops and truncation.
  Compress to ~3-5K tokens; expose detail via `lookup_*` tools.
- **VAD over-triggering** — 700ms silenceDurationMs is too tight;
  1000-1200ms is safer.
- **iOS audio autoplay** is blocked outside a user gesture.
  Prime with a silent 1-frame audio buffer inside the mic-tap handler
  (Assay does this in `MicCheckScreen` — see §6 below).
- **Audio session category** — `.duckOthers` not `.mixWithOthers`
  on iOS 17+ to stop music conflicts.
- **Session resumption** — Gemini drops at ~10 min. Server returns
  `sessionHandle` in `setupComplete`; client reconnects with it.
- **Concurrent session control** — only 1 active per user, 2-min
  TTL auto-expire, 5/min rate limit.

**Reference docs in Meridian to read before building Tier 2:**
- `voice-bot-analysis.md`
- `voice-chat-diagnosis.md`
- `VOICE_UX_IMPROVEMENTS.md`

---

## 3. Agentic Memory System (planned port)

> Status: APEX has `server/agentic-memory.ts` (313 lines) — a starting
> point. Meridian's system is far more developed. Phase 3 hardens
> APEX's to Meridian-grade.

### Schema

`agenticMemories` table (Meridian, `drizzle/schema.ts:1217-1316`):

| Field group | Fields |
|---|---|
| Identity | `id`, `userId`, `scope` (user/project/global), `category` (preference/fact/pattern/insight/relationship_core) |
| Content | `key` (namespaced), `value`, `rationale`, `citations[]` |
| Trust | `confidence` (0-1), `verified`, `needsVerification`, `lastVerified`, `sourceHash` |
| Lifecycle | `expiresAt`, `isPinned`, `status` (active/archived), `citationCount`, `lastCitedAt` |
| Bi-temporal | `validFrom`, `invalidatedAt`, `invalidatedReason` |
| Provenance | `sourceType`, `sourceId` (link back to raw interaction) |
| Retrieval | `embedding` (1536-dim JSON), `keywords[]` (A-MEM), `linkedMemoryIds[]` (Zettelkasten) |
| Subject | `subjectPersonId`, `subjectCompanyId` (indexed) |

For APEX, **narrow the categories** to:
- `mandate` — versioned role expectations
- `observation` — behavioral evidence about a person
- `commitment` — what someone said they'd do
- `pattern` — repeated AI-detected patterns
- `guidance` — written or verbal coaching notes

### Core modules

| Module | Meridian source | Purpose |
|---|---|---|
| Storage + retrieval | `server/_core/agenticMemory.ts` (~1,500 lines) | `storeMemory`, `retrieveMemories`, `retrieveRelevantMemories`, `retrieveHybridMemories`, `verifyMemory`, `formatMemoriesForPrompt` |
| Embeddings | `server/_core/embeddings.ts` | `generateEmbedding`, `prepareMemoryText`, `cosineSimilarity` |
| Memory-enhanced AI invocation | `server/_core/memoryEnhancedAI.ts` | `invokeWithMemory`, `learnPreference`, `learnFact`, `learnPattern` |
| Memory context builder | `server/_core/memoryContext.ts` | Builds context per AI feature (chat, meeting prep, insights, etc.) |
| Memory enrichment | `server/_core/memoryEnrichment.ts` | `enrichAllMemories` — extracts from all data sources |
| Memory enrichment triggers | `server/_core/memoryEnrichmentTrigger.ts` | Fire on reflection / goal-completion / meeting-note events |
| Memory verification | `server/_core/memoryVerification.ts` | `getUnverifiedMemories`, `approveMemory`, `editMemory`, `rejectMemory` |
| Cross-feature sync | `server/_core/memorySync.ts` | `syncMeetingSchedule`, `syncTaskCompletion`, `syncGoalProgress`, etc. |
| Memory quality scoring | `server/_core/memoryQuality.ts` | Confidence decay (30d×0.95 → 180d×0.70), contradiction detection |
| Memory dedup | `server/_core/memoryDedup.ts` | Near-duplicate detection at 0.92 cosine, merge logic |
| Memory consolidation | `server/intelligence/memoryConsolidation.ts` | LLM-merge old similar memories into summaries |
| Memory utils | `server/memoryUtils.ts` | `getRelevantMemories`, `createConversationMemory`, `formatMemoriesForPrompt`, `detectSignificantExchange` |

### Background schedulers

| Scheduler | Meridian source | Cadence | Purpose |
|---|---|---|---|
| Consolidation | `server/memoryConsolidationScheduler.ts` | every 24h | Run `enrichAllMemories` to extract new memories |
| Quality | `server/memoryQualityScheduler.ts` | nightly 2am | Decay + contradiction detection |
| Dedup | `server/memoryDedupScheduler.ts` | weekly Sun 3am | Find / merge near-duplicates |

For APEX, **run consolidation monthly at cycle close** instead of
daily — aligns with the rhythm and saves LLM cost. Run quality
nightly. Run dedup weekly (or on demand).

### Routers + UI

| Surface | Meridian source | Purpose |
|---|---|---|
| AI memory router | `server/routers/aiMemoryRouter.ts` | CRUD + listing endpoints |
| Memory dashboard router | `server/routers/memoryDashboardRouter.ts` | Admin stats |
| Semantic memory router | `server/routers/memoryRouter.ts` | Semantic-search endpoints |
| Verification page | `client/src/pages/MemoryVerificationPage.tsx` | Approve/edit/reject UI |
| Admin dashboard | `client/src/pages/MemoryAdminDashboard.tsx` | Total memories, confidence dist, contradictions, flagged rows |
| Management page | `client/src/pages/MemoryManagementPage.tsx` | User-facing "what does the AI know about me?" |
| Insights dashboard | `client/src/pages/MemoryInsightsDashboard.tsx` | Analytics over memories |
| Preview / merge log | `client/src/pages/MemoryPreviewPage.tsx` | Dry-run consolidation, see merge log |
| Consolidation settings | `client/src/components/MemoryConsolidationSettings.tsx` | Phase 2 opt-in UI |
| Recent consolidations card | `client/src/components/RecentMemoryConsolidationsCard.tsx` | **Transparency UI — "here's what AI merged this week"** |
| Memory section component | `client/src/components/AiMemorySection.tsx` | Group memories by category |
| Memory recall particles | `client/src/components/MemoryRecallParticles.tsx` | Visual effect when AI is retrieving |

**The transparency UI (RecentMemoryConsolidationsCard) is exceptional
product design — port it.** It builds trust by showing users what the
AI has been doing to their memory bank.

### Reference doc in Meridian to read

- `docs/maps/ai-agentic-memory.md` — 32K-token deep map of the whole
  system

---

## 4. Communication Style Memory (planned port)

> Status: APEX doesn't have this yet. Highest-leverage application:
> the Chairman's guidance-note voice. Phase 3.

| Pattern | Meridian source | Notes |
|---|---|---|
| Style memory service | `server/services/commStyleMemory.ts` | Learns avg length, tone, emoji use, common openings/closings, key phrases, AI-draft acceptance rate per (recipient × context) tuple |
| Style types | `commStyleMemory.ts:32-40` | `general / birthday / follow_up / introduction / stay_connected / professional / personal / broadcast` |
| LearnedStylePattern | `commStyleMemory.ts:42-52` | Schema for what's learned |
| StyleContext output | `commStyleMemory.ts:54-60` | Ready-to-inject prompt fragment |

For APEX, repurpose for Chairman guidance notes:
- StyleType = `guidance` (replaces Meridian's recipient-context tuple)
- Subject = the role being guided (CXO, CEO)
- Learn from `chairmanGuidance.guidanceText` history (~288 notes/year)

---

## 5. Meeting templates with specialized section components (planned port)

> Status: APEX has `Meetings.tsx` but it's minimal. Phase 2 expansion.

| Pattern | Meridian source | Notes |
|---|---|---|
| Templates server module | `server/templates.ts` | 3 templates: CEO Weekly Sync-Up (6 sections), CXO 1:1, Quick Check-in |
| MeetingNotesPage | `client/src/pages/MeetingNotesPage.tsx` *(referenced)* | Dynamic section rendering |
| Metrics section | `client/src/components/MetricsSection.tsx` | Structured add/remove of metric inputs |
| Check-in section | `client/src/components/CheckinSection.tsx` | Emoji mood selectors + text notes |
| Wins & Challenges | `client/src/components/WinsChallengesSection.tsx` | Two-column layout |
| Asks section | `client/src/components/AsksSection.tsx` | Structured asks with H/M/L priority |
| Strategic Topics | `client/src/components/StrategicTopicsSection.tsx` | Bullet list with rich text |
| Personal Check-in | `client/src/components/PersonalCheckinSection.tsx` | Mood + personal notes |
| Meeting context alerts | `server/routers/peopleRouter.ts:meetingContext` *(referenced)* | Overdue asks, sentiment warnings, gap-since-last-meeting |

For APEX, build at minimum:
- **1:1 Prep** template — last cycle's plan-to-log gap, recent
  observations, open guidance, suggested topics
- **CEO ↔ MD Weekly Sync** — financial snapshot, top concerns, asks
- **Cycle Calibration** — inconsistencies, edge cases, proposed
  adjustments (CHRO + Chairman)

---

## 6. iOS native quirks (planned port)

> Status: APEX is web-only today. Phase 4 brings Capacitor wrapper.

### From Meridian

- **Capacitor config:** `meridian-ref/capacitor.config.ts`
- **iOS native code:** `meridian-ref/ios/` (full Xcode project)
- **iOS audio fix incident:** the latest Meridian commit (visible
  from the GitHub screenshot you shared) was `fix(ios audio):
  .mixWithOthers → .duckOthers — iOS 17+ voic[e]`. Lesson: on iOS 17+,
  voice agent audio must be `AVAudioSessionCategoryOptions.duckOthers`
  not `.mixWithOthers` or background music will fight the agent.
- **MPNowPlayingInfoCenter bridge:** `client/src/lib/nowPlayingBridge.ts`

### From Assay-Managerai

- **Silent-buffer audio priming** for iOS Safari autoplay block:
  `artifacts/assay-app/src/pages/InterviewPage.tsx:68-76` — inside
  `MicCheckScreen.primeAudioAutoplay()`:
  ```ts
  const a = new Audio();
  a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  a.volume = 0;
  a.setAttribute('playsinline', 'true');
  a.play().catch(() => {});
  ```
  Must run synchronously inside a user-gesture handler. Without this,
  AI voice silently won't play.

- **Gemini Live engine with session resumption:**
  `artifacts/assay-app/src/lib/geminiLiveEngine.ts` (1,095 lines).
  Voice "Kore", `AUDIO`-only response modality,
  `automaticActivityDetection` with LOW sensitivity,
  `silenceDurationMs: 700`, `prefixPaddingMs: 300`,
  `START_OF_ACTIVITY_INTERRUPTS`, `sessionResumption: { handle }` for
  reconnect through Gemini's ~10-min connection drop.

- **Interview-status state machine:**
  `InterviewPage.tsx:14` — `connecting → idle → ai_speaking →
  listening → processing → reconnecting`. The whole UI is driven
  off these states.

---

## 7. Quick-capture two-step pattern (already exists in APEX, polish needed)

> Status: APEX has the shell (`Capture.tsx`); Meridian's pattern is
> more refined.

Meridian flow (from `MERIDIAN_DESIGN_DOCUMENT_V2.md`):
1. AI parses what user said.
2. UI shows detected type + domain + person + date + priority +
   company **with confidence badges**.
3. Three action buttons: **"Accept as Task"**, **"Just save as note"**,
   **Dismiss (X)**.
4. Backend endpoints: `quickCapture.create`, `quickCapture.accept`,
   `quickCapture.dismiss`.

Adopt for APEX:
- Show confidence badges on parsed intents.
- Two CTAs minimum: "Accept" (commits to specific destination) +
  "Just save as note" (fall-back to a private note for later
  triage).
- Backend persists the parse-attempt before the user commits, so a
  failed/abandoned capture isn't lost.

---

## 8. 3D Sentiment for CEOs (consider for APEX)

> Status: not in APEX. Could fit nicely with cycle assessments.

Meridian splits CEO sentiment into 3 dimensions:
- `sentimentShortTerm` — business performance now
- `sentimentLongTerm` — business trajectory
- `sentimentLeader` — Chairman's confidence in the person

Schema: `meridian-ref/drizzle/schema.ts` people table.

For APEX, this maps cleanly to:
- Cycle-level `governanceAssessments` already capture "score"
- Adding a 2nd and 3rd dimension on CEO targets (only) gives the
  Chairman a richer picture without changing the schema for CXOs

Worth discussing whether to add to Phase 3 alongside agentic memory.

---

## 9. Action Item Dashboard (worth borrowing)

> Status: APEX has chronic-deferral detection in `ai-commitment.ts`
> which is conceptually related. Meridian's UI surface is more useful.

| Pattern | Meridian source | Notes |
|---|---|---|
| Action item extraction | `server/routers/actionItems.ts` *(referenced)* | Parses unconverted items from meeting notes' `aiExtracted` JSON |
| Action items page | `client/src/pages/ActionItemsPage.tsx` *(referenced)* | Grouped by person, priority badges, "Convert to Task" button |

For APEX: a similar `/commitments` page rolling up unfinished plan
items + observations marked actionable, with "Convert to mandate
note" / "Carry to next cycle" actions.

---

## 10. Hard rules / "DEFERRED.md" pattern

> Meridian keeps a `DEFERRED.md` at repo root listing items the team
> consciously chose not to do, with rationale. This is the same idea
> as our "Open Decisions" + "What APEX is NOT" but at a finer grain.

For APEX: when something gets discussed and rejected mid-build,
record it in `docs/MASTER_PLAN.md` §6 (anti-list) or §7 (open
decisions). Don't lose the trail.

---

## What we are explicitly NOT porting from Meridian

To save you time later when you wonder whether to bring something
across:

- **Email / Gmail intelligence** — Meridian reads inbox, builds
  relationship intelligence from email. Out of scope for APEX.
- **Calendar Google/Outlook sync** — Meridian syncs calendars. APEX
  has `server/calendar.ts` but is not pursuing OAuth integration to
  external calendars in Phase 1-4.
- **YPO Forum support** — Meridian has full Forum management (forum
  captures, forum commitments, forum members). APEX has its own
  governance cycle; no Forum overlap.
- **3D sentiment for non-CEOs** — Meridian extends 3D sentiment to
  all CEO-type people. APEX would only use it for CEOs at most.
- **Daily emotion journal** — Meridian's mood-tracking. APEX
  doesn't pursue this; reflections are monthly, not daily.
- **PWA offline queue** — Meridian has `offlineVoiceQueue.ts` for
  voice capture without network. Useful eventually; not in Phase 1-3.
- **`MemoryRecallParticles` visual effect** — flashy but not essential.
- **Family relationships, person tiers / circles, network knowledge
  graphs (`find_who_knows`, `find_expert_in`, `find_intro_path`)** —
  Meridian is fundamentally a relationship app. APEX is a rhythm
  app. Different lens, different features.

---

## Citation convention when porting

When you port code from Meridian to APEX, add a header comment like:

```ts
/**
 * voiceTwoStepCapture.ts — APEX
 *
 * Adapted from Meridian's UniversalVoiceAssistant.tsx
 * (My apps/meridian-ref/client/src/components/UniversalVoiceAssistant.tsx).
 *
 * APEX adaptations:
 *  - Narrowed intent types to 8 (Meridian has ~14).
 *  - Removed family/personal domains (APEX is work-only).
 *  - Added cycle-context awareness via useViewer().
 */
```

This preserves the lineage when the next reader inevitably wonders
"why does this look like Meridian?" and goes searching.

---

*See `docs/MASTER_PLAN.md` for the strategic plan. This file is a
permanent reference, not a working doc; update it only when
adding/removing rows.*
