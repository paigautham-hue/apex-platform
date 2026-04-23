/**
 * Memory router — agentic memory CRUD + verification UX.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import {
  storeMemory,
  retrieveMemoriesHybrid,
  verifyMemory,
  type MemoryCategory,
  type OrgScope,
} from "../agentic-memory";
import { agenticMemories } from "../../drizzle/schema";

const TENANT_ID = 1;

export const memoryRouter = router({
  store: protectedProcedure
    .input(
      z.object({
        subjectPersonId: z.number().optional(),
        subjectOrgUnitId: z.number().optional(),
        orgScope: z.enum(["FUND", "COMPANY", "FUNCTION", "TEAM", "INDIVIDUAL"]),
        category: z.enum(["PREFERENCE", "FACT", "PATTERN", "INSIGHT", "COMMITMENT", "RELATIONSHIP"]),
        memoryKey: z.string().min(1),
        memoryValue: z.string().min(1),
        rationale: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await storeMemory({
        tenantId: TENANT_ID,
        subjectPersonId: input.subjectPersonId,
        subjectOrgUnitId: input.subjectOrgUnitId,
        orgScope: input.orgScope as OrgScope,
        category: input.category as MemoryCategory,
        memoryKey: input.memoryKey,
        memoryValue: input.memoryValue,
        rationale: input.rationale,
        confidence: input.confidence,
        needsVerification: true,
      });
    }),

  retrieve: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        subjectPersonId: z.number().optional(),
        subjectOrgUnitId: z.number().optional(),
        categories: z.array(z.enum(["PREFERENCE", "FACT", "PATTERN", "INSIGHT", "COMMITMENT", "RELATIONSHIP"])).optional(),
        orgScopes: z.array(z.enum(["FUND", "COMPANY", "FUNCTION", "TEAM", "INDIVIDUAL"])).optional(),
        limit: z.number().min(1).max(50).default(10),
        minConfidence: z.number().min(0).max(1).optional(),
      })
    )
    .query(async ({ input }) => {
      return await retrieveMemoriesHybrid({
        tenantId: TENANT_ID,
        query: input.query,
        subjectPersonId: input.subjectPersonId,
        subjectOrgUnitId: input.subjectOrgUnitId,
        categories: input.categories as MemoryCategory[] | undefined,
        orgScopes: input.orgScopes as OrgScope[] | undefined,
        limit: input.limit,
        minConfidence: input.minConfidence,
      });
    }),

  /**
   * "Memories about me" inbox — all memories whose subjectPersonId is the caller.
   */
  aboutMe: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) return [];
    const dbi = await getDb();
    if (!dbi) return [];
    return await dbi
      .select()
      .from(agenticMemories)
      .where(
        and(eq(agenticMemories.tenantId, TENANT_ID), eq(agenticMemories.subjectPersonId, person.id))
      )
      .orderBy(desc(agenticMemories.createdAt))
      .limit(200);
  }),

  /**
   * Memories needing verification — admin-style inbox.
   */
  pendingVerification: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) return [];
      return await dbi
        .select()
        .from(agenticMemories)
        .where(
          and(eq(agenticMemories.tenantId, TENANT_ID), eq(agenticMemories.needsVerification, true))
        )
        .orderBy(desc(agenticMemories.createdAt))
        .limit(input.limit);
    }),

  verify: protectedProcedure
    .input(z.object({ memoryId: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      await verifyMemory(input.memoryId, person.id, input.approve);
      return { ok: true };
    }),

  /**
   * Update a memory (e.g., user edits the value).
   */
  update: protectedProcedure
    .input(
      z.object({
        memoryId: z.number(),
        memoryValue: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const patch: Record<string, any> = {};
      if (input.memoryValue) patch.memoryValue = input.memoryValue;
      if (input.confidence != null) patch.confidence = String(input.confidence);
      if (Object.keys(patch).length === 0) return { ok: true };
      await dbi
        .update(agenticMemories)
        .set(patch)
        .where(and(eq(agenticMemories.tenantId, TENANT_ID), eq(agenticMemories.id, input.memoryId)));
      return { ok: true };
    }),
});
