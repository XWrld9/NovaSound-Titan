/**
 * HomePage — NovaSound TITAN LUX V50000
 *
 * V50000 :
 * ✅ Section "Salons en direct" (LiveRoomsWidget) en temps réel
 * ✅ Section "Nouvelles sorties" des artistes suivis (si connecté)
 * ✅ Skeleton pour la section following
 * (tout le reste inchangé depuis V40000)
 */
import React, { useState, useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Music, Play, Pause, TrendingUp, Newspaper, X, User, Headphones, ExternalLink, Trophy, History, Radio, UserCheck, Flame, Globe, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { formatPlays } from '@/lib/utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import NewsLikeButton from '@/components/NewsLikeButton';
import NewsShareButton from '@/components/NewsShareButton';
import SongActionsMenu from '@/components/SongActionsMenu';
import SpotlightCarousel from '@/components/SpotlightCarousel';
import LiveRoomsWidget from '@/components/LiveRoomsWidget';

// ── Historique d'écoute local (localStorage) ────────────────────────
const HIST_KEY = (uid) => uid ? `novasound.history.${uid}` : null;
const MAX_HIST = 8;

export const logListened = (song, uid) => {
  const key = HIST_KEY(uid);
  if (!key || !song?.id) return;
  try {
    const prev = JSON.parse(localStorage.getItem(key) || '[]').filter(s => s.id !== song.id);
    const slim  = { id: song.id, title: song.title, artist: song.artist, cover_url: song.cover_url || null };
    localStorage.setItem(key, JSON.stringify([slim, ...prev].slice(0, MAX_HIST)));
  } catch {}
};

const getListened = (uid) => {
  const key = HIST_KEY(uid);
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
};

const HomePage = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [featuredSongs,    setFeaturedSongs]    = useState([]);
  const [listenedHistory,  setListenedHistory]  = useState([]);
  const [topSongs,         setTopSongs]         = useState([]);
  const [spotlightSongs,   setSpotlightSongs]   = useState([]);
  const [newsItems,        setNewsItems]        = useState([]);
  const [followingSongs,   setFollowingSongs]   = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [selectedNews,     setSelectedNews]     = useState(null);
  const [newSongIds,       setNewSongIds]       = useState(new Set());
  // Sections découverte
  const [trendingSongs,    setTrendingSongs]    = useState([]);
  const [recommendedSongs, setRecommendedSongs] = useState([]);
  const [africaSongs,      setAfricaSongs]      = useState([]);
  const [loadingHistorySong, setLoadingHistorySong] = useState(null);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const raw = getListened(currentUser?.id);
    if (!raw.length) { setListenedHistory([]); return; }
    // Vérifier que les songs existent encore en DB (purge orphelins)
    const ids = raw.map(s => s.id);
    supabase.from('songs').select('id').in('id', ids).eq('is_archived', false)
      .then(({ data }) => {
        const alive = new Set((data || []).map(s => s.id));
        const clean = raw.filter(s => alive.has(s.id));
        // Persister la version nettoyée
        if (clean.length !== raw.length) {
          try { localStorage.setItem(HIST_KEY(currentUser.id), JSON.stringify(clean)); } catch {}
        }
        setListenedHistory(clean);
      }).catch(() => setListenedHistory(raw)); // fallback: afficher tel quel
  }, [currentUser?.id]);

  // Nouvelles sorties des artistes suivis
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchFollowingSongs(currentUser.id);
  }, [currentUser?.id]);

  const fetchFollowingSongs = async (userId) => {
    setLoadingFollowing(true);
    try {
      // 1. Récupérer les IDs des artistes suivis
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .limit(30);

      if (!follows?.length) { setLoadingFollowing(false); return; }

      const artistIds = follows.map(f => f.following_id);

      // 2. Leurs dernières sorties (7 derniers jours)
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: songs } = await supabase
        .from('songs')
        .select('*')
        .in('uploader_id', artistIds)
        .eq('is_archived', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(8);

      setFollowingSongs(songs || []);
    } catch {}
    setLoadingFollowing(false);
  };

  // Realtime nouveaux sons
  useEffect(() => {
    const channel = supabase
      .channel('homepage_songs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'songs' }, (payload) => {
        if (!payload.new?.is_archived) {
          setFeaturedSongs(prev => {
            if (prev.find(s => s.id === payload.new.id)) return prev;
            setNewSongIds(ids => new Set([...ids, payload.new.id]));
            return [payload.new, ...prev].slice(0, 12);
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const loadingTimeout = setTimeout(() => setLoading(false), 5000);
    try {
      const [{ data: songs, error: songsError }, { data: news, error: newsError }, { data: top }, { data: spotlight }] = await Promise.all([
        supabase.from('songs').select('*').eq('is_archived', false).order('created_at', { ascending: false }).limit(12),
        supabase.from('news').select('*, users:author_id(username)').order('created_at', { ascending: false }).limit(6),
        supabase.from('songs').select('*').eq('is_archived', false).order('plays_count', { ascending: false }).limit(3),
        supabase.from('songs').select('*').eq('is_archived', false).order('created_at', { ascending: false }).limit(5),
      ]);
      if (songsError) throw songsError;
      setNewsItems(newsError ? [] : (news || []));
      setFeaturedSongs(songs || []);
      setTopSongs((top || []).filter(s => !s.is_archived));
      setSpotlightSongs((spotlight || []).filter(s => !s.is_archived));

      // Sections découverte — en parallèle, sans bloquer
      Promise.all([
        // 🔥 Tendances — top écoutes semaine
        supabase.from('songs').select('id,title,artist,cover_url,audio_url,plays_count,genre,uploader_id')
          .eq('is_archived', false).order('plays_count', { ascending: false }).limit(6),
        // 🌍 Découverte Afrique — genres africains
        supabase.from('songs').select('id,title,artist,cover_url,audio_url,plays_count,genre,uploader_id')
          .eq('is_archived', false)
          .in('genre', ['Bikutsi','Makossa','Assiko','Afrobeats','Amapiano','Coupé-Décalé','Ambas-Bay','Benskin','Mbolé','Drill'])
          .order('plays_count', { ascending: false }).limit(6),
      ]).then(([{ data: trending }, { data: africa }]) => {
        setTrendingSongs(trending || []);
        setAfricaSongs(africa || []);
        // 🎧 Recommandé — récents non encore entendus (fallback : récents)
        setRecommendedSongs((songs || []).slice(0, 6));
      }).catch(() => {});
    } catch { setFeaturedSongs([]); setNewsItems([]); }
    finally { clearTimeout(loadingTimeout); setLoading(false); }
  };

  const { playSong: globalPlaySong, currentSong } = usePlayer();

  const playSong = async (song) => {
    try {
      if (!song.audio_url) {
        setLoadingHistorySong(song.id);
        const { data: fullSong, error } = await supabase.from('songs').select('*').eq('id', song.id).single();
        setLoadingHistorySong(null);
        if (error || !fullSong) return;
        globalPlaySong(fullSong, featuredSongs.filter(s => !s.is_archived));
        logListened(fullSong, currentUser?.id);
      } else {
        globalPlaySong(song, featuredSongs.filter(s => !s.is_archived));
        logListened(song, currentUser?.id);
      }
      setListenedHistory(getListened(currentUser?.id));
    } catch { setLoadingHistorySong(null); }
  };

  // ── Mini carte son (réutilisée dans plusieurs sections) ──────
  const SongMiniCard = ({ song, index, onPlay }) => {
    const isPlaying = currentSong?.id === song.id;
    return (
      <motion.div
        key={song.id}
        initial={{ opacity: 0, scale: 0.88, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
        className="group cursor-pointer"
        onClick={() => onPlay(song)}
      >
        <div className={`relative aspect-square rounded-xl overflow-hidden bg-gray-800/80 mb-2 shadow-lg transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-cyan-500/20 group-hover:shadow-xl ${isPlaying ? 'ring-2 ring-cyan-500 ring-offset-1 ring-offset-gray-950' : ''}`}>
          {song.cover_url
            ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full bg-gradient-to-br from-cyan-600/30 to-purple-600/40 flex items-center justify-center"><Music className="w-6 h-6 text-cyan-400/50" /></div>
          }
          {/* Gradient bottom pour lisibilité */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          {/* Bouton play */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`transition-all duration-200 ${isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}>
              {loadingHistorySong === song.id ? (
                <div className="w-9 h-9 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/40 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              ) : isPlaying ? (
                <div className="w-9 h-9 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50 flex items-center justify-center animate-pulse">
                  <Pause className="w-4 h-4 text-white fill-white" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 shadow-lg shadow-cyan-500/40 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
              )}
            </div>
          </div>
        </div>
        <p className={`text-xs font-semibold truncate transition-colors notranslate ${isPlaying ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'}`} translate="no">{song.title}</p>
        <p className="text-gray-500 text-xs truncate notranslate" translate="no">{song.artist}</p>
      </motion.div>
    );
  };

  return (
    <>
      <Helmet>
        <title>NovaSound TITAN LUX — Découvrez la musique</title>
        <meta name="description" content="Stream and discover the latest music on NovaSound-Titan. Upload your tracks and connect with music lovers worldwide." />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32 md:pb-32 relative overflow-x-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/background.png)', zIndex: -1 }} />
        <div className="absolute inset-0 bg-gray-950/80" />
        <Header />

        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative h-[480px] md:h-[580px] overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url(https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/e8ebebbd32c0e37f6ab462c275dd560a.jpg)' }} />
            <div className="absolute inset-0 bg-gradient-to-b from-[#060810]/70 via-[#060810]/50 to-[#060810]" />
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-fuchsia-500/10" />
            {/* Noise texture overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
            <div className="relative w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-12 h-full flex items-center justify-center md:justify-start text-center md:text-left">
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="max-w-3xl">
                {/* Badge */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-gray-400 font-medium mb-5 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Streaming musical · Cameroun & Monde
                </motion.div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-5 leading-[1.05] tracking-tight">
                  <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">Ressens la</span>
                  <br />
                  <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">vague sonore</span>
                </h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="text-base md:text-lg text-gray-400 mb-8 max-w-lg mx-auto md:mx-0 leading-relaxed">
                  Découvre, écoute et partage la musique qui te fait vibrer. Rejoins la révolution.
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                  {!isAuthenticated && (
                    <Link to="/signup">
                      <Button className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-white text-base px-7 py-5 font-bold shadow-lg shadow-cyan-500/25 rounded-xl transition-all hover:shadow-cyan-500/40 hover:-translate-y-0.5">
                        Commencer gratuitement
                      </Button>
                    </Link>
                  )}
                  <Link to="/upload">
                    <Button variant="outline" className="w-full sm:w-auto border-white/15 text-white hover:bg-white/8 hover:border-white/30 text-base px-7 py-5 font-semibold rounded-xl backdrop-blur-sm transition-all">
                      Uploader un son
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* ── SPOTLIGHT CARROUSEL ── */}
          {spotlightSongs.length > 0 && (
            <section className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 -mt-6 relative z-10 mb-4">
              <SpotlightCarousel songs={spotlightSongs} onPlay={playSong} currentSong={currentSong} />
            </section>
          )}

          {/* ── SALONS EN DIRECT ── */}
          <section className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-6 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400" />
                Salons en direct
              </h2>
              <Link to="/live" className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium">
                Créer un salon →
              </Link>
            </div>
            <LiveRoomsWidget />
          </section>

          {/* ── NOUVELLES SORTIES des artistes suivis ── */}
          {isAuthenticated && (
            <section className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-4 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-fuchsia-400" />
                  Nouvelles sorties (abonnements)
                </h2>
              </div>
              {loadingFollowing ? (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="aspect-square bg-gray-800/60 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : followingSongs.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {followingSongs.map((song, i) => (
                    <SongMiniCard key={song.id} song={song} index={i} onPlay={playSong} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-900/50 border border-white/[0.05] rounded-2xl">
                  <p className="text-sm text-gray-600">Aucune sortie cette semaine de tes artistes suivis</p>
                  <Link to="/artists" className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-semibold transition-colors">
                    Découvrir des artistes →
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* ── CONTINUER L'ÉCOUTE ── */}
          {isAuthenticated && listenedHistory.length > 0 && (
            <section className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  Continuer l'écoute
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                {listenedHistory.map((song, i) => (
                  <SongMiniCard key={song.id} song={song} index={i} onPlay={playSong} />
                ))}
              </div>
            </section>
          )}

          {/* ── TOP 3 SONS ── */}
          {topSongs.length > 0 && (
            <section className="relative py-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/20 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                    <Trophy className="w-6 h-6 md:w-7 md:h-7 text-amber-400" />
                    Top 3 du moment
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {topSongs.map((song, rank) => {
                    const medals = ['🥇','🥈','🥉'];
                    return (
                      <motion.div key={song.id}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.08 }}
                        className="relative bg-gray-800/80 border border-amber-500/20 rounded-2xl overflow-hidden hover:border-amber-400/50 transition-all group cursor-pointer hover:shadow-lg hover:shadow-amber-500/10"
                        onClick={() => playSong(song)}
                      >
                        {song.cover_url && (
                          <div className="absolute inset-0 opacity-15 group-hover:opacity-20 transition-opacity"
                            style={{ backgroundImage: `url(${song.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(8px)', transform: 'scale(1.1)' }} />
                        )}
                        <div className="relative flex items-center gap-4 p-4">
                          <span className="text-2xl flex-shrink-0">{medals[rank]}</span>
                          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-lg border border-white/10">
                            {song.cover_url
                              ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                              : <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"><Music className="w-6 h-6 text-white" /></div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm truncate group-hover:text-amber-300 transition-colors notranslate" translate="no">{song.title}</p>
                            <p className="text-gray-400 text-xs truncate mt-0.5 notranslate" translate="no">{song.artist}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Headphones className="w-3 h-3 text-amber-400" />
                              <span className="text-xs text-amber-400 font-semibold">{formatPlays(song.plays_count)}</span>
                              {song.genre && <span className="text-[9px] px-1.5 py-px rounded-full bg-white/10 text-gray-400 ml-1">{song.genre}</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 p-2 rounded-full bg-white/10 group-hover:bg-amber-500/20 transition-all">
                            <Play className="w-4 h-4 text-white fill-current" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Featured Songs */}
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/20 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
            <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                    Morceaux en vedette
                  </h2>
                </div>
                <Link to="/explorer" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium">Explorer tout →</Link>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-5">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="rounded-2xl overflow-hidden bg-gray-800/60 animate-pulse">
                      <div className="aspect-square" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 bg-gray-700/60 rounded-full w-3/4" />
                        <div className="h-2.5 bg-gray-700/40 rounded-full w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : featuredSongs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {featuredSongs.map((song, index) => (
                    <motion.div key={song.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, duration: 0.3 }}
                      className="bg-[#0e1222]/90 border border-white/[0.07] rounded-2xl hover:border-white/20 hover:bg-[#111827] transition-all group hover:shadow-xl hover:shadow-black/40 relative overflow-hidden"
                    >
                      {/* Glow cover en fond au hover */}
                      {song.cover_url && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none"
                          style={{ backgroundImage: `url(${song.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px)', transform: 'scale(1.2)' }} />
                      )}
                      {newSongIds.has(song.id) && (
                        <div className="absolute top-2.5 left-2.5 z-30 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse pointer-events-none">NEW</div>
                      )}
                      <div className="relative aspect-square rounded-t-2xl overflow-hidden">
                        {song.cover_url ? (
                          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-600/30 to-purple-900/60 flex items-center justify-center">
                            <Music className="w-16 h-16 text-cyan-400/40" />
                          </div>
                        )}
                        {/* Overlay play */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center">
                          <button onClick={() => playSong(song)}
                            className="p-4 rounded-full bg-white/95 hover:bg-white transform scale-90 group-hover:scale-100 transition-all duration-200 shadow-2xl"
                            aria-label="Lancer la lecture">
                            <Play className="w-5 h-5 text-gray-900 fill-current ml-0.5" />
                          </button>
                        </div>
                        {/* Badge écoutes */}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Headphones className="w-3 h-3 text-cyan-400" />
                          <span className="text-xs text-cyan-300 font-medium">{formatPlays(song.plays_count)}</span>
                        </div>
                        <Link to={`/song/${song.id}`}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-cyan-500 transition-all z-20"
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                      <div className="relative p-3">
                        <Link to={`/song/${song.id}`} className="text-white font-semibold truncate text-sm block hover:text-cyan-400 transition-colors notranslate" translate="no">{song.title}</Link>
                        {song.uploader_id ? (
                          <Link to={`/artist/${song.uploader_id}`} className="text-gray-500 text-xs truncate block hover:text-gray-300 transition-colors mt-0.5 notranslate" translate="no">{song.artist}</Link>
                        ) : (
                          <p className="text-gray-500 text-xs truncate mt-0.5 notranslate" translate="no">{song.artist}</p>
                        )}
                        <div className="flex items-center justify-end mt-1.5">
                          <SongActionsMenu song={song}
                            onArchived={(id) => setFeaturedSongs(prev => prev.filter(s => s.id !== id))}
                            onDeleted={(id) => setFeaturedSongs(prev => prev.filter(s => s.id !== id))} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-800/50 border border-cyan-500/30 rounded-2xl">
                  <Music className="w-14 h-14 text-cyan-600/40 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun morceau disponible pour l'instant</p>
                  <Link to="/upload" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">Sois le premier à uploader →</Link>
                </div>
              )}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════
              🔥 TENDANCES
          ═══════════════════════════════════════════════════ */}
          {trendingSongs.length > 0 && (
            <section className="relative py-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/15 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
              <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-orange-400 to-red-600 rounded-full" />
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                      <Flame className="w-6 h-6 text-orange-400" />🔥 Tendances
                    </h2>
                  </div>
                  <Link to="/trending" className="text-sm text-orange-400 hover:text-orange-300 transition-colors font-medium">Voir tout →</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                  {trendingSongs.map((song, i) => (
                    <motion.div key={song.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="group relative bg-gray-900/80 border border-gray-800 hover:border-orange-500/40 rounded-xl overflow-hidden cursor-pointer transition-all"
                      onClick={() => playSong(song)}>
                      <div className="relative aspect-square">
                        {song.cover_url
                          ? <img src={song.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          : <div className="w-full h-full bg-gradient-to-br from-orange-600/30 to-red-900/50 flex items-center justify-center"><Music className="w-8 h-8 text-orange-400/50" /></div>}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                        <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-orange-500/90 flex items-center justify-center text-white text-[10px] font-black">
                          {i + 1}
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-white text-xs font-semibold truncate notranslate" translate="no">{song.title}</p>
                        <p className="text-gray-500 text-[10px] truncate notranslate" translate="no">{song.artist}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════════════════════════════════════
              🎧 RECOMMANDÉ POUR VOUS
          ═══════════════════════════════════════════════════ */}
          {recommendedSongs.length > 0 && (
            <section className="relative py-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/15 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
              <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-violet-400 to-purple-600 rounded-full" />
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-violet-400" />🎧 Recommandé pour vous
                    </h2>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                  {recommendedSongs.map((song, i) => (
                    <motion.div key={song.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => playSong(song)}
                      className="group flex-shrink-0 w-36 sm:w-44 cursor-pointer snap-start">
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-2 border border-gray-800 group-hover:border-violet-500/40 transition-colors">
                        {song.cover_url
                          ? <img src={song.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          : <div className="w-full h-full bg-gradient-to-br from-violet-600/30 to-purple-900/50 flex items-center justify-center"><Music className="w-8 h-8 text-violet-400/50" /></div>}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                          <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                      </div>
                      <p className="text-white text-xs font-semibold truncate notranslate" translate="no">{song.title}</p>
                      <p className="text-gray-500 text-[10px] truncate notranslate" translate="no">{song.artist}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════════════════════════════════════
              🌍 DÉCOUVERTE AFRIQUE
          ═══════════════════════════════════════════════════ */}
          {africaSongs.length > 0 && (
            <section className="relative py-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-950/15 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
              <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-green-400 to-emerald-600 rounded-full" />
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                      <Globe className="w-6 h-6 text-green-400" />🌍 Découverte Afrique
                    </h2>
                  </div>
                  <Link to="/explorer" className="text-sm text-green-400 hover:text-green-300 transition-colors font-medium">Explorer →</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {africaSongs.map((song, i) => (
                    <motion.div key={song.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      onClick={() => playSong(song)}
                      className="group flex items-center gap-3 bg-gray-900/80 border border-gray-800 hover:border-green-500/40 rounded-xl p-3 cursor-pointer transition-all">
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        {song.cover_url
                          ? <img src={song.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                          : <div className="w-full h-full bg-gradient-to-br from-green-600/30 to-emerald-900/50 flex items-center justify-center"><Music className="w-6 h-6 text-green-400/50" /></div>}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-current" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate notranslate" translate="no">{song.title}</p>
                        <p className="text-gray-400 text-xs truncate notranslate" translate="no">{song.artist}</p>
                        {song.genre && <span className="text-[10px] text-green-400 font-medium bg-green-500/10 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">{song.genre}</span>}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 flex-shrink-0">
                        <Headphones className="w-3 h-3" />
                        <span className="text-[10px]">{formatPlays(song.plays_count)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* News Feed */}
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-950/25 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
            <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-fuchsia-400 to-purple-600 rounded-full" />
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                    <Newspaper className="w-6 h-6 md:w-8 md:h-8 text-fuchsia-400" />
                    Dernières actualités
                  </h2>
                </div>
                <Link to="/news" className="text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors font-medium">Voir tout →</Link>
              </div>

              {newsItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {newsItems.map((news, index) => (
                    <motion.div key={news.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.35 }}
                      onClick={() => setSelectedNews(news)}
                      className="relative bg-gray-800/90 border border-fuchsia-500/50 rounded-2xl p-5 hover:border-fuchsia-400 hover:bg-gray-800 transition-all cursor-pointer hover:shadow-xl hover:shadow-fuchsia-500/20 group overflow-hidden"
                    >
                      <div className="absolute -top-4 -right-4 w-28 h-28 bg-fuchsia-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-fuchsia-500/25 transition-all" />
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-fuchsia-300 font-medium bg-fuchsia-500/15 px-2.5 py-0.5 rounded-full border border-fuchsia-500/30">
                          {new Date(news.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {news.users?.username && <span className="text-xs text-gray-400 font-medium truncate max-w-[120px]">{news.users.username}</span>}
                      </div>
                      <h3 className="text-base font-bold text-white mb-2 group-hover:text-fuchsia-300 transition-colors line-clamp-2 leading-snug">{news.title}</h3>
                      <p className="text-gray-300 text-sm mb-4 line-clamp-3 leading-relaxed">{news.content}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-700/60">
                        <div onClick={e => e.stopPropagation()}>
                          <NewsLikeButton newsId={news.id} initialLikes={news.likes_count || 0} authorId={news.author_id} />
                        </div>
                        <span className="text-xs text-fuchsia-400 font-semibold group-hover:translate-x-1 transition-transform">Lire la suite →</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-800/50 border border-fuchsia-500/30 rounded-2xl">
                  <Newspaper className="w-14 h-14 text-fuchsia-600/40 mx-auto mb-3" />
                  <p className="text-gray-400">Aucune news pour l'instant</p>
                  <Link to="/news" className="text-fuchsia-400 text-sm hover:underline mt-2 inline-block">Sois le premier à publier →</Link>
                </div>
              )}
            </div>
          </section>
        </main>

        <Footer />

        {/* Modal news */}
        <AnimatePresence>
          {selectedNews && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSelectedNews(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-gray-900 border border-fuchsia-500/40 rounded-2xl shadow-2xl shadow-fuchsia-500/15 w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-start justify-between p-6 border-b border-gray-800 flex-shrink-0">
                    <div className="flex-1 pr-4">
                      <span className="text-xs text-fuchsia-300 font-medium bg-fuchsia-500/15 px-2.5 py-0.5 rounded-full border border-fuchsia-500/30 inline-block mb-3">
                        {new Date(selectedNews.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <h2 className="text-2xl font-bold text-white leading-tight">{selectedNews.title}</h2>
                    </div>
                    <button onClick={() => setSelectedNews(null)} className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">{selectedNews.content}</p>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0 bg-gray-800/30 rounded-b-2xl">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <User className="w-4 h-4" />
                      <span className="font-medium">{selectedNews.users?.username || 'Anonyme'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <NewsShareButton news={selectedNews} />
                      <NewsLikeButton newsId={selectedNews.id} initialLikes={selectedNews.likes_count || 0} authorId={selectedNews.author_id} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default HomePage;
