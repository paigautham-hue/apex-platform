import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, Users, Building2, Calendar } from "lucide-react";

interface AccessGrant {
  id: number;
  grantedTo: string;
  grantedToRole: string;
  company: string;
  accessLevel: string;
  expiresAt: Date;
  status: "active" | "expired" | "revoked";
}

export default function AccessGrants() {
  const [grants, setGrants] = useState<AccessGrant[]>([
    {
      id: 1,
      grantedTo: "John Smith",
      grantedToRole: "Group CEO",
      company: "Acme Corp",
      accessLevel: "View Only",
      expiresAt: new Date("2026-12-31"),
      status: "active",
    },
  ]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGrant, setNewGrant] = useState({
    personEmail: "",
    company: "",
    accessLevel: "",
    duration: "90",
  });

  const handleCreateGrant = () => {
    if (!newGrant.personEmail || !newGrant.company || !newGrant.accessLevel) {
      toast.error("Please fill in all fields");
      return;
    }

    // TODO: Create via tRPC
    toast.success("Access grant created successfully");
    setShowCreateForm(false);
    setNewGrant({ personEmail: "", company: "", accessLevel: "", duration: "90" });
  };

  const handleRevokeGrant = (grantId: number) => {
    // TODO: Revoke via tRPC
    setGrants((prev) =>
      prev.map((g) => (g.id === grantId ? { ...g, status: "revoked" as const } : g))
    );
    toast.success("Access grant revoked");
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
          {showCreateForm ? "Cancel" : "Grant Access"}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Access Grant</CardTitle>
            <CardDescription>
              Grant temporary cross-company access to a user
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="person-email">Person Email</Label>
                <Input
                  id="person-email"
                  type="email"
                  placeholder="user@example.com"
                  value={newGrant.personEmail}
                  onChange={(e) =>
                    setNewGrant((prev) => ({ ...prev, personEmail: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Target Company</Label>
                <Select
                  value={newGrant.company}
                  onValueChange={(value) =>
                    setNewGrant((prev) => ({ ...prev, company: value }))
                  }
                >
                  <SelectTrigger id="company">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acme-corp">Acme Corp</SelectItem>
                    <SelectItem value="tech-innovations">Tech Innovations</SelectItem>
                    <SelectItem value="global-solutions">Global Solutions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-level">Access Level</Label>
                <Select
                  value={newGrant.accessLevel}
                  onValueChange={(value) =>
                    setNewGrant((prev) => ({ ...prev, accessLevel: value }))
                  }
                >
                  <SelectTrigger id="access-level">
                    <SelectValue placeholder="Select access level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view-only">View Only</SelectItem>
                    <SelectItem value="view-and-comment">View and Comment</SelectItem>
                    <SelectItem value="full-access">Full Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (days)</Label>
                <Select
                  value={newGrant.duration}
                  onValueChange={(value) =>
                    setNewGrant((prev) => ({ ...prev, duration: value }))
                  }
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
              <Button onClick={handleCreateGrant}>Create Grant</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Access Grants</CardTitle>
          <CardDescription>
            Currently active cross-company access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {grants.map((grant) => (
              <div
                key={grant.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{grant.grantedTo}</span>
                    <Badge variant="outline">{grant.grantedToRole}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{grant.company}</span>
                    <span>•</span>
                    <span>{grant.accessLevel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Expires: {grant.expiresAt.toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      grant.status === "active"
                        ? "default"
                        : grant.status === "expired"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {grant.status}
                  </Badge>
                  {grant.status === "active" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevokeGrant(grant.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
