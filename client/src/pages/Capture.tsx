import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Send, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/components/VoiceInput";
import { DocumentUpload } from "@/components/DocumentUpload";

export default function Capture() {
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [observationText, setObservationText] = useState("");
  const [direction, setDirection] = useState<"POSITIVE" | "NEEDS_IMPROVEMENT" | "NEUTRAL">("POSITIVE");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: directReports } = trpc.person.getDirectReports.useQuery();
  const { data: templates } = trpc.observation.getTemplates.useQuery();
  const createObservation = trpc.observation.create.useMutation();

  const handleSubmit = async () => {
    if (!selectedPerson || !observationText.trim()) {
      toast.error("Please select a person and enter observation text");
      return;
    }

    try {
      await createObservation.mutateAsync({
        tenantId: 1,
        subjectPersonId: selectedPerson,
        text: observationText,
        direction,
        source: selectedTemplate ? "TEMPLATE" : "QUICK_NOTE",
        templateUsed: selectedTemplate || undefined,
      });

      toast.success("Observation captured!");
      setObservationText("");
      setSelectedPerson(null);
    } catch (error) {
      toast.error("Failed to capture observation");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Quick Capture</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Observation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>About whom?</Label>
            <Select value={selectedPerson?.toString()} onValueChange={(v) => setSelectedPerson(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {directReports?.map((person: any) => (
                  <SelectItem key={person.id} value={person.id.toString()}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Observation</span>
              <VoiceInput 
                onTranscript={(text) => setObservationText(prev => prev + " " + text)}
                buttonSize="sm"
              />
            </Label>
            <Textarea
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              placeholder="Describe what you observed... (or use voice input)"
              rows={6}
            />
          </div>
          <div className="space-y-2">
            <Label>Supporting Documents (Optional)</Label>
            <DocumentUpload
              onUploadComplete={(url, fileName) => {
                toast.success(`Document ${fileName} attached`);
                setObservationText(prev => prev + `\n\n[Attached: ${fileName}](${url})`);
              }}
              buttonText="Attach Document"
              maxSizeMB={5}
            />
          </div>
          <Button onClick={handleSubmit} disabled={createObservation.isPending} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            Capture Observation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}