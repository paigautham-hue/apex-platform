import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Shield } from "lucide-react";

export default function AccessChallenge() {
  const [challengeType, setChallengeType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!challengeType || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Submit via tRPC
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Access challenge submitted successfully. CHRO will review within 2 business days.");
      setChallengeType("");
      setDescription("");
    } catch (error) {
      toast.error("Failed to submit challenge");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Report or Challenge Access
        </h1>
        <p className="text-muted-foreground mt-2">
          Report unauthorized access or challenge data visibility
        </p>
      </div>

      <Card className="border-warning">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Access Challenge Workflow
          </CardTitle>
          <CardDescription>
            All access challenges are reviewed by Group CHRO within 2 business days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="challenge-type">Challenge Type</Label>
            <Select value={challengeType} onValueChange={setChallengeType}>
              <SelectTrigger id="challenge-type">
                <SelectValue placeholder="Select challenge type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unauthorized-access">
                  Unauthorized Access - Someone viewed my profile without permission
                </SelectItem>
                <SelectItem value="incorrect-visibility">
                  Incorrect Visibility - I can see data I shouldn't have access to
                </SelectItem>
                <SelectItem value="missing-access">
                  Missing Access - I should have access but don't
                </SelectItem>
                <SelectItem value="data-accuracy">
                  Data Accuracy - Information about me is incorrect
                </SelectItem>
                <SelectItem value="privacy-concern">
                  Privacy Concern - Sensitive information is too widely visible
                </SelectItem>
                <SelectItem value="other">
                  Other - Describe in detail below
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about the access issue, including:
- What data or profile is involved
- Who has inappropriate access (if known)
- Why you believe this access is incorrect
- Any supporting evidence or context"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              className="resize-none"
            />
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Group CHRO will review your challenge within 2 business days</li>
              <li>If access is found to be unauthorized, it will be immediately revoked</li>
              <li>You will receive a notification with the resolution</li>
              <li>If needed, the case may be escalated to the Chairman</li>
              <li>All access challenges are logged in the audit trail</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setChallengeType("");
                setDescription("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Challenge"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Access Challenges</CardTitle>
          <CardDescription>
            View the status of your previously submitted challenges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No access challenges submitted yet
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
