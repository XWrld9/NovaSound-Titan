import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, X,
  Heart, MessageCircle, UserPlus, Music, Newspaper
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';

/* ── Icônes par type ── */
const TYPE_ICON = {
  like:     <Heart        className="w-3.5 h-3.5 text-pink-400 fill-current" />,
  comment:  <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />,
  follow:   <UserPlus     className="w-3.5 h-3.5 text-purple-400" />,
  new_song: <Music        className="w-3.5 h-3.5 text-green-400" />,
  news:     <Newspaper    className="w-3.5 h-3.5 text-amber-400" />,
};

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'À l\'instant';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/* ── Toast in-app (quand l'app est au premier plan) ── */
export const NotificationToast = () => {
  const { notifications } = useNotifications();
  const [toasts, setToasts] = useState([]);
  const prevCountRef = useRef(0);
  const shownIds = useRef(new Set());

  useEffect(() => {
    if (!notifications.length) return;
    const latest = notifications[0];
    // N'afficher que les nouvelles notifs non lues jamais affichées
    if (latest && !latest.is_read && !shownIds.current.has(latest.id)) {
      shownIds.current.add(latest.id);
      const id = Date.now();
      setToasts(prev => [{ ...latest, _toastId: id }, ...prev].slice(0, 3));
      setTimeout(() => setToasts(prev => prev.filter(t => t._toastId !== id)), 5000);
    }
  }, [notifications[0]?.id]);

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', top: 72, right: 16, zIndex: 10001, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340, width: 'calc(100vw - 32px)' }}>
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast._toastId}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            style={{
              background: '#111827',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
            }}
            onClick={() => setToasts(prev => prev.filter(t => t._toastId !== toast._toastId))}
          >
            <div className="relative flex-shrink-0">
              {toast.icon_url
                ? <img src={toast.icon_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {TYPE_ICON[toast.type] || <Bell className="w-4 h-4 text-gray-400" />}
                  </div>
              }
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#0a0f23', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {TYPE_ICON[toast.type]}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 2, lineHeight: 1.3 }}>{toast.title}</p>
              <p style={{ color: 'rgba(156,163,175,0.9)', fontSize: 11, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{toast.body}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(t => t._toastId !== toast._toastId)); }}
              style={{ background: 'none', border: 'none', color: 'rgba(156,163,175,0.5)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

/* ── Panel liste des notifications ── */
const NotifPanel = ({ panelRef, panelPos, onClose, mobile }) => {
  const {
    notifications, unreadCount, permission, pushEnabled, loading,
    requestPermission, disablePush,
    markAsRead, markAllAsRead, deleteNotification, clearAll,
  } = useNotifications();
  const [tab, setTab] = useState('all');
  const displayed = tab === 'unread' ? notifications.filter(n => !n.is_read) : notifications;

  const handleClick = (notif) => {
    if (!notif.is_read) markAsRead(notif.id);
    onClose();
  };

  const panelStyle = mobile ? {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    borderRadius: 0,
    width: '100%',
    maxHeight: 'none',
  } : {
    position: 'fixed',
    top: panelPos.top,
    right: panelPos.right,
    zIndex: 9999,
    width: Math.min(380, window.innerWidth - 16),
    maxHeight: 'min(540px, 85vh)',
    borderRadius: 20,
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
  };

  return (
    <motion.div
      ref={mobile ? undefined : panelRef}
      initial={mobile ? false : { opacity: 0, y: -8, scale: 0.96 }}
      animate={mobile ? false : { opacity: 1, y: 0, scale: 1 }}
      exit={mobile ? false : { opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      style={{ ...panelStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header panel */}
      {!mobile && (
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-white/10 transition-all" title="Tout marquer comme lu">
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/10 transition-all" title="Tout supprimer">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile header simplifié */}
      {mobile && (
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">{unreadCount}</span>}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && <button onClick={markAllAsRead} className="p-1 text-gray-500 hover:text-cyan-400"><CheckCheck className="w-4 h-4" /></button>}
            {notifications.length > 0 && <button onClick={clearAll} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-white/[0.05] flex-shrink-0">
        {['all', 'unread'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${tab === t ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t === 'all' ? 'Toutes' : `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className={mobile ? '' : 'flex-1 overflow-y-auto'} style={mobile ? { maxHeight: 280, overflowY: 'auto' } : {}}>
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <Bell className="w-9 h-9 text-gray-700 mb-2" />
            <p className="text-gray-500 text-sm">
              {tab === 'unread' ? 'Tout est lu ✓' : 'Aucune notification'}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayed.map(notif => (
              <motion.div key={notif.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.12 }}
                className={`relative group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] cursor-pointer ${!notif.is_read ? 'bg-cyan-500/[0.04]' : ''}`}
                onClick={() => {
                  handleClick(notif);
                  if (notif.url) {
                    const path = notif.url.replace(/^#\//, '/').replace(/^#/, '/');
                    window.location.hash = '#' + path.replace(/^\//, '');
                  }
                }}
              >
                {!notif.is_read && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                )}
                {/* Avatar + badge type */}
                <div className="relative flex-shrink-0 mt-0.5">
                  {notif.icon_url
                    ? <img src={notif.icon_url} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
                    : <div className="w-9 h-9 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center">
                        {TYPE_ICON[notif.type] || <Bell className="w-4 h-4 text-gray-500" />}
                      </div>
                  }
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gray-900 border border-gray-700/50 flex items-center justify-center">
                    {TYPE_ICON[notif.type] || <Bell className="w-2.5 h-2.5 text-gray-500" />}
                  </div>
                </div>
                {/* Texte */}
                <div className="flex-1 min-w-0 pr-8">
                  <p className="text-sm text-white font-semibold leading-tight">{notif.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-3">{notif.body}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{timeAgo(notif.created_at)}</p>
                </div>
                {/* Boutons hover */}
                <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notif.is_read && (
                    <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }} className="p-1 rounded text-gray-600 hover:text-cyan-400 transition-colors" title="Marquer comme lu">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }} className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer push */}
      <div className={`px-4 py-3 border-t border-white/[0.07] flex-shrink-0 ${mobile ? '' : 'bg-gray-900/50'}`}>
        {permission === 'denied' ? (
          <p className="text-xs text-amber-400 text-center">Notifications bloquées dans les paramètres du navigateur</p>
        ) : permission !== 'granted' ? (
          <button onClick={requestPermission} disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: 'linear-gradient(90deg,#06b6d4,#a855f7)', color: '#fff' }}
          >
            {loading ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            Activer les notifications push
          </button>
        ) : pushEnabled ? (
          <button onClick={disablePush} className="w-full py-2.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-400 flex items-center justify-center gap-2 transition-colors">
            <BellOff className="w-3.5 h-3.5" />Désactiver les notifications push
          </button>
        ) : (
          <button onClick={requestPermission} disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-2 transition-colors border border-cyan-500/30 hover:border-cyan-400/50"
          >
            <Bell className="w-3.5 h-3.5" />Activer les notifications push
          </button>
        )}
      </div>
    </motion.div>
  );
};

/* ── Composant principal ── */
const NotificationBell = ({ mobile = false, closeMenu }) => {
  const { currentUser } = useAuth();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const btnRef    = useRef(null);
  const panelRef  = useRef(null);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 16 });

  /* Fermer si clic extérieur (desktop seulement) */
  useEffect(() => {
    if (!open || mobile) return;
    const h = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h, { passive: true });
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [open, mobile]);

  /* Calculer position panel desktop */
  useEffect(() => {
    if (!open || mobile || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = Math.min(380, window.innerWidth - 16);
    const right  = Math.max(8, window.innerWidth - r.right);
    setPanelPos({ top: r.bottom + 8, right: Math.min(right, window.innerWidth - panelW - 8) });
  }, [open, mobile]);

  if (!currentUser) return null;

  /* ── MODE MOBILE — inline dans le drawer ── */
  if (mobile) {
    return (
      <div className="px-0">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors"
        >
          <div className="relative">
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-cyan-400' : 'text-cyan-400'}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-gradient-to-r from-cyan-500 to-pink-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="ml-auto px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">{unreadCount}</span>
          )}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mx-2 mb-1 rounded-xl border border-white/[0.07] bg-gray-900/80"
            >
              <NotifPanel mobile onClose={() => setOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ── MODE DESKTOP — bouton cloche + panel portal ── */
  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
      >
        <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 ? 'text-cyan-400' : ''}`} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-gradient-to-r from-cyan-500 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg pointer-events-none"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {ReactDOM.createPortal(
        <AnimatePresence>
          {open && <NotifPanel panelRef={panelRef} panelPos={panelPos} onClose={() => setOpen(false)} />}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default NotificationBell;
