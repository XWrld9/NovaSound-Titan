/**
 * NotificationBell — NovaSound TITAN LUX V60000
 *
 * REFONTE COMPLÈTE :
 * - Toast in-app redesigné : plus grand, plus lisible, animations fluides
 * - Panel bureau : filtres avancés, groupes par type, animations pro
 * - Panel mobile : sheet bottom qui slide du bas
 * - Badge animé avec pulse sur nouvelles notifs
 * - Types enrichis avec couleurs et icônes distinctives
 * - Swipe-to-dismiss sur les toasts mobile
 * - Son/vibration natif sur nouvelle notif (si permission OK)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, X,
  Heart, MessageCircle, UserPlus, Music, Newspaper,
  Reply, AtSign, Zap, Radio, Trophy, Volume2, Settings
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// ── Config par type ──────────────────────────────────────────────────
const TYPE_CONFIG = {
  like:             { icon: Heart,          color: '#f43f5e', bg: 'rgba(244,63,94,0.15)',  label: 'Like'            },
  comment:          { icon: MessageCircle,  color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',  label: 'Commentaire'     },
  follow:           { icon: UserPlus,       color: '#a855f7', bg: 'rgba(168,85,247,0.15)', label: 'Abonné'          },
  new_song:         { icon: Music,          color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Nouveau son'     },
  repost:           { icon: Reply,          color: '#34d399', bg: 'rgba(52,211,153,0.15)', label: 'Repartage'       },
  news:             { icon: Newspaper,      color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Actualité'       },
  chat_reply:       { icon: Reply,          color: '#e879f9', bg: 'rgba(232,121,249,0.15)',label: 'Réponse'         },
  chat_mention:     { icon: AtSign,         color: '#67e8f9', bg: 'rgba(103,232,249,0.15)',label: 'Mention'         },
  chat_mention_all: { icon: Zap,            color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', label: '@tous'           },
  mood_vote:        { icon: Zap,            color: '#fb923c', bg: 'rgba(251,146,60,0.15)', label: 'Vibe'            },
  // V50000 — types live (manquants → affichaient une icône Bell générique)
  live_start:       { icon: Radio,          color: '#f43f5e', bg: 'rgba(244,63,94,0.15)',  label: 'Live démarré'    },
  live_invite:      { icon: Radio,          color: '#fb7185', bg: 'rgba(251,113,133,0.15)',label: 'Invitation live' },
  queue_song:       { icon: Music,          color: '#34d399', bg: 'rgba(52,211,153,0.15)', label: 'File d\'attente' },
  achievement:      { icon: Trophy,         color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Trophée'         },
};

// Remplace l'icône par l'emoji du mood si présent dans les metadata
const getMoodConfig = (notif) => {
  if (notif.type !== 'mood_vote') return null;
  try {
    const meta = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : (notif.metadata || {});
    return meta.moodEmoji || '🎵';
  } catch { return '🎵'; }
};

const getTypeConfig = (type) => TYPE_CONFIG[type] || {
  icon: Bell, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', label: 'Notification'
};

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'À l\'instant';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const isIOSDevice = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// ── Toast individuel avec swipe-to-dismiss ───────────────────────────
const ToastItem = ({ toast, onDismiss }) => {
  const cfg = getTypeConfig(toast.type);
  const Icon = cfg.icon;
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-140, 0, 140], [0, 1, 0]);

  return (
    <motion.div
      style={{ x, opacity,
        background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`,
        border: `1.5px solid ${cfg.color}60`,
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: 16,
        padding: '12px 14px 12px 12px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px ${cfg.color}20, 0 4px 16px ${cfg.color}25`,
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80) onDismiss();
      }}
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.93 }}
      transition={{ type: 'spring', damping: 24, stiffness: 380 }}
      className="flex items-start gap-3 cursor-pointer select-none overflow-hidden"
      onClick={onDismiss}
    >
      {/* Icône type — toujours visible, fond coloré fort */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${cfg.color}25`, border: `1.5px solid ${cfg.color}50` }}
      >
        {toast.icon_url
          ? <img src={toast.icon_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
          : (() => { const moodEmoji = getMoodConfig(toast); return moodEmoji
            ? <span className="text-xl">{moodEmoji}</span>
            : <Icon className="w-5 h-5" style={{ color: cfg.color }} />; })()
        }
      </div>

      {/* Texte — contraste maximum */}
      <div className="flex-1 min-w-0">
        {/* Label type + heure */}
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">
            {timeAgo(toast.created_at)}
          </span>
        </div>

        {/* Titre — blanc pur, gras */}
        <p
          className="text-sm font-bold leading-snug"
          style={{ color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
        >
          {toast.title}
        </p>

        {/* Corps — gris clair lisible */}
        {toast.body && (
          <p
            className="text-xs leading-relaxed mt-0.5 line-clamp-2"
            style={{ color: '#c9d1d9' }}
          >
            {toast.body}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors mt-0.5"
        style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

// ── Toast container ──────────────────────────────────────────────────
export const NotificationToast = () => {
  const { notifications } = useNotifications();
  const [toasts, setToasts] = useState([]);
  const shownIds = useRef(new Set());
  const ios = useRef(isIOSDevice());

  useEffect(() => {
    if (!notifications.length) return;
    const latest = notifications[0];
    if (ios.current && latest?.type === 'new_song') return;
    if (latest && !latest.is_read && !shownIds.current.has(latest.id)) {
      shownIds.current.add(latest.id);
      const toastId = Date.now();
      setToasts(prev => [{ ...latest, _toastId: toastId }, ...prev].slice(0, 4));
      setTimeout(() => setToasts(prev => prev.filter(t => t._toastId !== toastId)), 5500);

      // Vibration douce sur mobile si notif importante
      if ('vibrate' in navigator && ['like','follow','chat_reply'].includes(latest.type)) {
        navigator.vibrate?.(40);
      }
    }
  }, [notifications[0]?.id]);

  return ReactDOM.createPortal(
    <div
      className="fixed z-[10001] flex flex-col gap-2.5"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        right: 12,
        left: 12,
        maxWidth: 380,
        marginLeft: 'auto',
      }}
    >
      <AnimatePresence>
        {toasts.map(t => (
          <ToastItem
            key={t._toastId}
            toast={t}
            onDismiss={() => setToasts(prev => prev.filter(x => x._toastId !== t._toastId))}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

// ── Notif item dans le panel ─────────────────────────────────────────
const NotifItem = ({ notif, onRead, onDelete, onClick }) => {
  const cfg = getTypeConfig(notif.type);
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.15 }}
      className="relative group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-white/[0.04] last:border-0"
      style={{ background: notif.is_read ? 'transparent' : `${cfg.color}06` }}
      onClick={onClick}
    >
      {/* Dot non lu */}
      {!notif.is_read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      )}

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {notif.icon_url
          ? <img src={notif.icon_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-white/10" />
          : <div className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ background: cfg.bg, borderColor: `${cfg.color}25` }}>
              {(() => { const moodEmoji = getMoodConfig(notif); return moodEmoji ? <span className="text-base">{moodEmoji}</span> : <Icon className="w-4 h-4" style={{ color: cfg.color }} />; })()}
            </div>
        }
        {notif.icon_url && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-lg flex items-center justify-center" style={{ background: 'rgb(10,15,30)', border: `1px solid ${cfg.color}25` }}>
            <Icon className="w-2.5 h-2.5" style={{ color: cfg.color }} />
          </div>
        )}
      </div>

      {/* Texte */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-[10px] text-gray-600">{timeAgo(notif.created_at)}</span>
        </div>
        <p className="text-sm font-semibold text-white leading-tight">{notif.title}</p>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mt-0.5">{notif.body}</p>
      </div>

      {/* Actions hover */}
      <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notif.is_read && (
          <button onClick={e => { e.stopPropagation(); onRead(); }}
            className="p-1 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: cfg.color }} title="Marquer comme lu">
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-white/10 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

// ── Panel notifications ──────────────────────────────────────────────
const NotifPanel = ({ panelRef, panelPos, onClose, mobile }) => {
  const navigate = useNavigate();
  const {
    notifications, unreadCount, permission, pushEnabled, loading,
    requestPermission, disablePush,
    markAsRead, markAllAsRead, deleteNotification, clearAll, loadNotifications,
  } = useNotifications();

  const [tab, setTab] = useState('all');
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadNotifications?.(); }, []);

  // Base filtered (lu/non-lu uniquement)
  const baseFiltered = notifications.filter(n => {
    if (tab === 'unread' && n.is_read) return false;
    return true;
  });

  // Final filtered (+ filtre type)
  const filtered = baseFiltered.filter(n => {
    if (filter !== 'all' && n.type !== filter) return false;
    return true;
  });

  // Compteurs par type (sur baseFiltered pour que les badges soient exacts)
  const countByType = {};
  baseFiltered.forEach(n => {
    const k = n.type || 'other';
    countByType[k] = (countByType[k] || 0) + 1;
  });

  const handleClick = (notif) => {
    if (!notif.is_read) markAsRead(notif.id);
    onClose();
    if (notif.url) {
      const path = notif.url.replace(/^#\//, '/').replace(/^#/, '/');
      navigate(path);
    }
  };

  // Tous les types supportés — seuls ceux qui ont des notifs sont affichés (+ "Tout")
  const ALL_TYPE_FILTERS = [
    { key: 'all',              emoji: '🔔', label: 'Tout'   },
    { key: 'like',             emoji: '❤️', label: 'Likes'  },
    { key: 'comment',          emoji: '💬', label: 'Comms'  },
    { key: 'follow',           emoji: '👤', label: 'Abos'   },
    { key: 'chat_reply',       emoji: '↩️', label: 'Rép.'   },
    { key: 'chat_mention',     emoji: '@',  label: 'Mentions'},
    { key: 'chat_mention_all', emoji: '⚡', label: '@tous'  },
    { key: 'new_song',         emoji: '🎵', label: 'Sons'   },
    { key: 'repost',           emoji: '🔁', label: 'Reposts'},
    { key: 'mood_vote',        emoji: '🎭', label: 'Vibes'  },
    { key: 'news',             emoji: '📰', label: 'News'   },
  ];
  // N'affiche que "Tout" + les types qui ont au moins 1 notif
  const typeFilters = ALL_TYPE_FILTERS.filter(
    f => f.key === 'all' || (countByType[f.key] || 0) > 0
  );

  const panelStyle = mobile ? {
    background: 'transparent', border: 'none', boxShadow: 'none',
    borderRadius: 0, width: '100%', maxHeight: 'none',
  } : {
    position: 'fixed',
    top: panelPos.top,
    right: panelPos.right,
    zIndex: 9999,
    width: Math.min(390, window.innerWidth - 16),
    maxHeight: 'min(580px, 88vh)',
    borderRadius: 20,
    background: 'rgba(8,12,24,0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(6,182,212,0.08)',
  };

  return (
    <motion.div
      ref={mobile ? undefined : panelRef}
      initial={mobile ? false : { opacity: 0, y: -10, scale: 0.96 }}
      animate={mobile ? false : { opacity: 1, y: 0, scale: 1 }}
      exit={mobile ? false : { opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.18, type: 'spring', damping: 28, stiffness: 380 }}
      style={{ ...panelStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.07] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 flex items-center justify-center border border-cyan-500/20">
            <Bell className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-white font-bold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/25 text-cyan-400 text-xs font-bold border border-cyan-500/20">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-white/10 transition-all"
              title="Tout marquer comme lu">
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/10 transition-all"
              title="Tout supprimer">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {!mobile && (
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs lu/non-lu */}
      <div className="flex items-center gap-1 px-4 pt-2 flex-shrink-0">
        {[{ k: 'all', l: 'Toutes' }, { k: 'unread', l: `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ''}` }].map(({ k, l }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === k
                ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 text-white border border-white/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >{l}</button>
        ))}
      </div>

      {/* Filtre par type — avec compteurs */}
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-white/[0.05]">
        {typeFilters.map(({ key, emoji, label }) => {
          const count = key === 'all' ? baseFiltered.length : (countByType[key] || 0);
          const active = filter === key;
          const cfg = getTypeConfig(key);
          return (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                active
                  ? 'text-white border'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
              style={active ? {
                background: key === 'all' ? 'rgba(255,255,255,0.12)' : `${cfg.color}20`,
                borderColor: key === 'all' ? 'rgba(255,255,255,0.15)' : `${cfg.color}40`,
                color: key === 'all' ? '#fff' : cfg.color,
              } : {}}
            >
              <span className="text-sm leading-none">{emoji || '🔔'}</span>
              <span className="hidden sm:inline">{label}</span>
              {count > 0 && (
                <span className={`text-[9px] font-black px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none ${
                  active ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Liste groupée par catégorie */}
      <div className="flex-1 overflow-y-auto" style={mobile ? { maxHeight: 300 } : {}}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3 border border-white/[0.06]">
              {filter !== 'all' ? (
                <span className="text-2xl">{ALL_TYPE_FILTERS.find(f => f.key === filter)?.emoji || '🔔'}</span>
              ) : (
                <Bell className="w-6 h-6 text-gray-700" />
              )}
            </div>
            <p className="text-gray-400 text-sm font-semibold">
              {tab === 'unread'
                ? '✓ Tout est lu'
                : filter !== 'all'
                  ? `Aucune notification "${ALL_TYPE_FILTERS.find(f => f.key === filter)?.label || filter}"`
                  : 'Aucune notification'}
            </p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}
                className="mt-2 text-xs text-cyan-500 hover:text-cyan-400 transition-colors">
                Voir toutes les notifications
              </button>
            )}
            <Link to="/notifications" onClick={() => setOpen(false)}
              className="mt-2 block text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors">
              Ouvrir la page notifications →
            </Link>
          </div>
        ) : filter !== 'all' ? (
          // Vue filtrée par type : groupée avec header coloré
          (() => {
            const cfg = getTypeConfig(filter);
            const Icon = cfg.icon;
            return (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 sticky top-0 z-10"
                  style={{ background: 'rgba(8,12,24,0.96)', borderBottom: `1px solid ${cfg.color}30` }}>
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center"
                    style={{ background: `${cfg.color}25`, border: `1px solid ${cfg.color}40` }}>
                    <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${cfg.color}20`, color: cfg.color }}>
                    {filtered.length}
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {filtered.map(notif => (
                    <NotifItem
                      key={notif.id}
                      notif={notif}
                      onRead={() => markAsRead(notif.id)}
                      onDelete={() => deleteNotification(notif.id)}
                      onClick={() => handleClick(notif)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            );
          })()
        ) : (
          // Vue groupée par catégorie
          (() => {
            const ORDER = ['like','comment','follow','chat_reply','chat_mention','chat_mention_all','new_song','repost','news'];
            const groups = {};
            filtered.forEach(n => {
              const k = ORDER.includes(n.type) ? n.type : 'other';
              if (!groups[k]) groups[k] = [];
              groups[k].push(n);
            });
            const sortedKeys = [...ORDER.filter(k => groups[k]), ...Object.keys(groups).filter(k => !ORDER.includes(k) && groups[k])];
            return sortedKeys.map(key => {
              const cfg = TYPE_CONFIG[key] || { icon: Bell, color: '#94a3b8', label: 'Autre' };
              const Icon = cfg.icon;
              const items = groups[key];
              return (
                <div key={key}>
                  {/* Header catégorie */}
                  <div className="flex items-center gap-2 px-4 py-1.5 sticky top-0 z-10"
                    style={{ background: 'rgba(8,12,24,0.96)', borderBottom: `1px solid ${cfg.color}18` }}>
                    <div className="w-4 h-4 rounded-md flex items-center justify-center"
                      style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}30` }}>
                      <Icon className="w-2.5 h-2.5" style={{ color: cfg.color }} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span className="ml-auto text-[10px] text-gray-600 font-semibold">{items.length}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {items.map(notif => (
                      <NotifItem
                        key={notif.id}
                        notif={notif}
                        onRead={() => markAsRead(notif.id)}
                        onDelete={() => deleteNotification(notif.id)}
                        onClick={() => handleClick(notif)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              );
            });
          })()
        )}
      </div>

      {/* Footer push */}
      <div className="px-4 py-3 border-t border-white/[0.07] flex-shrink-0 bg-black/20">
        {isIOSDevice() && (
          <p className="text-[10px] text-amber-400/80 text-center mb-2 leading-relaxed">
            🍎 iOS: installer via Safari → Partager → Écran d'accueil pour les push
          </p>
        )}
        {permission === 'denied' ? (
          <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1.5">
            <BellOff className="w-3.5 h-3.5" />Notifications bloquées dans les paramètres
          </p>
        ) : !pushEnabled ? (
          <button onClick={requestPermission} disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(90deg,#06b6d4,#a855f7)', color: '#fff', boxShadow: '0 4px 20px rgba(6,182,212,0.3)' }}
          >
            {loading
              ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <Bell className="w-3.5 h-3.5" />
            }
            Activer les notifications push
          </button>
        ) : (
          <button onClick={disablePush}
            className="w-full py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-400 flex items-center justify-center gap-2 transition-colors">
            <BellOff className="w-3.5 h-3.5" />Désactiver les notifications push
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ── Composant principal ──────────────────────────────────────────────
const NotificationBell = ({ mobile = false, closeMenu }) => {
  const { currentUser } = useAuth();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const btnRef   = useRef(null);
  const panelRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 16 });
  const prevCount = useRef(unreadCount);

  // Animation pulse sur nouvelle notif
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  /* Fermer si clic extérieur (desktop) */
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

  /* Position panel */
  useEffect(() => {
    if (!open || mobile || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = Math.min(390, window.innerWidth - 16);
    const right  = Math.max(8, window.innerWidth - r.right);
    setPanelPos({ top: r.bottom + 8, right: Math.min(right, window.innerWidth - panelW - 8) });
  }, [open, mobile]);

  if (!currentUser) return null;

  /* ── MODE MOBILE — inline dans le drawer ── */
  if (mobile) {
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-xl transition-colors"
        >
          <div className="relative">
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-cyan-400' : ''} ${pulse ? 'animate-bounce' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="font-medium">Notifications</span>
          {unreadCount > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold border border-cyan-500/20">
              {unreadCount}
            </span>
          )}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden mx-2 mb-1 rounded-2xl border border-white/[0.08]"
              style={{ background: 'rgba(8,12,24,0.98)' }}
            >
              <NotifPanel mobile onClose={() => setOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ── MODE DESKTOP ── */
  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`relative p-2 rounded-xl transition-all ${open ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 ? 'text-cyan-400' : ''} ${pulse ? 'animate-bounce' : ''}`} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg pointer-events-none"
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
