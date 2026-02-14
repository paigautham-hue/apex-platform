import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ProfileViewAuditProps {
  personId: number;
  tenantId: number;
}

export default function ProfileViewAudit({ personId, tenantId }: ProfileViewAuditProps) {
  const [open, setOpen] = useState(false);

  // Mock data - in production, this would come from a real audit trail
  const viewHistory = [
    {
      id: 1,
      viewerName: "Ranjan Pai",
      viewerRole: "Chairman",
      viewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      reason: "Portfolio review",
    },
    {
      id: 2,
      viewerName: "Dilip Chenoy",
      viewerRole: "Group CEO",
      viewedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      reason: "Quarterly calibration",
    },
    {
      id: 3,
      viewerName: "Sarah Johnson",
      viewerRole: "Group CHRO",
      viewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      reason: "Talent review",
    },
  ];

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Who viewed my profile?
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Profile View History</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {viewHistory.length > 0 ? (
            <div className="space-y-3">
              {viewHistory.map((view) => (
                <div
                  key={view.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-xs">
                      {view.viewerName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{view.viewerName}</p>
                        <p className="text-xs text-muted-foreground">{view.viewerRole}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(view.viewedAt)}
                      </span>
                    </div>
                    {view.reason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Context: {view.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">No profile views yet</p>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Privacy Note:</strong> Only senior leaders (Chairman, Group CEO, Group
              CHRO) can view this audit trail. All profile views are logged for transparency
              and accountability.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
