import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Lock, Plus, Settings2, Ship } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

type VisibilityRule = "IMMEDIATE" | "AFTER_ALL_SUBMIT" | "AFTER_DEADLINE" | "ADMIN_RELEASE";
type Cadence = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";

export default function GovernanceAdmin() {
  const { data: amIChairman } = trpc.governance.amIChairman.useQuery({ tenantId: TENANT_ID });
  const { data: feedbackTypes, refetch: refetchTypes } = trpc.governance.listAllFeedbackTypes.useQuery({
    tenantId: TENANT_ID,
  });
  const { data: cycles } = trpc.governance.listCycles.useQuery({ tenantId: TENANT_ID });
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });

  const updateType = trpc.governance.updateFeedbackType.useMutation({
    onSuccess: () => {
      toast.success("Feedback type updated");
      refetchTypes();
    },
    onError: (e) => toast.error(e.message),
  });

  const createType = trpc.governance.createFeedbackType.useMutation({
    onSuccess: () => {
      toast.success("Feedback type created");
      refetchTypes();
      setNewType({ key: "", label: "", visibilityRule: "AFTER_ALL_SUBMIT", cadence: "MONTHLY", isBlind: false });
    },
    onError: (e) => toast.error(e.message),
  });

  const generateAssignments = trpc.governance.generateAssignments.useMutation({
    onSuccess: (res) =>
      toast.success(
        res.skipped > 0
          ? `Generated ${res.count} assignments (${res.skipped} already existed)`
          : `Generated ${res.count} assignments`,
      ),
    onError: (e) => toast.error(e.message),
  });

  const createCycle = trpc.governance.createCycle.useMutation({
    onSuccess: () => toast.success("Cycle created"),
    onError: (e) => toast.error(e.message),
  });

  const [newType, setNewType] = useState<{
    key: string;
    label: string;
    visibilityRule: VisibilityRule;
    cadence: Cadence;
    isBlind: boolean;
  }>({
    key: "",
    label: "",
    visibilityRule: "AFTER_ALL_SUBMIT",
    cadence: "MONTHLY",
    isBlind: false,
  });

  const [assignmentType, setAssignmentType] = useState<"self" | "chairman" | "peer" | "upward">("self");
  const [perAssessor, setPerAssessor] = useState(3);
  const [newMonth, setNewMonth] = useState("");

  if (amIChairman === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (amIChairman === false) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings2 className="h-7 w-7" />
          Governance Admin
        </h1>
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <Lock className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="font-medium">Not authorised</div>
              <p className="text-sm text-muted-foreground">
                Only the Chairman or an Admin can configure feedback types and generate assignments.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
          <Settings2 className="h-7 w-7" />
          Governance Admin
        </h1>
        <p className="text-muted-foreground">
          Configure feedback types, open cycles, and generate assessment assignments.
        </p>
      </div>

      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Feedback Types</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configured Feedback Types</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Blind</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(feedbackTypes ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.key}</TableCell>
                      <TableCell>{t.label}</TableCell>
                      <TableCell>
                        <Select
                          value={t.cadence ?? "MONTHLY"}
                          onValueChange={(v) =>
                            updateType.mutate({
                              id: t.id,
                              tenantId: TENANT_ID,
                              patch: { cadence: v as Cadence },
                            })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                            <SelectItem value="SEMI_ANNUAL">Semi-annual</SelectItem>
                            <SelectItem value="ANNUAL">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.visibilityRule ?? "AFTER_ALL_SUBMIT"}
                          onValueChange={(v) =>
                            updateType.mutate({
                              id: t.id,
                              tenantId: TENANT_ID,
                              patch: { visibilityRule: v as VisibilityRule },
                            })
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                            <SelectItem value="AFTER_ALL_SUBMIT">After all submit</SelectItem>
                            <SelectItem value="AFTER_DEADLINE">After deadline</SelectItem>
                            <SelectItem value="ADMIN_RELEASE">Admin release</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!t.isBlind}
                          onCheckedChange={(v) =>
                            updateType.mutate({
                              id: t.id,
                              tenantId: TENANT_ID,
                              patch: { isBlind: v },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!t.isActive}
                          onCheckedChange={(v) =>
                            updateType.mutate({
                              id: t.id,
                              tenantId: TENANT_ID,
                              patch: { isActive: v },
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Feedback Type
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Key (slug)</Label>
                <Input
                  value={newType.key}
                  onChange={(e) => setNewType((p) => ({ ...p, key: e.target.value }))}
                  placeholder="e.g. peer, upward, cross_functional"
                />
              </div>
              <div>
                <Label>Label</Label>
                <Input
                  value={newType.label}
                  onChange={(e) => setNewType((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Display name"
                />
              </div>
              <div>
                <Label>Cadence</Label>
                <Select
                  value={newType.cadence}
                  onValueChange={(v) => setNewType((p) => ({ ...p, cadence: v as Cadence }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="SEMI_ANNUAL">Semi-annual</SelectItem>
                    <SelectItem value="ANNUAL">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select
                  value={newType.visibilityRule}
                  onValueChange={(v) => setNewType((p) => ({ ...p, visibilityRule: v as VisibilityRule }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                    <SelectItem value="AFTER_ALL_SUBMIT">After all submit</SelectItem>
                    <SelectItem value="AFTER_DEADLINE">After deadline</SelectItem>
                    <SelectItem value="ADMIN_RELEASE">Admin release</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isBlind"
                  checked={newType.isBlind}
                  onCheckedChange={(v) => setNewType((p) => ({ ...p, isBlind: v }))}
                />
                <Label htmlFor="isBlind">Blind (hide assessor identity)</Label>
              </div>
              <div className="md:col-span-2">
                <Button
                  onClick={() =>
                    createType.mutate({
                      tenantId: TENANT_ID,
                      ...newType,
                      sortOrder: (feedbackTypes?.length ?? 0) + 1,
                    })
                  }
                  disabled={!newType.key || !newType.label || createType.isPending}
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cycles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div>
                  <Label>New cycle (YYYY-MM)</Label>
                  <Input
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                    placeholder="2026-05"
                    className="w-[140px]"
                  />
                </div>
                <Button
                  disabled={!/^\d{4}-\d{2}$/.test(newMonth) || createCycle.isPending}
                  onClick={() => createCycle.mutate({ tenantId: TENANT_ID, month: newMonth })}
                >
                  Create DRAFT cycle
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Open</TableHead>
                    <TableHead>Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cycles ?? []).slice(0, 12).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.month}</TableCell>
                      <TableCell>
                        <Badge>{c.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.openDate ? new Date(c.openDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        {c.deadlineDate ? new Date(c.deadlineDate).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                Transition cycles to OPEN / CLOSED / REVEALED from the Chairman Dashboard.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ship className="h-4 w-4" />
                Generate Assignments for Active Cycle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeCycle && (
                <p className="text-sm text-muted-foreground">
                  No cycle is currently OPEN. Open one from the Chairman dashboard.
                </p>
              )}
              {activeCycle && (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <Label>Feedback type</Label>
                      <Select
                        value={assignmentType}
                        onValueChange={(v) => setAssignmentType(v as typeof assignmentType)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">Self</SelectItem>
                          <SelectItem value="chairman">Chairman</SelectItem>
                          <SelectItem value="peer">Peer</SelectItem>
                          <SelectItem value="upward">Upward</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {assignmentType === "peer" && (
                      <div>
                        <Label>Peers per assessor</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={perAssessor}
                          onChange={(e) => setPerAssessor(parseInt(e.target.value) || 3)}
                          className="w-[100px]"
                        />
                      </div>
                    )}
                    <Button
                      onClick={() =>
                        generateAssignments.mutate({
                          tenantId: TENANT_ID,
                          cycleId: activeCycle.id,
                          feedbackTypeKey: assignmentType,
                          perAssessor,
                        })
                      }
                      disabled={generateAssignments.isPending}
                    >
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rules: Self assignments cover every CXO, CEO, and each CEO's company. Chairman
                    assignments cover every CXO role, CEO role, and portfolio company. Peer
                    randomly assigns N peers to each CXO. Upward assigns every CXO as a target for
                    each CEO. Running a rule is additive — existing assignments are NOT de-duped,
                    so only run each rule once per cycle.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
