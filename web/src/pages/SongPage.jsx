/**
 * SongPage — NovaSound TITAN LUX v5000
 * ✨ Hero immersif, waveform animée, navigation ← → clavier,
 *    mode cover plein écran, compteur commentaires live,
 *    bug fix edit commentaire inclus dans CommentSection
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LikeButton from '@/components/LikeButton';
import FavoriteButton from '@/components/FavoriteButton';
import SongShareModal from '@/components/SongShareModal';
import RepostButton from '@/components/RepostButton';
import CommentSection from '@/components/CommentSection';
import SongActionsMenu from '@/components/SongActionsMenu';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';
import MoodVote from '@/components/MoodVote';
import LyricsPanel from '@/components/LyricsPanel';
import { formatPlays } from '@/lib/utils';
import {
  Music, Play, Pause, Headphones, Calendar, ArrowLeft, Share2, User,
  ListMusic, Tag, ChevronRight, ChevronLeft, Maximize2, Minimize2,
  Radio, Zap, TrendingUp, MessageCircle,
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';
import { useAuth } from '@/contexts/AuthContext';

import { GENRE_THEMES_MAP } from '@/hooks/useGenreTheme';

// vibeColor — résout la couleur primaire d'un genre
// Priorité : GENRE_THEMES_MAP (centralisé) → fallback carte locale → cyan par défaut
const VIBE_COLORS_LOCAL = {
  'Rap':'#a855f7','HipHop':'#a855f7','Hip-Hop':'#a855f7',
  'Drill':'#94a3b8','Trap':'#ef4444',
  'R&B':'#ec4899','Soul':'#ec4899','RnB':'#ec4899',
  'Pop':'#06b6d4','Electro':'#06b6d4','Electronic':'#06b6d4','Électronique':'#00ffcc',
  'Jazz':'#f59e0b','Blues':'#f59e0b',
  'Afrobeats':'#f59e0b','Afro':'#f59e0b','Reggae':'#84cc16',
  'Rock':'#f97316','Metal':'#f97316',
  'Classique':'#e2c37b','Lofi':'#64748b','Ambient':'#64748b',
  'Amapiano':'#34d399','Dancehall':'#fbbf24','Gospel':'#f97316',
  'Coupé-Décalé':'#f472b6','Latin':'#f87171','Country':'#d4a574',
  // Genres camerounais
  'Bikutsi':'#e53e3e','Makossa':'#d4a017','Assiko':'#2f855a',
  'Ambas-Bay':'#2b6cb0','Benskin':'#6b46c1','Mbolé':'#c05621',
};
const vibeColor = (g) => {
  if (!g) return '#06b6d4';
  if (GENRE_THEMES_MAP[g]) return GENRE_THEMES_MAP[g].primary;
  return VIBE_COLORS_LOCAL[g] || '#06b6d4';
};

const StaticWaveform = ({ isPlaying, color = '#06b6d4' }) => {
  const bars = [3,5,8,6,9,4,7,5,10,6,8,4,6,9,5,7,3,8,6,7,5,9,4,8,6];
  return (
    <div className="flex items-end gap-[2px] h-8 select-none">
      {bars.map((h, i) => (
        <motion.div key={i} className="w-1 rounded-full flex-shrink-0"
          style={{ background: color, height: `${h*3}px`, opacity: 0.7 }}
          animate={isPlaying
            ? { scaleY:[1,1.4,0.8,1.2,1], opacity:[0.7,1,0.6,1,0.7] }
            : { scaleY:1 }}
          transition={{ duration:0.8, repeat:Infinity, delay:i*0.05, ease:'easeInOut' }}
        />
      ))}
    </div>
  );
};

const SuggestionCard = ({ s, onPlay }) => (
  <motion.div initial={{ opacity:0,x:8 }} animate={{ opacity:1,x:0 }}
    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
    onClick={() => onPlay(s)}>
    <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
      {s.cover_url
        ? <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-gray-600" /></div>}
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Play className="w-3.5 h-3.5 text-white fill-white" />
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-xs font-semibold truncate">{s.title}</p>
      <p className="text-gray-500 text-xs truncate">{s.artist}</p>
    </div>
    <Link to={`/song/${s.id}`} onClick={e=>e.stopPropagation()}
      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-all">
      <ChevronRight className="w-3.5 h-3.5" />
    </Link>
  </motion.div>
);

const SongPage = () => {
  const { id } = useParams();
  const location = useLocation();

  // ✅ FIX deep link notif commentaire : /song/:id#comment-:commentId
  // Avec HashRouter, l'URL est /#/song/123#comment-456
  // → window.location.hash = "#/song/123#comment-456"
  // → on extrait la partie après le dernier "#comment-"
  useEffect(() => {
    const fullHash = window.location.hash;
    const commentMarker = '#comment-';
    const markerIdx = fullHash.lastIndexOf(commentMarker);
    if (markerIdx === -1) return;
    const anchor = fullHash.slice(markerIdx + commentMarker.length);
    if (!anchor) return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById('comment-' + anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight visuel 3 secondes
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 0 2px #06b6d4, 0 0 20px rgba(6,182,212,0.3)';
        el.style.borderRadius = '12px';
        setTimeout(() => { el.style.boxShadow = ''; }, 3000);
      } else if (attempts++ < 20) {
        setTimeout(tryScroll, 300);
      }
    };
    setTimeout(tryScroll, 700);
  }, [location.hash]);
  const navigate = useNavigate();
  const { playSong, currentSong, isVisible, isPlayingGlobal } = usePlayer();
  const { audioCurrentTime } = usePlayerTime(); // ← contexte isolé pour éviter re-renders
  const { isAuthenticated } = useAuth();

  const [song,          setSong]         = useState(null);
  const [artist,        setArtist]       = useState(null);
  const [artistEmail,   setArtistEmail]  = useState(null);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState(false);
  const [showShare,     setShowShare]    = useState(false);
  const [showPlaylist,  setShowPlaylist] = useState(false);
  const [siblings,      setSiblings]     = useState([]);
  const [similar,       setSimilar]      = useState([]);
  const [moreBySame,    setMoreBySame]   = useState([]);
  const [commentCount,  setCommentCount] = useState(null);
  const [heroImmersive, setHeroImmersive]= useState(false);

  const fetchSong = useCallback(async () => {
    let mounted = true;
    try {
      setLoading(true);
      const { data, error: e } = await supabase.from('songs').select('*').eq('id', id).single();
      if (!mounted) return;
      if (e || !data || data.is_archived) { setError(true); setLoading(false); return; }
      setSong(data);
      if (data.uploader_id) {
        const { data: ud } = await supabase.from('users')
          .select('id, username, avatar_url, email, bio').eq('id', data.uploader_id).single();
        if (mounted) { setArtist(ud || null); setArtistEmail(ud?.email || null); }
      }
      const { data: sib } = await supabase.from('songs')
        .select('id,title,artist,cover_url,audio_url,genre,uploader_id,duration_s')
        .eq('is_archived', false).order('created_at',{ascending:false}).limit(60);
      if (mounted && sib) { let l=sib; if(!l.find(s=>s.id===data.id)) l=[data,...l]; setSiblings(l); }
      if (data.genre) {
        const { data: gs } = await supabase.from('songs')
          .select('id,title,artist,cover_url,audio_url,plays_count,genre')
          .eq('is_archived',false).eq('genre',data.genre).neq('id',data.id)
          .order('plays_count',{ascending:false}).limit(6);
        if (mounted) setSimilar(gs||[]);
      }
      if (data.uploader_id) {
        const { data: ss } = await supabase.from('songs')
          .select('id,title,artist,cover_url,audio_url,plays_count,genre')
          .eq('is_archived',false).eq('uploader_id',data.uploader_id).neq('id',data.id)
          .order('created_at',{ascending:false}).limit(5);
        if (mounted) setMoreBySame(ss||[]);
      }
      const { count } = await supabase.from('song_comments')
        .select('id',{count:'exact',head:true}).eq('song_id',data.id);
      if (mounted) setCommentCount(count ?? 0);
    } catch { if (mounted) setError(true); }
    finally { if (mounted) setLoading(false); }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchSong();
  }, [fetchSong]);

  useEffect(() => {
    const h = e => { const u=e.detail; if(u?.id) setSong(p=>p?.id===u.id?{...p,...u}:p); };
    window.addEventListener('novasound:song-updated', h);
    return () => window.removeEventListener('novasound:song-updated', h);
  }, []);

  useEffect(() => {
    const kh = e => {
      if (!siblings.length || !song) return;
      const idx = siblings.findIndex(s=>s.id===song.id);
      if (e.key==='ArrowRight' && idx<siblings.length-1) navigate(`/song/${siblings[idx+1].id}`);
      else if (e.key==='ArrowLeft' && idx>0) navigate(`/song/${siblings[idx-1].id}`);
      else if (e.key===' ') { e.preventDefault(); if(song) playSong(song, siblings); }
    };
    window.addEventListener('keydown', kh);
    return () => window.removeEventListener('keydown', kh);
  }, [siblings, song, navigate, playSong]);

  const isCurrentlyPlaying = isVisible && currentSong?.id === song?.id && isPlayingGlobal;
  const handlePlay = () => {
    if (!song) return;
    if (isVisible && currentSong?.id === song.id) {
      // Toggle via event (AudioPlayer gère l'audio element)
      window.dispatchEvent(new CustomEvent('novasound:toggle-play'));
    } else {
      playSong(song, siblings.length ? siblings : [song]);
    }
  };
  const handlePrevNext = dir => {
    if(!siblings.length||!song) return;
    const idx=siblings.findIndex(s=>s.id===song.id);
    const next=siblings[idx+dir];
    if(next) navigate(`/song/${next.id}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-44 md:pb-32"><Header />
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="animate-pulse flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 aspect-square bg-gray-800 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-4 pt-2">
            <div className="h-8 bg-gray-800 rounded w-3/4" />
            <div className="h-5 bg-gray-800 rounded w-1/2" />
          </div>
        </div>
      </main><Footer /></div>
  );

  if (error||!song) return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-44 md:pb-32"><Header />
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-16 flex flex-col items-center justify-center">
        <Music className="w-16 h-16 text-gray-700 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Son introuvable</h2>
        <p className="text-gray-500 mb-6">Ce morceau n'existe pas ou a été supprimé.</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={() => { setError(false); fetchSong(); }} className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-colors border border-white/10">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            Réessayer
          </button>
          <button onClick={()=>navigate('/')} className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-semibold transition-colors">
            Retour à l'accueil
          </button>
        </div>
      </main><Footer /></div>
  );

  const coverUrl = song.cover_url||null;
  const pageUrl  = `${window.location.origin}/#/song/${id}`;
  const ogImage  = coverUrl||`${window.location.origin}/background.png`;
  const color    = vibeColor(song.genre);
  const formattedDate = song.created_at
    ? new Date(song.created_at).toLocaleDateString('fr-FR',{year:'numeric',month:'long',day:'numeric'}) : null;
  const sibIdx = siblings.findIndex(s=>s.id===song.id);
  const hasPrev= sibIdx>0, hasNext=sibIdx>=0&&sibIdx<siblings.length-1;

  return (
    <>
      <Helmet>
        <title>{`${song.title} — ${song.artist} · NovaSound TITAN LUX`}</title>
        <meta name="description" content={`Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX`} />
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={`${song.title} — ${song.artist}`} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>

      {/* Mode immersif cover */}
      <AnimatePresence>
        {heroImmersive && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95"
            onClick={()=>setHeroImmersive(false)}>
            {coverUrl && <img src={coverUrl} alt={song.title} className="max-w-full max-h-full object-contain" onClick={e=>e.stopPropagation()} />}
            <button onClick={()=>setHeroImmersive(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
              <Minimize2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-44 md:pb-32">
        <Header />
        <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-6">

          {/* Top nav */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={()=>navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm">Retour</span>
            </button>
            <div className="flex items-center gap-2">
              <button onClick={()=>handlePrevNext(-1)} disabled={!hasPrev}
                className={`p-2 rounded-full border transition-all ${hasPrev?'border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400':'border-gray-800 text-gray-700 cursor-not-allowed'}`}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={()=>handlePrevNext(1)} disabled={!hasNext}
                className={`p-2 rounded-full border transition-all ${hasNext?'border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400':'border-gray-800 text-gray-700 cursor-not-allowed'}`}>
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600 ml-1 hidden sm:inline">← → naviguer</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── MAIN ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Hero */}
              <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
                className="relative rounded-3xl overflow-hidden"
                style={{boxShadow:`0 0 80px ${color}20, 0 0 0 1px ${color}15`}}>
                {/* bg blur */}
                {coverUrl && (
                  <div className="absolute inset-0 z-0">
                    <img src={coverUrl} alt="" className="w-full h-full object-cover scale-110 blur-3xl opacity-20" />
                    <div className="absolute inset-0 bg-gray-950/80" />
                  </div>
                )}
                <div className="relative z-10 p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row gap-6">
                    {/* Cover */}
                    <div className="relative flex-shrink-0 cursor-pointer group" onClick={()=>coverUrl&&setHeroImmersive(true)}>
                      <div className="w-52 h-52 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl"
                        style={{boxShadow:`0 20px 60px ${color}50`}}>
                        {coverUrl
                          ? <img src={coverUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full bg-gradient-to-br from-cyan-600/40 to-fuchsia-600/40 flex items-center justify-center">
                              <Music className="w-16 h-16 text-cyan-400/40" />
                            </div>}
                      </div>
                      {/* overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl bg-black/40">
                        {coverUrl ? <Maximize2 className="w-6 h-6 text-white" /> : <Play className="w-8 h-8 text-white fill-white" />}
                      </div>
                      {/* playing ring */}
                      {isCurrentlyPlaying && (
                        <motion.div className="absolute inset-0 rounded-2xl border-2 pointer-events-none"
                          style={{borderColor:color}}
                          animate={{boxShadow:[`0 0 0 0 ${color}60`,`0 0 0 12px ${color}00`]}}
                          transition={{duration:1.5,repeat:Infinity}} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {song.genre && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-3"
                          style={{borderColor:`${color}50`,color,background:`${color}15`}}>
                          <Tag className="w-3 h-3" />{song.genre}
                        </span>
                      )}

                      <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">{song.title}</h1>

                      {artist ? (
                        <Link to={`/artist/${artist.id}`} className="flex items-center gap-2 mt-1 mb-4 w-fit group">
                          {artist.avatar_url
                            ? <img src={artist.avatar_url} alt={artist.username} className="w-7 h-7 rounded-full object-cover" />
                            : <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div>}
                          <span className="font-semibold group-hover:opacity-80 transition-opacity" style={{color}}>{artist.username||song.artist}</span>
                        </Link>
                      ) : (
                        <p className="text-gray-400 mt-1 mb-4 font-medium">{song.artist}</p>
                      )}

                      {/* Stats */}
                      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Headphones className="w-4 h-4" style={{color}} />
                          <span className="font-bold text-white">{formatPlays(song.plays_count)}</span>
                          <span className="text-gray-600 text-xs">écoutes</span>
                        </div>
                        {commentCount!==null && (
                          <div className="flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4 text-fuchsia-400" />
                            <span className="font-bold text-white">{commentCount}</span>
                            <span className="text-gray-600 text-xs">comm.</span>
                          </div>
                        )}
                        {song.duration_s>0 && (
                          <span className="text-gray-500 text-xs flex items-center gap-1">
                            <Music className="w-3.5 h-3.5" />
                            {Math.floor(song.duration_s/60)}:{String(Math.round(song.duration_s%60)).padStart(2,'0')}
                          </span>
                        )}
                        {formattedDate && (
                          <span className="text-gray-600 text-xs flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />{formattedDate}
                          </span>
                        )}
                      </div>

                      {/* Waveform */}
                      <div className="mb-4">
                        <StaticWaveform isPlaying={isCurrentlyPlaying} color={color} />
                      </div>

                      {/* Mood votes */}
                      <MoodVote songId={song.id} />

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <motion.button onClick={handlePlay} whileTap={{scale:0.95}}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-lg"
                          style={{background:`linear-gradient(135deg, ${color}, ${color}bb)`,boxShadow:`0 8px 24px ${color}40`}}>
                          {isCurrentlyPlaying?<Pause className="w-4 h-4 fill-white"/>:<Play className="w-4 h-4 fill-white"/>}
                          <span>{isCurrentlyPlaying?'En lecture':'Écouter'}</span>
                        </motion.button>

                        <LikeButton songId={song.id} initialLikes={song.likes_count||0} />
                        <FavoriteButton songId={song.id} showLabel={true} />
                        <RepostButton song={song} size="md" showCount={true} />

                        {isAuthenticated && (
                          <button onClick={()=>setShowPlaylist(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-700 text-gray-400 hover:border-violet-500/50 hover:text-violet-400 transition-all text-sm">
                            <ListMusic className="w-4 h-4" /><span className="hidden sm:block">Playlist</span>
                          </button>
                        )}

                        <button onClick={()=>setShowShare(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-sm">
                          <Share2 className="w-4 h-4" /><span className="hidden sm:block">Partager</span>
                        </button>

                        <SongActionsMenu song={song} onArchived={()=>navigate('/')} onDeleted={()=>navigate('/')} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Paroles synchronisées v5000 */}
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.12}}>
                <LyricsPanel song={song} currentTime={currentSong?.id === song?.id ? audioCurrentTime : 0} isExpanded={false} />
              </motion.div>

              {/* Commentaires */}
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.15}}>
                <CommentSection
                  songId={song.id}
                  songUploaderEmail={artistEmail}
                  onCommentChange={n=>{ if(typeof n==='number') setCommentCount(n); }}
                />
              </motion.div>
            </div>

            {/* ── SIDEBAR ── */}
            <div className="space-y-5">
              {artist && (
                <motion.div initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} transition={{delay:0.2}}>
                  <Link to={`/artist/${artist.id}`}
                    className="block bg-gray-900/60 border border-gray-800 rounded-2xl p-5 hover:border-cyan-500/30 transition-all group">
                    <div className="flex items-center gap-3 mb-3">
                      {artist.avatar_url
                        ? <img src={artist.avatar_url} alt={artist.username} className="w-12 h-12 rounded-full object-cover ring-2 ring-cyan-500/20" />
                        : <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center"><User className="w-6 h-6 text-gray-600" /></div>}
                      <div>
                        <p className="text-white font-bold text-sm group-hover:text-cyan-400 transition-colors">{artist.username}</p>
                        <p className="text-gray-600 text-xs flex items-center gap-1"><Radio className="w-3 h-3" />Artiste NovaSound</p>
                      </div>
                    </div>
                    {artist.bio && <p className="text-gray-500 text-xs leading-relaxed line-clamp-3 mb-3">{artist.bio}</p>}
                    <span className="text-xs font-semibold flex items-center gap-1" style={{color}}>Voir le profil <ChevronRight className="w-3 h-3" /></span>
                  </Link>
                </motion.div>
              )}

              {moreBySame.length>0 && (
                <motion.div initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} transition={{delay:0.25}}
                  className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-cyan-400" />Plus de {artist?.username||song.artist}
                    </h3>
                    {artist && <Link to={`/artist/${artist.id}`} className="text-xs text-cyan-500 hover:text-cyan-400">Tout voir</Link>}
                  </div>
                  {moreBySame.map(s=><SuggestionCard key={s.id} s={s} onPlay={x=>playSong(x,[x,...moreBySame])} />)}
                </motion.div>
              )}

              {similar.length>0 && (
                <motion.div initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} transition={{delay:0.3}}
                  className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-fuchsia-400" />{song.genre} · Similaires
                    </h3>
                    <Link to={`/explorer?genre=${encodeURIComponent(song.genre)}`} className="text-xs text-fuchsia-400 hover:text-fuchsia-300">Explorer</Link>
                  </div>
                  {similar.slice(0,5).map(s=><SuggestionCard key={s.id} s={s} onPlay={x=>playSong(x,similar)} />)}
                </motion.div>
              )}

              <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900/40 border border-gray-800/40 text-xs text-gray-600">
                <Zap className="w-3 h-3 text-yellow-500/60" />
                <span>← → naviguer entre sons · Espace : play</span>
              </motion.div>
            </div>
          </div>
        </main>
        <Footer />
      </div>

      <AnimatePresence>
        {showShare && <SongShareModal song={song} onClose={()=>setShowShare(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showPlaylist && <AddToPlaylistModal song={song} onClose={()=>setShowPlaylist(false)} />}
      </AnimatePresence>
    </>
  );
};

export default SongPage;
