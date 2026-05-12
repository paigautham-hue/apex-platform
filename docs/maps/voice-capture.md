# voice-capture

> Last updated: 2026-04-21

## Purpose

The **tap-to-talk voice input layer** — `Capture.tsx` is the
voice-first universal capture surface. User taps mic, AI classifies
intent (10 types), user confirms, AI routes to the right write
destination (journal / plan / observation / decision / reflection /
etc.).

Per master plan §5.4 Tier 1. Tier 2 (continuous duplex via
WebRTC + Realtime API) is planned for Phase 4 and gets its own map.

## Scope

- Files in this map: 5 client + 3 server
- tRPC endpoints: 3 in `voiceRouter`
  (`classifyIntent`, `dispatchIntent`, `uploadAudio`)
- Tables touched: `voiceSessions` (stub), plus downstream destinations

## Files

| File | Purpose | Key exports |
|---|---|---|
| `client/src/pages/Capture.tsx` | The voice-first capture page. State machine: idle → listening → processing → preview → confirmed. Web Speech API for transcription. | `Capture` (default) |
| `client/src/components/VoiceInput.tsx` | Reusable mic button + waveform indicator. Used inline in many pages (PersonProfile mandate editor, MyIsland reflection form, etc.). | `VoiceInput` |
| `client/src/components/VoiceJournalCapture.tsx` | Specialised voice surface for mandate journal writes. | `VoiceJournalCapture` |
| `server/routers/voice.ts` | The voice router. ~384 lines. `classifyIntent` (LLM call with structured output), `dispatchIntent` (route to the right write helper), `uploadAudio` (S3 upload of raw audio for Whisper). | `voiceRouter` |
| `server/ai-voice-intent.ts` | The classifier core — builds prompts, parses LLM output, returns typed `IntentClassification`. ~144 lines. | (functions used internally by voice router) |
| `server/_core/voiceTranscription.ts` | Whisper API wrapper. Sends audio URL, returns transcript. | `transcribeAudio` |
| `server/storage.ts` | S3-compatible upload helper for audio blobs. | `storagePut` |

## Functions

### `client/src/pages/Capture.tsx`

State machine:
- `idle` → mic tap → `listening` (Web Speech recognition active)
- `listening` → silence/stop → `processing` (LLM classifies intent)
- `processing` → `preview` (show parsed result + destination)
- `preview` → user confirm → `confirmed` (route to write endpoint)

Query params:
- `?voice=true` — auto-start recording on mount.
- `?prompt=<text>` — show a context prompt above the mic.

### `server/routers/voice.ts`

- **`uploadAudio({ audioData (base64), mimeType })`** — Saves to
  S3 with 16MB limit. Returns `{ url, fileKey }`.
- **`transcribe({ audioUrl, language?, prompt? })`** — Sends to
  Whisper. Returns `{ text, language, segments }`.
- **`classifyIntent({ transcription })`** — The LLM call. Uses
  structured-output JSON schema for typed result. Output shape:
  ```
  {
    intent: 'JOURNAL_ENTRY' | 'PLAN_ITEM' | 'SELF_RATING' |
            'REFLECTION' | 'OBSERVATION' | 'DECISION' |
            'MEETING_NOTE' | 'QUICK_NOTE',
    confidence: number,
    dimensionKey?: string,
    suggestedScore?: number,
    subjectPersonName?: string,
    rationale?: string
  }
  ```
- **`dispatchIntent({ intent, text, ... })`** — Routes the
  classified intent to the appropriate write helper in `db.ts`.

## Data Touched

- `voiceSessions` — stub today; planned write per voice session.
- Cross-cutting writes via dispatchIntent: `mandateJournals`,
  `observations`, `selfReflections`, `decisions`, etc.

## External Dependencies

- Web Speech API (`webkitSpeechRecognition`) — client-side
  transcription.
- Whisper API — server-side fallback / higher-quality transcription.
- LLM gateway via `_core/llm.ts` — for classification.
- `mysql2` (via Drizzle) for writes.

