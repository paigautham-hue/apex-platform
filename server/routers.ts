import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { processAskQuery, getSuggestedQueries } from "./ai-ask";
import { accessControlRouter } from "./routers/accessControl";
import { preferencesRouter } from "./routers/preferences";
import { scopeRouter } from "./routers/scope";
import { voiceRouter } from "./routers/voice";
import { deliberationRouter } from "./routers/deliberation";
import { rhythmRouter } from "./routers/rhythm";
import { processUploadedFile } from "./ai-extraction";
import * as db from "./db";
import * as governanceNotifications from "./governance-notifications";
import { filterAssessmentsByVisibility } from "./reveal-gating";
import { runCommitmentTrackerForCycle, findChronicDeferralsForTenant } from "./ai-commitment";
import { generateAllInsights } from "./ai-insights-generator";
import { CORE_VALUES, OBSERVATION_TEMPLATES, getDataSufficiencyLevel } from "../shared/constants";

// ============================================================================
// TENANT & ORGANIZATION ROUTER
// ============================================================================

const tenantRouter = router({
  // Get current user's tenant
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    // For now, get the first person record for this user
    // In production, you'd have proper tenant selection
    const person = await db.getPersonByUserId(ctx.user.id, 1); // Default tenant ID 1
    if (!person) return null;
    
    const tenant = await db.getTenantById(person.tenantId);
    return tenant;
  }),

   // Get org units for tenant
  listOrgUnits: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getOrgUnitsByTenant(input.tenantId);
    }),
  
  // Create org unit (Chairman/Admin only)
  createOrgUnit: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      name: z.string(),
      type: z.enum(["HOLDING_COMPANY", "PORTFOLIO_COMPANY", "FUNCTION", "TEAM", "SUB_BUSINESS"]),
      parentId: z.number().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the Chairman or Admin can create org units.",
        });
      }
      await db.createOrgUnit({
        tenantId: input.tenantId,
        name: input.name,
        type: input.type,
        parentOrgUnitId: input.parentId,
      });
      return { success: true };
    }),
});

// ============================================================================
// PERSON & PROFILE ROUTER
// ============================================================================

const personRouter = router({
  // Get current user's person profile
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    // Default to tenant 1 for now
    const tenantId = 1;
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
    if (!person) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Person profile not found. Please contact your administrator."
      });
    }

    // Get current role (tenant-scoped)
    const role = person.currentRoleId ? await db.getRoleById(person.currentRoleId, tenantId) : null;

    return {
      ...person,
      currentRole: role
    };
  }),

  // Get person by ID (tenant-scoped to caller's tenant)
  getById: protectedProcedure
    .input(z.object({ personId: z.number(), tenantId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Admins can always view any person; regular users must belong to the tenant
      if (ctx.user.role !== "admin") {
        const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
        if (!caller) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this tenant." });
      }

      const person = await db.getPersonById(input.personId, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }

      const role = person.currentRoleId ? await db.getRoleById(person.currentRoleId, input.tenantId) : null;

      return {
        ...person,
        currentRole: role
      };
    }),

  // List all persons in tenant
  list: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Admins can always see all persons; regular users must have a person record in the tenant
      if (ctx.user.role !== "admin") {
        const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
        if (!caller) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this tenant." });
      }
      return await db.getPersonsByTenant(input.tenantId);
    }),

  // Get direct reports
  getDirectReports: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = 1;
    const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
    if (!person || !person.currentRoleId) return [];

    const directReportRoles = await db.getDirectReports(person.currentRoleId);
    const directReports = await Promise.all(
      directReportRoles.map(async (role) => {
        const reportPerson = await db.getPersonById(role.personId, tenantId);
        return {
          ...reportPerson,
          role: role
        };
      })
    );

     return directReports.filter(r => r !== null);
  }),

  // Update who a person reports to (sets reportsToRoleId on their current role)
  updateReportsTo: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      personId: z.number(),
      reportsToPersonId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only admins or the person themselves can update reporting structure
      if (ctx.user.role !== "admin") {
        const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
        if (!caller) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this tenant." });
      }
      const dbConn = await db.getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get the person's current role
      const person = await db.getPersonById(input.personId, input.tenantId);
      if (!person || !person.currentRoleId) throw new TRPCError({ code: "NOT_FOUND", message: "Person or role not found" });

      // Find the reportsTo person's current role id
      let reportsToRoleId: number | null = null;
      if (input.reportsToPersonId !== null) {
        const reportsToP = await db.getPersonById(input.reportsToPersonId, input.tenantId);
        if (!reportsToP || !reportsToP.currentRoleId) throw new TRPCError({ code: "NOT_FOUND", message: "Reports-to person not found" });
        reportsToRoleId = reportsToP.currentRoleId;
      }

      const { roles } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbConn.update(roles)
        .set({ reportsToRoleId })
        .where(eq(roles.id, person.currentRoleId));

      return { success: true };
    }),

  // Get who a person reports to (returns the manager person record)
  getReportsTo: protectedProcedure
    .input(z.object({ personId: z.number(), tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
        if (!caller) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this tenant." });
      }
      const person = await db.getPersonById(input.personId, input.tenantId);
      if (!person || !person.currentRoleId) return null;
      const role = await db.getRoleById(person.currentRoleId, input.tenantId);
      if (!role || !role.reportsToRoleId) return null;
      // Find the person who holds the reportsToRole
      const dbConn = await db.getDb();
      if (!dbConn) return null;
      const { roles, persons: personsTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const result = await dbConn.select().from(personsTable)
        .innerJoin(roles, eq(roles.personId, personsTable.id))
        .where(eq(roles.id, role.reportsToRoleId))
        .limit(1);
      return result.length > 0 ? { ...result[0].persons, currentRole: result[0].roles } : null;
    }),
});
// ============================================================================
// OBSERVATION ROUTER
// ============================================================================

