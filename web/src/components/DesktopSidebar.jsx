/**
 * DesktopSidebar — NovaSound TITAN LUX V200000
 * Sidebar gauche fixe style Spotify — visible uniquement sur md+ (≥768px)
 * - Navigation complète avec icônes + labels
 * - Voyant live dynamique
 * - Badge notifications
 * - Bouton langue FR/EN
 * - Bouton Installer (uniquement si PWA installable)
 * - Masquée sur /live/:roomId (immersion totale)
 */
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Compass, TrendingUp, Radio, Users, Newspaper, MessageSquare,
  Trophy, HardDrive, Upload, User, ListMusic, BarChart2, Bell,
  MessageCircle, Shield, LogOut, LogIn, UserPlus, Download, Globe2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabaseClient';
import usePWAInstall from '@/hooks/usePWAInstall';

/* ─── Groupes de navigation ──────────────────────────────────────────────── */
const useNavGroups = (t, isAuthenticated, isAdmin) => [
  {
    label: null,
    items: [
      { to: '/',            icon: Home,          key: 'home'        },
      { to: '/explorer',    icon: Compass,       key: 'explore'     },
      { to: '/trending',    icon: TrendingUp,    key: 'trending'    },
      { to: '/live',        icon: Radio,         key: 'live',   liveIndicator: true },
      { to: '/artists',     icon: Users,         key: 'artists'     },
    ],
  },
  {
    label: 'Découvrir',
    items: [
      { to: '/news',        icon: Newspaper,     key: 'news'        },
      { to: '/chat',        icon: MessageSquare, key: 'chat'        },
      { to: '/leaderboard', icon: Trophy,        key: 'leaderboard' },
    ],
  },
  ...(isAuthenticated ? [{
    label: 'Ma bibliothèque',
    items: [
      { to: '/profile',     icon: User,          key: 'profile'     },
      { to: '/playlists',   icon: ListMusic,     key: 'playlists'   },
      { to: '/upload',      icon: Upload,        key: 'upload'      },
      { to: '/stats',       icon: BarChart2,     key: 'stats'       },
      { to: '/messages',    icon: MessageCircle, key: 'messages'    },
      { to: '/notifications',icon: Bell,         key: 'notifications'},
      { to: '/local-player',icon: HardDrive,     key: 'local'       },
      ...(isAdmin ? [{ to: '/admin', icon: Shield, key: 'admin' }] : []),
    ],
  }] : []),
];

/* ─── Composant principal ────────────────────────────────────────────────── */
const DesktopSidebar = () => {
  const location                          = useLocation();
  const navigate                          = useNavigate();
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { unreadCount }                   = useNotifications() || {};
  const { lang, setLang, t }              = useLang();
  const { canInstall, install }           = usePWAInstall();
  const [hasActiveLive, setHasActiveLive] = useState(false);
  const [isAdmin, setIsAdmin]             = useState(false);

  /* Live indicator */
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const { count } = await supabase
          .from('live_rooms')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('is_private', false);
        if (mounted) setHasActiveLive((count || 0) > 0);
      } catch {}
    };
    check();
    const iv = setInterval(check, 30000);
    const ch = supabase.channel('sidebar_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rooms' }, check)
      .subscribe();
    return () => { mounted = false; clearInterval(iv); supabase.removeChannel(ch); };
  }, []);

  /* Admin check */
  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.from('users').select('role').eq('id', currentUser.id).maybeSingle()
      .then(({ data }) => setIsAdmin(data?.role === 'admin' || data?.role === 'moderator'));
  }, [currentUser?.id]);

  /* Masquer sidebar sur live room */
  if (location.pathname.startsWith('/live/')) return null;
  if (location.pathname === '/local-player') return null;

  const navGroups = useNavGroups(t, isAuthenticated, isAdmin);

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <aside className="ns-sidebar hidden md:flex flex-col bg-black border-r border-white/5 w-56 shrink-0 h-screen sticky top-0 overflow-y-auto overflow-x-hidden scrollbar-hide z-30">

      {/* Logo */}
      <div className="px-4 pt-6 pb-4 shrink-0">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-fuchsia-600 flex items-center justify-center shadow-lg group-hover:shadow-cyan-500/30 transition-shadow">
            <span className="text-white font-black text-sm">N</span>
          </div>
          <span className="text-white font-bold text-base tracking-tight">NovaSound</span>
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 pb-4 space-y-5">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, key, liveIndicator }) => {
                const active = isActive(to);
                const notifBadge = key === 'notifications' && unreadCount > 0;
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative
                        ${active
                          ? 'bg-white/10 text-white'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <span className="relative shrink-0">
                        <Icon size={17} className={active ? 'text-cyan-400' : 'text-current'} />
                        {/* Live dot */}
                        {liveIndicator && (
                          <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-black
                            ${hasActiveLive ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                        )}
                        {/* Notif badge */}
                        {notifBadge && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-cyan-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </span>
                      <span className="truncate">{t(key)}</span>
                      {/* Active bar */}
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-cyan-400 rounded-r"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer : langue + install + user */}
      <div className="shrink-0 px-2 pb-6 space-y-2 border-t border-white/5 pt-3">

        {/* Langue FR / EN */}
        <button
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          title="Changer la langue / Switch language"
        >
          <Globe2 size={14} />
          <span>{lang === 'fr' ? 'Français' : 'English'}</span>
          <span className="ml-auto text-[10px] text-white/25">{lang === 'fr' ? 'EN' : 'FR'}</span>
        </button>

        {/* Bouton Install — uniquement mobile/tablette touch */}
        {canInstall && (
          <button
            onClick={install}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors"
          >
            <Download size={14} />
            <span>{t('install')} l'app</span>
          </button>
        )}

        {/* User / Login */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2 px-3 py-2">
            {currentUser?.avatar_url
              ? <img src={currentUser.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
              : <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <User size={13} className="text-white/50" />
                </div>
            }
            <span className="text-xs text-white/60 truncate flex-1">
              {currentUser?.username || currentUser?.email?.split('@')[0] || 'Moi'}
            </span>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="shrink-0 text-white/30 hover:text-red-400 transition-colors"
              title={t('logout')}
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <div className="flex gap-1 px-1">
            <Link to="/login"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <LogIn size={13} /> {t('login')}
            </Link>
            <Link to="/signup"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors">
              <UserPlus size={13} /> {t('signup')}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
};

export default DesktopSidebar;
