/**
 * JournalEditor — autosaving textarea + voice + offline-draft + smart prompts.
 *
 * The frictionless capture surface for Captain's Log entries. Voice-first,
 * but text always works. Saves to server every 1.5s after typing stops.
 * Offline drafts persist to localStorage keyed by draftKey.
 *
 * Used inside MyBridge / MyIsland / Reflections / Capture.
 */

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VoiceJournalCapture from "./VoiceJournalCapture";
import { Check, Cloud, CloudOff, Loader2, Sparkles } from "lucide-react";

const DRAFT_PREFIX = "apex.journal.draft.";

interface Props {
  /** Stable key used for localStorage draft persistence. e.g. cycleId-dim */
  draftKey: string;
  /** Initial value loaded from server. */
  initialValue: string;
  /** Called when the user actually saves (debounced). */
  onSave: (text: string) => Promise<void> | void;
  /** Optional context-aware prompt to nudge the user. */
  prompt?: string;
  /** Suggested length range for guidance. */
  suggestedLength?: { min: number; max: number };
  /** Locale for voice. */
  locale?: string;
  /** Read-only mode (e.g., after cycle close). */
  readOnly?: boolean;
  /** Number of rows. */
  rows?: number;
  /** Optional placeholder. */
  placeholder?: string;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "offline";

const AUTOSAVE_DEBOUNCE_MS = 1500;

export default function JournalEditor({
  draftKey,
  initialValue,
  onSave,
  prompt,
  suggestedLength,
  locale = "en-IN",
  readOnly = false,
  rows = 5,
  placeholder,
}: Props) {
  const [value, setValue] = useState(() => {
    // On mount, restore offline draft if newer than server initial
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(DRAFT_PREFIX + draftKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { text: string; ts: number; serverHash: string };
          // Restore if cached differs from server (i.e., user made changes offline)
          if (parsed.text && parsed.text !== initialValue) {
            return parsed.text;
          }
        }
      } catch {}
    }
    return initialValue;
  });
  const [state, setState] = useState<SaveState>("idle");
  const [online, setOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const debounceRef = useRef<number | null>(null);
  const lastSavedRef = useRef(initialValue);

  // Track online/offline (SSR-safe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => {
      setOnline(true);
      // Try to flush draft on reconnect
      if (value !== lastSavedRef.current) {
        triggerSave(value);
      }
    };
    const goOffline = () => {
      setOnline(false);
      setState("offline");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [value]);

  // When initialValue changes (cycle changed, server returned new data), reset
  useEffect(() => {
    setValue(initialValue);
    lastSavedRef.current = initialValue;
  }, [initialValue]);

  const persistDraft = (text: string) => {
    try {
      localStorage.setItem(
        DRAFT_PREFIX + draftKey,
        JSON.stringify({ text, ts: Date.now(), serverHash: lastSavedRef.current })
      );
    } catch {}
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_PREFIX + draftKey);
    } catch {}
  };

  const triggerSave = async (text: string) => {
    if (text === lastSavedRef.current) {
      setState("saved");
      return;
    }
    if (!online) {
      setState("offline");
      persistDraft(text);
      return;
    }
    setState("saving");
    try {
      await onSave(text);
      lastSavedRef.current = text;
      setState("saved");
      clearDraft();
      // Fade "saved" indicator after 2s
      setTimeout(() => {
        setState(prev => (prev === "saved" ? "idle" : prev));
      }, 2000);
    } catch (err) {
      setState("error");
      persistDraft(text);
    }
  };

  const handleChange = (next: string) => {
    setValue(next);
    setState("dirty");
    persistDraft(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      triggerSave(next);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  const lengthBadge = (() => {
    if (!suggestedLength) return null;
    const ok = wordCount >= suggestedLength.min && wordCount <= suggestedLength.max;
    return (
      <Badge variant={ok ? "outline" : "secondary"} className="text-[10px]">
        {wordCount} word{wordCount === 1 ? "" : "s"}
      </Badge>
    );
  })();

  const SaveIndicator = () => {
    switch (state) {
      case "saving":
        return (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-300 motion-safe:animate-in motion-safe:fade-in"
          >
            <Loader2 className="w-3 h-3 motion-safe:animate-spin" aria-hidden="true" /> Saving…
          </div>
        );
      case "saved":
        return (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <Check className="w-3 h-3" aria-hidden="true" /> Saved
          </div>
        );
      case "dirty":
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Cloud className="w-3 h-3" aria-hidden="true" /> Editing…
          </div>
        );
      case "offline":
        return (
          <div
            role="status"
            aria-live="assertive"
            className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
          >
            <CloudOff className="w-3 h-3" aria-hidden="true" /> Offline — saved locally
          </div>
        );
      case "error":
        return (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300"
          >
            <CloudOff className="w-3 h-3" aria-hidden="true" /> Save failed — kept locally
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      {prompt && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-violet-500/5 border border-violet-500/20 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
          <span className="text-foreground/80">{prompt}</span>
        </div>
      )}
      <Textarea
        rows={rows}
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder ?? "Start writing... or hold the mic to talk."}
        readOnly={readOnly}
        className="resize-y"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!readOnly && (
            <VoiceJournalCapture
              currentText={value}
              onTextChange={handleChange}
              locale={locale}
              promptHint="Talk it"
            />
          )}
          {lengthBadge}
        </div>
        <SaveIndicator />
      </div>
    </div>
  );
}
