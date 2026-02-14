import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { processAskQuery, getSuggestedQueries } from "./ai-ask";
import { processUploadedFile } from "./ai-extraction";
import * as db from "./db";
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

  // List org units for tenant
  listOrgUnits: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getOrgUnitsByTenant(input.tenantId);
    }),
});

// ============================================================================
// PERSON & PROFILE ROUTER
// ============================================================================

const personRouter = router({
  // Get current user's person profile
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    // Default to tenant 1 for now
    const person = await db.getPersonByUserId(ctx.user.id, 1);
    if (!person) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Person profile not found. Please contact your administrator."
      });
    }
    
    // Get current role
    const role = person.currentRoleId ? await db.getRoleById(person.currentRoleId) : null;
    
    return {
      ...person,
      currentRole: role
    };
  }),

  // Get person by ID
  getById: protectedProcedure
    .input(z.object({ personId: z.number() }))
    .query(async ({ input }) => {
      const person = await db.getPersonById(input.personId);
      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found"
        });
      }
      
      const role = person.currentRoleId ? await db.getRoleById(person.currentRoleId) : null;
      
      return {
        ...person,
        currentRole: role
      };
    }),

  // List all persons in tenant
  list: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPersonsByTenant(input.tenantId);
    }),

  // Get direct reports
  getDirectReports: protectedProcedure.query(async ({ ctx }) => {
    const person = await db.getPersonByUserId(ctx.user.id, 1);
    if (!person || !person.currentRoleId) return [];
    
    const directReportRoles = await db.getDirectReports(person.currentRoleId);
    const directReports = await Promise.all(
      directReportRoles.map(async (role) => {
        const reportPerson = await db.getPersonById(role.personId);
        return {
          ...reportPerson,
          role: role
        };
      })
    );
    
    return directReports.filter(r => r !== null);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
      if (!person) return [];
      
      return await db.getDecisionsByOwner(person.id, input.tenantId);
    }),
});

// ============================================================================
// MEETINGS ROUTER
// ============================================================================

const meetingRouter = router({
  // Start meeting
  start: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      subjectPersonId: z.number(),
      type: z.enum(["ONE_ON_ONE", "TEAM", "REVIEW", "CALIBRATION"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
      const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
});

// ============================================================================
// CONSTANTS ROUTER (Public data)
// ============================================================================

const constantsRouter = router({
  getCoreValues: publicProcedure.query(() => {
    return CORE_VALUES;
  }),

  getObservationTemplates: publicProcedure.query(() => {
    return OBSERVATION_TEMPLATES;
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
  constants: constantsRouter,
  
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
        const person = await db.getPersonByUserId(ctx.user.id, input.tenantId);
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
