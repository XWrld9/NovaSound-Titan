import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Upload, User, LogOut, Menu, X, Globe, Newspaper, Music } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
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
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

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

            {/* Desktop Search */}
            <div className="hidden md:block flex-1 max-w-xl relative mx-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400 group-focus-within:text-magenta-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search songs, artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-cyan-500/30 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-magenta-500 focus:ring-2 focus:ring-magenta-500/20 transition-all"
                />
              </div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showResults && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full mt-2 w-full bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50"
                  >
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-400">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2">
                        {searchResults.map((song) => (
                          <Link
                            key={song.id}
                            to={`/song/${song.id}`}
                            className="flex items-center gap-3 p-3 hover:bg-cyan-500/10 rounded-lg transition-colors"
                            onClick={() => setShowResults(false)}
                          >
                            {song.cover_url ? (
                              <img
                                src={song.cover_url}
                                alt={song.title}
                                className="w-10 h-10 rounded object-cover"
                              />
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
                      <div className="p-4 text-center text-gray-400">No results found</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/explorer" className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-2 font-medium">
                <Globe className="w-4 h-4" />
                Explorer
              </Link>
              <Link to="/news" className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-2 font-medium">
                <Newspaper className="w-4 h-4" />
                News
              </Link>

              {isAuthenticated ? (
                <>
                  <Link to="/upload">
                    <Button className="bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white rounded-full px-6 font-medium shadow-lg shadow-cyan-500/20">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </Link>
                  
                  <div className="relative group">
                    <Link to="/profile" className="flex items-center gap-2 pl-4 border-l border-gray-800">
                      {currentUser.avatar_url ? (
                        <img 
                          src={currentUser.avatar_url} 
                          alt="Profile" 
                          className="w-8 h-8 rounded-full border border-cyan-500/50"
                        />
                      ) : (
                        <img 
                          src="/profil par defaut.png" 
                          alt="Default Profile" 
                          className="w-8 h-8 rounded-full border border-cyan-500/50"
                        />
                      )}
                    </Link>
                    
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-cyan-500/30 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0">
                      <div className="p-2">
                        <Link to="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg">
                          My Profile
                        </Link>
                        <button 
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login">
                    <Button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-full font-medium shadow-lg shadow-cyan-500/20">
                      Login
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-full font-medium shadow-lg shadow-cyan-500/20">
                      Sign Up
                    </Button>
                  </Link>
                </div>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[280px] bg-gray-950 border-l border-cyan-500/30 z-50 md:hidden flex flex-col"
            >
              <div className="p-4 border-b border-cyan-500/20 flex justify-between items-center">
                <span className="font-bold text-white">Menu</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {/* Mobile Search */}
                <div className="mb-6 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <nav className="space-y-2">
                  <Link 
                    to="/" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors"
                  >
                    <Music className="w-5 h-5" />
                    Home
                  </Link>
                  <Link 
                    to="/explorer" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors"
                  >
                    <Globe className="w-5 h-5" />
                    Explorer
                  </Link>
                  <Link 
                    to="/news" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors"
                  >
                    <Newspaper className="w-5 h-5" />
                    News
                  </Link>

                  {isAuthenticated && (
                    <>
                      <div className="my-4 border-t border-gray-800" />
                      <Link 
                        to="/upload" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors"
                      >
                        <Upload className="w-5 h-5" />
                        Upload Music
                      </Link>
                      <Link 
                        to="/profile" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-colors"
                      >
                        <User className="w-5 h-5" />
                        My Profile
                      </Link>
                    </>
                  )}
                </nav>
              </div>

              <div className="p-4 border-t border-cyan-500/20">
                {isAuthenticated ? (
                  <Button 
                    onClick={handleLogout}
                    variant="destructive" 
                    className="w-full justify-start"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-full">Login</Button>
                    </Link>
                    <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-full">Sign Up</Button>
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