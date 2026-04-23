/**
 * Trust router — entry view audit ("who saw my journal").
 *
 * Endpoints:
 *   - logView         — frontend records when viewer opens an entity owned by another
 *   - whoSawMyEntries — list views on this user's entities (last 30 days)
 *   - viewsOfEntity   — list views on a specific entity (owner-only)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc, gte, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { entryViews, persons, mandateJournals } from "../../drizzle/schema";

const TENANT_ID = 1;

export const trustRouter = router({
  /**
   * Record an entry view. Idempotent-ish — collapses repeated views by the
   * same viewer within 1 minute to a single record.
   */
  logView: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.number(),
        ownerPersonId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const viewer = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!viewer) return { ok: false };
      // Don't log self-views
      if (viewer.id === input.ownerPersonId) return { ok: true, selfView: true };
      const dbi = await getDb();
      if (!dbi) return { ok: false };

      // Dedupe: skip if same viewer logged a view on same entity in last 60s
      const oneMinAgo = new Date(Date.now() - 60_000);
      const recent = await dbi
        .select()
        .from(entryViews)
        .where(
          and(
            eq(entryViews.tenantId, TENANT_ID),
            eq(entryViews.viewerPersonId, viewer.id),
            eq(entryViews.entityType, input.entityType),
            eq(entryViews.entityId, input.entityId),
            gte(entryViews.viewedAt, oneMinAgo)
          )
        )
        .limit(1);
      if (recent.length > 0) return { ok: true, deduped: true };

      try {
        const result: any = await dbi.insert(entryViews).values({
          tenantId: TENANT_ID,
          viewerPersonId: viewer.id,
          entityType: input.entityType,
          entityId: input.entityId,
          ownerPersonId: input.ownerPersonId,
        });
        return { ok: true, viewId: result?.insertId ?? null };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Could not record view",
        });
      }
    }),

  /**
   * "Who saw my journal entries" — surfaces the last 30 days of entry views
   * on entities owned by the calling user.
   */
  whoSawMyEntries: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const owner = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!owner) return [];
      const dbi = await getDb();
      if (!dbi) return [];

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const views = await dbi
        .select()
        .from(entryViews)
        .where(
          and(
            eq(entryViews.tenantId, TENANT_ID),
            eq(entryViews.ownerPersonId, owner.id),
            gte(entryViews.viewedAt, since)
          )
        )
        .orderBy(desc(entryViews.viewedAt))
        .limit(500);

      // Hydrate viewer names
      const viewerIds = Array.from(new Set(views.map(v => v.viewerPersonId)));
      const viewerRows = viewerIds.length
        ? await dbi
            .select({ id: persons.id, name: persons.name, photoUrl: persons.photoUrl })
            .from(persons)
            .where(and(eq(persons.tenantId, TENANT_ID), inArray(persons.id, viewerIds)))
        : [];
      const viewerById = new Map(viewerRows.map(v => [v.id, v]));

      return views.map(v => ({
        ...v,
        viewerName: viewerById.get(v.viewerPersonId)?.name ?? "Unknown",
        viewerPhoto: viewerById.get(v.viewerPersonId)?.photoUrl ?? null,
      }));
    }),

  /**
   * Views of a specific entity (owner-only).
   */
  viewsOfEntity: protectedProcedure
    .input(z.object({ entityType: z.string(), entityId: z.number() }))
    .query(async ({ ctx, input }) => {
      const owner = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!owner) return [];
      const dbi = await getDb();
      if (!dbi) return [];
      const rows = await dbi
        .select()
        .from(entryViews)
        .where(
          and(
            eq(entryViews.tenantId, TENANT_ID),
            eq(entryViews.entityType, input.entityType),
            eq(entryViews.entityId, input.entityId),
            eq(entryViews.ownerPersonId, owner.id)
          )
        )
        .orderBy(desc(entryViews.viewedAt))
        .limit(100);
      const viewerIds = Array.from(new Set(rows.map(v => v.viewerPersonId)));
      const viewerRows = viewerIds.length
        ? await dbi
            .select({ id: persons.id, name: persons.name })
            .from(persons)
            .where(and(eq(persons.tenantId, TENANT_ID), inArray(persons.id, viewerIds)))
        : [];
      const viewerById = new Map(viewerRows.map(v => [v.id, v.name]));
      return rows.map(r => ({ ...r, viewerName: viewerById.get(r.viewerPersonId) ?? "Unknown" }));
    }),
});
