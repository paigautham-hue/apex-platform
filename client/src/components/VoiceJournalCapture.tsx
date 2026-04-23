/**
 * VoiceJournalCapture — hold-to-record voice capture with live transcript.
 *
 * Voice-first replacement for textareas in Captain's Log mandate cards.
 * Uses the Web Speech API (already installed via VoiceInput pattern).
 *
 * Flow:
 *   1. User holds the mic button (or taps to start, taps again to stop).
 *   2. Live interim transcript appears in real time.
 *   3. On stop, final transcript is appended to the existing journal text.
 *   4. Optional: classify intent (journal entry / plan item / rating) and
 *      route to the right handler.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** Current text in the field — voice transcript is appended to this. */
  currentText: string;
  /** Called whenever transcript changes (interim + final). */
  onTextChange: (text: string) => void;
  /** Optional: called when recording stops with the final segment only. */
  onSegmentComplete?: (segment: string) => void;
  /** Visual hint shown when not recording. */
  promptHint?: string;
  /** Locale for speech recognition. */
  locale?: string;
  /** Compact mode: small icon-only button. */
  compact?: boolean;
}

type RecognitionState = "idle" | "starting" | "listening" | "stopping" | "unsupported";

export default function VoiceJournalCapture({
  currentText,
  onTextChange,
  onSegmentComplete,
  promptHint = "Hold to talk",
  locale = "en-IN",
  compact = false,
}: Props) {
  const [state, setState] = useState<RecognitionState>("idle");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef("");
  const finalAccumRef = useRef("");
  const pendingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      setState("unsupported");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = locale;

    rec.onstart = () => {
      pendingRef.current = false;
      setState("listening");
    };

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

      const combined = baseTextRef.current.trim();
      const accum = (combined ? combined + " " : "") + finalText + (interimText ? " " + interimText : "");
      onTextChange(accum);
    };

    rec.onerror = (event: any) => {
      const code = event.error;
      if (code === "no-speech") {
        // Silent fail — user just paused
      } else if (code === "not-allowed" || code === "service-not-allowed") {
        toast.error("Microphone access denied. Please allow in your browser settings.");
      } else if (code === "network") {
        toast.error("Speech recognition needs an internet connection.");
      } else if (code !== "aborted") {
        toast.error(`Voice error: ${code}`);
      }
      pendingRef.current = false;
      setState("idle");
    };

    rec.onend = () => {
      pendingRef.current = false;
      setState("idle");
      if (finalAccumRef.current && onSegmentComplete) {
        onSegmentComplete(finalAccumRef.current.trim());
      }
      setInterim("");
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, [locale, onSegmentComplete, onTextChange]);

  const start = () => {
    if (!recognitionRef.current || state !== "idle" || pendingRef.current) return;
    pendingRef.current = true;
    baseTextRef.current = currentText;
    finalAccumRef.current = "";
    setInterim("");
    setState("starting");
    try {
      recognitionRef.current.start();
    } catch (err) {
      pendingRef.current = false;
      setState("idle");
    }
  };

  const stop = () => {
    if (!recognitionRef.current || state !== "listening" || pendingRef.current) return;
    pendingRef.current = true;
    setState("stopping");
    try {
      recognitionRef.current.stop();
    } catch {
      pendingRef.current = false;
      setState("idle");
    }
  };

  const toggle = () => {
    if (pendingRef.current) return;
    if (state === "listening") stop();
    else start();
  };

  if (state === "unsupported") {
    return (
      <Button variant="ghost" size={compact ? "icon" : "sm"} disabled className="text-muted-foreground">
        <Mic className="w-4 h-4" />
        {!compact && <span className="ml-1.5 text-xs">Voice unavailable</span>}
      </Button>
    );
  }

  const listening = state === "listening";
  const busy = state === "starting" || state === "stopping";

  return (
    <div className={compact ? "" : "flex items-center gap-2"}>
      <Button
        type="button"
        size={compact ? "icon" : "sm"}
        variant={listening ? "destructive" : "outline"}
        onClick={toggle}
        disabled={busy}
        aria-label={listening ? "Stop voice capture" : "Start voice capture"}
        className={listening ? "animate-pulse" : ""}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : listening ? (
          <Square className="w-4 h-4" fill="currentColor" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
        {!compact && (
          <span className="ml-1.5 text-xs">{listening ? "Stop" : promptHint}</span>
        )}
      </Button>
      {!compact && interim && (
        <span className="text-xs text-muted-foreground italic truncate max-w-xs">
          {interim}
        </span>
      )}
    </div>
  );
}
