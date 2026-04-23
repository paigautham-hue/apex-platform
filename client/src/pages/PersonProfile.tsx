import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, ChevronRight, Pencil, Check, X } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AIDeliberationPanel from "@/components/AIDeliberationPanel";

export default function PersonProfile({ personId }: { personId: number }) {
  const [, setLocation] = useLocation();
  const [editingReportsTo, setEditingReportsTo] = useState(false);
  const [selectedReportsTo, setSelectedReportsTo] = useState<string>("");

  const { data: person, isLoading } = trpc.person.getById.useQuery({ personId, tenantId: 1 });
  const { data: observations } = trpc.observation.getByPerson.useQuery({ personId, tenantId: 1 });
  const { data: reportsTo, refetch: refetchReportsTo } = trpc.person.getReportsTo.useQuery({ personId, tenantId: 1 });
  const { data: directReports } = trpc.person.getDirectReports.useQuery(undefined, {
    // Only fetch when viewing your own profile — for others we use a different approach
    enabled: false,
  });
  const { data: allPeople } = trpc.person.list.useQuery({ tenantId: 1 });

  const utils = trpc.useUtils();
  const updateReportsTo = trpc.person.updateReportsTo.useMutation({
    onSuccess: () => {
      toast.success("Reporting structure updated");
      refetchReportsTo();
      utils.person.getById.invalidate({ personId, tenantId: 1 });
      setEditingReportsTo(false);
    },
    onError: (err) => {
      toast.error("Failed to update: " + err.message);
    },
  });

  const handleSaveReportsTo = () => {
    if (selectedReportsTo === "none") {
      updateReportsTo.mutate({ tenantId: 1, personId, reportsToPersonId: null });
    } else if (selectedReportsTo) {
      updateReportsTo.mutate({ tenantId: 1, personId, reportsToPersonId: Number(selectedReportsTo) });
    }
  };

  const handleStartEdit = () => {
    setSelectedReportsTo(reportsTo ? String(reportsTo.id) : "none");
    setEditingReportsTo(true);
  };

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-24 bg-muted rounded-lg"/><div className="h-48 bg-muted rounded-lg"/></div>;
  if (!person) return <div className="text-muted-foreground p-8 text-center">Person not found</div>;

  const tenureMonths = person.hireDate
    ? Math.floor((Date.now() - new Date(person.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  // People available to report to (exclude self)
  const reportingOptions = (allPeople || []).filter(p => p.id !== personId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <span className="font-bold text-2xl text-accent">{person.name?.charAt(0) || "?"}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{person.name}</h1>
            <p className="text-muted-foreground text-lg">{person.currentRole?.title || "No role assigned"}</p>
            {person.currentRole && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span>{person.email || ""}</span>
              </div>
            )}
          </div>
        </div>
        <Button onClick={() => setLocation('/meetings')}>Schedule 1:1</Button>
      </div>

      {/* AI Panel Review — fractal: any leader can run on any subordinate */}
      {person.currentRoleId && (
        <AIDeliberationPanel
          targetType="ROLE"
          targetId={person.currentRoleId}
          targetName={person.name ?? undefined}
        />
      )}

      {/* Reporting Structure Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Reporting Structure
            </CardTitle>
            {!editingReportsTo && (
              <Button variant="ghost" size="sm" onClick={handleStartEdit} className="h-8 px-2">
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reports To */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reports To</p>
            {editingReportsTo ? (
              <div className="flex items-center gap-2">
                <Select value={selectedReportsTo} onValueChange={setSelectedReportsTo}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select manager..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No manager (top of hierarchy)</SelectItem>
                    {reportingOptions.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleSaveReportsTo}
                  disabled={updateReportsTo.isPending}
                  className="h-9 px-3"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingReportsTo(false)}
                  className="h-9 px-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {reportsTo ? (
                  <button
                    onClick={() => setLocation(`/people/${reportsTo.id}`)}
                    className="flex items-center gap-2 text-sm hover:text-accent transition-colors group"
                  >
                    <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold">
                      {reportsTo.name?.charAt(0)}
                    </div>
                    <span className="font-medium">{reportsTo.name}</span>
                    <span className="text-muted-foreground text-xs">{reportsTo.currentRole?.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent" />
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Not set — click Edit to assign</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Data Sufficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Level {person.dataSufficiencyLevel || 0}</p>
            <p className="text-sm text-muted-foreground">{person.evidenceCount || 0} observations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{person.sourceCount || 0}</p>
            <p className="text-sm text-muted-foreground">unique observers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tenure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tenureMonths !== null ? tenureMonths : "—"}</p>
            <p className="text-sm text-muted-foreground">months</p>
          </CardContent>
        </Card>
      </div>

      {/* Role & Company Info */}
      {person.currentRole && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Role Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Title</p>
                <p className="font-medium">{person.currentRole.title}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Role Type</p>
                <Badge variant="secondary" className="text-xs">
                  {person.currentRole.roleType?.replace(/_/g, " ")}
                </Badge>
              </div>
              {person.currentRole.startDate && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">In Role Since</p>
                  <p className="font-medium">{new Date(person.currentRole.startDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Status</p>
                <Badge variant={person.currentRole.isActive ? "default" : "secondary"} className="text-xs">
                  {person.currentRole.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Observations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Observations</CardTitle>
        </CardHeader>
        <CardContent>
          {observations && observations.length > 0 ? (
            <div className="space-y-3">
              {observations.slice(0, 5).map((obs) => (
                <div key={obs.id} className="border-l-4 border-accent pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={obs.direction === "POSITIVE" ? "default" : obs.direction === "NEEDS_IMPROVEMENT" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {obs.direction?.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(obs.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm">{obs.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-3">No observations yet</p>
              <Button variant="outline" size="sm" onClick={() => setLocation('/capture')}>
                Capture first observation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
