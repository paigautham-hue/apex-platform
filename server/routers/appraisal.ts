/**
 * Appraisal Router
 * Handles PACE self-appraisal uploads, JD uploads, and human-first chairman appraisal.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { selfAppraisals, paceAppraisals, persons, roles, observations, plans } from "../../drizzle/schema";
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
      fileBase64: z.string(),
      mimeType: z.string().default("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      fiscalYear: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `self-appraisals/${caller.tenantId}/${input.personId}/${suffix}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);

      let extractedData = null;
      if (input.mimeType.includes("wordprocessingml") || input.fileName.endsWith(".docx")) {
        try {
          extractedData = await parsePaceDocument(fileBuffer);
        } catch (e) {
          console.warn("PACE parsing failed:", e);
        }
      }

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await database.insert(selfAppraisals).values({
        tenantId: caller.tenantId,
        personId: input.personId,
        fileUrl,
        fileKey,
        fileName: input.fileName,
        fiscalYear: input.fiscalYear ?? (extractedData as any)?.header?.fiscalYear ?? null,
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
      return database
        .select()
        .from(selfAppraisals)
        .where(and(eq(selfAppraisals.tenantId, caller.tenantId), eq(selfAppraisals.personId, input.personId)))
        .orderBy(desc(selfAppraisals.uploadedAt));
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

  /**
   * Re-parse an existing self-appraisal document to re-extract KPI rows.
   * Useful when the parser is improved after the initial upload.
   */
  reparse: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [sa] = await database.select().from(selfAppraisals).where(and(
        eq(selfAppraisals.id, input.id),
        eq(selfAppraisals.tenantId, caller.tenantId)
      ));
      if (!sa) throw new TRPCError({ code: "NOT_FOUND" });

      // Download the file from S3 and re-parse
      const response = await fetch(sa.fileUrl);
      if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not fetch file from storage" });
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      let extractedData = sa.extractedData as any;
      try {
        const reparsed = await parsePaceDocument(fileBuffer);
        // Merge: keep existing header/overall comments, update kpiRows
        extractedData = {
          ...(sa.extractedData as any ?? {}),
          ...reparsed,
          // Preserve rawText from reparsed
          rawText: reparsed.rawText,
        };
      } catch (e) {
        console.warn("Re-parse failed:", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Re-parsing failed" });
      }

      await database.update(selfAppraisals).set({
        extractedData,
      }).where(eq(selfAppraisals.id, input.id));

      return { success: true, extractedData };
    }),
});

// ─── JD Document Upload ───────────────────────────────────────────────────────

