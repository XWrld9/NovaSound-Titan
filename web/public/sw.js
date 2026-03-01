/**
 * sw.js — NovaSound TITAN LUX v800
 * © 2026 NovaSound TITAN LUX — ELOADXFAMILY
 *
 * ✅ Cache offline
 * ✅ Web Push natif Android / PC / iOS 16.4+ PWA
 * ✅ Clic → ouvre/focus app + navigue vers la bonne page
 * ✅ Badge numérique icône (Android + PC)
 * ✅ Renouvellement automatique subscription expirée
 */

const CACHE_NAME    = 'novasound-titan-v40';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.ico',
  '/favicon.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'];

const VAPID_PUBLIC_KEY = 'BFCdXh1JM5vELnaw7GolQNKPEc-CJRafU2QC3r1lTdyCSSBl5QL6nJfU3HXbnhqm_krsVViGLJ8nf2VpYBjt38o';

function urlBase64ToUint8Array(b64) {
  const pad  = '='.repeat((4 - b64.length % 4) % 4);
  const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(base)].map(c => c.charCodeAt(0)));
}

// ── Install ──────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ),
    self.clients.claim(),
  ]));
});

// ── Fetch — Network first, fallback cache ────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('supabase.co') || e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── PUSH ─────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;

  let p;
  try   { p = e.data.json(); }
  catch { p = { title: 'NovaSound TITAN LUX', body: e.data.text() }; }

  const title = p.title || 'NovaSound TITAN LUX';
  const options = {
    body:               p.body   || '',
    icon:               p.icon   || '/notification-icon.png',
    badge:              '/notification-badge.png',
    tag:                p.tag    || 'novasound-push',
    data:               { url: p.url || '/', notifId: p.notifId || null },
    requireInteraction: false,   // iOS 16.4 exige false
    vibrate:            [150, 80, 150],
    actions:            (p.actions || []).slice(0, 2),
    timestamp:          Date.now(),
    silent:             false,
  };

  if (p.image) options.image = p.image;

  // Badge numérique (Android + Chrome PC)
  if ('setAppBadge' in self.navigator) self.navigator.setAppBadge().catch(() => {});

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic sur notification ─────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url     = e.notification.data?.url || '/';
  const notifId = e.notification.data?.notifId;
  const fullUrl = self.location.origin + (url.startsWith('/') ? url : '/' + url);

  if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(() => {});

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.focus();
          c.postMessage({ type: 'PUSH_NAVIGATE', url, notifId });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(fullUrl);
    })
  );
});

// ── Notification fermée manuellement ─────────────────────────────
self.addEventListener('notificationclose', () => {
  self.registration.getNotifications().then(notifs => {
    if (notifs.length === 0 && 'clearAppBadge' in self.navigator)
      self.navigator.clearAppBadge().catch(() => {});
  });
});

// ── Renouvellement automatique subscription expirée ──────────────
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const cls = await clients.matchAll({ includeUncontrolled: true });
      cls.forEach(c => c.postMessage({ type: 'PUSH_SUBSCRIPTION_RENEWED', subscription: newSub.toJSON() }));
    } catch (err) {
      console.error('[SW] pushsubscriptionchange failed:', err);
    }
  })());
});
