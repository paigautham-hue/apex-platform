# APEX — Project Map

> Top-level index of every subsystem in the APEX codebase. Each row
> points to a per-subsystem map in `docs/maps/`. Read the relevant map
> before changing code in that subsystem. Update the map in the same
> commit as your change.
>
> The `MASTER_PLAN.md` sibling document defines what APEX **is** and
> what it **is not** at the strategic level. This file is the practical
> day-to-day index for the codebase.
>
> Last updated: 2026-04-21

---

## Subsystem index

Subsystems are grouped by concern. A file belongs to exactly one map.
If a file is genuinely cross-cutting (e.g. `server/db.ts`), it lives
in the most foundational map and is *referenced* (not duplicated) from
others via the Forward & Backward Dependencies section.

### Foundation

| Map | Covers | Status |
|---|---|---|
| [`data-model.md`](maps/data-model.md) | `drizzle/schema.ts`, `drizzle/relations.ts`, migrations, table groups | ✅ current (2026-04-21) |
| [`db-layer.md`](maps/db-layer.md) | `server/db.ts` — every query helper, RBAC primitives | ✅ current (2026-04-21) |
| [`auth-rbac.md`](maps/auth-rbac.md) | `server/_core/trpc.ts`, `client/src/_core/hooks/useAuth.ts`, `isChairmanOrAdmin`, `canEditCompanyFinancials`, `canAssessTarget` (planned) | ✅ current (2026-04-21) |
| [`tenant-context.md`](maps/tenant-context.md) | `server/tenant-context.ts`, `useViewer`, scope hooks | ✅ current (2026-04-21) |
| [`infra.md`](maps/infra.md) | `server/_core/index.ts`, `vite.config.ts`, `drizzle.config.ts`, build/test scripts, `package.json` | ✅ current (2026-04-21) |

### Rhythm core (the monthly cycle)

| Map | Covers | Status |
|---|---|---|
| [`governance-cycle.md`](maps/governance-cycle.md) | `governanceCycles`, `governanceAssessments`, `assessmentAssignments`, `feedbackTypes`, `reveal-gating.ts`, cycle state machine | ✅ current (2026-04-21) |
| [`mandate-journals.md`](maps/mandate-journals.md) | `mandateJournals`, MyBridge mandate-card pattern, plan-to-log tracking | ✅ current (2026-04-21) |
| [`company-reflections.md`](maps/company-reflections.md) | `companyReflections`, MyIsland reflection form, 5-field structure | ✅ current (2026-04-21) |
| [`chairman-guidance.md`](maps/chairman-guidance.md) | `chairmanGuidance`, ChairmanAssess writes, guidance display | ✅ current (2026-04-21) |
| [`rhythm-engine.md`](maps/rhythm-engine.md) | `server/rhythm-engine.ts`, `server/routers/rhythm.ts`, daily focus computation, PrimaryActionCard data source | ✅ current (2026-04-21) |

### People & org

| Map | Covers | Status |
|---|---|---|
| [`org-tree.md`](maps/org-tree.md) | `orgUnits`, `persons`, `roles`, `reportsToRoleId` hierarchy, `dependencyChains` | ✅ current (2026-04-21) |
| [`scope.md`](maps/scope.md) | `server/scope.ts`, `server/routers/scope.ts`, `client/src/hooks/useViewer.ts`, scoped queries (org tree, direct reports, team submission status) | ✅ current (2026-04-21) |
| [`people-pages.md`](maps/people-pages.md) | `People.tsx`, `PersonProfile.tsx`, person CRUD | ✅ current (2026-04-21) |

### Universal surfaces (the fractal pages)

| Map | Covers | Status |
|---|---|---|
| [`me-surface.md`](maps/me-surface.md) | `Me.tsx`, `MyBridge.tsx`, `MyIsland.tsx`, `TodayFeed.tsx`, `FirstCycleWelcome.tsx` — the personal workspace | ✅ current (2026-04-21) |
| [`team-surface.md`](maps/team-surface.md) | `Team.tsx`, direct-report cards, team-submission status | ✅ current (2026-04-21) |
| [`group-surface.md`](maps/group-surface.md) | `Group.tsx`, org-tree drill-in | ✅ current (2026-04-21) |
| [`chairman-surface.md`](maps/chairman-surface.md) | `ChairmanDashboard.tsx`, `ChairmanAssess.tsx`, Chairman-only features | ✅ current (2026-04-21) |

