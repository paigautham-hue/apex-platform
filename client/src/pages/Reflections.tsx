import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VoiceInput } from "@/components/VoiceInput";
import { DocumentUpload } from "@/components/DocumentUpload";
import { toast } from "sonner";

export default function Reflections() {
  const { data: reflections } = trpc.reflection.getMyReflections.useQuery({ tenantId: 1 });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<"ACHIEVEMENT" | "LEARNING" | "CHALLENGE_OVERCOME" | "CROSS_FUNCTIONAL" | "FEEDBACK_RECEIVED" | "DEVELOPMENT_ACTIVITY">("ACHIEVEMENT");
  const createReflection = trpc.reflection.create.useMutation({
    onSuccess: () => {
      toast.success("Reflection saved");
      setOpen(false);
      setText("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Self-Reflections</h1>
          <p className="text-muted-foreground">Your private journal and achievements</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Reflection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Self-Reflection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACHIEVEMENT">Achievement</SelectItem>
                    <SelectItem value="LEARNING">Learning</SelectItem>
                    <SelectItem value="CHALLENGE_OVERCOME">Challenge Overcome</SelectItem>
                    <SelectItem value="CROSS_FUNCTIONAL">Cross-Functional</SelectItem>
                    <SelectItem value="FEEDBACK_RECEIVED">Feedback Received</SelectItem>
                    <SelectItem value="DEVELOPMENT_ACTIVITY">Development Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reflection</Label>
                <div className="relative">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Share your thoughts..."
                    rows={6}
                  />
                  <div className="absolute top-2 right-2">
                    <VoiceInput onTranscript={(transcript) => setText(text + " " + transcript)} />
                  </div>
                </div>
              </div>
              <DocumentUpload
                onUploadComplete={(fileUrl, fileName, fileType) => {
                  toast.success("Document uploaded: " + fileName);
                }}
                acceptedTypes=".pdf,.doc,.docx,.txt"
              />
              <Button
                onClick={() => {
                  createReflection.mutate({
                    tenantId: 1,
                    type,
                    text,
                    visibility: "PRIVATE_DRAFT",
                  });
                }}
                disabled={!text.trim()}
              >
                Save Reflection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {reflections && reflections.length > 0 ? (
        <div className="space-y-4">
          {reflections.map((reflection) => (
            <Card key={reflection.id}>
              <CardHeader>
                <CardTitle className="text-base">{reflection.type}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{reflection.text}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(reflection.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No reflections yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}