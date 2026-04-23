/**
 * Share router — view-only share links + simple board pack JSON export.
 *
 * No-account share: a board member can open a share link and see a snapshot
 * report without creating an account. Token-based with expiry; per-link
 * password optional.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc, gte, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { resolveViewerScope, canViewOrgUnit, canViewPerson } from "../scope";
import { shareLinks, orgUnits, governanceAssessments, mandateJournals, aiInsights, governanceCycles } from "../../drizzle/schema";
import { computeVarianceAlerts, buildBenchmarkTable } from "../financial-analytics";
import crypto from "node:crypto";

const TENANT_ID = 1;

export const shareRouter = router({
  /**
   * Create a view-only share link for a resource.
   * Resources: BOARD_PACK, COMPANY_REPORT, ROLE_REPORT
   * Auth-gated by resource type:
   *   BOARD_PACK     — fund-wide viewers only
   *   COMPANY_REPORT — viewer must own the company subtree
   *   ROLE_REPORT    — viewer must have authority over the role's person
   */
  create: protectedProcedure
    .input(
      z.object({
        resourceType: z.enum(["BOARD_PACK", "COMPANY_REPORT", "ROLE_REPORT"]),
        resourceId: z.number(),
        expiresInHours: z.number().min(1).max(720).default(168),
        password: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);
      // Authorization
      if (input.resourceType === "BOARD_PACK") {
        if (!scope.isFundWide) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only fund-wide leaders can share board packs" });
        }
      } else if (input.resourceType === "COMPANY_REPORT") {
        if (!canViewOrgUnit(scope, input.resourceId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have authority over this company" });
        }
      } else if (input.resourceType === "ROLE_REPORT") {
        const role = await db.getRoleById(input.resourceId, TENANT_ID);
        if (!role || !canViewPerson(scope, role.personId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have authority over this role" });
        }
      }
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const token = crypto.randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
      await dbi.insert(shareLinks).values({
        tenantId: TENANT_ID,
        createdByUserId: ctx.user.id,
        token,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        expiresAt,
        password: input.password ?? null,
      });
      return { token, expiresAt, shareUrl: `/share/${token}` };
    }),

  /**
   * List my share links.
   */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const dbi = await getDb();
    if (!dbi) return [];
    return await dbi
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.tenantId, TENANT_ID), eq(shareLinks.createdByUserId, ctx.user.id)))
      .orderBy(desc(shareLinks.createdAt));
  }),

  /**
   * Revoke a share link.
   */
  revoke: protectedProcedure
    .input(z.object({ shareLinkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await dbi
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(shareLinks.tenantId, TENANT_ID),
            eq(shareLinks.id, input.shareLinkId),
            eq(shareLinks.createdByUserId, ctx.user.id)
          )
        );
      return { ok: true };
    }),

  /**
   * Public endpoint — render a share link (no auth required, token only).
   * Returns the snapshot data for the resource.
   */
  open: publicProcedure
    .input(z.object({ token: z.string(), password: z.string().optional() }))
    .query(async ({ input }) => {
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await dbi
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.token, input.token))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found" });
      if (row.revokedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Share link has been revoked" });
      if (new Date(row.expiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Share link has expired" });
      }
      if (row.password && row.password !== input.password) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Password required or incorrect" });
      }

      // Increment view count atomically (avoids lost-update race on concurrent opens)
      await dbi
        .update(shareLinks)
        .set({ viewCount: sql`${shareLinks.viewCount} + 1`, lastViewedAt: new Date() })
        .where(eq(shareLinks.id, row.id));

      // Build snapshot per resource type
      if (row.resourceType === "BOARD_PACK") {
        return await buildBoardPackSnapshot(row.tenantId, row.resourceId);
      }
      if (row.resourceType === "COMPANY_REPORT") {
        return await buildCompanySnapshot(row.tenantId, row.resourceId);
      }
      if (row.resourceType === "ROLE_REPORT") {
        return await buildRoleSnapshot(row.tenantId, row.resourceId);
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown resource type" });
    }),

  /**
   * Live preview of a board pack (for the creator before generating share link).
   * Auth-gated: fund-wide viewers only (board packs span the entire portfolio).
   */
  previewBoardPack: protectedProcedure
    .input(z.object({ cycleId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);
      if (!scope.isFundWide) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Board pack preview requires fund-wide authority" });
      }
      // For board pack, the resourceId IS the cycleId (or 0 for "current")
      return await buildBoardPackSnapshot(TENANT_ID, input.cycleId ?? 0);
    }),
});

