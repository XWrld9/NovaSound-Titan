import React, { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SongCard from '@/components/SongCard';
import { Search, Filter, X } from 'lucide-react';

const GENRES = [
  'Afrobeats','Hip-Hop','R&B','Pop','Électronique','Trap','Gospel',
  'Jazz','Reggae','Dancehall','Amapiano','Coupé-Décalé',
  'Rock','Classique','Folk','Latin','Drill',
];

// Squelette de chargement
const SongSkeleton = () => (
  <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden animate-pulse">
    <div className="aspect-square bg-gray-800" />
    <div className="p-3.5 space-y-2">
      <div className="h-3.5 bg-gray-700 rounded w-3/4" />
      <div className="h-3 bg-gray-800 rounded w-1/2" />
      <div className="h-3 bg-gray-800/60 rounded w-1/4 mt-1" />
      <div className="flex justify-between mt-3">
        <div className="h-5 bg-gray-800 rounded w-12" />
        <div className="h-5 bg-gray-800 rounded w-16" />
      </div>
    </div>
  </div>
);

const ExplorerPage = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [totalCount, setTotalCount] = useState(null);
  const { playSong: globalPlaySong, currentSong } = usePlayer();

  const playSong = (song) => globalPlaySong(song, songs.filter(s => !s.is_archived));

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('-created');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1); setSongs([]); setHasMore(true); setInitialLoad(true);
    fetchSongs(1, true);
  }, [sortBy, debouncedSearch, selectedGenre]);

  const fetchSongs = async (pageNum, isNewSearch = false) => {
    try {
      setLoading(true);
      const perPage = 20;
      const start = Math.max(0, (pageNum - 1) * perPage);
      const end = start + perPage - 1;

      const desc = sortBy.startsWith('-');
      const rawField = desc ? sortBy.slice(1) : sortBy;
      const field = rawField === 'created' ? 'created_at' : rawField;

      let query = supabase.from('songs').select('*').eq('is_archived', false).order(field, { ascending: !desc }).range(start, end);

      if (debouncedSearch?.trim()) {
        const q = debouncedSearch.trim().replaceAll('%', '');
        query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
      }
      if (selectedGenre) query = query.eq('genre', selectedGenre);

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      if (isNewSearch) setSongs(items);
      else setSongs(prev => [...prev, ...items]);
      setHasMore(items.length === perPage);

      // Récupérer le total exact seulement à la première page
      if (isNewSearch) {
        let countQuery = supabase.from('songs').select('id', { count: 'exact', head: true }).eq('is_archived', false);
        if (debouncedSearch?.trim()) {
          const q = debouncedSearch.trim().replaceAll('%', '');
          countQuery = countQuery.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
        }
        if (selectedGenre) countQuery = countQuery.eq('genre', selectedGenre);
        const { count } = await countQuery;
        setTotalCount(count ?? null);
      }
    } catch (error) {
      console.error('Error fetching songs:', error);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  const handleScroll = useCallback(() => {
    const nearBottom = window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 300;
    if (!nearBottom || loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSongs(nextPage);
  }, [loading, hasMore, page]);

  useEffect(() => {
    let ticking = false;
    const throttled = () => {
      if (!ticking) {
        requestAnimationFrame(() => { handleScroll(); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener('scroll', throttled, { passive: true });
    return () => window.removeEventListener('scroll', throttled);
  }, [handleScroll]);

  const activeFilters = (selectedGenre ? 1 : 0) + (searchQuery ? 1 : 0);

  return (
    <>
      <Helmet>
        <title>Explorer — NovaSound TITAN LUX</title>
        <meta name="description" content="Explore toute la bibliothèque musicale NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">

          {/* Titre + filtres */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white">Explorer</h1>
                {songs.length > 0 && !loading && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {totalCount !== null ? `${totalCount} morceau${totalCount > 1 ? 'x' : ''}` : `${songs.length}${hasMore ? '+' : ''} morceaux`}
                    {selectedGenre && ` · ${selectedGenre}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {/* Recherche */}
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Rechercher…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none text-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Tri */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="pl-9 pr-8 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer text-sm">
                    <option value="-created">Plus récents</option>
                    <option value="created">Plus anciens</option>
                    <option value="-plays_count">Plus écoutés</option>
                    <option value="-likes_count">Plus aimés</option>
                    <option value="-duration_s">Plus longs</option>
                    <option value="duration_s">Plus courts</option>
                  </select>
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
                  onClick={() => setSelectedGenre(prev => prev === g ? '' : g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedGenre === g ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300' : 'border-gray-700/60 text-gray-500 hover:border-cyan-500/40 hover:text-gray-300'}`}
                >{g}</button>
              ))}
            </div>
          </div>

          {/* Grille */}
          {initialLoad ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => <SongSkeleton key={i} />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {songs.map((song, index) => (
                  <motion.div key={song.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.3 }}>
                    <SongCard
                      song={song}
                      onPlay={playSong}
                      isPlaying={currentSong?.id === song.id}
                      onArchived={(id) => setSongs(prev => prev.filter(s => s.id !== id))}
                      onDeleted={(id) => setSongs(prev => prev.filter(s => s.id !== id))}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Squelettes de pagination */}
              {loading && songs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
                  {Array.from({ length: 4 }).map((_, i) => <SongSkeleton key={i} />)}
                </div>
              )}

              {!loading && songs.length === 0 && (
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
              )}

              {!hasMore && songs.length > 0 && (
                <p className="text-center text-gray-700 text-sm mt-8">— Fin de la bibliothèque —</p>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ExplorerPage;
