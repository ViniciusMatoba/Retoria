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

// As mensagens chegam com o bloco "notification": o SDK do Firebase mostra o aviso sozinho e abre o link
// (webpush.fcmOptions.link) no toque. Não chamar showNotification aqui: duplicaria o aviso.

// Reserva para avisos sem link do Firebase: toque abre/foca o painel
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard/leads";
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
