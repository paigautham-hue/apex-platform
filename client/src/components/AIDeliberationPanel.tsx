/**
 * AIDeliberationPanel — multi-persona AI panel review trigger + result viewer.
 *
 * Use on PersonProfile or a Company page. Any leader can run it on any
 * subordinate (server gates auth via scope subtree).
 *
 * Renders:
 *   - "Run AI Panel" button
 *   - Last 3 deliberations as collapsible cards with persona verdicts +
 *     synthesis + recommended actions
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Sparkles, Loader2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";

type TargetType = "ROLE" | "COMPANY" | "PERSON";

interface Props {
  targetType: TargetType;
  targetId: number;
  cycleId?: number;
  targetName?: string;
}

interface PersonaVerdict {
  personaKey: string;
  verdict: string;
  confidence: number;
  cited: any[];
}

export default function AIDeliberationPanel({ targetType, targetId, cycleId, targetName }: Props) {
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: history, refetch } = trpc.deliberation.listForTarget.useQuery({
    targetType,
    targetId,
    limit: 5,
  });
  const runMutation = trpc.deliberation.run.useMutation();

  const handleRun = async () => {
    setRunning(true);
    try {
      await runMutation.mutateAsync({ targetType, targetId, cycleId });
      toast.success("Panel review complete");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Panel run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            AI Panel Review
          </CardTitle>
          <Button onClick={handleRun} disabled={running} size="sm" className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {running ? "Deliberating..." : "Run panel"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          5 specialist personas (Advocate / Skeptic / Risk / CFO / Culture) plus a Chairman synthesis. ~20-30 seconds.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!history || history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No panel reviews yet. Run one to see what the AI sees.</p>
        ) : (
          history.map(deli => {
            const isExpanded = expandedId === deli.id;
            const verdicts = (deli.personaVerdicts ?? []) as PersonaVerdict[];
            const recs = (deli.recommendedActions ?? []) as string[];
            return (
              <div key={deli.id} className="rounded-md border">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : deli.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {new Date(deli.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm truncate">
                        {deli.synthesis ? deli.synthesis.slice(0, 100) + (deli.synthesis.length > 100 ? "..." : "") : "(no synthesis)"}
                      </div>
                    </div>
                  </div>
                  <Badge variant={deli.status === "COMPLETE" ? "secondary" : deli.status === "FAILED" ? "destructive" : "outline"}>
                    {deli.status}
                  </Badge>
                </button>
                {isExpanded && (
                  <div className="border-t p-3 space-y-3">
                    {deli.synthesis && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Synthesis</div>
                        <p className="text-sm whitespace-pre-wrap">{deli.synthesis}</p>
                      </div>
                    )}
                    {recs.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Recommended actions</div>
                        <ul className="text-sm space-y-1 list-disc pl-5">
                          {recs.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Persona verdicts</div>
                      <div className="space-y-2">
                        {verdicts.map(v => (
                          <div key={v.personaKey} className="rounded-md border bg-muted/20 p-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] uppercase">{v.personaKey}</Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {Math.round((v.confidence ?? 0) * 100)}% confident
                              </span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap">{v.verdict}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
