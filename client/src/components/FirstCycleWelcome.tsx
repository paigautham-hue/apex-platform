/**
 * FirstCycleWelcome — hero state for users with no active cycle and/or no
 * mandates yet. Shows instead of an error-ish empty card so first-login
 * users know what to expect.
 *
 * Three layouts:
 *   1. No cycle open, user has mandates     → "Waiting for your Chairman..."
 *   2. No cycle open, user has no mandates  → "Your workspace isn't set up yet"
 *   3. Cycle open, user has no mandates     → "Ask admin to configure mandates"
 *
 * Each layout includes an illustrated 3-step checklist and either an admin
 * CTA (for admins) or a ghost-mandate preview (for non-admins) so users see
 * what /me will look like when real data arrives.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Anchor,
  Calendar,
  Compass,
  ListChecks,
  MessageSquare,
  Mic,
  Settings2,
  Target,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  isAdmin: boolean;
  hasCycle: boolean;
  hasMandates: boolean;
  cycleMonth?: string | null;
  userFirstName?: string | null;
}

export default function FirstCycleWelcome({
  isAdmin,
  hasCycle,
  hasMandates,
  cycleMonth,
  userFirstName,
}: Props) {
  const [, navigate] = useLocation();
  const firstName = userFirstName?.split(" ")[0] || "there";

  const heading = !hasCycle && hasMandates
    ? `Welcome aboard, ${firstName}`
    : !hasCycle && !hasMandates
      ? "Let's set up your workspace"
      : "Your mandates aren't configured yet";

  const body = !hasCycle && hasMandates
    ? `Your Chairman will open the next monthly cycle soon. When they do, your mandates appear here and you can log, plan, and self-rate.`
    : !hasCycle && !hasMandates
      ? `Two things need to happen before your workspace comes alive: your role mandates need to be configured, and your Chairman opens the cycle.`
      : `Cycle ${cycleMonth ?? ""} is open, but your role doesn't have mandates yet. Ask your admin to add successMetrics to your role.`;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-2 border-teal-500/20 bg-gradient-to-br from-teal-500/5 via-violet-500/5 to-transparent">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center flex-shrink-0">
              <Anchor className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className="text-[10px] uppercase mb-1">
                Getting started
              </Badge>
              <h2 className="text-xl md:text-2xl font-semibold">{heading}</h2>
              <p className="text-sm text-muted-foreground mt-1.5">{body}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-5">
            <StepCard
              num="1"
              icon={Settings2}
              title="Mandates configured"
              body="Your Chairman or admin sets your role's mandates (the 5-10 things you're responsible for)."
              done={hasMandates}
            />
            <StepCard
              num="2"
              icon={Calendar}
              title="Cycle opens"
              body="A monthly cycle opens (usually the 1st). You get a window to log, plan, and self-rate."
              done={hasCycle}
            />
            <StepCard
              num="3"
              icon={MessageSquare}
              title="Ratings reveal"
              body="Once you AND your Chairman both submit, scores unlock side-by-side so perception gaps are visible."
              done={false}
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {isAdmin && !hasCycle && (
              <Button onClick={() => navigate("/governance-admin")} className="gap-2">
                <Calendar className="w-4 h-4" />
                Open a cycle now
              </Button>
            )}
            {isAdmin && !hasMandates && (
              <Button variant="outline" onClick={() => navigate("/admin")} className="gap-2">
                <Settings2 className="w-4 h-4" />
                Configure mandates
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/capture?voice=true")} className="gap-2">
              <Mic className="w-4 h-4" />
              Capture a thought
            </Button>
            <Button variant="ghost" onClick={() => navigate("/reflections")} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Start reflecting
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ghost mandate preview — shows what /me will look like */}
      {!hasMandates && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Preview · what your Bridge will look like
          </p>
          <Card className="relative overflow-hidden opacity-60 pointer-events-none select-none">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.02)_25%,rgba(255,255,255,.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.02)_75%)] bg-[length:32px_32px]" aria-hidden />
            <CardContent className="p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Example mandate
                  </div>
                  <h3 className="text-base font-semibold">Revenue Growth</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">7/10 · GREEN</Badge>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[11px]">
                <span className="px-2 py-1 rounded bg-muted/50 flex items-center gap-1 justify-center"><MessageSquare className="w-3 h-3" /> Log</span>
                <span className="px-2 py-1 rounded bg-muted/50 flex items-center gap-1 justify-center"><Compass className="w-3 h-3" /> Plan</span>
                <span className="px-2 py-1 rounded bg-muted/50 flex items-center gap-1 justify-center"><Target className="w-3 h-3" /> Rate</span>
                <span className="px-2 py-1 rounded bg-muted/50 flex items-center gap-1 justify-center"><ListChecks className="w-3 h-3" /> Chairman</span>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Signed 3 new enterprise deals worth ₹12Cr; Q2 pipeline is 18% above plan...
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StepCard({
  num,
  icon: Icon,
  title,
  body,
  done,
}: {
  num: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        done
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
            done
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? "✓" : num}
        </div>
        <Icon className={`w-3.5 h-3.5 ${done ? "text-emerald-500" : "text-muted-foreground"}`} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
