/**
 * agentic-memory.ts — APEX agentic memory store (Meridian hybrid retrieval).
 *
 * Stores categorized, scoped memories with optional embedding vectors.
 * Retrieves via hybrid scoring: semantic + confidence + recency + category.
 *
 * Categories: PREFERENCE, FACT, PATTERN, INSIGHT, COMMITMENT, RELATIONSHIP
 * Org scopes: FUND, COMPANY, FUNCTION, TEAM, INDIVIDUAL
 *
 * Embedding: optional. We attempt OpenAI embeddings; if unavailable, fall
 * back to keyword matching. Stored as JSON-serialized number arrays.
 */

import { and, eq, desc, inArray, gte, isNull, or } from "drizzle-orm";
import { getDb } from "./db";
import { agenticMemories, type AgenticMemory, type InsertAgenticMemory } from "../drizzle/schema";
import crypto from "node:crypto";

export type MemoryCategory = "PREFERENCE" | "FACT" | "PATTERN" | "INSIGHT" | "COMMITMENT" | "RELATIONSHIP";
export type OrgScope = "FUND" | "COMPANY" | "FUNCTION" | "TEAM" | "INDIVIDUAL";

const DEDUP_SIMILARITY = 0.92;

// Hybrid retrieval weights
const W = {
  semantic: 0.6,
  confidence: 0.2,
  recency: 0.1,
  category: 0.1,
};

function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function hashSource(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiKey || !text) return null;
  try {
    const resp = await fetch(
      (process.env.BUILT_IN_FORGE_API_URL ?? "https://forge.manus.im").replace(/\/$/, "") +
        "/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text.slice(0, 8000),
        }),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const vec = data.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch {
    return null;
  }
}

export interface StoreMemoryInput {
  tenantId: number;
  subjectPersonId?: number;
  subjectOrgUnitId?: number;
  orgScope: OrgScope;
  category: MemoryCategory;
  memoryKey: string;
  memoryValue: string;
  rationale?: string;
  citations?: Array<{ type: string; id: number; quote?: string }>;
  confidence?: number;
  expiresAt?: Date;
  needsVerification?: boolean;
}

/**
 * Store a memory. Performs near-duplicate detection via embedding cosine
 * similarity ≥ 0.92 — updates the existing memory's value/citations
 * instead of inserting a duplicate.
 */
export async function storeMemory(input: StoreMemoryInput): Promise<{ id: number; deduped: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const sourceHash = hashSource(`${input.category}|${input.memoryKey}|${input.memoryValue}`);

  // Fast path: exact duplicate by sourceHash
  const exact = await db
    .select()
    .from(agenticMemories)
    .where(
      and(eq(agenticMemories.tenantId, input.tenantId), eq(agenticMemories.sourceHash, sourceHash))
    )
    .limit(1);
  if (exact.length > 0) {
    return { id: exact[0].id, deduped: true };
  }

  // Try embedding for near-dup
  const embedding = await generateEmbedding(input.memoryValue);

  if (embedding) {
    // Compare against same category + scope memories
    const candidates = await db
      .select()
      .from(agenticMemories)
      .where(
        and(
          eq(agenticMemories.tenantId, input.tenantId),
          eq(agenticMemories.category, input.category),
          eq(agenticMemories.orgScope, input.orgScope)
        )
      )
      .limit(200);
    for (const c of candidates) {
      const cv = (c.embeddingVector ?? []) as number[];
      if (cv.length && cosine(embedding, cv) >= DEDUP_SIMILARITY) {
        // Merge citations + bump confidence
        const mergedCitations = [...(c.citations ?? []), ...(input.citations ?? [])];
        await db
          .update(agenticMemories)
          .set({
            citations: mergedCitations,
            confidence: String(Math.max(Number(c.confidence ?? "0.7"), input.confidence ?? 0.7)),
            updatedAt: new Date(),
          })
          .where(eq(agenticMemories.id, c.id));
        return { id: c.id, deduped: true };
      }
    }
  }

  const insert = await db.insert(agenticMemories).values({
    tenantId: input.tenantId,
    subjectPersonId: input.subjectPersonId ?? null,
    subjectOrgUnitId: input.subjectOrgUnitId ?? null,
    orgScope: input.orgScope,
    category: input.category,
    memoryKey: input.memoryKey.slice(0, 200),
    memoryValue: input.memoryValue,
    rationale: input.rationale ?? null,
    citations: input.citations ?? null,
    embeddingVector: embedding,
    confidence: String(input.confidence ?? 0.7),
    needsVerification: input.needsVerification ?? true,
    expiresAt: input.expiresAt ?? null,
    sourceHash,
  } satisfies InsertAgenticMemory);
  return { id: (insert as any).insertId ?? 0, deduped: false };
}

