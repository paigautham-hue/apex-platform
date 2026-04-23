/**
 * /team — Universal manager view of direct reports.
 *
 * Fractal: a Chairman sees CXOs+CEOs; a CEO sees their leadership team;
 * a CXO sees their function leads. Same UI for every tier.
 *
 *   - PrimaryActionCard at top
 *   - Submission status grid: who's logged, who's rated, who's pending
 *   - Direct reports as clickable cards → drill into their /me view via PersonProfile
 *   - Quick actions: "Run AI panel", "Open 1:1 prep"
 */

import { useViewer } from "@/hooks/useViewer";
import PrimaryActionCard from "@/components/PrimaryActionCard";
import CycleStatusBanner from "@/components/CycleStatusBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

const TENANT_ID = 1;

export default function Team() {
  const { viewer, isLoading } = useViewer();
  const [, navigate] = useLocation();

  const { data: directReports = [] } = trpc.scope.listDirectReports.useQuery();
  const { data: teamStatus = [] } = trpc.scope.getTeamSubmissionStatus.useQuery();
  const { data: activeCycle } = trpc.governance.getActiveCycle.useQuery({ tenantId: TENANT_ID });
  const cycleId = activeCycle?.id ?? 0;

  const statusByPerson = useMemo(() => {
    const m = new Map<number, typeof teamStatus[number]>();
    for (const s of teamStatus) m.set(s.personId, s);
    return m;
  }, [teamStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!viewer) return null;

  if (directReports.length === 0) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto px-4 md:px-6 py-4">
        <CycleStatusBanner />
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <UsersRound className="h-10 w-10 text-muted-foreground mx-auto" />
            <div className="text-base font-medium">You don't have any direct reports.</div>
            <div className="text-sm text-muted-foreground">
              When people report to your role, they'll appear here so you can run cycles, see status, and assess them.
            </div>
            <Button variant="outline" onClick={() => navigate("/me")}>
              Back to My Bridge
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UsersRound className="w-6 h-6" />
            Your team
          </h1>
          <p className="text-sm text-muted-foreground">
            {directReports.length} direct report{directReports.length === 1 ? "" : "s"}
            {activeCycle && ` · cycle ${activeCycle.month}`}
          </p>
        </div>
      </div>

      <CycleStatusBanner />
      <PrimaryActionCard scope="team" viewerPersonId={viewer.personId} viewerName={viewer.personName} />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {directReports.map(member => (
          <DirectReportCard
            key={member.personId}
            member={member}
            status={statusByPerson.get(member.personId)}
            onOpen={() => navigate(`/people/${member.personId}`)}
          />
        ))}
      </div>
    </div>
  );
}

interface MemberRow {
  personId: number;
  name: string;
  photoUrl: string | null;
  roleTitle: string | null;
  roleType: string | null;
  orgUnitName: string | null;
}

interface SubmissionStatus {
  personId: number;
  status: "SUBMITTED" | "IN_PROGRESS" | "PENDING" | "OVERDUE" | "NO_CYCLE";
  journaled: boolean;
  rated: boolean;
  submitted: boolean;
  submittedCount: number;
  totalMandates: number;
}

function DirectReportCard({
  member,
  status,
  onOpen,
}: {
  member: MemberRow;
  status?: SubmissionStatus;
  onOpen: () => void;
}) {
  // Skip badge entirely if no cycle; otherwise render real status
  const submissionState = status?.status ?? "PENDING";
  const showBadge = submissionState !== "NO_CYCLE";

  const StateIcon =
    submissionState === "SUBMITTED"
      ? CheckCircle2
      : submissionState === "OVERDUE"
        ? AlertCircle
        : submissionState === "IN_PROGRESS"
          ? Clock
          : Clock;
  const stateClass =
    submissionState === "SUBMITTED"
      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/40"
      : submissionState === "OVERDUE"
        ? "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/40"
        : submissionState === "IN_PROGRESS"
          ? "text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/40"
          : "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/40";
  const stateLabel =
    submissionState === "IN_PROGRESS" && status
      ? `${status.submittedCount}/${status.totalMandates} rated`
      : submissionState;

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
            <AvatarFallback>
              {member.name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{member.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {member.roleTitle ?? member.roleType ?? "—"}
            </div>
            {member.orgUnitName && (
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">{member.orgUnitName}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {showBadge ? (
            <Badge variant="outline" className={`text-[10px] gap-1 ${stateClass}`}>
              <StateIcon className="w-3 h-3" aria-hidden="true" />
              <span>{stateLabel}</span>
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">No active cycle</span>
          )}
          <Button size="sm" variant="ghost" className="gap-1 h-9 min-h-9 text-xs" onClick={onOpen}>
            Open
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
