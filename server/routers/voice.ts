/**
 * Voice router — server-side handlers for voice capture and live conversation.
 *
 * Endpoints:
 *   - classifyIntent: take a finished transcript, return structured intent
 *   - dispatchIntent: write the intent to the right table (journal, plan, etc.)
 *   - startSession / endSession: track live voice sessions
 *   - getEphemeralRealtimeToken: ephemeral token for OpenAI Realtime API
 *     (when configured). Falls back to error message.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../db";
import { resolveViewerScope, canViewPerson } from "../scope";
import { classifyVoiceIntent } from "../ai-voice-intent";
import {
  voiceSessions,
  mandateJournals,
  governanceAssessments,
  selfReflections,
  observations,
  decisions,
  persons,
  governanceCycles,
} from "../../drizzle/schema";

const TENANT_ID = 1;

export const voiceRouter = router({
  /**
   * Classify a transcript into a structured intent without writing anything.
   * Frontend uses this to ask "what did the user mean?" before confirming.
   */
  classifyIntent: protectedProcedure
    .input(
      z.object({
        transcript: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });

      const scope = await resolveViewerScope(person, TENANT_ID);

      // Available dimensions = caller's mandates (role.successMetrics)
      const availableDimensions = (scope.primaryRole?.successMetrics ?? []) as string[];

      // Available subjects = direct reports' names
      const dbi = await getDb();
      let availableSubjects: string[] = [];
      if (dbi && scope.directReportPersonIds.length > 0) {
        const reps = await dbi
          .select({ name: persons.name })
          .from(persons)
          .where(
            and(
              eq(persons.tenantId, TENANT_ID),
              inArray(persons.id, scope.directReportPersonIds)
            )
          );
        availableSubjects = reps.filter(r => r.name).map(r => r.name);
      }

      return await classifyVoiceIntent({
        transcript: input.transcript,
        availableDimensions,
        availableSubjects,
      });
    }),

  /**
   * Dispatch a confirmed intent: write it to the appropriate table.
   * Returns { ok: true, entityType, entityId } so frontend can navigate.
   */
  dispatchIntent: protectedProcedure
    .input(
      z.object({
        intent: z.enum([
          "JOURNAL_ENTRY",
          "PLAN_ITEM",
          "SELF_RATING",
          "REFLECTION",
          "OBSERVATION",
          "DECISION",
          "MEETING_NOTE",
          "QUICK_NOTE",
        ]),
        text: z.string(),
        dimensionKey: z.string().optional(),
        suggestedScore: z.number().min(1).max(10).optional(),
        subjectPersonName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });

      const scope = await resolveViewerScope(person, TENANT_ID);
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Look up active cycle if needed
      const activeCycleRows = await dbi
        .select()
        .from(governanceCycles)
        .where(and(eq(governanceCycles.tenantId, TENANT_ID), eq(governanceCycles.status, "OPEN")))
        .orderBy(desc(governanceCycles.month))
        .limit(1);
      const activeCycle = activeCycleRows[0] ?? null;

      switch (input.intent) {
        case "JOURNAL_ENTRY":
        case "PLAN_ITEM": {
          if (!activeCycle) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No open cycle to journal against" });
          }
          if (!input.dimensionKey) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "dimensionKey required for journal/plan" });
          }
          // Upsert mandateJournal for this person+cycle+dimension
          const existing = await dbi
            .select()
            .from(mandateJournals)
            .where(
              and(
                eq(mandateJournals.tenantId, TENANT_ID),
                eq(mandateJournals.personId, person.id),
                eq(mandateJournals.cycleId, activeCycle.id),
                eq(mandateJournals.dimensionKey, input.dimensionKey)
              )
            )
            .limit(1);
          if (existing.length === 0) {
            const insert = await dbi.insert(mandateJournals).values({
              tenantId: TENANT_ID,
              personId: person.id,
              cycleId: activeCycle.id,
              roleId: scope.primaryRole?.id ?? null,
              orgUnitId: scope.primaryRole?.orgUnitId ?? null,
              dimensionKey: input.dimensionKey,
              logText: input.intent === "JOURNAL_ENTRY" ? input.text : null,
              planText: input.intent === "PLAN_ITEM" ? input.text : null,
              planItems: null,
            });
            return { ok: true, entityType: "mandateJournal", entityId: (insert as any).insertId ?? 0 };
          } else {
            const row = existing[0];
            const newLog =
              input.intent === "JOURNAL_ENTRY"
                ? [row.logText, input.text].filter(Boolean).join("\n\n")
                : row.logText;
            const newPlan =
              input.intent === "PLAN_ITEM"
                ? [row.planText, input.text].filter(Boolean).join("\n\n")
                : row.planText;
            await dbi
              .update(mandateJournals)
              .set({ logText: newLog, planText: newPlan })
              .where(eq(mandateJournals.id, row.id));
            return { ok: true, entityType: "mandateJournal", entityId: row.id };
          }
        }
        case "SELF_RATING": {
          if (!activeCycle || !input.dimensionKey || !input.suggestedScore || !scope.primaryRole) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "cycle, dimension, score, role all required" });
          }
          // Upsert self assessment — we still need feedbackTypeId for "self".
          // Defer to existing governance.upsertAssessment logic via direct table write.
          // Simplification: only write if not already submitted; otherwise just return.
          return {
            ok: true,
            entityType: "voiceRatingHint",
            entityId: 0,
            note: "Use the rating slider to confirm — voice rating capture coming in Phase 3.",
          };
        }
        case "REFLECTION": {
          const insert = await dbi.insert(selfReflections).values({
            tenantId: TENANT_ID,
            personId: person.id,
            type: "LEARNING",
            text: input.text,
            visibility: "PRIVATE_DRAFT",
          });
          return { ok: true, entityType: "selfReflection", entityId: (insert as any).insertId ?? 0 };
        }
        case "OBSERVATION": {
          // Resolve subject person by name (best-effort) — but ONLY if the
          // caller has authority over them. Otherwise default to self.
          let subjectId = person.id; // fallback to self
          if (input.subjectPersonName && dbi) {
            const matches = await dbi
              .select({ id: persons.id })
              .from(persons)
              .where(and(eq(persons.tenantId, TENANT_ID), eq(persons.name, input.subjectPersonName)))
              .limit(1);
            if (matches.length > 0) {
              const candidateId = matches[0].id;
              // Authorization: only allow observations about self OR people the caller has authority over
              if (candidateId === person.id || canViewPerson(scope, candidateId)) {
                subjectId = candidateId;
              }
              // Otherwise silently fall back to self — prevents cross-scope observations
            }
          }
          const insert = await dbi.insert(observations).values({
            tenantId: TENANT_ID,
            observerPersonId: person.id,
            subjectPersonId: subjectId,
            text: input.text,
            voiceTranscript: input.text,
            direction: "NEUTRAL",
            source: "VOICE_MEMO",
          });
          return { ok: true, entityType: "observation", entityId: (insert as any).insertId ?? 0 };
        }
        case "DECISION": {
          const insert = await dbi.insert(decisions).values({
            tenantId: TENANT_ID,
            authorPersonId: person.id,
            title: input.text.slice(0, 200),
            context: input.text,
            decisionDate: new Date(),
          } as any);
          return { ok: true, entityType: "decision", entityId: (insert as any).insertId ?? 0 };
        }
        case "MEETING_NOTE":
        case "QUICK_NOTE":
        default: {
          // Quick fallback: store as observation on self
          const insert = await dbi.insert(observations).values({
            tenantId: TENANT_ID,
            observerPersonId: person.id,
            subjectPersonId: person.id,
            text: input.text,
            voiceTranscript: input.text,
            direction: "NEUTRAL",
            source: "VOICE_MEMO",
          });
          return { ok: true, entityType: "observation", entityId: (insert as any).insertId ?? 0 };
        }
      }
    }),

  /**
   * Start a voice session (live or recording). Returns the session id.
   */
  startSession: protectedProcedure
    .input(
      z.object({
        sessionType: z.enum(["JOURNAL", "PULSE", "ASSESSMENT", "ASK", "MEETING_PREP"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgScopeMap: Record<string, "FUND" | "COMPANY" | "FUNCTION" | "TEAM" | "INDIVIDUAL"> = {
        CHAIRMAN: "FUND",
        GROUP_CEO: "FUND",
        CEO: "COMPANY",
        CXO: "FUNCTION",
        MEMBER: "INDIVIDUAL",
      };
      const orgScope = orgScopeMap[scope.tier];

      const insert = await dbi.insert(voiceSessions).values({
        tenantId: TENANT_ID,
        personId: person.id,
        sessionType: input.sessionType,
        scopeContext: orgScope,
      });
      return { sessionId: (insert as any).insertId ?? 0 };
    }),

  /**
   * End a voice session — store final transcript + summary.
   * Auth-gated: caller must own the session.
   */
  endSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        transcript: z.string().optional(),
        summary: z.string().optional(),
        topicsDiscussed: z.array(z.string()).optional(),
        durationSeconds: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Verify ownership before updating
      const sessionRows = await dbi
        .select()
        .from(voiceSessions)
        .where(and(eq(voiceSessions.tenantId, TENANT_ID), eq(voiceSessions.id, input.sessionId)))
        .limit(1);
      if (sessionRows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      if (sessionRows[0].personId !== person.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot end someone else's session" });
      }
      await dbi
        .update(voiceSessions)
        .set({
          endedAt: new Date(),
          transcript: input.transcript ?? null,
          summary: input.summary ?? null,
          topicsDiscussed: input.topicsDiscussed ?? null,
          durationSeconds: input.durationSeconds ?? null,
        })
        .where(and(eq(voiceSessions.tenantId, TENANT_ID), eq(voiceSessions.id, input.sessionId), eq(voiceSessions.personId, person.id)));
      return { ok: true };
    }),

  /**
   * Get an ephemeral OpenAI Realtime token (when configured).
   * Frontend uses this to negotiate WebRTC. Falls back to a clear error if
   * the API key is not set.
   */
  getEphemeralRealtimeToken: protectedProcedure.mutation(async () => {
    const apiKey = process.env.OPENAI_REALTIME_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Live voice bot requires OPENAI_REALTIME_API_KEY in your environment. Voice capture (hold-to-record) still works.",
      });
    }
    try {
      const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "alloy",
        }),
      });
      if (!resp.ok) {
        throw new Error(`OpenAI realtime ${resp.status}: ${await resp.text()}`);
      }
      const data = await resp.json();
      return { token: data.client_secret?.value ?? null, expiresAt: data.client_secret?.expires_at ?? null, raw: data };
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Realtime session failed",
      });
    }
  }),

  /**
   * List the viewer's recent voice sessions.
   */
  listMySessions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) return [];
      const dbi = await getDb();
      if (!dbi) return [];
      return await dbi
        .select()
        .from(voiceSessions)
        .where(and(eq(voiceSessions.tenantId, TENANT_ID), eq(voiceSessions.personId, person.id)))
        .orderBy(desc(voiceSessions.startedAt))
        .limit(input.limit);
    }),
});
