import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Compass, Lock, MessageSquare, Palmtree, Send, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

const DEFAULT_COMPANY_DIMENSIONS = [
  "Revenue Growth",
  "Margin & Profitability",
  "Operations & Delivery",
  "Team & Culture",
  "Customer & Market",
  "Risk & Governance",
] as const;

type DimensionDraft = {
  logText: string;
  planText: string;
  score: number | null;
};

type ReflectionDraft = {
  wentWell: string;
  didntGoWell: string;
  risks: string;
  needsFromFund: string;
  forwardCommitments: string;
};

function toLines(s: string): string[] {
  return s
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function fromLines(arr: string[] | null | undefined): string {
  return (arr ?? []).join("\n");
}

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

export default function MyIsland() {
  const { data: profile } = trpc.person.getMyProfile.useQuery();
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });
  const { data: feedbackTypes } = trpc.governance.listFeedbackTypes.useQuery({ tenantId: TENANT_ID });
  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: TENANT_ID });

  const cycleId = activeCycle?.id ?? 0;
  const orgUnitId = profile?.currentRole?.orgUnitId ?? 0;
  const company = orgUnits?.find((u) => u.id === orgUnitId);

  const dimensions = useMemo(
    () => DEFAULT_COMPANY_DIMENSIONS.map((d) => d),
    [],
  );

  const selfType = feedbackTypes?.find((t) => t.key === "self");
  const chairmanType = feedbackTypes?.find((t) => t.key === "chairman");

  const { data: journals, refetch: refetchJournals } =
    trpc.governance.getMyJournals.useQuery(
      { tenantId: TENANT_ID, cycleId },
      { enabled: cycleId > 0 },
    );

  const { data: myAssessments, refetch: refetchAssessments } =
    trpc.governance.getMyAssessments.useQuery(
      { tenantId: TENANT_ID, cycleId },
      { enabled: cycleId > 0 },
    );

  const { data: assessmentsForCompany } =
    trpc.governance.getAssessmentsForTarget.useQuery(
      { tenantId: TENANT_ID, cycleId, targetType: "COMPANY", targetId: orgUnitId },
      { enabled: cycleId > 0 && orgUnitId > 0 },
    );

  const { data: existingReflection, refetch: refetchReflection } =
    trpc.governance.getReflection.useQuery(
      { tenantId: TENANT_ID, cycleId, orgUnitId },
      { enabled: cycleId > 0 && orgUnitId > 0 },
    );

  const upsertJournal = trpc.governance.upsertJournal.useMutation({
    onSuccess: () => refetchJournals(),
  });
  const upsertAssessment = trpc.governance.upsertAssessment.useMutation({
    onSuccess: () => refetchAssessments(),
  });
  const upsertReflection = trpc.governance.upsertReflection.useMutation({
    onSuccess: () => refetchReflection(),
  });

  const [drafts, setDrafts] = useState<Record<string, DimensionDraft>>({});
  const [reflection, setReflection] = useState<ReflectionDraft>({
    wentWell: "",
    didntGoWell: "",
    risks: "",
    needsFromFund: "",
    forwardCommitments: "",
  });

  useEffect(() => {
    const next: Record<string, DimensionDraft> = {};
    for (const dim of dimensions) {
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
  }, [dimensions.join("|"), journals, myAssessments, selfType?.id]);

  useEffect(() => {
    if (!existingReflection) return;
    setReflection((prev) => ({
      wentWell: prev.wentWell || fromLines(existingReflection.wentWell),
      didntGoWell: prev.didntGoWell || fromLines(existingReflection.didntGoWell),
      risks: prev.risks || fromLines(existingReflection.risks),
      needsFromFund: prev.needsFromFund || fromLines(existingReflection.needsFromFund),
      forwardCommitments: prev.forwardCommitments || fromLines(existingReflection.forwardCommitments),
    }));
  }, [existingReflection?.id]);

  const updateDraft = (key: string, patch: Partial<DimensionDraft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const saveJournal = (dim: string) => {
    if (!cycleId || !orgUnitId) return;
    const d = drafts[dim];
    if (!d) return;
    upsertJournal.mutate({
      tenantId: TENANT_ID,
      cycleId,
      dimensionKey: dim,
      roleId: null,
      orgUnitId,
      logText: d.logText || null,
      planText: d.planText || null,
      planItems: null,
    });
  };

  const saveRating = (dim: string, submit = false) => {
    if (!cycleId || !selfType || !orgUnitId) return;
    const d = drafts[dim];
    if (!d) return;
    upsertAssessment.mutate({
      tenantId: TENANT_ID,
      cycleId,
      targetType: "COMPANY",
      targetId: orgUnitId,
      dimensionKey: dim,
      feedbackTypeId: selfType.id,
      score: d.score,
      rag: ragFromScore(d.score),
      note: null,
      confidenceNote: null,
      submit,
    });
  };

  const saveReflection = () => {
    if (!cycleId || !orgUnitId) return;
    upsertReflection.mutate({
      tenantId: TENANT_ID,
      cycleId,
      orgUnitId,
      wentWell: toLines(reflection.wentWell),
      didntGoWell: toLines(reflection.didntGoWell),
      risks: toLines(reflection.risks),
      needsFromFund: toLines(reflection.needsFromFund),
      forwardCommitments: toLines(reflection.forwardCommitments),
    });
  };

  const submitMonth = () => {
    if (!cycleId) return;
    for (const dim of dimensions) {
      saveJournal(dim);
      saveRating(dim, true);
    }
    saveReflection();
    toast.success("Island submitted for this cycle.");
  };

  if (!profile) {
    return <div className="p-6 text-sm text-muted-foreground">Loading your island...</div>;
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Palmtree className="h-7 w-7" />
            My Island
          </h1>
          <p className="text-muted-foreground">
            Welcome, {profile.name ?? "Captain"}. Your island is not yet assigned — your current
            role does not reference a portfolio company.
          </p>
        </div>
      </div>
    );
  }

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Palmtree className="h-7 w-7" />
            My Island
          </h1>
          <p className="text-muted-foreground">
            {company.name}. No governance cycle is currently open.
          </p>
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
            <Palmtree className="h-7 w-7" />
            My Island
          </h1>
          <p className="text-muted-foreground">{profile.name} · {profile.currentRole?.title ?? "CEO"}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="default">{company.name}</Badge>
            {company.businessType && <Badge variant="outline">{company.businessType}</Badge>}
            <Badge variant="secondary">Cycle: {activeCycle.month}</Badge>
            <Badge className={ragColor(null)}>{activeCycle.status}</Badge>
          </div>
        </div>
        <Button
          className="gap-2"
          onClick={submitMonth}
          disabled={upsertJournal.isPending || upsertAssessment.isPending || upsertReflection.isPending}
        >
          <Send className="h-4 w-4" />
          Submit Month
        </Button>
      </div>

      {/* Dimension cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Island Dimensions</h2>
        {dimensions.map((dim, idx) => {
          const draft = drafts[dim] ?? { logText: "", planText: "", score: null };
          const self = myAssessments?.find(
            (a) => a.dimensionKey === dim && a.feedbackTypeId === selfType?.id,
          );
          const chairman = assessmentsForCompany?.find(
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
                      Dimension {idx + 1}
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
                    <Label>What happened on this dimension this month</Label>
                    <Textarea
                      rows={5}
                      value={draft.logText}
                      onChange={(e) => updateDraft(dim, { logText: e.target.value })}
                      onBlur={() => saveJournal(dim)}
                      placeholder="Key events, decisions, progress..."
                    />
                  </TabsContent>

                  <TabsContent value="plan" className="space-y-3 pt-3">
                    <Label>What we'll focus on next month</Label>
                    <Textarea
                      rows={5}
                      value={draft.planText}
                      onChange={(e) => updateDraft(dim, { planText: e.target.value })}
                      onBlur={() => saveJournal(dim)}
                      placeholder="Specific commitments for the next cycle..."
                    />
                  </TabsContent>

                  <TabsContent value="rate" className="space-y-4 pt-3">
                    <div>
                      <Label className="mb-2 block">
                        How would I rate our performance on this dimension? ({draft.score ?? "—"}/10)
                      </Label>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[draft.score ?? 5]}
                        onValueChange={([v]) => updateDraft(dim, { score: v })}
                        onValueCommit={() => saveRating(dim)}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1 · At risk</span>
                        <span>5 · On plan</span>
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
                        {chairman?.note && <p className="text-sm whitespace-pre-wrap">{chairman.note}</p>}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Company Reflection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Company Reflection</CardTitle>
          <p className="text-sm text-muted-foreground">
            One line per item. Keep each bullet short — pattern over prose.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>What went well</Label>
            <Textarea
              rows={4}
              value={reflection.wentWell}
              onChange={(e) => setReflection((p) => ({ ...p, wentWell: e.target.value }))}
              onBlur={saveReflection}
              placeholder="2-3 bullets, one per line"
            />
          </div>
          <div>
            <Label>What didn't go well</Label>
            <Textarea
              rows={4}
              value={reflection.didntGoWell}
              onChange={(e) => setReflection((p) => ({ ...p, didntGoWell: e.target.value }))}
              onBlur={saveReflection}
              placeholder="2-3 bullets, one per line"
            />
          </div>
          <div>
            <Label>Key risks and concerns</Label>
            <Textarea
              rows={4}
              value={reflection.risks}
              onChange={(e) => setReflection((p) => ({ ...p, risks: e.target.value }))}
              onBlur={saveReflection}
              placeholder="What could derail the next quarter"
            />
          </div>
          <div>
            <Label>What I need from the fund</Label>
            <Textarea
              rows={4}
              value={reflection.needsFromFund}
              onChange={(e) => setReflection((p) => ({ ...p, needsFromFund: e.target.value }))}
              onBlur={saveReflection}
              placeholder="Asks to MD / Chairman / group functions"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Forward commitments (top 3 for next month)</Label>
            <Textarea
              rows={3}
              value={reflection.forwardCommitments}
              onChange={(e) =>
                setReflection((p) => ({ ...p, forwardCommitments: e.target.value }))
              }
              onBlur={saveReflection}
              placeholder="The three things I will ship by end of next cycle"
            />
          </div>
        </CardContent>
      </Card>

      <Separator />
      <div className="text-xs text-muted-foreground">
        Entries auto-save on blur. "Submit Month" stamps all dimensions + reflection as submitted
        for the {activeCycle.month} cycle.
      </div>
    </div>
  );
}
