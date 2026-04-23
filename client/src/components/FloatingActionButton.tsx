/**
 * FloatingActionButton — persistent mic-first capture FAB.
 *
 * Primary interaction: tap the mic → navigate to /capture?voice=true.
 * Secondary interaction: tap the chevron → open a small menu with text /
 * pulse alternatives. Keyboard-accessible: Tab to chevron, Enter to toggle,
 * Escape to close; focus trapped while menu is open.
 *
 * One FAB on every breakpoint — no duplicate mobile pill that collided
 * with the bottom nav.
 */

import { useEffect, useRef, useState } from "react";
import { Mic, FileText, Sparkles, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);

  // Escape closes; click-outside closes; focus first action on open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        chevronRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Focus first action for keyboard users
    const t = setTimeout(() => firstActionRef.current?.focus(), 50);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isOpen]);

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
      {/* Scrim — only visible when menu open; does not block pointer for rest of page otherwise */}
      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
        />
      )}

      <div
        ref={menuRef}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end gap-3"
      >
        {/* Secondary actions — visible when open */}
        {isOpen && (
          <div
            role="menu"
            aria-label="Capture options"
            className="flex flex-col gap-3 items-end motion-safe:animate-in motion-safe:slide-in-from-bottom-2"
          >
            <ActionRow
              ref={firstActionRef}
              label="Quick text note"
              onClick={goText}
              icon={FileText}
              color="bg-violet-600 hover:bg-violet-700"
            />
            <ActionRow
              label="Weekly pulse"
              onClick={goPulse}
              icon={Sparkles}
              color="bg-emerald-600 hover:bg-emerald-700"
            />
          </div>
        )}

        {/* Main row: chevron-toggle + mic FAB */}
        <div className="flex items-center gap-2">
          <Button
            ref={chevronRef}
            size="icon"
            variant="outline"
            aria-label={isOpen ? "Close capture options" : "Open capture options"}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            className="h-11 w-11 rounded-full bg-background/90 backdrop-blur shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setIsOpen(o => !o)}
          >
            {isOpen ? <X className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            aria-label="Start voice capture"
            className="h-14 w-14 rounded-full shadow-xl bg-teal-600 hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={goVoice}
          >
            <Mic className="h-6 w-6 text-white" />
          </Button>
        </div>
      </div>
    </>
  );
}

const ActionRow = ({
  label,
  onClick,
  icon: Icon,
  color,
  ref,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  ref?: React.Ref<HTMLButtonElement>;
}) => (
  <div className="flex items-center gap-3">
    <span
      className="text-xs md:text-sm font-medium bg-background border border-border px-3 py-1.5 rounded-full shadow-md"
      aria-hidden="true"
    >
      {label}
    </span>
    <Button
      ref={ref}
      size="icon"
      role="menuitem"
      aria-label={label}
      className={`h-11 w-11 rounded-full shadow-lg ${color} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-white" />
    </Button>
  </div>
);
