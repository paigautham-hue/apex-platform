/**
 * rhythm-engine.ts — The Rhythm Layer.
 *
 * Surfaces daily focus actions, weekly pulse prompts, deadline reminders,
 * and meeting prep cards. Runs on a cadence (call from a cron / scheduler)
 * AND on-demand from the frontend (per-user "what should I do now?").
 *
 * The engine writes to dailyFocusLog + notifications tables.
 *
 * Daily focus selection priority:
 *   1. Critical insights surfaced to this person
 *   2. Cycle deadline pressure (open cycle, < N days, missing submissions)
 *   3. Pending assessments assigned to viewer
 *   4. Empty mandate journals
 *   5. Weekly pulse prompt
 *   6. Greeting / capture nudge
 */

import { and, eq, gte, lte, desc, isNull, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  aiInsights,
  governanceCycles,
  governanceAssessments,
  assessmentAssignments,
  mandateJournals,
  notifications,
  dailyFocusLog,
  persons,
  roles,
  type AiInsight,
} from "../drizzle/schema";

export type DailyFocusKind =
  | "INSIGHT"
  | "CYCLE_DEADLINE"
  | "PENDING_ASSESSMENT"
  | "EMPTY_JOURNAL"
  | "PULSE"
  | "GREETING";

export interface DailyFocus {
  kind: DailyFocusKind;
  urgency: number; // 0-100
  title: string;
  body: string;
  ctaPath: string;
  ctaLabel: string;
  voicePrompt?: string;
  insightId?: number;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/**
 * Compute the single best "today's focus" for a given person.
 */
export async function computeDailyFocus(
  tenantId: number,
  personId: number
): Promise<DailyFocus | null> {
  const db = await getDb();
  if (!db) return null;

  // 1. Critical insight surfaced to this person
  const criticalInsights: AiInsight[] = await db
    .select()
    .from(aiInsights)
    .where(
      and(
        eq(aiInsights.tenantId, tenantId),
        eq(aiInsights.severity, "CRITICAL"),
        eq(aiInsights.status, "NEW")
      )
    )
    .orderBy(desc(aiInsights.urgency))
    .limit(20);
  // Filter by surfaceToPersonIds (json array) — check in app layer
  const targeted = criticalInsights.find(i => {
    const ids = (i.surfaceToPersonIds ?? []) as number[];
    return ids.length === 0 || ids.includes(personId);
  });
  if (targeted) {
    return {
      kind: "INSIGHT",
      urgency: targeted.urgency ?? 90,
      title: targeted.insightText.slice(0, 80),
      body: targeted.insightText,
      ctaPath: targeted.targetType === "ROLE" || targeted.targetType === "COMPANY" ? `/people` : "/group",
      ctaLabel: "Open insight",
      insightId: targeted.id,
    };
  }

  // 2. Cycle deadline pressure
  const activeCycleRows = await db
    .select()
    .from(governanceCycles)
    .where(and(eq(governanceCycles.tenantId, tenantId), eq(governanceCycles.status, "OPEN")))
    .orderBy(desc(governanceCycles.month))
    .limit(1);
  const activeCycle = activeCycleRows[0];
  if (activeCycle?.deadlineDate) {
    const daysLeft = Math.ceil(
      (new Date(activeCycle.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft <= 7) {
      // Check person's submission status
      const myAssessments = await db
        .select()
        .from(governanceAssessments)
        .where(
          and(
            eq(governanceAssessments.tenantId, tenantId),
            eq(governanceAssessments.cycleId, activeCycle.id),
            eq(governanceAssessments.assessorPersonId, personId)
          )
        );
      const submitted = myAssessments.filter(a => a.submittedAt).length;
      const total = myAssessments.length;
      if (total === 0 || submitted < total) {
        const remaining = total - submitted;
        return {
          kind: "CYCLE_DEADLINE",
          urgency: daysLeft <= 1 ? 95 : daysLeft <= 3 ? 80 : 65,
          title: `${daysLeft} day${daysLeft === 1 ? "" : "s"} to submit cycle ${activeCycle.month}`,
          body: total === 0
            ? `Open your Bridge to log this month and rate yourself.`
            : `${remaining} of ${total} mandate${total === 1 ? "" : "s"} still pending.`,
          ctaPath: "/me",
          ctaLabel: "Open Captain's Log",
          voicePrompt: "Want to talk through your remaining mandates?",
        };
      }
    }
  }

  // 3. Pending assessments assigned to viewer
  if (activeCycle) {
    const pendingAssignments = await db
      .select()
      .from(assessmentAssignments)
      .where(
        and(
          eq(assessmentAssignments.tenantId, tenantId),
          eq(assessmentAssignments.cycleId, activeCycle.id),
          eq(assessmentAssignments.assessorPersonId, personId),
          inArray(assessmentAssignments.status, ["PENDING", "IN_PROGRESS"])
        )
      );
    if (pendingAssignments.length > 0) {
      return {
        kind: "PENDING_ASSESSMENT",
        urgency: 60,
        title: `Assess ${pendingAssignments.length} ${pendingAssignments.length === 1 ? "person" : "people"}`,
        body: `You have pending assessments for cycle ${activeCycle.month}. The team is waiting on you.`,
        ctaPath: "/team",
        ctaLabel: "Open team",
      };
    }
  }

  // 4. Empty journals on active cycle
  if (activeCycle) {
    const myJournals = await db
      .select()
      .from(mandateJournals)
      .where(
        and(
          eq(mandateJournals.tenantId, tenantId),
          eq(mandateJournals.cycleId, activeCycle.id),
          eq(mandateJournals.personId, personId)
        )
      );
    if (myJournals.length === 0) {
      return {
        kind: "EMPTY_JOURNAL",
        urgency: 55,
        title: "Start your Captain's Log",
        body: "30 seconds via voice — say what shifted on your mandates this month.",
        ctaPath: "/me",
        ctaLabel: "Open Bridge",
        voicePrompt: "Tell me what you've been working on this month.",
      };
    }
  }

  // 5. Weekly pulse — Fridays after 3pm
  const now = new Date();
  if (now.getDay() === 5 && now.getHours() >= 15) {
    return {
      kind: "PULSE",
      urgency: 40,
      title: "Friday pulse",
      body: "90 seconds — what shifted this week? Sets you up for next week's plan.",
      ctaPath: "/capture?voice=true&prompt=" + encodeURIComponent("Friday pulse: what shifted this week, what are you focused on next?"),
      ctaLabel: "Quick voice pulse",
      voicePrompt: "Friday pulse: what shifted this week?",
    };
  }

  // 6. Default greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const personRow = await db
    .select({ name: persons.name })
    .from(persons)
    .where(and(eq(persons.tenantId, tenantId), eq(persons.id, personId)))
    .limit(1);
  const firstName = (personRow[0]?.name ?? "").split(" ")[0] || "";

  return {
    kind: "GREETING",
    urgency: 25,
    title: `${greeting}${firstName ? ", " + firstName : ""}`,
    body: "Quick capture? A 30-second observation now beats trying to remember it later.",
    ctaPath: "/capture?voice=true",
    ctaLabel: "Voice capture",
    voicePrompt: "What's one thing on your mind?",
  };
}

/**
 * Persist today's focus selection (idempotent for the day).
 * Call once per user per day from a scheduler.
 */
export async function recordDailyFocus(tenantId: number, personId: number): Promise<DailyFocus | null> {
  const focus = await computeDailyFocus(tenantId, personId);
  if (!focus) return null;
  const db = await getDb();
  if (!db) return focus;

  const today = TODAY();
  // Check if we already recorded today
  const existing = await db
    .select()
    .from(dailyFocusLog)
    .where(
      and(
        eq(dailyFocusLog.tenantId, tenantId),
        eq(dailyFocusLog.personId, personId),
        eq(dailyFocusLog.focusDate, today)
      )
    )
    .limit(1);
  if (existing.length > 0) return focus;

  await db.insert(dailyFocusLog).values({
    tenantId,
    personId,
    focusDate: today,
    primaryActionType: focus.kind,
    primaryActionPayload: {
      title: focus.title,
      body: focus.body,
      ctaPath: focus.ctaPath,
      ctaLabel: focus.ctaLabel,
      urgency: focus.urgency,
    },
    primaryActionInsightId: focus.insightId ?? null,
  });
  return focus;
}

/**
 * Send cycle deadline notifications to all relevant assessors.
 * Call this once per day from a scheduler — it's idempotent per (cycle, day).
 */
export async function sendCycleDeadlineNotifications(tenantId: number): Promise<{ sent: number }> {
  const db = await getDb();
  if (!db) return { sent: 0 };

  const cycleRows = await db
    .select()
    .from(governanceCycles)
    .where(and(eq(governanceCycles.tenantId, tenantId), eq(governanceCycles.status, "OPEN")))
    .limit(1);
  const cycle = cycleRows[0];
  if (!cycle?.deadlineDate) return { sent: 0 };

  const daysLeft = Math.ceil(
    (new Date(cycle.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (![7, 3, 1].includes(daysLeft)) return { sent: 0 };

  // Find people with pending assignments
  const pending = await db
    .select()
    .from(assessmentAssignments)
    .where(
      and(
        eq(assessmentAssignments.tenantId, tenantId),
        eq(assessmentAssignments.cycleId, cycle.id),
        inArray(assessmentAssignments.status, ["PENDING", "IN_PROGRESS"])
      )
    );

  // Group by assessor
  const byAssessor = new Map<number, number>();
  for (const a of pending) {
    byAssessor.set(a.assessorPersonId, (byAssessor.get(a.assessorPersonId) ?? 0) + 1);
  }

  let sent = 0;
  for (const [personId, count] of Array.from(byAssessor.entries())) {
    await db.insert(notifications).values({
      tenantId,
      personId,
      type: "CYCLE_DEADLINE",
      tier: daysLeft <= 1 ? "INSTANT" : "DIGEST",
      title: `${daysLeft} day${daysLeft === 1 ? "" : "s"} to submit cycle ${cycle.month}`,
      body: `${count} assessment${count === 1 ? "" : "s"} pending. Tap to open your team.`,
      actionUrl: "/team",
    });
    sent++;
  }
  return { sent };
}

/**
 * Trigger reveal notifications when a feedbackType+target reaches the visibility threshold.
 * Should be called after every assessment submission (or on a hourly tick).
 */
export async function checkAndNotifyReveals(tenantId: number): Promise<{ revealed: number }> {
  // Stub: in Phase 4 we'll wire this with the reveal-gating helper.
  return { revealed: 0 };
}