const observationRouter = router({
  // Create observation
  create: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      subjectPersonId: z.number(),
      text: z.string().min(10),
      voiceTranscript: z.string().optional(),
      direction: z.enum(["POSITIVE", "NEEDS_IMPROVEMENT", "NEUTRAL"]),
      valueTags: z.array(z.string()).optional(),
      performanceTags: z.array(z.string()).optional(),
      templateUsed: z.string().optional(),
      source: z.enum(["QUICK_NOTE", "VOICE_MEMO", "WEEKLY_PULSE", "MEETING_LOGGER", "TEMPLATE"]),
      meetingId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Observer person not found"
        });
      }

      const result = await db.createObservation({
        ...input,
        observerPersonId: person.id,
      });

      // Update data sufficiency level for subject
      const observations = await db.getObservationsBySubject(input.subjectPersonId, input.tenantId);
      const uniqueSources = new Set(observations.map(o => o.observerPersonId));
      await db.updatePersonDataSufficiency(input.subjectPersonId, observations.length, uniqueSources.size);

      return { success: true };
    }),

  // Get observations for a person
  getByPerson: protectedProcedure
    .input(z.object({
      personId: z.number(),
      tenantId: z.number(),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ input }) => {
      return await db.getObservationsBySubject(input.personId, input.tenantId, input.limit);
    }),

  // Get my observations (as observer)
  getMyObservations: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      
      return await db.getObservationsByObserver(person.id, input.tenantId);
    }),

  // Get recent observations (feed)
  getRecent: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      limit: z.number().optional().default(20)
    }))
    .query(async ({ input }) => {
      return await db.getRecentObservations(input.tenantId, input.limit);
    }),

  // Get templates
  getTemplates: publicProcedure.query(() => {
    return OBSERVATION_TEMPLATES;
  }),
  
  // Get all observations by tenant (for analytics)
  getByTenant: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getRecentObservations(input.tenantId, 1000);
    }),
});

// ============================================================================
// GOALS & PLANS ROUTER
// ============================================================================

const planRouter = router({
  // Create plan/goal
  create: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      name: z.string(),
      type: z.enum(["PORTFOLIO_STRATEGY", "BUSINESS_PLAN", "ANNUAL_OPERATING_PLAN", "FUNCTION_PLAN", "OKR", "INDIVIDUAL_GOAL"]),
      orgUnitId: z.number(),
      parentPlanId: z.number().optional(),
      periodStart: z.date(),
      periodEnd: z.date(),
      category: z.enum(["FINANCIAL", "STRATEGIC", "OPERATIONAL", "SUSTAINABILITY", "LEADERSHIP", "GOVERNANCE"]),
      weightPercentage: z.number().optional(),
      targets: z.any().optional(),
      assumptions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }

      const result = await db.createPlan({
        ...input,
        ownerPersonId: person.id,
        status: "ACTIVE",
        weightPercentage: input.weightPercentage?.toString(),
      });

      return { success: true };
    }),

  // Get my plans
  getMyPlans: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      
      return await db.getPlansByOwner(person.id);
    }),

  // Get plan by ID
  getById: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPlanById(input.planId);
    }),
  
  // Get all plans by tenant (for analytics)
  getByTenant: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPlansByTenant(input.tenantId);
    }),
});

// ============================================================================
// METRICS ROUTER
// ============================================================================

const metricRouter = router({
  // Create metric
  create: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      name: z.string(),
      definition: z.string().optional(),
      formula: z.string().optional(),
      planId: z.number(),
      targetValue: z.number().optional(),
      updateCadence: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
      dataSource: z.string().optional(),
      isNegativeTarget: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await db.createMetric({
        ...input,
        targetValue: input.targetValue?.toString(),
      });
      return { success: true };
    }),

  // Get metrics for a plan
  getByPlan: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ input }) => {
      return await db.getMetricsByPlan(input.planId);
    }),

  // Add metric value
  addValue: protectedProcedure
    .input(z.object({
      metricId: z.number(),
      periodDate: z.date(),
      periodType: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "CUMULATIVE_YTD"]),
      actualValue: z.number(),
      targetValue: z.number().optional(),
      sourceUploadId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await db.createMetricValue({
        ...input,
        actualValue: input.actualValue.toString(),
        targetValue: input.targetValue?.toString(),
      });
      return { success: true };
    }),

  // Get metric values
  getValues: protectedProcedure
    .input(z.object({ metricId: z.number() }))
    .query(async ({ input }) => {
      return await db.getMetricValues(input.metricId);
    }),
});

