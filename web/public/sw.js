/**
 * sw.js — NovaSound TITAN LUX v9000
 *
 * V9000:
 *  - Offline-first: toute navigation hors-ligne → sert index.html (SPA)
 *  - Cache agressif du shell (index.html + assets statiques)
 *  - La SPA redirige vers /local-player via OfflineRedirect (React)
 *  - Exclut toujours les fichiers audio de Supabase Storage du cache
 */

const CACHE_NAME    = 'novasound-titan-v2000';
const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.json', '/favicon.ico',
  '/favicon.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/notification-badge.png',
];

// Extensions et MIME audio — jamais mis en cache par le SW
const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|ogg|flac|aac|opus|webm)(\?|$)/i;

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
  const { request } = e;
  const url = request.url;

  // ── Toujours ignorer (passer au réseau sans mise en cache) ──────
  // 1. Supabase (API, Auth, Storage, Realtime)
  if (url.includes('supabase.co')) return;
  // 2. Fichiers audio — ERR_CACHE_OPERATION_NOT_SUPPORTED sur certains appareils
  if (AUDIO_EXTENSIONS.test(url)) return;
  // 3. Méthodes non-GET
  if (request.method !== 'GET') return;
  // 4. Extensions Google / analytics
  if (url.includes('googleapis') || url.includes('gstatic') || url.includes('analytics')) return;

  e.respondWith(
    fetch(request)
      .then(res => {
        // Ne cacher que les réponses valides (200 OK, type basique ou cors)
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => {
            try { c.put(request, clone); } catch (_) { /* ignore quota/opaque errors */ }
          });
        }
        return res;
      })
      .catch(async () => {
        // Réseau indisponible — chercher dans le cache
        const cached = await caches.match(request);
        if (cached) return cached;
        // Pour les navigations HTML (SPA), toujours servir index.html
        if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
          const indexCache = await caches.match('/index.html') || await caches.match('/');
          if (indexCache) return indexCache;
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// ── Web Push ────────────────────────────────────────────────────────────────
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
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url, notifId });
          return;
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});

// ── Background Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'bg-sync-messages') {
    e.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'BG_SYNC_MESSAGES' }))
      )
    );
  }
});

// ── Periodic Background Sync ─────────────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'novasound-refresh') {
    e.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'PERIODIC_REFRESH' }))
      )
    );
  }
});
