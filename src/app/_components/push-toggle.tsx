"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { Section } from "./ui";

// VAPID keys are base64url, PushManager wants bytes.
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

type State =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "off"
  | "on"
  | "denied"
  | "busy";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS predates display-mode for installed web apps.
  (navigator as { standalone?: boolean }).standalone === true;

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export function PushToggle({ pendingCount }: { pendingCount: number }) {
  const [state, setState] = useState<State>("loading");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Keep the home screen badge in step with the queue.
  useEffect(() => {
    if (pendingCount > 0) navigator.setAppBadge?.(pendingCount);
    else navigator.clearAppBadge?.();
  }, [pendingCount]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // On iOS the push API only exists once the PWA is installed.
        const reason = isIos() && !isStandalone() ? "needs-install" : "unsupported";
        if (!cancelled) setState(reason);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (cancelled) return;

        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }

        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setState(existing ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!vapidKey) return;
    setState("busy");

    // Has to come from a user gesture, hence the button.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setState("denied");

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription),
    });

    setState(response.ok ? "on" : "off");
  }

  if (state === "loading" || state === "unsupported" || !vapidKey) return null;

  return (
    <Section title="Reminders">
      {state === "on" ? (
        <p className="text-sm text-muted-foreground">
          On. You&rsquo;ll get one nudge at 4pm on days with a class to confirm.
        </p>
      ) : state === "denied" ? (
        <p className="text-sm text-muted-foreground">
          Notifications are blocked. Re-enable them for this site in your
          browser settings.
        </p>
      ) : state === "needs-install" ? (
        <p className="text-sm text-muted-foreground">
          On iPhone, add this to your Home Screen first (Share, then Add to
          Home Screen). Notifications only work from the installed app.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            One nudge at 4pm, only when something needs confirming.
          </p>
          <Button
            className="h-10"
            onClick={enable}
            disabled={state === "busy"}
          >
            {state === "busy" ? "Enabling…" : "Turn on reminders"}
          </Button>
        </>
      )}
    </Section>
  );
}
