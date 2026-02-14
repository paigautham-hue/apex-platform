import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type PulseRating = "DOING_GREAT" | "SOMETHING_TO_NOTE" | "NEEDS_ATTENTION";

export default function WeeklyPulseCheck() {
  const [ratings, setRatings] = useState<Record<number, PulseRating>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: people } = trpc.person.list.useQuery({ tenantId: 1 });
  const createObservation = trpc.observation.create.useMutation({
    onSuccess: () => {
      toast.success("Pulse check saved!");
    },
  });

  // Filter to only direct reports (mock - would use actual reporting structure)
  const directReports = people?.filter((p: any) => p.id !== 1) || [];

  const handleRating = (personId: number, rating: PulseRating) => {
    setRatings({ ...ratings, [personId]: rating });
  };

  const handleSubmit = async () => {
    const pulseChecks = Object.entries(ratings).map(([personId, rating]) => ({
      personId: parseInt(personId),
      rating,
      note: notes[parseInt(personId)] || "",
    }));

    for (const check of pulseChecks) {
      if (check.rating !== "DOING_GREAT") {
        // Create observation for yellow/red ratings
        await createObservation.mutateAsync({
          tenantId: 1,
          subjectPersonId: check.personId,
          text: `Weekly Pulse: ${check.rating}. ${check.note}`,
          direction: "NEEDS_IMPROVEMENT",
          source: "WEEKLY_PULSE",
          valueTags: ["pulse-check"],
          performanceTags: [check.rating.toLowerCase()],
        });
      }
    }

    toast.success("Weekly pulse check completed!");
    setRatings({});
    setNotes({});
  };

  const allRated = directReports.length > 0 && directReports.every((p: any) => ratings[p.id]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Weekly Pulse Check</h1>
        <p className="text-muted-foreground">
          Quick check-in on your direct reports. Takes less than 2 minutes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            How is each person doing this week? ({Object.keys(ratings).length}/{directReports.length} rated)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {directReports.map((person: any) => {
            const currentRating = ratings[person.id];
            
            return (
              <div key={person.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{person.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {person.currentRole?.title || "No role"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={currentRating === "DOING_GREAT" ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col items-center gap-2 ${
                      currentRating === "DOING_GREAT" ? "bg-green-600 hover:bg-green-700" : ""
                    }`}
                    onClick={() => handleRating(person.id, "DOING_GREAT")}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="text-sm font-medium">Doing Great</span>
                  </Button>

                  <Button
                    variant={currentRating === "SOMETHING_TO_NOTE" ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col items-center gap-2 ${
                      currentRating === "SOMETHING_TO_NOTE" ? "bg-amber-500 hover:bg-amber-600" : ""
                    }`}
                    onClick={() => handleRating(person.id, "SOMETHING_TO_NOTE")}
                  >
                    <AlertTriangle className="h-6 w-6" />
                    <span className="text-sm font-medium">Something to Note</span>
                  </Button>

                  <Button
                    variant={currentRating === "NEEDS_ATTENTION" ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col items-center gap-2 ${
                      currentRating === "NEEDS_ATTENTION" ? "bg-red-600 hover:bg-red-700" : ""
                    }`}
                    onClick={() => handleRating(person.id, "NEEDS_ATTENTION")}
                  >
                    <AlertCircle className="h-6 w-6" />
                    <span className="text-sm font-medium">Needs Attention</span>
                  </Button>
                </div>

                {currentRating && currentRating !== "DOING_GREAT" && (
                  <div className="mt-3">
                    <label className="text-sm font-medium mb-2 block">
                      Quick note (optional, but helpful):
                    </label>
                    <Textarea
                      placeholder="What's happening? What support do they need?"
                      value={notes[person.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [person.id]: e.target.value })}
                      rows={2}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {directReports.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No direct reports found. This feature is for managers only.
            </p>
          )}
        </CardContent>
      </Card>

      {directReports.length > 0 && (
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!allRated || createObservation.isPending}
          >
            {createObservation.isPending ? "Submitting..." : "Submit Pulse Check"}
          </Button>
        </div>
      )}
    </div>
  );
}
