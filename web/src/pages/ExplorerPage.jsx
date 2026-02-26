import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import SongCard from '@/components/SongCard';
import { Search, Filter } from 'lucide-react';

const ExplorerPage = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);
  const [playlist, setPlaylist] = useState([]);

  // Fermer le player depuis la croix dans AudioPlayer
  useEffect(() => {
    const handler = () => setCurrentSong(null);
    window.addEventListener('novasound:close-player', handler);
    return () => window.removeEventListener('novasound:close-player', handler);
  }, []);

  const playlistRef = React.useRef([]);
  const currentSongRef = React.useRef(null);

  const playSong = (song) => {
    const list = songs.filter(s => !s.is_archived);
    playlistRef.current = list;
    setPlaylist(list);
    currentSongRef.current = song;
    setCurrentSong(song);
  };

  const handleNext = (songOverride) => {
    if (songOverride) { currentSongRef.current = songOverride; setCurrentSong(songOverride); return; }
    const pl = playlistRef.current;
    const cs = currentSongRef.current;
    if (!pl.length || !cs) return;
    const idx = pl.findIndex(s => s.id === cs.id);
    const next = pl[(idx + 1) % pl.length];
    if (next) { currentSongRef.current = next; setCurrentSong(next); }
  };

  const handlePrevious = (songOverride) => {
    if (songOverride) { currentSongRef.current = songOverride; setCurrentSong(songOverride); return; }
    const pl = playlistRef.current;
    const cs = currentSongRef.current;
    if (!pl.length || !cs) return;
    const idx = pl.findIndex(s => s.id === cs.id);
    const prev = pl[(idx - 1 + pl.length) % pl.length];
    if (prev) { currentSongRef.current = prev; setCurrentSong(prev); }
  };
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('-created'); // -created, -plays_count

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
    setSongs([]);
    setHasMore(true);
    fetchSongs(1, true);
  }, [sortBy, debouncedSearch]);

  const fetchSongs = async (pageNum, isNewSearch = false) => {
    try {
      setLoading(true);
      const perPage = 20;
      const start = Math.max(0, (pageNum - 1) * perPage);
      const end = start + perPage - 1;

      const desc = sortBy.startsWith('-');
      const rawField = desc ? sortBy.slice(1) : sortBy;
      const field = rawField === 'created' ? 'created_at' : rawField;

      let query = supabase
        .from('songs')
        .select('*')
        .eq('is_archived', false)
        .order(field, { ascending: !desc })
        .range(start, end);

      if (debouncedSearch?.trim()) {
        const q = debouncedSearch.trim().replaceAll('%', '');
        query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      if (isNewSearch) {
        setSongs(items);
      } else {
        setSongs((prev) => [...prev, ...items]);
      }

      setHasMore(items.length === perPage);
    } catch (error) {
      console.error('Error fetching songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    const nearBottom = window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200;
    if (!nearBottom || loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSongs(nextPage);
  };

  useEffect(() => {
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [loading, hasMore, page]);

  return (
    <>
      <Helmet>
        <title>Explorer - NovaSound TITAN LUX</title>
        <meta name="description" content="Explore the vast library of music on NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-white">Explorer</h1>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Rechercher dans la bibliothèque..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="-created">Plus récents</option>
                  <option value="created">Plus anciens</option>
                  <option value="-plays_count">Plus écoutés</option>
                  {/* Note: Most Liked requires a counter field on song record which we simulate with plays for now or omit if strict */}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {songs.map((song, index) => (
              <SongCard 
                key={song.id} 
                song={song} 
                onPlay={playSong} 
                isPlaying={currentSong?.id === song.id}
                onArchived={(id) => setSongs(prev => prev.filter(s => s.id !== id))}
                onDeleted={(id) => setSongs(prev => prev.filter(s => s.id !== id))}
              />
            ))}
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {!loading && songs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Aucun morceau trouvé pour cette recherche.
            </div>
          )}
        </main>

        <Footer />
        {currentSong && <AudioPlayer currentSong={currentSong} playlist={playlist} onNext={handleNext} onPrevious={handlePrevious} />}
      </div>
    </>
  );
};

export default ExplorerPage;