// ============================================================================
// SELF-REFLECTION ROUTER
// ============================================================================

const reflectionRouter = router({
  // Create self-reflection
  create: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      type: z.enum(["ACHIEVEMENT", "LEARNING", "CHALLENGE_OVERCOME", "CROSS_FUNCTIONAL", "FEEDBACK_RECEIVED", "DEVELOPMENT_ACTIVITY"]),
      text: z.string().min(10),
      attachments: z.array(z.string()).optional(),
      visibility: z.enum(["PRIVATE_DRAFT", "SHARED_WITH_MANAGER", "INCLUDED_IN_REVIEW"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }

      const result = await db.createSelfReflection({
        ...input,
        personId: person.id,
        visibility: input.visibility || "PRIVATE_DRAFT",
      });

      return { success: true };
    }),

  // Get my reflections
  getMyReflections: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      
      return await db.getSelfReflectionsByPerson(person.id, input.tenantId);
    }),
});

// ============================================================================
// NOTIFICATIONS ROUTER
// ============================================================================

const notificationRouter = router({
  // Get my notifications
  getMyNotifications: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      
      return await db.getNotificationsByPerson(person.id, input.tenantId, input.limit);
    }),

  // Mark as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ input }) => {
      await db.markNotificationAsRead(input.notificationId);
      return { success: true };
    }),
});

// ============================================================================
// DECISIONS ROUTER
// ============================================================================

const decisionRouter = router({
  // Create decision
  create: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      orgUnitId: z.number().optional(),
      decisionText: z.string().min(10),
      assumptions: z.array(z.string()).optional(),
      expectedOutcome: z.string().optional(),
      risksIdentified: z.array(z.string()).optional(),
      reviewDate: z.date().optional(),
      linkedMetricIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }

      const result = await db.createDecision({
        ...input,
        ownerPersonId: person.id,
      });

      return { success: true };
    }),

  // Get my decisions
  getMyDecisions: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      
      return await db.getDecisionsByOwner(person.id, input.tenantId);
    }),
});

// ============================================================================
// MEETINGS ROUTER
// ============================================================================

const meetingRouter = router({
  // Create/log meeting
  create: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      participantPersonId: z.number(),
      meetingType: z.enum(["ONE_ON_ONE", "TEAM", "REVIEW", "CALIBRATION"]),
      scheduledAt: z.date(),
      notes: z.string(),
      actionItems: z.array(z.string()).optional(),
      sentiment: z.enum(["POSITIVE", "NEUTRAL", "CHALLENGING"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }

      // Create meeting record
      const result = await db.createMeeting({
        tenantId: input.tenantId,
        managerPersonId: person.id,
        subjectPersonId: input.participantPersonId,
        type: input.meetingType,
        startedAt: input.scheduledAt,
      });
      
      // Create observation with meeting notes
      if (input.notes) {
        await db.createObservation({
          tenantId: input.tenantId,
          observerPersonId: person.id,
          subjectPersonId: input.participantPersonId,
          text: input.notes,
          direction: input.sentiment === 'POSITIVE' ? 'POSITIVE' : input.sentiment === 'CHALLENGING' ? 'NEEDS_IMPROVEMENT' : 'NEUTRAL',
          source: 'MEETING_LOGGER',
          meetingId: Number((result as any)[0]?.insertId || 0),
        });
      }

      return { success: true };
    }),
  
  // Start meeting
  start: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      subjectPersonId: z.number(),
      type: z.enum(["ONE_ON_ONE", "TEAM", "REVIEW", "CALIBRATION"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }

      const result = await db.createMeeting({
        ...input,
        managerPersonId: person.id,
        startedAt: new Date(),
      });

      return { success: true };
    }),

  // Get my meetings
  getMyMeetings: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      
      return await db.getMeetingsByManager(person.id, input.tenantId);
    }),
});

// ============================================================================
// INCENTIVE ROUTER
// ============================================================================

const incentiveRouter = router({
  // Get incentive config for org unit
  getConfig: protectedProcedure
    .input(z.object({
      orgUnitId: z.number(),
      fiscalYear: z.string(),
    }))
    .query(async ({ input }) => {
      return await db.getIncentiveConfigByOrgUnit(input.orgUnitId, input.fiscalYear);
    }),

  // Get my incentive computations
  getMyComputations: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      fiscalYear: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      
      return await db.getIncentiveComputations(person.id, input.fiscalYear);
    }),
});

// ============================================================================
// FINANCIAL UPLOAD ROUTER
// ============================================================================

