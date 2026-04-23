/**
 * /capture — Voice-first universal capture surface.
 *
 * One screen for any intent: journal entry, plan item, reflection,
 * observation, decision, quick note. The AI classifies what the user
 * said and routes it to the right place.
 *
 * Flow:
 *   1. Big mic button → records (or accept text via fallback)
 *   2. Live transcript appears as you speak
 *   3. On stop, AI classifies → user confirms or edits intent
 *   4. Submit → routed to mandateJournal / observation / reflection / etc.
 *
 * Query params:
 *   ?voice=true    — auto-start the recorder
 *   ?prompt=...    — show a context prompt above the mic
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Mic, Square, Send, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useViewer } from "@/hooks/useViewer";

type RecState = "idle" | "listening" | "stopping" | "unsupported";
type IntentType = "JOURNAL_ENTRY" | "PLAN_ITEM" | "SELF_RATING" | "REFLECTION" | "OBSERVATION" | "DECISION" | "MEETING_NOTE" | "QUICK_NOTE";

const INTENT_LABELS: Record<IntentType, { label: string; description: string }> = {
  JOURNAL_ENTRY: { label: "Captain's Log entry", description: "Append to a mandate's monthly log" },
  PLAN_ITEM: { label: "Next-month plan", description: "Add to your forward commitments" },
  SELF_RATING: { label: "Self-rating", description: "Score yourself on a mandate" },
  REFLECTION: { label: "Private reflection", description: "Personal note, visible only to you" },
  OBSERVATION: { label: "Observation about someone", description: "Feedback or note about a colleague" },
  DECISION: { label: "Decision logged", description: "Record a decision with context" },
  MEETING_NOTE: { label: "Meeting note", description: "Tied to a meeting" },
  QUICK_NOTE: { label: "Quick note", description: "Free-form capture" },
};

export default function Capture() {
  const [, navigate] = useLocation();
  const { viewer } = useViewer();

  const initialPrompt = new URLSearchParams(window.location.search).get("prompt") ?? "";
  const autoVoice = new URLSearchParams(window.location.search).get("voice") === "true";

  const [recState, setRecState] = useState<RecState>("idle");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [intentChoice, setIntentChoice] = useState<IntentType | null>(null);
  const [aiClassification, setAiClassification] = useState<{
    intent: IntentType;
    confidence: number;
    dimensionKey?: string;
    suggestedScore?: number;
    subjectPersonName?: string;
    rationale?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalAccumRef = useRef("");

  const classifyMutation = trpc.voice.classifyIntent.useMutation();
  const dispatchMutation = trpc.voice.dispatchIntent.useMutation();

  // Set up Web Speech recognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      setRecState("unsupported");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.onstart = () => setRecState("listening");
    rec.onresult = (event: any) => {
      let interimText = "";
      let finalText = finalAccumRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += (finalText.length ? " " : "") + transcript.trim();
        } else {
          interimText += transcript;
        }
      }
      finalAccumRef.current = finalText;
      setInterim(interimText);
      setText((finalText + (interimText ? " " + interimText : "")).trim());
    };
    rec.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error(`Voice error: ${event.error}`);
      }
      setRecState("idle");
    };
    rec.onend = () => {
      setRecState("idle");
      setInterim("");
      // Auto-classify when recording ends
      const finalText = finalAccumRef.current.trim();
      if (finalText.length > 5) {
        runClassify(finalText);
      }
    };
    recognitionRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  // Auto-start if ?voice=true
  useEffect(() => {
    if (autoVoice && recState === "idle" && recognitionRef.current) {
      const t = setTimeout(() => startRecording(), 300);
      return () => clearTimeout(t);
    }
  }, [autoVoice, recState]);

  const startRecording = () => {
    if (recState !== "idle" || !recognitionRef.current) return;
    finalAccumRef.current = "";
    setText("");
    setInterim("");
    setIntentChoice(null);
    setAiClassification(null);
    try {
      recognitionRef.current.start();
    } catch {}
  };

  const stopRecording = () => {
    if (recState !== "listening") return;
    setRecState("stopping");
    try {
      recognitionRef.current.stop();
    } catch {}
  };

  const runClassify = async (transcript: string) => {
    try {
      const result = await classifyMutation.mutateAsync({ transcript });
      setAiClassification(result);
      setIntentChoice(result.intent);
      // Replace text with cleaned version
      if (result.text && result.text !== transcript) {
        setText(result.text);
      }
    } catch (err) {
      // Fallback: treat as quick note
      setIntentChoice("QUICK_NOTE");
    }
  };

  const submit = async () => {
    if (!intentChoice || !text.trim()) {
      toast.error("Need text and an intent");
      return;
    }
    setSubmitting(true);
    try {
      const result = await dispatchMutation.mutateAsync({
        intent: intentChoice,
        text: text.trim(),
        dimensionKey: aiClassification?.dimensionKey,
        suggestedScore: aiClassification?.suggestedScore,
        subjectPersonName: aiClassification?.subjectPersonName,
      });
      toast.success(`Saved as ${INTENT_LABELS[intentChoice].label}`);
      // Reset state
      setText("");
      setInterim("");
      finalAccumRef.current = "";
      setAiClassification(null);
      setIntentChoice(null);
      // Navigate based on intent
      if (intentChoice === "JOURNAL_ENTRY" || intentChoice === "PLAN_ITEM" || intentChoice === "SELF_RATING") {
        navigate("/me");
      } else if (intentChoice === "OBSERVATION") {
        navigate("/team");
      } else if (intentChoice === "REFLECTION") {
        navigate("/reflections");
      } else if (intentChoice === "DECISION") {
        navigate("/decisions");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = recState === "listening" ? Square : Mic;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/me")} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h1 className="text-xl font-semibold">Capture</h1>
      </div>

      {initialPrompt && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-violet-500/5 border border-violet-500/20 text-sm">
          <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
          <span>{initialPrompt}</span>
        </div>
      )}

      {/* Big mic button */}
      <Card className={recState === "listening" ? "border-red-500/40 bg-red-500/5" : ""}>
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <Button
            size="icon"
            className={`h-24 w-24 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              recState === "listening"
                ? "bg-red-600 hover:bg-red-700 motion-safe:animate-pulse ring-2 ring-red-400"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
            onClick={recState === "listening" ? stopRecording : startRecording}
            disabled={recState === "stopping" || recState === "unsupported"}
            aria-label={
              recState === "unsupported"
                ? "Voice recording not supported in this browser — type below instead"
                : recState === "listening"
                  ? "Stop recording"
                  : "Start recording"
            }
          >
            {recState === "stopping" ? (
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            ) : (
              <Icon className="h-10 w-10 text-white" fill={recState === "listening" ? "currentColor" : "none"} />
            )}
          </Button>
          <div className="text-center">
            <div className="text-sm font-medium">
              {recState === "listening" ? "Listening — tap to stop" :
               recState === "stopping" ? "Processing..." :
               recState === "unsupported" ? "Voice not supported in this browser" :
               "Tap to talk"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {recState === "listening"
                ? "Speak naturally — I'll figure out where it goes."
                : recState === "unsupported"
                  ? "You can still type your entry below — same destination."
                  : "Or type below"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live + final transcript */}
      <div className="space-y-2">
        <Label htmlFor="capture-transcript" className="flex items-center justify-between">
          <span>Transcript</span>
          {classifyMutation.isPending && (
            <span
              role="status"
              aria-live="polite"
              className="text-xs text-muted-foreground flex items-center gap-1.5"
            >
              <Loader2 className="w-3 h-3 motion-safe:animate-spin" aria-hidden="true" /> Understanding…
            </span>
          )}
        </Label>
        <Textarea
          id="capture-transcript"
          rows={5}
          value={text}
          onChange={e => {
            setText(e.target.value);
            if (aiClassification && Math.abs(e.target.value.length - text.length) > 30) {
              setAiClassification(null);
              setIntentChoice(null);
            }
          }}
          placeholder="What's on your mind?"
          aria-describedby="capture-interim"
        />
        <p
          id="capture-interim"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-muted-foreground italic min-h-[1em]"
        >
          {interim}
        </p>
      </div>

      {/* AI classification + confirmation */}
      {aiClassification && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium">AI suggests:</span>
              <Badge variant="outline">{INTENT_LABELS[aiClassification.intent].label}</Badge>
              <Badge variant="secondary" className="text-[10px]">
                {Math.round(aiClassification.confidence * 100)}% confident
              </Badge>
            </div>
            {aiClassification.rationale && (
              <p className="text-xs text-muted-foreground italic">{aiClassification.rationale}</p>
            )}
            {(aiClassification.dimensionKey || aiClassification.suggestedScore || aiClassification.subjectPersonName) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {aiClassification.dimensionKey && (
                  <Badge variant="outline">Mandate: {aiClassification.dimensionKey}</Badge>
                )}
                {aiClassification.suggestedScore != null && (
                  <Badge variant="outline">Score: {aiClassification.suggestedScore}/10</Badge>
                )}
                {aiClassification.subjectPersonName && (
                  <Badge variant="outline">About: {aiClassification.subjectPersonName}</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual intent picker (always visible if there's text) */}
      {text.trim().length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="capture-intent">Save as...</Label>
          <Select value={intentChoice ?? undefined} onValueChange={v => setIntentChoice(v as IntentType)}>
            <SelectTrigger id="capture-intent">
              <SelectValue placeholder="Choose where this lands" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INTENT_LABELS).map(([key, val]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex flex-col items-start">
                    <span>{val.label}</span>
                    <span className="text-[10px] text-muted-foreground">{val.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        onClick={submit}
        disabled={!intentChoice || !text.trim() || submitting}
        className="w-full gap-2"
        size="lg"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Save
      </Button>
    </div>
  );
}
