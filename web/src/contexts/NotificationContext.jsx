/**
 * NotificationContext — NovaSound TITAN LUX v800
 * © 2026 NovaSound TITAN LUX — ELOADXFAMILY
 *
 * ✅ Subscription push multi-appareils (Android, PC, iOS 16.4+ PWA)
 * ✅ Renouvellement automatique si subscription expirée
 * ✅ Navigation depuis push natif vers la bonne page
 * ✅ Badge numérique mis à jour (navigator.setAppBadge)
 * ✅ Marquage automatique comme lu quand clic sur push
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

// ⚠️ Doit correspondre exactement à la clé dans send-push-notification/index.ts
const VAPID_PUBLIC_KEY = 'BFCdXh1JM5vELnaw7GolQNKPEc-CJRafU2QC3r1lTdyCSSBl5QL6nJfU3HXbnhqm_krsVViGLJ8nf2VpYBjt38o';

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

// ── Enregistrer / mettre à jour subscription en base ─────────────
async function upsertSubscription(userId, sub) {
  const { endpoint, keys } = sub.toJSON ? sub.toJSON() : sub;
  await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: 'endpoint' }
  );
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
    // Badge numérique
    if (!v && 'clearAppBadge' in navigator) navigator.clearAppBadge?.().catch(() => {});
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
        // Sync silencieux en base (multi-appareil)
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
      .channel(`notif_v800:${currentUser.id}`)
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
        // Si l'app est en arrière-plan le SW s'en charge via push natif.
        // Si l'app est au premier plan : toast in-app (géré dans NotificationBell).
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
          loadNotifications(); // Rafraîchir les notifs au retour
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

  // ── Messages du Service Worker ────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      // Navigation depuis un clic sur push natif
      if (e.data?.type === 'PUSH_NAVIGATE') {
        const url = e.data.url;
        if (url) window.location.hash = '#' + (url.startsWith('/') ? url : '/' + url);
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
        // Rafraîchir les notifs après navigation
        setTimeout(loadNotifications, 500);
      }

      // Renouvellement automatique subscription
      if (e.data?.type === 'PUSH_SUBSCRIPTION_RENEWED' && e.data.subscription && currentUser?.id) {
        await upsertSubscription(currentUser.id, e.data.subscription);
        setPushEnabledRaw(true);
        writePersistedPush(currentUser.id, true);
        console.log('[Push] Subscription renewed and saved');
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
      // iOS Safari : requestPermission doit être déclenché par un geste utilisateur
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

      await upsertSubscription(currentUser.id, sub);
      setPushEnabled(true);
      setLoading(false);
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
