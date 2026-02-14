import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar, Users, MessageSquare, CheckCircle, Clock, Lightbulb, Mic } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Meetings() {
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [prepMode, setPrepMode] = useState(true);

  const { data: people } = trpc.person.list.useQuery({ tenantId: 1 });
  const { data: directReports } = trpc.person.getDirectReports.useQuery();
  const { data: myMeetings } = trpc.meeting.getMyMeetings.useQuery({ tenantId: 1 });
  
  const createMeetingMutation = trpc.meeting.create.useMutation({
    onSuccess: () => {
      toast.success("Meeting logged successfully!");
      setMeetingNotes("");
      setActionItems("");
      setSelectedPerson(null);
    },
  });

  // Get observations for selected person (for prep)
  const { data: personObservations } = trpc.observation.getByPerson.useQuery(
    { personId: selectedPerson!, tenantId: 1 },
    { enabled: !!selectedPerson }
  );

  const handleVoiceCapture = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Voice recognition not supported in this browser");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info("Listening...");
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setMeetingNotes(prev => prev + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      toast.error("Voice recognition error: " + event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleLogMeeting = async () => {
    if (!selectedPerson) {
      toast.error("Please select a person");
      return;
    }

    if (!meetingNotes.trim()) {
      toast.error("Please add meeting notes");
      return;
    }

    await createMeetingMutation.mutateAsync({
      tenantId: 1,
      participantPersonId: selectedPerson,
      meetingType: "ONE_ON_ONE",
      scheduledAt: new Date(),
      notes: meetingNotes,
      actionItems: actionItems.split('\n').filter(item => item.trim()),
      sentiment: "NEUTRAL",
    });
  };

  // AI-suggested talking points based on observations
  const suggestedTopics = personObservations?.slice(0, 3).map(obs => ({
    topic: obs.text.substring(0, 100) + "...",
    category: obs.direction,
  })) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          1:1 Meetings
        </h1>
        <p className="text-muted-foreground">
          Prepare for and document one-on-one meetings with your team
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={prepMode ? "default" : "outline"}
          onClick={() => setPrepMode(true)}
        >
          <Lightbulb className="h-4 w-4 mr-2" />
          Prep Mode
        </Button>
        <Button
          variant={!prepMode ? "default" : "outline"}
          onClick={() => setPrepMode(false)}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Meeting Logger
        </Button>
      </div>

      {/* Person Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedPerson?.toString()} onValueChange={(val) => setSelectedPerson(Number(val))}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a team member..." />
            </SelectTrigger>
            <SelectContent>
              {directReports?.map((person: any) => (
                <SelectItem key={person.id} value={person.id.toString()}>
                  {person.name} - {person.currentRole?.title || 'No role'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPerson && prepMode && (
        <>
          {/* AI-Suggested Talking Points */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                AI-Suggested Talking Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestedTopics.length > 0 ? (
                <div className="space-y-3">
                  {suggestedTopics.map((topic, index) => (
                    <div key={index} className="border-l-2 border-blue-600 pl-4 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-1 rounded ${
                          topic.category === 'POSITIVE' ? 'bg-green-100 text-green-800' :
                          topic.category === 'NEEDS_IMPROVEMENT' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {topic.category}
                        </span>
                      </div>
                      <p className="text-sm">{topic.topic}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recent observations. Consider capturing some observations before the meeting.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Observations Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Observations</span>
                  <span className="font-semibold">{personObservations?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Positive Feedback</span>
                  <span className="font-semibold text-green-600">
                    {personObservations?.filter((o: any) => o.direction === 'POSITIVE').length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Areas for Development</span>
                  <span className="font-semibold text-amber-600">
                    {personObservations?.filter((o: any) => o.direction === 'NEEDS_IMPROVEMENT').length || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedPerson && !prepMode && (
        <>
          {/* Meeting Logger */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Meeting Notes
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleVoiceCapture}
                >
                  <Mic className={`h-4 w-4 mr-2 ${isRecording ? 'animate-pulse' : ''}`} />
                  {isRecording ? "Stop Recording" : "Voice Capture"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Document what was discussed, decisions made, and key points..."
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                rows={8}
                className="mb-4"
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Action Items</label>
                <Textarea
                  placeholder="Enter action items (one per line)&#10;- Follow up on project X&#10;- Schedule training session&#10;- Review Q2 goals"
                  value={actionItems}
                  onChange={(e) => setActionItems(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleLogMeeting}
            disabled={createMeetingMutation.isPending}
            className="w-full"
            size="lg"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            {createMeetingMutation.isPending ? "Saving..." : "Log Meeting"}
          </Button>
        </>
      )}

      {/* Recent Meetings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {myMeetings && myMeetings.length > 0 ? (
            <div className="space-y-3">
              {myMeetings.slice(0, 5).map((meeting: any) => (
                <div key={meeting.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {people?.find((p: any) => p.id === meeting.participantPersonId)?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {new Date(meeting.scheduledAt).toLocaleDateString()}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {meeting.notes}
                  </p>
                  {meeting.actionItems && meeting.actionItems.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {meeting.actionItems.length} action items
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No meetings logged yet. Start by selecting a team member and logging your first meeting.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
