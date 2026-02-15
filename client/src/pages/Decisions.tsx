import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { VoiceInput } from "@/components/VoiceInput";
import { DocumentUpload } from "@/components/DocumentUpload";
import { toast } from "sonner";

export default function Decisions() {
  const { data: decisions } = trpc.decision.getMyDecisions.useQuery({ tenantId: 1 });
  const [open, setOpen] = useState(false);
  const [decisionText, setDecisionText] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [risks, setRisks] = useState("");
  const createDecision = trpc.decision.create.useMutation({
    onSuccess: () => {
      toast.success("Decision logged");
      setOpen(false);
      setDecisionText("");
      setAssumptions("");
      setExpectedOutcome("");
      setRisks("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Decision Journal</h1>
          <p className="text-muted-foreground">Track decisions and learn from outcomes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Log Decision
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Decision</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Decision</Label>
                <div className="relative">
                  <Textarea
                    value={decisionText}
                    onChange={(e) => setDecisionText(e.target.value)}
                    placeholder="What decision did you make?"
                    rows={3}
                  />
                  <div className="absolute top-2 right-2">
                    <VoiceInput onTranscript={(transcript) => setDecisionText(decisionText + " " + transcript)} />
                  </div>
                </div>
              </div>
              <div>
                <Label>Assumptions</Label>
                <div className="relative">
                  <Textarea
                    value={assumptions}
                    onChange={(e) => setAssumptions(e.target.value)}
                    placeholder="What assumptions are you making?"
                    rows={2}
                  />
                  <div className="absolute top-2 right-2">
                    <VoiceInput onTranscript={(transcript) => setAssumptions(assumptions + " " + transcript)} />
                  </div>
                </div>
              </div>
              <div>
                <Label>Expected Outcome</Label>
                <div className="relative">
                  <Textarea
                    value={expectedOutcome}
                    onChange={(e) => setExpectedOutcome(e.target.value)}
                    placeholder="What do you expect to happen?"
                    rows={2}
                  />
                  <div className="absolute top-2 right-2">
                    <VoiceInput onTranscript={(transcript) => setExpectedOutcome(expectedOutcome + " " + transcript)} />
                  </div>
                </div>
              </div>
              <div>
                <Label>Risks</Label>
                <div className="relative">
                  <Textarea
                    value={risks}
                    onChange={(e) => setRisks(e.target.value)}
                    placeholder="What could go wrong?"
                    rows={2}
                  />
                  <div className="absolute top-2 right-2">
                    <VoiceInput onTranscript={(transcript) => setRisks(risks + " " + transcript)} />
                  </div>
                </div>
              </div>
              <DocumentUpload
                onUploadComplete={(fileUrl, fileName) => {
                  toast.success("Document uploaded: " + fileName);
                }}
                acceptedTypes=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              />
              <Button
                onClick={() => {
                  createDecision.mutate({
                    tenantId: 1,
                    decisionText,
                    assumptions: assumptions.split('\n').filter(a => a.trim()),
                    expectedOutcome,
                    risksIdentified: risks.split('\n').filter(r => r.trim()),
                  });
                }}
                disabled={!decisionText.trim()}
              >
                Log Decision
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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