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
import { formatPlays } from '@/lib/utils';
import { Music, Play, Headphones, Calendar, ArrowLeft, Share2, User } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

const SongPage = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { playSong, currentSong, isVisible } = usePlayer();

  const [song, setSong]               = useState(null);
  const [artist, setArtist]           = useState(null);
  const [artistEmail, setArtistEmail] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [showShare, setShowShare]     = useState(false);
  const [siblings, setSiblings]       = useState([]);

  // Bouton retour : fonctionne même depuis un lien partagé (pas d'historique)
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  useEffect(() => {
    if (id) fetchSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSong = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('songs').select('*').eq('id', id).single();
      if (error || !data) { navigate('/', { replace: true }); return; }
      setSong(data);

      if (data.uploader_id) {
        const { data: userData } = await supabase
          .from('users').select('id, username, avatar_url, email').eq('id', data.uploader_id).single();
        setArtist(userData || null);
        setArtistEmail(userData?.email || null);
      }

      // Charger les sons voisins pour que next/previous fonctionne depuis cette page
      const { data: siblingData } = await supabase
        .from('songs').select('*').eq('is_archived', false)
        .order('created_at', { ascending: false }).limit(50);

      if (siblingData) {
        let list = siblingData;
        if (!list.find(s => s.id === data.id)) list = [data, ...list];
        setSiblings(list);
      }
    } catch { navigate('/', { replace: true }); }
    finally { setLoading(false); }
  };

  // Lancer la lecture via le player global (persiste à la navigation)
  const handlePlay = () => {
    if (song) playSong(song, siblings);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!song) return null;

  const coverUrl = song.cover_url || null;
  const pageUrl  = `${window.location.origin}/#/song/${id}`;
  const ogImage  = coverUrl || `${window.location.origin}/background.png`;
  const formattedDate = song.created_at
    ? new Date(song.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const isCurrentlyPlaying = isVisible && currentSong?.id === song.id;

  return (
    <>
      <Helmet>
        <title>{`${song.title} — ${song.artist} · NovaSound TITAN LUX`}</title>
        <meta name="description" content={`Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX`} />
        <meta property="og:type"         content="music.song" />
        <meta property="og:url"          content={pageUrl} />
        <meta property="og:title"        content={`${song.title} — ${song.artist}`} />
        <meta property="og:description"  content="🎵 Écoute sur NovaSound TITAN LUX" />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name"    content="NovaSound TITAN LUX" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${song.title} — ${song.artist}`} />
        <meta name="twitter:description" content="🎵 Écoute sur NovaSound TITAN LUX" />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">

          {/* Retour */}
          <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Retour</span>
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/60 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl">

            {/* Pochette */}
            <div className="relative aspect-square max-h-[420px] overflow-hidden">
              {coverUrl ? (
                <img src={coverUrl} alt={song.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-600/30 to-magenta-600/30 flex items-center justify-center">
                  <Music className="w-32 h-32 text-cyan-400/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />

              {/* Bouton play — visible mobile + hover desktop */}
              <button
                onClick={handlePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 md:bg-transparent md:opacity-0 md:hover:opacity-100 md:hover:bg-black/40 transition-all"
              >
                <div className="p-5 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 shadow-xl shadow-cyan-500/40 transform hover:scale-110 transition-transform">
                  <Play className="w-10 h-10 text-white fill-current" />
                </div>
              </button>
            </div>

            {/* Infos */}
            <div className="p-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">{song.title}</h1>

              {artist ? (
                <Link to={`/artist/${artist.id}`} className="flex items-center gap-2 mt-2 mb-5 group w-fit">
                  {artist.avatar_url
                    ? <img src={artist.avatar_url} alt={artist.username} className="w-7 h-7 rounded-full object-cover border border-cyan-500/30" />
                    : <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700"><User className="w-4 h-4 text-gray-500" /></div>
                  }
                  <span className="text-cyan-400 group-hover:text-cyan-300 transition-colors font-medium">{artist.username || song.artist}</span>
                </Link>
              ) : (
                <p className="text-gray-400 mt-2 mb-5">{song.artist}</p>
              )}

              <div className="flex items-center gap-6 mb-6 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-4 h-4 text-cyan-500/70" />
                  <span>{formatPlays(song.plays_count)} écoutes</span>
                </div>
                {formattedDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <span>{formattedDate}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <LikeButton songId={song.id} initialLikes={song.likes_count || 0} />
                <FavoriteButton songId={song.id} showLabel={true} />

                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-sm font-medium"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Partager</span>
                </button>

                <button
                  onClick={handlePlay}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full text-white text-sm font-semibold hover:opacity-90 transition-all ml-auto ${
                    isCurrentlyPlaying
                      ? 'bg-gray-700 border border-cyan-500/40'
                      : 'bg-gradient-to-r from-cyan-500 to-magenta-500'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
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

          <CommentSection songId={song.id} songUploaderEmail={artistEmail} />
        </main>

        <Footer />
        {/* ⚠️ PAS d'AudioPlayer ici — il est global dans App.jsx */}
      </div>

      <AnimatePresence>
        {showShare && <SongShareModal song={song} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
    </>
  );
};

export default SongPage;
