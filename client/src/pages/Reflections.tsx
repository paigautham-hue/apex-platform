import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Reflections() {
  const { data: reflections } = trpc.reflection.getMyReflections.useQuery({ tenantId: 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Self-Reflections</h1>
          <p className="text-muted-foreground">Your private journal and achievements</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Reflection
        </Button>
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