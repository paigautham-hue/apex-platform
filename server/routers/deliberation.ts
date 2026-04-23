/**
 * Deliberation router — wire AI panel reviews to the frontend.
 *
 * Endpoints:
 *   - run     — kick off a panel review on a target (synchronous; ~10-30s)
 *   - get     — fetch a completed deliberation
 *   - listForTarget — recent panels for a target
 *   - listMine — panels triggered by the viewer
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { resolveViewerScope } from "../scope";
import { runDeliberation } from "../ai-deliberation";
import { aiDeliberations, aiPersonaConfigs } from "../../drizzle/schema";

const TENANT_ID = 1;

export const deliberationRouter = router({
  run: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["ROLE", "COMPANY", "PERSON"]),
        targetId: z.number(),
        cycleId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);
      // Authorization: viewer must be able to see the target
      if (input.targetType === "ROLE") {
        const role = await db.getRoleById(input.targetId, TENANT_ID);
        if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
        const targetIsSelf = role.personId === person.id;
        const inSubtree = scope.subordinatePersonIds.includes(role.personId);
        if (!targetIsSelf && !inSubtree && !scope.isFundWide) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot run a panel on this person" });
        }
      }
      return await runDeliberation({
        tenantId: TENANT_ID,
        triggeredByPersonId: person.id,
        targetType: input.targetType,
        targetId: input.targetId,
        cycleId: input.cycleId,
      });
    }),

  get: protectedProcedure
    .input(z.object({ deliberationId: z.number() }))
    .query(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) return null;
      const rows = await dbi
        .select()
        .from(aiDeliberations)
        .where(and(eq(aiDeliberations.tenantId, TENANT_ID), eq(aiDeliberations.id, input.deliberationId)))
        .limit(1);
      return rows[0] ?? null;
    }),

  listForTarget: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["ROLE", "COMPANY", "PERSON"]),
        targetId: z.number(),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) return [];
      return await dbi
        .select()
        .from(aiDeliberations)
        .where(
          and(
            eq(aiDeliberations.tenantId, TENANT_ID),
            eq(aiDeliberations.targetType, input.targetType),
            eq(aiDeliberations.targetId, input.targetId)
          )
        )
        .orderBy(desc(aiDeliberations.createdAt))
        .limit(input.limit);
    }),

  listMine: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) return [];
      const dbi = await getDb();
      if (!dbi) return [];
      return await dbi
        .select()
        .from(aiDeliberations)
        .where(and(eq(aiDeliberations.tenantId, TENANT_ID), eq(aiDeliberations.triggeredByPersonId, person.id)))
        .orderBy(desc(aiDeliberations.createdAt))
        .limit(input.limit);
    }),

  listPersonas: protectedProcedure.query(async () => {
    const dbi = await getDb();
    if (!dbi) return [];
    return await dbi
      .select()
      .from(aiPersonaConfigs)
      .where(eq(aiPersonaConfigs.tenantId, TENANT_ID));
  }),
});
