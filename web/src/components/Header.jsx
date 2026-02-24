import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Upload, User, LogOut, Menu, X, Globe, Newspaper, Music } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchResults, setSearchResults]       = useState([]);
  const [showResults, setShowResults]           = useState(false);
  const [isSearching, setIsSearching]           = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Cache-buster : _avatarTs est mis à jour par AuthContext après chaque updateProfile
  const avatarSrc = currentUser?.avatar_url
    ? `${currentUser.avatar_url}?cb=${currentUser._avatarTs || 0}`
    : null;

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        try {
          const q = searchQuery.trim().replaceAll('%', '');
          const { data, error } = await supabase
            .from('songs')
            .select('*')
            .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
            .order('created_at', { ascending: false })
            .limit(20);
          if (error) throw error;
          setSearchResults(data || []);
          setShowResults(true);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleLogout = useCallback(async () => {
    try { await logout(); } catch { /* no-op */ }
    navigate('/');
    setIsMobileMenuOpen(false);
  }, [logout, navigate]);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-gray-950 border-b border-cyan-500/20 shadow-lg shadow-cyan-900/10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group flex-shrink-0 z-50">
              <img
                src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
                alt="NovaSound Logo"
                className="w-10 h-10 rounded-full border-2 border-cyan-400 shadow-[0_0_10px_rgba(0,217,255,0.5)]"
              />
              <span className="text-xl md:text-2xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
                NovaSound TITAN LUX
              </span>
            </Link>

            {/* Barre de recherche desktop */}
            <div className="hidden md:block flex-1 max-w-xl relative mx-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400 group-focus-within:text-magenta-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Rechercher des sons, des artistes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-cyan-500/30 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-magenta-500 focus:ring-2 focus:ring-magenta-500/20 transition-all"
                />
              </div>
              <AnimatePresence>
                {showResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full mt-2 w-full bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50"
                  >
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-400">Recherche en cours...</div>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2">
                        {searchResults.map((song) => (
                          <Link
                            key={song.id} to={`/song/${song.id}`}
                            className="flex items-center gap-3 p-3 hover:bg-cyan-500/10 rounded-lg transition-colors"
                            onClick={() => setShowResults(false)}
                          >
                            {song.cover_url ? (
                              <img src={song.cover_url} alt={song.title} className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center">
                                <Music className="w-5 h-5 text-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium truncate">{song.title}</div>
                              <div className="text-gray-400 text-xs truncate">{song.artist}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-400">Aucun résultat trouvé</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation desktop */}
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/" className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-2 font-medium">
                <Music className="w-4 h-4" />Accueil
              </Link>
              <Link to="/explorer" className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-2 font-medium">
                <Globe className="w-4 h-4" />Explorer
              </Link>
              <Link to="/news" className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-2 font-medium">
                <Newspaper className="w-4 h-4" />Actualités
              </Link>

              {isAuthenticated ? (
                <>
                  <Link to="/upload">
                    <Button className="bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white rounded-full px-6 font-medium shadow-lg shadow-cyan-500/20">
                      <Upload className="w-4 h-4 mr-2" />Uploader
                    </Button>
                  </Link>

                  {/* Avatar + dropdown */}
                  <div className="relative group">
                    <Link to="/profile" className="flex items-center gap-2 pl-4 border-l border-gray-800">
                      {avatarSrc ? (
                        <img
                          key={avatarSrc}
                          src={avatarSrc}
                          alt="Mon profil"
                          className="w-8 h-8 rounded-full border border-cyan-500/50 object-cover"
                        />
                      ) : (
                        <img
                          src="/profil par defaut.png"
                          alt="Profil par défaut"
                          className="w-8 h-8 rounded-full border border-cyan-500/50"
                        />
                      )}
                    </Link>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-cyan-500/30 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all translate-y-2 group-hover:translate-y-0">
                      <div className="p-2">
                        <Link to="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg">
                          Mon profil
                        </Link>
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2">
                          <LogOut className="w-4 h-4" />Déconnexion
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login">
                    <Button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-full font-medium shadow-lg shadow-cyan-500/20">
                      Connexion
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-full font-medium shadow-lg shadow-cyan-500/20">
                      Inscription
                    </Button>
                  </Link>
                </div>
              )}
            </nav>

            {/* Bouton menu mobile */}
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[280px] bg-gray-950 border-l border-cyan-500/30 z-50 md:hidden flex flex-col"
            >
              {/* En-tête drawer */}
              <div className="p-4 border-b border-cyan-500/20 flex justify-between items-center bg-gray-900/60">
                {isAuthenticated && currentUser ? (
                  <div className="flex items-center gap-3 min-w-0">
                    {avatarSrc ? (
                      <img key={avatarSrc} src={avatarSrc} alt="Avatar" className="w-9 h-9 rounded-full border border-cyan-500/50 object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {currentUser.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{currentUser.username}</p>
                      <p className="text-gray-500 text-xs truncate">{currentUser.email}</p>
                    </div>
                  </div>
                ) : (
                  <span className="font-bold bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent">Menu</span>
                )}
                <button onClick={closeMenu} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-2 flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Recherche mobile */}
              <div className="px-4 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>
                {showResults && searchResults.length > 0 && (
                  <div className="mt-2 bg-gray-900 border border-cyan-500/20 rounded-xl max-h-48 overflow-y-auto">
                    {searchResults.map((song) => (
                      <Link
                        key={song.id} to={`/song/${song.id}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-cyan-500/10 transition-colors"
                        onClick={closeMenu}
                      >
                        {song.cover_url ? (
                          <img src={song.cover_url} alt={song.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500/50 to-magenta-500/50 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{song.title}</p>
                          <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex-1 overflow-y-auto p-4 pt-3">
                <nav className="space-y-1">
                  <Link to="/" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors">
                    <Music className="w-5 h-5 text-cyan-400" />Accueil
                  </Link>
                  <Link to="/explorer" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors">
                    <Globe className="w-5 h-5 text-cyan-400" />Explorer
                  </Link>
                  <Link to="/news" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors">
                    <Newspaper className="w-5 h-5 text-cyan-400" />Actualités
                  </Link>
                  {isAuthenticated && (
                    <>
                      <div className="my-2 border-t border-gray-800" />
                      <Link to="/upload" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors">
                        <Upload className="w-5 h-5 text-cyan-400" />Uploader un son
                      </Link>
                      <Link to="/profile" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors">
                        <User className="w-5 h-5 text-magenta-400" />Mon profil
                      </Link>
                    </>
                  )}
                </nav>
              </div>

              {/* Pied */}
              <div className="p-4 border-t border-cyan-500/20 bg-gray-900/50">
                {isAuthenticated ? (
                  <Button onClick={handleLogout} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 justify-start">
                    <LogOut className="w-4 h-4 mr-2" />Déconnexion
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link to="/login" onClick={closeMenu}>
                      <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-full">Connexion</Button>
                    </Link>
                    <Link to="/signup" onClick={closeMenu}>
                      <Button className="w-full bg-gradient-to-r from-cyan-500 to-magenta-500 text-white rounded-full">Inscription</Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