export interface RetrieveMemoryOptions {
  tenantId: number;
  query: string;
  subjectPersonId?: number;
  subjectOrgUnitId?: number;
  orgScopes?: OrgScope[];
  categories?: MemoryCategory[];
  limit?: number;
  minConfidence?: number;
}

/**
 * Hybrid retrieval — semantic + recency + confidence + category.
 * Returns ranked memories with hybrid score.
 */
export async function retrieveMemoriesHybrid(
  opts: RetrieveMemoryOptions
): Promise<Array<AgenticMemory & { score: number }>> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(agenticMemories.tenantId, opts.tenantId)];
  if (opts.subjectPersonId != null) {
    conditions.push(eq(agenticMemories.subjectPersonId, opts.subjectPersonId));
  }
  if (opts.subjectOrgUnitId != null) {
    conditions.push(eq(agenticMemories.subjectOrgUnitId, opts.subjectOrgUnitId));
  }
  if (opts.orgScopes && opts.orgScopes.length > 0) {
    conditions.push(inArray(agenticMemories.orgScope, opts.orgScopes));
  }
  if (opts.categories && opts.categories.length > 0) {
    conditions.push(inArray(agenticMemories.category, opts.categories));
  }
  // Drop expired
  conditions.push(or(isNull(agenticMemories.expiresAt), gte(agenticMemories.expiresAt, new Date()))!);

  const candidates = await db
    .select()
    .from(agenticMemories)
    .where(and(...conditions))
    .orderBy(desc(agenticMemories.updatedAt))
    .limit(200);

  if (candidates.length === 0) return [];

  // Try embedding the query
  const queryVec = await generateEmbedding(opts.query);
  const queryLower = opts.query.toLowerCase();
  const now = Date.now();
  const oldestMs = candidates.reduce(
    (acc, c) => Math.min(acc, new Date(c.createdAt).getTime()),
    now
  );
  const ageRangeMs = Math.max(now - oldestMs, 1);

  const minConfidence = opts.minConfidence ?? 0;

  const scored = candidates
    .map(c => {
      const conf = Number(c.confidence ?? "0.7");
      if (conf < minConfidence) return null;

      // Semantic
      let semanticScore = 0;
      if (queryVec && c.embeddingVector) {
        semanticScore = cosine(queryVec, c.embeddingVector as number[]);
      } else {
        // Keyword fallback
        const valLower = c.memoryValue.toLowerCase();
        const keyLower = c.memoryKey.toLowerCase();
        const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);
        const hits = queryTokens.filter(t => valLower.includes(t) || keyLower.includes(t)).length;
        semanticScore = queryTokens.length > 0 ? hits / queryTokens.length : 0;
      }

      // Recency
      const ageMs = now - new Date(c.createdAt).getTime();
      const recencyScore = 1 - ageMs / ageRangeMs;

      // Category match — if category matches any requested
      const categoryScore =
        opts.categories && opts.categories.includes(c.category as MemoryCategory) ? 1 : 0;

      const score =
        W.semantic * semanticScore +
        W.confidence * conf +
        W.recency * recencyScore +
        W.category * categoryScore;

      return { ...c, score };
    })
    .filter((x): x is AgenticMemory & { score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 10);

  return scored;
}

/**
 * Format retrieved memories as markdown for LLM prompt injection.
 */
export function formatMemoriesForPrompt(memories: Array<AgenticMemory & { score?: number }>): string {
  if (memories.length === 0) return "";
  const byCategory = new Map<string, typeof memories>();
  for (const m of memories) {
    const key = m.category;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(m);
  }
  const sections: string[] = [];
  for (const [cat, items] of Array.from(byCategory.entries())) {
    sections.push(`**${cat}:**`);
    for (const m of items) {
      sections.push(`- ${m.memoryKey}: ${m.memoryValue}`);
    }
  }
  return sections.join("\n");
}

/**
 * Verify (mark as user-approved) a memory.
 */
export async function verifyMemory(
  memoryId: number,
  verifierPersonId: number,
  approve: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (approve) {
    await db
      .update(agenticMemories)
      .set({
        verified: true,
        needsVerification: false,
        verifiedAt: new Date(),
        verifiedByPersonId: verifierPersonId,
      })
      .where(eq(agenticMemories.id, memoryId));
  } else {
    // Reject = delete
    await db.delete(agenticMemories).where(eq(agenticMemories.id, memoryId));
  }
}
