/**
 * sw.js — NovaSound TITAN LUX v3000
 * © 2026 NovaSound TITAN LUX — ELOADXFAMILY
 *
 * ✅ Cache offline
 * ✅ Web Push natif Android / PC / iOS 16.4+ PWA
 * ✅ Clic → ouvre/focus app + navigue vers la bonne page
 * ✅ Badge numérique icône (Android + PC)
 * ✅ Renouvellement automatique subscription expirée
 * ✅ v3000: badge = icône monochrome dans barre notif Android
 * ✅ v3000: Periodic Background Sync
 * ✅ v3000: Background Sync (offline messages)
 */

const CACHE_NAME    = 'novasound-titan-v3000';
const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.json', '/favicon.ico',
  '/favicon.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/chat-wallpaper.jpg', '/notification-badge.png',
];

const VAPID_PUBLIC_KEY = 'BFCdXh1JM5vELnaw7GolQNKPEc-CJRafU2QC3r1lTdyCSSBl5QL6nJfU3HXbnhqm_krsVViGLJ8nf2VpYBjt38o';

function urlBase64ToUint8Array(b64) {
  const pad  = '='.repeat((4 - b64.length % 4) % 4);
  const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(base)].map(c => c.charCodeAt(0)));
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS).catch(() => c.addAll(['/', '/index.html'])))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('supabase.co') || url.includes('googleapis') || e.request.method !== 'GET') return;
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

self.addEventListener('push', e => {
  if (!e.data) return;
  let p;
  try   { p = e.data.json(); }
  catch { p = { title: 'NovaSound TITAN LUX', body: e.data.text() }; }

  const title    = p.title || 'NovaSound TITAN LUX';
  const iconUrl  = p.icon
    ? (p.icon.startsWith('http') ? p.icon : self.location.origin + p.icon)
    : self.location.origin + '/icon-192.png';
  const badgeUrl = self.location.origin + '/notification-badge.png';

  const options = {
    body:               p.body || '',
    icon:               iconUrl,
    badge:              badgeUrl,
    tag:                p.tag || 'novasound-push',
    data:               { url: p.url || '/', notifId: p.notifId || null },
    requireInteraction: false,
    vibrate:            [150, 80, 150],
    actions:            (p.actions || []).slice(0, 2),
    timestamp:          p.timestamp || Date.now(),
    silent:             false,
    renotify:           p.renotify || false,
  };
  if (p.image) options.image = p.image;
  if ('setAppBadge' in self.navigator) self.navigator.setAppBadge().catch(() => {});
  e.waitUntil(self.registration.showNotification(title, options));
});

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

self.addEventListener('notificationclose', () => {
  self.registration.getNotifications().then(notifs => {
    if (notifs.length === 0 && 'clearAppBadge' in self.navigator)
      self.navigator.clearAppBadge().catch(() => {});
  });
});

self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const cls = await clients.matchAll({ includeUncontrolled: true });
      cls.forEach(c => c.postMessage({ type: 'PUSH_SUBSCRIPTION_RENEWED', subscription: newSub.toJSON() }));
    } catch (err) { console.error('[SW] pushsubscriptionchange failed:', err); }
  })());
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'novasound-refresh') {
    e.waitUntil((async () => {
      try {
        const res = await fetch('/', { cache: 'reload' });
        if (res.ok) { const c = await caches.open(CACHE_NAME); await c.put('/', res); }
      } catch {}
    })());
  }
});

self.addEventListener('sync', e => {
  if (e.tag === 'send-pending-messages') {
    e.waitUntil((async () => {
      const cls = await clients.matchAll({ includeUncontrolled: true });
      cls.forEach(c => c.postMessage({ type: 'SYNC_PENDING_MESSAGES' }));
    })());
  }
});
