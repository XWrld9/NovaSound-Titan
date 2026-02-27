/**
 * ExplorerPage — NovaSound TITAN LUX v70
 * Redesign complet :
 * - Toggle vue grille / vue liste compacte
 * - Vue liste : SongRow inline avec play direct, actions, genre badge
 * - Skeleton animé cohérent pour les deux vues
 * - Mémorisation de la préférence vue (localStorage)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SongCard from '@/components/SongCard';
import LikeButton from '@/components/LikeButton';
import FavoriteButton from '@/components/FavoriteButton';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';
import { formatPlays } from '@/lib/utils';
import {
  Search, Filter, X, LayoutGrid, List,
  Play, Headphones, Music, Pause, Plus, Check,
  Download, Share2, ExternalLink, ListMusic
} from 'lucide-react';
import { Link } from 'react-router-dom';

const GENRES = [
  'Afrobeats','Hip-Hop','R&B','Pop','Électronique','Trap','Gospel',
  'Jazz','Reggae','Dancehall','Amapiano','Coupé-Décalé',
  'Rock','Classique','Folk','Latin','Drill',
];

const VIEW_KEY = 'novasound.explorer.view';

// ── Skeleton grille ───────────────────────────────────────────────
const GridSkeleton = () => (
  <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden animate-pulse">
    <div className="aspect-square bg-gray-800" />
    <div className="p-3.5 space-y-2">
      <div className="h-3.5 bg-gray-700 rounded w-3/4" />
      <div className="h-3 bg-gray-800 rounded w-1/2" />
      <div className="flex justify-between mt-3">
        <div className="h-5 bg-gray-800 rounded w-12" />
        <div className="h-5 bg-gray-800 rounded w-16" />
      </div>
    </div>
  </div>
);

// ── Skeleton liste ────────────────────────────────────────────────
const ListSkeleton = () => (
  <div className="flex items-center gap-3 px-3 py-3 bg-gray-900/60 border border-gray-800/60 rounded-xl animate-pulse">
    <div className="w-5 h-4 bg-gray-800 rounded flex-shrink-0" />
    <div className="w-11 h-11 bg-gray-800 rounded-lg flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="h-3.5 bg-gray-700 rounded w-2/5" />
      <div className="h-3 bg-gray-800 rounded w-1/4" />
    </div>
    <div className="h-3 bg-gray-800 rounded w-16 flex-shrink-0" />
    <div className="h-5 bg-gray-800 rounded w-10 flex-shrink-0" />
  </div>
);

// ── Ligne vue liste ───────────────────────────────────────────────
const fmtDur = (s) => { 
  if (!s || s <= 0 || isNaN(s)) return '--:--'; 
  const minutes = Math.floor(s/60); 
  const seconds = Math.floor(s%60); 
  return `${minutes}:${String(seconds).padStart(2,'0')}`; 
};

const SongRow = ({ song, index, onPlay, isPlaying, currentUser }) => {
  const [qFlash,   setQFlash]   = useState(false);
  const [showPL,   setShowPL]   = useState(false);
  const { addToQueue } = usePlayer();

  const handleQueue = (e) => {
    e.stopPropagation();
    addToQueue(song);
    setQFlash(true);
    setTimeout(() => setQFlash(false), 1200);
  };

  const handleDl = (e) => {
    e.stopPropagation();
    if (!song.audio_url) return;
    const a = document.createElement('a');
    a.href = song.audio_url;
    a.download = `${song.title}.mp3`;
    a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };



  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index, 10) * 0.025, duration: 0.25 }}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer
          ${isPlaying
            ? 'bg-cyan-500/8 border-cyan-500/30'
            : 'bg-gray-900/60 border-gray-800/60 hover:bg-gray-800/80 hover:border-gray-700/80'
          }`}
        onClick={() => onPlay(song)}
      >
        {/* Index / play */}
        <div className="w-6 flex-shrink-0 flex items-center justify-center">
          {isPlaying ? (
            <div className="flex gap-px items-end h-3.5">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-0.5 bg-cyan-400 rounded-full"
                  style={{ height: `${5+i*2}px`, animation: `equalizer ${0.4+i*0.1}s ease-in-out infinite alternate`, animationDelay: `${i*0.08}s` }} />
              ))}
            </div>
          ) : (
            <>
              <span className="text-xs text-gray-600 group-hover:hidden tabular-nums">{index + 1}</span>
              <Play className="w-3.5 h-3.5 text-cyan-400 fill-current hidden group-hover:block" />
            </>
          )}
        </div>

        {/* Pochette */}
        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border border-white/8 shadow-md">
          {song.cover_url
            ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <div className="w-full h-full bg-gradient-to-br from-cyan-500/30 to-magenta-500/30 flex items-center justify-center"><Music className="w-5 h-5 text-cyan-400/50" /></div>
          }
        </div>

        {/* Titre + artiste */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate leading-tight ${isPlaying ? 'text-cyan-300' : 'text-white'}`}>
            {song.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {song.uploader_id
              ? <Link to={`/artist/${song.uploader_id}`} onClick={e => e.stopPropagation()}
                  className="text-gray-400 text-xs truncate hover:text-cyan-400 transition-colors">{song.artist}</Link>
              : <span className="text-gray-400 text-xs truncate">{song.artist}</span>
            }
            {song.genre && (
              <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-px rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">
                {song.genre}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-1 text-gray-600 flex-shrink-0">
          <Headphones className="w-3 h-3" />
          <span className="text-xs tabular-nums">{formatPlays(song.plays_count)}</span>
        </div>

        {/* Durée — seulement si connue */}
        <span className="hidden sm:block text-xs text-gray-600 tabular-nums flex-shrink-0 w-10 text-right">
          {song.duration_s > 0 ? fmtDur(song.duration_s) : ''}
        </span>

        {/* Actions (visible au hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <LikeButton songId={song.id} initialLikes={song.likes_count || 0} />
          <FavoriteButton songId={song.id} size="sm" />
          <button onClick={handleQueue}
            className={`p-1 rounded transition-colors ${qFlash ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-400'}`}
            title="File d'attente">
            {qFlash ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
          {currentUser && (
            <button onClick={e => { e.stopPropagation(); setShowPL(true); }}
              className="p-1 rounded text-gray-500 hover:text-magenta-400 transition-colors"
              title="Playlist">
              <ListMusic className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleDl}
            className="p-1 rounded text-gray-500 hover:text-cyan-400 transition-colors"
            title="Télécharger">
            <Download className="w-3.5 h-3.5" />
          </button>
          <Link to={`/song/${song.id}`} onClick={e => e.stopPropagation()}
            className="p-1 rounded text-gray-500 hover:text-white transition-colors"
            title="Voir la page">
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>

      <AnimatePresence>
        {showPL && <AddToPlaylistModal song={song} onClose={() => setShowPL(false)} />}
      </AnimatePresence>
    </>
  );
};

// ════════════════════════════════════════════════════════════════════
const ExplorerPage = () => {
  const [songs,         setSongs]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [initialLoad,   setInitialLoad]   = useState(true);
  const [totalCount,    setTotalCount]    = useState(null);
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(true);
  const [sortBy,        setSortBy]        = useState('-created');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [view,          setView]          = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'grid'; } catch { return 'grid'; }
  });

  const { playSong: globalPlaySong, currentSong } = usePlayer();
  const { currentUser } = useAuth();
  const playSong = (song) => globalPlaySong(song, songs.filter(s => !s.is_archived));

  const switchView = (v) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1); setSongs([]); setHasMore(true); setInitialLoad(true);
    fetchSongs(1, true);
  }, [sortBy, debouncedSearch, selectedGenre]);

  const fetchSongs = async (pageNum, isNew = false) => {
    try {
      setLoading(true);
      const perPage = 24;
      const start   = Math.max(0, (pageNum - 1) * perPage);
      const end     = start + perPage - 1;
      const desc    = sortBy.startsWith('-');
      const field   = (desc ? sortBy.slice(1) : sortBy) === 'created' ? 'created_at' : (desc ? sortBy.slice(1) : sortBy);

      let q = supabase.from('songs').select('*').eq('is_archived', false).order(field, { ascending: !desc }).range(start, end);
      if (debouncedSearch?.trim()) {
        const s = debouncedSearch.trim().replaceAll('%', '');
        q = q.or(`title.ilike.%${s}%,artist.ilike.%${s}%`);
      }
      if (selectedGenre) q = q.eq('genre', selectedGenre);

      const { data, error } = await q;
      if (error) throw error;
      const items = data || [];
      if (isNew) setSongs(items); else setSongs(prev => [...prev, ...items]);
      setHasMore(items.length === perPage);

      if (isNew) {
        let cq = supabase.from('songs').select('id', { count: 'exact', head: true }).eq('is_archived', false);
        if (debouncedSearch?.trim()) {
          const s = debouncedSearch.trim().replaceAll('%', '');
          cq = cq.or(`title.ilike.%${s}%,artist.ilike.%${s}%`);
        }
        if (selectedGenre) cq = cq.eq('genre', selectedGenre);
        const { count } = await cq;
        setTotalCount(count ?? null);
      }
    } catch {}
    finally { setLoading(false); setInitialLoad(false); }
  };

  // Sync song-updated (titre/artiste modifiés depuis le menu ⋯)
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail;
      if (!updated?.id) return;
      setSongs(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
    };
    window.addEventListener('novasound:song-updated', handler);
    return () => window.removeEventListener('novasound:song-updated', handler);
  }, []);

  const handleScroll = useCallback(() => {
    const near = window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 400;
    if (!near || loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchSongs(next);
  }, [loading, hasMore, page]);

  useEffect(() => {
    let t = false;
    const fn = () => { if (!t) { requestAnimationFrame(() => { handleScroll(); t = false; }); t = true; } };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [handleScroll]);

  return (
    <>
      <Helmet>
        <title>Explorer — NovaSound TITAN LUX</title>
        <meta name="description" content="Explore toute la bibliothèque musicale NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8">

          {/* Barre filtres + toggle vue */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white">Explorer</h1>
                {!loading && totalCount !== null && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    {totalCount} morceau{totalCount > 1 ? 'x' : ''}
                    {selectedGenre && ` · ${selectedGenre}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                {/* Recherche */}
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Rechercher…" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none text-sm" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Tri */}
                <div className="relative flex-shrink-0">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer text-sm">
                    <option value="-created">Plus récents</option>
                    <option value="created">Plus anciens</option>
                    <option value="-plays_count">Plus écoutés</option>
                    <option value="-likes_count">Plus aimés</option>
                    <option value="-duration_s">Plus longs</option>
                    <option value="duration_s">Plus courts</option>
                  </select>
                </div>

                {/* Toggle vue grille/liste */}
                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5 flex-shrink-0">
                  <button
                    onClick={() => switchView('grid')}
                    className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-600 hover:text-gray-300'}`}
                    title="Vue grille"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => switchView('list')}
                    className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-600 hover:text-gray-300'}`}
                    title="Vue liste"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Genre chips */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGenre('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${!selectedGenre ? 'bg-white/10 border-white/30 text-white' : 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}
              >Tous</button>
              {GENRES.map(g => (
                <button key={g}
                  onClick={() => setSelectedGenre(p => p === g ? '' : g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedGenre === g ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300' : 'border-gray-700/60 text-gray-500 hover:border-cyan-500/40 hover:text-gray-300'}`}
                >{g}</button>
              ))}
            </div>
          </div>

          {/* Contenu */}
          {initialLoad ? (
            view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => <GridSkeleton key={i} />)}
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 12 }).map((_, i) => <ListSkeleton key={i} />)}
              </div>
            )
          ) : songs.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/30 border border-gray-800 rounded-2xl">
              <Search className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Aucun morceau trouvé</p>
              {(selectedGenre || searchQuery) && (
                <button onClick={() => { setSelectedGenre(''); setSearchQuery(''); }}
                  className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                  Effacer les filtres
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {view === 'grid' ? (
                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {songs.map((song, i) => (
                    <motion.div key={song.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.3 }}>
                      <SongCard
                        song={song} onPlay={playSong}
                        isPlaying={currentSong?.id === song.id}
                        onArchived={(id) => setSongs(p => p.filter(s => s.id !== id))}
                        onDeleted={(id)   => setSongs(p => p.filter(s => s.id !== id))}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-1.5">
                  {songs.map((song, i) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      index={i}
                      onPlay={playSong}
                      isPlaying={currentSong?.id === song.id}
                      currentUser={currentUser}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Pagination skeletons */}
          {loading && songs.length > 0 && (
            view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
                {Array.from({ length: 4 }).map((_, i) => <GridSkeleton key={i} />)}
              </div>
            ) : (
              <div className="space-y-1.5 mt-2">
                {Array.from({ length: 4 }).map((_, i) => <ListSkeleton key={i} />)}
              </div>
            )
          )}

          {!hasMore && songs.length > 0 && (
            <p className="text-center text-gray-700 text-sm mt-8">— Fin de la bibliothèque —</p>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ExplorerPage;
