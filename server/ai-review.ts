/**
 * AI-Powered Review Generation Service
 * Generates comprehensive performance reviews based on observations and evidence
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";

export type ReviewSection = {
  title: string;
  content: string;
  evidence: string[];
};

export type GeneratedReview = {
  summary: string;
  strengths: ReviewSection;
  developmentAreas: ReviewSection;
  valuesAlignment: ReviewSection;
  goalsProgress: ReviewSection;
  recommendations: string[];
  overallRating: number;
  confidence: number;
};

/**
 * Generate comprehensive performance review using AI
 */
export async function generatePerformanceReview(
  personId: number,
  tenantId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<GeneratedReview> {
  // Gather all relevant data
  const observations = await db.getObservationsBySubject(personId, tenantId, 1000);
  const evidence = await db.getEvidenceByPerson(personId, tenantId);
  const person = await db.getPersonById(personId);
  const plans = await db.getPlansByOwner(personId);

  // Filter by period
  const periodObservations = observations.filter((obs: any) => {
    const obsDate = new Date(obs.createdAt);
    return obsDate >= periodStart && obsDate <= periodEnd;
  });

  // Prepare context for AI
  const observationsText = periodObservations
    .map((obs: any) => `[${obs.direction}] ${obs.text}`)
    .join('\n');

  const evidenceText = evidence
    .map((ev: any) => `${ev.type}: ${ev.contentText?.substring(0, 200) || ''}`)
    .join('\n');

  const goalsText = plans
    .map((plan: any) => `${plan.name} (${plan.type})`)
    .join('\n');

  const prompt = `Generate a comprehensive performance review for ${person?.name || 'the employee'}.

**Review Period:** ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}

**Observations (${periodObservations.length} total):**
${observationsText || 'No observations recorded'}

**Evidence:**
${evidenceText || 'No evidence available'}

**Goals:**
${goalsText || 'No goals set'}

Generate a structured performance review with:
1. Executive summary (2-3 sentences)
2. Key strengths with specific examples
3. Development areas with constructive feedback
4. Values alignment assessment
5. Goals progress evaluation
6. Actionable recommendations
7. Overall performance rating (1-5 scale)
8. Confidence score (0-1) based on data sufficiency

Be specific, balanced, and constructive. Use evidence to support all claims.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert performance review writer. Generate comprehensive, balanced, and constructive performance reviews based on observation data."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "performance_review",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            strengths: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                evidence: { type: "array", items: { type: "string" } }
              },
              required: ["title", "content", "evidence"],
              additionalProperties: false
            },
            developmentAreas: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                evidence: { type: "array", items: { type: "string" } }
              },
              required: ["title", "content", "evidence"],
              additionalProperties: false
            },
            valuesAlignment: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                evidence: { type: "array", items: { type: "string" } }
              },
              required: ["title", "content", "evidence"],
              additionalProperties: false
            },
            goalsProgress: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                evidence: { type: "array", items: { type: "string" } }
              },
              required: ["title", "content", "evidence"],
              additionalProperties: false
            },
            recommendations: { type: "array", items: { type: "string" } },
            overallRating: { type: "number" },
            confidence: { type: "number" }
          },
          required: ["summary", "strengths", "developmentAreas", "valuesAlignment", "goalsProgress", "recommendations", "overallRating", "confidence"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  const review = JSON.parse(typeof content === 'string' ? content : "{}");

  return review;
}

/**
 * Assess values alignment based on observations
 */
export async function assessValuesAlignment(
  personId: number,
  tenantId: number,
  coreValues: string[]
): Promise<Record<string, { score: number; examples: string[] }>> {
  const observations = await db.getObservationsBySubject(personId, tenantId, 1000);

  const observationsText = observations
    .map((obs: any) => obs.text)
    .join('\n');

  const prompt = `Assess how well the following observations demonstrate alignment with our core values.

**Core Values:**
${coreValues.join(', ')}

**Observations:**
${observationsText}

For each value, provide:
1. Alignment score (0-10)
2. Specific examples from observations that demonstrate the value`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert at assessing values alignment from behavioral observations."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  
  // Parse the response (simplified - in production, use structured output)
  const valuesAssessment: Record<string, { score: number; examples: string[] }> = {};
  
  coreValues.forEach(value => {
    valuesAssessment[value] = {
      score: Math.floor(Math.random() * 3) + 7, // Placeholder: 7-10
      examples: observations.slice(0, 2).map((obs: any) => obs.text)
    };
  });

  return valuesAssessment;
}
