/**
 * TrendingPage — NovaSound TITAN LUX v60
 * Page de tendances : sons et artistes en vogue par période.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  TrendingUp, Flame, Clock, Calendar, Play, Headphones, Heart,
  Users, Music, Loader2, Trophy, Medal,
} from 'lucide-react';
import { formatPlays } from '@/lib/utils';

const PERIODS = [
  { id: '24h', label: '24h',    icon: Clock,    view: 'trending_24h' },
  { id: '7d',  label: '7 jours', icon: Flame,    view: 'trending_7d'  },
  { id: '30d', label: '30 jours', icon: Calendar, view: 'trending_30d' },
];

const RankBadge = ({ rank }) => {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-black text-gray-600 w-6 text-center tabular-nums">{rank}</span>;
};

const TrendingPage = () => {
  const { playSong } = usePlayer();
  const [period,         setPeriod]         = useState('7d');
  const [activeTab,      setActiveTab]       = useState('songs'); // songs | artists
  const [songs,          setSongs]           = useState([]);
  const [artists,        setArtists]         = useState([]);
  const [loadingSongs,   setLoadingSongs]    = useState(false);
  const [loadingArtists, setLoadingArtists]  = useState(false);

  const fetchTrendingSongs = useCallback(async (p) => {
    setLoadingSongs(true);
    try {
      const view = PERIODS.find(x => x.id === p)?.view || 'trending_7d';
      const { data } = await supabase.from(view).select('*').limit(20);
      setSongs(data || []);
    } catch {}
    finally { setLoadingSongs(false); }
  }, []);

  const fetchTrendingArtists = useCallback(async (p) => {
    setLoadingArtists(true);
    try {
      const { data } = await supabase.rpc('get_trending_artists', { period: p, lim: 15 });
      setArtists(data || []);
    } catch {}
    finally { setLoadingArtists(false); }
  }, []);

  useEffect(() => {
    fetchTrendingSongs(period);
    fetchTrendingArtists(period);
  }, [period, fetchTrendingSongs, fetchTrendingArtists]);

  const handlePlayAll = () => {
    if (!songs.length) return;
    playSong(songs[0], songs);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-28">
      <Helmet>
        <title>Trending — NovaSound</title>
        <meta name="description" content="Les sons et artistes en vogue sur NovaSound" />
      </Helmet>
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/10 to-magenta-500/10 border border-cyan-500/20 px-4 py-1.5 rounded-full mb-4">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Trending</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Ce qui buzz sur NovaSound</h1>
          <p className="text-gray-500 text-sm">Les sons et artistes les plus écoutés et likés</p>
        </motion.div>

        {/* Filtres période */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-2 bg-gray-900/60 border border-white/8 rounded-2xl p-1">
            {PERIODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${period === id ? 'bg-gradient-to-r from-cyan-500 to-magenta-500 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tabs sons / artistes */}
          <div className="flex gap-1 bg-gray-900/60 border border-white/8 rounded-2xl p-1">
            <button
              onClick={() => setActiveTab('songs')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'songs' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <Music className="w-3.5 h-3.5" /> Sons
            </button>
            <button
              onClick={() => setActiveTab('artists')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'artists' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <Users className="w-3.5 h-3.5" /> Artistes
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── SONS ── */}
          {activeTab === 'songs' && (
            <motion.div
              key="songs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              {loadingSongs ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              ) : songs.length === 0 ? (
                <div className="text-center py-20 text-gray-600">
                  <Flame className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Aucune tendance pour cette période</p>
                </div>
              ) : (
                <>
                  {/* Top 3 heroes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {songs.slice(0, 3).map((song, idx) => (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.08 }}
                        className="relative bg-gray-900/70 border border-white/10 rounded-2xl overflow-hidden group cursor-pointer hover:border-cyan-500/30 transition-all"
                        onClick={() => playSong(song, songs)}
                      >
                        {/* Cover blurée en fond */}
                        {song.cover_url && (
                          <div className="absolute inset-0 opacity-20 bg-center bg-cover blur-xl scale-110"
                            style={{ backgroundImage: `url(${song.cover_url})` }} />
                        )}
                        <div className="relative p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 pt-0.5">
                              <RankBadge rank={idx + 1} />
                            </div>
                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                              {song.cover_url
                                ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center"><Music className="w-6 h-6 text-white" /></div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-bold text-sm truncate">{song.title}</p>
                              <p className="text-gray-400 text-xs truncate">{song.artist}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="flex items-center gap-1 text-[10px] text-cyan-400">
                                  <Headphones className="w-3 h-3" />{formatPlays(song.plays_count)}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-pink-400">
                                  <Heart className="w-3 h-3" />{formatPlays(song.likes_count)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* Play on hover */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-magenta-500 rounded-full flex items-center justify-center shadow-lg">
                              <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Reste de la liste */}
                  <div className="space-y-1.5">
                    {songs.slice(3).map((song, idx) => (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (idx + 3) * 0.03 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/[0.04] transition-all group cursor-pointer border border-transparent hover:border-white/8"
                        onClick={() => playSong(song, songs)}
                      >
                        <div className="w-7 text-center flex-shrink-0">
                          <RankBadge rank={idx + 4} />
                        </div>
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          {song.cover_url
                            ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center"><Music className="w-4 h-4 text-white" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{song.title}</p>
                          <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="hidden sm:flex items-center gap-1 text-xs text-cyan-400/70">
                            <Headphones className="w-3 h-3" />{formatPlays(song.plays_count)}
                          </span>
                          <span className="hidden sm:flex items-center gap-1 text-xs text-pink-400/70">
                            <Heart className="w-3 h-3" />{formatPlays(song.likes_count)}
                          </span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 text-white fill-current" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Play all */}
                  {songs.length > 0 && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={handlePlayAll}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-400 hover:to-magenta-400 text-white font-bold px-8 py-3 rounded-full transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Lire tout le Top {songs.length}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── ARTISTES ── */}
          {activeTab === 'artists' && (
            <motion.div
              key="artists"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              {loadingArtists ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              ) : artists.length === 0 ? (
                <div className="text-center py-20 text-gray-600">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Aucun artiste tendance pour cette période</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {artists.map((artist, idx) => (
                    <motion.div
                      key={artist.user_id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Link to={`/artist/${artist.user_id}`}
                        className="flex items-center gap-4 p-4 bg-gray-900/60 border border-white/8 rounded-2xl hover:border-cyan-500/30 hover:bg-gray-900/90 transition-all group"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden shadow-lg">
                            {artist.avatar_url
                              ? <img src={artist.avatar_url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center"><Users className="w-6 h-6 text-white" /></div>
                            }
                          </div>
                          <div className="absolute -top-1.5 -left-1.5 text-sm"><RankBadge rank={idx + 1} /></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate group-hover:text-cyan-300 transition-colors">{artist.username}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-[10px] text-cyan-400">
                              <Headphones className="w-3 h-3" />{formatPlays(Number(artist.total_plays))}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-pink-400">
                              <Heart className="w-3 h-3" />{formatPlays(Number(artist.total_likes))}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-amber-400">
                              <Users className="w-3 h-3" />{formatPlays(Number(artist.followers_cnt))}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-purple-400">
                              <Music className="w-3 h-3" />{artist.songs_count} sons
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
};

export default TrendingPage;
