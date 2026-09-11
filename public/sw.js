/* ═══════════════════════════════════════════════════════════
   TAT Calculator — Service Worker
   Maneja notificaciones programadas aunque la pantalla esté apagada.
   Coloca este archivo en la RAÍZ del proyecto (mismo nivel que index.html)
   ═══════════════════════════════════════════════════════════ */

const CACHE = "tat-v1";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(clients.claim());
});

/* ── Recibe alarmas programadas desde la app ────────────────
   La app envía: { type: "SCHEDULE_ALERTS", alerts: [...] }
   Cada alert: { id, title, body, fireAt (timestamp ms), tag }
*/
let scheduledAlerts = [];
let checkInterval   = null;

self.addEventListener("message", e => {
  if (!e.data) return;

  if (e.data.type === "SCHEDULE_ALERTS") {
    scheduledAlerts = e.data.alerts || [];
    startChecking();
  }

  if (e.data.type === "CLEAR_ALERTS") {
    scheduledAlerts = [];
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  }

  // La app solicita abrir WhatsApp con el texto del reporte
  if (e.data.type === "SHARE_WA") {
    const url = `https://wa.me/?text=${encodeURIComponent(e.data.text)}`;
    clients.openWindow(url);
  }
});

function startChecking() {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(firedue, 15000); // revisa cada 15s
  firedue(); // inmediato también
}

function firedue() {
  const now = Date.now();
  scheduledAlerts = scheduledAlerts.filter(a => {
    if (now >= a.fireAt) {
      self.registration.showNotification(a.title, {
        body:    a.body,
        tag:     a.tag,
        icon:    "/icon-192.png",
        badge:   "/icon-192.png",
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,
        actions: [
          { action: "wa",    title: "📲 Enviar WhatsApp" },
          { action: "close", title: "Cerrar"             },
        ],
        data: { waText: a.waText || "" },
      });
      return false; // eliminar de la lista
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
    const url  = `https://wa.me/?text=${encodeURIComponent(text)}`;
    e.waitUntil(clients.openWindow(url));
    return;
  }

  // Click en el cuerpo → abrir la app
  e.waitUntil(
    clients.matchAll({ type: "window" }).then(list => {
      if (list.length) { list[0].focus(); return; }
      clients.openWindow("/");
    })
  );
});
