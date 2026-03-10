/**
 * sw.js — NovaSound TITAN LUX v25000
 *
 * ════════════════════════════════════════════════════════════════
 * PUSH NOTIFICATIONS — ANDROID PWA
 * ════════════════════════════════════════════════════════════════
 * Pour qu'une PWA installée sur Android reçoive des notifs dans
 * la barre système, TOUTES ces conditions doivent être réunies :
 *
 *  1. L'app est installée en mode standalone (Add to Home Screen)
 *  2. Le Service Worker est actif ET enregistré (ici ✅)
 *  3. L'utilisateur a accordé la permission notifications
 *  4. La subscription Web Push est stockée dans push_subscriptions
 *  5. Le serveur Edge Function envoie via Web Push Protocol (VAPID)
 *  6. Chrome/Edge Android >= 42 OU Firefox Android >= 44
 *
 * LIMITES iOS (Safari) :
 *  - iOS 15 et avant : AUCUN push possible (API non implémentée)
 *  - iOS 16.3+ : Push Web disponible UNIQUEMENT sur Safari
 *    → L'app doit être ajoutée à l'écran d'accueil depuis Safari
 *    → Chrome/Firefox iOS = moteur WebKit bridé = pas de push
 *    → La permission doit être demandée DANS l'app installée
 *    → VAPID doit être configuré avec applicationServerKey
 *
 * ════════════════════════════════════════════════════════════════
 */

const CACHE_NAME    = 'novasound-titan-v61000';
const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.json', '/favicon.ico',
  '/favicon.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/notification-badge.png',
];

const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|ogg|flac|aac|opus|webm)(\?|$)/i;

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS).catch(() => c.addAll(['/', '/index.html'])))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ),
    self.clients.claim(),
  ]));
});

// ── Fetch (offline-first SPA) ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;

  if (url.includes('supabase.co'))  return;
  if (AUDIO_EXTENSIONS.test(url))   return;
  if (request.method !== 'GET')     return;
  if (url.includes('googleapis') || url.includes('gstatic') || url.includes('analytics')) return;

  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => {
            try { c.put(request, clone); } catch (_) {}
          });
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
          const idx = await caches.match('/index.html') || await caches.match('/');
          if (idx) return idx;
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// WEB PUSH — Handler principal
// Déclenché par le serveur Edge Function via le protocole Web Push (VAPID)
// ══════════════════════════════════════════════════════════════════════════════
self.addEventListener('push', e => {
  // Si pas de données → notif générique (ne jamais ignorer l'event)
  let p = {};
  if (e.data) {
    try   { p = e.data.json(); }
    catch { p = { body: e.data.text() }; }
  }

  const title   = p.title || 'NovaSound TITAN LUX';
  const origin  = self.location.origin;
  const icon    = p.icon   ? (p.icon.startsWith('http')  ? p.icon  : origin + p.icon)  : origin + '/icon-192.png';
  const badge   = p.badge  ? (p.badge.startsWith('http') ? p.badge : origin + p.badge) : origin + '/notification-badge.png';

  // Actions (max 2 sur Android, ignorées sur iOS < 16.4)
  const actions = (p.actions || []).slice(0, 2).map(a => ({
    action: a.action || a.url || '/',
    title:  a.title  || a.label || 'Voir',
    icon:   a.icon   ? (a.icon.startsWith('http') ? a.icon : origin + a.icon) : undefined,
  }));

  const options = {
    body:               p.body || '',
    icon,
    badge,
    tag:                p.tag  || 'novasound-push',
    renotify:           !!p.renotify,
    requireInteraction: !!p.requireInteraction,
    silent:             false,
    vibrate:            [200, 100, 200, 100, 200],  // Android uniquement
    timestamp:          p.timestamp || Date.now(),
    data: {
      url:     p.url     || '/',
      notifId: p.notifId || null,
      actions,
    },
    actions,
  };

  // Image dans la notif (Android Chrome 56+ uniquement)
  if (p.image) options.image = p.image.startsWith('http') ? p.image : origin + p.image;

  // Badge sur icône app (Android Chrome, Edge)
  try {
    if ('setAppBadge' in self.navigator) {
      self.navigator.setAppBadge(p.badgeCount || 1).catch(() => {});
    }
  } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(title, options)
      .catch(err => {
        // Fallback : notif sans actions ni image si erreur (iOS 16.x)
        const safe = { body: options.body, icon, badge, tag: options.tag, data: options.data };
        return self.registration.showNotification(title, safe);
      })
  );
});

// ── Clic sur notification ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  // Récupérer l'URL cible depuis l'action cliquée ou les données par défaut
  let targetUrl = e.notification.data?.url || '/';
  if (e.action) {
    // Chercher l'action cliquée dans la liste
    const act = (e.notification.data?.actions || []).find(a => a.action === e.action);
    if (act?.url) targetUrl = act.url;
    else if (e.action.startsWith('/')) targetUrl = e.action;
  }

  const fullUrl = self.location.origin + (targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl);
  const notifId = e.notification.data?.notifId;

  // Effacer le badge
  try {
    if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(() => {});
  } catch (_) {}

  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      // Chercher un onglet/fenêtre déjà ouverte
      for (const client of list) {
        try {
          if (new URL(client.url).origin === self.location.origin) {
            client.focus();
            client.postMessage({ type:'PUSH_NAVIGATE', url:targetUrl, notifId });
            return;
          }
        } catch (_) {}
      }
      // Ouvrir une nouvelle fenêtre
      return clients.openWindow(fullUrl);
    })
  );
});

// ── Fermeture notification (analytics) ───────────────────────────────────────
self.addEventListener('notificationclose', e => {
  const notifId = e.notification.data?.notifId;
  if (notifId) {
    // Optionnel : signaler au client que la notif a été fermée sans clic
    self.clients.matchAll({ type:'window' }).then(list =>
      list.forEach(c => c.postMessage({ type:'NOTIF_DISMISSED', notifId }))
    );
  }
});

// ── Push subscription changée (rotation de clés) ─────────────────────────────
self.addEventListener('pushsubscriptionchange', e => {
  // Le navigateur a révoqué/changé la subscription → re-souscrire automatiquement
  const VAPID_KEY = 'BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc';
  const decode = b64 => {
    const pad  = '='.repeat((4 - b64.length % 4) % 4);
    const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from([...atob(base)].map(c => c.charCodeAt(0)));
  };
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: decode(VAPID_KEY),
    }).then(sub => {
      // Notifier les clients pour re-enregistrer en base
      return self.clients.matchAll({ type:'window' }).then(list =>
        list.forEach(c => c.postMessage({ type:'PUSH_SUBSCRIPTION_RENEWED', subscription: sub.toJSON() }))
      );
    }).catch(() => {})
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'bg-sync-messages') {
    e.waitUntil(
      self.clients.matchAll().then(list =>
        list.forEach(c => c.postMessage({ type:'SYNC_PENDING_MESSAGES' }))
      )
    );
  }
  if (e.tag === 'bg-sync-notifications') {
    e.waitUntil(
      self.clients.matchAll().then(list =>
        list.forEach(c => c.postMessage({ type:'BG_SYNC_NOTIFICATIONS' }))
      )
    );
  }
});

// ── Periodic Background Sync ──────────────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'novasound-refresh') {
    e.waitUntil(
      self.clients.matchAll().then(list =>
        list.forEach(c => c.postMessage({ type:'PERIODIC_REFRESH' }))
      )
    );
  }
});
