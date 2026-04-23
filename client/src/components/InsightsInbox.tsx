/**
 * InsightsInbox — scope-aware AI insight cards.
 * Renders the insights surfaced to this viewer with snooze / address / dismiss.
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles, Clock, CheckCircle2, X, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "border-red-500/40 bg-red-500/5",
  WARNING: "border-amber-500/40 bg-amber-500/5",
  INFO: "border-violet-500/40 bg-violet-500/5",
};

const SEVERITY_ICON_COLOR: Record<string, string> = {
  CRITICAL: "text-red-500",
  WARNING: "text-amber-500",
  INFO: "text-violet-500",
};

export default function InsightsInbox({ limit = 5 }: { limit?: number }) {
  const [, navigate] = useLocation();
  const { data, refetch } = trpc.insights.listForViewer.useQuery({ limit, includeAddressed: false });
  const snooze = trpc.insights.snooze.useMutation({ onSuccess: () => refetch() });
  const addressed = trpc.insights.markAddressed.useMutation({ onSuccess: () => refetch() });
  const dismiss = trpc.insights.dismiss.useMutation({ onSuccess: () => refetch() });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            AI insights for you
          </h3>
          <Badge variant="outline" className="text-[10px]">{data.length}</Badge>
        </div>
        <div className="space-y-2">
          {data.map(insight => {
            const sev = insight.severity ?? "INFO";
            const Icon = sev === "CRITICAL" ? AlertTriangle : sev === "WARNING" ? Clock : Sparkles;
            return (
              <div
                key={insight.id}
                className={`rounded-md border-l-4 ${SEVERITY_COLOR[sev]} pl-3 pr-2 py-2`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${SEVERITY_ICON_COLOR[sev]}`} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase">{insight.insightType.replace(/_/g, " ")}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{sev}</Badge>
                      {insight.scope && (
                        <Badge variant="outline" className="text-[10px]">{insight.scope}</Badge>
                      )}
                    </div>
                    <p className="text-sm leading-snug">{insight.insightText}</p>
                    <div className="flex items-center gap-1 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1"
                        onClick={() => {
                          addressed.mutate({ insightId: insight.id });
                          toast.success("Marked addressed");
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Addressed
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1"
                        onClick={() => {
                          snooze.mutate({ insightId: insight.id, hours: 24 });
                          toast.success("Snoozed 24h");
                        }}
                      >
                        <Clock className="w-3 h-3" />
                        Snooze 24h
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1"
                        onClick={() => {
                          dismiss.mutate({ insightId: insight.id });
                        }}
                      >
                        <X className="w-3 h-3" />
                        Dismiss
                      </Button>
                      {insight.targetType === "ROLE" && insight.targetId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] gap-1 ml-auto"
                          onClick={() => navigate(`/people/${insight.targetId}`)}
                        >
                          Open
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
