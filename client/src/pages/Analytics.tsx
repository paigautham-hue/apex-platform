import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Target, Award, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const { data: people } = trpc.person.list.useQuery({ tenantId: 1 });
  const { data: observations } = trpc.observation.getByTenant.useQuery({ tenantId: 1 });
  const { data: plans } = trpc.plan.getByTenant.useQuery({ tenantId: 1 });

  // Calculate analytics
  const totalPeople = people?.length || 0;
  const totalObservations = observations?.length || 0;
  const totalGoals = plans?.length || 0;

  // Data sufficiency distribution
  const dataSufficiencyData = people?.reduce((acc: any[], person: any) => {
    const level = person.dataSufficiencyLevel || 'INSUFFICIENT';
    const existing = acc.find(item => item.level === level);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ level, count: 1 });
    }
    return acc;
  }, []) || [];

  // Observations by month (last 6 months)
  const observationsByMonth = observations?.reduce((acc: any[], obs: any) => {
    const date = new Date(obs.createdAt);
    const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    const existing = acc.find(item => item.month === monthYear);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ month: monthYear, count: 1 });
    }
    return acc;
  }, []) || [];

  // Observation direction distribution
  const observationDirectionData = observations?.reduce((acc: any[], obs: any) => {
    const direction = obs.direction || 'NEUTRAL';
    const existing = acc.find(item => item.direction === direction);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ direction, count: 1 });
    }
    return acc;
  }, []) || [];

  // Top performers (by observation count)
  const topPerformers = people?.map((person: any) => {
    const obsCount = observations?.filter((obs: any) => obs.subjectPersonId === person.id).length || 0;
    return { name: person.name, observations: obsCount };
  }).sort((a: any, b: any) => b.observations - a.observations).slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Performance insights and organizational metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total People</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-3xl font-bold">{totalPeople}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Observations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              <span className="text-3xl font-bold">{totalObservations}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span className="text-3xl font-bold">{totalGoals}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Data Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <span className="text-3xl font-bold">
                {people && people.length > 0 
                  ? Math.round((people.filter((p: any) => p.dataSufficiencyLevel === 'SUFFICIENT' || p.dataSufficiencyLevel === 'RICH').length / people.length) * 100)
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Observations Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Observation Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={observationsByMonth.slice(-6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Data Sufficiency Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Data Sufficiency Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataSufficiencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Observation Direction */}
        <Card>
          <CardHeader>
            <CardTitle>Observation Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={observationDirectionData}
                  dataKey="count"
                  nameKey="direction"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {observationDirectionData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle>Most Observed People</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPerformers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="observations" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Key Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                {people && people.filter((p: any) => p.dataSufficiencyLevel === 'INSUFFICIENT').length > 0
                  ? `${people.filter((p: any) => p.dataSufficiencyLevel === 'INSUFFICIENT').length} people have insufficient data - consider capturing more observations`
                  : 'All team members have sufficient data coverage'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                {observations && observations.length > 0
                  ? `Average of ${Math.round(observations.length / (people?.length || 1))} observations per person`
                  : 'No observations recorded yet'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                {observationDirectionData.find((d: any) => d.direction === 'POSITIVE')?.count || 0} positive observations recorded this period
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
