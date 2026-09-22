// Notification actions resolve a class without opening the app. That is why
// /api/sessions/resolve is a plain route and not a Server Action: there is no
// React context when the phone is locked.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);


self.addEventListener("fetch", () => {});

async function setBadge(count) {
  if (typeof count !== "number" || !self.navigator.setAppBadge) return;
  if (count > 0) await self.navigator.setAppBadge(count);
  else await self.navigator.clearAppBadge?.();
}

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return {};
    }
  })();

  const { title = "Class tracker", body = "", pending, date, scheduleId } = payload;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        // One at a time, a new nudge replaces the last.
        tag: "pending-classes",
        renotify: true,
        data: { date, scheduleId },
        actions: [
          { action: "confirm", title: "Happened" },
          { action: "cancel", title: "Didn't" },
        ],
      });
      await setBadge(pending);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  const { date, scheduleId } = event.notification.data ?? {};
  event.notification.close();

  event.waitUntil(
    (async () => {
      // Android and desktop resolve straight from the notification.
      if ((action === "confirm" || action === "cancel") && date) {
        try {
          const response = await fetch("/api/sessions/resolve", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              date,
              scheduleId: scheduleId ?? null,
              status: action === "confirm" ? "confirmed" : "cancelled",
            }),
          });

          if (response.ok) {
            const { pending } = await response.json();
            await setBadge(pending);
            return;
          }
        } catch {
          // Offline or signed out. Fall through and open the app.
        }
      }

      // iOS ignores actions, so a plain tap lands here.
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find((client) => "focus" in client);
      if (open) return open.focus();
      return self.clients.openWindow("/");
    })(),
  );
});
