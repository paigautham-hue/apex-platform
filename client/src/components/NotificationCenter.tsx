import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, AlertCircle, TrendingUp, Calendar, Award, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: notifications } = trpc.notification.getMyNotifications.useQuery({ tenantId: 1 });
  const markAsRead = trpc.notification.markAsRead.useMutation();

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;
  const topNotifications = notifications?.slice(0, 3) || [];
  const moreNotifications = notifications?.slice(3) || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "PRIORITY_ZERO":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "INSIGHT":
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      case "REMINDER":
        return <Calendar className="h-5 w-5 text-amber-600" />;
      case "MILESTONE":
        return <Award className="h-5 w-5 text-green-600" />;
      case "PULSE_CHECK":
        return <Target className="h-5 w-5 text-purple-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead.mutateAsync({ notificationId: notification.id });
    }

    // Navigate based on notification type
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {topNotifications.length > 0 ? (
            <>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Top Priority (Max 3/day)</h3>
                {topNotifications.map((notification: any) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      notification.isRead
                        ? "bg-background hover:bg-accent"
                        : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {moreNotifications.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">More</h3>
                  {moreNotifications.map((notification: any) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        notification.isRead
                          ? "bg-background hover:bg-accent"
                          : "bg-accent hover:bg-accent/80"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}
        </div>

        {notifications && notifications.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Budget: {topNotifications.length}/3 priority notifications today
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
