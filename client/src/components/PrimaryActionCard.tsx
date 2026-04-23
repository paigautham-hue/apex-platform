/**
 * PrimaryActionCard — the single most important card in APEX.
 *
 * Lives at the top of /me, /team, /group. Answers ONE question:
 * "What should this viewer do in the next 60 seconds that matters most?"
 *
 * Sources (in priority order):
 *   1. CRITICAL aiInsights surfaced to this viewer
 *   2. Cycle deadlines (cycle is open and self-rating not submitted)
 *   3. Pending assessments assigned to this viewer
 *   4. Empty journal mandates with no log this cycle
 *   5. Daily focus suggestion (LLM-generated, falls back to "log today's pulse")
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Mic, Sparkles, AlertTriangle, Clock, Target, MessageSquare, X } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef } from "react";

type Action = {
  kind: "INSIGHT" | "CYCLE" | "ASSESSMENT" | "JOURNAL" | "PULSE" | "GREETING";
  urgency: number;
  title: string;
  body: string;
  ctaLabel: string;
  ctaPath: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "red" | "amber" | "teal" | "violet" | "neutral";
  voicePrompt?: string;
};

const TENANT_ID = 1;

interface Props {
  scope: "me" | "team" | "group";
  viewerPersonId: number;
  viewerName?: string | null;
}

export default function PrimaryActionCard({ scope, viewerPersonId, viewerName }: Props) {
  const [, navigate] = useLocation();

  // Server-computed daily focus (Rhythm Layer)
  const { data: serverFocus } = trpc.rhythm.getMyDailyFocus.useQuery(undefined, { staleTime: 60_000 });
  const markFocus = trpc.rhythm.markFocus.useMutation();

  // Mark as VIEWED — only once per kind change, guarded by ref to avoid
  // re-firing if mutation reference changes between renders
  const markedKindRef = useRef<string | null>(null);
  useEffect(() => {
    if (!serverFocus) return;
    if (markedKindRef.current === serverFocus.kind) return;
    markedKindRef.current = serverFocus.kind;
    markFocus.mutate({ action: "VIEWED" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverFocus?.kind]);

  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });
  const cycleId = activeCycle?.id ?? 0;

  const { data: myJournals } = trpc.governance.getMyJournals.useQuery(
    { tenantId: TENANT_ID, cycleId },
    { enabled: cycleId > 0 }
  );
  const { data: myAssessments } = trpc.governance.getMyAssessments.useQuery(
    { tenantId: TENANT_ID, cycleId },
    { enabled: cycleId > 0 }
  );
  const { data: profile } = trpc.person.getMyProfile.useQuery();

  const action: Action = useMemo(() => {
    // Prefer server-computed focus when available (richer signals)
    if (serverFocus) {
      const accentMap: Record<string, "red" | "amber" | "teal" | "violet" | "neutral"> = {
        INSIGHT: "violet",
        CYCLE_DEADLINE: serverFocus.urgency >= 80 ? "red" : "amber",
        PENDING_ASSESSMENT: "amber",
        EMPTY_JOURNAL: "teal",
        PULSE: "teal",
        GREETING: "neutral",
      };
      const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        INSIGHT: Sparkles,
        CYCLE_DEADLINE: Clock,
        PENDING_ASSESSMENT: AlertTriangle,
        EMPTY_JOURNAL: Target,
        PULSE: Sparkles,
        GREETING: MessageSquare,
      };
      return {
        kind: serverFocus.kind === "CYCLE_DEADLINE" ? "CYCLE" : serverFocus.kind === "PENDING_ASSESSMENT" ? "ASSESSMENT" : serverFocus.kind === "EMPTY_JOURNAL" ? "JOURNAL" : serverFocus.kind === "INSIGHT" ? "INSIGHT" : serverFocus.kind === "PULSE" ? "PULSE" : "GREETING",
        urgency: serverFocus.urgency,
        title: serverFocus.title,
        body: serverFocus.body,
        ctaLabel: serverFocus.ctaLabel,
        ctaPath: serverFocus.ctaPath,
        icon: iconMap[serverFocus.kind] ?? MessageSquare,
        accent: accentMap[serverFocus.kind] ?? "neutral",
        voicePrompt: serverFocus.voicePrompt,
      };
    }

    // Client-side fallback when server focus unavailable
    const mandates = (profile?.currentRole?.successMetrics ?? []) as string[];
    const firstName = (viewerName ?? "").split(" ")[0] || "there";

    // 1. Cycle deadline pressure
    if (activeCycle?.status === "OPEN" && activeCycle.deadlineDate) {
      const daysLeft = Math.ceil(
        (new Date(activeCycle.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const submittedCount = (myAssessments ?? []).filter(a => a.submittedAt).length;
      const totalNeeded = mandates.length;

      if (daysLeft <= 3 && submittedCount < totalNeeded) {
        const remaining = totalNeeded - submittedCount;
        return {
          kind: "CYCLE",
          urgency: 90,
          title: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to submit`,
          body: `${remaining} of ${totalNeeded} mandate${totalNeeded === 1 ? "" : "s"} still needs your rating for ${activeCycle.month}.`,
          ctaLabel: "Open Captain's Log",
          ctaPath: "/me",
          icon: Clock,
          accent: daysLeft <= 1 ? "red" : "amber",
          voicePrompt: "Would you like to talk through your remaining mandates?",
        };
      }
    }

    // 2. Empty journals — first-time guidance
    if (cycleId > 0 && mandates.length > 0) {
      const journaledDims = new Set((myJournals ?? []).filter(j => j.logText && j.logText.length > 10).map(j => j.dimensionKey));
      const emptyDim = mandates.find(m => !journaledDims.has(m));
      if (emptyDim && journaledDims.size === 0) {
        return {
          kind: "JOURNAL",
          urgency: 70,
          title: `Start with ${emptyDim}`,
          body: `Your first mandate this cycle. 30 seconds via voice — say what you've moved on this month.`,
          ctaLabel: "Open & log",
          ctaPath: "/me",
          icon: Target,
          accent: "teal",
          voicePrompt: `Tell me what you did this month on ${emptyDim}.`,
        };
      }
      if (emptyDim) {
        return {
          kind: "JOURNAL",
          urgency: 60,
          title: `${emptyDim} hasn't been logged yet`,
          body: `One short note keeps your Bridge complete this cycle.`,
          ctaLabel: "Log it now",
          ctaPath: "/me",
          icon: Target,
          accent: "amber",
          voicePrompt: `Tell me what you did this month on ${emptyDim}.`,
        };
      }
    }

    // 3. Active cycle, self-rating still pending
    if (activeCycle?.status === "OPEN" && mandates.length > 0) {
      const ratedCount = (myAssessments ?? []).filter(a => a.score != null).length;
      if (ratedCount < mandates.length) {
        return {
          kind: "ASSESSMENT",
          urgency: 55,
          title: `Rate yourself on ${mandates.length - ratedCount} mandate${mandates.length - ratedCount === 1 ? "" : "s"}`,
          body: `Quick self-rating helps the Chairman calibrate this cycle.`,
          ctaLabel: "Open ratings",
          ctaPath: "/me",
          icon: Sparkles,
          accent: "violet",
        };
      }
    }

    // 4. /team scope — surface team submission gaps
    if (scope === "team" && activeCycle?.status === "OPEN") {
      return {
        kind: "ASSESSMENT",
        urgency: 50,
        title: `${activeCycle.month} cycle is open`,
        body: `Review your team's progress and rate them as they submit.`,
        ctaLabel: "See team status",
        ctaPath: "/team",
        icon: AlertTriangle,
        accent: "teal",
      };
    }

    // 5. /group scope — show fund pulse
    if (scope === "group" && activeCycle?.status === "OPEN") {
      return {
        kind: "INSIGHT",
        urgency: 50,
        title: `${activeCycle.month} cycle in motion`,
        body: `Drill into perception gaps and chain risks across the fund.`,
        ctaLabel: "Open insights",
        ctaPath: "/group",
        icon: Sparkles,
        accent: "teal",
      };
    }

    // Default: friendly greeting + pulse prompt
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return {
      kind: "GREETING",
      urgency: 30,
      title: `${greeting}, ${firstName}`,
      body: cycleId === 0
        ? "No cycle is open right now. Capture a quick observation while it's fresh."
        : "All caught up for this cycle. A quick pulse keeps the rhythm going.",
      ctaLabel: cycleId === 0 ? "Capture observation" : "Friday pulse",
      ctaPath: cycleId === 0 ? "/capture" : "/me",
      icon: MessageSquare,
      accent: "neutral",
      voicePrompt: "What's one thing on your mind right now?",
    };
  }, [activeCycle, myJournals, myAssessments, profile, scope, viewerName, cycleId, serverFocus]);

  const accentClasses = {
    red: "border-red-500/40 bg-red-500/5",
    amber: "border-amber-500/40 bg-amber-500/5",
    teal: "border-teal-500/40 bg-teal-500/5",
    violet: "border-violet-500/40 bg-violet-500/5",
    neutral: "border-border bg-card",
  }[action.accent];

  const iconClasses = {
    red: "text-red-500",
    amber: "text-amber-500",
    teal: "text-teal-500",
    violet: "text-violet-500",
    neutral: "text-muted-foreground",
  }[action.accent];

  const Icon = action.icon;

  return (
    <Card className={`border-2 ${accentClasses} mb-6`}>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-background/60 ${iconClasses}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Today's focus
              </Badge>
              {action.urgency >= 80 && (
                <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
              )}
            </div>
            <h2 className="text-lg md:text-xl font-semibold leading-tight">{action.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{action.body}</p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button onClick={() => navigate(action.ctaPath)} className="gap-2">
                {action.ctaLabel}
                <ArrowRight className="w-4 h-4" />
              </Button>
              {action.voicePrompt && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => navigate("/capture?voice=true&prompt=" + encodeURIComponent(action.voicePrompt!))}
                >
                  <Mic className="w-4 h-4" />
                  Talk it through
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
