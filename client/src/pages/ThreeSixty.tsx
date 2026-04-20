import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Eye, EyeOff, Users } from "lucide-react";
import { useMemo, useState } from "react";

const TENANT_ID = 1;
const DEFAULT_COMPANY_DIMENSIONS = [
  "Revenue Growth",
  "Margin & Profitability",
  "Operations & Delivery",
  "Team & Culture",
  "Customer & Market",
  "Risk & Governance",
];

// Distinct hex colors for radar rings, in the oceanic palette
const TYPE_COLORS: Record<string, string> = {
  self: "#00D4AA",
  chairman: "#FFB800",
  md: "#A78BFA",
  peer: "#2ED573",
  upward: "#FFA502",
};
const FALLBACK_COLORS = ["#FF4757", "#FFA502", "#2ED573", "#A78BFA", "#00D4AA", "#FFB800"];

export default function ThreeSixty() {
  const { data: amIChairman } = trpc.governance.amIChairman.useQuery({ tenantId: TENANT_ID });
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });
  const { data: feedbackTypes } = trpc.governance.listAllFeedbackTypes.useQuery({ tenantId: TENANT_ID });
  const { data: roles } = trpc.governance.listRoles.useQuery({ tenantId: TENANT_ID });
  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: TENANT_ID });
  const { data: persons } = trpc.person.list.useQuery({ tenantId: TENANT_ID });

  const companies = useMemo(() => (orgUnits ?? []).filter((u) => u.type === "PORTFOLIO_COMPANY"), [orgUnits]);

  type TargetOption = {
    kind: "ROLE" | "COMPANY";
    id: number;
    label: string;
    sub: string;
    dimensions: string[];
  };

  const targets = useMemo<TargetOption[]>(() => {
    const roleOpts: TargetOption[] = (roles ?? [])
      .filter((r) => r.roleType !== "BOARD_MEMBER")
      .map((r) => {
        const holder = persons?.find((p) => p.currentRoleId === r.id);
        return {
          kind: "ROLE",
          id: r.id,
          label: r.title,
          sub: holder?.name ?? "—",
          dimensions: (r.successMetrics ?? []) as string[],
        };
      });
    const companyOpts: TargetOption[] = companies.map((c) => ({
      kind: "COMPANY",
      id: c.id,
      label: c.name,
      sub: c.businessType ?? "",
      dimensions: DEFAULT_COMPANY_DIMENSIONS,
    }));
    return [...roleOpts, ...companyOpts];
  }, [roles, companies, persons]);

  const [targetKey, setTargetKey] = useState<string>("");
  const active = useMemo(
    () => targets.find((t) => `${t.kind}:${t.id}` === targetKey),
    [targets, targetKey],
  );

  const cycleId = activeCycle?.id ?? 0;

  const { data: assessments } = trpc.governance.getAssessmentsForTarget.useQuery(
    {
      tenantId: TENANT_ID,
      cycleId,
      targetType: (active?.kind ?? "ROLE") as "ROLE" | "COMPANY",
      targetId: active?.id ?? 0,
    },
    { enabled: !!active && cycleId > 0 },
  );

  // Aggregate: for each feedbackTypeId, compute avg score per dimension.
  // Blind types show aggregate count only; named types list assessors.
  const aggregates = useMemo(() => {
    if (!assessments || !feedbackTypes || !active) return [];
    type Agg = {
      feedbackTypeId: number;
      key: string;
      label: string;
      isBlind: boolean;
      perDimension: Record<string, { sum: number; count: number }>;
      assessorCount: number;
      color: string;
    };
    const map = new Map<number, Agg>();

    for (const a of assessments) {
      if (a.score == null) continue;
      const type = feedbackTypes.find((t) => t.id === a.feedbackTypeId);
      if (!type) continue;
      let agg = map.get(a.feedbackTypeId);
      if (!agg) {
        agg = {
          feedbackTypeId: type.id,
          key: type.key,
          label: type.label,
          isBlind: !!type.isBlind,
          perDimension: {},
          assessorCount: 0,
          color: TYPE_COLORS[type.key] ?? FALLBACK_COLORS[map.size % FALLBACK_COLORS.length],
        };
        map.set(a.feedbackTypeId, agg);
      }
      const bucket = (agg.perDimension[a.dimensionKey] ??= { sum: 0, count: 0 });
      bucket.sum += a.score;
      bucket.count += 1;
    }

    // assessor count = distinct assessorPersonId per type
    for (const [typeId, agg] of map) {
      const distinct = new Set(
        assessments
          .filter((a) => a.feedbackTypeId === typeId && a.score != null)
          .map((a) => a.assessorPersonId),
      );
      agg.assessorCount = distinct.size;
    }

    return Array.from(map.values());
  }, [assessments, feedbackTypes, active]);

  // Radar chart data: one row per dimension, columns per feedback type.
  const radarData = useMemo(() => {
    if (!active) return [];
    return active.dimensions.map((dim) => {
      const row: Record<string, string | number> = { dimension: dim };
      for (const agg of aggregates) {
        const bucket = agg.perDimension[dim];
        row[agg.label] = bucket && bucket.count > 0 ? bucket.sum / bucket.count : 0;
      }
      return row;
    });
  }, [active, aggregates]);

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7" />
          360 Feedback
        </h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No governance cycle is currently open. 360 feedback activates with a cycle.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
          <Users className="h-7 w-7" />
          360 Feedback
        </h1>
        <p className="text-muted-foreground">
          Pick a target to see how self, chairman, peer, and upward perspectives compare across
          each dimension for the {activeCycle.month} cycle.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Who are we looking at?</Label>
          <Select value={targetKey} onValueChange={setTargetKey}>
            <SelectTrigger className="max-w-xl">
              <SelectValue placeholder="Pick a role or portfolio company" />
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

      {active && aggregates.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No assessments recorded for this target yet in the active cycle.
          </CardContent>
        </Card>
      )}

      {active && aggregates.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimension radar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[420px]">
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="currentColor" strokeOpacity={0.2} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: "currentColor", fontSize: 11 }} />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 10]}
                      tick={{ fill: "currentColor", fontSize: 10 }}
                      stroke="currentColor"
                      strokeOpacity={0.2}
                    />
                    <Tooltip />
                    <Legend />
                    {aggregates.map((agg) => (
                      <Radar
                        key={agg.feedbackTypeId}
                        name={agg.label}
                        dataKey={agg.label}
                        stroke={agg.color}
                        fill={agg.color}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By feedback type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dimensions rated</TableHead>
                    <TableHead>Avg score</TableHead>
                    <TableHead>Assessors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregates.map((agg) => {
                    const dims = Object.values(agg.perDimension).filter((d) => d.count > 0);
                    const totalSum = dims.reduce((s, d) => s + d.sum, 0);
                    const totalCount = dims.reduce((s, d) => s + d.count, 0);
                    const avg = totalCount > 0 ? totalSum / totalCount : null;
                    return (
                      <TableRow key={agg.feedbackTypeId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ background: agg.color }}
                            />
                            <span className="font-medium">{agg.label}</span>
                            <Badge variant="outline" className="gap-1">
                              {agg.isBlind ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {agg.isBlind ? "Blind" : "Named"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{dims.length} / {active.dimensions.length}</TableCell>
                        <TableCell>{avg == null ? "—" : `${avg.toFixed(1)} / 10`}</TableCell>
                        <TableCell>
                          {agg.isBlind && amIChairman !== true ? (
                            <span className="text-muted-foreground text-sm">{agg.assessorCount} anonymous</span>
                          ) : (
                            <span className="text-sm">{agg.assessorCount}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Blind feedback types hide assessor identity from non-Chairman viewers. The
                Chairman sees individual responses for calibration purposes.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
