importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBC0-9IXGrjTdwRanhH0falNiQaHu1j-BE",
  authDomain: "retoria-app.firebaseapp.com",
  projectId: "retoria-app",
  storageBucket: "retoria-app.firebasestorage.app",
  messagingSenderId: "427021299973",
  appId: "1:427021299973:web:128453002c48e19be4076c",
});

const messaging = firebase.messaging();

// Recebe notificações quando o app está em background ou fechado
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  const url = payload.data?.url ?? "/dashboard";

  self.registration.showNotification(title ?? "Retoria", {
    body: body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url },
    requireInteraction: false,
  });
});

// Clique na notificação → abre/foca o dashboard
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
