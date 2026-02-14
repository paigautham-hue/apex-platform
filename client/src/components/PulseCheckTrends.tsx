import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subWeeks } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PulseCheckTrendsProps {
  personId: number;
  tenantId: number;
  weeksToShow?: number;
}

export default function PulseCheckTrends({
  personId,
  tenantId,
  weeksToShow = 12,
}: PulseCheckTrendsProps) {
  const { data: observations, isLoading } = trpc.observation.getByPerson.useQuery({
    personId,
    tenantId,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  // Filter pulse check observations (weekly check-ins)
  const pulseChecks = observations?.filter((obs) =>
    obs.text.toLowerCase().includes("pulse") || obs.text.toLowerCase().includes("weekly check")
  ) || [];

  // Group by week
  const weeklyData: Record<string, { positive: number; neutral: number; negative: number }> = {};
  
  pulseChecks.forEach((obs) => {
    const weekKey = format(new Date(obs.createdAt), "MMM d");
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { positive: 0, neutral: 0, negative: 0 };
    }

    if (obs.direction === "POSITIVE") {
      weeklyData[weekKey].positive++;
    } else if (obs.direction === "NEEDS_IMPROVEMENT") {
      weeklyData[weekKey].negative++;
    } else {
      weeklyData[weekKey].neutral++;
    }
  });

  const chartData = Object.entries(weeklyData)
    .map(([week, counts]) => ({
      week,
      positive: counts.positive,
      neutral: counts.neutral,
      negative: counts.negative,
      total: counts.positive + counts.neutral + counts.negative,
    }))
    .slice(-weeksToShow);

  // Calculate trend
  const recentWeeks = chartData.slice(-4);
  const olderWeeks = chartData.slice(-8, -4);
  
  const recentAvg = recentWeeks.reduce((sum, w) => sum + w.positive, 0) / (recentWeeks.length || 1);
  const olderAvg = olderWeeks.reduce((sum, w) => sum + w.positive, 0) / (olderWeeks.length || 1);
  
  const trend = recentAvg > olderAvg ? "up" : recentAvg < olderAvg ? "down" : "stable";

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Pulse Check Trends</h3>
            <p className="text-sm text-muted-foreground">
              Last {weeksToShow} weeks
            </p>
          </div>
          <div className="flex items-center gap-2">
            {trend === "up" && (
              <>
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">Improving</span>
              </>
            )}
            {trend === "down" && (
              <>
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Declining</span>
              </>
            )}
            {trend === "stable" && (
              <>
                <Minus className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Stable</span>
              </>
            )}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="positive"
                stroke="#22c55e"
                strokeWidth={2}
                name="Doing Great"
              />
              <Line
                type="monotone"
                dataKey="neutral"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Something to Note"
              />
              <Line
                type="monotone"
                dataKey="negative"
                stroke="#ef4444"
                strokeWidth={2}
                name="Needs Attention"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No pulse check data available yet.</p>
            <p className="text-sm mt-2">Start conducting weekly pulse checks to see trends.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
