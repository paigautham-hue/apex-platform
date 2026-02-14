import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { observations, evidence, memories, persons, reviews } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

interface ReviewSection {
  title: string;
  content: string;
  confidence: number;
  evidenceCount: number;
}

interface LivingReviewDraft {
  personId: number;
  generatedAt: Date;
  sections: ReviewSection[];
  overallSummary: string;
  dataQuality: "EXCELLENT" | "GOOD" | "DEVELOPING" | "MINIMAL" | "INSUFFICIENT";
  observationCount: number;
  lastUpdated: Date;
}

/**
 * Generate or update Living Review Draft for a person
 * Triggered after every 5th observation
 */
export async function generateLivingReviewDraft(
  personId: number,
  tenantId: number
): Promise<LivingReviewDraft> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch person details
  const [person] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.tenantId, tenantId)))
    .limit(1);

  if (!person) throw new Error("Person not found");

  // Fetch all observations for this person
  const personObservations = await db
    .select()
    .from(observations)
    .where(and(eq(observations.subjectPersonId, personId), eq(observations.tenantId, tenantId)))
    .orderBy(desc(observations.createdAt));

  // Fetch all evidence for this person (filter by taggedPersonIds in application layer)
  const allEvidence = await db
    .select()
    .from(evidence)
    .where(eq(evidence.tenantId, tenantId))
    .orderBy(desc(evidence.createdAt));
  
  const personEvidence = allEvidence.filter(ev => 
    ev.taggedPersonIds && Array.isArray(ev.taggedPersonIds) && ev.taggedPersonIds.includes(personId)
  );

  // Fetch memories (AI-synthesized intelligence)
  const personMemories = await db
    .select()
    .from(memories)
    .where(and(eq(memories.personId, personId), eq(memories.tenantId, tenantId)))
    .orderBy(desc(memories.createdAt));

  const totalDataPoints = personObservations.length + personEvidence.length;

  // Determine data quality
  let dataQuality: LivingReviewDraft["dataQuality"];
  if (totalDataPoints >= 20) dataQuality = "EXCELLENT";
  else if (totalDataPoints >= 10) dataQuality = "GOOD";
  else if (totalDataPoints >= 5) dataQuality = "DEVELOPING";
  else if (totalDataPoints >= 1) dataQuality = "MINIMAL";
  else dataQuality = "INSUFFICIENT";

  if (dataQuality === "INSUFFICIENT") {
    return {
      personId,
      generatedAt: new Date(),
      sections: [],
      overallSummary: "Insufficient data to generate review. Need at least 1 observation.",
      dataQuality,
      observationCount: totalDataPoints,
      lastUpdated: new Date(),
    };
  }

  // Prepare context for AI
  const context = {
    person: {
      name: person.name,
      roleId: person.currentRoleId,
      hireDate: person.hireDate,
      tenure: person.hireDate
        ? Math.floor((Date.now() - person.hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365))
        : 0,
    },
    observations: personObservations.map((obs) => ({
      date: obs.createdAt,
      text: obs.text,
      direction: obs.direction,
      voiceTranscript: obs.voiceTranscript,
    })),
    evidence: personEvidence.map((ev) => ({
      date: ev.createdAt,
      contentText: ev.contentText,
      credibilityTier: ev.credibilityTier,
    })),
    memories: personMemories.map((mem) => ({
      content: mem.claimText,
      confidence: mem.confidenceScore,
    })),
  };

  // Generate review using LLM with structured output
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert performance review writer for APEX, an executive performance management platform. Your task is to generate a comprehensive, evidence-based performance review draft.

CRITICAL RULES:
1. Base ALL statements on actual evidence provided - never fabricate
2. Use specific examples from observations and evidence
3. Acknowledge data gaps honestly
4. Structure review into clear sections: Values, Performance Dimensions, Strengths, Development Areas
5. Maintain professional, constructive tone
6. Quantify whenever possible (e.g., "demonstrated in 8 of 12 observations")`,
      },
      {
        role: "user",
        content: `Generate a Living Review Draft for ${person.name} based on the following evidence:\n\n${JSON.stringify(context, null, 2)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "living_review_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  confidence: { type: "number" },
                  evidenceCount: { type: "number" },
                },
                required: ["title", "content", "confidence", "evidenceCount"],
                additionalProperties: false,
              },
            },
            overallSummary: { type: "string" },
          },
          required: ["sections", "overallSummary"],
          additionalProperties: false,
        },
      },
    },
  });

  const messageContent = response.choices[0]?.message?.content;
  const contentString = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
  const reviewData = JSON.parse(contentString || "{}");

  return {
    personId,
    generatedAt: new Date(),
    sections: reviewData.sections || [],
    overallSummary: reviewData.overallSummary || "",
    dataQuality,
    observationCount: totalDataPoints,
    lastUpdated: new Date(),
  };
}

/**
 * Check if review draft needs regeneration (after 5th new observation)
 */
export async function shouldRegenerateDraft(
  personId: number,
  tenantId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Get latest review
  const [latestReview] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.personId, personId), eq(reviews.tenantId, tenantId)))
    .orderBy(desc(reviews.updatedAt))
    .limit(1);

  if (!latestReview) return true; // No review exists, generate first one

  // Count observations since last review update
  const newObservations = await db
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.subjectPersonId, personId),
        eq(observations.tenantId, tenantId)
        // createdAt > latestReview.updatedAt
      )
    );

  // Regenerate after every 5 new observations
  return newObservations.length >= 5;
}
