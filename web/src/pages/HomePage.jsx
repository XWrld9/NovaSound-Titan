import React, { useState, useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Music, Play, TrendingUp, Newspaper, X, Calendar, User, Headphones, ExternalLink, Trophy, Clock, History } from 'lucide-react';
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
  const { isAuthenticated } = useAuth();
  const { currentUser } = useAuth();
  const [featuredSongs, setFeaturedSongs] = useState([]);
  const [listenedHistory, setListenedHistory] = useState([]);
  const [topSongs,      setTopSongs]      = useState([]);
  const [spotlightSongs, setSpotlightSongs] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);

  const [newSongIds, setNewSongIds] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  // Charger l'historique d'écoute local
  useEffect(() => {
    setListenedHistory(getListened(currentUser?.id));
  }, [currentUser?.id]);

  // Realtime : écouter les nouveaux sons publiés pendant la session
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
    // Timeout de sécurité pour éviter le loading infini
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000); // 5 secondes max

    try {
      const [{ data: songs, error: songsError }, { data: news, error: newsError }, { data: top }, { data: spotlight }] = await Promise.all([
        supabase
          .from('songs')
          .select('*')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('news')
          .select('*, users:author_id(username)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('songs')
          .select('*')
          .eq('is_archived', false)
          .order('plays_count', { ascending: false })
          .limit(3),
        supabase
          .from('songs')
          .select('*')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (songsError) throw songsError;
      if (newsError) {
        setNewsItems([]);
      } else {
        setNewsItems(news || []);
      }

      setFeaturedSongs(songs || []);
      setTopSongs((top || []).filter(s => !s.is_archived));
      setSpotlightSongs((spotlight || []).filter(s => !s.is_archived));
    } catch (error) {
      console.error('Error fetching data:', error);
      // En cas d'erreur, afficher quand même les données vides
      setFeaturedSongs([]);
      setNewsItems([]);
    } finally {
      clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const { playSong: globalPlaySong, currentSong } = usePlayer();

  // Lance la lecture avec toute la liste de la homepage comme playlist
  const playSong = (song) => {
    globalPlaySong(song, featuredSongs.filter(s => !s.is_archived));
    logListened(song, currentUser?.id);
    // Refresh history display
    setListenedHistory(getListened(currentUser?.id));
  };

  return (
    <>
      <Helmet>
        <title>NovaSound TITAN LUX — Découvrez la musique</title>
        <meta name="description" content="Stream and discover the latest music on NovaSound-Titan. Upload your tracks and connect with music lovers worldwide." />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32 relative overflow-x-hidden">
        {/* Background personnalisé */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/background.png)',
            zIndex: -1
          }}
        />
        <div className="absolute inset-0 bg-gray-950/80" /> {/* Overlay pour lisibilité */}
        
        <Header />

        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative h-[500px] md:h-[600px] overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-b from-gray-950/80 via-gray-950/60 to-gray-950 bg-cover bg-center"
              style={{
                backgroundImage: 'url(https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/e8ebebbd32c0e37f6ab462c275dd560a.jpg)'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-950/80 via-gray-950/60 to-gray-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-magenta-500/20" />
            
            <div className="relative container mx-auto px-4 h-full flex items-center justify-center md:justify-start text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-3xl"
              >
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-cyan-400 via-white to-magenta-500 bg-clip-text text-transparent leading-tight">
                  Ressens la vague sonore
                </h1>
                <p className="text-lg md:text-2xl text-gray-300 mb-6 md:mb-8 max-w-xl mx-auto md:mx-0">
                  Découvre, écoute et partage la musique qui te fait vibrer. Rejoins la révolution.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  {!isAuthenticated && (
                    <Link to="/signup" className="w-full sm:w-auto">
                      <Button className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white text-lg px-8 py-6 font-semibold shadow-lg shadow-cyan-500/30">
                        Commencer
                      </Button>
                    </Link>
                  )}
                  <Link to="/upload" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-lg px-8 py-6 font-semibold">
                      Uploader un son
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ── SPOTLIGHT CARROUSEL ── */}
          {spotlightSongs.length > 0 && (
            <section className="container mx-auto px-4 -mt-6 relative z-10 mb-4">
              <SpotlightCarousel
                songs={spotlightSongs}
                onPlay={playSong}
                currentSong={currentSong}
              />
            </section>
          )}

          {/* ── CONTINUER L'ÉCOUTE (si historique local) ── */}
          {isAuthenticated && listenedHistory.length > 0 && (
            <section className="container mx-auto px-4 py-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  Continuer l'écoute
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                {listenedHistory.map((song, i) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="group cursor-pointer"
                    onClick={() => playSong(song)}
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 mb-2">
                      {song.cover_url
                        ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 text-gray-600" /></div>
                      }
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="w-9 h-9 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <p className="text-white text-xs font-medium truncate">{song.title}</p>
                    <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* ── TOP 3 SONS ── */}
          {topSongs.length > 0 && (
            <section className="relative py-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/20 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              <div className="container mx-auto px-4 relative">
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
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: rank * 0.08 }}
                        className="relative bg-gray-800/80 border border-amber-500/20 rounded-2xl overflow-hidden hover:border-amber-400/50 transition-all group cursor-pointer hover:shadow-lg hover:shadow-amber-500/10"
                        onClick={() => playSong(song)}
                      >
                        {/* Pochette fond */}
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
                            <p className="text-white font-bold text-sm truncate group-hover:text-amber-300 transition-colors">{song.title}</p>
                            <p className="text-gray-400 text-xs truncate mt-0.5">{song.artist}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Headphones className="w-3 h-3 text-amber-400" />
                              <span className="text-xs text-amber-400 font-semibold">{formatPlays(song.plays_count)}</span>
                              {song.genre && (
                                <span className="text-[9px] px-1.5 py-px rounded-full bg-white/10 text-gray-400 ml-1">{song.genre}</span>
                              )}
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
            {/* Fond pour distinguer la section */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/20 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

            <div className="container mx-auto px-4 relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                    Morceaux en vedette
                  </h2>
                </div>
                <Link to="/explorer" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                  Explorer tout →
                </Link>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin mx-auto mb-3" />
                  <p className="text-cyan-400">Chargement des morceaux...</p>
                </div>
              ) : featuredSongs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {featuredSongs.map((song, index) => (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.3 }}
                      className="bg-gray-800/90 border border-cyan-500/40 rounded-2xl hover:border-cyan-400 hover:bg-gray-800 transition-all group hover:shadow-lg hover:shadow-cyan-500/15 relative"
                      style={{ overflow: 'visible' }}
                    >
                      {newSongIds.has(song.id) && (
                        <div className="absolute -top-2 -right-2 z-30 bg-gradient-to-r from-cyan-500 to-magenta-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse pointer-events-none">
                          NEW
                        </div>
                      )}
                      <div className="relative aspect-square rounded-t-2xl overflow-hidden">
                        {song.cover_url ? (
                          <img
                            src={song.cover_url}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-600/40 to-cyan-900/60 flex items-center justify-center">
                            <Music className="w-16 h-16 text-cyan-400/60" />
                          </div>
                        )}
                        {/* Bouton Play — toujours visible sur mobile, hover sur desktop */}
                        <div className="absolute inset-0 bg-black/40 md:bg-transparent md:group-hover:bg-black/60 flex items-center justify-center transition-all duration-200">
                          <button
                            onClick={() => playSong(song)}
                            className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform md:scale-90 md:opacity-0 md:group-hover:scale-100 md:group-hover:opacity-100 active:scale-95 transition-all duration-200 shadow-xl shadow-cyan-500/40"
                            aria-label="Lancer la lecture"
                          >
                            <Play className="w-6 h-6 text-white fill-current" />
                          </button>
                        </div>
                        {/* Bouton ↗ page son — toujours visible */}
                        <Link
                          to={`/song/${song.id}`}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-cyan-500 transition-all z-20"
                          title="Voir la page du son & commenter"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        {/* Badge écoutes */}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
                          <Headphones className="w-3 h-3 text-cyan-400" />
                          <span className="text-xs text-cyan-300 font-medium">{formatPlays(song.plays_count)}</span>
                        </div>
                      </div>
                      <div className="p-3 border-t border-gray-700/50">
                        {/* Titre cliquable → page son */}
                        <Link to={`/song/${song.id}`} className="text-white font-semibold truncate text-sm block hover:text-cyan-400 transition-colors">
                          {song.title}
                        </Link>
                        {song.uploader_id ? (
                          <Link to={`/artist/${song.uploader_id}`} className="text-gray-400 text-xs truncate block hover:text-cyan-400 transition-colors mt-0.5">
                            {song.artist}
                          </Link>
                        ) : (
                          <p className="text-gray-400 text-xs truncate mt-0.5">{song.artist}</p>
                        )}
                        <div className="flex items-center justify-end mt-1.5">
                          <SongActionsMenu
                            song={song}
                            onArchived={(id) => setFeaturedSongs(prev => prev.filter(s => s.id !== id))}
                            onDeleted={(id) => setFeaturedSongs(prev => prev.filter(s => s.id !== id))}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-800/50 border border-cyan-500/30 rounded-2xl">
                  <Music className="w-14 h-14 text-cyan-600/40 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun morceau disponible pour l'instant</p>
                  <Link to="/upload" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">
                    Sois le premier à uploader →
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* News Feed */}
          <section className="relative py-12 md:py-16 overflow-hidden">
            {/* Fond lumineux pour distinguer visuellement la section */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-950/25 to-transparent pointer-events-none" />
            {/* Ligne séparatrice haute */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
            {/* Ligne séparatrice basse */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />

            <div className="container mx-auto px-4 relative">
              {/* En-tête section */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-fuchsia-400 to-purple-600 rounded-full" />
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                    <Newspaper className="w-6 h-6 md:w-8 md:h-8 text-fuchsia-400" />
                    Dernières actualités
                  </h2>
                </div>
                <Link to="/news" className="text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors font-medium">
                  Voir tout →
                </Link>
              </div>

              {newsItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {newsItems.map((news, index) => (
                    <motion.div
                      key={news.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.35 }}
                      onClick={() => setSelectedNews(news)}
                      className="relative bg-gray-800/90 border border-fuchsia-500/50 rounded-2xl p-5 hover:border-fuchsia-400 hover:bg-gray-800 transition-all cursor-pointer hover:shadow-xl hover:shadow-fuchsia-500/20 group overflow-hidden"
                    >
                      {/* Lueur coin */}
                      <div className="absolute -top-4 -right-4 w-28 h-28 bg-fuchsia-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-fuchsia-500/25 transition-all" />

                      {/* Date + auteur */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-fuchsia-300 font-medium bg-fuchsia-500/15 px-2.5 py-0.5 rounded-full border border-fuchsia-500/30">
                          {new Date(news.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {news.users?.username && (
                          <span className="text-xs text-gray-400 font-medium truncate max-w-[120px]">
                            {news.users.username}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white mb-2 group-hover:text-fuchsia-300 transition-colors line-clamp-2 leading-snug">
                        {news.title}
                      </h3>
                      <p className="text-gray-300 text-sm mb-4 line-clamp-3 leading-relaxed">{news.content}</p>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-700/60">
                        <div onClick={e => e.stopPropagation()}>
                          <NewsLikeButton
                            newsId={news.id}
                            initialLikes={news.likes_count || 0}
                            authorId={news.author_id}
                          />
                        </div>
                        <span className="text-xs text-fuchsia-400 font-semibold group-hover:translate-x-1 transition-transform">
                          Lire la suite →
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-800/50 border border-fuchsia-500/30 rounded-2xl">
                  <Newspaper className="w-14 h-14 text-fuchsia-600/40 mx-auto mb-3" />
                  <p className="text-gray-400">Aucune news pour l'instant</p>
                  <Link to="/news" className="text-fuchsia-400 text-sm hover:underline mt-2 inline-block">
                    Sois le premier à publier →
                  </Link>
                </div>
              )}
            </div>
          </section>
        </main>

        <Footer />

        {/* Modal lecture complète d'une news — accessible à tous y compris l'auteur */}
        <AnimatePresence>
          {selectedNews && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSelectedNews(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div
                  className="bg-gray-900 border border-fuchsia-500/40 rounded-2xl shadow-2xl shadow-fuchsia-500/15 w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between p-6 border-b border-gray-800 flex-shrink-0">
                    <div className="flex-1 pr-4">
                      <span className="text-xs text-fuchsia-300 font-medium bg-fuchsia-500/15 px-2.5 py-0.5 rounded-full border border-fuchsia-500/30 inline-block mb-3">
                        {new Date(selectedNews.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <h2 className="text-2xl font-bold text-white leading-tight">{selectedNews.title}</h2>
                    </div>
                    <button
                      onClick={() => setSelectedNews(null)}
                      className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Contenu scrollable */}
                  <div className="p-6 overflow-y-auto flex-1">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
                      {selectedNews.content}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0 bg-gray-800/30 rounded-b-2xl">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <User className="w-4 h-4" />
                      <span className="font-medium">{selectedNews.users?.username || 'Anonyme'}</span>
                    </div>
                    {/* L'auteur peut voir les likes mais pas liker sa propre news */}
                    <div className="flex items-center gap-2">
                      <NewsShareButton news={selectedNews} />
                      <NewsLikeButton
                        newsId={selectedNews.id}
                        initialLikes={selectedNews.likes_count || 0}
                        authorId={selectedNews.author_id}
                      />
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