import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, AlertTriangle, Anchor, Brain, Link2, RotateCw, Ship, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

// Zone assignment based on roleType
const ZONE_FOR_ROLE_TYPE: Record<string, "HULL" | "DECK" | "MAST"> = {
  CHAIRMAN: "MAST",
  GROUP_CEO: "MAST",
  GROUP_CHRO: "MAST",
  CEO: "DECK",
  CXO: "HULL",
  CXO_PLUS_ONE: "DECK",
  CHRO: "DECK",
  BOARD_MEMBER: "MAST",
};

function zoneColor(zone: "HULL" | "DECK" | "MAST") {
  if (zone === "HULL") return "bg-red-500/15 text-red-700 border-red-500/30";
  if (zone === "DECK") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
}

function gapBand(gap: number): "RED" | "AMBER" | "GREEN" {
  if (gap >= 3) return "RED";
  if (gap >= 2) return "AMBER";
  return "GREEN";
}

function bandColor(band: "RED" | "AMBER" | "GREEN") {
  if (band === "RED") return "bg-red-500/15 text-red-700 border-red-500/30";
  if (band === "AMBER") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
}

export default function ChairmanDashboard() {
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });
  const { data: cycles } = trpc.governance.listCycles.useQuery({ tenantId: TENANT_ID });
  const { data: feedbackTypes } = trpc.governance.listFeedbackTypes.useQuery({ tenantId: TENANT_ID });
  const { data: persons } = trpc.person.list.useQuery({ tenantId: TENANT_ID });
  const { data: roles } = trpc.governance.listRoles.useQuery({ tenantId: TENANT_ID });
  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: TENANT_ID });
  const { data: chains } = trpc.governance.listChains.useQuery({ tenantId: TENANT_ID });

  const cycleId = activeCycle?.id ?? 0;

  const { data: assessments } = trpc.governance.listAssessments.useQuery(
    { tenantId: TENANT_ID, cycleId },
    { enabled: cycleId > 0 },
  );
  const { data: assignments } = trpc.governance.listAssignments.useQuery(
    { tenantId: TENANT_ID, cycleId },
    { enabled: cycleId > 0 },
  );
  const { data: reflections } = trpc.governance.listReflections.useQuery(
    { tenantId: TENANT_ID, cycleId },
    { enabled: cycleId > 0 },
  );
  const { data: insights } = trpc.governance.listInsights.useQuery(
    { tenantId: TENANT_ID, cycleId },
    { enabled: cycleId > 0 },
  );

  const updateCycleStatus = trpc.governance.updateCycleStatus.useMutation({
    onSuccess: () => toast.success("Cycle status updated"),
    onError: (e) => toast.error(e.message),
  });

  const runCommitmentTracker = trpc.governance.runCommitmentTracker.useMutation({
    onSuccess: (res) => toast.success(`Commitment tracker: scanned ${res.scanned}, updated ${res.updated}`),
    onError: (e) => toast.error(e.message),
  });

  const runInsightGeneration = trpc.governance.runInsightGeneration.useMutation({
    onSuccess: (res) =>
      toast.success(
        `Insights: ${res.total} (perception ${res.perception}, commitment ${res.commitment}, engagement ${res.engagement}, chain ${res.chain}, financial ${res.financial})`,
      ),
    onError: (e) => toast.error(e.message),
  });

  const { data: chronicDeferrals } = trpc.governance.listChronicDeferrals.useQuery(
    { tenantId: TENANT_ID, lookbackCycles: 3 },
    { enabled: !!activeCycle },
  );

  const selfType = feedbackTypes?.find((t) => t.key === "self");
  const chairmanType = feedbackTypes?.find((t) => t.key === "chairman");

  // Derive perception gaps
  const gaps = useMemo(() => {
    if (!assessments || !selfType || !chairmanType) return [];
    const byKey = new Map<string, { self?: typeof assessments[0]; chairman?: typeof assessments[0] }>();
    for (const a of assessments) {
      if (a.feedbackTypeId !== selfType.id && a.feedbackTypeId !== chairmanType.id) continue;
      const key = `${a.targetType}:${a.targetId}:${a.dimensionKey}`;
      const entry = byKey.get(key) ?? {};
      if (a.feedbackTypeId === selfType.id) entry.self = a;
      else entry.chairman = a;
      byKey.set(key, entry);
    }
    const out: Array<{
      targetType: string;
      targetId: number;
      dimensionKey: string;
      selfScore: number;
      chairmanScore: number;
      gap: number;
    }> = [];
    for (const [, v] of byKey) {
      if (v.self?.score != null && v.chairman?.score != null) {
        out.push({
          targetType: v.self.targetType,
          targetId: v.self.targetId,
          dimensionKey: v.self.dimensionKey,
          selfScore: v.self.score,
          chairmanScore: v.chairman.score,
          gap: Math.abs(v.chairman.score - v.self.score),
        });
      }
    }
    return out.sort((a, b) => b.gap - a.gap);
  }, [assessments, selfType?.id, chairmanType?.id]);

  // Zone health: average chairman score per zone
  const zoneHealth = useMemo(() => {
    if (!assessments || !chairmanType || !roles) return null;
    const byZone: Record<"HULL" | "DECK" | "MAST", number[]> = { HULL: [], DECK: [], MAST: [] };
    for (const a of assessments) {
      if (a.feedbackTypeId !== chairmanType.id) continue;
      if (a.targetType !== "ROLE" || a.score == null) continue;
      const role = roles.find((r) => r.id === a.targetId);
      if (!role) continue;
      const zone = ZONE_FOR_ROLE_TYPE[role.roleType];
      if (zone) byZone[zone].push(a.score);
    }
    const avg = (arr: number[]) => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length);
    return {
      hull: avg(byZone.HULL),
      deck: avg(byZone.DECK),
      mast: avg(byZone.MAST),
    };
  }, [assessments, chairmanType?.id, roles]);

  const fundVitality = useMemo(() => {
    if (!zoneHealth) return null;
    const parts = [zoneHealth.hull, zoneHealth.deck, zoneHealth.mast].filter((x): x is number => x != null);
    if (parts.length === 0) return null;
    return parts.reduce((a, b) => a + b, 0) / parts.length;
  }, [zoneHealth]);

  // Assignment status summary
  const submissionStatus = useMemo(() => {
    if (!assignments) return { pending: 0, submitted: 0, total: 0 };
    const submitted = assignments.filter((a) => a.status === "SUBMITTED").length;
    return {
      pending: assignments.length - submitted,
      submitted,
      total: assignments.length,
    };
  }, [assignments]);

  // Chain health: weakest link per chain (lowest avg chairman score across member roles)
  const chainHealth = useMemo(() => {
    if (!chains || !roles || !assessments || !chairmanType) return [];
    return chains.map((chain) => {
      const memberRoleIds = chain.nodeRoleIds ?? [];
      const scores: number[] = [];
      for (const roleId of memberRoleIds) {
        const roleScores = assessments
          .filter(
            (a) =>
              a.feedbackTypeId === chairmanType.id &&
              a.targetType === "ROLE" &&
              a.targetId === roleId &&
              a.score != null,
          )
          .map((a) => a.score as number);
        if (roleScores.length > 0) {
          scores.push(roleScores.reduce((x, y) => x + y, 0) / roleScores.length);
        }
      }
      const weakest = scores.length === 0 ? null : Math.min(...scores);
      const avg = scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
      return { chain, weakest, avg, memberCount: memberRoleIds.length };
    });
  }, [chains, roles, assessments, chairmanType?.id]);

  const personName = (id: number) => persons?.find((p) => p.id === id)?.name ?? `Person #${id}`;
  const targetLabel = (type: string, id: number) => {
    if (type === "ROLE") {
      const role = roles?.find((r) => r.id === id);
      if (!role) return `Role #${id}`;
      const person = persons?.find((p) => p.currentRoleId === role.id);
      return `${role.title}${person ? ` · ${person.name}` : ""}`;
    }
    if (type === "COMPANY") {
      return orgUnits?.find((u) => u.id === id)?.name ?? `Company #${id}`;
    }
    return `${type} #${id}`;
  };

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Ship className="h-7 w-7" />
            Chairman's Dashboard
          </h1>
          <p className="text-muted-foreground">
            No governance cycle is currently open. Open the next cycle to start.
          </p>
        </div>

        {cycles && cycles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Cycles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cycles.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{c.month}</div>
                    <div className="text-xs text-muted-foreground">{c.status}</div>
                  </div>
                  {c.status === "DRAFT" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        updateCycleStatus.mutate({ cycleId: c.id, tenantId: TENANT_ID, status: "OPEN" })
                      }
                    >
                      Open Cycle
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Ship className="h-7 w-7" />
            Chairman's Dashboard
          </h1>
          <p className="text-muted-foreground">Fleet-wide view for the {activeCycle.month} cycle.</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">Cycle: {activeCycle.month}</Badge>
            <Badge>{activeCycle.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => runCommitmentTracker.mutate({ tenantId: TENANT_ID, cycleId: activeCycle.id })}
            disabled={runCommitmentTracker.isPending}
          >
            <RotateCw className={runCommitmentTracker.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Run Commitment Tracker
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => runInsightGeneration.mutate({ tenantId: TENANT_ID, cycleId: activeCycle.id })}
            disabled={runInsightGeneration.isPending}
          >
            <Brain className={runInsightGeneration.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Generate Insights
          </Button>
          {activeCycle.status === "OPEN" && (
            <Button
              variant="outline"
              onClick={() =>
                updateCycleStatus.mutate({
                  cycleId: activeCycle.id,
                  tenantId: TENANT_ID,
                  status: "CLOSED",
                })
              }
            >
              Close Cycle
            </Button>
          )}
          {activeCycle.status === "CLOSED" && (
            <Button
              onClick={() =>
                updateCycleStatus.mutate({
                  cycleId: activeCycle.id,
                  tenantId: TENANT_ID,
                  status: "REVEALED",
                })
              }
            >
              Reveal Scores
            </Button>
          )}
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Fund Vitality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {fundVitality === null ? "—" : fundVitality.toFixed(1)}
              <span className="text-base text-muted-foreground font-normal">/10</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {submissionStatus.submitted}
              <span className="text-base text-muted-foreground font-normal">/{submissionStatus.total}</span>
            </div>
            <Progress
              className="mt-2"
              value={
                submissionStatus.total > 0
                  ? (submissionStatus.submitted / submissionStatus.total) * 100
                  : 0
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Perception Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{gaps.filter((g) => g.gap >= 2).length}</div>
            <p className="text-xs text-muted-foreground">≥ 2 point gap</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Reflections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{reflections?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">CEO submissions this cycle</p>
          </CardContent>
        </Card>
      </div>

      {/* Zone Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Anchor className="h-4 w-4" />
            Zone Health
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["HULL", "DECK", "MAST"] as const).map((zone) => {
            const score =
              zone === "HULL"
                ? zoneHealth?.hull
                : zone === "DECK"
                  ? zoneHealth?.deck
                  : zoneHealth?.mast;
            const label =
              zone === "HULL" ? "Hull (Critical)" : zone === "DECK" ? "Deck (Operational)" : "Mast (Strategic)";
            return (
              <div key={zone} className="rounded-md border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Badge className={zoneColor(zone)}>{zone}</Badge>
                </div>
                <div className="text-2xl font-bold">
                  {score == null ? "—" : `${score.toFixed(1)}/10`}
                </div>
                <Progress className="mt-2" value={score == null ? 0 : score * 10} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perception Gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Top Perception Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gaps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No perception gaps calculated yet. Gaps appear after both self and chairman assessments are submitted for the same target.
              </p>
            )}
            {gaps.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target · Dimension</TableHead>
                    <TableHead className="text-right">Self</TableHead>
                    <TableHead className="text-right">Chairman</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gaps.slice(0, 5).map((g, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {targetLabel(g.targetType, g.targetId)}
                        </div>
                        <div className="text-xs text-muted-foreground">{g.dimensionKey}</div>
                      </TableCell>
                      <TableCell className="text-right">{g.selfScore}</TableCell>
                      <TableCell className="text-right">{g.chairmanScore}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={bandColor(gapBand(g.gap))}>{g.gap}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Chain Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Chain Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!chains || chains.length === 0) && (
              <p className="text-sm text-muted-foreground">No dependency chains defined yet.</p>
            )}
            {chainHealth.map(({ chain, weakest, avg, memberCount }) => (
              <div
                key={chain.id}
                className="flex items-center justify-between rounded-md border p-3"
                style={{ borderLeft: `4px solid ${chain.color}` }}
              >
                <div>
                  <div className="font-medium text-sm">{chain.name}</div>
                  <div className="text-xs text-muted-foreground">{memberCount} roles</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {avg == null ? "—" : `avg ${avg.toFixed(1)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {weakest == null ? "" : `weakest ${weakest.toFixed(1)}`}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Pending Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {(!assignments || assignments.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No assignments recorded for this cycle. Seed or generate assignments to track who owes what.
            </p>
          )}
          {assignments && assignments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.slice(0, 20).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{personName(a.assessorPersonId)}</TableCell>
                    <TableCell className="text-sm">{targetLabel(a.targetType, a.targetId)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={a.status === "SUBMITTED" ? "default" : a.status === "OVERDUE" ? "destructive" : "secondary"}
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reflections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CEO Company Reflections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!reflections || reflections.length === 0) && (
            <p className="text-sm text-muted-foreground">No company reflections submitted yet this cycle.</p>
          )}
          {reflections?.map((r) => {
            const company = orgUnits?.find((u) => u.id === r.orgUnitId);
            return (
              <div key={r.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{company?.name ?? `Company #${r.orgUnitId}`}</div>
                  <Badge variant="outline">{personName(r.ceoPersonId)}</Badge>
                </div>
                {(r.risks ?? []).length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Risks</div>
                    <ul className="text-sm list-disc list-inside">
                      {(r.risks ?? []).slice(0, 3).map((risk, i) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(r.needsFromFund ?? []).length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Needs from fund</div>
                    <ul className="text-sm list-disc list-inside">
                      {(r.needsFromFund ?? []).slice(0, 3).map((need, i) => (
                        <li key={i}>{need}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Chronic Deferrals */}
      {chronicDeferrals && chronicDeferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Chronic Deferrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Mandate</TableHead>
                  <TableHead>Commitment</TableHead>
                  <TableHead className="text-right">Cycles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chronicDeferrals.slice(0, 15).map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{c.personName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.dimensionKey}</TableCell>
                    <TableCell className="text-sm">{c.item}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{c.cycleIds.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3">
              Items that have appeared on a plan across 3+ consecutive cycles without completion.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.slice(0, 10).map((i) => (
              <div key={i.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge
                    variant={
                      i.severity === "CRITICAL" ? "destructive" : i.severity === "WARNING" ? "secondary" : "outline"
                    }
                  >
                    {i.insightType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(i.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">{i.insightText}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />
      <div className="text-xs text-muted-foreground">
        Dashboard reads live from the active cycle. Close the cycle to lock submissions, then reveal to
        unlock perception gap comparisons for CXOs and CEOs.
      </div>
    </div>
  );
}
