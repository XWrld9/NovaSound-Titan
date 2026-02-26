import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Shuffle, Repeat, Music, ChevronDown, Heart, Download, Share2,
  UserPlus, UserCheck, ExternalLink, X, Maximize2,
  Copy, Check, Link2, Twitter, Facebook, MessageCircle
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LottieAnimation from '@/components/LottieAnimation';
import playAnimation from '@/animations/play-animation.json';
import { useNavigate } from 'react-router-dom';
import SongShareModal from '@/components/SongShareModal';


// ShareModal → composant réutilisable importé depuis SongShareModal
const AudioPlayer = ({ currentSong, playlist = [], onNext, onPrevious, onClose }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(70);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [isExpanded, setIsExpanded] = useState(false);
  const [playRecorded, setPlayRecorded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isExpanded ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isExpanded]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  // Refs pour Media Session (évite stale closure — goNext/goPrevious définis plus bas)
  const goNextRef     = useRef(null);
  const goPreviousRef = useRef(null);

  // ── MEDIA SESSION API — notification Android/iOS ─────────────
  // Met à jour les métadonnées (titre, artiste, pochette) dans la barre de notification
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    const artwork = [];
    if (currentSong.cover_url) {
      artwork.push(
        { src: currentSong.cover_url, sizes: '96x96',   type: 'image/jpeg' },
        { src: currentSong.cover_url, sizes: '128x128', type: 'image/jpeg' },
        { src: currentSong.cover_url, sizes: '192x192', type: 'image/jpeg' },
        { src: currentSong.cover_url, sizes: '256x256', type: 'image/jpeg' },
        { src: currentSong.cover_url, sizes: '512x512', type: 'image/jpeg' },
      );
    } else {
      artwork.push({ src: '/icon-512.png', sizes: '512x512', type: 'image/png' });
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  currentSong.title  || 'Titre inconnu',
        artist: currentSong.artist || 'Artiste inconnu',
        album:  'NovaSound TITAN LUX',
        artwork,
      });
    } catch (e) { /* navigateurs anciens */ }
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.cover_url]);

  // ── MEDIA SESSION — boutons lecture/pause/next/previous ───────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlers = {
      play:           () => { audioRef.current?.play(); setIsPlaying(true); autoPlayRef.current = true; },
      pause:          () => { audioRef.current?.pause(); setIsPlaying(false); },
      stop:           () => { audioRef.current?.pause(); setIsPlaying(false); },
      nexttrack:      () => { autoPlayRef.current = true; goNextRef.current?.(); },
      previoustrack:  () => { autoPlayRef.current = true; goPreviousRef.current?.(); },
      seekbackward:   (d) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (d.seekOffset || 10));
        }
      },
      seekforward:    (d) => {
        if (audioRef.current && audioRef.current.duration) {
          audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + (d.seekOffset || 10));
        }
      },
      seekto: (d) => {
        if (audioRef.current && d.seekTime != null) {
          audioRef.current.currentTime = d.seekTime;
        }
      },
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    }

    return () => {
      for (const action of Object.keys(handlers)) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      }
    };
  }, [playlist, shuffle, repeat]); // recalculer quand playlist/shuffle change

  // ── MEDIA SESSION — sync état playback ────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {}
  }, [isPlaying]);

  // ── MEDIA SESSION — position (seekbar dans notification) ──────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!duration || isNaN(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration:     duration,
        playbackRate: audioRef.current?.playbackRate || 1,
        position:     Math.min(currentTime, duration),
      });
    } catch {}
  }, [currentTime, duration]);

  const prevSongIdRef = useRef(null);
  const autoPlayRef   = useRef(false);

  useEffect(() => {
    if (audioRef.current && currentSong?.audio_url) {
      const isNewSong = prevSongIdRef.current !== null && prevSongIdRef.current !== currentSong.id;
      prevSongIdRef.current = currentSong.id;
      audioRef.current.src = currentSong.audio_url;
      audioRef.current.load();
      setPlayRecorded(false);
      setCurrentTime(0);
      setDuration(0);
      if (currentUser) { checkLikeStatus(); checkFollowStatus(); }
      else { setIsLiked(false); setLikeId(null); setIsFollowing(false); setFollowId(null); }

      if (isNewSong && autoPlayRef.current) {
        // Attendre que le navigateur soit prêt (canplay) avant de play
        const tryPlay = () => {
          audioRef.current?.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        };
        if (audioRef.current.readyState >= 2) {
          tryPlay();
        } else {
          audioRef.current.addEventListener('canplay', tryPlay, { once: true });
        }
      } else if (!isNewSong) {
        // Premier chargement, ne pas auto-jouer
        setIsPlaying(false);
      }
    }
  }, [currentSong?.id]);

  const checkLikeStatus = async () => {
    try {
      const { data } = await supabase.from('likes').select('id')
        .eq('user_id', currentUser.id).eq('song_id', currentSong.id).maybeSingle();
      setIsLiked(!!data); setLikeId(data?.id || null);
    } catch {}
  };

  const checkFollowStatus = async () => {
    const uid = currentSong?.uploader_id;
    if (!uid || uid === currentUser.id) return;
    try {
      const { data } = await supabase.from('follows').select('id')
        .eq('follower_id', currentUser.id).eq('following_id', uid).maybeSingle();
      setIsFollowing(!!data); setFollowId(data?.id || null);
    } catch {}
  };

  const handleLike = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    try {
      if (isLiked && likeId) {
        await supabase.from('likes').delete().eq('id', likeId);
        setIsLiked(false); setLikeId(null);
      } else {
        const { data } = await supabase.from('likes')
          .insert({ user_id: currentUser.id, song_id: currentSong.id }).select('id').single();
        setIsLiked(true); setLikeId(data?.id || null);
      }
    } catch {}
  };

  const handleFollow = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    const uid = currentSong?.uploader_id;
    if (!uid || uid === currentUser.id) return;
    try {
      if (isFollowing && followId) {
        await supabase.from('follows').delete().eq('id', followId);
        setIsFollowing(false); setFollowId(null);
      } else {
        const { data } = await supabase.from('follows')
          .insert({ follower_id: currentUser.id, following_id: uid }).select('id').single();
        setIsFollowing(true); setFollowId(data?.id || null);
      }
    } catch {}
  };

  const handleDownload = (e) => {
    e?.stopPropagation();
    if (!currentSong.audio_url) return;
    const a = document.createElement('a');
    a.href = currentSong.audio_url; a.download = currentSong.title;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleShare = (e) => {
    e?.stopPropagation();
    setShowShareModal(true);
  };

  const recordPlay = async () => {
    if (playRecorded || !currentSong?.id) return;
    setPlayRecorded(true);
    try {
      const { error } = await supabase.rpc('increment_plays', { song_id_param: currentSong.id });
      if (error) await supabase.from('songs').update({ plays_count: (currentSong.plays_count || 0) + 1 }).eq('id', currentSong.id);
    } catch {}
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (!audioRef.current || !currentSong) return;
    if (isPlaying) {
      audioRef.current.pause();
      autoPlayRef.current = false;
    } else {
      audioRef.current.play().catch(() => {});
      recordPlay();
      autoPlayRef.current = true;
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    if (!playRecorded && audioRef.current.currentTime > 10) recordPlay();
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (value) => {
    if (audioRef.current) { audioRef.current.currentTime = value[0]; setCurrentTime(value[0]); }
  };

  const handleVolumeChange = (value) => {
    setVolume(value[0]);
    if (value[0] === 0) setIsMuted(true);
    else if (isMuted) setIsMuted(false);
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    if (!isMuted) { setPrevVolume(volume); setIsMuted(true); }
    else { setIsMuted(false); if (volume === 0) setVolume(prevVolume || 70); }
  };

  // Next/Previous avec shuffle — gèrent à la fois les pages avec playlist et sans
  const goNext = () => {
    autoPlayRef.current = true;
    if (playlist.length > 1) {
      const idx = playlist.findIndex(s => s.id === currentSong?.id);
      let nextIdx;
      if (shuffle) {
        do { nextIdx = Math.floor(Math.random() * playlist.length); } while (nextIdx === idx && playlist.length > 1);
      } else {
        nextIdx = (idx + 1) % playlist.length;
      }
      if (onNext) onNext(playlist[nextIdx]);
    } else if (onNext) {
      onNext();
    }
  };

  const goPrevious = () => {
    // Si > 3s écoulées → retour début du morceau
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    autoPlayRef.current = true;
    if (playlist.length > 1) {
      const idx = playlist.findIndex(s => s.id === currentSong?.id);
      const prevIdx = (idx - 1 + playlist.length) % playlist.length;
      if (onPrevious) onPrevious(playlist[prevIdx]);
    } else if (onPrevious) {
      onPrevious();
    }
  };

  const handleEnded = () => {
    if (repeat === 'one') {
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
    } else {
      goNext();
    }
  };

  // Synchroniser les refs Media Session avec les fonctions à jour
  goNextRef.current     = goNext;
  goPreviousRef.current = goPrevious;

  const cycleRepeat = (e) => {
    e?.stopPropagation();
    const modes = ['off', 'one', 'all'];
    setRepeat(modes[(modes.indexOf(repeat) + 1) % modes.length]);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 40 ? Volume1 : Volume2;
  const showFollowButton = currentUser && currentSong?.uploader_id && currentSong.uploader_id !== currentUser.id;
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const closePlayer = (e) => {
    e?.stopPropagation();
    if (onClose) onClose();
    else window.dispatchEvent(new CustomEvent('novasound:close-player'));
  };

  if (!currentSong) return null;

  return (
    <>
      {/* ════ AUDIO TAG — TOUJOURS MONTÉ ════ */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
        webkit-playsinline="true"
        style={{ display: 'none' }}
      />

      {/* ════ MODAL DE PARTAGE ════ */}
      <AnimatePresence>
        {showShareModal && (
          <SongShareModal song={currentSong} onClose={() => setShowShareModal(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>

      {/* ════════════════════════════════════
          EXPANDED — plein écran (mobile + desktop)
          ════════════════════════════════════ */}
      {isExpanded && (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto"
          style={{
            background: 'linear-gradient(180deg, #0a0f23 0%, #030712 55%)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="absolute inset-0 opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(6,182,212,0.5) 0%, transparent 65%)' }}
          />

          {/* Header */}
          <div className="relative flex items-center justify-between px-5 pt-5 pb-2 z-10"
            style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
          >
            <button onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Réduire</span>
            </button>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">En écoute</p>
            <button onClick={(e) => { closePlayer(e); setIsExpanded(false); }}
              className="p-2 rounded-full bg-gray-800/50 border border-gray-700/40 text-gray-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Layout 2 colonnes sur desktop, 1 colonne sur mobile */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 px-6 pb-8 z-10">

            {/* Pochette */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, type: 'spring', damping: 22 }}
              className="w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10"
            >
              {currentSong.cover_url
                ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                    <Music className="w-24 h-24 text-white/50" />
                  </div>
              }
            </motion.div>

            {/* Contrôles */}
            <div className="flex flex-col gap-5 w-full max-w-sm">

              {/* Titre + artiste + actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-white text-xl sm:text-2xl font-bold leading-tight break-words">{currentSong.title}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className="text-gray-400 text-sm hover:text-white cursor-pointer transition-colors"
                      onClick={() => currentSong?.uploader_id && navigate(`/artist/${currentSong.uploader_id}`)}
                    >
                      {currentSong.artist}
                    </span>
                    {showFollowButton && (
                      <button onClick={handleFollow}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-all flex items-center gap-1 ${
                          isFollowing
                            ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10'
                            : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {isFollowing ? <><UserCheck className="w-3 h-3" />Abonné</> : <><UserPlus className="w-3 h-3" />S'abonner</>}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={handleLike}
                    className={`transition-all active:scale-75 ${isLiked ? 'text-pink-500' : 'text-gray-500 hover:text-pink-400'}`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={handleShare} className="text-gray-500 hover:text-white transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button onClick={handleDownload} className="text-gray-500 hover:text-cyan-400 transition-colors">
                    <Download className="w-5 h-5" />
                  </button>
                  {currentSong?.uploader_id && (
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/artist/${currentSong.uploader_id}`); setIsExpanded(false); }}
                      className="text-gray-500 hover:text-cyan-400 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Seek bar */}
              <div>
                <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                <div className="flex justify-between text-xs text-gray-600 mt-1.5 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex items-center justify-between">
                <button onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
                  className={`p-2 transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                >
                  <Shuffle className="w-5 h-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); goPrevious(); }}
                  className="p-2 text-gray-300 hover:text-white hover:scale-110 transition-all"
                >
                  <SkipBack className="w-7 h-7" />
                </button>
                <button onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-white text-gray-900 hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); goNext(); }}
                  className="p-2 text-gray-300 hover:text-white hover:scale-110 transition-all"
                >
                  <SkipForward className="w-7 h-7" />
                </button>
                <button onClick={cycleRepeat}
                  className={`p-2 relative transition-all ${repeat !== 'off' ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                >
                  <Repeat className="w-5 h-5" />
                  {repeat === 'one' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-cyan-400 leading-none">1</span>}
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                  <VolumeIcon className="w-5 h-5" />
                </button>
                <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="cursor-pointer flex-1" />
                <span className="text-xs text-gray-700 w-6 text-right tabular-nums">{isMuted ? 0 : volume}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════
          MINI PLAYER — barre du bas
          ════════════════════════════════════ */}
      {!isExpanded && (
        <motion.div
          key="mini"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] shadow-2xl"
          style={{
            backgroundColor: 'rgb(18 18 18 / 0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Barre de progression cliquable tout en haut */}
          <div className="w-full h-1 bg-gray-800/80 cursor-pointer group relative"
            onClick={(e) => {
              if (!duration) return;
              const r = e.currentTarget.getBoundingClientRect();
              handleSeek([(e.clientX - r.left) / r.width * duration]);
            }}
          >
            <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-75 group-hover:h-1.5 relative"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* ── MOBILE ── */}
          <div className="md:hidden">
            <div className="flex items-center justify-between px-3 pt-1 pb-0">
              <button onClick={() => setIsExpanded(true)} className="text-gray-600 hover:text-gray-400 transition-colors p-1">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={closePlayer} className="text-gray-600 hover:text-gray-400 transition-colors p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 px-3 pb-2 pt-0.5">
              <div className="flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden cursor-pointer active:opacity-70 transition-opacity"
                onClick={() => setIsExpanded(true)}
              >
                {currentSong.cover_url
                  ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold flex items-center gap-1 overflow-hidden">
                  <span className="truncate cursor-pointer" onClick={() => setIsExpanded(true)}>{currentSong.title}</span>
                  {isPlaying && <LottieAnimation animationData={playAnimation} style={{ width: 16, height: 16 }} loop autoplay className="flex-shrink-0" />}
                  {currentSong?.id && (
                    <a
                      href={`/#/song/${currentSong.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex-shrink-0 text-gray-600 hover:text-cyan-400 transition-colors ml-1"
                      title="Voir la page du son"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-gray-500 text-xs truncate cursor-pointer" onClick={() => setIsExpanded(true)}>{currentSong.artist}</div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={handleLike} className={`p-1.5 ${isLiked ? 'text-pink-500' : 'text-gray-600'}`}>
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); goPrevious(); }} className="p-1.5 text-gray-500">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white text-gray-900 flex items-center justify-center shadow-md active:scale-90 transition-transform"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="p-1.5 text-gray-500">
                  <SkipForward className="w-5 h-5" />
                </button>
                <button onClick={toggleMute} className="p-1.5 text-gray-600">
                  <VolumeIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Durée mobile */}
            <div className="flex justify-between text-[10px] text-gray-700 px-4 pb-1.5 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* ── DESKTOP SPOTIFY 3 COLONNES ── */}
          <div className="hidden md:grid md:grid-cols-3 items-center px-4 py-3 gap-4">

            {/* Gauche : pochette + infos + actions */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden shadow-lg cursor-pointer group"
                onClick={() => setIsExpanded(true)}
              >
                {currentSong.cover_url
                  ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                      <Music className="w-7 h-7 text-white" />
                    </div>
                }
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span
                    className="text-white text-sm font-semibold truncate cursor-pointer hover:underline"
                    onClick={() => setIsExpanded(true)}
                    title={currentSong.title}
                  >
                    {currentSong.title}
                  </span>
                  {isPlaying && <LottieAnimation animationData={playAnimation} style={{ width: 18, height: 18 }} loop autoplay className="flex-shrink-0 opacity-80" />}
                  {currentSong?.id && (
                    <a
                      href={`/#/song/${currentSong.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex-shrink-0 text-gray-600 hover:text-cyan-400 transition-colors"
                      title="Voir la page du son & commentaires"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="text-gray-500 text-xs truncate hover:text-white cursor-pointer transition-colors"
                    onClick={() => currentSong?.uploader_id && navigate(`/artist/${currentSong.uploader_id}`)}
                  >
                    {currentSong.artist}
                  </span>
                  {showFollowButton && (
                    <button onClick={handleFollow}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-all flex items-center gap-0.5 flex-shrink-0 ${
                        isFollowing
                          ? 'border-cyan-500/50 text-cyan-400'
                          : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {isFollowing ? <><UserCheck className="w-2.5 h-2.5" />Abonné</> : <><UserPlus className="w-2.5 h-2.5" />+Suivre</>}
                    </button>
                  )}
                </div>
              </div>

              {/* Actions + croix */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={handleLike}
                  className={`p-1.5 rounded-full transition-all ${isLiked ? 'text-pink-500' : 'text-gray-700 hover:text-pink-400'}`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
                <button onClick={handleShare} className="p-1.5 rounded-full text-gray-700 hover:text-white transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={handleDownload} className="p-1.5 rounded-full text-gray-700 hover:text-cyan-400 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={closePlayer}
                  className="p-1.5 rounded-full text-gray-700 hover:text-gray-400 hover:bg-gray-800 transition-all"
                  title="Fermer le lecteur"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Centre : contrôles + seek */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-4">
                <button onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
                  className={`transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                  title="Aléatoire"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button onClick={(e) => { e.stopPropagation(); goPrevious(); }}
                  className="text-gray-400 hover:text-white hover:scale-110 transition-all"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white text-gray-900 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <button onClick={(e) => { e.stopPropagation(); goNext(); }}
                  className="text-gray-400 hover:text-white hover:scale-110 transition-all"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button onClick={cycleRepeat}
                  className={`relative transition-all ${repeat !== 'off' ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                >
                  <Repeat className="w-4 h-4" />
                  {repeat === 'one' && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-cyan-400 leading-none">1</span>}
                </button>
              </div>

              {/* Seek desktop */}
              <div className="flex items-center gap-2 w-full max-w-xs lg:max-w-sm">
                <span className="text-xs text-gray-700 w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
                <div className="flex-1">
                  <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                </div>
                <span className="text-xs text-gray-700 w-8 tabular-nums">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Droite : volume */}
            <div className="flex items-center justify-end gap-2">
              <button onClick={toggleMute} className="text-gray-600 hover:text-white transition-colors flex-shrink-0">
                <VolumeIcon className="w-4 h-4" />
              </button>
              <div className="w-20 lg:w-28">
                <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="cursor-pointer" />
              </div>
              <span className="text-xs text-gray-700 w-6 tabular-nums">{isMuted ? 0 : volume}</span>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default AudioPlayer;
