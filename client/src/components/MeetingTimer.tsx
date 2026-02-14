import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Play, Square, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
    </Card>
  );
}
