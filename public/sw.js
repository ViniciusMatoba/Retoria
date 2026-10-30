// Service worker mínimo: torna o app instalável. Não faz cache; todas as requisições vão direto à rede.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
