/**
 * /group — Universal recursive drill view.
 *
 * Fractal:
 *   - Chairman / Group CEO sees the entire fund tree.
 *   - CEO sees their company tree (only their owned org units).
 *   - CXO sees their function tree.
 *
 * Composition:
 *   - PrimaryActionCard
 *   - CycleStatusBanner
 *   - Org tree visualization (companies/functions/teams as cards)
 *   - Click into a node → drill into that subtree
 *   - Top-level summary: # leaders, # cycles in motion, key insights surfaced
 */

import { useViewer } from "@/hooks/useViewer";
import PrimaryActionCard from "@/components/PrimaryActionCard";
import CycleStatusBanner from "@/components/CycleStatusBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Users, Network } from "lucide-react";

export default function Group() {
  const { viewer, isLoading } = useViewer();
  const [, navigate] = useLocation();
  const [drillRoot, setDrillRoot] = useState<number | null>(null);

  const { data: tree, isLoading: treeLoading } = trpc.scope.getOrgTree.useQuery(
    { rootOrgUnitId: drillRoot },
    { enabled: !isLoading && !!viewer }
  );

  if (isLoading || treeLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!viewer) return null;

  const units = tree?.units ?? [];
  const persons = tree?.persons ?? [];
  const roles = tree?.roles ?? [];

  // Build hierarchy: top-level units (no parent in this scoped set)
  const visibleUnitIds = new Set(units.map(u => u.id));
  const topLevel = units.filter(u => u.parentOrgUnitId == null || !visibleUnitIds.has(u.parentOrgUnitId));

  const personById = new Map(persons.map(p => [p.id, p]));
  const rolesByOrgUnit = new Map<number, typeof roles>();
  for (const r of roles) {
    if (r.orgUnitId == null) continue;
    if (!rolesByOrgUnit.has(r.orgUnitId)) rolesByOrgUnit.set(r.orgUnitId, []);
    rolesByOrgUnit.get(r.orgUnitId)!.push(r);
  }
  const childrenOf = (id: number) => units.filter(u => u.parentOrgUnitId === id);

  const summary = useMemo(() => {
    return {
      orgUnitCount: units.length,
      personCount: persons.length,
      companyCount: units.filter(u => u.type === "PORTFOLIO_COMPANY").length,
    };
  }, [units, persons]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-4 md:px-6 py-4">
      <div className="flex items-center gap-3">
        {drillRoot != null && (
          <Button variant="ghost" size="sm" onClick={() => setDrillRoot(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Up to top
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Network className="w-6 h-6" />
            {viewer.isFundWide ? "Fund overview" : "Your group"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {summary.orgUnitCount} org unit{summary.orgUnitCount === 1 ? "" : "s"} ·
            {" "}{summary.personCount} people
            {summary.companyCount > 0 && ` · ${summary.companyCount} compan${summary.companyCount === 1 ? "y" : "ies"}`}
          </p>
        </div>
      </div>

      <CycleStatusBanner />
      <PrimaryActionCard scope="group" viewerPersonId={viewer.personId} viewerName={viewer.personName} />

      {/* Top-level org units as cards */}
      {topLevel.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No org units in scope.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {topLevel.map(unit => {
            const subUnits = childrenOf(unit.id);
            const unitRoles = rolesByOrgUnit.get(unit.id) ?? [];
            const leaderRole = unitRoles.find(r => ["CEO", "CHAIRMAN", "GROUP_CEO"].includes(r.roleType ?? ""));
            const leader = leaderRole ? personById.get(leaderRole.personId) : null;
            return (
              <Card key={unit.id} className="hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="text-[10px] uppercase mb-1">{unit.type.replace(/_/g, " ")}</Badge>
                      <CardTitle className="text-base truncate">{unit.name}</CardTitle>
                    </div>
                    {unit.lifecycleStage && (
                      <Badge variant="secondary" className="text-[10px]">{unit.lifecycleStage}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {leader && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {leader.photoUrl && <AvatarImage src={leader.photoUrl} alt={leader.name} />}
                        <AvatarFallback className="text-[9px]">
                          {leader.name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-xs">
                        <div className="font-medium truncate">{leader.name}</div>
                        <div className="text-muted-foreground truncate">{leaderRole?.title ?? ""}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {subUnits.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {subUnits.length} sub-unit{subUnits.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {unitRoles.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {unitRoles.length} role{unitRoles.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => setDrillRoot(unit.id)}>
                      Drill in
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                    {leader && (
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate(`/people/${leader.id}`)}>
                        Open leader
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
