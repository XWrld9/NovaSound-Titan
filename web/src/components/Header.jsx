import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Upload, User, LogOut, Menu, X, Globe, Newspaper, Music,
  Download, Bell, TrendingUp, ListMusic, BarChart2, Radio,
  Trophy, Shield, Users, HardDrive, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import usePWAInstall from '@/hooks/usePWAInstall';
import NotificationBell from '@/components/NotificationBell';
import AndroidInstallGuide from '@/components/AndroidInstallGuide';
import { useNotifications } from '@/contexts/NotificationContext';


const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true);

const Header = () => {
  const { currentUser, isAuthenticated, logout, isAdmin } = useAuth();
  const navigate                                 = useNavigate();
  const location                                 = useLocation();
  const { canInstall, install }                  = usePWAInstall();
  const { unreadCount = 0 }                      = useNotifications();

  const [searchOpen, setSearchOpen]             = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchResults, setSearchResults]       = useState([]);
  const [isSearching, setIsSearching]           = useState(false);
  const searchInputRef                          = useRef(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu]         = useState(false);
  const [showIOSTooltip, setShowIOSTooltip]     = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const moreMenuRef                             = useRef(null);

  const alreadyInstalled = isStandalone();
  const ios              = isIOS();
  const android          = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  const avatarSrc = currentUser?.avatar_url
    ? `${currentUser.avatar_url}?cb=${currentUser._avatarTs || 0}`
    : null;

  // Primary navigation links
  const PRIMARY_LINKS = [
    { to: '/',           label: 'Accueil',     Icon: Music,      color: 'hover:text-cyan-400' },
    { to: '/explorer',   label: 'Explorer', Icon: Globe,      color: 'hover:text-cyan-400' },
    { to: '/trending',   label: 'Tendances', Icon: TrendingUp, color: 'hover:text-cyan-400' },
    { to: '/live',       label: 'Live',      Icon: Radio,      color: 'hover:text-red-400', badge: true },
  ];

  // Secondary navigation links (in "More" dropdown)
  const SECONDARY_LINKS = [
    { to: '/artists',      label: 'Artistes',  Icon: Users,     color: 'hover:text-fuchsia-400' },
    { to: '/news',         label: 'Actualités',     Icon: Newspaper, color: 'hover:text-cyan-400' },
    { to: '/chat',         label: 'Chat',     Icon: Globe,     color: 'hover:text-cyan-400' },
    { to: '/leaderboard',  label: 'Top', Icon: Trophy, color: 'hover:text-amber-400' },
    { to: '/local-player', label: 'Local',   Icon: HardDrive, color: 'hover:text-cyan-400' },
  ];

  useEffect(() => {
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!searchOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        try {
          const q = searchQuery.trim().replaceAll('%', '');
          const { data } = await supabase
            .from('songs')
            .select('*')
            .eq('is_archived', false)
            .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
            .order('created_at', { ascending: false })
            .limit(20);
          setSearchResults(data || []);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleInstallClick = () => {
    if (ios)       { setShowIOSTooltip(v => !v); return; }
    if (android)   { setShowAndroidGuide(true); return; }
    if (canInstall){ install(); return; }
    setShowIOSTooltip(v => !v);
  };

  const handleLogout = useCallback(async () => {
    try { await logout(); } catch {}
    navigate('/');
    setIsMobileMenuOpen(false);
  }, [logout, navigate]);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-gray-950 border-b border-cyan-500/20 shadow-lg shadow-cyan-900/10"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group flex-shrink-0 z-50 mr-2">
              <img
                src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
                alt="NovaSound Logo"
                className="w-10 h-10 rounded-full border-2 border-cyan-400 shadow-[0_0_10px_rgba(0,217,255,0.5)]"
              />
              <span className="text-xl font-bold text-white tracking-wide hidden lg:block">
                NovaSound TITAN LUX
              </span>
              <span className="text-xl font-bold text-white tracking-wide lg:hidden">
                NovaSound
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
              {PRIMARY_LINKS.map(({ to, label, Icon, color, badge }) => (
                <Link
                  key={to} to={to}
                  className={`relative text-gray-300 ${color} transition-colors flex items-center gap-1.5 font-medium px-3 py-2 rounded-lg hover:bg-white/5 text-sm`}
                >
                  <Icon className="w-4 h-4" />{label}
                  {badge && <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                </Link>
              ))}

              {/* "More" menu */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(v => !v)}
                  className="flex items-center gap-1 text-gray-300 hover:text-cyan-400 transition-colors font-medium px-3 py-2 rounded-lg hover:bg-white/5 text-sm"
                >
                  {'Plus'} <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showMoreMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-2 w-52 bg-gray-900 border border-cyan-500/20 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      {SECONDARY_LINKS.map(({ to, label, Icon, color }) => (
                        <Link
                          key={to} to={to}
                          onClick={() => setShowMoreMenu(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 ${color} hover:bg-white/5 transition-colors`}
                        >
                          <Icon className="w-4 h-4" />{label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900/80 border border-cyan-500/20 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all text-sm group"
                aria-label={'Rechercher'}
              >
                <Search className="w-4 h-4" />
                <span className="hidden md:block text-xs text-gray-500 group-hover:text-gray-400 transition-colors pr-1">
                  {'Rechercher'}
                </span>
              </button>

              {/* PWA install — mobile only */}
              {!alreadyInstalled && (ios || android) && (
                <div className="relative md:hidden">
                  <motion.button
                    onClick={handleInstallClick}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-purple-500/40 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400 hover:text-purple-200 transition-all text-sm font-medium"
                    title={'Installer NovaSound'}
                  >
                    <Download className="w-4 h-4" />
                  </motion.button>
                </div>
              )}

              {isAuthenticated ? (
                <>
                  <NotificationBell />
                  <Link to="/upload" className="hidden md:block">
                    <Button className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white rounded-full px-4 font-medium shadow-lg shadow-cyan-500/20 text-sm">
                      <Upload className="w-4 h-4 mr-1.5" />{'Uploader un son'}
                    </Button>
                  </Link>
                  {/* Avatar + dropdown */}
                  <div className="relative group hidden md:block">
                    <Link to="/profile" className="flex items-center gap-2 pl-3 border-l border-gray-800">
                      {avatarSrc ? (
                        <img key={avatarSrc} src={avatarSrc} alt={'Mon profil'} className="w-8 h-8 rounded-full border border-cyan-500/50 object-cover" />
                      ) : (
                        <img src="/profil par defaut.png" alt={'Mon profil'} className="w-8 h-8 rounded-full border border-cyan-500/50" />
                      )}
                    </Link>
                    <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-cyan-500/30 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all translate-y-2 group-hover:translate-y-0 z-50">
                      <div className="p-2">
                        <div className="px-4 py-2 border-b border-white/[0.07] mb-1">
                          <p className="text-white text-sm font-semibold truncate">{currentUser?.username || '—'}</p>
                          <p className="text-gray-600 text-xs truncate">{currentUser?.email}</p>
                        </div>
                        <Link to="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg">{'Mon profil'}</Link>
                        <Link to="/playlists" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg"><ListMusic className="w-4 h-4" />{'Mes playlists'}</Link>
                        <Link to="/stats" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg"><BarChart2 className="w-4 h-4" />{'Mes stats'}</Link>
                        {isAdmin && (
                          <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"><Shield className="w-4 h-4" />{'Panneau Admin'}</Link>
                        )}
                        <button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"><LogOut className="w-4 h-4" />{'Déconnexion'}</button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link to="/login">
                    <Button variant="outline" className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 rounded-full text-sm px-4">
                      {'Connexion'}
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white rounded-full text-sm px-4">
                      {'Inscription'}
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile burger */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed top-0 left-0 right-0 z-50 bg-gray-950 border-b border-cyan-500/30 shadow-2xl shadow-cyan-900/30"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400 z-10" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={'Rechercher des sons, des artistes...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoComplete="off"
                      className="w-full pl-12 pr-5 py-3.5 bg-gray-900 border border-cyan-500/40 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500/70 focus:ring-2 focus:ring-fuchsia-500/20 transition-all text-base"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="flex-shrink-0 px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
                  >
                    {'Annuler'}
                  </button>
                </div>
                <AnimatePresence>
                  {(isSearching || searchResults.length > 0 || searchQuery.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 overflow-hidden"
                    >
                      {isSearching ? (
                        <div className="py-6 text-center text-gray-400 text-sm">{'Recherche en cours…'}</div>
                      ) : searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pb-2 pr-1">
                          {searchResults.map((song) => (
                            <Link
                              key={song.id}
                              to={`/song/${song.id}`}
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 p-3 hover:bg-cyan-500/10 rounded-xl transition-colors border border-transparent hover:border-cyan-500/20"
                            >
                              {song.cover_url ? (
                                <img src={song.cover_url} alt={song.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-md" />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                                  <Music className="w-6 h-6 text-white" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium truncate text-sm">{song.title}</div>
                                <div className="text-gray-400 text-xs truncate">{song.artist}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : searchQuery.trim().length > 0 ? (
                        <div className="py-6 text-center text-gray-500 text-sm">
                          {'Aucun résultat pour'} <span className="text-gray-300">"{searchQuery}"</span>
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[55] md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[280px] bg-gray-950 border-l border-cyan-500/30 z-[55] md:hidden flex flex-col"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {/* Drawer header */}
              <div className="p-4 border-b border-cyan-500/20 flex justify-between items-center bg-gray-900/60">
                {isAuthenticated && currentUser ? (
                  <div className="flex items-center gap-3 min-w-0">
                    {avatarSrc ? (
                      <img key={avatarSrc} src={avatarSrc} alt="Avatar" className="w-9 h-9 rounded-full border border-cyan-500/50 object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {currentUser.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{currentUser.username}</p>
                      <p className="text-gray-500 text-xs truncate">{currentUser.email}</p>
                    </div>
                  </div>
                ) : (
                  <span className="font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">Menu</span>
                )}
                <button onClick={closeMenu} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-2 flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation */}
              <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
                <nav className="space-y-1">
                  {[...PRIMARY_LINKS, ...SECONDARY_LINKS].map(({ to, label, Icon, color, badge }) => (
                    <Link
                      key={to} to={to} onClick={closeMenu}
                      className={`flex items-center gap-3 px-4 py-3 text-gray-300 ${color} hover:bg-white/5 rounded-lg transition-colors relative`}
                    >
                      <Icon className="w-5 h-5" />{label}
                      {badge && <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    </Link>
                  ))}
                  {isAuthenticated && (
                    <>
                      <div className="my-2 border-t border-gray-800" />
                      <Link to="/notifications" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors relative">
                        <Bell className="w-5 h-5 text-cyan-400" />{'Notifications'}
                        {unreadCount > 0 && (
                          <span className="ml-auto text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                      <Link to="/upload" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors">
                        <Upload className="w-5 h-5 text-cyan-400" />{'Uploader un son'}
                      </Link>
                      <Link to="/playlists" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors">
                        <ListMusic className="w-5 h-5 text-cyan-400" />{'Mes playlists'}
                      </Link>
                      <Link to="/stats" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors">
                        <BarChart2 className="w-5 h-5 text-cyan-400" />{'Mes stats'}
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Shield className="w-5 h-5" />{'Panneau Admin'}
                        </Link>
                      )}
                      <Link to="/profile" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-fuchsia-400 hover:bg-white/5 rounded-lg transition-colors">
                        <User className="w-5 h-5 text-fuchsia-400" />{'Mon profil'}
                      </Link>
                    </>
                  )}
                </nav>
              </div>

              {/* Footer drawer */}
              <div className="p-4 border-t border-cyan-500/20 bg-gray-900/50 space-y-3">
                {!alreadyInstalled && (
                  <button
                    onClick={() => {
                      if (ios) setShowIOSTooltip(v => !v);
                      else if (android) { setShowAndroidGuide(true); closeMenu(); }
                      else if (canInstall) { install(); closeMenu(); }
                      else setShowIOSTooltip(v => !v);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-500/40 text-purple-300 hover:bg-purple-500/10 transition-all text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    {ios ? 'Comment installer sur iPhone' : 'Télécharger NovaSound'}
                  </button>
                )}
                {/* Language switcher mobile */}
                {isAuthenticated ? (
                  <Button onClick={handleLogout} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 justify-start">
                    <LogOut className="w-4 h-4 mr-2" />{'Déconnexion'}
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link to="/login" onClick={closeMenu}>
                      <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-full">{'Connexion'}</Button>
                    </Link>
                    <Link to="/signup" onClick={closeMenu}>
                      <Button className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-full">{'Inscription'}</Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAndroidGuide && <AndroidInstallGuide onClose={() => setShowAndroidGuide(false)} />}
      </AnimatePresence>
    </>
  );
};

export default Header;