async function buildBoardPackSnapshot(tenantId: number, cycleId: number) {
  const dbi = await getDb();
  if (!dbi) return null;

  // Resolve cycle
  let cycle = null as any;
  if (cycleId > 0) {
    const rows = await dbi
      .select()
      .from(governanceCycles)
      .where(and(eq(governanceCycles.tenantId, tenantId), eq(governanceCycles.id, cycleId)))
      .limit(1);
    cycle = rows[0] ?? null;
  } else {
    const rows = await dbi
      .select()
      .from(governanceCycles)
      .where(and(eq(governanceCycles.tenantId, tenantId), eq(governanceCycles.status, "OPEN")))
      .orderBy(desc(governanceCycles.month))
      .limit(1);
    cycle = rows[0] ?? null;
  }

  // Top insights
  const topInsights = await dbi
    .select()
    .from(aiInsights)
    .where(and(eq(aiInsights.tenantId, tenantId), eq(aiInsights.severity, "CRITICAL")))
    .orderBy(desc(aiInsights.urgency), desc(aiInsights.createdAt))
    .limit(10);

  // Variance alerts
  const fy = cycle?.month ? cycle.month.slice(0, 4) : new Date().getFullYear().toString();
  const varianceAlerts = await computeVarianceAlerts(tenantId, fy);
  const benchmarks = await buildBenchmarkTable(tenantId);

  // Companies
  const companies = await dbi
    .select()
    .from(orgUnits)
    .where(and(eq(orgUnits.tenantId, tenantId), eq(orgUnits.type, "PORTFOLIO_COMPANY")));

  return {
    title: `Fund Governance Board Pack — ${cycle?.month ?? "Current"}`,
    generatedAt: new Date().toISOString(),
    cycle,
    summary: {
      companyCount: companies.length,
      criticalInsightCount: topInsights.length,
      offTrackVarianceCount: varianceAlerts.filter(v => v.variance === "OFF_TRACK").length,
    },
    topInsights,
    varianceAlerts,
    benchmarks,
    companies,
  };
}

async function buildCompanySnapshot(tenantId: number, orgUnitId: number) {
  const dbi = await getDb();
  if (!dbi) return null;
  const rows = await dbi
    .select()
    .from(orgUnits)
    .where(and(eq(orgUnits.tenantId, tenantId), eq(orgUnits.id, orgUnitId)))
    .limit(1);
  const co = rows[0];
  if (!co) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
  // Insights about this company
  const insights = await dbi
    .select()
    .from(aiInsights)
    .where(
      and(
        eq(aiInsights.tenantId, tenantId),
        eq(aiInsights.targetType, "COMPANY"),
        eq(aiInsights.targetId, orgUnitId)
      )
    )
    .orderBy(desc(aiInsights.createdAt))
    .limit(20);
  return {
    title: `Company Report — ${co.name}`,
    generatedAt: new Date().toISOString(),
    company: co,
    insights,
  };
}

async function buildRoleSnapshot(tenantId: number, roleId: number) {
  const dbi = await getDb();
  if (!dbi) return null;
  const insights = await dbi
    .select()
    .from(aiInsights)
    .where(
      and(
        eq(aiInsights.tenantId, tenantId),
        eq(aiInsights.targetType, "ROLE"),
        eq(aiInsights.targetId, roleId)
      )
    )
    .orderBy(desc(aiInsights.createdAt))
    .limit(20);
  return {
    title: `Role Report`,
    generatedAt: new Date().toISOString(),
    insights,
  };
}
