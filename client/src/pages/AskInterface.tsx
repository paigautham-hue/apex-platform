import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Send, Mic, Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { VoiceInput } from "@/components/VoiceInput";

export default function AskInterface() {
  const [question, setQuestion] = useState("");
  
  const { data: suggestions } = trpc.ask.getSuggestions.useQuery({ tenantId: 1 });
  const askQuery = trpc.ask.query.useMutation();

  const handleAsk = async () => {
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    try {
      await askQuery.mutateAsync({
        question,
        tenantId: 1,
      });
    } catch (error) {
      toast.error("Failed to process question");
    }
  };



  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          AI Ask
        </h1>
        <p className="text-muted-foreground">
          Get instant answers from your organizational intelligence
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ask Anything</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Your Question</label>
              <VoiceInput
                onTranscript={(text) => setQuestion(text)}
                buttonVariant="outline"
                buttonSize="sm"
              />
            </div>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., How is my team performing this quarter?"
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleAsk}
            disabled={!question.trim() || askQuery.isPending}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {askQuery.isPending ? "Processing..." : "Ask APEX AI"}
          </Button>
        </CardContent>
      </Card>

      {suggestions && suggestions.length > 0 && !askQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Suggested Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestion(suggestion)}
                  className="text-left h-auto py-2 px-3"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {askQuery.data && (
        <div className="space-y-4">
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  askQuery.data.confidence === "HIGH" ? "bg-green-100 text-green-700" :
                  askQuery.data.confidence === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {askQuery.data.confidence === "HIGH" ? <TrendingUp className="h-5 w-5" /> :
                   <AlertCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{askQuery.data.statusLine}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>Confidence: {askQuery.data.confidence}</span>
                    <span>•</span>
                    <span>Coverage: {askQuery.data.coverage}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {askQuery.data.topInsights.map((insight, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary font-bold">{index + 1}.</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <Streamdown>{askQuery.data.answer}</Streamdown>
              </div>
            </CardContent>
          </Card>

          {askQuery.data.suggestedActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Suggested Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {askQuery.data.suggestedActions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-accent">→</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Button
            variant="outline"
            onClick={() => {
              askQuery.reset();
              setQuestion("");
            }}
            className="w-full"
          >
            Ask Another Question
          </Button>
        </div>
      )}
    </div>
  );
}
