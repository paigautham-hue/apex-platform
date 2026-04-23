/**
 * /me — Universal personal workspace.
 *
 * Fractal: works for every user from IC to Chairman.
 *   - Renders PrimaryActionCard (AI-driven next action)
 *   - Renders CycleStatusBanner (cycle countdown / state)
 *   - Renders MyBridge (role mandates) if the viewer has a role with mandates
 *   - Renders MyIsland section (company dimensions) if the viewer leads a company
 *   - Renders a guided empty state for ICs with no mandates yet
 */

import { useViewer, tierLabel } from "@/hooks/useViewer";
import PrimaryActionCard from "@/components/PrimaryActionCard";
import CycleStatusBanner from "@/components/CycleStatusBanner";
import InsightsInbox from "@/components/InsightsInbox";
import MyBridge from "./MyBridge";
import MyIsland from "./MyIsland";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Me() {
  const { viewer, isLoading } = useViewer();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!viewer) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Could not load your profile. Please contact your administrator.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine what to render: CEOs (with companies) get Island; others get Bridge.
  const ownedUnits = Array.isArray(viewer.ownedOrgUnitIds) ? viewer.ownedOrgUnitIds : [];
  const isCeoLeader = viewer.tier === "CEO" && ownedUnits.length > 0;
  const successMetrics = (viewer.primaryRole?.successMetrics ?? []) as string[];
  const hasRoleMandates = !!viewer.primaryRole && Array.isArray(successMetrics) && successMetrics.length > 0;

  return (
    <div className="space-y-4 max-w-5xl mx-auto px-4 md:px-6 py-4">
      {/* Header strip — viewer identity */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {viewer.photoUrl && <AvatarImage src={viewer.photoUrl} alt={viewer.personName ?? ""} />}
          <AvatarFallback>
            {(viewer.personName ?? "?").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold truncate">{viewer.personName}</h1>
            {viewer.tier && (
              <Badge variant="outline" className="text-[10px] uppercase">{tierLabel(viewer.tier)}</Badge>
            )}
          </div>
          {viewer.primaryRole && (
            <p className="text-xs text-muted-foreground truncate">{viewer.primaryRole.title}</p>
          )}
        </div>
      </div>

      <CycleStatusBanner />

      <PrimaryActionCard scope="me" viewerPersonId={viewer.personId} viewerName={viewer.personName} />

      <InsightsInbox limit={5} />

      {/* Render the substantive workspace */}
      {isCeoLeader ? (
        <MyIsland />
      ) : hasRoleMandates ? (
        <MyBridge />
      ) : (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-sm text-muted-foreground">
              You don't have role mandates configured yet. You can still capture observations,
              reflect, and prepare for your meetings.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => navigate("/capture?voice=true")} className="gap-2">
                <Mic className="w-4 h-4" /> Voice capture
              </Button>
              <Button variant="outline" onClick={() => navigate("/reflections")} className="gap-2">
                <Sparkles className="w-4 h-4" /> Reflect
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
