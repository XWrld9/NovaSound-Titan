/**
 * NotificationsPage — NovaSound TITAN LUX V400000
 * ✅ Design professionnel type "inbox" glassmorphism
 * ✅ Stats bar, filtres avec compteurs, groupement par date
 * ✅ i18n complet
 */
import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, X,
  Heart, MessageCircle, UserPlus, Music, Newspaper,
  Reply, AtSign, Zap, Radio, Trophy, Settings,
  ChevronRight, Volume2, ArrowLeft, Sparkles, ShieldCheck,
} from 'lucide-react';
import Header from '@/components/Header';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_CONFIG = {
  like:             { icon: Heart,         color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   label: 'Like'        },
  comment:          { icon: MessageCircle, color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   label: 'Comment'     },
  follow:           { icon: UserPlus,      color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  label: 'Follow'      },
  new_song:         { icon: Music,         color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'New Track'   },
  repost:           { icon: Reply,         color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Repost'      },
  news:             { icon: Newspaper,     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'News'        },
  chat_reply:       { icon: Reply,         color: '#e879f9', bg: 'rgba(232,121,249,0.12)', label: 'Reply'      },
  chat_mention:     { icon: AtSign,        color: '#67e8f9', bg: 'rgba(103,232,249,0.12)', label: 'Mention'    },
  chat_mention_all: { icon: Zap,           color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: '@all'        },
  mood_vote:        { icon: Zap,           color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  label: 'Vibe'        },
  live_start:       { icon: Radio,         color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   label: 'Live'        },
  live_started:     { icon: Radio,         color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   label: 'Live'        },
  live_invite:      { icon: Radio,         color: '#fb7185', bg: 'rgba(251,113,133,0.12)', label: 'Invite'     },
  queue_song:       { icon: Music,         color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Queue'       },
  achievement:      { icon: Trophy,        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Achievement' },
};
const getCfg = (type) => TYPE_CONFIG[type] || { icon: Bell, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Notification' };

const TABS = [
  { id: 'all',    label: 'Tout',    types: null },
  { id: 'music',  label: '🎵 Sons',  types: ['like','new_song','repost','comment','queue_song','mood_vote'] },
  { id: 'social', label: '👥 Social', types: ['follow','achievement'] },
  { id: 'live',   label: '🔴 Live',   types: ['live_start','live_started','live_invite'] },
  { id: 'chat',   label: '💬 Chat',   types: ['chat_reply','chat_mention','chat_mention_all','news'] },
];

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'À l\'instant';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const groupByDate = (notifs) => {
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups    = { today: [], yesterday: [], older: [] };
  for (const n of notifs) {
    const d = new Date(n.created_at); d.setHours(0,0,0,0);
    if (d >= today)          groups.today.push(n);
    else if (d >= yesterday) groups.yesterday.push(n);
    else                     groups.older.push(n);
  }
  return groups;
};

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex-1 min-w-0">
    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-black text-white leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate">{label}</p>
    </div>
  </div>
);

const NotifRow = ({ notif, onRead, onDelete, onNavigate }) => {
  const cfg  = getCfg(notif.type);
  const Icon = cfg.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30, height: 0 }}
      transition={{ duration: 0.18 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => { if (!notif.is_read) onRead(notif.id); if (notif.url) onNavigate(notif.url); }}
      className={`group relative flex items-start gap-3.5 px-4 py-4 cursor-pointer transition-all duration-150 ${
        notif.is_read
          ? 'hover:bg-white/[0.025]'
          : 'bg-white/[0.035] hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex-shrink-0 w-2 mt-2.5">
        {!notif.is_read && (
          <span className="block w-2 h-2 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}60` }} />
        )}
      </div>

      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: cfg.bg }}>
          {notif.icon_url
            ? <img src={notif.icon_url} alt="" className="w-10 h-10 rounded-2xl object-cover" />
            : <Icon className="w-5 h-5" style={{ color: cfg.color }} />
          }
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${notif.is_read ? 'text-gray-400' : 'text-white'}`}>
          {notif.title}
        </p>
        {notif.body && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{notif.body}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${cfg.color}15`, color: `${cfg.color}cc` }}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-gray-600">{timeAgo(notif.created_at)}</span>
        </div>
      </div>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="flex-shrink-0 flex items-center gap-1"
          >
            {!notif.is_read && (
              <button onClick={(e) => { e.stopPropagation(); onRead(notif.id); }}
                className="w-7 h-7 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center transition-all">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
              className="w-7 h-7 rounded-xl bg-white/[0.04] hover:bg-red-500/15 flex items-center justify-center transition-all">
              <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400 transition-colors" />
            </button>
            {notif.url && <ChevronRight className="w-4 h-4 text-gray-600" />}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const DateHeader = ({ label, count }) => (
  <div className="flex items-center gap-3 px-4 py-2.5 mt-2">
    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">{label}</span>
    <span className="text-[10px] text-gray-700 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full font-bold">{count}</span>
    <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
  </div>
);

const EmptyState = ({ tab, t }) => {
  const icons = { all: '🔔', music: '🎵', social: '👥', live: '🔴', chat: '💬' };
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center px-8">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.08] flex items-center justify-center">
          <Bell className="w-10 h-10 text-gray-700" />
        </div>
        <div className="absolute -top-2 -right-2 text-3xl">{icons[tab] || '🔔'}</div>
      </div>
      <h3 className="text-lg font-bold text-gray-300 mb-2">{'Aucune notification'}</h3>
      <p className="text-sm text-gray-600 max-w-xs leading-relaxed">
        {tab === 'all' ? 'Tu es à jour 🎉' : 'Aucune notification dans cet onglet'}
      </p>
    </motion.div>
  );
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    notifications, unreadCount,
    markAsRead, markAllAsRead, deleteNotification, clearAll,
    pushEnabled, permission, requestPermission, disablePush, loading,
  } = useNotifications();

  const [activeTab,    setActiveTab]    = useState('all');
  const [showPush,     setShowPush]     = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const filtered = useMemo(() => {
    const tab = TABS.find(tb => tb.id === activeTab);
    if (!tab?.types) return notifications;
    return notifications.filter(n => tab.types.includes(n.type));
  }, [notifications, activeTab]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const tabCounts = useMemo(() => {
    const counts = {};
    for (const tab of TABS) {
      counts[tab.id] = tab.types
        ? notifications.filter(n => !n.is_read && tab.types.includes(n.type)).length
        : unreadCount;
    }
    return counts;
  }, [notifications, unreadCount]);

  const handleNavigate = (url) => {
    if (!url) return;
    if (!url.startsWith('/')) { window.open(url, '_blank'); return; }
    // ✅ FIX: React Router HashRouter ne gère pas les fragments dans navigate().
    // On passe par window.location.hash pour tous les cas :
    //   /song/123#comment-456  → /#/song/123#comment-456  ✅
    //   /chat?highlight=abc    → /#/chat?highlight=abc     ✅
    //   /artist/xxx            → /#/artist/xxx             ✅
    const newHash = '#' + url;
    if (window.location.hash === newHash) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = newHash;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#060810] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center px-6">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-5">
              <Bell className="w-9 h-9 text-gray-600" />
            </div>
            <p className="text-gray-400 font-semibold text-lg mb-4">{'Connecte-toi pour voir tes notifications'}</p>
            <button onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-sm font-bold rounded-2xl">
              {'Connexion'}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>{'Notifications'} — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-[#060810] flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] flex items-center justify-center transition-all border border-white/[0.06]">
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
                  <Bell className="w-5 h-5 text-cyan-400" />
                  {'Notifications'}
                  {unreadCount > 0 && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="text-xs bg-gradient-to-r from-red-500 to-pink-500 text-white font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-red-500/30">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                  )}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">{notifications.length} {notifications.length <= 1 ? 'notification' : 'notifications'} au total</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{'Tout marquer comme lu'}</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={() => setClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-bold border border-white/[0.06] hover:border-red-500/20 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{'Tout vider'}</span>
                </button>
              )}
              <button onClick={() => setShowPush(s => !s)}
                className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all border ${showPush ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' : 'bg-white/[0.04] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats */}
          {notifications.length > 0 && (
            <div className="flex gap-3 mb-6 overflow-x-auto no-scrollbar">
              <StatCard icon={Bell} value={notifications.length} label="Total" color="#94a3b8" />
              {unreadCount > 0 && <StatCard icon={Sparkles} value={unreadCount} label="Non lus" color="#f43f5e" />}
              <StatCard icon={pushEnabled ? ShieldCheck : BellOff} value={pushEnabled ? 'ON' : 'OFF'} label={'Notifications push'} color={pushEnabled ? '#10b981' : '#6b7280'} />
            </div>
          )}

          {/* Push settings */}
          <AnimatePresence>
            {showPush && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
                <div className="bg-gradient-to-br from-gray-900/90 to-gray-900/60 border border-cyan-500/20 rounded-3xl p-5 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${pushEnabled ? 'bg-emerald-500/15' : 'bg-gray-800'}`}>
                        {pushEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <BellOff className="w-5 h-5 text-gray-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{'Notifications push'}</p>
                        <p className="text-xs text-gray-500">
                          {pushEnabled ? 'Activées sur cet appareil' : 'Désactivées'}
                          {permission === 'denied' && ` — ${'Bloquées dans le navigateur'}`}
                        </p>
                      </div>
                    </div>
                    {permission !== 'denied' && (
                      <button onClick={pushEnabled ? disablePush : requestPermission} disabled={loading}
                        className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${pushEnabled ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25'}`}>
                        {loading ? '…' : pushEnabled ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clear confirm */}
          <AnimatePresence>
            {clearConfirm && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="mb-5">
                <div className="bg-gradient-to-r from-red-950/80 to-red-900/40 border border-red-500/30 rounded-3xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-red-200 font-bold">{'Supprimer toutes les notifications ?'}</p>
                    <p className="text-xs text-red-400/70 mt-0.5">{'Cette action est irréversible.'}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setClearConfirm(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">{'Annuler'}</button>
                    <button onClick={async () => { await clearAll(); setClearConfirm(false); }}
                      className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold rounded-xl border border-red-500/30 transition-all">
                      {'Supprimer tout'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-5 pb-1">
            {TABS.map(tab => {
              const count = tabCounts[tab.id];
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'bg-white/[0.04] text-gray-500 border border-white/[0.05] hover:text-gray-300 hover:bg-white/[0.06]'
                  }`}>
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/[0.08] text-gray-400'}`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          {filtered.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <AnimatePresence mode="popLayout">
              {groups.today.length > 0 && (
                <motion.div key="today" layout>
                  <DateHeader label={'Aujourd\'hui'} count={groups.today.length} />
                  <div className="bg-white/[0.015] border border-white/[0.05] rounded-3xl overflow-hidden divide-y divide-white/[0.04]">
                    {groups.today.map(n => <NotifRow key={n.id} notif={n} onRead={markAsRead} onDelete={deleteNotification} onNavigate={handleNavigate} />)}
                  </div>
                </motion.div>
              )}
              {groups.yesterday.length > 0 && (
                <motion.div key="yesterday" layout>
                  <DateHeader label={'Hier'} count={groups.yesterday.length} />
                  <div className="bg-white/[0.015] border border-white/[0.05] rounded-3xl overflow-hidden divide-y divide-white/[0.04]">
                    {groups.yesterday.map(n => <NotifRow key={n.id} notif={n} onRead={markAsRead} onDelete={deleteNotification} onNavigate={handleNavigate} />)}
                  </div>
                </motion.div>
              )}
              {groups.older.length > 0 && (
                <motion.div key="older" layout>
                  <DateHeader label={'Plus ancien'} count={groups.older.length} />
                  <div className="bg-white/[0.015] border border-white/[0.05] rounded-3xl overflow-hidden divide-y divide-white/[0.04]">
                    {groups.older.map(n => <NotifRow key={n.id} notif={n} onRead={markAsRead} onDelete={deleteNotification} onNavigate={handleNavigate} />)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
};

export default NotificationsPage;
