import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Target } from "lucide-react";

export default function Goals() {
  const { data: plans, isLoading } = trpc.plan.getMyPlans.useQuery({ tenantId: 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Goals & Plans</h1>
          <p className="text-muted-foreground">Track your objectives and key results</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {plans && plans.length > 0 ? (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {plan.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(plan.periodStart).toLocaleDateString()} - {new Date(plan.periodEnd).toLocaleDateString()}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">{plan.category}</span> • {plan.type}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    plan.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {plan.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No goals yet</p>
            <Button>Create Your First Goal</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}