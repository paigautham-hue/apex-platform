/**
 * AI Ask - RAG Pipeline for APEX
 * Implements the complete RAG pipeline: Parse → Expand → Route → Retrieve → Rerank → JIT Verify → Generate
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  observations,
  persons,
  memories,
  evidence,
  plans,
  metrics,
  governanceAssessments,
  mandateJournals,
  companyReflections,
  aiInsights,
} from "../drizzle/schema";

export type AskQuery = {
  question: string;
  tenantId: number;
  userId: number;
  context?: {
    personId?: number;
    orgUnitId?: number;
    timeframe?: string;
  };
};

export type AskResponse = {
  answer: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  coverage: number; // 0-100
  sources: Array<{
    type: string;
    id: number;
    text: string;
    relevance: number;
  }>;
  suggestedActions: string[];
  followUpQuestions: string[];
  statusLine: string;
  topInsights: string[];
};

/**
 * Main Ask pipeline
 */
export async function processAskQuery(query: AskQuery): Promise<AskResponse> {
  // Step 1: Parse and understand the query
  const parsedQuery = await parseQuery(query.question);
  
  // Step 2: Expand query with synonyms and related terms
  const expandedQuery = await expandQuery(parsedQuery, query.tenantId);
  
  // Step 3: Route to appropriate data sources
  const dataSources = routeQuery(expandedQuery);
  
  // Step 4: Retrieve relevant evidence
  const retrievedEvidence = await retrieveEvidence(dataSources, query);
  
  // Step 5: Rerank by relevance
  const rerankedEvidence = await rerankEvidence(retrievedEvidence, query.question);
  
  // Step 6: JIT Verification (check data freshness and quality)
  const verifiedEvidence = await jitVerify(rerankedEvidence);
  
  // Step 7: Generate answer using LLM
  const response = await generateAnswer(query.question, verifiedEvidence, query);
  
  return response;
}

/**
 * Step 1: Parse the query to understand intent
 */
async function parseQuery(question: string): Promise<{
  intent: "PERFORMANCE" | "COMPARISON" | "TREND" | "RECOMMENDATION" | "FACTUAL";
  entities: string[];
  timeframe?: string;
  metrics?: string[];
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a query parser for an executive performance platform. Extract intent, entities, timeframe, and metrics from the user's question."
      },
      {
        role: "user",
        content: question
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "query_parse",
        strict: true,
        schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["PERFORMANCE", "COMPARISON", "TREND", "RECOMMENDATION", "FACTUAL"]
            },
            entities: {
              type: "array",
              items: { type: "string" }
            },
            timeframe: { type: "string" },
            metrics: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["intent", "entities"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  return JSON.parse(typeof content === 'string' ? content : "{}");
}

/**
 * Step 2: Expand query with related terms
 */
async function expandQuery(parsed: any, tenantId: number): Promise<string[]> {
  const expansions = [parsed.entities.join(" ")];
  
  // Add synonyms and related terms
  if (parsed.metrics) {
    expansions.push(...parsed.metrics);
  }
  
  return expansions;
}

/**
 * Step 3: Route to appropriate data sources
 */
function routeQuery(expandedQuery: string[]): string[] {
  const sources: string[] = [];
  
  // Always check observations and memories
  sources.push("observations", "memories");
  
  // Check for specific data types
  const queryText = expandedQuery.join(" ").toLowerCase();
  
  if (queryText.includes("goal") || queryText.includes("plan") || queryText.includes("objective")) {
    sources.push("plans");
  }
  
  if (queryText.includes("metric") || queryText.includes("kpi") || queryText.includes("performance")) {
    sources.push("metrics");
  }
  
  if (queryText.includes("evidence") || queryText.includes("document") || queryText.includes("file")) {
    sources.push("evidence");
  }

  // Governance sources — added in Phase 4.1
  if (
    queryText.includes("perception") ||
    queryText.includes("gap") ||
    queryText.includes("chairman") ||
    queryText.includes("self-rating") ||
    queryText.includes("assessment") ||
    queryText.includes("mandate")
  ) {
    sources.push("governance_assessments");
  }
  if (
    queryText.includes("journal") ||
    queryText.includes("captain's log") ||
    queryText.includes("mandate") ||
    queryText.includes("commitment") ||
    queryText.includes("defer") ||
    queryText.includes("next heading") ||
    queryText.includes("plan for") ||
    queryText.includes("what did") ||
    queryText.includes("what was done")
  ) {
    sources.push("mandate_journals");
  }
  if (
    queryText.includes("reflection") ||
    queryText.includes("went well") ||
    queryText.includes("risk") ||
    queryText.includes("needs from fund") ||
    queryText.includes("company monthly")
  ) {
    sources.push("company_reflections");
  }
  if (
    queryText.includes("chain") ||
    queryText.includes("fund vitality") ||
    queryText.includes("insight") ||
    queryText.includes("trend") ||
    queryText.includes("portfolio health")
  ) {
    sources.push("ai_insights");
  }

  return sources;
}

/**
 * Step 4: Retrieve relevant evidence from data sources
 */
