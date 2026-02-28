/**
 * BottomNav — NovaSound TITAN LUX v70
 * Barre de navigation mobile fixe en bas
 * Visible UNIQUEMENT sur mobile (hidden md:flex)
 * Laisse 80px d'espace pour l'AudioPlayer au-dessus
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, TrendingUp, User, Search, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { to: '/',         icon: Home,      label: 'Accueil'  },
  { to: '/explorer', icon: Compass,   label: 'Explorer' },
  { to: '/chat',     icon: Globe,     label: 'Chat'     },
  { to: '/search',   icon: Search,    label: 'Chercher' },
];

const BottomNav = () => {
  const location  = useLocation();
  const { currentUser, isAuthenticated } = useAuth();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const profileTo = isAuthenticated && currentUser?.id
    ? `/artist/${currentUser.id}`
    : '/login';

  const allItems = [
    ...NAV_ITEMS,
    { to: profileTo, icon: User, label: 'Profil' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden"
      style={{
        background: 'rgba(3,7,18,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(6,182,212,0.15)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {allItems.map(({ to, icon: Icon, label }) => {
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
              className={`transition-all duration-200 ${active ? 'text-cyan-400' : 'text-gray-500'}`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
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