### 360 Feedback

| Map | Covers | Status |
|---|---|---|
| [`360-feedback.md`](maps/360-feedback.md) | `server/360-engine.ts`, `server/routers/threeSixty.ts`, `ThreeSixty.tsx`, radar chart, blind aggregation | ⏳ planned |

### Financial

| Map | Covers | Status |
|---|---|---|
| [`financial-cockpit.md`](maps/financial-cockpit.md) | `FinancialCockpit.tsx`, `Financial.tsx`, plans, metrics, metricValues, financial-analytics | ⏳ planned |
| [`incentives.md`](maps/incentives.md) | `IncentiveSimulator.tsx`, `incentiveConfigs`, `incentiveComputations` | ⏳ planned |

### Capture & voice

| Map | Covers | Status |
|---|---|---|
| [`voice-capture.md`](maps/voice-capture.md) | `Capture.tsx`, `VoiceInput.tsx`, `VoiceJournalCapture.tsx`, `server/ai-voice-intent.ts`, `server/routers/voice.ts` | ✅ current (2026-04-21) |
| [`voice-realtime.md`](maps/voice-realtime.md) | WebRTC + OpenAI Realtime path (planned Phase 4) | 🔮 planned-future (2026-04-21) |
| [`evidence-upload.md`](maps/evidence-upload.md) | `EvidenceUpload.tsx`, `DocumentUpload.tsx`, `ai-extraction.ts`, `financialUploads`, `evidence` table | ✅ current (2026-04-21) |

### AI surfaces

| Map | Covers | Status |
|---|---|---|
| [`ai-ask.md`](maps/ai-ask.md) | `AskInterface.tsx`, `server/ai-ask.ts` — RAG pipeline | ⏳ planned |
| [`ai-review.md`](maps/ai-review.md) | `server/ai-review.ts`, `ReviewDraftPreview.tsx`, `living-review-draft.ts`, `reviews` table | ⏳ planned |
| [`ai-commitment.md`](maps/ai-commitment.md) | `server/ai-commitment.ts` — chronic deferral detection, classifier | ⏳ planned |
| [`ai-insights.md`](maps/ai-insights.md) | `server/ai-insights-generator.ts`, `server/routers/insights.ts`, `InsightsInbox.tsx`, `aiInsights` table | ⏳ planned |
| [`ai-deliberation.md`](maps/ai-deliberation.md) | `server/ai-deliberation.ts`, `server/routers/deliberation.ts`, `AIDeliberationPanel.tsx` | ⏳ planned |
| [`agentic-memory.md`](maps/agentic-memory.md) | `server/agentic-memory.ts`, `server/routers/memory.ts`, `agenticMemories` table | ⏳ planned |
| [`ai-llm-gateway.md`](maps/ai-llm-gateway.md) | `server/_core/llm.ts`, model routing, prompt caching | ⏳ planned |

### Governance ops

| Map | Covers | Status |
|---|---|---|
| [`governance-admin.md`](maps/governance-admin.md) | `GovernanceAdmin.tsx`, cycle launch, assignment generation, feedback-type config | ⏳ planned |
| [`calibration.md`](maps/calibration.md) | `calibrationSessions` table, calibration UI (planned Phase 4) | ⏳ planned-future |

### Adjacent flows

| Map | Covers | Status |
|---|---|---|
| [`meetings.md`](maps/meetings.md) | `Meetings.tsx`, `MeetingTimer.tsx`, `meetings` table | ⏳ planned |
| [`goals.md`](maps/goals.md) | `Goals.tsx`, `plans`/`metrics` for goal-cascading | ⏳ planned |
| [`reflections.md`](maps/reflections.md) | `Reflections.tsx`, `selfReflections` table, `WeeklyPulseCheck.tsx`, `PulseCheckTrends.tsx` | ⏳ planned |
| [`decisions.md`](maps/decisions.md) | `Decisions.tsx`, `decisions` table | ⏳ planned |
| [`observations.md`](maps/observations.md) | `Capture.tsx` observation flow, `ObservationTimeline.tsx`, `observations` table | ⏳ planned |
| [`analytics.md`](maps/analytics.md) | `Analytics.tsx`, scope-aware analytics surfaces | ⏳ planned |

