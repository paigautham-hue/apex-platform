/**
 * FloatingActionButton — Mic-first persistent FAB.
 *
 * Voice is the primary capture mechanism in APEX. This button is visible on
 * EVERY page (desktop + mobile). One tap opens voice capture in capture page
 * with the correct prompt for the current scope.
 *
 * Long-press / second tap reveals quick-capture text + pulse.
 */

import { useState } from "react";
import { Mic, FileText, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const goVoice = () => {
    setLocation("/capture?voice=true");
    setIsOpen(false);
  };

  const goText = () => {
    setLocation("/capture");
    setIsOpen(false);
  };

  const goPulse = () => {
    setLocation("/pulse");
    setIsOpen(false);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Secondary actions */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-6 z-50 flex flex-col gap-3 items-end">
        {isOpen && (
          <>
            <ActionRow label="Quick text note" onClick={goText} icon={FileText} color="bg-violet-600 hover:bg-violet-700" />
            <ActionRow label="Weekly pulse" onClick={goPulse} icon={Sparkles} color="bg-emerald-600 hover:bg-emerald-700" />
          </>
        )}
      </div>

      {/* Primary mic button — split: tap mic = voice; long-tap or arrow = menu */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex items-center gap-2">
        {!isOpen && (
          <Button
            size="icon"
            variant="outline"
            aria-label="More capture options"
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur shadow-md hidden md:inline-flex"
            onClick={() => setIsOpen(true)}
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="icon"
          aria-label={isOpen ? "Close capture options" : "Voice capture"}
          className={`h-14 w-14 rounded-full shadow-xl transition-all ${
            isOpen ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"
          }`}
          onClick={isOpen ? () => setIsOpen(false) : goVoice}
          onContextMenu={e => {
            e.preventDefault();
            setIsOpen(o => !o);
          }}
        >
          {isOpen ? <X className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
        </Button>
      </div>

      {/* Mobile-only: small text-mode toggle stacked under the mic */}
      {!isOpen && (
        <div className="fixed bottom-36 right-4 z-50 md:hidden">
          <Button
            size="icon"
            variant="outline"
            aria-label="More capture options"
            className="h-9 w-9 rounded-full bg-background/80 backdrop-blur shadow"
            onClick={() => setIsOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </>
  );
}

function ActionRow({
  label,
  onClick,
  icon: Icon,
  color,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2">
      <span className="text-xs md:text-sm font-medium bg-background border border-border px-3 py-1.5 rounded-full shadow-md">
        {label}
      </span>
      <Button size="icon" className={`h-11 w-11 rounded-full shadow-lg ${color}`} onClick={onClick}>
        <Icon className="h-4 w-4 text-white" />
      </Button>
    </div>
  );
}
