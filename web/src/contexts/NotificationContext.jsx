import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

const VAPID_PUBLIC_KEY = 'BNyTAf5wmou_w-d62UzRKch9EOvLR8reX2J6J-uMDjJf2P3hg8KmuCchDzcutSLnTyZua0aROq-9gzy4hYXIpyA';

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

// Convertir la clé VAPID base64url → Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]        = useState(0);
  const [permission, setPermission]          = useState('default');
  const [pushEnabled, setPushEnabled]        = useState(false);
  const [loading, setLoading]                = useState(false);
  const channelRef = useRef(null);

  // ── Charger les notifications de l'utilisateur ──────────────────
  const loadNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  }, [currentUser?.id]);

  // ── Realtime — nouvelles notifications ─────────────────────────
  useEffect(() => {
    if (!currentUser?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotifications();

    // S'abonner aux nouvelles notifications en temps réel
    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const newNotif = payload.new;
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Notification système si l'app est en arrière-plan
        if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(newNotif.title, {
              body:  newNotif.body,
              icon:  newNotif.icon_url || '/icon-192.png',
              badge: '/icon-192.png',
              tag:   `notif-${newNotif.id}`,
              data:  { url: newNotif.url },
            });
          } catch {}
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, loadNotifications]);

  // ── Écouter les messages du Service Worker (clic notification) ──
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'NAVIGATE' && event.data.url) {
        window.location.hash = '#' + event.data.url.replace(/^#/, '');
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  // ── Initialiser permission au montage ──────────────────────────
  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
  }, []);

  // ── Demander permission + s'abonner au push ────────────────────
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (!currentUser?.id) return false;

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setLoading(false); return false; }

      // Activer le push via Service Worker
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
        // Sauvegarder la subscription en base
        await supabase.from('push_subscriptions').upsert({
          user_id: currentUser.id,
          endpoint,
          p256dh: keys.p256dh,
          auth:   keys.auth,
        }, { onConflict: 'endpoint' });

        setPushEnabled(true);
      }
      setLoading(false);
      return true;
    } catch (e) {
      console.error('[Notifications]', e);
      setLoading(false);
      return false;
    }
  }, [currentUser?.id]);

  // ── Désactiver les push ─────────────────────────────────────────
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
  }, [currentUser?.id]);

  // ── Marquer comme lue ──────────────────────────────────────────
  const markAsRead = useCallback(async (notifId) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // ── Marquer tout comme lu ──────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.id) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', currentUser.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [currentUser?.id]);

  // ── Supprimer une notification ─────────────────────────────────
  const deleteNotification = useCallback(async (notifId) => {
    await supabase.from('notifications').delete().eq('id', notifId);
    setNotifications(prev => {
      const notif = prev.find(n => n.id === notifId);
      if (notif && !notif.is_read) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(n => n.id !== notifId);
    });
  }, []);

  // ── Tout supprimer ─────────────────────────────────────────────
  const clearAll = useCallback(async () => {
    if (!currentUser?.id) return;
    await supabase.from('notifications').delete().eq('user_id', currentUser.id);
    setNotifications([]);
    setUnreadCount(0);
  }, [currentUser?.id]);

  // ── Notification locale immédiate (pour tester / in-app toast) ─
  const showLocalNotification = useCallback((title, body, url = '/') => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'local', data: { url } });
      } catch {}
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
