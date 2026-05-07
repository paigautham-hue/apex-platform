/**
 * Appraisal Router
 * Handles PACE self-appraisal uploads, extraction, and chairman appraisal generation.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
// getDb is accessed via db.getDb() helper
import { selfAppraisals, paceAppraisals, persons, roles, observations, evidence } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { storagePut } from "../storage";
import { parsePaceDocument } from "../paceParser";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";

// ─── Self-Appraisal Upload ────────────────────────────────────────────────────

const selfAppraisalRouter = router({
  upload: protectedProcedure
    .input(z.object({
      personId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(), // base64 encoded file content
      mimeType: z.string().default("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      fiscalYear: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1; // Default tenant
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this tenant" });

      // Decode base64 to buffer
      const fileBuffer = Buffer.from(input.fileBase64, "base64");

      // Upload to S3
      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `self-appraisals/${caller.tenantId}/${input.personId}/${suffix}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Parse PACE document if it's a Word file
      let extractedData = null;
      if (input.mimeType.includes("wordprocessingml") || input.fileName.endsWith(".docx")) {
        try {
          extractedData = await parsePaceDocument(fileBuffer);
        } catch (e) {
          console.warn("PACE parsing failed, storing without extraction:", e);
        }
      }

      // Save to database
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await database.insert(selfAppraisals).values({
        tenantId: caller.tenantId,
        personId: input.personId,
        fileUrl,
        fileKey,
        fileName: input.fileName,
        fiscalYear: input.fiscalYear ?? extractedData?.header?.fiscalYear ?? null,
        extractedData,
        uploadedById: caller.id,
      });

      return { id: (result as any).insertId, fileUrl, extractedData };
    }),

  list: protectedProcedure
    .input(z.object({ personId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const items = await database
        .select()
        .from(selfAppraisals)
        .where(and(
          eq(selfAppraisals.tenantId, caller.tenantId),
          eq(selfAppraisals.personId, input.personId)
        ))
        .orderBy(desc(selfAppraisals.uploadedAt));

      return items;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await database.delete(selfAppraisals).where(and(
        eq(selfAppraisals.id, input.id),
        eq(selfAppraisals.tenantId, caller.tenantId)
      ));
      return { success: true };
    }),
});

// ─── PACE Appraisal (Chairman) ────────────────────────────────────────────────

const paceAppraisalRouter = router({
  /** Synthesise all available data about a person and generate AI appraiser comments */
  synthesise: protectedProcedure
    .input(z.object({
      personId: z.number(),
      selfAppraisalId: z.number().optional(),
      fiscalYear: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch person + role
      const [person] = await database.select().from(persons).where(eq(persons.id, input.personId));
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });

      const [role] = await database.select().from(roles).where(and(
        eq(roles.personId, input.personId),
        eq(roles.isActive, true)
      ));

      // Fetch observations about this person
      const personObservations = await database
        .select()
        .from(observations)
        .where(and(
          eq(observations.tenantId, caller.tenantId),
          eq(observations.subjectPersonId, input.personId)
        ))
        .orderBy(desc(observations.createdAt))
        .limit(30);

      // Fetch evidence tagged to this person
      const personEvidence = await database
        .select()
        .from(evidence)
        .where(eq(evidence.tenantId, caller.tenantId))
        .limit(20);

      // Fetch self-appraisal if provided
      let selfAppraisalData: any = null;
      if (input.selfAppraisalId) {
        const [sa] = await database.select().from(selfAppraisals).where(eq(selfAppraisals.id, input.selfAppraisalId));
        selfAppraisalData = sa?.extractedData;
      } else {
        // Get latest self-appraisal
        const [latest] = await database
          .select()
          .from(selfAppraisals)
          .where(and(
            eq(selfAppraisals.tenantId, caller.tenantId),
            eq(selfAppraisals.personId, input.personId)
          ))
          .orderBy(desc(selfAppraisals.uploadedAt))
          .limit(1);
        selfAppraisalData = latest?.extractedData;
      }

      // Build context for LLM
      const observationsSummary = personObservations
        .map(o => `[${o.direction ?? "NEUTRAL"}] ${o.text}`)
        .join("\n");

      const selfAppraisalSummary = selfAppraisalData
        ? JSON.stringify(selfAppraisalData, null, 2)
        : "No self-appraisal uploaded.";

      const kpiRows = selfAppraisalData?.kpiRows ?? [];

      const systemPrompt = `You are the Executive Chairman of Manipal Group conducting a PACE performance appraisal. 
You are assessing ${person.name}, who holds the role of ${role?.title ?? "Executive"} at ${role?.roleType ?? "the company"}.
Your tone is direct, fair, evidence-based, and constructive. You write in the first person as the Chairman.
You reference specific achievements and observations where available.
You are completing the "Appraiser's Comments" column in the PACE form and the "Appraiser Overall Comments" section.`;

      const userPrompt = `Please generate appraiser comments for each KPI row and an overall appraiser narrative for ${person.name}'s PACE appraisal.

SELF-APPRAISAL DATA:
${selfAppraisalSummary}

OBSERVATIONS FROM THE YEAR:
${observationsSummary || "No observations recorded yet."}

ROLE MANDATE:
${role?.scopeDescription ?? "Not specified"}
${role?.rolePurpose ?? ""}

Please respond with a JSON object in this exact format:
{
  "kpiComments": [
    { "goalName": "...", "appraiserComments": "2-3 sentence assessment of this KPI" }
  ],
  "appraiserOverallComments": "3-5 sentence overall narrative as Chairman",
  "quadrant": "STAR | HIGH_POTENTIAL | NEEDS_DEVELOPMENT | BRILLIANT_JERK",
  "fitDetermination": "STRONG_FIT | DEVELOPING | CONCERNS | NOT_FIT",
  "synthesisNotes": "Brief internal notes on key themes observed"
}

For each KPI, reference the employee's self-appraisal claim and either validate, qualify, or challenge it based on the observations.`;

      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pace_appraisal",
            strict: true,
            schema: {
              type: "object",
              properties: {
                kpiComments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      goalName: { type: "string" },
                      appraiserComments: { type: "string" },
                    },
                    required: ["goalName", "appraiserComments"],
                    additionalProperties: false,
                  },
                },
                appraiserOverallComments: { type: "string" },
                quadrant: { type: "string" },
                fitDetermination: { type: "string" },
                synthesisNotes: { type: "string" },
              },
              required: ["kpiComments", "appraiserOverallComments", "quadrant", "fitDetermination", "synthesisNotes"],
              additionalProperties: false,
            },
          },
        },
      });

      const aiResult = JSON.parse(llmResponse.choices[0].message.content as string);

      // Merge AI comments back into KPI rows
      const mergedKpiRows = kpiRows.map((row: any) => {
        const aiComment = aiResult.kpiComments.find(
          (c: any) => c.goalName.toLowerCase().includes((row.goalName ?? "").toLowerCase().slice(0, 10))
        );
        return {
          ...row,
          appraiserComments: aiComment?.appraiserComments ?? "",
        };
      });

      // If no KPI rows from self-appraisal, use AI-generated ones
      const finalKpiRows = mergedKpiRows.length > 0
        ? mergedKpiRows
        : aiResult.kpiComments.map((c: any) => ({
            goalName: c.goalName,
            appraiserComments: c.appraiserComments,
          }));

      const paceData = {
        kpiRows: finalKpiRows,
        financialTable: selfAppraisalData?.financialTable ?? [],
        developmentGoals: selfAppraisalData?.developmentGoals ?? [],
        employeeOverallComments: selfAppraisalData?.employeeOverallComments ?? "",
        appraiserOverallComments: aiResult.appraiserOverallComments,
        quadrant: aiResult.quadrant,
        fitDetermination: aiResult.fitDetermination,
      };

      // Save draft appraisal
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [insertResult] = await drizzleDb.insert(paceAppraisals).values({
        tenantId: caller.tenantId,
        personId: input.personId,
        selfAppraisalId: input.selfAppraisalId ?? null,
        appraiserId: caller.id,
        fiscalYear: input.fiscalYear ?? selfAppraisalData?.header?.fiscalYear ?? null,
        paceData,
        aiSynthesisSummary: aiResult.synthesisNotes,
        status: "AI_DRAFT",
      });

      return {
        id: (insertResult as any).insertId,
        paceData,
        aiSynthesisSummary: aiResult.synthesisNotes,
        personName: person.name,
        personTitle: role?.title,
      };
    }),

  /** Get a specific appraisal */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [appraisal] = await database
        .select()
        .from(paceAppraisals)
        .where(and(eq(paceAppraisals.id, input.id), eq(paceAppraisals.tenantId, caller.tenantId)));

      if (!appraisal) throw new TRPCError({ code: "NOT_FOUND" });
      return appraisal;
    }),

  /** List appraisals for a person */
  list: protectedProcedure
    .input(z.object({ personId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return database
        .select()
        .from(paceAppraisals)
        .where(and(
          eq(paceAppraisals.tenantId, caller.tenantId),
          eq(paceAppraisals.personId, input.personId)
        ))
        .orderBy(desc(paceAppraisals.createdAt));
    }),

  /** Save/update an appraisal (human edits) */
  save: protectedProcedure
    .input(z.object({
      id: z.number(),
      paceData: z.any(),
      status: z.enum(["AI_DRAFT", "IN_PROGRESS", "FINAL"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await database
        .update(paceAppraisals)
        .set({
          paceData: input.paceData,
          status: input.status ?? "IN_PROGRESS",
          updatedAt: new Date(),
        })
        .where(and(
          eq(paceAppraisals.id, input.id),
          eq(paceAppraisals.tenantId, caller.tenantId)
        ));

      return { success: true };
    }),
});

// ─── Role Mandate ─────────────────────────────────────────────────────────────

const roleMandateRouter = router({
  update: protectedProcedure
    .input(z.object({
      roleId: z.number(),
      rolePurpose: z.string().optional(),
      keyResponsibilities: z.array(z.string()).optional(),
      successMetrics: z.array(z.string()).optional(),
      scopeDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (input.rolePurpose !== undefined) updates.rolePurpose = input.rolePurpose;
      if (input.keyResponsibilities !== undefined) updates.keyResponsibilities = input.keyResponsibilities;
      if (input.successMetrics !== undefined) updates.successMetrics = input.successMetrics;
      if (input.scopeDescription !== undefined) updates.scopeDescription = input.scopeDescription;

      await database.update(roles).set(updates).where(and(
        eq(roles.id, input.roleId),
        eq(roles.tenantId, caller.tenantId)
      ));

      return { success: true };
    }),
});

export const appraisalRouter = router({
  selfAppraisal: selfAppraisalRouter,
  pace: paceAppraisalRouter,
  roleMandate: roleMandateRouter,
});
