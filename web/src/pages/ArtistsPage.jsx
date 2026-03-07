/**
 * ArtistsPage — NovaSound TITAN LUX v1000
 * Vue artistes groupés : tous les artistes + leurs {'sons'} organisés ensemble
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Music, Play, Search, ChevronDown, ChevronUp, TrendingUp, Headphones } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatPlays } from '@/lib/utils';
import Header from '@/components/Header';
import { usePlayer } from '@/contexts/PlayerContext';

const ArtistsPage = () => {
  const { playSong } = usePlayer();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [sort, setSort] = useState('songs'); // 'songs' | 'plays' | 'alpha'

  const fetchArtists = useCallback(async () => {
    setLoading(true);
    try {
      // Récupère tous les artistes (uploader_id) + leurs infos + leurs {'sons'}
      const { data: songs } = await supabase
        .from('songs')
        .select('id, title, artist, cover_url, audio_url, plays_count, created_at, uploader_id, uploader:users!uploader_id(id, username, avatar_url)')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!songs) { setLoading(false); return; }

      // Grouper par uploader_id
      const map = {};
      songs.forEach(song => {
        const uid = song.uploader_id || '__unknown__';
        if (!map[uid]) {
          map[uid] = {
            id: uid,
            username: song.uploader?.username || song.artist || 'Artiste inconnu',
            avatar_url: song.uploader?.avatar_url || null,
            displayName: song.artist || song.uploader?.username || 'Artiste inconnu',
            songs: [],
            totalPlays: 0,
          };
        }
        map[uid].songs.push(song);
        map[uid].totalPlays += song.plays_count || 0;
      });

      let list = Object.values(map);

      // Tri
      if (sort === 'plays')  list.sort((a, b) => b.totalPlays - a.totalPlays);
      else if (sort === 'songs') list.sort((a, b) => b.songs.length - a.songs.length);
      else list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));

      setArtists(list);
    } catch (e) {
      console.error('ArtistsPage:', e);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => { fetchArtists(); }, [fetchArtists]);

  const filtered = artists.filter(a =>
    !search || a.displayName.toLowerCase().includes(search.toLowerCase()) || a.username.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id);

  const playAll = (artist) => {
    if (artist.songs.length > 0) playSong(artist.songs[0], artist.songs);
  };

  const Avatar = ({ a }) => {
    if (a.avatar_url) return (
      <img src={a.avatar_url} alt={a.displayName}
        className="w-12 h-12 rounded-2xl object-cover flex-shrink-0 border border-white/10" />
    );
    const h = [...a.displayName].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
    const bg = `hsl(${h % 360},55%,38%)`;
    return (
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-lg border border-white/10"
        style={{ background: bg }}>
        {(a.displayName[0] || '?').toUpperCase()}
      </div>
    );
  };

  return (
    <>
      <Helmet><title>{'Artistes'} — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950">
        <Header />
        <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-32">

          {/* Titre */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-fuchsia-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-white font-black text-2xl">{'Artistes'}</h1>
              <p className="text-gray-500 text-sm">{artists.length} artiste{artists.length > 1 ? 's' : ''} sur NovaSound</p>
            </div>
          </div>

          {/* Barre recherche + tri */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={'search'}
                className="w-full pl-11 pr-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-2xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-fuchsia-500/50 focus:bg-white/[0.08] transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <span className="text-xs leading-none">✕</span>
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              {[
                { k: 'songs', l: '# Sons' },
                { k: 'plays', l: '▶ Écoutes' },
                { k: 'alpha', l: 'A→Z' },
              ].map(({ k, l }) => (
                <button key={k} onClick={() => setSort(k)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    sort === k
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                      : 'bg-white/[0.05] text-gray-500 border border-white/[0.08] hover:text-gray-300'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Liste artistes */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-600">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun artiste trouvé</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((artist, i) => (
                <motion.div key={artist.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all">

                  {/* Artist header row */}
                  <div className="flex items-center gap-3 p-4">
                    <Avatar a={artist} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-white font-bold text-base truncate">{artist.displayName}</h2>
                        {artist.id !== '__unknown__' && (
                          <Link to={`/artist/${artist.id}`}
                            className="text-[10px] text-fuchsia-400/70 hover:text-fuchsia-300 border border-fuchsia-500/20 px-1.5 py-0.5 rounded-full transition-all">
                            {'Profil →'}
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Music className="w-3 h-3" /> {artist.songs.length} son{artist.songs.length > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Headphones className="w-3 h-3" /> {formatPlays(artist.totalPlays)} {'écoutes'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => playAll(artist)}
                        className="p-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 text-fuchsia-400 hover:bg-fuchsia-500/25 transition-all"
                        title="Tout écouter">
                        <Play className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleExpand(artist.id)}
                        className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-gray-400 hover:text-white transition-all">
                        {expandedId === artist.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Songs list (expanded) */}
                  <AnimatePresence>
                    {expandedId === artist.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="border-t border-white/[0.06] overflow-hidden">
                        <div className="p-3 space-y-1 max-h-80 overflow-y-auto">
                          {artist.songs.map((song, si) => (
                            <button key={song.id}
                              onClick={() => playSong(song, artist.songs)}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.06] transition-all text-left group">
                              <img src={song.cover_url || '/icon-192.png'} alt=""
                                className="w-8 h-8 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-200 truncate group-hover:text-white transition-colors">{song.title}</p>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-600 flex-shrink-0">
                                <TrendingUp className="w-3 h-3" />
                                {formatPlays(song.plays_count || 0)}
                              </div>
                              <Play className="w-3.5 h-3.5 text-fuchsia-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default ArtistsPage;
