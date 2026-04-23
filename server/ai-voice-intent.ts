/**
 * ai-voice-intent.ts — classify a voice transcript into APEX actions.
 *
 * Inspired by Meridian's voiceRouter.parseVoiceIntent. Maps natural speech
 * like "I shipped the new pricing model this week, want to log that against
 * Revenue Growth and rate myself an 8" into structured actions:
 *   { intent: "JOURNAL_ENTRY", dimensionKey: "Revenue Growth", logText: "...", suggestedScore: 8 }
 *
 * Categories:
 *   - JOURNAL_ENTRY  — append to a mandate's logText
 *   - PLAN_ITEM      — add to next-month's plan
 *   - SELF_RATING    — set/update self-rating for a mandate
 *   - REFLECTION     — private reflection (visibility-default)
 *   - OBSERVATION    — observation about another person
 *   - DECISION       — log a decision with assumptions
 *   - MEETING_NOTE   — link to an upcoming or past meeting
 *   - QUICK_NOTE     — fallback "just a thought" capture
 */

import { invokeLLM } from "./_core/llm";

export type VoiceIntent =
  | "JOURNAL_ENTRY"
  | "PLAN_ITEM"
  | "SELF_RATING"
  | "REFLECTION"
  | "OBSERVATION"
  | "DECISION"
  | "MEETING_NOTE"
  | "QUICK_NOTE";

export interface IntentClassification {
  intent: VoiceIntent;
  confidence: number; // 0-1
  // Optional structured fields the AI extracted
  dimensionKey?: string;        // Mandate/dimension name if mentioned
  suggestedScore?: number;      // 1-10 if user voiced a self-rating
  subjectPersonName?: string;   // For OBSERVATION
  text: string;                 // Cleaned-up text
  rationale?: string;           // Why the AI classified this way
}

interface ClassifyOptions {
  transcript: string;
  // Available mandates / dimensions for the speaker, used to ground the AI
  availableDimensions?: string[];
  // Available subordinate names, used to ground OBSERVATION extraction
  availableSubjects?: string[];
}

const SYSTEM_PROMPT = `You are an intent classifier for APEX, a fund governance app.
You receive a voice transcript and classify it into exactly ONE intent type.
Return strict JSON.

Intent types:
- JOURNAL_ENTRY: speaker is recapping what they DID (past tense, on a mandate they own)
- PLAN_ITEM: speaker is committing to do something NEXT (future tense, intention)
- SELF_RATING: speaker is rating themselves on a dimension ("I'd give myself a 7 on...")
- REFLECTION: personal/private musing, often emotional or about self-development
- OBSERVATION: speaker is commenting on someone ELSE'S behavior or work
- DECISION: speaker is recording a decision they made (often with rationale/risks)
- MEETING_NOTE: speaker references a meeting that happened or is upcoming
- QUICK_NOTE: anything else — capture as a free-form note

Return JSON shape:
{
  "intent": "<INTENT>",
  "confidence": <0-1>,
  "dimensionKey": "<exact match to availableDimensions, or null>",
  "suggestedScore": <1-10 or null>,
  "subjectPersonName": "<exact match to availableSubjects for OBSERVATION, or null>",
  "text": "<the transcript, cleaned up — fix grammar lightly, remove ums>",
  "rationale": "<one sentence why this intent>"
}

Be decisive. Pick the SINGLE best intent. Default to JOURNAL_ENTRY if unsure and a dimension was mentioned, otherwise QUICK_NOTE.`;

export async function classifyVoiceIntent(opts: ClassifyOptions): Promise<IntentClassification> {
  const { transcript, availableDimensions = [], availableSubjects = [] } = opts;

  // Trivial fallback when transcript is too short
  if (!transcript || transcript.trim().length < 3) {
    return {
      intent: "QUICK_NOTE",
      confidence: 0.2,
      text: transcript.trim(),
      rationale: "Transcript too short to classify.",
    };
  }

  try {
    const userMessage = [
      `Transcript: "${transcript.trim()}"`,
      availableDimensions.length > 0
        ? `availableDimensions: ${JSON.stringify(availableDimensions)}`
        : "",
      availableSubjects.length > 0
        ? `availableSubjects: ${JSON.stringify(availableSubjects)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      responseFormat: { type: "json_object" },
    });

    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Empty LLM response");
    }
    const parsed = JSON.parse(content);
    return {
      intent: (parsed.intent as VoiceIntent) ?? "QUICK_NOTE",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      dimensionKey: parsed.dimensionKey || undefined,
      suggestedScore: typeof parsed.suggestedScore === "number" ? parsed.suggestedScore : undefined,
      subjectPersonName: parsed.subjectPersonName || undefined,
      text: parsed.text || transcript.trim(),
      rationale: parsed.rationale,
    };
  } catch (err) {
    // Fail-soft fallback — keyword heuristics
    const t = transcript.toLowerCase();
    let intent: VoiceIntent = "QUICK_NOTE";
    if (/\b(plan|will|going to|next month|commit)\b/.test(t)) intent = "PLAN_ITEM";
    else if (/\b(decided|decision|chose|going with)\b/.test(t)) intent = "DECISION";
    else if (/\b(rate|score|give myself|i'd say)\b.*\b(\d{1,2})\b/.test(t)) intent = "SELF_RATING";
    else if (/\b(reflecting|wondering|feel|emotional)\b/.test(t)) intent = "REFLECTION";
    else if (/\b(meeting|talked to|spoke with|catch up)\b/.test(t)) intent = "MEETING_NOTE";
    else if (availableDimensions.some(d => t.includes(d.toLowerCase()))) intent = "JOURNAL_ENTRY";

    return {
      intent,
      confidence: 0.4,
      text: transcript.trim(),
      rationale: "AI service unavailable — heuristic classification.",
    };
  }
}
