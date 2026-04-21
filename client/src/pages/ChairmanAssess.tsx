import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Lock, Send, Ship } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;
// Shared with /my-island — keep in sync
const DEFAULT_COMPANY_DIMENSIONS = [
  "Revenue Growth",
  "Margin & Profitability",
  "Operations & Delivery",
  "Team & Culture",
  "Customer & Market",
  "Risk & Governance",
];

type Rating = { score: number | null; note: string };

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

export default function ChairmanAssess() {
  const { data: amIChairman } = trpc.governance.amIChairman.useQuery({ tenantId: TENANT_ID });
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });
  const { data: feedbackTypes } = trpc.governance.listFeedbackTypes.useQuery({ tenantId: TENANT_ID });
  const { data: roles } = trpc.governance.listRoles.useQuery({ tenantId: TENANT_ID });
  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: TENANT_ID });
  const { data: persons } = trpc.person.list.useQuery({ tenantId: TENANT_ID });

  const cycleId = activeCycle?.id ?? 0;
  const chairmanType = feedbackTypes?.find((t) => t.key === "chairman");

  // Filter to CXO-type roles and portfolio companies as the rateable universe
  const cxoRoles = useMemo(
    () => (roles ?? []).filter((r) => r.roleType === "CXO" || r.roleType === "GROUP_CEO" || r.roleType === "GROUP_CHRO"),
    [roles],
  );
  const companies = useMemo(() => (orgUnits ?? []).filter((u) => u.type === "PORTFOLIO_COMPANY"), [orgUnits]);
  const ceoRoles = useMemo(() => (roles ?? []).filter((r) => r.roleType === "CEO"), [roles]);

  type TargetOption = {
    kind: "ROLE" | "COMPANY";
    id: number;
    label: string;
    sub: string;
    dimensions: string[];
  };

  const targets = useMemo<TargetOption[]>(() => {
    const roleOptions: TargetOption[] = cxoRoles.map((r) => {
      const person = persons?.find((p) => p.currentRoleId === r.id);
      return {
        kind: "ROLE",
        id: r.id,
        label: r.title,
        sub: person ? person.name : "—",
        dimensions: (r.successMetrics ?? []) as string[],
      };
    });
    const ceoOptions: TargetOption[] = ceoRoles.map((r) => {
      const person = persons?.find((p) => p.currentRoleId === r.id);
      return {
        kind: "ROLE",
        id: r.id,
        label: r.title,
        sub: person ? person.name : "—",
        dimensions: (r.successMetrics ?? []) as string[],
      };
    });
    const companyOptions: TargetOption[] = companies.map((c) => ({
      kind: "COMPANY",
      id: c.id,
      label: c.name,
      sub: c.businessType ?? "",
      dimensions: DEFAULT_COMPANY_DIMENSIONS,
    }));
    return [...roleOptions, ...ceoOptions, ...companyOptions];
  }, [cxoRoles, ceoRoles, companies, persons]);

  const [targetKey, setTargetKey] = useState<string>("");
  const activeTarget = useMemo(
    () => targets.find((t) => `${t.kind}:${t.id}` === targetKey),
    [targets, targetKey],
  );

  // Fetch existing chairman assessments for this target so the form rehydrates
  // IMPORTANT: this fetches ALL assessments for the target (self + chairman).
  // We filter to only chairmanType client-side so that the Chairman cannot
  // accidentally see the self-rating via this page. Self rows are dropped.
  const { data: existing, refetch: refetchExisting } =
    trpc.governance.getAssessmentsForTarget.useQuery(
      {
        tenantId: TENANT_ID,
        cycleId,
        targetType: (activeTarget?.kind ?? "ROLE") as "ROLE" | "COMPANY",
        targetId: activeTarget?.id ?? 0,
      },
      { enabled: !!activeTarget && cycleId > 0 },
    );

  // Only our own chairman-type rows — self-ratings ignored entirely
  const chairmanExisting = useMemo(
    () => (existing ?? []).filter((a) => chairmanType && a.feedbackTypeId === chairmanType.id),
    [existing, chairmanType?.id],
  );

  const upsertAssessment = trpc.governance.upsertAssessment.useMutation({
    onSuccess: () => refetchExisting(),
    onError: (e) => toast.error(e.message),
  });

  const [ratings, setRatings] = useState<Record<string, Rating>>({});

  useEffect(() => {
    if (!activeTarget) return;
    const next: Record<string, Rating> = {};
    for (const dim of activeTarget.dimensions) {
      const row = chairmanExisting.find((a) => a.dimensionKey === dim);
      next[dim] = {
        score: row?.score ?? null,
        note: row?.note ?? "",
      };
    }
    setRatings(next);
  }, [activeTarget?.id, activeTarget?.kind, chairmanExisting]);

  const saveOne = (dim: string, submit = false) => {
    if (!activeTarget || !cycleId || !chairmanType) return;
    const r = ratings[dim];
    if (!r) return;
    upsertAssessment.mutate({
      tenantId: TENANT_ID,
      cycleId,
      targetType: activeTarget.kind,
      targetId: activeTarget.id,
      dimensionKey: dim,
      feedbackTypeId: chairmanType.id,
      score: r.score,
      rag: ragFromScore(r.score),
      note: r.note || null,
      confidenceNote: null,
      submit,
    });
  };

  const submitAll = () => {
    if (!activeTarget) return;
    for (const dim of activeTarget.dimensions) saveOne(dim, true);
    toast.success(`Submitted Chairman assessment for ${activeTarget.label}.`);
  };

  // Guard: while the permission query is loading, show nothing destructive.
  if (amIChairman === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  // Guard: non-Chairman users see a lock screen
  if (amIChairman === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Ship className="h-7 w-7" />
            Chairman Assessment
          </h1>
        </div>
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <Lock className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="font-medium">Not authorised</div>
              <p className="text-sm text-muted-foreground">
                Only the Chairman or an Admin can submit chairman-type assessments.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Ship className="h-7 w-7" />
          Chairman Assessment
        </h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No cycle is currently open. Open one from the Chairman dashboard before assessing.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Ship className="h-7 w-7" />
            Chairman Assessment
          </h1>
          <p className="text-muted-foreground">
            Rate each CXO, CEO, and portfolio company for the {activeCycle.month} cycle. Self-ratings
            are hidden here by design — your view stays independent.
          </p>
        </div>
        {activeTarget && (
          <Button className="gap-2" onClick={submitAll} disabled={upsertAssessment.isPending}>
            <Send className="h-4 w-4" />
            Submit {activeTarget.label}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Who are you rating?</Label>
          <Select value={targetKey} onValueChange={setTargetKey}>
            <SelectTrigger className="max-w-xl">
              <SelectValue placeholder="Pick a CXO role, CEO role, or portfolio company" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((t) => (
                <SelectItem key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>
                  [{t.kind}] {t.label}
                  {t.sub ? ` · ${t.sub}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {activeTarget && activeTarget.dimensions.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {activeTarget.label} has no dimensions configured (successMetrics is empty). Ask an admin
            to populate mandates before rating.
          </CardContent>
        </Card>
      )}

      {activeTarget && activeTarget.dimensions.length > 0 && (
        <div className="space-y-3">
          {activeTarget.dimensions.map((dim, idx) => {
            const r = ratings[dim] ?? { score: null, note: "" };
            const rag = ragFromScore(r.score);
            const row = chairmanExisting.find((a) => a.dimensionKey === dim);
            return (
              <Card key={dim}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Dimension {idx + 1}
                      </div>
                      <CardTitle className="text-lg leading-tight">{dim}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={ragColor(rag)}>
                        {r.score == null ? "Unrated" : `${r.score}/10 · ${rag}`}
                      </Badge>
                      {row?.submittedAt && <Badge variant="outline">Submitted</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Score ({r.score ?? "—"}/10)</Label>
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[r.score ?? 5]}
                      onValueChange={([v]) => setRatings((p) => ({ ...p, [dim]: { ...r, score: v } }))}
                      onValueCommit={() => saveOne(dim)}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>1 · Struggling</span>
                      <span>5 · On track</span>
                      <span>10 · Exceeding</span>
                    </div>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <Compass className="h-3 w-3" /> Note
                    </Label>
                    <Textarea
                      rows={3}
                      value={r.note}
                      onChange={(e) =>
                        setRatings((p) => ({ ...p, [dim]: { ...r, note: e.target.value } }))
                      }
                      onBlur={() => saveOne(dim)}
                      placeholder="One paragraph on what I'm seeing and why (becomes visible after reveal)"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Separator />
      <div className="text-xs text-muted-foreground">
        Slider saves on release; notes save on blur. Submit stamps each dimension as committed and
        triggers gap calculation visible on the target's bridge or island.
      </div>
    </div>
  );
}
