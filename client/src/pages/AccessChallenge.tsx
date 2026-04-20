import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertTriangle, Shield, CheckCircle, Clock, XCircle } from "lucide-react";
import { VoiceInput } from "@/components/VoiceInput";
import { trpc } from "@/lib/trpc";

const TENANT_ID = 1;

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  UNAUTHORIZED_ACCESS: "Unauthorized Access",
  INCORRECT_VISIBILITY: "Incorrect Visibility",
  MISSING_ACCESS: "Missing Access",
  DATA_ACCURACY: "Data Accuracy",
  PRIVACY_CONCERN: "Privacy Concern",
  OTHER: "Other",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4" />,
  UNDER_REVIEW: <Clock className="h-4 w-4 text-yellow-500" />,
  RESOLVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  DISMISSED: <XCircle className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  UNDER_REVIEW: "secondary",
  RESOLVED: "default",
  DISMISSED: "secondary",
};

export default function AccessChallenge() {
  const utils = trpc.useUtils();
  const [challengeType, setChallengeType] = useState<
    "UNAUTHORIZED_ACCESS" | "INCORRECT_VISIBILITY" | "MISSING_ACCESS" | "DATA_ACCURACY" | "PRIVACY_CONCERN" | "OTHER" | ""
  >("");
  const [description, setDescription] = useState("");

  const { data: myChallenges, isLoading } = trpc.accessControl.listMyChallenges.useQuery();

  const submitChallenge = trpc.accessControl.submitChallenge.useMutation({
    onSuccess: () => {
      toast.success("Access challenge submitted. Group CHRO will review within 2 business days.");
      setChallengeType("");
      setDescription("");
      utils.accessControl.listMyChallenges.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!challengeType || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }
    submitChallenge.mutate({
      tenantId: TENANT_ID,
      challengeType,
      description: description.trim(),
    });
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Submit an Access Challenge
          </CardTitle>
          <CardDescription>
            All access challenges are reviewed by Group CHRO within 2 business days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="challenge-type">Challenge Type <span className="text-destructive">*</span></Label>
            <Select
              value={challengeType}
              onValueChange={(v) => setChallengeType(v as typeof challengeType)}
            >
              <SelectTrigger id="challenge-type">
                <SelectValue placeholder="Select challenge type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNAUTHORIZED_ACCESS">
                  Unauthorized Access — Someone viewed my profile without permission
                </SelectItem>
                <SelectItem value="INCORRECT_VISIBILITY">
                  Incorrect Visibility — I can see data I shouldn't have access to
                </SelectItem>
                <SelectItem value="MISSING_ACCESS">
                  Missing Access — I should have access but don't
                </SelectItem>
                <SelectItem value="DATA_ACCURACY">
                  Data Accuracy — Information about me is incorrect
                </SelectItem>
                <SelectItem value="PRIVACY_CONCERN">
                  Privacy Concern — Sensitive information is too widely visible
                </SelectItem>
                <SelectItem value="OTHER">
                  Other — Describe in detail below
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
            <div className="flex gap-2 items-start">
              <Textarea
                id="description"
                placeholder={`Provide detailed information about the access issue, including:\n- What data or profile is involved\n- Who has inappropriate access (if known)\n- Why you believe this access is incorrect\n- Any supporting evidence or context`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                className="resize-none flex-1"
              />
              <VoiceInput
                onTranscript={(text) => setDescription((prev) => (prev ? `${prev} ${text}` : text))}
                buttonVariant="outline"
              />
            </div>
            <p className="text-xs text-muted-foreground">{description.length} characters (minimum 10)</p>
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
              Clear
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitChallenge.isPending || !challengeType || description.trim().length < 10}
            >
              {submitChallenge.isPending ? "Submitting…" : "Submit Challenge"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Access Challenges</CardTitle>
          <CardDescription>View the status of your previously submitted challenges</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !myChallenges || myChallenges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No access challenges submitted yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myChallenges.map((c) => (
                <div key={c.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {STATUS_ICONS[c.status]}
                      <span className="font-medium">{CHALLENGE_TYPE_LABELS[c.challengeType] ?? c.challengeType}</span>
                    </div>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  {c.resolution && (
                    <div className="bg-muted p-3 rounded text-sm">
                      <span className="font-medium">Resolution: </span>
                      {c.resolution}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
