/**
 * SearchPage — NovaSound TITAN LUX v70
 * Recherche globale : sons, artistes, playlists
 * - Résultats en temps réel avec debounce 350ms
 * - Historique de recherche (localStorage)
 * - Résultats classés par catégorie
 * - Écoute directe depuis les résultats
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Search, X, Clock, Music, Users, ListMusic,
  Play, Headphones, TrendingUp, Mic2, ChevronRight, User
} from 'lucide-react';
import { formatPlays } from '@/lib/utils';

const HISTORY_KEY = (uid) => `novasound.search.history.${uid}`;
const MAX_HISTORY = 10;

const getHistory = (uid) => {
  if (!uid) return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY(uid)) || '[]'); }
  catch { return []; }
};
const saveHistory = (uid, query) => {
  if (!uid || !query.trim()) return;
  try {
    const existing = getHistory(uid).filter(q => q !== query);
    const updated = [query, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY(uid), JSON.stringify(updated));
  } catch {}
};
const removeFromHistory = (uid, query) => {
  if (!uid) return;
  try {
    const updated = getHistory(uid).filter(q => q !== query);
    localStorage.setItem(HISTORY_KEY(uid), JSON.stringify(updated));
  } catch {}
};

// Catégorie pill
const CatBadge = ({ type }) => {
  const map = {
    song:     { label: 'Son',      color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    artist:   { label: 'Artiste',  color: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30' },
    playlist: { label: 'Playlist', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  };
  const c = map[type] || map.song;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.color}`}>{c.label}</span>
  );
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { playSong }    = usePlayer();

  const [query,    setQuery]    = useState(searchParams.get('q') || '');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [history,  setHistory]  = useState([]);
  const inputRef = useRef(null);

  // Charger l'historique au montage
  useEffect(() => {
    setHistory(getHistory(currentUser?.id));
  }, [currentUser?.id]);

  // Debounce : déclencher la recherche automatiquement
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    const t = setTimeout(() => performSearch(query.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Sync URL
  useEffect(() => {
    if (query.trim()) setSearchParams({ q: query }, { replace: true });
    else setSearchParams({}, { replace: true });
  }, [query, setSearchParams]);

  const performSearch = useCallback(async (q) => {
    setLoading(true);
    setSearched(true);
    try {
      // Requête parallèle : sons + artistes + playlists
      const [{ data: songs }, { data: artists }, { data: playlists }] = await Promise.all([
        supabase
          .from('songs').select('id, title, artist, cover_url, plays_count, genre')
          .eq('is_archived', false)
          .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
          .order('plays_count', { ascending: false })
          .limit(12),
        supabase
          .from('users').select('id, username, avatar_url, bio')
          .ilike('username', `%${q}%`)
          .limit(6),
        supabase
          .from('playlists').select('id, name, cover_url, owner_id, users:owner_id(username)')
          .eq('is_public', true)
          .ilike('name', `%${q}%`)
          .limit(6),
      ]);

      const combined = [
        ...(songs || []).map(s => ({ ...s, _type: 'song' })),
        ...(artists || []).map(a => ({ ...a, _type: 'artist' })),
        ...(playlists || []).map(p => ({ ...p, _type: 'playlist' })),
      ];
      setResults(combined);

      // Sauvegarder dans l'historique
      if (currentUser?.id) {
        saveHistory(currentUser.id, q);
        setHistory(getHistory(currentUser.id));
      }
    } catch (err) {
      console.error('[Search]', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  const handleHistoryClick = (q) => {
    setQuery(q);
    inputRef.current?.focus();
  };

  const handleRemoveHistory = (e, q) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    removeFromHistory(currentUser.id, q);
    setHistory(getHistory(currentUser.id));
  };

  const clearAll = () => {
    if (!currentUser?.id) return;
    try { localStorage.removeItem(HISTORY_KEY(currentUser.id)); } catch {}
    setHistory([]);
  };

  // Grouper les résultats par type
  const songs     = results.filter(r => r._type === 'song');
  const artists   = results.filter(r => r._type === 'artist');
  const playlists = results.filter(r => r._type === 'playlist');

  const hasResults = results.length > 0;
  const showHistory = !query.trim() && history.length > 0;

  return (
    <>
      <Helmet>
        <title>{query ? `"${query}" — Recherche · NovaSound` : 'Recherche — NovaSound TITAN LUX'}</title>
        <meta name="description" content="Recherchez des sons, artistes et playlists sur NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">

          {/* Titre */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Search className="w-7 h-7 text-cyan-400" />
              Recherche
            </h1>
          </motion.div>

          {/* Barre de recherche */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              autoFocus
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sons, artistes, playlists…"
              className="w-full pl-12 pr-12 py-4 rounded-2xl bg-gray-900/80 border border-cyan-500/25 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-lg transition-all"
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* HISTORIQUE */}
          <AnimatePresence mode="wait">
            {showHistory && (
              <motion.section
                key="history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-8"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    Recherches récentes
                  </h2>
                  <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                    Tout effacer
                  </button>
                </div>
                <div className="space-y-1">
                  {history.map((q, i) => (
                    <motion.div
                      key={q}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleHistoryClick(q)}
                      className="flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-gray-800/60 cursor-pointer group transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span className="text-gray-300 text-sm group-hover:text-white transition-colors">{q}</span>
                      </div>
                      <button
                        onClick={(e) => handleRemoveHistory(e, q)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-700 text-gray-500 hover:text-white transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ÉTAT VIDE SANS HISTORIQUE */}
            {!query.trim() && !showHistory && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <Search className="w-16 h-16 text-gray-800 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Commence à taper pour chercher</p>
                <p className="text-gray-700 text-sm mt-2">Sons, artistes, playlists…</p>
              </motion.div>
            )}

            {/* LOADING */}
            {loading && query.trim() && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Recherche en cours…</p>
              </motion.div>
            )}

            {/* RÉSULTATS */}
            {!loading && searched && query.trim() && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {!hasResults ? (
                  <div className="text-center py-20">
                    <Music className="w-14 h-14 text-gray-800 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg font-medium">Aucun résultat pour <span className="text-white">"{query}"</span></p>
                    <p className="text-gray-600 text-sm mt-2">Essaie un autre terme ou vérifie l'orthographe</p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {/* SONS */}
                    {songs.length > 0 && (
                      <section>
                        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                          <Music className="w-4 h-4 text-cyan-400" />
                          Sons
                          <span className="text-gray-600 font-normal text-sm">({songs.length})</span>
                        </h2>
                        <div className="space-y-2">
                          {songs.map((song, i) => (
                            <motion.div
                              key={song.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/50 hover:bg-gray-800/60 border border-transparent hover:border-cyan-500/20 group transition-all cursor-pointer"
                              onClick={() => playSong(song, songs)}
                            >
                              {/* Cover */}
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                                {song.cover_url
                                  ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-gray-600" /></div>
                                }
                                {/* Overlay play */}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="w-5 h-5 text-white fill-white" />
                                </div>
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium text-sm truncate">{song.title}</p>
                                <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                              </div>
                              {/* Stats + lien */}
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {song.plays_count > 0 && (
                                  <span className="text-gray-600 text-xs hidden sm:flex items-center gap-1">
                                    <Headphones className="w-3 h-3" />
                                    {formatPlays(song.plays_count)}
                                  </span>
                                )}
                                <Link
                                  to={`/song/${song.id}`}
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-all"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </Link>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* ARTISTES */}
                    {artists.length > 0 && (
                      <section>
                        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                          <Mic2 className="w-4 h-4 text-fuchsia-400" />
                          Artistes
                          <span className="text-gray-600 font-normal text-sm">({artists.length})</span>
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {artists.map((artist, i) => (
                            <motion.div
                              key={artist.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                            >
                              <Link
                                to={`/artist/${artist.id}`}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-900/50 hover:bg-gray-800/60 border border-transparent hover:border-fuchsia-500/20 transition-all group"
                              >
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-800 flex-shrink-0 ring-2 ring-transparent group-hover:ring-fuchsia-500/30 transition-all">
                                  {artist.avatar_url
                                    ? <img src={artist.avatar_url} alt={artist.username} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center"><User className="w-6 h-6 text-gray-600" /></div>
                                  }
                                </div>
                                <div className="text-center min-w-0 w-full">
                                  <p className="text-white font-semibold text-sm truncate group-hover:text-fuchsia-300 transition-colors">{artist.username}</p>
                                  {artist.bio && <p className="text-gray-600 text-xs truncate mt-0.5">{artist.bio}</p>}
                                </div>
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* PLAYLISTS */}
                    {playlists.length > 0 && (
                      <section>
                        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                          <ListMusic className="w-4 h-4 text-violet-400" />
                          Playlists
                          <span className="text-gray-600 font-normal text-sm">({playlists.length})</span>
                        </h2>
                        <div className="space-y-2">
                          {playlists.map((pl, i) => (
                            <motion.div
                              key={pl.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                            >
                              <Link
                                to={`/playlist/${pl.id}`}
                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/50 hover:bg-gray-800/60 border border-transparent hover:border-violet-500/20 transition-all group"
                              >
                                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30">
                                  {pl.cover_url
                                    ? <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center"><ListMusic className="w-5 h-5 text-violet-400/60" /></div>
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium text-sm truncate group-hover:text-violet-300 transition-colors">{pl.name}</p>
                                  <p className="text-gray-500 text-xs">par {pl.users?.username || 'Inconnu'}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </main>

        <Footer />
      </div>
    </>
  );
};

export default SearchPage;
