import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

export default function PushNotificationSetup() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error("Error checking subscription:", error);
      }
    }
  };

  const requestPermission = async () => {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        await subscribeToPush();
        toast.success("Push notifications enabled!");
      } else {
        toast.error("Push notifications denied");
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push notifications not supported");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Generate VAPID keys on server and use public key here
      // For now, using a placeholder - in production, get from server
      const vapidPublicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xQmrpcPBblQrocBxhKRrer4HfOBivbqWGWfbCWk_GgeZrxsgLNiZA";
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      // await trpc.notification.subscribe.mutate({ subscription: JSON.stringify(subscription) });
      
      setIsSubscribed(true);
      console.log("Push subscription:", subscription);
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error("Failed to subscribe to notifications");
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        // await trpc.notification.unsubscribe.mutate();
        setIsSubscribed(false);
        toast.success("Push notifications disabled");
      }
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable notifications");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  if (!("Notification" in window)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about Priority Zero items, pulse checks, and important updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              Status: {isSubscribed ? "Enabled" : "Disabled"}
            </p>
            <p className="text-xs text-muted-foreground">
              {permission === "granted"
                ? "You'll receive notifications"
                : permission === "denied"
                ? "Notifications blocked - check browser settings"
                : "Click to enable notifications"}
            </p>
          </div>

          {permission === "granted" ? (
            isSubscribed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={unsubscribe}
                disabled={loading}
              >
                <BellOff className="h-4 w-4 mr-2" />
                Disable
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={subscribeToPush}
                disabled={loading}
              >
                <Bell className="h-4 w-4 mr-2" />
                Enable
              </Button>
            )
          ) : permission === "denied" ? (
            <p className="text-xs text-muted-foreground">
              Please enable in browser settings
            </p>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={requestPermission}
              disabled={loading}
            >
              <Bell className="h-4 w-4 mr-2" />
              Enable Notifications
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Max 3 priority notifications per day</p>
          <p>• Additional notifications in "More" section</p>
          <p>• You can disable anytime</p>
        </div>
      </CardContent>
    </Card>
  );
}
