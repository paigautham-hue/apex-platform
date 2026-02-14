import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Decisions() {
  const { data: decisions } = trpc.decision.getMyDecisions.useQuery({ tenantId: 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Decision Journal</h1>
          <p className="text-muted-foreground">Track decisions and learn from outcomes</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Log Decision
        </Button>
      </div>

      {decisions && decisions.length > 0 ? (
        <div className="space-y-4">
          {decisions.map((decision) => (
            <Card key={decision.id}>
              <CardHeader>
                <CardTitle className="text-base">{decision.decisionText}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {new Date(decision.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No decisions logged yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}