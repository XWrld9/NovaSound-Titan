/**
 * NotificationContext — NovaSound TITAN LUX v60
 *
 * FIXES MOBILE :
 * - pushEnabled persisté en localStorage → survit aux navigations, mises en veille iOS/Android
 * - Vérification SW synchronisée avec l'utilisateur connecté (pas au montage global)
 * - Si la subscription SW est absente ou expirée, pushEnabled local est corrigé automatiquement
 * - Android WebView + iOS Safari PWA : detects stale subscriptions et les renouvelle
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

const VAPID_PUBLIC_KEY = 'BNyTAf5wmou_w-d62UzRKch9EOvLR8reX2J6J-uMDjJf2P3hg8KmuCchDzcutSLnTyZua0aROq-9gzy4hYXIpyA';

const PUSH_KEY = (userId) => `novasound.push.enabled.${userId}`;

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const readPersistedPush = (userId) => {
  if (!userId) return false;
  try { return localStorage.getItem(PUSH_KEY(userId)) === '1'; } catch { return false; }
};

const writePersistedPush = (userId, value) => {
  if (!userId) return;
  try {
    if (value) localStorage.setItem(PUSH_KEY(userId), '1');
    else localStorage.removeItem(PUSH_KEY(userId));
  } catch {}
};

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount,   setUnreadCount]      = useState(0);
  const [permission,    setPermission]       = useState('default');
  const [pushEnabled,   setPushEnabledState] = useState(false);
  const [loading,       setLoading]          = useState(false);
  const channelRef  = useRef(null);
  const checkingRef = useRef(false);

  const setPushEnabled = useCallback((value) => {
    setPushEnabledState(value);
    writePersistedPush(currentUser?.id, value);
  }, [currentUser?.id]);

  // Vérifier l'état réel de la subscription SW
  const syncPushState = useCallback(async (userId) => {
    if (!userId || checkingRef.current) return;
    checkingRef.current = true;
    try {
      if (!('Notification' in window)) return;
      const perm = Notification.permission;
      setPermission(perm);

      if (perm !== 'granted' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushEnabledState(false);
        writePersistedPush(userId, false);
        return;
      }

      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;

      const sub = await reg.pushManager.getSubscription().catch(() => null);

      if (sub) {
        setPushEnabledState(true);
        writePersistedPush(userId, true);
        // Sync en base (cas changement d'appareil ou expiration)
        const { endpoint, keys } = sub.toJSON();
        supabase.from('push_subscriptions').upsert(
          { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
          { onConflict: 'endpoint' }
        ).then(() => {}).catch(() => {});
      } else {
        setPushEnabledState(false);
        writePersistedPush(userId, false);
      }
    } catch {}
    finally { checkingRef.current = false; }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false }).limit(50);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  }, [currentUser?.id]);

  // Init à la connexion
  useEffect(() => {
    if (!currentUser?.id) {
      setNotifications([]); setUnreadCount(0); setPushEnabledState(false);
      return;
    }

    // Appliquer immédiatement la valeur persistée (évite le flash du bouton)
    const persisted = readPersistedPush(currentUser.id);
    setPushEnabledState(persisted);

    // Puis vérifier l'état réel en arrière-plan
    syncPushState(currentUser.id);
    loadNotifications();

    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const n = payload.new;
        setNotifications(prev => [n, ...prev]);
        setUnreadCount(prev => prev + 1);
        if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
          try {
            new Notification(n.title, {
              body: n.body, icon: n.icon_url || '/icon-192.png',
              badge: '/icon-192.png', tag: `notif-${n.id}`, data: { url: n.url },
            });
          } catch {}
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, loadNotifications, syncPushState]);

  // Re-sync quand l'app revient au premier plan (mobile critique)
  useEffect(() => {
    if (!currentUser?.id) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // Délai pour laisser le SW se réveiller (iOS Safari)
        setTimeout(() => syncPushState(currentUser.id), 600);
      }
    };
    // pageshow = retour depuis le bfcache iOS Safari
    const onPageShow = (e) => {
      if (e.persisted) setTimeout(() => syncPushState(currentUser.id), 600);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [currentUser?.id, syncPushState]);

  // Messages SW (navigation depuis notif)
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'NAVIGATE' && e.data.url) {
        window.location.hash = '#' + e.data.url.replace(/^#/, '');
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window) || !currentUser?.id) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setLoading(false); return false; }

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
        const { endpoint, keys } = sub.toJSON();
        await supabase.from('push_subscriptions').upsert(
          { user_id: currentUser.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
          { onConflict: 'endpoint' }
        );
        setPushEnabled(true);
      }
      setLoading(false);
      return true;
    } catch (e) {
      console.error('[Push]', e);
      setLoading(false);
      return false;
    }
  }, [currentUser?.id, setPushEnabled]);

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
    } catch {}
  }, [currentUser?.id, setPushEnabled]);

  const markAsRead = useCallback(async (notifId) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.id) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', currentUser.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [currentUser?.id]);

  const deleteNotification = useCallback(async (notifId) => {
    await supabase.from('notifications').delete().eq('id', notifId);
    setNotifications(prev => {
      const notif = prev.find(n => n.id === notifId);
      if (notif && !notif.is_read) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(n => n.id !== notifId);
    });
  }, []);

  const clearAll = useCallback(async () => {
    if (!currentUser?.id) return;
    await supabase.from('notifications').delete().eq('user_id', currentUser.id);
    setNotifications([]); setUnreadCount(0);
  }, [currentUser?.id]);

  const showLocalNotification = useCallback((title, body, url = '/') => {
    if (Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'local', data: { url } }); } catch {}
    }
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, permission, pushEnabled, loading,
      requestPermission, disablePush,
      markAsRead, markAllAsRead, deleteNotification, clearAll,
      showLocalNotification, loadNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
