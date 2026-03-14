/**
 * NotificationContext — NovaSound TITAN LUX v900
 * © 2026 NovaSound TITAN LUX — ELOADXFAMILY
 *
 * ✅ Subscription push multi-appareils (Android, PC, iOS 16.4+ PWA)
 * ✅ Renouvellement automatique si subscription expirée
 * ✅ Navigation depuis push natif vers la bonne page
 * ✅ Badge numérique mis à jour (navigator.setAppBadge)
 * ✅ Marquage automatique comme lu quand clic sur push
 * 🔧 FIX v900: upsertSubscription attend une session valide avant d'appeler Supabase (corrige le 403)
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

// ✅ Helper navigation push — fonctionne avec HashRouter dans tous les cas :
//  - App déjà ouverte sur la même page   → force re-navigation via hash
//  - App sur une page différente          → navigation normale via hash
//  - Query params (/chat?highlight=abc)   → préservés dans le hash
const pushNavigate = (url) => {
  if (!url) return;
  const path  = url.startsWith('/') ? url : '/' + url;
  const newHash = '#' + path;
  setTimeout(() => {
    if (window.location.hash === newHash) {
      window.dispatchEvent(new Event('hashchange'));
    } else {
      window.location.hash = newHash;
    }
  }, 50);
};

// ⚠️ Doit correspondre exactement à la clé dans send-push-notification/index.ts
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc';

const PUSH_KEY = (uid) => `novasound.push.v2.${uid}`;

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

function urlBase64ToUint8Array(b64) {
  const pad  = '='.repeat((4 - b64.length % 4) % 4);
  const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw  = window.atob(base);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Persistance ──────────────────────────────────────────────────
const readPersistedPush = (uid) => {
  try { return localStorage.getItem(PUSH_KEY(uid)) === '1'; } catch { return false; }
};
const writePersistedPush = (uid, v) => {
  try { v ? localStorage.setItem(PUSH_KEY(uid), '1') : localStorage.removeItem(PUSH_KEY(uid)); } catch {}
};

// ── 🔧 FIX v900: Attendre une session valide avant l'upsert ──────
// Sans ça, si la session n'est pas encore chargée, auth.uid() = null → 403 Forbidden
async function getValidSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  // Fallback : attendre l'événement SIGNED_IN (utile au premier chargement)
  return new Promise((resolve) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        subscription.unsubscribe();
        resolve(session);
      }
    });
    // Timeout de sécurité après 5 secondes
    setTimeout(() => { subscription.unsubscribe(); resolve(null); }, 5000);
  });
}

// ── Enregistrer / mettre à jour subscription en base ─────────────
async function upsertSubscription(userId, sub) {
  // 🔧 FIX v900: Vérifier la session avant d'envoyer la requête
  const session = await getValidSession();
  if (!session) {
    console.warn('[Push] upsertSubscription annulé : aucune session active (évite le 403)');
    return;
  }

  const { endpoint, keys } = sub.toJSON ? sub.toJSON() : sub;
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('[Push] upsertSubscription error:', error.message, error.details);
  }
}

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications,   setNotifications]  = useState([]);
  const [unreadCount,     setUnreadCount]    = useState(0);
  const [permission,      setPermission]     = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [pushEnabled,     setPushEnabledRaw] = useState(false);
  const [loading,         setLoading]        = useState(false);
  const channelRef  = useRef(null);
  const checkingRef = useRef(false);

  const setPushEnabled = useCallback((v) => {
    setPushEnabledRaw(v);
    writePersistedPush(currentUser?.id, v);
  }, [currentUser?.id]);

  // ── Charger les notifications depuis Supabase ─────────────────
  const loadNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(60);
    if (data) {
      setNotifications(data);
      const unread = data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
      // Mettre à jour le badge numérique
      if ('setAppBadge' in navigator) {
        unread > 0
          ? navigator.setAppBadge?.(unread).catch(() => {})
          : navigator.clearAppBadge?.().catch(() => {});
      }
    }
  }, [currentUser?.id]);

  // ── Vérifier et synchroniser l'état réel de la subscription ───
  const syncPushState = useCallback(async (userId) => {
    if (!userId || checkingRef.current) return;
    checkingRef.current = true;
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushEnabledRaw(false); writePersistedPush(userId, false); return;
      }
      const perm = Notification.permission;
      setPermission(perm);

      if (perm !== 'granted') {
        setPushEnabledRaw(false); writePersistedPush(userId, false); return;
      }

      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;

      const sub = await reg.pushManager.getSubscription().catch(() => null);
      if (sub) {
        setPushEnabledRaw(true);
        writePersistedPush(userId, true);
        // Sync silencieux en base (multi-appareil) — session vérifiée dans upsertSubscription
        await upsertSubscription(userId, sub);
      } else {
        setPushEnabledRaw(false);
        writePersistedPush(userId, false);
      }
    } catch (err) {
      console.warn('[Push] syncPushState:', err);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // ── Init à la connexion ───────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) {
      setNotifications([]); setUnreadCount(0); setPushEnabledRaw(false);
      if ('clearAppBadge' in navigator) navigator.clearAppBadge?.().catch(() => {});
      return;
    }

    // Valeur persistée immédiate (évite le flash du bouton)
    setPushEnabledRaw(readPersistedPush(currentUser.id));

    syncPushState(currentUser.id);
    loadNotifications();

    // Écoute Realtime INSERT sur les notifications
    const channel = supabase
      .channel(`notif_v900:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const n = payload.new;
        setNotifications(prev => [n, ...prev]);
        setUnreadCount(prev => {
          const next = prev + 1;
          if ('setAppBadge' in navigator) navigator.setAppBadge?.(next).catch(() => {});
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, loadNotifications, syncPushState]);

  // ── Re-sync quand l'app revient au premier plan ───────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          syncPushState(currentUser.id);
          loadNotifications();
        }, 700);
      }
    };
    const onPageShow = (e) => { if (e.persisted) setTimeout(() => syncPushState(currentUser.id), 700); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [currentUser?.id, syncPushState, loadNotifications]);

  // ── Polling fallback — si Realtime échoue sur mobile/tablette ─
  // Vérifie toutes les 30s si de nouvelles notifs sont arrivées
  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(() => {
      // Ne poll que si la page est visible et que le realtime est peut-être inactif
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id, loadNotifications]);

  // ── Messages du Service Worker ────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      // Navigation depuis un clic sur push natif
      if (e.data?.type === 'PUSH_NAVIGATE') {
        const url = e.data.url;
        if (url) pushNavigate(url);
        // Marquer automatiquement comme lu si notifId connu
        if (e.data.notifId) {
          await supabase.from('notifications')
            .update({ is_read: true })
            .eq('id', e.data.notifId);
          setNotifications(prev => prev.map(n =>
            String(n.id) === String(e.data.notifId) ? { ...n, is_read: true } : n
          ));
          setUnreadCount(prev => {
            const next = Math.max(0, prev - 1);
            if (next === 0 && 'clearAppBadge' in navigator) navigator.clearAppBadge?.().catch(() => {});
            else if ('setAppBadge' in navigator) navigator.setAppBadge?.(next).catch(() => {});
            return next;
          });
        }
        setTimeout(loadNotifications, 500);
      }

      // Renouvellement automatique subscription
      if (e.data?.type === 'PUSH_SUBSCRIPTION_RENEWED' && e.data.subscription && currentUser?.id) {
        await upsertSubscription(currentUser.id, e.data.subscription);
        setPushEnabledRaw(true);
        writePersistedPush(currentUser.id, true);
      }

      // ✅ FIX v63000 — Chunk Vite périmé après deploy Vercel
      // Le SW détecte qu'un chunk JS retourne 404/503 (nouveau build déployé,
      // l'ancien hash n'existe plus sur le CDN). On recharge la page pour que
      // le navigateur récupère le nouveau index.html et les nouveaux chunks.
      if (e.data?.type === 'SW_CHUNK_STALE') {
        const lastReload = parseInt(sessionStorage.getItem('_sw_last_reload') || '0', 10);
        if (Date.now() - lastReload > 30_000) {
          sessionStorage.setItem('_sw_last_reload', String(Date.now()));
          window.location.reload();
        }
        return;
      }

      // Background Sync — messages en attente
      if (e.data?.type === 'SYNC_PENDING_MESSAGES' && currentUser?.id) {
        try {
          const { data: pending } = await supabase
            .from('pending_messages')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_synced', false)
            .order('created_at', { ascending: true });
          if (pending?.length) {
            for (const msg of pending) {
              await supabase.from('chat_messages').insert({
                user_id: msg.user_id,
                content: msg.content,
                created_at: msg.created_at,
              });
              await supabase.from('pending_messages')
                .update({ is_synced: true, synced_at: new Date().toISOString() })
                .eq('id', msg.id);
            }
          }
        } catch (err) {
          console.warn('[Sync] pending messages error:', err);
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [currentUser?.id, loadNotifications]);

  // ── Demander la permission & s'abonner ───────────────────────
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window) || !currentUser?.id) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') { setLoading(false); return false; }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setLoading(false);
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 🔧 FIX v900: La session est forcément valide ici car l'utilisateur
      // vient de cliquer → déclenchement par geste → session active garantie
      await upsertSubscription(currentUser.id, sub);
      setPushEnabled(true);
      setLoading(false);

      // ✅ v3000: Enregistrer le Periodic Background Sync
      if ('periodicSync' in reg) {
        try {
          const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
          if (status.state === 'granted') {
            await reg.periodicSync.register('novasound-refresh', { minInterval: 60 * 60 * 1000 });
          }
        } catch { /* non-fatal */ }
      }

      return true;
    } catch (err) {
      console.error('[Push] requestPermission error:', err);
      setLoading(false);
      return false;
    }
  }, [currentUser?.id, setPushEnabled]);

  // ── Se désabonner ─────────────────────────────────────────────
  const disablePush = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setPushEnabled(false);
    } catch (err) {
      console.warn('[Push] disablePush error:', err);
    }
  }, [currentUser?.id, setPushEnabled]);

  // ── CRUD notifications ─────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => {
      const next = Math.max(0, prev - 1);
      if (next === 0 && 'clearAppBadge' in navigator) navigator.clearAppBadge?.().catch(() => {});
      else if ('setAppBadge' in navigator) navigator.setAppBadge?.(next).catch(() => {});
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.id) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', currentUser.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    if ('clearAppBadge' in navigator) navigator.clearAppBadge?.().catch(() => {});
  }, [currentUser?.id]);

  const deleteNotification = useCallback(async (id) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => {
      const n = prev.find(x => x.id === id);
      if (n && !n.is_read) setUnreadCount(c => {
        const next = Math.max(0, c - 1);
        if (next === 0 && 'clearAppBadge' in navigator) navigator.clearAppBadge?.().catch(() => {});
        return next;
      });
      return prev.filter(x => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(async () => {
    if (!currentUser?.id) return;
    await supabase.from('notifications').delete().eq('user_id', currentUser.id);
    setNotifications([]); setUnreadCount(0);
    if ('clearAppBadge' in navigator) navigator.clearAppBadge?.().catch(() => {});
  }, [currentUser?.id]);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, permission, pushEnabled, loading,
      requestPermission, disablePush,
      markAsRead, markAllAsRead, deleteNotification, clearAll,
      loadNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};