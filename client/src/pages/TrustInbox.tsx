/**
 * /trust — Personal Trust Layer inbox.
 *
 * Three sections:
 *   1. Insights about me — what AI has flagged about my work/role
 *   2. Memories about me — facts/patterns the system holds; verify or reject
 *   3. Entry views — who has opened my journals / reflections
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Eye, ShieldCheck, Sparkles, Check, X, Brain } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function TrustInbox() {
  const { data: insightsAboutMe } = trpc.insights.insightsAboutMe.useQuery();
  const { data: memoriesAboutMe, refetch: refetchMemories } = trpc.memory.aboutMe.useQuery();
  const { data: entryViews } = trpc.trust.whoSawMyEntries.useQuery({ days: 30 });
  const verify = trpc.memory.verify.useMutation({
    onSuccess: () => {
      refetchMemories();
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> Trust inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Full transparency into what AI knows about you and who has seen your entries.
        </p>
      </div>

      <Tabs defaultValue="insights">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="insights" className="gap-1">
            <Sparkles className="w-3 h-3" /> Insights
          </TabsTrigger>
          <TabsTrigger value="memories" className="gap-1">
            <Brain className="w-3 h-3" /> Memories
          </TabsTrigger>
          <TabsTrigger value="views" className="gap-1">
            <Eye className="w-3 h-3" /> Views
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-2 pt-3">
          {!insightsAboutMe || insightsAboutMe.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No insights about you yet.</CardContent></Card>
          ) : (
            insightsAboutMe.map(i => (
              <Card key={i.id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{i.insightType.replace(/_/g, " ")}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{i.severity}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(i.createdAt))}
                    </span>
                  </div>
                  <p className="text-sm">{i.insightText}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="memories" className="space-y-2 pt-3">
          {!memoriesAboutMe || memoriesAboutMe.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No memories stored about you yet.</CardContent></Card>
          ) : (
            memoriesAboutMe.map(m => (
              <Card key={m.id} className={m.needsVerification ? "border-amber-500/30" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{Math.round(Number(m.confidence ?? "0") * 100)}% confidence</Badge>
                    {m.needsVerification && <Badge variant="outline" className="text-[10px] text-amber-600">Needs verification</Badge>}
                    {m.verified && <Badge variant="outline" className="text-[10px] text-emerald-600">Verified</Badge>}
                  </div>
                  <div>
                    <div className="text-xs font-medium">{m.memoryKey}</div>
                    <p className="text-sm">{m.memoryValue}</p>
                  </div>
                  {m.rationale && (
                    <p className="text-xs text-muted-foreground italic">{m.rationale}</p>
                  )}
                  {m.needsVerification && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => verify.mutate({ memoryId: m.id, approve: true })}>
                        <Check className="w-3 h-3" /> Verify
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-600" onClick={() => verify.mutate({ memoryId: m.id, approve: false })}>
                        <X className="w-3 h-3" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="views" className="space-y-2 pt-3">
          {!entryViews || entryViews.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No views recorded in the last 30 days.</CardContent></Card>
          ) : (
            entryViews.map(v => (
              <Card key={v.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {v.viewerPhoto && <AvatarImage src={v.viewerPhoto} alt={v.viewerName} />}
                    <AvatarFallback className="text-[10px]">
                      {v.viewerName.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{v.viewerName}</div>
                    <div className="text-xs text-muted-foreground">
                      Viewed your {v.entityType} #{v.entityId}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(v.viewedAt))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
