/**
 * ai-deliberation.ts — Multi-persona AI panel review (Assay pattern, fractal).
 *
 * Any leader (Chairman, CEO, CXO) can trigger an AI panel on any subordinate
 * (CXO, leader, IC). 5 specialized personas + a synthesis pass.
 *
 * Personas (default tenant defaults — can be overridden per-tenant via
 * aiPersonaConfigs table later):
 *   - ADVOCATE   — case for sustained investment / promotion
 *   - SKEPTIC    — case against; what could break
 *   - RISK       — fiduciary, governance, compliance, ESG concerns
 *   - CFO        — capital efficiency, financial discipline
 *   - CULTURE    — values alignment, team impact, succession
 *
 * Run mode: parallel persona LLM calls + a synthesis call. Results saved
 * into aiDeliberations.personaVerdicts and aiDeliberations.synthesis.
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  aiDeliberations,
  aiPersonaConfigs,
  governanceAssessments,
  mandateJournals,
  observations,
  persons,
  roles,
} from "../drizzle/schema";

export type DeliberationTargetType = "ROLE" | "COMPANY" | "PERSON";

export interface DeliberationInput {
  tenantId: number;
  triggeredByPersonId: number;
  targetType: DeliberationTargetType;
  targetId: number;
  cycleId?: number;
}

interface PersonaVerdict {
  personaKey: string;
  personaLabel: string;
  verdict: string;
  confidence: number;
  cited: Array<{ type: string; id: number; quote?: string }>;
  modelId: string;
}

const DEFAULT_PERSONAS: Array<{
  key: string;
  label: string;
  systemPrompt: string;
}> = [
  {
    key: "ADVOCATE",
    label: "Advocate",
    systemPrompt:
      "You are the ADVOCATE on a fund governance review panel. Make the strongest possible case for continued investment of trust, capital, and authority in this person/company. Cite specific journal entries, observations, and metrics. Be direct, not effusive. 4-6 sentences.",
  },
  {
    key: "SKEPTIC",
    label: "Skeptic",
    systemPrompt:
      "You are the SKEPTIC on a fund governance review panel. Argue against the prevailing narrative. Identify story drift, hidden risks, accountability gaps. Probe for what's NOT being said. 4-6 sentences. Cite evidence.",
  },
  {
    key: "RISK",
    label: "Risk Officer",
    systemPrompt:
      "You are the RISK OFFICER on a fund governance review panel. Surface fiduciary, governance, compliance, ESG, and reputational risks. Be specific about likelihood and magnitude. 4-6 sentences.",
  },
  {
    key: "CFO",
    label: "CFO View",
    systemPrompt:
      "You are the CFO on a fund governance review panel. Evaluate capital efficiency, financial discipline, ROI, and unit economics. Reference financial actuals where available. 4-6 sentences.",
  },
  {
    key: "CULTURE",
    label: "Culture & People",
    systemPrompt:
      "You are the CULTURE & PEOPLE assessor on a fund governance review panel. Evaluate values alignment, team impact, succession risk, and people leadership. 4-6 sentences.",
  },
];

const SYNTHESIS_PROMPT = `You are the CHAIRMAN synthesizing a 5-persona AI panel review for a fund governance decision.
You receive verdicts from Advocate, Skeptic, Risk Officer, CFO, and Culture.
Produce:
1. One-paragraph synthesis (4-6 sentences) — what's the integrated picture?
2. Three concrete recommended actions for the trigger person to take in the next month.
3. A consensus/dissent flag — note where personas disagreed.

Return strict JSON:
{
  "synthesis": "...",
  "recommendedActions": ["...", "...", "..."],
  "consensusNote": "..."
}`;

async function loadPersonas(tenantId: number) {
  const db = await getDb();
  if (!db) return DEFAULT_PERSONAS;
  const rows = await db
    .select()
    .from(aiPersonaConfigs)
    .where(and(eq(aiPersonaConfigs.tenantId, tenantId), eq(aiPersonaConfigs.isActive, true)));
  if (rows.length === 0) return DEFAULT_PERSONAS;
  return rows.map(r => ({ key: r.key, label: r.label, systemPrompt: r.systemPrompt }));
}

async function gatherEvidence(input: DeliberationInput): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const lines: string[] = [];

  // Load target name + role context
  if (input.targetType === "ROLE") {
    const roleRows = await db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, input.tenantId), eq(roles.id, input.targetId)))
      .limit(1);
    const role = roleRows[0];
    if (role) {
      const personRows = await db
        .select()
        .from(persons)
        .where(and(eq(persons.tenantId, input.tenantId), eq(persons.id, role.personId)))
        .limit(1);
      const person = personRows[0];
      lines.push(`Subject: ${person?.name ?? "?"} — ${role.title} (${role.roleType})`);
      if (role.scopeDescription) lines.push(`Scope: ${role.scopeDescription}`);
      if (role.successMetrics?.length) lines.push(`Mandates: ${(role.successMetrics as string[]).join(" | ")}`);
    }
  }

  // Recent journal entries
  const subjectPersonIds: number[] = [];
  if (input.targetType === "ROLE") {
    const r = await db.select().from(roles).where(eq(roles.id, input.targetId)).limit(1);
    if (r[0]?.personId) subjectPersonIds.push(r[0].personId);
  } else if (input.targetType === "PERSON") {
    subjectPersonIds.push(input.targetId);
  }
  if (subjectPersonIds.length > 0) {
    const journals = await db
      .select()
      .from(mandateJournals)
      .where(
        and(
          eq(mandateJournals.tenantId, input.tenantId),
          inArray(mandateJournals.personId, subjectPersonIds)
        )
      )
      .orderBy(desc(mandateJournals.updatedAt))
      .limit(10);
    if (journals.length > 0) {
      lines.push("\n--- Recent journal entries ---");
      for (const j of journals) {
        if (j.logText) lines.push(`[${j.dimensionKey}] LOG: ${j.logText.slice(0, 500)}`);
        if (j.planText) lines.push(`[${j.dimensionKey}] PLAN: ${j.planText.slice(0, 200)}`);
      }
    }

    // Observations about the subject
    const obs = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.tenantId, input.tenantId),
          inArray(observations.subjectPersonId, subjectPersonIds)
        )
      )
      .orderBy(desc(observations.createdAt))
      .limit(20);
    if (obs.length > 0) {
      lines.push("\n--- Recent observations ---");
      for (const o of obs) {
        lines.push(`(${o.direction}) ${o.text.slice(0, 300)}`);
      }
    }

    // Assessments from this cycle
    if (input.cycleId) {
      const assessments = await db
        .select()
        .from(governanceAssessments)
        .where(
          and(
            eq(governanceAssessments.tenantId, input.tenantId),
            eq(governanceAssessments.cycleId, input.cycleId),
            eq(governanceAssessments.targetType, "ROLE"),
            eq(governanceAssessments.targetId, input.targetType === "ROLE" ? input.targetId : 0)
          )
        );
      if (assessments.length > 0) {
        lines.push("\n--- Cycle assessments ---");
        for (const a of assessments) {
          lines.push(
            `assessorPersonId=${a.assessorPersonId} dim=${a.dimensionKey} score=${a.score} rag=${a.rag} note=${(a.note ?? "").slice(0, 200)}`
          );
        }
      }
    }
  }

  return lines.join("\n");
}

async function runPersona(
  persona: { key: string; label: string; systemPrompt: string },
  evidence: string
): Promise<PersonaVerdict> {
  const userMessage = `Evidence dossier for the panel:\n\n${evidence}\n\nWrite your verdict now.`;
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: persona.systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    const text = result.choices?.[0]?.message?.content;
    return {
      personaKey: persona.key,
      personaLabel: persona.label,
      verdict: typeof text === "string" ? text : JSON.stringify(text),
      confidence: 0.7,
      cited: [],
      modelId: result.model ?? "claude-opus-4-7",
    };
  } catch (err) {
    return {
      personaKey: persona.key,
      personaLabel: persona.label,
      verdict: `[Persona ${persona.key} failed to respond — ${err instanceof Error ? err.message : "unknown"}]`,
      confidence: 0,
      cited: [],
      modelId: "error",
    };
  }
}

export async function runDeliberation(
  input: DeliberationInput
): Promise<{ deliberationId: number; personaVerdicts: PersonaVerdict[]; synthesis: string; recommendedActions: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Insert running record
  const insert = await db.insert(aiDeliberations).values({
    tenantId: input.tenantId,
    cycleId: input.cycleId ?? null,
    targetType: input.targetType,
    targetId: input.targetId,
    triggeredByPersonId: input.triggeredByPersonId,
    status: "RUNNING",
  });
  const deliberationId = (insert as any).insertId ?? 0;

  try {
    const personas = await loadPersonas(input.tenantId);
    const evidence = await gatherEvidence(input);

    // Parallel persona calls
    const personaVerdicts = await Promise.all(
      personas.map(p => runPersona(p, evidence))
    );

    // Synthesis
    const verdictsBlock = personaVerdicts
      .map(v => `${v.personaLabel}:\n${v.verdict}`)
      .join("\n\n");
    let synthesis = "";
    let recommendedActions: string[] = [];
    let consensusNote = "";
    try {
      const synthResult = await invokeLLM({
        messages: [
          { role: "system", content: SYNTHESIS_PROMPT },
          { role: "user", content: `Subject evidence:\n${evidence}\n\n--- Persona verdicts ---\n${verdictsBlock}` },
        ],
        responseFormat: { type: "json_object" },
      });
      const text = synthResult.choices?.[0]?.message?.content;
      if (typeof text === "string") {
        const parsed = JSON.parse(text);
        synthesis = parsed.synthesis ?? "";
        recommendedActions = Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [];
        consensusNote = parsed.consensusNote ?? "";
      }
    } catch (err) {
      synthesis = `Synthesis failed: ${err instanceof Error ? err.message : "unknown"}`;
    }

    await db
      .update(aiDeliberations)
      .set({
        personaVerdicts: personaVerdicts.map(v => ({
          personaKey: v.personaKey,
          verdict: v.verdict,
          confidence: v.confidence,
          cited: v.cited,
        })),
        synthesis: synthesis + (consensusNote ? `\n\nConsensus note: ${consensusNote}` : ""),
        recommendedActions,
        status: "COMPLETE",
        completedAt: new Date(),
      })
      .where(eq(aiDeliberations.id, deliberationId));

    return { deliberationId, personaVerdicts, synthesis, recommendedActions };
  } catch (err) {
    await db
      .update(aiDeliberations)
      .set({ status: "FAILED", completedAt: new Date() })
      .where(eq(aiDeliberations.id, deliberationId));
    throw err;
  }
}