const financialRouter = router({
  // Get uploads for org unit
  getUploads: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      orgUnitId: z.number(),
    }))
    .query(async ({ input }) => {
      return await db.getFinancialUploadsByOrgUnit(input.orgUnitId, input.tenantId);
    }),

  // Get templates for org unit
  getTemplates: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      orgUnitId: z.number(),
    }))
    .query(async ({ input }) => {
      return await db.getFinancialTemplatesByOrgUnit(input.orgUnitId, input.tenantId);
    }),
  
  // List all uploads for tenant
  listUploads: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      // Get all org units for tenant and fetch uploads
      const orgUnits = await db.getOrgUnitsByTenant(input.tenantId);
      const uploads = await Promise.all(
        orgUnits.map((unit: any) => db.getFinancialUploadsByOrgUnit(unit.id, input.tenantId))
      );
      return uploads.flat();
    }),
  
  // Create financial upload
  createUpload: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      orgUnitId: z.number(),
      period: z.string(),
      extractedMetrics: z.array(z.any()),
      status: z.enum(["PENDING", "EXTRACTED", "CONFIRMED", "REJECTED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }

      const result = await db.createFinancialUpload({
        tenantId: input.tenantId,
        orgUnitId: input.orgUnitId,
        uploaderPersonId: person.id,
        fileName: `financial-${input.period}.xlsx`,
        fileUrl: '',
        fileHash: '',
        periodDate: new Date(),
        extractedData: { metrics: input.extractedMetrics },
        status: input.status,
      });

      return { success: true };
    }),
});

// ============================================================================
// CONSTANTS ROUTER (Public data)
// ============================================================================

// ============================================================================
// CALIBRATION ROUTER
// ============================================================================

const calibrationRouter = router({
  // Start calibration session
  startSession: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      orgUnitId: z.number(),
      period: z.string(),
      mode: z.enum(["SYNC", "ASYNC"]),
    }))
    .mutation(async ({ input }) => {
      const result = await db.createCalibrationSession({
        tenantId: input.tenantId,
        orgUnitId: input.orgUnitId,
        period: input.period,
        status: "ASYNC_REVIEW",
      });
      return { success: true };
    }),
  
  // List calibration sessions
  listSessions: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      // Get all org units and fetch calibration sessions
      const orgUnits = await db.getOrgUnitsByTenant(input.tenantId);
      const sessions = await Promise.all(
        orgUnits.map((unit: any) => db.getCalibrationSessionsByOrgUnit(unit.id, input.tenantId))
      );
      return sessions.flat();
    }),
});

const constantsRouter = router({
  getCoreValues: publicProcedure.query(() => {
    return CORE_VALUES;
  }),

  getObservationTemplates: publicProcedure.query(() => {
    return OBSERVATION_TEMPLATES;
  }),
});

// ============================================================================
// GOVERNANCE ROUTER (Evergreen Fund monthly cycle, assessments, journals)
// ============================================================================

