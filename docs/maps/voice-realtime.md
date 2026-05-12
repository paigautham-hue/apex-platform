# voice-realtime

> Last updated: 2026-04-21

## Purpose

The **continuous duplex voice agent** — WebRTC + OpenAI Realtime
API (`gpt-realtime-2`). Per master plan §5.4 Tier 2 / Phase 4.

**Status: planned, not built.** This map exists as the destination
spec so that when Phase 4 wires the realtime agent, the design
constraints are already documented and we don't re-derive them.

## Scope

- Files in this map (planned): WebRTC client + voice context +
  realtime router + tool definitions
- Status: 🔮 planned-future

## Files (planned)

| File | Purpose (planned) | Status |
|---|---|---|
| `server/routers/realtime.ts` | Ephemeral token minting + session config. | not yet exists |
| `server/utils/voiceActions.ts` | The ~25 voice tool definitions (capture / assess / read / cycle ops / drafting / navigation). | not yet exists |
| `client/src/contexts/VoiceCallContext.tsx` | Singleton active-call state (one bot at a time, single-active-bot guard). | not yet exists |
| `client/src/components/RealtimeVoiceChat.tsx` | The WebRTC peer connection + audio pipeline + dialogue UI. | not yet exists |
| `client/src/components/VoiceActivityOrb.tsx` | Visual feedback during continuous calls. | not yet exists |

## Forward & Backward Dependencies

**Backward (planned):**

| Other subsystem | What we will use |
|---|---|
| `voice-capture.md` | Some shared classification logic. |
| `ai-llm-gateway.md` *(planned)* | Token minting for Realtime API. |
| `db-layer.md` | Read helpers exposed as voice tools. |
| `auth-rbac.md` | Session gating. |

## Fragility Notes (anticipated)

See `MERIDIAN_REFERENCE.md` §2.b for the hard-won lessons we'll
need:
- Echo loops require layered defense (mic gate + cooldown + VAD
  threshold + getUserMedia options + WebRTC over WebSocket).
- System prompt bloat → model loops; compress + use lookup tools.
- Session resumption pattern (for Gemini Live's ~10-min drop).
- Concurrent session lock (one per user, 2-min TTL).
- iOS audio priming inside user gesture.
- Audio session `.duckOthers` on iOS 17+.
- `MPNowPlayingInfoCenter` lock-screen bridge.

**Don't build any of this without first re-reading
`MERIDIAN_REFERENCE.md` §2.b.**

---

*This map will be expanded substantially when Phase 4 builds the
realtime agent.*
