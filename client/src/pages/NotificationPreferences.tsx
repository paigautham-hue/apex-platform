import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Bell, Clock, Zap, Save, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

type PrefsState = {
  notifyPriorityZero: boolean;
  notifyInsights: boolean;
  notifyReminders: boolean;
  notifyMilestones: boolean;
  notifyPulseCheck: boolean;
  notifyAchievementSuggestions: boolean;
  notifyBrowserPush: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxNotificationsPerDay: number;
};

const DEFAULTS: PrefsState = {
  notifyPriorityZero: true,
  notifyInsights: true,
  notifyReminders: true,
  notifyMilestones: true,
  notifyPulseCheck: true,
  notifyAchievementSuggestions: true,
  notifyBrowserPush: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  maxNotificationsPerDay: 3,
};

export default function NotificationPreferences() {
  const utils = trpc.useUtils();
  const [prefs, setPrefs] = useState<PrefsState>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  const { data: savedPrefs, isLoading } = trpc.preferences.get.useQuery();

  // Sync server data into local state when loaded
  useEffect(() => {
    if (savedPrefs) {
      setPrefs({
        notifyPriorityZero: savedPrefs.notifyPriorityZero,
        notifyInsights: savedPrefs.notifyInsights,
        notifyReminders: savedPrefs.notifyReminders,
        notifyMilestones: savedPrefs.notifyMilestones,
        notifyPulseCheck: savedPrefs.notifyPulseCheck,
        notifyAchievementSuggestions: savedPrefs.notifyAchievementSuggestions,
        notifyBrowserPush: savedPrefs.notifyBrowserPush,
        quietHoursStart: savedPrefs.quietHoursStart,
        quietHoursEnd: savedPrefs.quietHoursEnd,
        maxNotificationsPerDay: savedPrefs.maxNotificationsPerDay,
      });
      setDirty(false);
    }
  }, [savedPrefs]);

  const savePrefs = trpc.preferences.save.useMutation({
    onSuccess: () => {
      toast.success("Notification preferences saved");
      setDirty(false);
      utils.preferences.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggle = (key: keyof PrefsState) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setDirty(true);
  };

  const setField = (key: keyof PrefsState, value: string | number) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    savePrefs.mutate({
      notifyPriorityZero: prefs.notifyPriorityZero,
      notifyInsights: prefs.notifyInsights,
      notifyReminders: prefs.notifyReminders,
      notifyMilestones: prefs.notifyMilestones,
      notifyPulseCheck: prefs.notifyPulseCheck,
      notifyAchievementSuggestions: prefs.notifyAchievementSuggestions,
      notifyBrowserPush: prefs.notifyBrowserPush,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      maxNotificationsPerDay: prefs.maxNotificationsPerDay,
    });
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Preferences</h1>
          <p className="text-muted-foreground mt-2">
            Customize which notifications you receive and when
          </p>
        </div>
        {!dirty && savedPrefs && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle className="h-4 w-4" />
            Saved
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            {
              key: "notifyPriorityZero" as const,
              id: "priority-zero",
              label: "Priority Zero Alerts",
              desc: "Urgent cross-portfolio priorities requiring immediate attention",
            },
            {
              key: "notifyInsights" as const,
              id: "insights",
              label: "AI Insights",
              desc: "Data changes, pattern alerts, and upcoming events",
            },
            {
              key: "notifyReminders" as const,
              id: "reminders",
              label: "Reminders",
              desc: "1:1 prep, review deadlines, and follow-ups",
            },
            {
              key: "notifyMilestones" as const,
              id: "milestones",
              label: "Milestone Assessments",
              desc: "30/60/90/180/365 day milestone reminders",
            },
            {
              key: "notifyPulseCheck" as const,
              id: "pulse-check",
              label: "Weekly Pulse Check",
              desc: "Reminders to complete weekly team pulse check",
            },
            {
              key: "notifyAchievementSuggestions" as const,
              id: "achievement-suggestions",
              label: "Achievement Suggestions",
              desc: "AI-suggested achievements for self-reflection",
            },
          ].map(({ key, id, label, desc }) => (
            <div key={id} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={id} className="text-base cursor-pointer">
                  {label}
                </Label>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
              <Switch
                id={id}
                checked={prefs[key] as boolean}
                onCheckedChange={() => toggle(key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Browser Push Notifications
          </CardTitle>
          <CardDescription>Receive notifications even when APEX is not open</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="browser-push" className="text-base cursor-pointer">
                Enable Browser Push
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified for Priority Zero alerts and urgent items
              </p>
            </div>
            <Switch
              id="browser-push"
              checked={prefs.notifyBrowserPush}
              onCheckedChange={() => toggle("notifyBrowserPush")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Set times when you don't want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quiet-start">Start Time</Label>
              <Select
                value={prefs.quietHoursStart}
                onValueChange={(v) => setField("quietHoursStart", v)}
              >
                <SelectTrigger id="quiet-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, "0");
                    return (
                      <SelectItem key={hour} value={`${hour}:00`}>
                        {hour}:00
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quiet-end">End Time</Label>
              <Select
                value={prefs.quietHoursEnd}
                onValueChange={(v) => setField("quietHoursEnd", v)}
              >
                <SelectTrigger id="quiet-end">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, "0");
                    return (
                      <SelectItem key={hour} value={`${hour}:00`}>
                        {hour}:00
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-per-day">Maximum Priority Notifications Per Day</Label>
            <Select
              value={String(prefs.maxNotificationsPerDay)}
              onValueChange={(v) => setField("maxNotificationsPerDay", parseInt(v, 10))}
            >
              <SelectTrigger id="max-per-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 notification</SelectItem>
                <SelectItem value="2">2 notifications</SelectItem>
                <SelectItem value="3">3 notifications (recommended)</SelectItem>
                <SelectItem value="5">5 notifications</SelectItem>
                <SelectItem value="10">10 notifications</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          size="lg"
          disabled={savePrefs.isPending || !dirty}
        >
          {savePrefs.isPending ? (
            "Saving…"
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
