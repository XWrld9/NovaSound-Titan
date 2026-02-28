/**
 * SongPage — NovaSound TITAN LUX v70
 * Redesign complet + suggestions similaires + "ajouter à playlist" direct
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LikeButton from '@/components/LikeButton';
import FavoriteButton from '@/components/FavoriteButton';
import SongShareModal from '@/components/SongShareModal';
import CommentSection from '@/components/CommentSection';
import SongActionsMenu from '@/components/SongActionsMenu';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';
import { formatPlays } from '@/lib/utils';
import {
  Music, Play, Headphones, Calendar, ArrowLeft, Share2, User,
  ListMusic, Tag, ChevronRight
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';

const SongPage = () => {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const { playSong, currentSong, isVisible } = usePlayer();
  const { isAuthenticated } = useAuth();

  const [song,         setSong]         = useState(null);
  const [artist,       setArtist]       = useState(null);
  const [artistEmail,  setArtistEmail]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]         = useState(false);
  const [showShare,    setShowShare]    = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [siblings,     setSiblings]     = useState([]);
  const [similar,      setSimilar]      = useState([]); // même genre ou même artiste
  const [moreBySame,   setMoreBySame]   = useState([]); // autres sons du même artiste

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const fetchSong = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('songs').select('*').eq('id', id).single();
      if (error || !data) { setError(true); setLoading(false); return; }
      if (data.is_deleted) { setError(true); setLoading(false); return; }
      setSong(data);

      // Profil artiste
      if (data.uploader_id) {
        const { data: userData } = await supabase
          .from('users').select('id, username, avatar_url, email, bio, social_links').eq('id', data.uploader_id).single();
        setArtist(userData || null);
        setArtistEmail(userData?.email || null);
      }

      // Sons voisins (pour prev/next)
      const { data: siblingData } = await supabase
        .from('songs').select('*').eq('is_archived', false)
        .order('created_at', { ascending: false }).limit(50);
      if (siblingData) {
        let list = siblingData;
        if (!list.find(s => s.id === data.id)) list = [data, ...list];
        setSiblings(list);
      }

      // Suggestions similaires : même genre (hors le son courant)
      if (data.genre) {
        const { data: genreSongs } = await supabase
          .from('songs').select('id, title, artist, cover_url, plays_count, genre, uploader_id')
          .eq('is_archived', false).eq('genre', data.genre).neq('id', data.id)
          .order('plays_count', { ascending: false }).limit(6);
        setSimilar(genreSongs || []);
      }

      // Autres sons du même artiste
      if (data.uploader_id) {
        const { data: sameSongs } = await supabase
          .from('songs').select('id, title, artist, cover_url, plays_count, genre')
          .eq('is_archived', false).eq('uploader_id', data.uploader_id).neq('id', data.id)
          .order('created_at', { ascending: false }).limit(5);
        setMoreBySame(sameSongs || []);
      }
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (id) fetchSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sync song-updated (titre/artiste edites depuis le menu)
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail;
      if (!updated?.id) return;
      setSong(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
    };
    window.addEventListener('novasound:song-updated', handler);
    return () => window.removeEventListener('novasound:song-updated', handler);
  }, []);



  const handlePlay = () => {
    if (!song) return;
    playSong(song, siblings);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col pb-36 md:pb-24">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
          <div className="animate-pulse space-y-6">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-72 aspect-square bg-gray-800 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-4 pt-2">
                <div className="h-8 bg-gray-800 rounded w-3/4" />
                <div className="h-5 bg-gray-800 rounded w-1/2" />
                <div className="h-4 bg-gray-800 rounded w-1/4 mt-2" />
                <div className="flex gap-3 mt-6">
                  <div className="h-10 bg-gray-800 rounded-xl w-32" />
                  <div className="h-10 bg-gray-800 rounded-xl w-24" />
                  <div className="h-10 bg-gray-800 rounded-xl w-24" />
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col pb-36 md:pb-24">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center">
          <Music className="w-16 h-16 text-gray-700 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Son introuvable</h2>
          <p className="text-gray-500 mb-6">Ce morceau n'existe pas ou a été supprimé.</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-semibold transition-colors">
            Retour à l'accueil
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col pb-36 md:pb-24">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center">
          <Music className="w-16 h-16 text-gray-700 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Son introuvable</h2>
          <p className="text-gray-500 mb-6">Ce morceau n'existe pas ou a été supprimé.</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-semibold transition-colors">Retour à l'accueil</button>
        </main>
        <Footer />
      </div>
    );
  }

  const coverUrl   = song.cover_url || null;
  const pageUrl    = `${window.location.origin}/#/song/${id}`;
  const ogImage    = coverUrl || `${window.location.origin}/background.png`;
  const formattedDate = song.created_at
    ? new Date(song.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const isCurrentlyPlaying = isVisible && currentSong?.id === song.id;

  // Petite carte de suggestion
  const SuggestionCard = ({ s }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800/60 transition-colors cursor-pointer group"
      onClick={() => playSong(s, [s, ...similar, ...moreBySame])}
    >
      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
        {s.cover_url
          ? <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-gray-600" /></div>
        }
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-3.5 h-3.5 text-white fill-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{s.title}</p>
        <p className="text-gray-500 text-xs truncate">{s.artist}</p>
      </div>
      <Link
        to={`/song/${s.id}`}
        onClick={e => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-all"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </motion.div>
  );




  return (
    <>
      <Helmet>
        <title>{`${song.title} — ${song.artist} · NovaSound TITAN LUX`}</title>
        <meta name="description" content={`Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX`} />
        <meta property="og:type"        content="music.song" />
        <meta property="og:url"         content={pageUrl} />
        <meta property="og:title"       content={`${song.title} — ${song.artist}`} />
        <meta property="og:description" content="🎵 Écoute sur NovaSound TITAN LUX" />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${song.title} — ${song.artist}`} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-36 md:pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">

          <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Retour</span>
          </button>

          {/* Layout 2 colonnes sur desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* GAUCHE — pochette + actions */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900/60 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl"
              >
                {/* Pochette */}
                <div className="relative aspect-square max-h-[380px] overflow-hidden">
                  {coverUrl ? (
                    <img src={coverUrl} alt={song.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-cyan-600/30 to-fuchsia-600/30 flex items-center justify-center">
                      <Music className="w-28 h-28 text-cyan-400/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />

                  {/* Bouton play central */}
                  <button
                    onClick={handlePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 md:bg-transparent md:opacity-0 md:hover:opacity-100 md:hover:bg-black/40 transition-all"
                  >
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className="p-5 rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 shadow-xl shadow-cyan-500/40"
                    >
                      <Play className="w-10 h-10 text-white fill-white" />
                    </motion.div>
                  </button>

                  {/* Badge genre */}
                  {song.genre && (
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-black/60 border border-white/10 text-gray-300 flex items-center gap-1.5 backdrop-blur-sm">
                        <Tag className="w-3 h-3" />
                        {song.genre}
                      </span>
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div className="p-5">
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">{song.title}</h1>

                  {artist ? (
                    <Link to={`/artist/${artist.id}`} className="flex items-center gap-2 mt-2 mb-4 group w-fit">
                      {artist.avatar_url
                        ? <img src={artist.avatar_url} alt={artist.username} className="w-7 h-7 rounded-full object-cover border border-cyan-500/30" />
                        : <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700"><User className="w-4 h-4 text-gray-500" /></div>
                      }
                      <span className="text-cyan-400 group-hover:text-cyan-300 transition-colors font-medium">{artist.username || song.artist}</span>
                    </Link>
                  ) : (
                    <p className="text-gray-400 mt-2 mb-4">{song.artist}</p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-5 mb-5 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Headphones className="w-4 h-4 text-cyan-500/60" />
                      <span>{formatPlays(song.plays_count)} écoutes</span>
                    </div>
                    {song.duration_s && (
                      <div className="flex items-center gap-1.5">
                        <Music className="w-4 h-4 text-gray-600" />
                        <span>{Math.floor(song.duration_s/60)}:{String(Math.round(song.duration_s%60)).padStart(2,'0')}</span>
                      </div>
                    )}
                    {formattedDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-gray-600" />
                        <span className="hidden sm:block">{formattedDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <LikeButton songId={song.id} initialLikes={song.likes_count || 0} />
                    <FavoriteButton songId={song.id} showLabel={true} />

                    {isAuthenticated && (
                      <button
                        onClick={() => setShowPlaylist(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-full border border-gray-700 text-gray-400 hover:border-violet-500/50 hover:text-violet-400 transition-all text-sm font-medium"
                      >
                        <ListMusic className="w-4 h-4" />
                        <span className="hidden sm:block">Playlist</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowShare(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-sm font-medium"
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden sm:block">Partager</span>
                    </button>

                    <button
                      onClick={handlePlay}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-semibold hover:opacity-90 transition-all ml-auto ${
                        isCurrentlyPlaying ? 'bg-gray-700 border border-cyan-500/40' : 'bg-gradient-to-r from-cyan-500 to-fuchsia-500'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>{isCurrentlyPlaying ? 'En lecture' : 'Écouter'}</span>
                    </button>

                    <SongActionsMenu
                      song={song}
                      onArchived={() => navigate('/')}
                      onDeleted={() => navigate('/')}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Commentaires */}
              <div className="mt-8">
                <CommentSection songId={song.id} songUploaderEmail={artistEmail} />
              </div>
            </div>

            {/* DROITE — suggestions */}
            <div className="space-y-6">

              {/* Autres sons du même artiste */}
              {moreBySame.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-cyan-400" />
                      {artist?.username || song.artist}
                    </h3>
                    {artist && (
                      <Link to={`/artist/${artist.id}`} className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors">
                        Voir tout
                      </Link>
                    )}
                  </div>
                  <div>
                    {moreBySame.map((s) => <SuggestionCard key={s.id} s={s} />)}
                  </div>
                </motion.div>
              )}

              {/* Sons similaires (même genre) */}
              {similar.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Tag className="w-4 h-4 text-fuchsia-400" />
                      {song.genre} similaires
                    </h3>
                    <Link to={`/explorer?genre=${encodeURIComponent(song.genre)}`} className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
                      Explorer
                    </Link>
                  </div>
                  <div>
                    {similar.slice(0, 5).map((s) => <SuggestionCard key={s.id} s={s} />)}
                  </div>
                </motion.div>
              )}

              {/* Info artiste mini card */}
              {artist && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Link
                    to={`/artist/${artist.id}`}
                    className="block bg-gradient-to-br from-gray-900/80 to-gray-800/40 border border-gray-700 rounded-2xl p-4 hover:border-cyan-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {artist.avatar_url
                        ? <img src={artist.avatar_url} alt={artist.username} className="w-10 h-10 rounded-full object-cover ring-2 ring-cyan-500/20" />
                        : <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"><User className="w-5 h-5 text-gray-600" /></div>
                      }
                      <div>
                        <p className="text-white font-semibold text-sm group-hover:text-cyan-400 transition-colors">{artist.username}</p>
                        <p className="text-gray-600 text-xs">Voir le profil →</p>
                      </div>
                    </div>
                    {artist.bio && <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{artist.bio}</p>}
                  </Link>
                </motion.div>
              )}
            </div>
          </div>

        </main>

        <Footer />
      </div>

      <AnimatePresence>
        {showShare && <SongShareModal song={song} onClose={() => setShowShare(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showPlaylist && (
          <AddToPlaylistModal song={song} onClose={() => setShowPlaylist(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default SongPage;
