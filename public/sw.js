const CACHE = "dw-v1";
const OFFLINE_URL = "/trade";

const PRECACHE = [
  "/",
  "/trade",
  "/login",
  "/manifest.json",
  "/icon-192",
  "/icon-512",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // API calls — sempre rede, sem cache
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request)
        .then((res) => {
          // Só faz cache de respostas válidas de mesma origem
          if (res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached ?? caches.match(OFFLINE_URL));

      return cached ?? networkFetch;
    })
  );
});

// Notificações push
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? "Dynamics Works", {
      body:  data.body  ?? "",
      icon:  "/icon-192",
      badge: "/icon-192",
      data:  { url: data.url ?? "/trade" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/trade";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((wins) => {
      const match = wins.find((w) => w.url.includes(url));
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});
