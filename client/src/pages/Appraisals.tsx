import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList, Search, Users, TrendingUp, AlertCircle, CheckCircle2, Clock, ArrowRight, Download } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  FINAL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  IN_PROGRESS: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DRAFT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  NOT_STARTED: "bg-muted text-muted-foreground border-border",
};

const QUADRANT_COLORS: Record<string, string> = {
  STAR: "bg-yellow-500/20 text-yellow-400",
  HIGH_POTENTIAL: "bg-purple-500/20 text-purple-400",
  NEEDS_DEVELOPMENT: "bg-orange-500/20 text-orange-400",
  BRILLIANT_JERK: "bg-red-500/20 text-red-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.NOT_STARTED;
  const icons: Record<string, React.ReactNode> = {
    FINAL: <CheckCircle2 className="h-3 w-3" />,
    IN_PROGRESS: <Clock className="h-3 w-3" />,
    DRAFT: <AlertCircle className="h-3 w-3" />,
    NOT_STARTED: <AlertCircle className="h-3 w-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      {icons[status] ?? icons.NOT_STARTED}
      {status.replace(/_/g, " ")}
    </span>
  );
}

function AppraisalExportButton({ appraisalId }: { appraisalId: number }) {
  const exportDocxMutation = trpc.appraisal.pace.exportDocx.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PACE document downloaded");
    },
    onError: (e) => toast.error("Export failed: " + e.message),
  });
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={(e) => { e.stopPropagation(); exportDocxMutation.mutate({ id: appraisalId }); }}
      disabled={exportDocxMutation.isPending}
    >
      {exportDocxMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
    </Button>
  );
}

export default function Appraisals() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterFY, setFilterFY] = useState("2026");

  const { data, isLoading } = trpc.appraisal.pace.listAll.useQuery({ fiscalYear: filterFY || undefined });

  const rows = data ?? [];

  // Compute stats
  const total = rows.length;
  const finalCount = rows.filter(r => r.latestAppraisal?.status === "FINAL").length;
  const inProgressCount = rows.filter(r => r.latestAppraisal?.status && r.latestAppraisal.status !== "FINAL").length;
  const notStartedCount = rows.filter(r => !r.latestAppraisal).length;

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.person.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.role?.title ?? "").toLowerCase().includes(search.toLowerCase());
    const status = r.latestAppraisal?.status ?? "NOT_STARTED";
    const matchStatus = filterStatus === "ALL" || status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-bold text-lg">PACE Appraisals</h1>
              <p className="text-xs text-muted-foreground">FY {filterFY} · {total} people</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/people")}>
            ← Back to People
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: total, icon: (<Users className="h-4 w-4" />) as React.ReactNode, color: "text-foreground" },
            { label: "Finalised", value: finalCount, icon: (<CheckCircle2 className="h-4 w-4" />) as React.ReactNode, color: "text-emerald-400" },
            { label: "In Progress", value: inProgressCount, icon: (<Clock className="h-4 w-4" />) as React.ReactNode, color: "text-amber-400" },
            { label: "Not Started", value: notStartedCount, icon: (<AlertCircle className="h-4 w-4" />) as React.ReactNode, color: "text-muted-foreground" },
          ].map(s => (
            <Card key={s.label} className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress bar */}
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Completion Progress</span>
              <span className="text-sm text-muted-foreground">{total > 0 ? Math.round((finalCount / total) * 100) : 0}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: total > 0 ? `${(finalCount / total) * 100}%` : "0%" }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Finalised</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />In Progress</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground inline-block" />Not Started</span>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or role..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="FINAL">Finalised</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterFY} onValueChange={setFilterFY}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              {["2026", "2025", "2024"].map(fy => (
                <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No results found</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map(({ person, role, latestAppraisal }) => {
                  const pd = latestAppraisal?.paceData as any;
                  const status = latestAppraisal?.status ?? "NOT_STARTED";
                  const quadrant = pd?.quadrant;
                  return (
                    <div
                      key={person.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/people/${person.id}`)}
                    >
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-accent">
                          {person.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>

                      {/* Name + Role */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{person.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{role?.title ?? "No active role"}</p>
                      </div>

                      {/* Quadrant */}
                      {quadrant ? (
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 hidden sm:inline-flex ${QUADRANT_COLORS[quadrant] ?? ""}`}
                        >
                          {quadrant.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">—</span>
                      )}

                      {/* Fiscal Year */}
                      {latestAppraisal?.fiscalYear && (
                        <span className="text-xs text-muted-foreground shrink-0 hidden md:inline">
                          FY {latestAppraisal.fiscalYear}
                        </span>
                      )}

                      {/* Status */}
                      <div className="shrink-0">
                        <StatusBadge status={status} />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {latestAppraisal?.id && <AppraisalExportButton appraisalId={latestAppraisal.id} />}
                        <Button
                          size="sm"
                          variant={status === "NOT_STARTED" ? "default" : "outline"}
                          className="h-7 px-2 text-xs"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/people/${person.id}`); }}
                        >
                          {status === "NOT_STARTED" ? "Start" : "Open"}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