## Internal Conventions

1. **Parse → preview → confirm.** Per master plan §5.4: the user
   ALWAYS sees the AI's parsed intent before it's saved. Never
   silently route a voice input.
2. **Confidence-aware UI** (planned): if `confidence < 0.8`, the
   preview UI shows "Is this right?" prominently and requires a
   confirm tap. High-confidence allows implicit save on a Confirm
   button.
3. **Destination card** (planned, Phase 2): after save, show
   "Saved to: <path> · [View] [Capture another]". Today the page
   just navigates away — trust hinge that's currently broken.

## Forward & Backward Dependencies

**Backward:**

| Other subsystem | What we use from it |
|---|---|
| `ai-llm-gateway.md` *(planned)* | `invokeLLM` for intent classification. |
| `db-layer.md` | All the write helpers `dispatchIntent` calls. |
| `auth-rbac.md` | `protectedProcedure`, `ctx.user`. |

**Forward:**

| Other subsystem | What they use |
|---|---|
| `mandate-journals.md` | Voice path writes journals via `dispatchIntent`. |
| `observations.md` *(planned)* | Same — observation writes. |
| `reflections.md` *(planned)* | Same — reflection writes. |
| `decisions.md` *(planned)* | Same — decision writes. |
| `people-pages.md` | Inline `VoiceInput` in mandate editor. |
| `me-surface.md` | Inline voice on MyBridge/MyIsland. |

## Fragility Notes

### Web Speech API has variable quality

Different browsers, different OS-level speech engines. Mobile
Chrome on Android is excellent; mobile Safari on iOS 17 is
better than older versions but still drops syllables on accented
English. **Mitigation:** Whisper fallback via uploaded audio.
**Open decision §8 #2:** Whisper-only vs Web-Speech-first.

### Destination confirmation card not yet built

Per master plan §5.4 + `MERIDIAN_REFERENCE.md` §2.a — the
parse-preview-confirm contract requires showing the user where
the AI routed their input. Today the page just navigates away
post-save. **Phase 1 Tier C destination card is the trust hinge.**

### No multi-turn dialogue

Today the flow is one-shot: tap → speak → confirm → done. Meridian's
`UniversalVoiceAssistant.tsx` supports multi-turn (the AI asks
follow-ups). APEX defers this to Phase 2.

### iOS audio priming not yet wired

Without the silent-buffer audio prime inside a user gesture (see
`MERIDIAN_REFERENCE.md` §6), iOS Safari blocks AI voice playback.
**APEX's Tier 1 doesn't play AI voice today**, so the prime
isn't needed yet. Phase 2 Tier 2 (continuous duplex) needs it.

### Confidence threshold isn't surfaced

The classifier returns a `confidence` field but the UI doesn't
visibly differ between 0.6 and 0.95. **A real trust gap.** Phase
1 Tier C — show confidence-aware UI (a soft prompt for low
confidence).

### `dispatchIntent` has implicit destination-detection logic

When a voice input mentions a person name, the classifier
populates `subjectPersonName`. The dispatcher then looks up
`personId` server-side. **If the lookup fails (ambiguous name,
typo)**, the dispatcher silently drops the subject. **Defense:**
return a confirmation tier "we couldn't find Vishal — is this
right?" and ask the user.

### S3 upload bypasses the auth context for the audio file

The uploaded audio URL is publicly accessible (presigned). **In
practice this isn't a real risk** — the URLs are nonce-keyed and
short-lived — but it's worth knowing that voice content can leak
via URL exposure for the lifetime of the presigned URL.

### Voice transcription cost

Whisper API has per-minute pricing. A CXO doing a 5-minute
journal log via voice costs $0.03 per call. At full saturation
(~500 users × 12 cycles × 5 journals × 1 min) that's ~$900/year
on transcription alone. **Defense (Phase 3):** prefer Web Speech
on-device when available; Whisper only as fallback.
