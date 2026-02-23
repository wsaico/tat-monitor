/* ═══════════════════════════════════════════════════════════
   TAT Calculator — Service Worker
   Maneja notificaciones programadas aunque la pantalla esté apagada.
   ═══════════════════════════════════════════════════════════ */

const CACHE = "tat-v1";

self.addEventListener("install", e => {
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    e.waitUntil(clients.claim());
});

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
        if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
    }

    if (e.data.type === "SHARE_WA") {
        const url = `https://wa.me/?text=${encodeURIComponent(e.data.text)}`;
        clients.openWindow(url);
    }
});

function startChecking() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(firedue, 15000);
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

self.addEventListener("notificationclick", e => {
    e.notification.close();

    e.waitUntil(
        clients.matchAll({ type: "window" }).then(list => {
            if (list.length) { list[0].focus(); return; }
            clients.openWindow("/");
        })
    );
});
