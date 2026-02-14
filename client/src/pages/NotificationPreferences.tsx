import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Clock, Zap } from "lucide-react";

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState({
    priorityZero: true,
    insights: true,
    reminders: true,
    milestones: true,
    pulseCheck: true,
    achievementSuggestions: true,
    browserPush: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    maxPerDay: "3",
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    // TODO: Save to backend via tRPC
    toast.success("Notification preferences saved");
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Customize which notifications you receive and when
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive (max 3 priority notifications per day)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="priority-zero" className="text-base">
                Priority Zero Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Urgent cross-portfolio priorities requiring immediate attention
              </p>
            </div>
            <Switch
              id="priority-zero"
              checked={preferences.priorityZero}
              onCheckedChange={() => handleToggle("priorityZero")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="insights" className="text-base">
                AI Insights
              </Label>
              <p className="text-sm text-muted-foreground">
                Data changes, pattern alerts, and upcoming events
              </p>
            </div>
            <Switch
              id="insights"
              checked={preferences.insights}
              onCheckedChange={() => handleToggle("insights")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reminders" className="text-base">
                Reminders
              </Label>
              <p className="text-sm text-muted-foreground">
                1:1 prep, review deadlines, and follow-ups
              </p>
            </div>
            <Switch
              id="reminders"
              checked={preferences.reminders}
              onCheckedChange={() => handleToggle("reminders")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="milestones" className="text-base">
                Milestone Assessments
              </Label>
              <p className="text-sm text-muted-foreground">
                30/60/90/180/365 day milestone reminders
              </p>
            </div>
            <Switch
              id="milestones"
              checked={preferences.milestones}
              onCheckedChange={() => handleToggle("milestones")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pulse-check" className="text-base">
                Weekly Pulse Check
              </Label>
              <p className="text-sm text-muted-foreground">
                Reminders to complete weekly team pulse check
              </p>
            </div>
            <Switch
              id="pulse-check"
              checked={preferences.pulseCheck}
              onCheckedChange={() => handleToggle("pulseCheck")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="achievement-suggestions" className="text-base">
                Achievement Suggestions
              </Label>
              <p className="text-sm text-muted-foreground">
                AI-suggested achievements for self-reflection
              </p>
            </div>
            <Switch
              id="achievement-suggestions"
              checked={preferences.achievementSuggestions}
              onCheckedChange={() => handleToggle("achievementSuggestions")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Browser Push Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications even when APEX is not open
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="browser-push" className="text-base">
                Enable Browser Push
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified for Priority Zero alerts and urgent items
              </p>
            </div>
            <Switch
              id="browser-push"
              checked={preferences.browserPush}
              onCheckedChange={() => handleToggle("browserPush")}
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
          <CardDescription>
            Set times when you don't want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quiet-start">Start Time</Label>
              <Select
                value={preferences.quietHoursStart}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, quietHoursStart: value }))
                }
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
                value={preferences.quietHoursEnd}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, quietHoursEnd: value }))
                }
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
              value={preferences.maxPerDay}
              onValueChange={(value) =>
                setPreferences((prev) => ({ ...prev, maxPerDay: value }))
              }
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
        <Button onClick={handleSave} size="lg">
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
