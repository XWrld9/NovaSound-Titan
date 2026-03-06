/**
 * BottomNav — NovaSound TITAN LUX V110000
 * Navigation mobile fixe en bas
 * - Voyant VERT si au moins un live est en cours (rejoins la fête !)
 * - Voyant ROUGE si aucun live actif
 * - Badge notifications en temps réel
 * - Masqué sur /local-player et /live/:roomId  ← effectivement implémenté
 */
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, TrendingUp, User, Search, Globe, Radio, Trophy, HardDrive, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { to: '/',            icon: Home,   label: 'Accueil'        },
  { to: '/explorer',    icon: Compass,label: 'Explorer'    },
  { to: '/live',        icon: Radio,  label: 'Live', liveIndicator: true },
  { to: '/leaderboard', icon: Trophy, label: 'Top' },
];

const BottomNav = () => {
  const location  = useLocation();
  const { currentUser, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications() || {};
  const [hasActiveLive, setHasActiveLive] = useState(false);

  /* Vérifier s'il y a des lives actifs — sondage léger toutes les 30s */
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
    const interval = setInterval(check, 30000);

    // Realtime : réagit immédiatement aux changements
    const ch = supabase.channel('bottomnav_live_check')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rooms' }, check)
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  // Masqué sur les pages immersives (live room, lecteur local)
  const isHiddenPage =
    location.pathname === '/local-player' ||
    /^\/live\/.+/.test(location.pathname);
  if (isHiddenPage) return null;

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const profileTo = isAuthenticated && currentUser?.id
    ? `/artist/${currentUser.id}`
    : '/login';

  const notifItem = isAuthenticated
    ? { to: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : null }
    : null;

  const allItems = [
    ...NAV_ITEMS,
    ...(notifItem ? [notifItem] : []),
    { to: profileTo, icon: User, label: 'Mon profil' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden"
      style={{
        background: 'rgba(3,7,18,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(6,182,212,0.15)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {allItems.map(({ to, icon: Icon, label, liveIndicator, badge }) => {
        const active = isActive(to);
        return (
          <Link
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
          >
            {active && (
              <motion.div
                layoutId="bottomnav-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <motion.div
              whileTap={{ scale: 0.85 }}
              className={`relative transition-all duration-200 ${active ? 'text-cyan-400' : 'text-gray-500'}`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />

              {/* Voyant LIVE dynamique : vert si live actif, rouge si aucun */}
              {liveIndicator && (
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-950 ${
                    hasActiveLive
                      ? 'bg-green-400 animate-pulse'
                      : 'bg-red-500'
                  }`}
                />
              )}

              {/* Badge numérique pour les notifications non lues */}
              {badge && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-cyan-500 text-[9px] font-black text-gray-950 border border-gray-950 leading-none">
                  {badge}
                </span>
              )}
            </motion.div>
            <span
              className={`text-[10px] font-medium transition-colors duration-200 ${
                active ? 'text-cyan-400' : 'text-gray-600'
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
