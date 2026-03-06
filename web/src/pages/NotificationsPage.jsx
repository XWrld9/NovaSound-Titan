/**
 * NotificationsPage — NovaSound TITAN LUX V60000
 *
 * Page dédiée /notifications :
 * ✅ Toutes les notifications avec filtres par type
 * ✅ Marquage tout lu / suppression tout
 * ✅ Actions rapides (marquer lu, supprimer) par notif
 * ✅ Navigation vers la source d'un seul clic
 * ✅ Realtime (via NotificationContext)
 * ✅ Paramètres push intégrés
 * ✅ Empty states par type
 * ✅ Date grouping (Aujourd'hui / Hier / Plus ancien)
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, X,
  Heart, MessageCircle, UserPlus, Music, Newspaper,
  Reply, AtSign, Zap, Radio, Trophy, Settings,
  ChevronRight, Volume2, Filter, ArrowLeft,
} from 'lucide-react';
import Header from '@/components/Header';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';

// ── Type config ──────────────────────────────────────────────
const TYPE_CONFIG = {
  like:             { icon: Heart,         color: '#f43f5e', label: 'Like',            bg: 'rgba(244,63,94,0.12)'   },
  comment:          { icon: MessageCircle, color: '#06b6d4', label: 'Commentaire',     bg: 'rgba(6,182,212,0.12)'   },
  follow:           { icon: UserPlus,      color: '#a855f7', label: 'Abonnement',      bg: 'rgba(168,85,247,0.12)'  },
  new_song:         { icon: Music,         color: '#10b981', label: 'Nouveau son',     bg: 'rgba(16,185,129,0.12)'  },
  repost:           { icon: Reply,         color: '#34d399', label: 'Repartage',       bg: 'rgba(52,211,153,0.12)'  },
  news:             { icon: Newspaper,     color: '#f59e0b', label: 'Actualité',       bg: 'rgba(245,158,11,0.12)'  },
  chat_reply:       { icon: Reply,         color: '#e879f9', label: 'Réponse chat',    bg: 'rgba(232,121,249,0.12)' },
  chat_mention:     { icon: AtSign,        color: '#67e8f9', label: 'Mention',         bg: 'rgba(103,232,249,0.12)' },
  chat_mention_all: { icon: Zap,           color: '#fbbf24', label: '@tous',           bg: 'rgba(251,191,36,0.12)'  },
  mood_vote:        { icon: Zap,           color: '#fb923c', label: 'Vibe',            bg: 'rgba(251,146,60,0.12)'  },
  live_start:       { icon: Radio,         color: '#f43f5e', label: 'Live démarré',    bg: 'rgba(244,63,94,0.12)'   },
  live_invite:      { icon: Radio,         color: '#fb7185', label: 'Invitation live', bg: 'rgba(251,113,133,0.12)' },
  queue_song:       { icon: Music,         color: '#34d399', label: 'File d\'attente', bg: 'rgba(52,211,153,0.12)'  },
  achievement:      { icon: Trophy,        color: '#f59e0b', label: 'Trophée',         bg: 'rgba(245,158,11,0.12)'  },
};
const getCfg = (type) => TYPE_CONFIG[type] || { icon: Bell, color: '#94a3b8', label: 'Notification', bg: 'rgba(148,163,184,0.12)' };

// ── Tabs definition ──────────────────────────────────────────
const TABS = [
  { id: 'all',       label: 'Tout',        types: null },
  { id: 'music',     label: '🎵 Sons',     types: ['like','new_song','repost','comment','queue_song','mood_vote'] },
  { id: 'social',    label: '👥 Social',   types: ['follow','achievement'] },
  { id: 'live',      label: '🔴 Live',     types: ['live_start','live_invite'] },
  { id: 'chat',      label: '💬 Chat',     types: ['chat_reply','chat_mention','chat_mention_all','news'] },
];

// ── Helpers ──────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'À l\'instant';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const groupByDate = (notifs) => {
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups    = { today: [], yesterday: [], older: [] };
  for (const n of notifs) {
    const d = new Date(n.created_at); d.setHours(0,0,0,0);
    if (d >= today)         groups.today.push(n);
    else if (d >= yesterday) groups.yesterday.push(n);
    else                     groups.older.push(n);
  }
  return groups;
};

// ── Notification row ─────────────────────────────────────────
const NotifRow = ({ notif, onRead, onDelete, onNavigate }) => {
  const cfg  = getCfg(notif.type);
  const Icon = cfg.icon;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    await onDelete(notif.id);
  };

  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
    if (notif.url) onNavigate(notif.url);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: deleting ? 0 : 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.18 }}
      onClick={handleClick}
      className={`group flex items-start gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all border
        ${notif.is_read
          ? 'bg-transparent border-transparent hover:bg-white/[0.03]'
          : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]'
        }`}
    >
      {/* Dot unread */}
      <div className="flex-shrink-0 mt-1.5">
        {!notif.is_read && (
          <span className="block w-2 h-2 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}80` }} />
        )}
        {notif.is_read && <span className="block w-2 h-2" />}
      </div>

      {/* Icon */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: cfg.bg }}
      >
        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug truncate ${notif.is_read ? 'text-gray-400' : 'text-white'}`}>
          {notif.title}
        </p>
        {notif.body && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{notif.body}</p>
        )}
        <p className="text-[10px] mt-1" style={{ color: `${cfg.color}90` }}>{timeAgo(notif.created_at)}</p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notif.is_read && (
          <button
            onClick={(e) => { e.stopPropagation(); onRead(notif.id); }}
            title="Marquer comme lu"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-emerald-500/20 flex items-center justify-center transition-all"
          >
            <Check className="w-3.5 h-3.5 text-gray-400 hover:text-emerald-400" />
          </button>
        )}
        <button
          onClick={handleDelete}
          title="Supprimer"
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-all"
        >
          <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
        </button>
        {notif.url && (
          <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
        )}
      </div>
    </motion.div>
  );
};

// ── Date group header ─────────────────────────────────────────
const DateHeader = ({ label, count }) => (
  <div className="flex items-center gap-3 px-4 py-2 mt-2">
    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
    <span className="text-[10px] text-gray-700 bg-white/[0.04] px-2 py-0.5 rounded-full">{count}</span>
    <div className="flex-1 h-px bg-white/[0.04]" />
  </div>
);

// ── Empty state ───────────────────────────────────────────────
const EmptyState = ({ tab }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 text-center"
  >
    <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
      <Bell className="w-7 h-7 text-gray-600" />
    </div>
    <p className="text-gray-400 font-semibold">Aucune notification</p>
    <p className="text-gray-600 text-sm mt-1">
      {tab === 'all'
        ? 'Tu es à jour 🎉'
        : `Aucune notification dans "${tab}"`}
    </p>
  </motion.div>
);

// ════════════════════════════════════════════════════════════
const NotificationsPage = () => {
  const { t } = useTranslation();
  const navigate   = useNavigate();
  const { currentUser } = useAuth();
  const {
    notifications, unreadCount,
    markAsRead, markAllAsRead, deleteNotification, clearAll,
    pushEnabled, permission, requestPermission, disablePush, loading,
  } = useNotifications();

  const [activeTab,   setActiveTab]   = useState('all');
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Filter by tab
  const filtered = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab || !tab.types) return notifications;
    return notifications.filter(n => tab.types.includes(n.type));
  }, [notifications, activeTab]);

  // Group by date
  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const handleNavigate = (url) => {
    if (!url) return;
    if (url.startsWith('/')) {
      window.location.hash = '#' + url;
    } else {
      window.open(url, '_blank');
    }
  };

  // Tab unread counts
  const tabCounts = useMemo(() => {
    const counts = {};
    for (const tab of TABS) {
      if (!tab.types) {
        counts[tab.id] = unreadCount;
      } else {
        counts[tab.id] = notifications.filter(n => !n.is_read && tab.types.includes(n.type)).length;
      }
    }
    return counts;
  }, [notifications, unreadCount]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Connecte-toi pour voir tes notifications</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Notifications — NovaSound TITAN LUX</title>
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24">
        <Header />

        <main className="flex-1 container mx-auto px-0 sm:px-4 py-4 max-w-2xl lg:max-w-4xl">

          {/* ── Page header ── */}
          <div className="flex items-center justify-between px-4 sm:px-0 mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] transition-all">
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
              <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-cyan-400" />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">{notifications.length} notification{notifications.length !== 1 ? 's' : ''} au total</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tout lire</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => setClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-bold border border-white/[0.06] hover:border-red-500/20 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Vider</span>
                </button>
              )}
              <button
                onClick={() => setShowPushSettings(s => !s)}
                className={`p-2 rounded-xl transition-all border ${
                  showPushSettings
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                    : 'bg-white/[0.04] border-white/[0.06] text-gray-500 hover:text-gray-300'
                }`}
                title="Paramètres push"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Push settings panel ── */}
          <AnimatePresence>
            {showPushSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-4 sm:mx-0 mb-4 overflow-hidden"
              >
                <div className="bg-gray-900/80 border border-cyan-500/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${pushEnabled ? 'bg-emerald-500/15' : 'bg-gray-800'}`}>
                        {pushEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 text-gray-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Notifications push</p>
                        <p className="text-xs text-gray-500">
                          {pushEnabled ? 'Activées sur cet appareil' : 'Désactivées'}
                          {permission === 'denied' && ' — Bloquées dans le navigateur'}
                        </p>
                      </div>
                    </div>
                    {permission !== 'denied' && (
                      <button
                        onClick={pushEnabled ? disablePush : requestPermission}
                        disabled={loading}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          pushEnabled
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                            : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25'
                        }`}
                      >
                        {loading ? '...' : pushEnabled ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Confirm clear all ── */}
          <AnimatePresence>
            {clearConfirm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="mx-4 sm:mx-0 mb-4"
              >
                <div className="bg-red-950/60 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-red-300 font-medium">Supprimer toutes les notifications ?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setClearConfirm(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">Annuler</button>
                    <button
                      onClick={async () => { await clearAll(); setClearConfirm(false); }}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 transition-all"
                    >
                      Supprimer tout
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tabs ── */}
          <div className="flex gap-1 overflow-x-auto px-4 sm:px-0 mb-4 no-scrollbar">
            {TABS.map(tab => {
              const count = tabCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/[0.04] text-gray-500 border border-white/[0.05] hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      activeTab === tab.id ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/[0.08] text-gray-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Notification list ── */}
          <div className="px-4 sm:px-0">
            {filtered.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <AnimatePresence mode="popLayout">
                {groups.today.length > 0 && (
                  <motion.div key="today">
                    <DateHeader label="Aujourd'hui" count={groups.today.length} />
                    {groups.today.map(n => (
                      <NotifRow key={n.id} notif={n} onRead={markAsRead} onDelete={deleteNotification} onNavigate={handleNavigate} />
                    ))}
                  </motion.div>
                )}
                {groups.yesterday.length > 0 && (
                  <motion.div key="yesterday">
                    <DateHeader label="Hier" count={groups.yesterday.length} />
                    {groups.yesterday.map(n => (
                      <NotifRow key={n.id} notif={n} onRead={markAsRead} onDelete={deleteNotification} onNavigate={handleNavigate} />
                    ))}
                  </motion.div>
                )}
                {groups.older.length > 0 && (
                  <motion.div key="older">
                    <DateHeader label="Plus ancien" count={groups.older.length} />
                    {groups.older.map(n => (
                      <NotifRow key={n.id} notif={n} onRead={markAsRead} onDelete={deleteNotification} onNavigate={handleNavigate} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
};

export default NotificationsPage;
