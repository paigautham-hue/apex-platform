/**
 * VarianceAlerts — top-of-cockpit alert strip showing companies off-track.
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

export default function VarianceAlerts() {
  const [, navigate] = useLocation();
  const { data: alerts } = trpc.financialAnalytics.varianceAlerts.useQuery({ fiscalYear: "2027" });

  if (!alerts || alerts.length === 0) {
    return null;
  }

  const offTrack = alerts.filter(a => a.variance === "OFF_TRACK");
  const watch = alerts.filter(a => a.variance === "WATCH");

  return (
    <Card className="border-l-4 border-l-amber-500/60 mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Variance alerts</h3>
          <Badge variant="destructive" className="text-[10px]">{offTrack.length} off-track</Badge>
          {watch.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40">
              {watch.length} watch
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          {alerts.slice(0, 5).map(a => (
            <div
              key={`${a.orgUnitId}-${a.metricId}`}
              className={`flex items-center justify-between rounded-md px-3 py-2 border ${
                a.variance === "OFF_TRACK"
                  ? "bg-red-500/10 dark:bg-red-500/15 border-red-500/50"
                  : "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="sr-only">
                  {a.variance === "OFF_TRACK" ? "Off track: " : "Watch: "}
                </span>
                <TrendingDown
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    a.variance === "OFF_TRACK"
                      ? "text-red-700 dark:text-red-300"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {a.orgUnitName} · {a.metricName}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    YTD {a.ytdActual.toLocaleString()} vs target {a.targetValue.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={a.variance === "OFF_TRACK" ? "destructive" : "secondary"} className="text-[10px]">
                  {a.variancePct >= 0 ? "+" : ""}
                  {a.variancePct.toFixed(1)}%
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs gap-0.5"
                  onClick={() => navigate(`/people?orgUnit=${a.orgUnitId}`)}
                >
                  Open
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          {alerts.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{alerts.length - 5} more variance{alerts.length - 5 === 1 ? "" : "s"} below
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
