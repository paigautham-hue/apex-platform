import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/components/VoiceInput";
import { DocumentUpload } from "@/components/DocumentUpload";

export default function Goals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalCategory, setGoalCategory] = useState("");
  const [goalType, setGoalType] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const { data: plans, isLoading } = trpc.plan.getMyPlans.useQuery({ tenantId: 1 });
  const utils = trpc.useUtils();

  const createPlanMutation = trpc.plan.create.useMutation({
    onSuccess: () => {
      toast.success("Goal created successfully!");
      utils.plan.getMyPlans.invalidate();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to create goal: ${error.message}`);
    }
  });

  const resetForm = () => {
    setGoalName("");
    setGoalDescription("");
    setGoalCategory("");
    setGoalType("");
    setPeriodStart("");
    setPeriodEnd("");
  };

  const handleSubmit = () => {
    if (!goalName || !goalCategory || !goalType || !periodStart || !periodEnd) {
      toast.error("Please fill in all required fields");
      return;
    }

    createPlanMutation.mutate({
      tenantId: 1,
      name: goalName,
      type: goalType as "PORTFOLIO_STRATEGY" | "BUSINESS_PLAN" | "ANNUAL_OPERATING_PLAN" | "FUNCTION_PLAN" | "OKR" | "INDIVIDUAL_GOAL",
      orgUnitId: 1, // Default org unit
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      category: goalCategory as "FINANCIAL" | "STRATEGIC" | "OPERATIONAL" | "SUSTAINABILITY" | "LEADERSHIP" | "GOVERNANCE",
      targets: goalDescription ? { description: goalDescription } : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Goals & Plans</h1>
          <p className="text-muted-foreground">Track your objectives and key results</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="goal-name">Goal Name *</Label>
                <div className="flex gap-2">
                  <Input
                    id="goal-name"
                    placeholder="e.g., Increase Revenue by 25%"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="flex-1"
                  />
                  <VoiceInput
                    onTranscript={(text) => setGoalName(text)}
                    buttonVariant="outline"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-description">Description</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      id="goal-description"
                      placeholder="Describe the goal, success criteria, and key milestones..."
                      value={goalDescription}
                      onChange={(e) => setGoalDescription(e.target.value)}
                      rows={4}
                      className="flex-1"
                    />
                    <VoiceInput
                      onTranscript={(text) => setGoalDescription(prev => prev ? `${prev} ${text}` : text)}
                      buttonVariant="outline"
                    />
                  </div>
                  <DocumentUpload
                    onUploadComplete={(fileUrl, fileName) => {
                      setGoalDescription(prev => 
                        prev ? `${prev}\n\nAttached: ${fileName} (${fileUrl})` : `Attached: ${fileName} (${fileUrl})`
                      );
                      toast.success("Document attached to goal description");
                    }}
                    acceptedTypes=".pdf,.doc,.docx,.txt"
                    maxSizeMB={10}
                    buttonText="Attach Document"
                    buttonVariant="outline"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-category">Category *</Label>
                  <Select value={goalCategory} onValueChange={setGoalCategory}>
                    <SelectTrigger id="goal-category">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FINANCIAL">Financial</SelectItem>
                      <SelectItem value="STRATEGIC">Strategic</SelectItem>
                      <SelectItem value="OPERATIONAL">Operational</SelectItem>
                      <SelectItem value="SUSTAINABILITY">Sustainability</SelectItem>
                      <SelectItem value="LEADERSHIP">Leadership</SelectItem>
                      <SelectItem value="GOVERNANCE">Governance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal-type">Type *</Label>
                  <Select value={goalType} onValueChange={setGoalType}>
                    <SelectTrigger id="goal-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PORTFOLIO_STRATEGY">Portfolio Strategy</SelectItem>
                      <SelectItem value="BUSINESS_PLAN">Business Plan</SelectItem>
                      <SelectItem value="ANNUAL_OPERATING_PLAN">Annual Operating Plan</SelectItem>
                      <SelectItem value="FUNCTION_PLAN">Function Plan</SelectItem>
                      <SelectItem value="OKR">OKR</SelectItem>
                      <SelectItem value="INDIVIDUAL_GOAL">Individual Goal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period-start">Start Date *</Label>
                  <Input
                    id="period-start"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period-end">End Date *</Label>
                  <Input
                    id="period-end"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createPlanMutation.isPending}
                >
                  {createPlanMutation.isPending ? "Creating..." : "Create Goal"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <Button onClick={() => setIsDialogOpen(true)}>Create Your First Goal</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
