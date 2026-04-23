/**
 * Scope router — exposes viewer info, default landing path, and scope helpers
 * to the frontend. Every page should call viewer.getMine() once at mount to
 * know what to render and what data to fetch.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { resolveViewerScope, viewerToOrgScope, type LandingPath } from "../scope";
import { getDb } from "../db";
import { userPreferences, persons, orgUnits, roles, governanceAssessments, mandateJournals, governanceCycles, feedbackTypes } from "../../drizzle/schema";
import { and, eq, inArray, desc } from "drizzle-orm";

const TENANT_ID = 1;

export const scopeRouter = router({
  /**
   * Resolve the viewer scope for the calling user.
   * Returns the person, primary role, tier, default landing path,
   * subordinate IDs, and owned org unit IDs.
   */
  getViewer: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No person record found for your user account.",
      });
    }
    const scope = await resolveViewerScope(person, TENANT_ID);

    // Read user preferences for landing override — only honor if the user
    // EXPLICITLY set one (otherwise fall through to tier-computed default).
    const dbi = await getDb();
    let landingOverride: LandingPath | null = null;
    if (dbi) {
      const prefs = await dbi
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);
      if (prefs.length > 0 && prefs[0].defaultLandingExplicit && prefs[0].defaultLandingPath) {
        landingOverride = prefs[0].defaultLandingPath as LandingPath;
      }
    }

    return {
      personId: scope.person.id,
      personName: scope.person.name,
      photoUrl: scope.person.photoUrl,
      tenantId: TENANT_ID,
      tier: scope.tier,
      primaryRole: scope.primaryRole
        ? {
            id: scope.primaryRole.id,
            title: scope.primaryRole.title,
            roleType: scope.primaryRole.roleType,
            orgUnitId: scope.primaryRole.orgUnitId,
            scopeDescription: scope.primaryRole.scopeDescription,
            successMetrics: scope.primaryRole.successMetrics,
          }
        : null,
      allRoleIds: scope.allRoles.map(r => r.id),
      defaultLanding: landingOverride ?? scope.defaultLanding,
      directReportPersonIds: scope.directReportPersonIds,
      subordinatePersonIds: scope.subordinatePersonIds,
      ownedOrgUnitIds: scope.ownedOrgUnitIds,
      isFundWide: scope.isFundWide,
      orgScope: viewerToOrgScope(scope),
    };
  }),

  /**
   * Update the viewer's preferred landing path.
   */
  setLanding: protectedProcedure
    .input(z.object({ path: z.enum(["me", "team", "group", "today"]) }))
    .mutation(async ({ ctx, input }) => {
      const dbi = await getDb();
      if (!dbi) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await dbi
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing.length === 0) {
        await dbi.insert(userPreferences).values({
          userId: ctx.user.id,
          defaultLandingPath: input.path,
          defaultLandingExplicit: true,
        });
      } else {
        await dbi
          .update(userPreferences)
          .set({ defaultLandingPath: input.path, defaultLandingExplicit: true })
          .where(eq(userPreferences.userId, ctx.user.id));
      }
      return { success: true };
    }),

  /**
   * List the viewer's direct reports as compact person summaries.
   * Used by /team page.
   */
  listDirectReports: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) return [];
    const scope = await resolveViewerScope(person, TENANT_ID);
    if (scope.directReportPersonIds.length === 0) return [];

    const dbi = await getDb();
    if (!dbi) return [];

    const reports = await dbi
      .select()
      .from(persons)
      .where(and(eq(persons.tenantId, TENANT_ID), inArray(persons.id, scope.directReportPersonIds)));

    // Attach role + org unit info
    const allRoles = await dbi
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, TENANT_ID), eq(roles.isActive, true), inArray(roles.personId, scope.directReportPersonIds)));

    const allUnits = await dbi.select().from(orgUnits).where(eq(orgUnits.tenantId, TENANT_ID));
    const unitById = new Map(allUnits.map(u => [u.id, u]));

    return reports.map(p => {
      const r = allRoles.find(rr => rr.personId === p.id);
      return {
        personId: p.id,
        name: p.name,
        photoUrl: p.photoUrl,
        roleTitle: r?.title ?? null,
        roleType: r?.roleType ?? null,
        orgUnitName: r?.orgUnitId ? unitById.get(r.orgUnitId)?.name ?? null : null,
        orgUnitId: r?.orgUnitId ?? null,
      };
    });
  }),

  /**
   * Drill-down tree: starting from a root org unit, return the recursive subtree.
   * Used by /group page.
   */
  getOrgTree: protectedProcedure
    .input(z.object({ rootOrgUnitId: z.number().nullable() }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const scope = await resolveViewerScope(person, TENANT_ID);

      const dbi = await getDb();
      if (!dbi) return { units: [], persons: [], roles: [] };

      const allUnits = await dbi.select().from(orgUnits).where(eq(orgUnits.tenantId, TENANT_ID));
      // Filter to viewer's owned subtree
      const visibleUnits = allUnits.filter(u => scope.ownedOrgUnitIds.includes(u.id));

      // If a root is specified, narrow further to its subtree
      let scopedUnits = visibleUnits;
      if (input.rootOrgUnitId != null) {
        if (!scope.ownedOrgUnitIds.includes(input.rootOrgUnitId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot view this org unit" });
        }
        const subtreeIds = new Set<number>([input.rootOrgUnitId]);
        const queue = [input.rootOrgUnitId];
        while (queue.length) {
          const id = queue.shift()!;
          for (const u of allUnits) {
            if (u.parentOrgUnitId === id && !subtreeIds.has(u.id)) {
              subtreeIds.add(u.id);
              queue.push(u.id);
            }
          }
        }
        scopedUnits = allUnits.filter(u => subtreeIds.has(u.id));
      }

      const scopedUnitIds = scopedUnits.map(u => u.id);
      const allRoles = scopedUnitIds.length
        ? await dbi
            .select()
            .from(roles)
            .where(and(eq(roles.tenantId, TENANT_ID), eq(roles.isActive, true), inArray(roles.orgUnitId, scopedUnitIds)))
        : [];

      const personIds = Array.from(new Set(allRoles.map(r => r.personId)));
      const allPersons = personIds.length
        ? await dbi.select().from(persons).where(and(eq(persons.tenantId, TENANT_ID), inArray(persons.id, personIds)))
        : [];

      return {
        units: scopedUnits.map(u => ({
          id: u.id,
          name: u.name,
          type: u.type,
          parentOrgUnitId: u.parentOrgUnitId,
          leaderPersonId: u.leaderPersonId,
          businessType: u.businessType,
          lifecycleStage: u.lifecycleStage,
          industrySector: u.industrySector,
        })),
        persons: allPersons.map(p => ({
          id: p.id,
          name: p.name,
          photoUrl: p.photoUrl,
        })),
        roles: allRoles.map(r => ({
          id: r.id,
          title: r.title,
          roleType: r.roleType,
          personId: r.personId,
          orgUnitId: r.orgUnitId,
          reportsToRoleId: r.reportsToRoleId,
        })),
      };
    }),

  /**
   * Submission status for the viewer's direct reports for the active cycle.
   * Used by /team cards to show who's journaled / self-rated / submitted.
   *
   * Status derivation:
   *   SUBMITTED     — at least one self-assessment with submittedAt set
   *   IN_PROGRESS   — has journal entry OR scored but not submitted
   *   PENDING       — no journal, no rating yet
   *   OVERDUE       — PENDING and deadline has passed
   */
  getTeamSubmissionStatus: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, TENANT_ID);
    if (!person) return [];
    const scope = await resolveViewerScope(person, TENANT_ID);
    if (scope.directReportPersonIds.length === 0) return [];
    const dbi = await getDb();
    if (!dbi) return [];

    // Find active cycle
    const cycleRows = await dbi
      .select()
      .from(governanceCycles)
      .where(and(eq(governanceCycles.tenantId, TENANT_ID), eq(governanceCycles.status, "OPEN")))
      .orderBy(desc(governanceCycles.month))
      .limit(1);
    const cycle = cycleRows[0];
    if (!cycle) {
      // No open cycle — everyone is neutrally "no cycle"
      return scope.directReportPersonIds.map(pid => ({
        personId: pid,
        status: "NO_CYCLE" as const,
        journaled: false,
        rated: false,
        submitted: false,
        submittedCount: 0,
        totalMandates: 0,
      }));
    }

    // Find the "self" feedback type
    const ftRows = await dbi
      .select()
      .from(feedbackTypes)
      .where(and(eq(feedbackTypes.tenantId, TENANT_ID), eq(feedbackTypes.key, "self")))
      .limit(1);
    const selfTypeId = ftRows[0]?.id;

    // Bulk-fetch journals + assessments for all direct reports
    const [journals, assessments] = await Promise.all([
      dbi
        .select()
        .from(mandateJournals)
        .where(
          and(
            eq(mandateJournals.tenantId, TENANT_ID),
            eq(mandateJournals.cycleId, cycle.id),
            inArray(mandateJournals.personId, scope.directReportPersonIds)
          )
        ),
      dbi
        .select()
        .from(governanceAssessments)
        .where(
          and(
            eq(governanceAssessments.tenantId, TENANT_ID),
            eq(governanceAssessments.cycleId, cycle.id),
            inArray(governanceAssessments.assessorPersonId, scope.directReportPersonIds)
          )
        ),
    ]);

    const now = new Date();
    const deadlinePassed = cycle.deadlineDate ? new Date(cycle.deadlineDate) <= now : false;

    return scope.directReportPersonIds.map(pid => {
      const myJournals = journals.filter(j => j.personId === pid && (j.logText?.length ?? 0) > 5);
      const mySelfAssessments = selfTypeId
        ? assessments.filter(a => a.assessorPersonId === pid && a.feedbackTypeId === selfTypeId)
        : [];
      const submittedCount = mySelfAssessments.filter(a => a.submittedAt).length;
      const scoredCount = mySelfAssessments.filter(a => a.score != null).length;
      const journaled = myJournals.length > 0;
      const rated = scoredCount > 0;
      const submitted = submittedCount > 0;

      let status: "SUBMITTED" | "IN_PROGRESS" | "PENDING" | "OVERDUE";
      if (submitted) status = "SUBMITTED";
      else if (journaled || rated) status = "IN_PROGRESS";
      else if (deadlinePassed) status = "OVERDUE";
      else status = "PENDING";

      return {
        personId: pid,
        status,
        journaled,
        rated,
        submitted,
        submittedCount,
        totalMandates: mySelfAssessments.length,
      };
    });
  }),
});
