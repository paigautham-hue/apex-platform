import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Users, Building2, Target, Award, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Admin() {
  const [selectedTab, setSelectedTab] = useState("org-units");
  const [newOrgUnitName, setNewOrgUnitName] = useState("");
  const [newOrgUnitType, setNewOrgUnitType] = useState<string>("");
  const [calibrationOrgUnit, setCalibrationOrgUnit] = useState<number | null>(null);
  const [calibrationPeriod, setCalibrationPeriod] = useState("");

  const { data: orgUnits, refetch: refetchOrgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: 1 });
  const { data: people } = trpc.person.list.useQuery({ tenantId: 1 });
  const { data: calibrationSessions } = trpc.calibration.listSessions.useQuery({ tenantId: 1 });

  const createOrgUnitMutation = trpc.tenant.createOrgUnit.useMutation({
    onSuccess: () => {
      toast.success("Org unit created successfully!");
      setNewOrgUnitName("");
      setNewOrgUnitType("");
      refetchOrgUnits();
    },
  });

  const startCalibrationMutation = trpc.calibration.startSession.useMutation({
    onSuccess: () => {
      toast.success("Calibration session started!");
      setCalibrationOrgUnit(null);
      setCalibrationPeriod("");
    },
  });

  const handleCreateOrgUnit = async () => {
    if (!newOrgUnitName || !newOrgUnitType) {
      toast.error("Please fill in all fields");
      return;
    }

    await createOrgUnitMutation.mutateAsync({
      tenantId: 1,
      name: newOrgUnitName,
      type: newOrgUnitType as any,
      parentId: null,
    });
  };

  const handleStartCalibration = async () => {
    if (!calibrationOrgUnit || !calibrationPeriod) {
      toast.error("Please select org unit and period");
      return;
    }

    await startCalibrationMutation.mutateAsync({
      tenantId: 1,
      orgUnitId: calibrationOrgUnit,
      period: calibrationPeriod,
      mode: "ASYNC",
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage organization structure, calibration sessions, and system configuration
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="org-units">
            <Building2 className="h-4 w-4 mr-2" />
            Org Units
          </TabsTrigger>
          <TabsTrigger value="calibration">
            <Award className="h-4 w-4 mr-2" />
            Calibration
          </TabsTrigger>
          <TabsTrigger value="people">
            <Users className="h-4 w-4 mr-2" />
            People
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* Org Units Tab */}
        <TabsContent value="org-units" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Org Unit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Name</label>
                <Input
                  placeholder="e.g., Engineering, Sales, Marketing"
                  value={newOrgUnitName}
                  onChange={(e) => setNewOrgUnitName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={newOrgUnitType} onValueChange={setNewOrgUnitType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOLDING_COMPANY">Holding Company</SelectItem>
                    <SelectItem value="PORTFOLIO_COMPANY">Portfolio Company</SelectItem>
                    <SelectItem value="FUNCTION">Function</SelectItem>
                    <SelectItem value="TEAM">Team</SelectItem>
                    <SelectItem value="SUB_BUSINESS">Sub-Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateOrgUnit}
                disabled={createOrgUnitMutation.isPending}
              >
                {createOrgUnitMutation.isPending ? "Creating..." : "Create Org Unit"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Org Units ({orgUnits?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orgUnits?.map((unit: any) => (
                  <div key={unit.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{unit.name}</p>
                      <p className="text-sm text-muted-foreground">{unit.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-accent">
                        {people?.filter((p: any) => p.orgUnitId === unit.id).length || 0} people
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calibration Tab */}
        <TabsContent value="calibration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Start New Calibration Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Org Unit</label>
                <Select
                  value={calibrationOrgUnit?.toString()}
                  onValueChange={(val) => setCalibrationOrgUnit(Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select org unit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orgUnits?.map((unit: any) => (
                      <SelectItem key={unit.id} value={unit.id.toString()}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Period</label>
                <Select value={calibrationPeriod} onValueChange={setCalibrationPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1_2024">Q1 2024</SelectItem>
                    <SelectItem value="Q2_2024">Q2 2024</SelectItem>
                    <SelectItem value="Q3_2024">Q3 2024</SelectItem>
                    <SelectItem value="Q4_2024">Q4 2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleStartCalibration}
                disabled={startCalibrationMutation.isPending}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {startCalibrationMutation.isPending ? "Starting..." : "Start Calibration"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Calibration Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {calibrationSessions && calibrationSessions.length > 0 ? (
                <div className="space-y-3">
                  {calibrationSessions.map((session: any) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">
                            {orgUnits?.find((u: any) => u.id === session.orgUnitId)?.name}
                          </p>
                          <p className="text-sm text-muted-foreground">{session.period}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          session.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          session.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Mode: {session.mode} | Started: {new Date(session.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No calibration sessions yet. Start one to begin the performance calibration process.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>People Overview ({people?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {people?.slice(0, 20).map((person: any) => (
                  <div key={person.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {person.currentRole?.title || 'No role assigned'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-accent">
                        {orgUnits?.find((u: any) => u.id === person.orgUnitId)?.name || 'No org unit'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        person.dataSufficiency === 'SUFFICIENT' ? 'bg-green-100 text-green-800' :
                        person.dataSufficiency === 'MODERATE' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {person.dataSufficiency || 'INSUFFICIENT'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-1">Total Users</p>
                  <p className="text-2xl font-bold">{people?.length || 0}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-1">Org Units</p>
                  <p className="text-2xl font-bold">{orgUnits?.length || 0}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-1">Active Calibrations</p>
                  <p className="text-2xl font-bold">
                    {calibrationSessions?.filter((s: any) => s.status === 'IN_PROGRESS').length || 0}
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-1">Data Sufficiency</p>
                  <p className="text-2xl font-bold">
                    {Math.round((people?.filter((p: any) => p.dataSufficiency === 'SUFFICIENT').length || 0) / (people?.length || 1) * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tenant Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tenant Name</label>
                <Input placeholder="Acme Corporation" defaultValue="Acme Corporation" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Core Values (comma-separated)</label>
                <Textarea
                  placeholder="Innovation, Integrity, Customer Focus, Excellence"
                  defaultValue="Innovation, Integrity, Customer Focus, Excellence"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Performance Review Cycle</label>
                <Select defaultValue="quarterly">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="biannual">Bi-Annual</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