const governanceRouter = router({
  // --- Governance cycles ---
  listCycles: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getGovernanceCyclesByTenant(input.tenantId);
    }),

  getActiveCycle: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getActiveGovernanceCycle(input.tenantId) ?? null;
    }),

  getCycleByMonth: protectedProcedure
    .input(z.object({ tenantId: z.number(), month: z.string() }))
    .query(async ({ input }) => {
      return await db.getGovernanceCycleByMonth(input.month, input.tenantId) ?? null;
    }),

  createCycle: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      openDate: z.date().optional(),
      deadlineDate: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Only the Chairman or Admin can create cycles." });
      await db.createGovernanceCycle({
        tenantId: input.tenantId,
        month: input.month,
        status: "DRAFT",
        openDate: input.openDate,
        deadlineDate: input.deadlineDate,
        createdBy: ctx.user.id,
      });
      return { success: true };
    }),

  updateCycleStatus: protectedProcedure
    .input(z.object({
      cycleId: z.number(),
      tenantId: z.number(),
      status: z.enum(["DRAFT", "OPEN", "CLOSED", "REVEALED"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Only the Chairman or Admin can change cycle state." });
      await db.updateGovernanceCycleStatus(input.cycleId, input.status, input.tenantId);

      // Fan out governance notifications on status transitions. Fire-and-forget.
      if (input.status === "OPEN" || input.status === "REVEALED") {
        const cycles = await db.getGovernanceCyclesByTenant(input.tenantId);
        const cycle = cycles.find((c) => c.id === input.cycleId);
        if (cycle) {
          if (input.status === "OPEN") {
            governanceNotifications.notifyCycleOpen(input.tenantId, cycle.month).catch(() => {});
          } else {
            governanceNotifications.notifyCycleReveal(input.tenantId, cycle.month).catch(() => {});
          }
        }
      }
      return { success: true };
    }),

  // Am I allowed to act as the Chairman? Cheap client-side gate.
  amIChairman: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
    }),

  // --- Feedback types ---
  listFeedbackTypes: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getFeedbackTypesByTenant(input.tenantId);
    }),

  listAllFeedbackTypes: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.listAllFeedbackTypes(input.tenantId);
    }),

  createFeedbackType: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      key: z.string().min(1).max(50),
      label: z.string().min(1).max(100),
      description: z.string().nullable().optional(),
      visibilityRule: z.enum(["IMMEDIATE", "AFTER_ALL_SUBMIT", "AFTER_DEADLINE", "ADMIN_RELEASE"]),
      isBlind: z.boolean(),
      cadence: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
      revealTrigger: z.string().nullable().optional(),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Only the Chairman or Admin can add feedback types." });
      await db.createFeedbackType({
        tenantId: input.tenantId,
        key: input.key,
        label: input.label,
        description: input.description ?? null,
        visibilityRule: input.visibilityRule,
        isBlind: input.isBlind,
        cadence: input.cadence,
        revealTrigger: input.revealTrigger ?? null,
        sortOrder: input.sortOrder,
        isActive: true,
      });
      return { success: true };
    }),

  updateFeedbackType: protectedProcedure
    .input(z.object({
      id: z.number(),
      tenantId: z.number(),
      patch: z.object({
        label: z.string().optional(),
        description: z.string().nullable().optional(),
        visibilityRule: z.enum(["IMMEDIATE", "AFTER_ALL_SUBMIT", "AFTER_DEADLINE", "ADMIN_RELEASE"]).optional(),
        isBlind: z.boolean().optional(),
        cadence: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).optional(),
        revealTrigger: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Only the Chairman or Admin can update feedback types." });
      await db.updateFeedbackType(input.id, input.tenantId, input.patch);
      return { success: true };
    }),

  // Generate assessment assignments for a cycle using a rule set.
  // PEER: each CXO gets assignments to rate `perAssessor` randomly-selected
  //   CXO peers (excluding themselves).
  // UPWARD: each CEO gets assignments to rate every CXO in the holding.
  // SELF: self-assignments for every CXO and CEO (so their Bridge/Island
  //   shows a 'pending' row in the Chairman dashboard before submission).
  // CHAIRMAN: Chairman gets assignments to rate every CXO role and every
  //   portfolio company.
  generateAssignments: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      feedbackTypeKey: z.enum(["self", "chairman", "peer", "upward"]),
      perAssessor: z.number().int().min(1).max(10).default(3),
      dueDate: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Only the Chairman or Admin can generate assignments." });

      const feedbackType = await db.getFeedbackTypeByKey(input.feedbackTypeKey, input.tenantId);
      if (!feedbackType) throw new TRPCError({ code: "NOT_FOUND", message: `Feedback type '${input.feedbackTypeKey}' not configured.` });

      const roles = await db.getRolesByTenant(input.tenantId);
      const companies = (await db.getOrgUnitsByTenant(input.tenantId)).filter((u) => u.type === "PORTFOLIO_COMPANY");
      const cxoRoles = roles.filter((r) => r.roleType === "CXO" || r.roleType === "GROUP_CEO" || r.roleType === "GROUP_CHRO");
      const ceoRoles = roles.filter((r) => r.roleType === "CEO");
      const chairmanRole = roles.find((r) => r.roleType === "CHAIRMAN");

      const assignments: Array<{
        tenantId: number;
        cycleId: number;
        assessorPersonId: number;
        targetType: "ROLE" | "COMPANY" | "CHAIN";
        targetId: number;
        feedbackTypeId: number;
        status: "PENDING";
        dueDate: Date | null;
      }> = [];

      const pick = <T,>(arr: T[], n: number, exclude: (t: T) => boolean): T[] => {
        const pool = arr.filter((x) => !exclude(x));
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(n, shuffled.length));
      };

      if (input.feedbackTypeKey === "self") {
        for (const role of [...cxoRoles, ...ceoRoles]) {
          assignments.push({
            tenantId: input.tenantId,
            cycleId: input.cycleId,
            assessorPersonId: role.personId,
            targetType: "ROLE",
            targetId: role.id,
            feedbackTypeId: feedbackType.id,
            status: "PENDING",
            dueDate: input.dueDate ?? null,
          });
        }
        // CEOs also self-assess their company
        for (const role of ceoRoles) {
          assignments.push({
            tenantId: input.tenantId,
            cycleId: input.cycleId,
            assessorPersonId: role.personId,
            targetType: "COMPANY",
            targetId: role.orgUnitId,
            feedbackTypeId: feedbackType.id,
            status: "PENDING",
            dueDate: input.dueDate ?? null,
          });
        }
      } else if (input.feedbackTypeKey === "chairman") {
        if (!chairmanRole) throw new TRPCError({ code: "NOT_FOUND", message: "No Chairman role configured." });
        for (const role of [...cxoRoles, ...ceoRoles]) {
          assignments.push({
            tenantId: input.tenantId,
            cycleId: input.cycleId,
            assessorPersonId: chairmanRole.personId,
            targetType: "ROLE",
            targetId: role.id,
            feedbackTypeId: feedbackType.id,
            status: "PENDING",
            dueDate: input.dueDate ?? null,
          });
        }
        for (const company of companies) {
          assignments.push({
            tenantId: input.tenantId,
            cycleId: input.cycleId,
            assessorPersonId: chairmanRole.personId,
            targetType: "COMPANY",
            targetId: company.id,
            feedbackTypeId: feedbackType.id,
            status: "PENDING",
            dueDate: input.dueDate ?? null,
          });
        }
      } else if (input.feedbackTypeKey === "peer") {
        for (const assessorRole of cxoRoles) {
          const peers = pick(cxoRoles, input.perAssessor, (r) => r.id === assessorRole.id);
          for (const target of peers) {
            assignments.push({
              tenantId: input.tenantId,
              cycleId: input.cycleId,
              assessorPersonId: assessorRole.personId,
              targetType: "ROLE",
              targetId: target.id,
              feedbackTypeId: feedbackType.id,
              status: "PENDING",
              dueDate: input.dueDate ?? null,
            });
          }
        }
      } else if (input.feedbackTypeKey === "upward") {
        // Each CEO rates every CXO (upward feedback into the fund)
        for (const ceo of ceoRoles) {
          for (const target of cxoRoles) {
            assignments.push({
              tenantId: input.tenantId,
              cycleId: input.cycleId,
              assessorPersonId: ceo.personId,
              targetType: "ROLE",
              targetId: target.id,
              feedbackTypeId: feedbackType.id,
              status: "PENDING",
              dueDate: input.dueDate ?? null,
            });
          }
        }
      }

      // Dedup against existing rows so running the same rule twice is safe.
      const existing = await db.getAssignmentsByCycle(input.cycleId, input.tenantId);
      const key = (a: { assessorPersonId: number; targetType: string; targetId: number; feedbackTypeId: number }) =>
        `${a.assessorPersonId}:${a.targetType}:${a.targetId}:${a.feedbackTypeId}`;
      const seen = new Set(existing.map(key));
      const fresh = assignments.filter((a) => !seen.has(key(a)));
      await db.createAssessmentAssignments(fresh);
      return { success: true, count: fresh.length, skipped: assignments.length - fresh.length };
    }),

  // --- Assessments ---
  upsertAssessment: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      targetType: z.enum(["ROLE", "COMPANY", "CHAIN"]),
      targetId: z.number(),
      dimensionKey: z.string(),
      feedbackTypeId: z.number(),
      score: z.number().min(1).max(10).nullable(),
      rag: z.enum(["RED", "AMBER", "GREEN"]).nullable(),
      note: z.string().nullable(),
      confidenceNote: z.string().nullable(),
      submit: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person profile not found" });

      await db.upsertGovernanceAssessment({
        tenantId: input.tenantId,
        cycleId: input.cycleId,
        assessorPersonId: person.id,
        targetType: input.targetType,
        targetId: input.targetId,
        dimensionKey: input.dimensionKey,
        feedbackTypeId: input.feedbackTypeId,
        score: input.score,
        rag: input.rag,
        note: input.note,
        confidenceNote: input.confidenceNote,
        submittedAt: input.submit ? new Date() : null,
      });

      // If Chairman is submitting, notify the target so they know their
      // perception-gap panel will unlock once they also submit.
      if (input.submit) {
        const chairmanType = await db.getFeedbackTypeByKey("chairman", input.tenantId);
        if (chairmanType && chairmanType.id === input.feedbackTypeId) {
          const cycles = await db.getGovernanceCyclesByTenant(input.tenantId);
          const cycle = cycles.find((c) => c.id === input.cycleId);
          const month = cycle?.month ?? "this cycle";
          if (input.targetType === "ROLE") {
            governanceNotifications
              .notifyChairmanSubmittedForRoleTarget(input.tenantId, input.targetId, month)
              .catch(() => {});
          } else if (input.targetType === "COMPANY") {
            governanceNotifications
              .notifyChairmanSubmittedForCompanyTarget(input.tenantId, input.targetId, month)
              .catch(() => {});
          }
        }
      }
      return { success: true };
    }),

  getMyAssessments: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .query(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      return await db.getAssessmentsByAssessor(person.id, input.cycleId, input.tenantId);
    }),

  getAssessmentsForTarget: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      targetType: z.enum(["ROLE", "COMPANY", "CHAIN"]),
      targetId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const all = await db.getAssessmentsForTarget(
        input.targetType,
        input.targetId,
        input.cycleId,
        input.tenantId,
      );
      const viewer = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!viewer) return [];
      // Determine if viewer is the subject (target ROLE.personId or COMPANY leader)
      let viewerIsSubject = false;
      if (input.targetType === "ROLE") {
        const role = await db.getRoleById(input.targetId, input.tenantId);
        viewerIsSubject = role?.personId === viewer.id;
      }
      const viewerIsAssessor = all.some(a => a.assessorPersonId === viewer.id);
      // Apply reveal gating per feedbackTypes.visibilityRule
      return await filterAssessmentsByVisibility(all, {
        tenantId: input.tenantId,
        cycleId: input.cycleId,
        viewerPersonId: viewer.id,
        viewerIsSubject,
        viewerIsAssessor,
      });
    }),

  // --- Assignments ---
  getMyAssignments: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .query(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      return await db.getAssignmentsForAssessor(person.id, input.cycleId, input.tenantId);
    }),

  listAssignments: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .query(async ({ input }) => {
      return await db.getAssignmentsByCycle(input.cycleId, input.tenantId);
    }),

  // --- Mandate journals ---
  upsertJournal: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      dimensionKey: z.string(),
      roleId: z.number().nullable(),
      orgUnitId: z.number().nullable(),
      logText: z.string().nullable(),
      planText: z.string().nullable(),
      planItems: z.array(z.object({
        item: z.string(),
        completedNextMonth: z.boolean().nullable(),
      })).nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person profile not found" });

      await db.upsertMandateJournal({
        tenantId: input.tenantId,
        personId: person.id,
        cycleId: input.cycleId,
        dimensionKey: input.dimensionKey,
        roleId: input.roleId,
        orgUnitId: input.orgUnitId,
        logText: input.logText,
        planText: input.planText,
        planItems: input.planItems,
      });
      return { success: true };
    }),

  getMyJournals: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .query(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return [];
      return await db.getMandateJournalsByPersonAndCycle(person.id, input.cycleId, input.tenantId);
    }),

  markPriorPlanItem: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      dimensionKey: z.string(),
      priorCycleId: z.number(),
      itemIndex: z.number().int().min(0),
      completed: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person profile not found" });

      const journal = await db.getLastMandateJournal(
        person.id,
        input.dimensionKey,
        input.priorCycleId + 1,
        input.tenantId,
      );
      if (!journal) throw new TRPCError({ code: "NOT_FOUND", message: "Prior journal not found" });

      const items = (journal.planItems ?? []) as Array<{ item: string; completedNextMonth: boolean | null }>;
      if (input.itemIndex >= items.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Item index out of range" });

      const updated = items.map((it, i) =>
        i === input.itemIndex ? { ...it, completedNextMonth: input.completed } : it,
      );
      await db.updateJournalPlanItems(journal.id, updated, input.tenantId);
      return { success: true };
    }),

  getLastJournal: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      dimensionKey: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) return null;
      const last = await db.getLastMandateJournal(
        person.id,
        input.dimensionKey,
        input.cycleId,
        input.tenantId,
      );
      return last ?? null;
    }),

  // --- Company reflections ---
  upsertReflection: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      orgUnitId: z.number(),
      wentWell: z.array(z.string()).nullable(),
      didntGoWell: z.array(z.string()).nullable(),
      risks: z.array(z.string()).nullable(),
      needsFromFund: z.array(z.string()).nullable(),
      forwardCommitments: z.array(z.string()).nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person profile not found" });

      // Only the CEO of this company (or Chairman/Admin) can write its reflection
      const ok = await db.canEditCompanyFinancials(ctx.user.id, input.tenantId, input.orgUnitId);
      if (!ok) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the CEO of this company (or Chairman/Admin) can submit its reflection.",
        });
      }

      await db.upsertCompanyReflection({
        tenantId: input.tenantId,
        ceoPersonId: person.id,
        orgUnitId: input.orgUnitId,
        cycleId: input.cycleId,
        wentWell: input.wentWell,
        didntGoWell: input.didntGoWell,
        risks: input.risks,
        needsFromFund: input.needsFromFund,
        forwardCommitments: input.forwardCommitments,
      });
      return { success: true };
    }),

  getReflection: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      orgUnitId: z.number(),
    }))
    .query(async ({ input }) => {
      return await db.getCompanyReflection(input.orgUnitId, input.cycleId, input.tenantId) ?? null;
    }),

  listReflections: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .query(async ({ input }) => {
      return await db.getCompanyReflectionsByCycle(input.cycleId, input.tenantId);
    }),

  // --- Chairman guidance ---
  createGuidance: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      targetType: z.enum(["ROLE", "COMPANY"]),
      targetId: z.number(),
      dimensionKey: z.string().nullable(),
      guidanceText: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Only the Chairman or Admin can write guidance." });
      const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person profile not found" });

      await db.createChairmanGuidance({
        tenantId: input.tenantId,
        cycleId: input.cycleId,
        chairmanPersonId: person.id,
        targetType: input.targetType,
        targetId: input.targetId,
        dimensionKey: input.dimensionKey,
        guidanceText: input.guidanceText,
      });
      return { success: true };
    }),

  getGuidanceForTarget: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      cycleId: z.number(),
      targetType: z.enum(["ROLE", "COMPANY"]),
      targetId: z.number(),
    }))
    .query(async ({ input }) => {
      return await db.getChairmanGuidanceForTarget(
        input.targetType,
        input.targetId,
        input.cycleId,
        input.tenantId,
      );
    }),

  // --- Dependency chains ---
  listChains: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getDependencyChainsByTenant(input.tenantId);
    }),

  // --- Financial summaries (for cockpit) ---
  listFinancialSummaries: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getFinancialSummariesByTenant(input.tenantId);
    }),

  canEditCompanyFinancials: protectedProcedure
    .input(z.object({ tenantId: z.number(), orgUnitId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await db.canEditCompanyFinancials(ctx.user.id, input.tenantId, input.orgUnitId);
    }),

  writeQuarterlyActual: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      orgUnitId: z.number(),
      metricName: z.string(),
      periodDate: z.date(),
      actualValue: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.canEditCompanyFinancials(ctx.user.id, input.tenantId, input.orgUnitId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Only the CEO of this company (or Chairman/Admin) can edit actuals." });
      await db.upsertQuarterlyActual({
        tenantId: input.tenantId,
        orgUnitId: input.orgUnitId,
        metricName: input.metricName,
        periodDate: input.periodDate,
        actualValue: input.actualValue,
      });
      return { success: true };
    }),

  // --- Roles (helper for chairman dashboard) ---
  listRoles: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getRolesByTenant(input.tenantId);
    }),

  listAssessments: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .query(async ({ input }) => {
      return await db.getAssessmentsByCycle(input.cycleId, input.tenantId);
    }),

  // --- AI insights ---
  listInsights: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .query(async ({ input }) => {
      return await db.getAiInsightsByCycle(input.cycleId, input.tenantId);
    }),

  // --- AI jobs (Phase 4.2 + 4.3) ---
  runCommitmentTracker: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Chairman/Admin only." });
      return await runCommitmentTrackerForCycle(input.tenantId, input.cycleId);
    }),

  listChronicDeferrals: protectedProcedure
    .input(z.object({ tenantId: z.number(), lookbackCycles: z.number().int().min(2).max(12).default(3) }))
    .query(async ({ input }) => {
      return await findChronicDeferralsForTenant(input.tenantId, input.lookbackCycles);
    }),

  runInsightGeneration: protectedProcedure
    .input(z.object({ tenantId: z.number(), cycleId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const ok = await db.isChairmanOrAdmin(ctx.user.id, input.tenantId);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Chairman/Admin only." });
      return await generateAllInsights(input.tenantId, input.cycleId);
    }),

  listInsightsForTarget: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      targetType: z.enum(["ROLE", "COMPANY", "CHAIN", "FUND"]),
      targetId: z.number(),
    }))
    .query(async ({ input }) => {
      return await db.getAiInsightsByTarget(input.targetType, input.targetId, input.tenantId);
    }),
});