const jdDocumentRouter = router({
  upload: protectedProcedure
    .input(z.object({
      roleId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string().default("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `jd-documents/${caller.tenantId}/${input.roleId}/${suffix}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Extract text from the JD document
      let jdText = "";
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        jdText = result.value;
      } catch (e) {
        console.warn("JD text extraction failed:", e);
      }

      // Save URL and extracted text to the role
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await database.update(roles).set({
        jdDocumentUrl: fileUrl,
        jdDocumentText: jdText.slice(0, 10000), // cap at 10k chars
        updatedAt: new Date(),
      }).where(and(eq(roles.id, input.roleId), eq(roles.tenantId, caller.tenantId)));

      return { fileUrl, jdTextLength: jdText.length };
    }),
});

// ─── PACE Appraisal (Chairman) ────────────────────────────────────────────────

/** Schema for Chairman's raw per-KPI input */
const chairmanKpiInputSchema = z.object({
  goalName: z.string(),
  chairmanRawInput: z.string(), // Chairman's own words before AI polishing
});

const paceAppraisalRouter = router({
  /**
   * Step 1: Fetch all context data for a person (for the Context Review step).
   * Returns JD, self-appraisal, goals, observations, financial KPIs.
   */
  getContext: protectedProcedure
    .input(z.object({
      personId: z.number(),
      selfAppraisalId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Person + role
      const [person] = await database.select().from(persons).where(eq(persons.id, input.personId));
      if (!person) throw new TRPCError({ code: "NOT_FOUND" });

      const [role] = await database.select().from(roles).where(and(
        eq(roles.personId, input.personId),
        eq(roles.isActive, true)
      ));

      // Self-appraisal
      let selfAppraisalData: any = null;
      let selfAppraisalFileName = "";
      if (input.selfAppraisalId) {
        const [sa] = await database.select().from(selfAppraisals).where(eq(selfAppraisals.id, input.selfAppraisalId));
        selfAppraisalData = sa?.extractedData;
        selfAppraisalFileName = sa?.fileName ?? "";
      } else {
        const [latest] = await database
          .select()
          .from(selfAppraisals)
          .where(and(eq(selfAppraisals.tenantId, caller.tenantId), eq(selfAppraisals.personId, input.personId)))
          .orderBy(desc(selfAppraisals.uploadedAt))
          .limit(1);
        selfAppraisalData = latest?.extractedData;
        selfAppraisalFileName = latest?.fileName ?? "";
      }

      // Goals (plans owned by this person)
      const personGoals = await database
        .select()
        .from(plans)
        .where(and(eq(plans.tenantId, caller.tenantId), eq(plans.ownerPersonId, input.personId)))
        .orderBy(desc(plans.createdAt))
        .limit(20);

      // Observations about this person
      const personObservations = await database
        .select()
        .from(observations)
        .where(and(eq(observations.tenantId, caller.tenantId), eq(observations.subjectPersonId, input.personId)))
        .orderBy(desc(observations.createdAt))
        .limit(30);

      return {
        person,
        role: role ?? null,
        jdDocumentUrl: role?.jdDocumentUrl ?? null,
        jdDocumentText: role?.jdDocumentText ?? null,
        rolePurpose: role?.rolePurpose ?? null,
        keyResponsibilities: role?.keyResponsibilities ?? [],
        successMetrics: role?.successMetrics ?? [],
        selfAppraisalData,
        selfAppraisalFileName,
        goals: personGoals,
        observations: personObservations,
      };
    }),

  /**
   * Step 3: AI Enhancement — takes Chairman's raw per-KPI input and overall view,
   * polishes them using all available context (JD, self-appraisal, goals, observations).
   * Returns AI-polished versions alongside the originals for side-by-side review.
   */
  synthesise: protectedProcedure
    .input(z.object({
      personId: z.number(),
      selfAppraisalId: z.number().optional(),
      fiscalYear: z.string().optional(),
      // Chairman's raw input — the human judgment formed in Step 2
      chairmanKpiInputs: z.array(chairmanKpiInputSchema),
      chairmanOverallView: z.string(), // Chairman's raw overall narrative
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch person + role
      const [person] = await database.select().from(persons).where(eq(persons.id, input.personId));
      if (!person) throw new TRPCError({ code: "NOT_FOUND" });

      const [role] = await database.select().from(roles).where(and(
        eq(roles.personId, input.personId),
        eq(roles.isActive, true)
      ));

      // Fetch self-appraisal
      let selfAppraisalData: any = null;
      if (input.selfAppraisalId) {
        const [sa] = await database.select().from(selfAppraisals).where(eq(selfAppraisals.id, input.selfAppraisalId));
        selfAppraisalData = sa?.extractedData;
      } else {
        const [latest] = await database
          .select()
          .from(selfAppraisals)
          .where(and(eq(selfAppraisals.tenantId, caller.tenantId), eq(selfAppraisals.personId, input.personId)))
          .orderBy(desc(selfAppraisals.uploadedAt))
          .limit(1);
        selfAppraisalData = latest?.extractedData;
      }

      // Fetch goals
      const personGoals = await database
        .select()
        .from(plans)
        .where(and(eq(plans.tenantId, caller.tenantId), eq(plans.ownerPersonId, input.personId)))
        .limit(15);

      // Fetch observations
      const personObservations = await database
        .select()
        .from(observations)
        .where(and(eq(observations.tenantId, caller.tenantId), eq(observations.subjectPersonId, input.personId)))
        .orderBy(desc(observations.createdAt))
        .limit(25);

      // Build rich context
      const jdContext = role?.jdDocumentText
        ? `JOB DESCRIPTION:\n${role.jdDocumentText.slice(0, 3000)}`
        : role?.rolePurpose
          ? `ROLE PURPOSE:\n${role.rolePurpose}\n\nKEY RESPONSIBILITIES:\n${(role.keyResponsibilities ?? []).join("\n")}`
          : "No job description available.";

      const selfAppraisalContext = selfAppraisalData
        ? `SELF-APPRAISAL (Employee's own assessment):\n${JSON.stringify(selfAppraisalData, null, 2).slice(0, 4000)}`
        : "No self-appraisal uploaded.";

      const goalsContext = personGoals.length > 0
        ? `GOALS SET FOR THE PERIOD:\n${personGoals.map(g => `- ${g.name} (${g.status}, ${g.category})`).join("\n")}`
        : "No goals recorded in the system.";

      const observationsContext = personObservations.length > 0
        ? `OBSERVATIONS FROM THE YEAR:\n${personObservations.map(o => `[${o.direction ?? "NEUTRAL"}] ${o.text}`).join("\n")}`
        : "No observations recorded yet.";

      const kpiRows = (selfAppraisalData as any)?.kpiRows ?? [];

      // Build the Chairman's raw input summary
      const chairmanInputSummary = input.chairmanKpiInputs
        .map(k => `KPI: ${k.goalName}\nChairman's View: ${k.chairmanRawInput}`)
        .join("\n\n");

      const systemPrompt = `You are a professional executive communications assistant helping the Chairman of Manipal Group write a PACE performance appraisal.

Your role is to take the Chairman's own raw thoughts and polish them into clear, professional, balanced language — while PRESERVING the Chairman's judgment and intent. You do NOT replace the Chairman's assessment with your own. You enhance the expression of what the Chairman has already said.

Rules:
1. Never contradict or override the Chairman's stated view
2. Add specific evidence from the self-appraisal, goals, and observations to support the Chairman's points
3. Where the Chairman's input is positive, reinforce with evidence
4. Where the Chairman's input is critical, frame constructively but do not soften the core message
5. Write in first person as the Chairman ("I observed...", "Your performance on...", "I expect...")
6. Each KPI comment should be 2-4 sentences
7. The overall narrative should be 4-6 sentences
8. Flag any KPI where the Chairman left their input blank — mark it as "AI_SUGGESTED" in the source field`;

      const userPrompt = `Please polish the Chairman's appraisal comments for ${person.name}, ${role?.title ?? "Executive"}.

${jdContext}

${selfAppraisalContext}

${goalsContext}

${observationsContext}

CHAIRMAN'S RAW INPUT (these are the Chairman's own words — polish them, do not replace them):
${chairmanInputSummary}

CHAIRMAN'S OVERALL VIEW:
${input.chairmanOverallView}

Respond with JSON in this exact format:
{
  "kpiComments": [
    {
      "goalName": "exact KPI name from self-appraisal",
      "chairmanRaw": "Chairman's original words",
      "polished": "AI-polished version",
      "source": "CHAIRMAN_POLISHED" | "AI_SUGGESTED"
    }
  ],
  "overallComments": {
    "chairmanRaw": "Chairman's original overall view",
    "polished": "AI-polished overall narrative"
  },
  "quadrantSuggestion": "STAR | HIGH_POTENTIAL | NEEDS_DEVELOPMENT | BRILLIANT_JERK",
  "fitSuggestion": "STRONG_FIT | DEVELOPING | CONCERNS | NOT_FIT",
  "synthesisNotes": "2-3 sentence internal summary of key themes"
}`;

      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pace_appraisal_enhanced",
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
                      chairmanRaw: { type: "string" },
                      polished: { type: "string" },
                      source: { type: "string" },
                    },
                    required: ["goalName", "chairmanRaw", "polished", "source"],
                    additionalProperties: false,
                  },
                },
                overallComments: {
                  type: "object",
                  properties: {
                    chairmanRaw: { type: "string" },
                    polished: { type: "string" },
                  },
                  required: ["chairmanRaw", "polished"],
                  additionalProperties: false,
                },
                quadrantSuggestion: { type: "string" },
                fitSuggestion: { type: "string" },
                synthesisNotes: { type: "string" },
              },
              required: ["kpiComments", "overallComments", "quadrantSuggestion", "fitSuggestion", "synthesisNotes"],
              additionalProperties: false,
            },
          },
        },
      });

      const aiResult = JSON.parse(llmResponse.choices[0].message.content as string);

      // Merge with original KPI rows from self-appraisal
      const mergedKpiRows = kpiRows.length > 0
        ? kpiRows.map((row: any) => {
            const aiComment = aiResult.kpiComments.find(
              (c: any) => c.goalName.toLowerCase().includes((row.goalName ?? "").toLowerCase().slice(0, 10))
            ) ?? aiResult.kpiComments.find((_: any, i: number) => i === kpiRows.indexOf(row));
            return {
              ...row,
              chairmanRaw: aiComment?.chairmanRaw ?? "",
              polishedAppraiserComments: aiComment?.polished ?? "",
              appraiserComments: aiComment?.polished ?? "", // default to polished
              source: aiComment?.source ?? "AI_SUGGESTED",
            };
          })
        : aiResult.kpiComments.map((c: any) => ({
            goalName: c.goalName,
            chairmanRaw: c.chairmanRaw,
            polishedAppraiserComments: c.polished,
            appraiserComments: c.polished,
            source: c.source,
          }));

      const paceData = {
        kpiRows: mergedKpiRows,
        financialTable: (selfAppraisalData as any)?.financialTable ?? [],
        developmentGoals: (selfAppraisalData as any)?.developmentGoals ?? [],
        employeeOverallComments: (selfAppraisalData as any)?.employeeOverallComments ?? "",
        chairmanOverallRaw: input.chairmanOverallView,
        appraiserOverallComments: aiResult.overallComments.polished,
        quadrant: aiResult.quadrantSuggestion,
        fitDetermination: aiResult.fitSuggestion,
      };

      // Save draft appraisal
      const [insertResult] = await database.insert(paceAppraisals).values({
        tenantId: caller.tenantId,
        personId: input.personId,
        selfAppraisalId: input.selfAppraisalId ?? null,
        appraiserId: caller.id,
        fiscalYear: input.fiscalYear ?? (selfAppraisalData as any)?.header?.fiscalYear ?? null,
        paceData,
        aiSynthesisSummary: aiResult.synthesisNotes,
        status: "AI_DRAFT",
      });

      return {
        id: (insertResult as any).insertId,
        paceData,
        aiSynthesisSummary: aiResult.synthesisNotes,
        quadrantSuggestion: aiResult.quadrantSuggestion,
        fitSuggestion: aiResult.fitSuggestion,
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

  /** List all persons with their latest appraisal status (for bulk view) */
  listAll: protectedProcedure
    .input(z.object({ fiscalYear: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get all persons in the tenant
      const allPersons = await database
        .select()
        .from(persons)
        .where(eq(persons.tenantId, caller.tenantId))
        .orderBy(persons.name);

      // Get all active roles
      const allRoles = await database
        .select()
        .from(roles)
        .where(and(eq(roles.tenantId, caller.tenantId), eq(roles.isActive, true)));

      // Get all pace appraisals (optionally filtered by fiscal year)
      const appraisalQuery = database
        .select()
        .from(paceAppraisals)
        .where(eq(paceAppraisals.tenantId, caller.tenantId))
        .orderBy(desc(paceAppraisals.createdAt));
      const allAppraisals = await appraisalQuery;

      // Build a map: personId -> latest appraisal
      const latestByPerson = new Map<number, typeof allAppraisals[0]>();
      for (const a of allAppraisals) {
        if (!input.fiscalYear || a.fiscalYear === input.fiscalYear) {
          if (!latestByPerson.has(a.personId)) {
            latestByPerson.set(a.personId, a);
          }
        }
      }

      // Build role map
      const roleByPerson = new Map<number, typeof allRoles[0]>();
      for (const r of allRoles) roleByPerson.set(r.personId, r);

      return allPersons.map(p => ({
        person: p,
        role: roleByPerson.get(p.id) ?? null,
        latestAppraisal: latestByPerson.get(p.id) ?? null,
      }));
    }),

  /** Export a saved appraisal as a Word document */
  exportDocx: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
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

      const [person] = await database.select().from(persons).where(eq(persons.id, appraisal.personId));
      const [role] = await database.select().from(roles).where(and(
        eq(roles.personId, appraisal.personId),
        eq(roles.isActive, true)
      ));

      const pd = appraisal.paceData as any;
      const kpiRows: any[] = pd?.kpiRows ?? [];

      // Build Word document using docx package
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } = await import("docx");

      const headerRows = [
        ["Company Name", "Manipal Group"],
        ["Name", person?.name ?? ""],
        ["Designation", role?.title ?? ""],
        ["Fiscal Year", appraisal.fiscalYear ?? ""],
        ["Quadrant", pd?.quadrant ?? ""],
        ["Fit Determination", pd?.fitDetermination ?? ""],
      ];

      const makeCell = (text: string, bold = false, shaded = false) => new TableCell({
        shading: shaded ? { fill: "E8EEF7" } : undefined,
        children: [new Paragraph({
          children: [new TextRun({ text, bold, size: 20 })],
        })],
      });

      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: headerRows.map(([label, value]) => new TableRow({
          children: [makeCell(label, true, true), makeCell(value)],
        })),
      });

      // KPI table
      const kpiHeaderRow = new TableRow({
        children: ["#", "Goal Name", "Weightage", "Employee Self-Appraisal", "Appraiser Comments"].map(
          (h) => makeCell(h, true, true)
        ),
      });
      const kpiDataRows = kpiRows.map((row: any, i: number) => new TableRow({
        children: [
          makeCell(row.rowNumber ?? String(i + 1)),
          makeCell(row.goalName ?? ""),
          makeCell(row.weightage ?? ""),
          makeCell(row.employeeSelfAppraisal ?? row.selfAppraisal ?? ""),
          makeCell(row.appraiserComments ?? ""),
        ],
      }));

      const kpiTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [kpiHeaderRow, ...kpiDataRows],
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: "PACE Performance Appraisal", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "" }),
            headerTable,
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Performance Assessment", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: "" }),
            kpiTable,
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Overall Comments", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "Employee: ", bold: true }), new TextRun({ text: pd?.employeeOverallComments ?? "" })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "Appraiser: ", bold: true }), new TextRun({ text: pd?.appraiserOverallComments ?? "" })] }),
            ...(pd?.developmentGoals?.length > 0 ? [
              new Paragraph({ text: "" }),
              new Paragraph({ text: "Leadership Development Plan", heading: HeadingLevel.HEADING_2 }),
              ...pd.developmentGoals.map((g: string, i: number) => new Paragraph({ text: `${i + 1}. ${g}` })),
            ] : []),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const base64 = buffer.toString("base64");
      const fileName = `PACE-${person?.name?.replace(/\s+/g, "-") ?? "Appraisal"}-${appraisal.fiscalYear ?? "FY"}.docx`;

      return { base64, fileName, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
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
        .where(and(eq(paceAppraisals.tenantId, caller.tenantId), eq(paceAppraisals.personId, input.personId)))
        .orderBy(desc(paceAppraisals.createdAt));
    }),

  /** Save/update an appraisal (human edits after side-by-side review) */
  save: protectedProcedure
    .input(z.object({
      id: z.number(),
      paceData: z.any(),
      quadrant: z.string().optional(),
      fitDetermination: z.string().optional(),
      status: z.enum(["AI_DRAFT", "IN_PROGRESS", "FINAL"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = 1;
      const caller = await db.getPersonByUserIdOrEmail(ctx.user.id, ctx.user.email ?? undefined, tenantId);
      if (!caller) throw new TRPCError({ code: "FORBIDDEN" });

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updatedPaceData = {
        ...(input.paceData as object),
        quadrant: input.quadrant ?? (input.paceData as any)?.quadrant,
        fitDetermination: input.fitDetermination ?? (input.paceData as any)?.fitDetermination,
      };

      await database
        .update(paceAppraisals)
        .set({
          paceData: updatedPaceData,
          status: input.status ?? "IN_PROGRESS",
          updatedAt: new Date(),
        })
        .where(and(eq(paceAppraisals.id, input.id), eq(paceAppraisals.tenantId, caller.tenantId)));

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
  jdDocument: jdDocumentRouter,
  pace: paceAppraisalRouter,
  roleMandate: roleMandateRouter,
});
