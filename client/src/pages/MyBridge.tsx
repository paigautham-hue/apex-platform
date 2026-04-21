import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Anchor, Compass, History, Lock, MessageSquare, Send, Target } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

type MandateDraft = {
  logText: string;
  planText: string;
  score: number | null;
};

function ragFromScore(score: number | null): "RED" | "AMBER" | "GREEN" | null {
  if (score === null) return null;
  if (score >= 8) return "GREEN";
  if (score >= 5) return "AMBER";
  return "RED";
}

function ragColor(rag: "RED" | "AMBER" | "GREEN" | null) {
  if (rag === "GREEN") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (rag === "AMBER") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  if (rag === "RED") return "bg-red-500/15 text-red-700 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function MyBridge() {
  const { data: profile } = trpc.person.getMyProfile.useQuery();
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });
  const { data: cycles } = trpc.governance.listCycles.useQuery({ tenantId: TENANT_ID });
  const { data: feedbackTypes } = trpc.governance.listFeedbackTypes.useQuery({ tenantId: TENANT_ID });
  const { data: chains } = trpc.governance.listChains.useQuery({ tenantId: TENANT_ID });

  // Prior cycle = the next-most-recent month before active, by string sort on YYYY-MM
  const priorCycleId = useMemo(() => {
    if (!activeCycle || !cycles) return 0;
    const earlier = cycles
      .filter((c) => c.month < activeCycle.month)
      .sort((a, b) => b.month.localeCompare(a.month));
    return earlier[0]?.id ?? 0;
  }, [activeCycle?.month, cycles]);

  const cycleId = activeCycle?.id ?? 0;
  const roleId = profile?.currentRoleId ?? 0;
  const mandates = (profile?.currentRole?.successMetrics ?? []) as string[];

  const selfType = feedbackTypes?.find((t) => t.key === "self");
  const chairmanType = feedbackTypes?.find((t) => t.key === "chairman");

  const { data: journals, refetch: refetchJournals } =
    trpc.governance.getMyJournals.useQuery(
      { tenantId: TENANT_ID, cycleId },
      { enabled: cycleId > 0 },
    );

  const { data: priorJournals, refetch: refetchPriorJournals } =
    trpc.governance.getMyJournals.useQuery(
      { tenantId: TENANT_ID, cycleId: priorCycleId },
      { enabled: priorCycleId > 0 },
    );

  const markPriorPlanItem = trpc.governance.markPriorPlanItem.useMutation({
    onSuccess: () => refetchPriorJournals(),
  });

  const { data: myAssessments, refetch: refetchAssessments } =
    trpc.governance.getMyAssessments.useQuery(
      { tenantId: TENANT_ID, cycleId },
      { enabled: cycleId > 0 },
    );

  const { data: assessmentsForMe } =
    trpc.governance.getAssessmentsForTarget.useQuery(
      { tenantId: TENANT_ID, cycleId, targetType: "ROLE", targetId: roleId },
      { enabled: cycleId > 0 && roleId > 0 },
    );

  const upsertJournal = trpc.governance.upsertJournal.useMutation({
    onSuccess: () => {
      refetchJournals();
    },
  });
  const upsertAssessment = trpc.governance.upsertAssessment.useMutation({
    onSuccess: () => {
      refetchAssessments();
    },
  });

  const [drafts, setDrafts] = useState<Record<string, MandateDraft>>({});

  useEffect(() => {
    if (!mandates.length) return;
    const next: Record<string, MandateDraft> = {};
    for (const dim of mandates) {
      const journal = journals?.find((j) => j.dimensionKey === dim);
      const self = myAssessments?.find(
        (a) => a.dimensionKey === dim && a.feedbackTypeId === selfType?.id,
      );
      next[dim] = {
        logText: journal?.logText ?? "",
        planText: journal?.planText ?? "",
        score: self?.score ?? null,
      };
    }
    setDrafts((prev) => ({ ...next, ...prev }));
  }, [mandates.join("|"), journals, myAssessments, selfType?.id]);

  const updateDraft = (key: string, patch: Partial<MandateDraft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const saveJournal = async (dim: string): Promise<void> => {
    if (!cycleId) return;
    const d = drafts[dim];
    if (!d) return;
    await upsertJournal.mutateAsync({
      tenantId: TENANT_ID,
      cycleId,
      dimensionKey: dim,
      roleId: roleId || null,
      orgUnitId: null,
      logText: d.logText || null,
      planText: d.planText || null,
      planItems: null,
    });
  };

  const saveRating = async (dim: string, submit = false): Promise<void> => {
    if (!cycleId || !selfType) return;
    const d = drafts[dim];
    if (!d) return;
    await upsertAssessment.mutateAsync({
      tenantId: TENANT_ID,
      cycleId,
      targetType: "ROLE",
      targetId: roleId,
      dimensionKey: dim,
      feedbackTypeId: selfType.id,
      score: d.score,
      rag: ragFromScore(d.score),
      note: null,
      confidenceNote: null,
      submit,
    });
  };

  // Fire-and-forget for blur handlers (just logs any error to sonner via the
  // mutation's onError). Returns void so onBlur handlers stay synchronous.
  const saveJournalOnBlur = (dim: string) => {
    void saveJournal(dim).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    });
  };
  const saveRatingOnCommit = (dim: string) => {
    void saveRating(dim).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    });
  };

  const submitMonth = async () => {
    if (!cycleId) return;
    const tasks: Promise<void>[] = [];
    for (const dim of mandates) {
      tasks.push(saveJournal(dim));
      tasks.push(saveRating(dim, true));
    }
    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const firstErr = failed[0] as PromiseRejectedResult;
      toast.error(
        `Submit incomplete: ${failed.length}/${results.length} writes failed. ` +
          (firstErr.reason instanceof Error ? firstErr.reason.message : String(firstErr.reason)),
      );
    } else {
      toast.success("Submitted for this cycle. Chairman view unlocks after chairman submits.");
    }
  };

  const myChains = useMemo(() => {
    if (!chains || !roleId) return [];
    return chains.filter((c) => (c.nodeRoleIds ?? []).includes(roleId));
  }, [chains, roleId]);

  if (!profile) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading your bridge...</div>
    );
  }

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Anchor className="h-7 w-7" />
            My Bridge
          </h1>
          <p className="text-muted-foreground">Welcome aboard, {profile.name ?? "Captain"}. Your station awaits.</p>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No governance cycle is currently open. The Chairman will open the next monthly cycle soon.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!mandates.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Anchor className="h-7 w-7" />
            My Bridge
          </h1>
          <p className="text-muted-foreground">Your role has no mandates configured yet. Ask your administrator to populate successMetrics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Anchor className="h-7 w-7" />
            My Bridge
          </h1>
          <p className="text-muted-foreground">
            Welcome aboard, {profile.name ?? "Captain"}. Your station awaits.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{profile.currentRole?.title ?? "No role"}</Badge>
            <Badge variant="secondary">Cycle: {activeCycle.month}</Badge>
            <Badge className={ragColor(null)}>{activeCycle.status}</Badge>
          </div>
        </div>
        <Button className="gap-2" onClick={submitMonth} disabled={upsertJournal.isPending || upsertAssessment.isPending}>
          <Send className="h-4 w-4" />
          Submit Month
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Mandate cards */}
        <div className="space-y-4">
          {mandates.map((dim, idx) => {
            const draft = drafts[dim] ?? { logText: "", planText: "", score: null };
            const self = myAssessments?.find(
              (a) => a.dimensionKey === dim && a.feedbackTypeId === selfType?.id,
            );
            const chairman = assessmentsForMe?.find(
              (a) => a.dimensionKey === dim && a.feedbackTypeId === chairmanType?.id,
            );
            const bothSubmitted = !!(self?.submittedAt && chairman?.submittedAt);
            const gap =
              bothSubmitted && self?.score != null && chairman?.score != null
                ? Math.abs(chairman.score - self.score)
                : null;
            const rag = ragFromScore(draft.score);

            return (
              <Card key={dim}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Mandate {idx + 1}
                      </div>
                      <CardTitle className="text-lg leading-tight">{dim}</CardTitle>
                    </div>
                    <Badge className={ragColor(rag)}>
                      {draft.score === null ? "Unrated" : `${draft.score}/10 · ${rag}`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="log" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="log" className="gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Captain's Log
                      </TabsTrigger>
                      <TabsTrigger value="plan" className="gap-1">
                        <Compass className="h-3 w-3" />
                        Next Heading
                      </TabsTrigger>
                      <TabsTrigger value="rate" className="gap-1">
                        <Target className="h-3 w-3" />
                        Self-Rating
                      </TabsTrigger>
                      <TabsTrigger value="chairman" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Chairman
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="log" className="space-y-3 pt-3">
                      {(() => {
                        const prior = priorJournals?.find((j) => j.dimensionKey === dim);
                        if (!prior) return null;
                        const priorItems = (prior.planItems ?? []) as Array<{
                          item: string;
                          completedNextMonth: boolean | null;
                        }>;
                        return (
                          <div className="rounded-md border border-dashed p-3 bg-muted/40 space-y-2">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                              <History className="h-3 w-3" />
                              Last cycle's plan
                            </div>
                            {prior.planText && (
                              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                                {prior.planText}
                              </p>
                            )}
                            {priorItems.length > 0 && (
                              <div className="space-y-1 pt-1">
                                {priorItems.map((it, i) => (
                                  <label key={i} className="flex items-start gap-2 text-sm">
                                    <Checkbox
                                      className="mt-0.5"
                                      checked={it.completedNextMonth === true}
                                      onCheckedChange={(v) =>
                                        markPriorPlanItem.mutate({
                                          tenantId: TENANT_ID,
                                          dimensionKey: dim,
                                          priorCycleId,
                                          itemIndex: i,
                                          completed: v === true,
                                        })
                                      }
                                    />
                                    <span
                                      className={
                                        it.completedNextMonth === true
                                          ? "line-through text-muted-foreground"
                                          : ""
                                      }
                                    >
                                      {it.item}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <Label>What I did this month toward this mandate</Label>
                      <Textarea
                        rows={5}
                        value={draft.logText}
                        onChange={(e) => updateDraft(dim, { logText: e.target.value })}
                        onBlur={() => saveJournalOnBlur(dim)}
                        placeholder="The ship's log for this heading..."
                      />
                    </TabsContent>

                    <TabsContent value="plan" className="space-y-3 pt-3">
                      {(() => {
                        const prior = priorJournals?.find((j) => j.dimensionKey === dim);
                        if (!prior || !prior.logText) return null;
                        return (
                          <div className="rounded-md border border-dashed p-3 bg-muted/40">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                              <History className="h-3 w-3" />
                              Last cycle's log (for context)
                            </div>
                            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                              {prior.logText}
                            </p>
                          </div>
                        );
                      })()}
                      <Label>What I plan to do next month</Label>
                      <Textarea
                        rows={5}
                        value={draft.planText}
                        onChange={(e) => updateDraft(dim, { planText: e.target.value })}
                        onBlur={() => saveJournalOnBlur(dim)}
                        placeholder="Top 1-3 specific commitments for the next cycle..."
                      />
                    </TabsContent>

                    <TabsContent value="rate" className="space-y-4 pt-3">
                      <div>
                        <Label className="mb-2 block">
                          How well did I deliver on this mandate this month? ({draft.score ?? "—"}/10)
                        </Label>
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[draft.score ?? 5]}
                          onValueChange={([v]) => updateDraft(dim, { score: v })}
                          onValueCommit={() => saveRatingOnCommit(dim)}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>1 · Struggling</span>
                          <span>5 · On track</span>
                          <span>10 · Exceeding</span>
                        </div>
                      </div>
                      {self?.submittedAt && (
                        <div className="text-xs text-muted-foreground">
                          Submitted {new Date(self.submittedAt).toLocaleDateString()}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="chairman" className="pt-3">
                      {!bothSubmitted ? (
                        <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
                          <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">
                            Chairman's view unlocks once both you and the Chairman have submitted for this cycle.
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className={ragColor(chairman?.rag ?? null)}>
                              Chairman: {chairman?.score}/10 · {chairman?.rag}
                            </Badge>
                            <Badge variant="outline">
                              Perception gap: {gap}
                              {gap !== null && gap >= 3 ? " · RED" : gap !== null && gap >= 2 ? " · AMBER" : " · GREEN"}
                            </Badge>
                          </div>
                          {chairman?.note && (
                            <p className="text-sm whitespace-pre-wrap">{chairman.note}</p>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My Chains</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myChains.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  You are not currently part of any dependency chains.
                </p>
              )}
              {myChains.map((chain) => (
                <div
                  key={chain.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  style={{ borderLeft: `4px solid ${chain.color}` }}
                >
                  <span className="font-medium">{chain.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {(chain.nodeRoleIds ?? []).length} roles
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">This Cycle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Month</span>
                <span>{activeCycle.month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{activeCycle.status}</span>
              </div>
              {activeCycle.deadlineDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deadline</span>
                  <span>{new Date(activeCycle.deadlineDate).toLocaleDateString()}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mandates rated</span>
                <span>
                  {(myAssessments ?? []).filter((a) => a.feedbackTypeId === selfType?.id).length}/
                  {mandates.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
