import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, TrendingUp, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";

export default function PersonProfile({ personId }: { personId: number }) {
  const [, setLocation] = useLocation();
  const { data: person, isLoading } = trpc.person.getById.useQuery({ personId, tenantId: 1 });
  const { data: observations } = trpc.observation.getByPerson.useQuery({ personId, tenantId: 1 });

  if (isLoading) return <div className="skeleton h-96 w-full"></div>;
  if (!person) return <div>Person not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="font-bold text-2xl">{person.name?.charAt(0) || "?"}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{person.name}</h1>
            <p className="text-muted-foreground">{person.currentRole?.title}</p>
          </div>
        </div>
        <Button onClick={() => setLocation('/meetings')}>Schedule 1:1</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Sufficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Level {person.dataSufficiencyLevel || 0}</p>
            <p className="text-sm text-muted-foreground">{person.evidenceCount || 0} observations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{person.sourceCount || 0}</p>
            <p className="text-sm text-muted-foreground">unique observers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tenure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {person.hireDate ? Math.floor((Date.now() - new Date(person.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0}
            </p>
            <p className="text-sm text-muted-foreground">months</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Observations</CardTitle>
        </CardHeader>
        <CardContent>
          {observations && observations.length > 0 ? (
            <div className="space-y-3">
              {observations.slice(0, 5).map((obs) => (
                <div key={obs.id} className="border-l-4 border-accent pl-4 py-2">
                  <p className="text-sm">{obs.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(obs.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No observations yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}