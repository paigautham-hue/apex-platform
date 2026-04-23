/**
 * CycleStatusBanner — persistent, ambient status of the current governance cycle.
 *
 * Shows on every fractal page. Three states:
 *   - No cycle: muted "next cycle opens..."
 *   - OPEN: countdown to deadline + state pill + submit CTA
 *   - CLOSED/REVEALED: "Reveal available" / "Cycle closed"
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const TENANT_ID = 1;

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CycleStatusBanner() {
  const [, navigate] = useLocation();
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });

  if (!activeCycle) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
        <Calendar className="w-3.5 h-3.5" />
        <span>No active governance cycle. Admin can open one in Governance Admin.</span>
      </div>
    );
  }

  const deadline = activeCycle.deadlineDate ? new Date(activeCycle.deadlineDate) : null;
  const reveal = activeCycle.revealDate ? new Date(activeCycle.revealDate) : null;
  const now = new Date();

  const status = activeCycle.status;
  const daysToDeadline = deadline ? daysBetween(deadline, now) : null;
  const daysToReveal = reveal ? daysBetween(reveal, now) : null;

  let pillVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let pillText: string = String(status ?? "—");
  let icon = Clock;
  let bg = "bg-muted/40 border-border";
  let urgent = false;

  if (status === "DRAFT") {
    pillText = "Not yet open";
    icon = EyeOff;
  } else if (status === "OPEN") {
    if (daysToDeadline !== null && daysToDeadline <= 1) {
      pillVariant = "destructive";
      pillText = daysToDeadline <= 0 ? "Overdue" : "1 day left";
      bg = "bg-red-500/15 border-red-500/50 text-red-800 dark:text-red-200";
      urgent = true;
    } else if (daysToDeadline !== null && daysToDeadline <= 3) {
      pillText = `${daysToDeadline} days left`;
      bg = "bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-200";
    } else {
      pillText = `Open · ${daysToDeadline ?? "—"} days left`;
      bg = "bg-teal-500/15 border-teal-500/50 text-teal-800 dark:text-teal-200";
    }
    icon = Clock;
  } else if (status === "CLOSED") {
    pillText = daysToReveal !== null && daysToReveal > 0 ? `Reveal in ${daysToReveal}d` : "Reveal soon";
    icon = EyeOff;
    bg = "bg-violet-500/15 border-violet-500/50 text-violet-800 dark:text-violet-200";
  } else if (status === "REVEALED") {
    pillText = "Revealed";
    icon = Eye;
    bg = "bg-emerald-500/15 border-emerald-500/50 text-emerald-800 dark:text-emerald-200";
  }

  const Icon = icon;

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md border ${bg}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span
          className="text-xs font-medium truncate"
          title={`Cycle ${activeCycle.month} · ${pillText}`}
        >
          Cycle {activeCycle.month} · {pillText}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {status === "OPEN" && (
          <Button size="sm" variant={urgent ? "destructive" : "outline"} className="h-9 text-xs" onClick={() => navigate("/me")}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Review &amp; submit
          </Button>
        )}
        {status === "REVEALED" && (
          <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => navigate("/me")}>
            <Eye className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            See gaps
          </Button>
        )}
      </div>
    </div>
  );
}
