/* ═══════════════════════════════════════════════════════════
   TAT Calculator Pro — Service Worker (2027 Edition)
   - Soporte Offline (Network-First con Cache Fallback para PWA)
   - Motor de notificaciones operacionales programadas en segundo plano
   ═══════════════════════════════════════════════════════════ */

const CACHE_NAME = "tat-pro-v2027-1";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
    ])
  );
});

/* ── Fetch Handler (Requisito indispensable para PWA Instalable y Offline) ── */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached => cached || caches.match("/index.html"))
      )
  );
});

/* ── Recibe alarmas programadas desde la app ──────────────── */
let scheduledAlerts = [];
let checkInterval = null;

self.addEventListener("message", e => {
  if (!e.data) return;

  if (e.data.type === "SCHEDULE_ALERTS") {
    scheduledAlerts = e.data.alerts || [];
    startChecking();
  }

  if (e.data.type === "CLEAR_ALERTS") {
    scheduledAlerts = [];
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  if (e.data.type === "SHARE_WA") {
    const url = `https://wa.me/?text=${encodeURIComponent(e.data.text)}`;
    clients.openWindow(url);
  }
});

function startChecking() {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(firedue, 10000); // revisa cada 10s
  firedue();
}

function firedue() {
  const now = Date.now();
  scheduledAlerts = scheduledAlerts.filter(a => {
    if (now >= a.fireAt) {
      self.registration.showNotification(a.title, {
        body: a.body,
        tag: a.tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,
        actions: [
          { action: "wa", title: "📲 Enviar WhatsApp" },
          { action: "close", title: "Cerrar" },
        ],
        data: { waText: a.waText || "" },
      });
      return false;
    }
    return true;
  });

  if (scheduledAlerts.length === 0 && checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/* ── Click en acciones de la notificación ─────────────────── */
self.addEventListener("notificationclick", e => {
  e.notification.close();

  if (e.action === "wa") {
    const text = e.notification.data?.waText || "";
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    e.waitUntil(clients.openWindow(url));
    return;
  }

  e.waitUntil(
    clients.matchAll({ type: "window" }).then(list => {
      if (list.length) {
        list[0].focus();
        return;
      }
      clients.openWindow("/");
    })
  );
});
