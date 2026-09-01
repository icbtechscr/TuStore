/* Service Worker del Portal TUStore — maneja las notificaciones push. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "Portal TUStore";
  const options = {
    body: data.body || "Recordá marcar tu entrada.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/portal/marcar" },
    tag: data.tag || "marcaje-reminder",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/portal/marcar";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Si ya hay una ventana abierta, enfocarla.
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