// ============================================================================
// MAIN APP ROUTER
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Fractal scope router — viewer/landing/team/org-tree resolution
  scope: scopeRouter,

  // Voice — capture, intent classification, live sessions
  voice: voiceRouter,

  // AI multi-persona deliberation panels
  deliberation: deliberationRouter,

  // Rhythm Layer — daily focus, deadline reminders
  rhythm: rhythmRouter,

  // Access control + preferences
  accessControl: accessControlRouter,
  preferences: preferencesRouter,

  // Feature routers
  tenant: tenantRouter,
  person: personRouter,
  observation: observationRouter,
  plan: planRouter,
  metric: metricRouter,
  reflection: reflectionRouter,
  notification: notificationRouter,
  decision: decisionRouter,
  meeting: meetingRouter,
  incentive: incentiveRouter,
  financial: financialRouter,
  calibration: calibrationRouter,
  constants: constantsRouter,
  governance: governanceRouter,
  
  // Review router
  review: router({
    getDraftByPerson: protectedProcedure
      .input(z.object({ personId: z.number(), tenantId: z.number() }))
      .query(async ({ input }) => {
        // Get latest draft review for person
        const reviews = await db.getReviewsByPerson(input.personId, input.tenantId);
        return reviews.find(r => r.status === "DRAFT") || null;
      }),
    
    saveDraft: protectedProcedure
      .input(z.object({
        reviewId: z.number(),
        content: z.record(z.string(), z.string()),
      }))
      .mutation(async ({ input }) => {
        // Update review content
        const draftContent = JSON.stringify(input.content);
        await db.updateReview(input.reviewId, {
          managerEditedVersion: draftContent,
        });
        return { success: true };
      }),
    
    finalize: protectedProcedure
      .input(z.object({
        reviewId: z.number(),
        content: z.record(z.string(), z.string()),
      }))
      .mutation(async ({ input }) => {
        // Update review content and mark as final
        const finalContent = JSON.stringify(input.content);
        await db.updateReview(input.reviewId, {
          managerEditedVersion: finalContent,
          status: "FINAL",
        });
        return { success: true };
      }),
  }),
  
  // Evidence Upload router
  evidence: router({
    upload: protectedProcedure
      .input(z.object({
        fileData: z.string(), // base64 encoded
        fileName: z.string(),
        mimeType: z.string(),
        tenantId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        
        // Process file with AI extraction
        const result = await processUploadedFile(
          fileBuffer,
          input.fileName,
          input.mimeType,
          input.tenantId
        );
        
        // Get current person to use as uploader
        const person = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, input.tenantId);
        if (!person) throw new TRPCError({ code: 'NOT_FOUND', message: 'Person not found' });
        
        // Store evidence record
        const evidenceId = await db.createEvidence({
          tenantId: input.tenantId,
          uploaderPersonId: person.id,
          type: 'DOCUMENT',
          contentText: result.extraction.extractedText,
          fileUrl: result.fileUrl,
          sourceType: 'FINANCIAL_UPLOAD',
          credibilityTier: 3,
        });
        
        return {
          evidenceId,
          ...result,
        };
      }),
    
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEvidenceByTenant(input.tenantId);
      }),
  }),
  
  // AI Ask router
  ask: router({
    query: protectedProcedure
      .input(z.object({
        question: z.string(),
        tenantId: z.number(),
        context: z.object({
          personId: z.number().optional(),
          orgUnitId: z.number().optional(),
          timeframe: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await processAskQuery({
          ...input,
          userId: ctx.user.id,
        });
      }),
    
    getSuggestions: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await getSuggestedQueries(input.tenantId, ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
