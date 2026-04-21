import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Key, Users, Building2, Calendar, Plus, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const TENANT_ID = 1; // default tenant

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  VIEW_ONLY: "View Only",
  VIEW_AND_COMMENT: "View & Comment",
  FULL_ACCESS: "Full Access",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  EXPIRED: "secondary",
  REVOKED: "destructive",
};

export default function AccessGrants() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    grantedToEmail: "",
    targetOrgUnitId: "",
    accessLevel: "" as "VIEW_ONLY" | "VIEW_AND_COMMENT" | "FULL_ACCESS" | "",
    justification: "",
    duration: "90",
  });

  // Load grants
  const { data: grants, isLoading } = trpc.accessControl.myGrants.useQuery(
    { tenantId: TENANT_ID },
    { enabled: !!user }
  );

  // Load org units for the dropdown
  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery(
    { tenantId: TENANT_ID },
    { enabled: !!user }
  );

  const createGrant = trpc.accessControl.createGrant.useMutation({
    onSuccess: () => {
      toast.success("Access grant created successfully");
      utils.accessControl.myGrants.invalidate();
      setShowCreateForm(false);
      setForm({ grantedToEmail: "", targetOrgUnitId: "", accessLevel: "", justification: "", duration: "90" });
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeGrant = trpc.accessControl.revokeGrant.useMutation({
    onSuccess: () => {
      toast.success("Access grant revoked");
      utils.accessControl.myGrants.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!form.grantedToEmail || !form.targetOrgUnitId || !form.accessLevel) {
      toast.error("Please fill in all required fields");
      return;
    }
    const daysAhead = parseInt(form.duration, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysAhead);

    createGrant.mutate({
      tenantId: TENANT_ID,
      grantedToEmail: form.grantedToEmail,
      targetOrgUnitId: parseInt(form.targetOrgUnitId, 10),
      accessLevel: form.accessLevel,
      justification: form.justification || undefined,
      expiresAt,
    });
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8" />
            Cross-Company Access Grants
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage permissions for users to access data across different companies
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : <><Plus className="h-4 w-4 mr-2" />Grant Access</>}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Access Grant</CardTitle>
            <CardDescription>Grant temporary cross-company access to a user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="person-email">Person Email <span className="text-destructive">*</span></Label>
                <Input
                  id="person-email"
                  type="email"
                  placeholder="user@example.com"
                  value={form.grantedToEmail}
                  onChange={(e) => setForm((p) => ({ ...p, grantedToEmail: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-unit">Target Company / Org Unit <span className="text-destructive">*</span></Label>
                <Select
                  value={form.targetOrgUnitId}
                  onValueChange={(v) => setForm((p) => ({ ...p, targetOrgUnitId: v }))}
                >
                  <SelectTrigger id="org-unit">
                    <SelectValue placeholder="Select org unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {(orgUnits ?? []).map((ou) => (
                      <SelectItem key={ou.id} value={String(ou.id)}>
                        {ou.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-level">Access Level <span className="text-destructive">*</span></Label>
                <Select
                  value={form.accessLevel}
                  onValueChange={(v) => setForm((p) => ({ ...p, accessLevel: v as typeof form.accessLevel }))}
                >
                  <SelectTrigger id="access-level">
                    <SelectValue placeholder="Select access level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEW_ONLY">View Only</SelectItem>
                    <SelectItem value="VIEW_AND_COMMENT">View and Comment</SelectItem>
                    <SelectItem value="FULL_ACCESS">Full Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Select
                  value={form.duration}
                  onValueChange={(v) => setForm((p) => ({ ...p, duration: v }))}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="justification">Justification (optional)</Label>
                <Input
                  id="justification"
                  placeholder="Reason for granting access..."
                  value={form.justification}
                  onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))}
                />
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Important Notes:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Access grants are temporary and will expire automatically</li>
                <li>All grants are logged in the audit trail</li>
                <li>Users will be notified when access is granted or revoked</li>
                <li>Only Chairman and Group CHRO can grant cross-company access</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={createGrant.isPending}>
                {createGrant.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create Grant"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Access Grants</CardTitle>
          <CardDescription>Access grants you have issued to other users</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !grants || grants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No access grants yet</p>
              <p className="text-sm mt-1">Click "Grant Access" to create your first cross-company access grant.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grants.map((grant) => (
                <div
                  key={grant.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{grant.grantedToEmail}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>Org Unit #{grant.targetOrgUnitId}</span>
                      <span>•</span>
                      <span>{ACCESS_LEVEL_LABELS[grant.accessLevel] ?? grant.accessLevel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Expires: {new Date(grant.expiresAt).toLocaleDateString()}</span>
                    </div>
                    {grant.justification && (
                      <p className="text-xs text-muted-foreground italic">{grant.justification}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_VARIANT[grant.status] ?? "outline"}>
                      {grant.status}
                    </Badge>
                    {grant.status === "ACTIVE" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revokeGrant.isPending}
                        onClick={() => revokeGrant.mutate({ grantId: grant.id, tenantId: TENANT_ID })}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
