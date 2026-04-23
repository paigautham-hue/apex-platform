/**
 * Calendar router — connect / sync / list upcoming meetings.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getOAuthUrl, exchangeCode, syncCalendar } from "../calendar";
import { calendarTokens, calendarEvents } from "../../drizzle/schema";
import crypto from "node:crypto";

const TENANT_ID = 1;

export const calendarRouter = router({
  /**
   * Get the OAuth URL the user should be redirected to.
   * State includes a tenant+user identifier so the callback knows who to bind tokens to.
   */
  getAuthUrl: protectedProcedure
    .input(z.object({ provider: z.enum(["GOOGLE", "OUTLOOK"]) }))
    .mutation(async ({ ctx, input }) => {
      const state = crypto.randomBytes(16).toString("hex") + "." + ctx.user.id;
      try {
        const url = getOAuthUrl(input.provider, state);
        return { url };
      } catch (err) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: err instanceof Error ? err.message : "OAuth not configured",
        });
      }
    }),

  /**
   * Callback handler — exchange code for tokens, persist.
   */
  oauthCallback: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["GOOGLE", "OUTLOOK"]),
        code: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      try {
        const { accessToken, refreshToken, expiresAt, email } = await exchangeCode(input.provider, input.code);
        // Upsert
        const existing = await dbi
          .select()
          .from(calendarTokens)
          .where(
            and(
              eq(calendarTokens.tenantId, TENANT_ID),
              eq(calendarTokens.userId, ctx.user.id),
              eq(calendarTokens.provider, input.provider)
            )
          )
          .limit(1);
        if (existing.length > 0) {
          await dbi
            .update(calendarTokens)
            .set({ accessToken, refreshToken: refreshToken ?? existing[0].refreshToken, expiresAt, email })
            .where(eq(calendarTokens.id, existing[0].id));
        } else {
          await dbi.insert(calendarTokens).values({
            tenantId: TENANT_ID,
            userId: ctx.user.id,
            provider: input.provider,
            email,
            accessToken,
            refreshToken,
            expiresAt,
          });
        }
        return { ok: true, email };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "OAuth exchange failed",
        });
      }
    }),

  /**
   * Sync events from the connected provider into our local cache.
   */
  sync: protectedProcedure
    .input(z.object({ provider: z.enum(["GOOGLE", "OUTLOOK"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await syncCalendar(TENANT_ID, ctx.user.id, input.provider);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Sync failed",
        });
      }
    }),

  /**
   * Connections this user has.
   */
  myConnections: protectedProcedure.query(async ({ ctx }) => {
    const dbi = await getDb();
    if (!dbi) return [];
    const rows = await dbi
      .select()
      .from(calendarTokens)
      .where(and(eq(calendarTokens.tenantId, TENANT_ID), eq(calendarTokens.userId, ctx.user.id)));
    return rows.map(r => ({
      provider: r.provider,
      email: r.email,
      connectedAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
  }),

  /**
   * Upcoming events for the viewer.
   */
  upcoming: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(60).default(14) }))
    .query(async ({ ctx, input }) => {
      const dbi = await getDb();
      if (!dbi) return [];
      return await dbi
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.tenantId, TENANT_ID),
            eq(calendarEvents.userId, ctx.user.id),
            gte(calendarEvents.startAt, new Date())
          )
        )
        .orderBy(calendarEvents.startAt)
        .limit(50);
    }),
});
