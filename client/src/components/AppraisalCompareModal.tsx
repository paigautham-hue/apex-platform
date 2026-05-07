import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, TrendingUp, TrendingDown, Minus, GitCompare } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PaceAppraisal {
  id: number;
  fiscalYear: string | null;
  status: string | null;
  aiSynthesisSummary: string | null;
  paceData: unknown;
  createdAt: Date | number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  personName: string;
  appraisals: PaceAppraisal[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const QUADRANT_ORDER = ["STAR", "HIGH_POTENTIAL", "NEEDS_DEVELOPMENT", "BRILLIANT_JERK"];

const QUADRANT_STYLE: Record<string, string> = {
  STAR: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  HIGH_POTENTIAL: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  NEEDS_DEVELOPMENT: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  BRILLIANT_JERK: "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_STYLE: Record<string, string> = {
  FINAL: "bg-emerald-500/20 text-emerald-400",
  IN_PROGRESS: "bg-amber-500/20 text-amber-400",
  DRAFT: "bg-blue-500/20 text-blue-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function quadrantDelta(from: string | undefined, to: string | undefined) {
  if (!from || !to || from === to) return null;
  const fi = QUADRANT_ORDER.indexOf(from);
  const ti = QUADRANT_ORDER.indexOf(to);
  if (fi === -1 || ti === -1) return null;
  return ti < fi ? "up" : "down"; // lower index = better quadrant
}

function DeltaIcon({ direction }: { direction: "up" | "down" | null }) {
  if (!direction) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (direction === "up") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  return <TrendingDown className="h-4 w-4 text-red-400" />;
}

function QuadrantBadge({ q }: { q: string | undefined }) {
  if (!q) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${QUADRANT_STYLE[q] ?? "bg-muted text-muted-foreground"}`}>
      {q.replace(/_/g, " ")}
    </span>
  );
}

// ─── KPI Row Comparison ───────────────────────────────────────────────────────
function KpiCompareRow({
  label,
  weightage,
  leftComment,
  rightComment,
}: {
  label: string;
  weightage?: string;
  leftComment?: string;
  rightComment?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 py-3 border-b last:border-0">
      {/* Left */}
      <div className="text-sm text-muted-foreground italic">
        {leftComment ?? <span className="opacity-40">No comment</span>}
      </div>
      {/* Centre label */}
      <div className="flex flex-col items-center gap-1 min-w-[120px] px-2">
        <p className="text-xs font-semibold text-center leading-tight">{label}</p>
        {weightage && <span className="text-xs text-muted-foreground">{weightage}</span>}
      </div>
      {/* Right */}
      <div className="text-sm text-muted-foreground italic text-right">
        {rightComment ?? <span className="opacity-40">No comment</span>}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function AppraisalCompareModal({ open, onClose, personName, appraisals }: Props) {
  const sortedAppraisals = [...appraisals].sort((a, b) => {
    const fy = (x: PaceAppraisal) => parseInt(x.fiscalYear ?? "0", 10);
    return fy(b) - fy(a);
  });

  const [leftId, setLeftId] = useState<string>(() =>
    sortedAppraisals.length >= 2 ? String(sortedAppraisals[1].id) : String(sortedAppraisals[0]?.id ?? "")
  );
  const [rightId, setRightId] = useState<string>(() =>
    sortedAppraisals.length >= 1 ? String(sortedAppraisals[0].id) : ""
  );

  const leftAppraisal = appraisals.find(a => String(a.id) === leftId);
  const rightAppraisal = appraisals.find(a => String(a.id) === rightId);

  const leftPd = leftAppraisal?.paceData as any;
  const rightPd = rightAppraisal?.paceData as any;

  const leftQuadrant: string | undefined = leftPd?.quadrant;
  const rightQuadrant: string | undefined = rightPd?.quadrant;
  const delta = quadrantDelta(leftQuadrant, rightQuadrant);

  // Build merged KPI list
  const leftKpis: any[] = leftPd?.kpiRows ?? [];
  const rightKpis: any[] = rightPd?.kpiRows ?? [];
  const maxKpis = Math.max(leftKpis.length, rightKpis.length);
  const kpiRows = Array.from({ length: maxKpis }, (_, i) => ({
    left: leftKpis[i],
    right: rightKpis[i],
    label: leftKpis[i]?.goalName ?? rightKpis[i]?.goalName ?? `KPI ${i + 1}`,
    weightage: leftKpis[i]?.weightage ?? rightKpis[i]?.weightage,
  }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GitCompare className="h-5 w-5 text-accent" />
            Appraisal Comparison — {personName}
          </DialogTitle>
          {/* Year selectors */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {sortedAppraisals.map(a => (
                  <SelectItem key={a.id} value={String(a.id)} disabled={String(a.id) === rightId}>
                    FY {a.fiscalYear ?? "Unknown"} · {a.status ?? "DRAFT"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {sortedAppraisals.map(a => (
                  <SelectItem key={a.id} value={String(a.id)} disabled={String(a.id) === leftId}>
                    FY {a.fiscalYear ?? "Unknown"} · {a.status ?? "DRAFT"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          {/* ── Quadrant Movement ── */}
          <div className="rounded-xl border bg-card/50 p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Quadrant Movement</p>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">FY {leftAppraisal?.fiscalYear ?? "—"}</span>
                <QuadrantBadge q={leftQuadrant} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <DeltaIcon direction={delta} />
                {delta === "up" && <span className="text-xs text-emerald-400 font-medium">Improved</span>}
                {delta === "down" && <span className="text-xs text-red-400 font-medium">Declined</span>}
                {!delta && <span className="text-xs text-muted-foreground">No change</span>}
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">FY {rightAppraisal?.fiscalYear ?? "—"}</span>
                <QuadrantBadge q={rightQuadrant} />
              </div>
            </div>
          </div>

          {/* ── Fit Determination ── */}
          {(leftPd?.fitDetermination || rightPd?.fitDetermination) && (
            <div className="rounded-xl border bg-card/50 p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fit Determination</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">FY {leftAppraisal?.fiscalYear ?? "—"}</p>
                  <p className="text-sm font-medium">{leftPd?.fitDetermination ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">FY {rightAppraisal?.fiscalYear ?? "—"}</p>
                  <p className="text-sm font-medium">{rightPd?.fitDetermination ?? "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Overall Comments ── */}
          {(leftPd?.appraiserOverallComments || rightPd?.appraiserOverallComments) && (
            <div className="rounded-xl border bg-card/50 p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Overall Appraiser Comments</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">FY {leftAppraisal?.fiscalYear ?? "—"}</p>
                  <p className="text-sm leading-relaxed">{leftPd?.appraiserOverallComments ?? <span className="text-muted-foreground italic">No comment</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">FY {rightAppraisal?.fiscalYear ?? "—"}</p>
                  <p className="text-sm leading-relaxed">{rightPd?.appraiserOverallComments ?? <span className="text-muted-foreground italic">No comment</span>}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── KPI-by-KPI Comparison ── */}
          {kpiRows.length > 0 && (
            <div className="rounded-xl border bg-card/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KPI Assessment</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>← FY {leftAppraisal?.fiscalYear ?? "—"}</span>
                  <span>FY {rightAppraisal?.fiscalYear ?? "—"} →</span>
                </div>
              </div>
              <div>
                {kpiRows.map((row, i) => (
                  <KpiCompareRow
                    key={i}
                    label={row.label}
                    weightage={row.weightage}
                    leftComment={row.left?.appraiserComments}
                    rightComment={row.right?.appraiserComments}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── AI Summary ── */}
          {(leftAppraisal?.aiSynthesisSummary || rightAppraisal?.aiSynthesisSummary) && (
            <div className="rounded-xl border bg-card/50 p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">AI Synthesis Summary</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">FY {leftAppraisal?.fiscalYear ?? "—"}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground italic">
                    {leftAppraisal?.aiSynthesisSummary ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">FY {rightAppraisal?.fiscalYear ?? "—"}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground italic">
                    {rightAppraisal?.aiSynthesisSummary ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!leftAppraisal && !rightAppraisal && (
            <div className="text-center py-12 text-muted-foreground">
              Select two appraisals to compare
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