### Trust & access control

| Map | Covers | Status |
|---|---|---|
| [`access-control.md`](maps/access-control.md) | `accessGrants`, `accessChallenges`, `AccessGrants.tsx`, `AccessChallenge.tsx`, `server/routers/accessControl.ts` | ⏳ planned |
| [`trust-inbox.md`](maps/trust-inbox.md) | `TrustInbox.tsx`, `server/routers/trust.ts`, challenge resolution flow | ⏳ planned |
| [`sharing.md`](maps/sharing.md) | `server/routers/share.ts`, share-link generation, visibility rules | ⏳ planned |

### Notifications, preferences, onboarding

| Map | Covers | Status |
|---|---|---|
| [`notifications.md`](maps/notifications.md) | `notifications` table, `server/governance-notifications.ts`, `NotificationCenter.tsx`, `PushNotificationSetup.tsx`, digest cadence | ⏳ planned |
| [`preferences.md`](maps/preferences.md) | `userPreferences` table, `server/routers/preferences.ts`, `NotificationPreferences.tsx` | ⏳ planned |
| [`onboarding.md`](maps/onboarding.md) | `Onboarding.tsx`, `FirstCycleWelcome.tsx`, redirect logic in `DashboardLayout.tsx` | ⏳ planned |

### Calendar & integrations

| Map | Covers | Status |
|---|---|---|
| [`calendar.md`](maps/calendar.md) | `server/calendar.ts`, `server/routers/calendar.ts` | ⏳ planned |

### Admin & internal tooling

| Map | Covers | Status |
|---|---|---|
| [`admin.md`](maps/admin.md) | `Admin.tsx`, admin tabs (users, challenges, etc.) | ⏳ planned |
| [`seed-and-migrations.md`](maps/seed-and-migrations.md) | `server/seed-evergreen.ts`, `server/seed.mjs`, `scripts/migrate-*.mjs`, `drizzle/*.sql` | ⏳ planned |
| [`internal-tools.md`](maps/internal-tools.md) | `Map.tsx`, `ProfileViewAudit.tsx`, `ComponentShowcase.tsx`, `query-cache.ts` | ⏳ planned |

### Shell / layout / shared UI

| Map | Covers | Status |
|---|---|---|
| [`shell-layout.md`](maps/shell-layout.md) | `App.tsx`, `DashboardLayout.tsx`, `MobileBottomNav.tsx`, `FloatingActionButton.tsx`, `CommandPalette.tsx`, `ErrorBoundary.tsx` | ⏳ planned |
| [`shared-types.md`](maps/shared-types.md) | `shared/types.ts`, `shared/const.ts`, `shared/constants.ts`, `client/src/lib/*`, generic UI components in `client/src/components/ui/` | ⏳ planned |

---

## Status legend

- ✅ **current** — last reviewed within the past 14 days, drift = 0
- ⚠️ **drifted** — known to be behind code; check-map-drift will flag
- ⏳ **planned** — not yet written (this is the initial state for most
  maps; we write them in Phase 1 of the bootstrap)
- 🔮 **planned-future** — covers a subsystem that doesn't exist in code
  yet but is on the master plan; write the map when the subsystem
  lands

---

## How to read this index

1. Find the subsystem you're about to change.
2. Open its map.
3. Read **Fragility Notes** carefully — those are the landmines.
4. Make your change.
5. Update the map (Files, Functions, Fragility Notes, Forward &
   Backward Dependencies) in the same commit.
6. Push. If `check-map-drift` flags drift, fix the map before
   bypassing.

If your change spans subsystems, update every affected map.

If you're adding a brand-new subsystem (a new top-level concern in the
product), add a row to this index AND create the map file. New rows
must be merged with sign-off from the master plan — they typically
correspond to a phase milestone.
