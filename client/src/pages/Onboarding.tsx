import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Building2,
  Users,
  BookOpen,
  Sparkles,
  Target,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { VoiceInput } from "@/components/VoiceInput";

const TENANT_ID = 1;

const STEPS = [
  { id: 1, title: "Welcome", icon: Sparkles, description: "Let's get you set up" },
  { id: 2, title: "Your Profile", icon: User, description: "Tell us about yourself" },
  { id: 3, title: "Your Organization", icon: Building2, description: "Set your context" },
  { id: 4, title: "First Observation", icon: BookOpen, description: "Capture your first insight" },
  { id: 5, title: "All Set!", icon: CheckCircle, description: "You're ready to go" },
];

type FormData = {
  displayName: string;
  role: string;
  reportingTo: string;
  orgUnitId: string;
  firstObservation: string;
  observationPersonId: string;
};

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    displayName: user?.name ?? "",
    role: "",
    reportingTo: "",
    orgUnitId: "",
    firstObservation: "",
    observationPersonId: "",
  });

  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: TENANT_ID });
  const { data: persons } = trpc.person.list.useQuery({ tenantId: TENANT_ID });

  const completeOnboarding = trpc.preferences.completeOnboarding.useMutation({
    onSuccess: () => {
      navigate("/today");
    },
    onError: (err) => toast.error(err.message),
  });

  const createObservation = trpc.observation.create.useMutation({
    onSuccess: () => {
      toast.success("First observation captured!");
    },
    onError: () => {
      // Non-blocking — user can still proceed
    },
  });

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  const handleNext = async () => {
    if (step === 2 && !form.displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (step === 4 && form.firstObservation.trim().length > 0 && form.observationPersonId) {
      // Save the observation before moving to final step
      createObservation.mutate({
        tenantId: TENANT_ID,
        subjectPersonId: parseInt(form.observationPersonId, 10),
        text: form.firstObservation,
        direction: "POSITIVE",
        source: "QUICK_NOTE",
      });
    }
    if (step < STEPS.length) {
      setStep((s) => s + 1);
    }
  };

  const handleFinish = () => {
    completeOnboarding.mutate();
  };

  const handleSkip = () => {
    completeOnboarding.mutate();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Target className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">APEX</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            {STEPS.map((s) => (
              <span
                key={s.id}
                className={step >= s.id ? "text-primary font-medium" : ""}
              >
                {s.title}
              </span>
            ))}
          </div>
        </div>

        {/* Step Cards */}
        {step === 1 && (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Welcome to APEX</CardTitle>
              <CardDescription className="text-base">
                Your AI-powered executive excellence platform. Let's take 2 minutes to set up your workspace so you can get the most out of every feature.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: BookOpen, label: "Capture observations", color: "text-blue-500" },
                  { icon: Target, label: "Track goals & plans", color: "text-green-500" },
                  { icon: Users, label: "Manage your team", color: "text-purple-500" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="p-4 rounded-lg bg-muted space-y-2">
                    <Icon className={`h-6 w-6 mx-auto ${color}`} />
                    <p className="text-sm font-medium">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Logged in as <span className="font-medium text-foreground">{user?.email ?? user?.name ?? "you"}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Your Profile</CardTitle>
                  <CardDescription>How should APEX address you?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name <span className="text-destructive">*</span></Label>
                <Input
                  id="display-name"
                  placeholder="e.g. Gautam Pai"
                  value={form.displayName}
                  onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-title">Your Role / Title</Label>
                <Input
                  id="role-title"
                  placeholder="e.g. Group CEO, CHRO, Portfolio Director"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reporting-to">Reports To (optional)</Label>
                <Select
                  value={form.reportingTo}
                  onValueChange={(v) => setForm((p) => ({ ...p, reportingTo: v }))}
                >
                  <SelectTrigger id="reporting-to">
                    <SelectValue placeholder="Select your manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {(persons ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Your Organization</CardTitle>
                  <CardDescription>Which part of the portfolio are you responsible for?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-unit">Primary Org Unit / Company</Label>
                <Select
                  value={form.orgUnitId}
                  onValueChange={(v) => setForm((p) => ({ ...p, orgUnitId: v }))}
                >
                  <SelectTrigger id="org-unit">
                    <SelectValue placeholder="Select your primary org unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {(orgUnits ?? []).map((ou) => (
                      <SelectItem key={ou.id} value={String(ou.id)}>
                        <span className="flex items-center gap-2">
                          {ou.name}
                          <Badge variant="outline" className="text-xs">{ou.type.replace("_", " ")}</Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">What APEX will do for you:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Surface relevant observations and insights for your portfolio</li>
                  <li>Track goals and financial metrics for your org units</li>
                  <li>Generate AI-powered insights tailored to your context</li>
                  <li>Prepare you for 1:1s and performance reviews automatically</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Capture Your First Observation</CardTitle>
                  <CardDescription>
                    Observations are the core of APEX — capture what you see, hear, and notice about your team.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="obs-person">About whom? (optional)</Label>
                <Select
                  value={form.observationPersonId}
                  onValueChange={(v) => setForm((p) => ({ ...p, observationPersonId: v }))}
                >
                  <SelectTrigger id="obs-person">
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {(persons ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs-content">Your observation</Label>
                <div className="flex gap-2 items-start">
                  <Textarea
                    id="obs-content"
                    placeholder="e.g. Showed strong ownership during the board presentation — handled tough questions with confidence and data. This is a pattern I want to track."
                    value={form.firstObservation}
                    onChange={(e) => setForm((p) => ({ ...p, firstObservation: e.target.value }))}
                    rows={5}
                    className="resize-none flex-1"
                  />
                  <VoiceInput
                    onTranscript={(text) =>
                      setForm((p) => ({ ...p, firstObservation: p.firstObservation ? `${p.firstObservation} ${text}` : text }))
                    }
                    buttonVariant="outline"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can also skip this and capture observations later from the Capture page.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-2xl">You're all set!</CardTitle>
              <CardDescription className="text-base">
                APEX is ready to help you lead with clarity and confidence. Here's what to explore first:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    icon: BookOpen,
                    title: "Today Feed",
                    desc: "Your daily briefing — priorities, insights, and actions",
                    path: "/today",
                    color: "text-blue-500",
                  },
                  {
                    icon: Users,
                    title: "People",
                    desc: "Browse your team and view observation histories",
                    path: "/people",
                    color: "text-purple-500",
                  },
                  {
                    icon: Target,
                    title: "Goals",
                    desc: "Set and track strategic goals for yourself and your team",
                    path: "/goals",
                    color: "text-green-500",
                  },
                ].map(({ icon: Icon, title, desc, color }) => (
                  <div key={title} className="flex items-center gap-4 p-3 rounded-lg bg-muted">
                    <Icon className={`h-5 w-5 ${color} shrink-0`} />
                    <div>
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {step < STEPS.length && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                Skip setup
              </Button>
            )}
          </div>

          {step < STEPS.length ? (
            <Button onClick={handleNext} disabled={createObservation.isPending}>
              {step === STEPS.length - 1 ? "Almost done" : "Continue"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={completeOnboarding.isPending}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              {completeOnboarding.isPending ? "Loading…" : "Go to APEX →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
