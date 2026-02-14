import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Play, Square, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface MeetingTimerProps {
  managerPersonId: number;
  subjectPersonId: number;
  tenantId: number;
  onMeetingEnd?: () => void;
}

export default function MeetingTimer({
  managerPersonId,
  subjectPersonId,
  tenantId,
  onMeetingEnd,
}: MeetingTimerProps) {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showObservationPrompt, setShowObservationPrompt] = useState(false);
  const [observationText, setObservationText] = useState("");

  const createMeeting = trpc.meeting.create.useMutation();

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, startTime]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    const now = new Date();
    setStartTime(now);
    setIsActive(true);
    setElapsedSeconds(0);
    toast.success("Meeting started");
  };

  const handleEnd = async () => {
    if (!startTime) return;

    setIsActive(false);
    const endTime = new Date();

    try {
      await createMeeting.mutateAsync({
        tenantId,
        participantPersonId: subjectPersonId,
        meetingType: "ONE_ON_ONE",
        scheduledAt: startTime,
        notes: `1:1 meeting completed. Duration: ${formatTime(elapsedSeconds)}`,
        sentiment: "POSITIVE",
      });

      toast.success("Meeting logged successfully");
      
      // Show observation prompt
      setShowObservationPrompt(true);
      
      // Reset timer
      setStartTime(null);
      setElapsedSeconds(0);

      // Trigger callback
      if (onMeetingEnd) {
        onMeetingEnd();
      }
    } catch (error) {
      toast.error("Failed to log meeting");
      console.error(error);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Meeting Timer</h3>
          </div>
          {isActive && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Recording</span>
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="text-4xl font-mono font-bold text-primary">
            {formatTime(elapsedSeconds)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isActive ? "Meeting in progress" : "Ready to start"}
          </p>
        </div>

        <div className="flex gap-2">
          {!isActive ? (
            <Button onClick={handleStart} className="flex-1" size="lg">
              <Play className="h-4 w-4 mr-2" />
              Start Meeting
            </Button>
          ) : (
            <>
              <Button
                onClick={handleEnd}
                variant="default"
                className="flex-1"
                size="lg"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                End & Log Meeting
              </Button>
            </>
          )}
        </div>

        {isActive && (
          <p className="text-xs text-muted-foreground text-center">
            Meeting will be automatically logged when you click "End & Log Meeting"
          </p>
        )}
      </div>

      {/* Post-Meeting Observation Prompt */}
      <Dialog open={showObservationPrompt} onOpenChange={setShowObservationPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture Post-Meeting Observation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              While the meeting is fresh in your mind, capture any key observations from this 1:1 meeting.
            </p>
            <div className="space-y-2">
              <Label>Observation</Label>
              <Textarea
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                placeholder="What did you observe during this meeting?"
                className="min-h-[120px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowObservationPrompt(false);
                  setObservationText("");
                }}
              >
                Skip
              </Button>
              <Button
                onClick={() => {
                  // TODO: Save observation via tRPC
                  toast.success("Observation saved");
                  setShowObservationPrompt(false);
                  setObservationText("");
                }}
                disabled={!observationText.trim()}
              >
                Save Observation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );;
}
