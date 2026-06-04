self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "Paradise Staff Hub";
    const options = {
      body: data.message || "Nuova notifica disponibile.",
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: {
        url: data.actionUrl || "/notifications",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("Error displaying push notification", error);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/notifications";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      // If a tab is already open, focus it and redirect
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          // We can navigate the focused client to the notification URL
          if ("navigate" in client) {
            return client.navigate(urlToOpen);
          }
        }
      }
      // If no tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
