import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, ThumbsUp, AlertTriangle, Minus } from "lucide-react";
import { format } from "date-fns";

interface ObservationTimelineProps {
  personId: number;
  tenantId: number;
}

export default function ObservationTimeline({ personId, tenantId }: ObservationTimelineProps) {
  const [directionFilter, setDirectionFilter] = useState<string | null>(null);

  const { data: observations, isLoading } = trpc.observation.getByPerson.useQuery({
    personId,
    tenantId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredObservations = observations?.filter((obs) =>
    directionFilter ? obs.direction === directionFilter : true
  );

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case "POSITIVE":
        return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case "NEEDS_IMPROVEMENT":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case "POSITIVE":
        return "bg-green-100 text-green-800 border-green-200";
      case "NEEDS_IMPROVEMENT":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Button
          variant={directionFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setDirectionFilter(null)}
        >
          All
        </Button>
        <Button
          variant={directionFilter === "POSITIVE" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirectionFilter("POSITIVE")}
        >
          Positive
        </Button>
        <Button
          variant={directionFilter === "NEEDS_IMPROVEMENT" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirectionFilter("NEEDS_IMPROVEMENT")}
        >
          Needs Improvement
        </Button>
        <Button
          variant={directionFilter === "NEUTRAL" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirectionFilter("NEUTRAL")}
        >
          Neutral
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

        {filteredObservations && filteredObservations.length > 0 ? (
          filteredObservations.map((obs) => (
            <div key={obs.id} className="relative pl-14">
              {/* Timeline dot */}
              <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-background border-2 border-primary" />

              <Card className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {getDirectionIcon(obs.direction)}
                      <Badge className={getDirectionColor(obs.direction)}>
                        {obs.direction.replace("_", " ")}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(obs.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>

                    <p className="text-sm">{obs.text}</p>

                    {obs.voiceTranscript && (
                      <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
                        Voice: {obs.voiceTranscript}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No observations found{directionFilter ? " for this filter" : ""}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
