"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Bell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Standard web push helper — converts a URL-safe base64 VAPID public key
// to a Uint8Array backed by a plain ArrayBuffer, as required by
// PushManager.subscribe()'s applicationServerKey field.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type SupportState = "checking" | "supported" | "unsupported" | "notConfigured";
type PermissionState = "default" | "granted" | "denied" | "unknown";

const noSubscription = () => () => {};

/** Browser capability, read once on the client; the server renders "checking". */
function useBrowserPush(): { supported: boolean | null; permission: PermissionState } {
  const supported = useSyncExternalStore(
    noSubscription,
    () => "serviceWorker" in navigator && "PushManager" in window,
    () => null
  );
  const permission = useSyncExternalStore(
    noSubscription,
    () => ("Notification" in window ? (Notification.permission as PermissionState) : "unknown"),
    () => "unknown" as PermissionState
  );
  return { supported, permission };
}

export function NotificationSettings() {
  const t = useTranslations("settings.pushNotifications");
  const browser = useBrowserPush();
  const [serverSupport, setServerSupport] = useState<SupportState>("checking");
  // Set once the user answered the permission prompt in this session
  const [requestedPermission, setPermission] = useState<PermissionState | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const support: SupportState =
    browser.supported === null ? "checking" : browser.supported ? serverSupport : "unsupported";
  const permission = requestedPermission ?? browser.permission;

  // On mount: check the server configuration and the current subscription
  useEffect(() => {
    if (!browser.supported) return;

    // Without VAPID keys on the server, subscribing can only fail
    fetch("/api/push/vapid-public-key")
      .then((res) => res.json() as Promise<{ key: string | null }>)
      .then(({ key }) => setServerSupport(key ? "supported" : "notConfigured"))
      .catch(() => setServerSupport("notConfigured"));

    // Check whether there is already an active push subscription.
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => {
        setSubscribed(sub !== null);
      })
      .catch(() => {
        // If the SW isn't ready yet or errored, treat as not subscribed.
        setSubscribed(false);
      });
  }, [browser.supported]);

  async function handleEnable() {
    setLoading(true);
    try {
      // 1. Request browser permission.
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== "granted") {
        toast.error(t("toasts.permissionDenied"));
        setLoading(false);
        return;
      }

      // 2. Get the SW registration (wait until it's ready).
      const registration = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key from the backend.
      const keyRes = await fetch("/api/push/vapid-public-key");
      const { key: publicKey } = (await keyRes.json().catch(() => ({}))) as { key?: string | null };
      if (!keyRes.ok || !publicKey) {
        throw new Error(t("errors.vapidKeyFetch"));
      }

      // 4. Subscribe the browser to push.
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 5. Send the subscription object to the server for storage.
      // PushSubscription.toJSON() nests keys under { keys: { p256dh, auth } } —
      // wir schicken sie flach, wie die API es erwartet.
      const subJson = subscription.toJSON();
      const subRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });
      if (!subRes.ok) {
        throw new Error(t("errors.subscriptionSave"));
      }

      setSubscribed(true);
      toast.success(t("toasts.enabled"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("errors.unknown");
      toast.error(t("errors.generic", { message }));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setSubscribed(false);
        setLoading(false);
        return;
      }

      // 1. Unsubscribe at the browser level.
      await subscription.unsubscribe();

      // 2. Tell the server to remove this endpoint.
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      setSubscribed(false);
      toast.success(t("toasts.disabled"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("errors.unknown");
      toast.error(t("errors.disableGeneric", { message }));
    } finally {
      setLoading(false);
    }
  }

  function handleToggle(checked: boolean) {
    if (checked) {
      handleEnable();
    } else {
      handleDisable();
    }
  }

  // ── Derived display values ──────────────────────────────────────────────────

  const isUnsupported = support === "unsupported";
  const isChecking = support === "checking";
  const isNotConfigured = support === "notConfigured";
  const isDenied = permission === "denied";
  // Turning off stays possible for an old subscription after the keys were removed
  const isDisabled =
    isUnsupported || isChecking || loading || isDenied || (isNotConfigured && !subscribed);

  function statusLabel(): string {
    if (isChecking) return t("status.checking");
    if (isUnsupported) return t("status.unsupported");
    if (isNotConfigured && !subscribed) return t("status.notConfigured");
    if (isDenied) return t("status.blocked");
    if (loading) return subscribed ? t("status.disabling") : t("status.enabling");
    if (subscribed) return t("status.enabled");
    return t("status.disabled");
  }

  function statusColor(): string {
    if (isUnsupported || isDenied) return "text-destructive";
    if (subscribed && !loading) return "text-success";
    return "text-muted-foreground";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="from-primary/20 to-primary/5 flex size-8 items-center justify-center rounded-xl bg-gradient-to-br">
            <Bell className="text-primary h-4 w-4" />
          </span>
          {t("title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-muted-foreground text-sm leading-relaxed">{t("description")}</p>

        {/* Toggle row */}
        <div className="border-border/60 flex items-center justify-between rounded-xl border px-4 py-3 dark:border-white/[0.06]">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="push-toggle" className="cursor-pointer text-sm font-medium">
              {t("toggleLabel")}
            </Label>
            <span className={`text-xs font-medium ${statusColor()}`}>{statusLabel()}</span>
          </div>

          <Switch
            id="push-toggle"
            checked={subscribed}
            onCheckedChange={handleToggle}
            disabled={isDisabled}
            aria-label={t("ariaLabel")}
          />
        </div>

        {/* Denied-permission warning */}
        {isDenied && (
          <div className="border-destructive/20 bg-destructive/5 flex items-start gap-3 rounded-xl border px-4 py-3">
            <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-destructive text-sm leading-relaxed">{t("warnings.denied")}</p>
          </div>
        )}

        {/* Server without VAPID keys */}
        {isNotConfigured && (
          <div className="border-border/60 bg-muted/40 flex items-start gap-3 rounded-xl border px-4 py-3 dark:border-white/[0.06]">
            <AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("warnings.notConfigured")}
            </p>
          </div>
        )}

        {/* Unsupported browser notice */}
        {isUnsupported && (
          <div className="border-border/60 bg-muted/40 flex items-start gap-3 rounded-xl border px-4 py-3 dark:border-white/[0.06]">
            <AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t.rich("warnings.unsupported", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