async function retrieveEvidence(sources: string[], query: AskQuery): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const results: any[] = [];
  
  // Retrieve from observations
  if (sources.includes("observations")) {
    const obs = await db
      .select()
      .from(observations)
      .where(eq(observations.tenantId, query.tenantId))
      .orderBy(desc(observations.createdAt))
      .limit(50);
    
    results.push(...obs.map(o => ({ type: "observation", data: o })));
  }
  
  // Retrieve from memories (AI-synthesized intelligence)
  if (sources.includes("memories")) {
    const mems = await db
      .select()
      .from(memories)
      .where(eq(memories.tenantId, query.tenantId))
      .orderBy(desc(memories.createdAt))
      .limit(20);
    
    results.push(...mems.map(m => ({ type: "memory", data: m })));
  }
  
  // Retrieve from plans
  if (sources.includes("plans")) {
    const pls = await db
      .select()
      .from(plans)
      .where(eq(plans.tenantId, query.tenantId))
      .limit(20);
    
    results.push(...pls.map(p => ({ type: "plan", data: p })));
  }
  
  // Retrieve from evidence
  if (sources.includes("evidence")) {
    const evid = await db
      .select()
      .from(evidence)
      .where(eq(evidence.tenantId, query.tenantId))
      .orderBy(desc(evidence.createdAt))
      .limit(30);

    results.push(...evid.map(e => ({ type: "evidence", data: e })));
  }

  // Governance retrievers — Phase 4.1
  if (sources.includes("governance_assessments")) {
    const ga = await db
      .select()
      .from(governanceAssessments)
      .where(eq(governanceAssessments.tenantId, query.tenantId))
      .orderBy(desc(governanceAssessments.createdAt))
      .limit(100);
    results.push(...ga.map((a) => ({ type: "governance_assessment", data: a })));
  }

  if (sources.includes("mandate_journals")) {
    const mj = await db
      .select()
      .from(mandateJournals)
      .where(eq(mandateJournals.tenantId, query.tenantId))
      .orderBy(desc(mandateJournals.createdAt))
      .limit(40);
    results.push(...mj.map((j) => ({ type: "mandate_journal", data: j })));
  }

  if (sources.includes("company_reflections")) {
    const cr = await db
      .select()
      .from(companyReflections)
      .where(eq(companyReflections.tenantId, query.tenantId))
      .orderBy(desc(companyReflections.createdAt))
      .limit(20);
    results.push(...cr.map((r) => ({ type: "company_reflection", data: r })));
  }

  if (sources.includes("ai_insights")) {
    const ins = await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.tenantId, query.tenantId))
      .orderBy(desc(aiInsights.createdAt))
      .limit(30);
    results.push(...ins.map((i) => ({ type: "ai_insight", data: i })));
  }

  return results;
}

/**
 * Step 5: Rerank evidence by relevance to the query
 */
async function rerankEvidence(evidence: any[], question: string): Promise<any[]> {
  // Simple keyword-based reranking (in production, use embedding similarity)
  const keywords = question.toLowerCase().split(" ");
  
  const scored = evidence.map(item => {
    let score = 0;
    const text = JSON.stringify(item.data).toLowerCase();
    
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 1;
      }
    });
    
    return { ...item, relevance: score };
  });
  
  return scored.sort((a, b) => b.relevance - a.relevance).slice(0, 20);
}

/**
 * Step 6: JIT Verification - check data freshness and quality
 */
async function jitVerify(evidence: any[]): Promise<any[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return evidence.map(item => {
    const createdAt = new Date(item.data.createdAt);
    const isFresh = createdAt > thirtyDaysAgo;
    
    return {
      ...item,
      verified: isFresh,
      freshness: isFresh ? "FRESH" : "STALE"
    };
  });
}

/**
 * Step 7: Generate answer using LLM with retrieved context
 */
async function generateAnswer(
  question: string,
  evidence: any[],
  query: AskQuery
): Promise<AskResponse> {
  // Prepare context from evidence
  const context = evidence
    .slice(0, 10)
    .map((e, i) => `[${i + 1}] ${JSON.stringify(e.data)}`)
    .join("\n\n");
  
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are APEX AI, an intelligent assistant for executive performance management. 
        
Answer questions based on the provided evidence. Be specific, data-driven, and actionable.

Format your response as JSON with:
- answer: Direct answer to the question
- statusLine: One-sentence summary
- topInsights: Array of 2-3 key insights
- suggestedActions: Array of 2-3 actionable next steps
- followUpQuestions: Array of 2-3 relevant follow-up questions
- confidence: HIGH/MEDIUM/LOW based on evidence quality
- coverage: 0-100 percentage of how well evidence covers the question`
      },
      {
        role: "user",
        content: `Question: ${question}\n\nEvidence:\n${context}`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ask_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            statusLine: { type: "string" },
            topInsights: {
              type: "array",
              items: { type: "string" }
            },
            suggestedActions: {
              type: "array",
              items: { type: "string" }
            },
            followUpQuestions: {
              type: "array",
              items: { type: "string" }
            },
            confidence: {
              type: "string",
              enum: ["HIGH", "MEDIUM", "LOW"]
            },
            coverage: { type: "number" }
          },
          required: ["answer", "statusLine", "topInsights", "suggestedActions", "followUpQuestions", "confidence", "coverage"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  const parsed = JSON.parse(typeof content === 'string' ? content : "{}");
  
  return {
    ...parsed,
    sources: evidence.slice(0, 5).map(e => ({
      type: e.type,
      id: e.data.id,
      text: e.data.text || e.data.name || JSON.stringify(e.data).substring(0, 100),
      relevance: e.relevance || 0
    }))
  };
}

/**
 * Get suggested queries based on user context
 */
export async function getSuggestedQueries(tenantId: number, userId: number): Promise<string[]> {
  return [
    // Existing performance-oriented prompts
    "How is my team performing this quarter?",
    "Who are my top performers?",
    "What are the key development areas for my direct reports?",
    "Show me recent observations about [person name]",
    "What goals are at risk?",
    "Compare performance across my teams",

    // Governance-focused prompts — Phase 4.1
    "Show me the biggest perception gaps this month",
    "Which CEOs have been deferring the same commitments?",
    "What's the Financial Truth chain health trend over 6 months?",
    "Compare MPI's self-assessment with the Chairman's assessment",
    "Which mandates went un-logged this cycle?",
    "What needs-from-fund are being raised most often?",
  ];
}
