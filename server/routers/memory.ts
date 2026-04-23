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
import { resolveViewerScope, canViewPerson, canViewOrgUnit } from "../scope";
import { and as _and, inArray as _inArray } from "drizzle-orm";
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
    .mutation(async ({ ctx, input }) => {
      // Authorization: caller must have authority over the subject
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);
      if (input.subjectPersonId != null) {
        const subj = await db.getPersonById(input.subjectPersonId, TENANT_ID);
        if (!subj) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Subject person not in your tenant" });
        }
        if (!canViewPerson(scope, input.subjectPersonId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot store memories about this person" });
        }
      }
      if (input.subjectOrgUnitId != null && !canViewOrgUnit(scope, input.subjectOrgUnitId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot store memories about this org unit" });
      }
      // FUND scope writes require fund-wide authority
      if (input.orgScope === "FUND" && !scope.isFundWide) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Fund-wide memories require fund-wide authority" });
      }
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
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);
      // Authorize subject filters
      if (input.subjectPersonId != null && !canViewPerson(scope, input.subjectPersonId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot retrieve memories about this person" });
      }
      if (input.subjectOrgUnitId != null && !canViewOrgUnit(scope, input.subjectOrgUnitId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot retrieve memories about this org unit" });
      }
      // FUND scope retrieval requires fund-wide authority
      if (input.orgScopes?.includes("FUND") && !scope.isFundWide) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Fund-wide memories require fund-wide authority" });
      }
      // Default subjectPersonId to caller if no filter given (prevents broad retrieval)
      const effectiveSubjectId = input.subjectPersonId ?? (scope.isFundWide ? undefined : person.id);
      return await retrieveMemoriesHybrid({
        tenantId: TENANT_ID,
        query: input.query,
        subjectPersonId: effectiveSubjectId,
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
   * Memories needing verification — scope-filtered to caller's authority.
   * Fund-wide viewers see all pending; everyone else sees only memories
   * about themselves OR people they have authority over.
   */
  pendingVerification: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) return [];
      const scope = await resolveViewerScope(person, TENANT_ID);
      const dbi = await getDb();
      if (!dbi) return [];
      const allowedSubjectIds = scope.isFundWide
        ? null
        : Array.from(new Set([person.id, ...scope.subordinatePersonIds]));
      const baseConds = [
        eq(agenticMemories.tenantId, TENANT_ID),
        eq(agenticMemories.needsVerification, true),
      ];
      if (allowedSubjectIds) {
        if (allowedSubjectIds.length === 0) return [];
        baseConds.push(_inArray(agenticMemories.subjectPersonId, allowedSubjectIds));
      }
      return await dbi
        .select()
        .from(agenticMemories)
        .where(and(...baseConds))
        .orderBy(desc(agenticMemories.createdAt))
        .limit(input.limit);
    }),

  verify: protectedProcedure
    .input(z.object({ memoryId: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Verify ownership / authority before allowing approve OR delete
      const rows = await dbi
        .select()
        .from(agenticMemories)
        .where(and(eq(agenticMemories.tenantId, TENANT_ID), eq(agenticMemories.id, input.memoryId)))
        .limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Memory not found" });
      const memory = rows[0];
      const scope = await resolveViewerScope(person, TENANT_ID);
      const isSubject = memory.subjectPersonId === person.id;
      const hasAuthority = memory.subjectPersonId != null && canViewPerson(scope, memory.subjectPersonId);
      if (!isSubject && !hasAuthority) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot verify or delete this memory" });
      }
      await verifyMemory(input.memoryId, person.id, input.approve);
      return { ok: true };
    }),

  /**
   * Update a memory (e.g., user edits the value).
   * Auth-gated: caller must be the subject of the memory (their own memory)
   * OR have authority over the subject (Chairman/CEO over a subordinate's memories).
   */
  update: protectedProcedure
    .input(
      z.object({
        memoryId: z.number(),
        memoryValue: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify ownership / authority over the memory
      const rows = await dbi
        .select()
        .from(agenticMemories)
        .where(and(eq(agenticMemories.tenantId, TENANT_ID), eq(agenticMemories.id, input.memoryId)))
        .limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Memory not found" });
      const memory = rows[0];
      const scope = await resolveViewerScope(person, TENANT_ID);
      const isSubject = memory.subjectPersonId === person.id;
      const hasAuthority = memory.subjectPersonId != null && canViewPerson(scope, memory.subjectPersonId);
      if (!isSubject && !hasAuthority) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit this memory" });
      }

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
