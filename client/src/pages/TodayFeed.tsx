import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, TrendingUp, Users, Target, Calendar, Plus } from "lucide-react";
import { Link } from "wouter";

export default function TodayFeed() {
  // `retry: 1` so a flaky profile call doesn't keep the skeleton visible
  // through 3+ retries. `isError` lets us render a fallback instead of
  // spinning forever when the query returns a real error.
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    error: profileErrorObj,
  } = trpc.person.getMyProfile.useQuery(undefined, { retry: 1 });
  const { data: notifications } = trpc.notification.getMyNotifications.useQuery({ tenantId: 1, limit: 10 });
  const { data: directReports } = trpc.person.getDirectReports.useQuery();
  const { data: recentObservations } = trpc.observation.getRecent.useQuery({ tenantId: 1, limit: 5 });

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-32 w-full"></div>
        <div className="skeleton h-64 w-full"></div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome</h1>
          <p className="text-muted-foreground">
            We couldn't load your profile. {profileErrorObj?.message ?? ""}
          </p>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Try refreshing the page. If the problem persists, ask an admin to confirm your account
            has been set up in the tenant.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Good {getTimeOfDay()}, {profile?.name || "there"}
          </h1>
          <p className="text-muted-foreground">
            {profile?.currentRole?.title || "Welcome to APEX"}
          </p>
        </div>
        <Link href="/capture">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Quick Capture
          </Button>
        </Link>
      </div>

      {/* Priority Notifications */}
      {notifications && notifications.length > 0 && (
        <Card className="border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-accent" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.slice(0, 3).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    notification.isRead ? "bg-muted/30" : "bg-accent/10 border-accent"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          icon={<Users className="h-6 w-6" />}
          title="Team"
          description={`${directReports?.length || 0} direct reports`}
          href="/people"
          color="accent"
        />
        <QuickActionCard
          icon={<Target className="h-6 w-6" />}
          title="Goals"
          description="Track progress"
          href="/goals"
          color="primary"
        />
        <QuickActionCard
          icon={<TrendingUp className="h-6 w-6" />}
          title="Analytics"
          description="View insights"
          href="/analytics"
          color="success"
        />
        <QuickActionCard
          icon={<Calendar className="h-6 w-6" />}
          title="Meetings"
          description="Upcoming 1:1s"
          href="/meetings"
          color="warning"
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Observations</CardTitle>
          <CardDescription>Latest feedback and observations across your team</CardDescription>
        </CardHeader>
        <CardContent>
          {recentObservations && recentObservations.length > 0 ? (
            <div className="space-y-4">
              {recentObservations.map((observation) => (
                <div key={observation.id} className={`border-l-4 pl-4 py-2 ${
                  observation.direction === "POSITIVE" ? "border-green-500" :
                  observation.direction === "NEEDS_IMPROVEMENT" ? "border-amber-500" :
                  "border-gray-300"
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {observation.direction === "POSITIVE" ? "✓" : observation.direction === "NEEDS_IMPROVEMENT" ? "⚠" : "•"}{" "}
                        {observation.templateUsed || "Observation"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{observation.text}</p>
                      {observation.valueTags && observation.valueTags.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {(observation.valueTags as string[]).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {formatRelativeTime(observation.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recent observations</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/capture">Capture your first observation</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct Reports (for managers) */}
      {directReports && directReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Team</CardTitle>
            <CardDescription>Direct reports and their data sufficiency levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {directReports.map((report: any) => (
                <Link key={report.id} href={`/people/${report.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="font-medium text-accent-foreground">
                          {report.name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-muted-foreground">{report.role?.title}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <DataSufficiencyBadge level={report.dataSufficiencyLevel || 0} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {report.evidenceCount || 0} observations
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuickActionCard({ icon, title, description, href, color }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className={`text-${color}`}>{icon}</div>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function DataSufficiencyBadge({ level }: { level: number }) {
  const labels = ["Cold Start", "Initial Signal", "Emerging Pattern", "Reliable Intelligence", "High Confidence"];
  const colors = ["bg-gray-500", "bg-blue-500", "bg-yellow-500", "bg-green-500", "bg-emerald-600"];
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full text-white ${colors[level] || colors[0]}`}>
      Level {level}: {labels[level] || labels[0]}
    </span>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatRelativeTime(date: Date | string) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}
