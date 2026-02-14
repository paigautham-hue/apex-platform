import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Meetings() {
  const { data: meetings } = trpc.meeting.getMyMeetings.useQuery({ tenantId: 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Meetings</h1>
          <p className="text-muted-foreground">1:1s and team meetings</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Start Meeting
        </Button>
      </div>

      {meetings && meetings.length > 0 ? (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader>
                <CardTitle className="text-base">{meeting.type}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {new Date(meeting.startedAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No meetings yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}