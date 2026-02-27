import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Shuffle, Repeat, Music, ChevronDown, Heart, Download, Share2,
  UserPlus, UserCheck, ExternalLink, X, Maximize2, Minimize2,
  ListMusic, Moon, Trash2, Gauge, Radio, Plus, Calendar,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import LottieAnimation from '@/components/LottieAnimation';
import playAnimation from '@/animations/play-animation.json';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import WaveformVisualizer from '@/components/WaveformVisualizer';
import SongShareModal from '@/components/SongShareModal';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const tryNativeFullscreen = async (element) => {
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (element?.requestFullscreen)       { await element.requestFullscreen();       return true; }
      if (element?.webkitRequestFullscreen) { await element.webkitRequestFullscreen(); return true; }
    } else {
      if (document.exitFullscreen)          { await document.exitFullscreen();          return true; }
      if (document.webkitExitFullscreen)    { await document.webkitExitFullscreen();    return true; }
    }
  } catch {}
  return false;
};

const fmtTime = (s) => {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const fmtSleep = (s) => {
  if (s === null) return '';
  if (s >= 60) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2,'0')}`;
  return `${s}s`;
};

// ── Persistance volume ────────────────────────────────────────────────────────
const VOLUME_KEY = 'novasound_volume';
const MUTED_KEY  = 'novasound_muted';
const savedVolume = () => { try { const v = localStorage.getItem(VOLUME_KEY); return v !== null ? Number(v) : 70; } catch { return 70; } };
const savedMuted  = () => { try { return localStorage.getItem(MUTED_KEY) === '1'; } catch { return false; } };

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

// ── Composant principal ───────────────────────────────────────────────────────
const AudioPlayer = ({ currentSong, playlist = [], onNext, onPrevious, onClose }) => {
  const { currentUser } = useAuth();
  const genreTheme = useGenreTheme(currentSong?.genre);
  const navigate = useNavigate();
  const toast = useToast();
  const audioRef = useRef(null);

  // Queue & Sleep timer depuis PlayerContext
  const {
    queue, addToQueue, removeFromQueue, clearQueue,
    sleepTimer, setSleepTimer, clearSleepTimer,
    radioMode, radioLoading, toggleRadio,
  } = usePlayer();

  const [isPlaying,      setIsPlaying]      = useState(false);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [volume,         setVolume]         = useState(savedVolume);
  const [isMuted,        setIsMuted]        = useState(savedMuted);
  const [prevVolume,     setPrevVolume]     = useState(savedVolume);
  const [shuffle,        setShuffle]        = useState(false);
  const [repeat,         setRepeat]         = useState('off'); // off | one | all
  const [playbackSpeed,  setPlaybackSpeed]  = useState(1);
  const [showSpeedMenu,  setShowSpeedMenu]  = useState(false);
  const [isExpanded,     setIsExpanded]     = useState(false);
  const [isCoverMode,    setIsCoverMode]    = useState(false);
  const [isNativeFS,     setIsNativeFS]     = useState(false);
  const [playRecorded,   setPlayRecorded]   = useState(false);
  const [isLiked,        setIsLiked]        = useState(false);
  const [likeId,         setLikeId]         = useState(null);
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [followId,       setFollowId]       = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [blurBg,         setBlurBg]         = useState('');
  const [showQueue,          setShowQueue]          = useState(false);
  const [showSleepMenu,      setShowSleepMenu]      = useState(false);
  const [showAddToPlaylist,  setShowAddToPlaylist]  = useState(false);
  const [showMonthlySongs,   setShowMonthlySongs]   = useState(false);
  const [monthlySongs,       setMonthlySongs]       = useState([]);
  const [loadingMonthly,     setLoadingMonthly]     = useState(false);

  // Swipe-to-close (mini player, mobile)
  const swipeStartY   = useRef(null);
  const swipeStartX   = useRef(null);

  const expandedRef   = useRef(null);
  const goNextRef     = useRef(null);
  const goPreviousRef = useRef(null);
  const autoPlayRef   = useRef(false);
  const prevSongIdRef = useRef(null);
  // Ref vers toggleImmersive pour éviter les stale closures dans les useEffect clavier
  const toggleImmersiveRef = useRef(null);

  // ── Sleep timer end → pause ─────────────────────────────────────
  useEffect(() => {
    const handler = () => { audioRef.current?.pause(); setIsPlaying(false); };
    window.addEventListener('novasound:sleep-end', handler);
    return () => window.removeEventListener('novasound:sleep-end', handler);
  }, []);

  // ── Raccourcis clavier — actifs en mode expanded/plein écran ────
  useEffect(() => {
    const onKey = (e) => {
      // Ne pas intercepter si focus sur un input/textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (!isExpanded) return;
      switch (e.code) {
        case 'ArrowRight': case 'MediaTrackNext':
          e.preventDefault(); autoPlayRef.current = true; goNextRef.current?.(); break;
        case 'ArrowLeft': case 'MediaTrackPrevious':
          e.preventDefault(); autoPlayRef.current = true; goPreviousRef.current?.(); break;
        case 'Space': case 'KeyK':
          e.preventDefault();
          if (audioRef.current) {
            if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play().catch(() => {}); }
          }
          break;
        case 'Escape':
          if (isCoverMode || isNativeFS) toggleImmersiveRef.current?.();
          else { setIsExpanded(false); setIsCoverMode(false); setShowQueue(false); setShowSpeedMenu(false); }
          break;
        case 'KeyM':
          e.preventDefault(); toggleMute();  break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExpanded, isPlaying, isCoverMode, isNativeFS]);

  // ── Scroll lock ─────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isExpanded ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isExpanded]);

  // ── Fond flou depuis pochette ───────────────────────────────────
  useEffect(() => {
    if (!currentSong?.cover_url) { setBlurBg(''); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 80; c.height = 80;
        c.getContext('2d').drawImage(img, 0, 0, 80, 80);
        setBlurBg(c.toDataURL('image/jpeg', 0.6));
      } catch { setBlurBg(currentSong.cover_url); }
    };
    img.onerror = () => setBlurBg('');
    img.src = currentSong.cover_url;
  }, [currentSong?.id, currentSong?.cover_url]);

  // ── Fullscreen API ──────────────────────────────────────────────
  useEffect(() => {
    const onFSChange = () => {
      const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsNativeFS(inFS);
      if (!inFS) setIsCoverMode(false);
    };
    document.addEventListener('fullscreenchange',       onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange',       onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, []);

  const toggleImmersive = useCallback(async () => {
    if (!isExpanded) return;
    if (isCoverMode || isNativeFS) {
      setIsCoverMode(false);
      if (isNativeFS) {
        try { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) await document.webkitExitFullscreen(); } catch {}
      }
    } else {
      setIsCoverMode(true);
      if (!isIOS()) { const el = expandedRef.current || document.documentElement; await tryNativeFullscreen(el); }
    }
  }, [isExpanded, isCoverMode, isNativeFS]);
  toggleImmersiveRef.current = toggleImmersive;

  // ── Chargement des sons du mois ───────────────────────────────
  const fetchMonthlySongs = useCallback(async () => {
    if (loadingMonthly) return;
    setLoadingMonthly(true);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { data } = await supabase
        .from('songs')
        .select('id, title, artist, cover_url, genre, plays_count')
        .eq('is_archived', false)
        .eq('is_deleted', false)
        .gte('created_at', firstDay)
        .lte('created_at', lastDay)
        .order('plays_count', { ascending: false })
        .limit(30);
      setMonthlySongs(data || []);
    } catch (e) { console.error(e); }
    setLoadingMonthly(false);
  }, [loadingMonthly]);

  const openMonthlySongs = useCallback(() => {
    setShowMonthlySongs(true);
    fetchMonthlySongs();
  }, [fetchMonthlySongs]);

  // ── Volume + persistence localStorage ─────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume / 100;
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
  }, [volume, isMuted]);

  useEffect(() => {
    try { localStorage.setItem(MUTED_KEY, isMuted ? '1' : '0'); } catch {}
  }, [isMuted]);

  // ── Vitesse de lecture ─────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // ── Loop HTML5 (iOS/Android natif) ─────────────────────────────
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.loop = (repeat === 'one');
  }, [repeat]);

  // ── Media Session metadata ──────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;
    const artwork = currentSong.cover_url
      ? [96, 128, 192, 256, 512].map(s => ({ src: currentSong.cover_url, sizes: `${s}x${s}`, type: 'image/jpeg' }))
      : [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }];
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: currentSong.title || 'Titre inconnu', artist: currentSong.artist || 'Artiste inconnu', album: 'NovaSound TITAN LUX', artwork }); } catch {}
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.cover_url]);

  // ── Media Session actions ───────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      play:          () => { audioRef.current?.play(); setIsPlaying(true); autoPlayRef.current = true; },
      pause:         () => { audioRef.current?.pause(); setIsPlaying(false); },
      stop:          () => { audioRef.current?.pause(); setIsPlaying(false); },
      nexttrack:     () => { autoPlayRef.current = true; goNextRef.current?.(); },
      previoustrack: () => { autoPlayRef.current = true; goPreviousRef.current?.(); },
      seekbackward:  (d) => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (d.seekOffset || 10)); },
      seekforward:   (d) => { if (audioRef.current && audioRef.current.duration) audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + (d.seekOffset || 10)); },
      seekto:        (d) => { if (audioRef.current && d.seekTime != null) audioRef.current.currentTime = d.seekTime; },
    };
    for (const [action, handler] of Object.entries(handlers)) { try { navigator.mediaSession.setActionHandler(action, handler); } catch {} }
    return () => { for (const action of Object.keys(handlers)) { try { navigator.mediaSession.setActionHandler(action, null); } catch {} } };
  }, [playlist, shuffle, repeat]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'; } catch {}
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!duration || isNaN(duration)) return;
    try { navigator.mediaSession.setPositionState({ duration, playbackRate: audioRef.current?.playbackRate || 1, position: Math.min(currentTime, duration) }); } catch {}
  }, [currentTime, duration]);

  // ── Chargement nouveau son ──────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current || !currentSong?.audio_url) return;
    const isNewSong = prevSongIdRef.current !== null && prevSongIdRef.current !== currentSong.id;
    prevSongIdRef.current = currentSong.id;
    audioRef.current.src  = currentSong.audio_url;
    audioRef.current.loop = (repeat === 'one');
    audioRef.current.playbackRate = playbackSpeed;
    audioRef.current.load();
    setPlayRecorded(false); setCurrentTime(0); setDuration(0);
    if (currentUser) { checkLikeStatus(); checkFollowStatus(); }
    else { setIsLiked(false); setLikeId(null); setIsFollowing(false); setFollowId(null); }
    if (isNewSong && autoPlayRef.current) {
      const tryPlay = () => { audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); };
      if (audioRef.current.readyState >= 2) tryPlay();
      else audioRef.current.addEventListener('canplay', tryPlay, { once: true });
    } else if (!isNewSong) { setIsPlaying(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id]);

  const checkLikeStatus = async () => {
    try { const { data } = await supabase.from('likes').select('id').eq('user_id', currentUser.id).eq('song_id', currentSong.id).maybeSingle(); setIsLiked(!!data); setLikeId(data?.id || null); } catch {}
  };
  const checkFollowStatus = async () => {
    const uid = currentSong?.uploader_id;
    if (!uid || uid === currentUser?.id) return;
    try { const { data } = await supabase.from('follows').select('id').eq('follower_id', currentUser.id).eq('following_id', uid).maybeSingle(); setIsFollowing(!!data); setFollowId(data?.id || null); } catch {}
  };

  const handleLike = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    try {
      if (isLiked && likeId) { await supabase.from('likes').delete().eq('id', likeId); setIsLiked(false); setLikeId(null); }
      else { const { data } = await supabase.from('likes').insert({ user_id: currentUser.id, song_id: currentSong.id }).select('id').single(); setIsLiked(true); setLikeId(data?.id || null); }
    } catch {}
  };

  const handleFollow = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    const uid = currentSong?.uploader_id;
    if (!uid || uid === currentUser.id) return;
    try {
      if (isFollowing && followId) { await supabase.from('follows').delete().eq('id', followId); setIsFollowing(false); setFollowId(null); }
      else { const { data } = await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: uid }).select('id').single(); setIsFollowing(true); setFollowId(data?.id || null); }
    } catch {}
  };

  const handleDownload = (e) => {
    e?.stopPropagation();
    if (!currentSong.audio_url) return;
    const a = document.createElement('a'); a.href = currentSong.audio_url; a.download = currentSong.title;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const recordPlay = async () => {
    if (playRecorded || !currentSong?.id) return;
    setPlayRecorded(true);
    try { const { error } = await supabase.rpc('increment_plays', { song_id_param: currentSong.id }); if (error) await supabase.from('songs').update({ plays_count: (currentSong.plays_count || 0) + 1 }).eq('id', currentSong.id); } catch {}
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (!audioRef.current || !currentSong) return;
    if (isPlaying) { audioRef.current.pause(); autoPlayRef.current = false; }
    else { audioRef.current.play().catch(() => {}); recordPlay(); autoPlayRef.current = true; }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    if (!playRecorded && audioRef.current.currentTime > 10) recordPlay();
  };

  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
  const handleSeek = (value) => { if (audioRef.current) { audioRef.current.currentTime = value[0]; setCurrentTime(value[0]); } };
  const handleVolumeChange = (value) => { setVolume(value[0]); if (value[0] === 0) setIsMuted(true); else if (isMuted) setIsMuted(false); };
  const toggleMute = (e) => { e?.stopPropagation(); if (!isMuted) { setPrevVolume(volume); setIsMuted(true); } else { setIsMuted(false); if (volume === 0) setVolume(prevVolume || 70); } };

  const goNext = useCallback(() => {
    autoPlayRef.current = true;
    if (playlist.length > 1) {
      const idx = playlist.findIndex(s => s.id === currentSong?.id);
      let nextIdx;
      if (shuffle) { do { nextIdx = Math.floor(Math.random() * playlist.length); } while (nextIdx === idx && playlist.length > 1); }
      else { nextIdx = (idx + 1) % playlist.length; }
      if (onNext) onNext(playlist[nextIdx]);
    } else if (onNext) onNext();
  }, [playlist, currentSong?.id, shuffle, onNext]);

  const goPrevious = useCallback(() => {
    if (currentTime > 3 && audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0); return; }
    autoPlayRef.current = true;
    if (playlist.length > 1) {
      const idx = playlist.findIndex(s => s.id === currentSong?.id);
      if (onPrevious) onPrevious(playlist[(idx - 1 + playlist.length) % playlist.length]);
    } else if (onPrevious) onPrevious();
  }, [playlist, currentSong?.id, currentTime, onPrevious]);

  const handleEnded = useCallback(() => {
    if (repeat === 'one') { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } }
    else { goNext(); }
  }, [repeat, goNext]);

  goNextRef.current     = goNext;
  goPreviousRef.current = goPrevious;

  const cycleRepeat = (e) => { e?.stopPropagation(); const modes = ['off', 'one', 'all']; setRepeat(modes[(modes.indexOf(repeat) + 1) % modes.length]); };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 40 ? Volume1 : Volume2;
  const showFollowButton = currentUser && currentSong?.uploader_id && currentSong.uploader_id !== currentUser.id;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  const closePlayer = (e) => {
    e?.stopPropagation();
    setIsCoverMode(false);
    if (isNativeFS) { try { document.exitFullscreen?.(); } catch {} try { document.webkitExitFullscreen?.(); } catch {} }
    if (onClose) onClose(); else window.dispatchEvent(new CustomEvent('novasound:close-player'));
  };

  // ── Swipe-to-close mini player ──────────────────────────────────
  const handleTouchStart = (e) => {
    swipeStartY.current = e.touches[0].clientY;
    swipeStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (swipeStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    const dx = Math.abs(e.changedTouches[0].clientX - swipeStartX.current);
    if (dy > 60 && dx < 80) { closePlayer(); }
    swipeStartY.current = null; swipeStartX.current = null;
  };

  if (!currentSong) return null;

  const immersiveTitle = isIOS()
    ? (isCoverMode ? 'Quitter la vue couverture' : 'Vue couverture')
    : (isCoverMode || isNativeFS ? 'Quitter le plein écran' : 'Plein écran');

  // Fond dynamique selon le genre du son en lecture
  const genreGlowColor = genreTheme.glow;
  const expandedBg = isCoverMode && blurBg
    ? { background: `linear-gradient(rgba(0,0,0,0.60),rgba(0,0,0,0.80)), url("${blurBg}") center/cover no-repeat` }
    : {
        background: `radial-gradient(ellipse at 30% 0%, ${genreGlowColor} 0%, transparent 60%), linear-gradient(180deg, #0a0f23 0%, #030712 55%)`,
        transition: 'background 0.8s ease',
      };

  // ── Sleep timer display ─────────────────────────────────────────
  const sleepOptions = [5, 10, 15, 20, 30, 45, 60];

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        loop={repeat === 'one'}
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        style={{ display: 'none' }}
      />

      <AnimatePresence>
        {showShareModal && <SongShareModal song={currentSong} onClose={() => setShowShareModal(false)} />}
      </AnimatePresence>

      <AnimatePresence>

        {/* ═══ EXPANDED ═══ */}
        {isExpanded && (
          <motion.div
            key="expanded"
            ref={expandedRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ ...expandedBg, paddingBottom: 'env(safe-area-inset-bottom, 0px)', transition: 'background 0.5s ease' }}
            onClick={() => { setShowSleepMenu(false); setShowSpeedMenu(false); }}
          >
            {!isCoverMode && (
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% -10%, ${genreTheme.glow.replace('0.35', '0.55')} 0%, transparent 65%)`, transition: 'background 0.8s ease' }} />
            )}

            {/* HEADER */}
            <div className="relative flex items-center justify-between px-5 pb-2 z-10 flex-shrink-0"
              style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}>
              <button onClick={() => { setIsExpanded(false); setIsCoverMode(false); setShowQueue(false); }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors">
                <ChevronDown className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">Réduire</span>
              </button>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">En écoute</p>
              <div className="flex items-center gap-1.5">
                {/* Bouton Radio */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRadio();
                    toast.info(radioMode ? 'Mode Radio désactivé' : 'Mode Radio activé — lecture infinie 📻', { duration: 2500 });
                  }}
                  className={`p-2 rounded-full border transition-all relative ${radioMode ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-black/30 border-white/10 text-gray-400 hover:text-white'}`}
                  title={radioMode ? 'Mode Radio activé — cliquer pour désactiver' : 'Activer le mode Radio (lecture infinie)'}
                >
                  {radioLoading
                    ? <div className="w-4 h-4 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 animate-spin" />
                    : <Radio className="w-4 h-4" />
                  }
                  {radioMode && !radioLoading && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </button>

                {/* Sleep timer */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSleepMenu(v => !v); setShowQueue(false); }}
                    className={`p-2 rounded-full border transition-all relative ${sleepTimer !== null ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-black/30 border-white/10 text-gray-400 hover:text-white'}`}
                    title="Minuteur de sommeil"
                  >
                    <Moon className="w-4 h-4" />
                    {sleepTimer !== null && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-amber-500 text-black rounded-full px-1 min-w-[18px] text-center leading-[18px]">
                        {fmtSleep(sleepTimer)}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {showSleepMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-11 z-50 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-2 w-44"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider px-2 mb-1.5">Arrêter dans…</p>
                        {sleepOptions.map(m => (
                          <button key={m}
                            onClick={() => { setSleepTimer(m); setShowSleepMenu(false); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors ${sleepTimer !== null && sleepTimer <= m * 60 && sleepTimer > (m - 1) * 60 ? 'bg-amber-500/20 text-amber-300' : 'text-gray-300 hover:bg-white/8 hover:text-white'}`}
                          >{m} min</button>
                        ))}
                        {sleepTimer !== null && (
                          <button onClick={() => { clearSleepTimer(); setShowSleepMenu(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border-t border-white/8 mt-1 pt-2">
                            Annuler le timer
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {/* Queue */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowQueue(v => !v); setShowSleepMenu(false); }}
                  className={`p-2 rounded-full border transition-all relative ${showQueue ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-black/30 border-white/10 text-gray-400 hover:text-white'}`}
                  title="File d'attente"
                >
                  <ListMusic className="w-4 h-4" />
                  {queue.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-cyan-500 text-black rounded-full px-1 min-w-[18px] text-center leading-[18px] pointer-events-none">
                      {queue.length}
                    </span>
                  )}
                </button>
                {/* Fullscreen */}
                <button onClick={toggleImmersive}
                  className="p-2 rounded-full bg-black/30 border border-white/10 text-gray-400 hover:text-white transition-all"
                  title={immersiveTitle}>
                  {isCoverMode || isNativeFS ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={(e) => { closePlayer(e); setIsExpanded(false); }}
                  className="p-2 rounded-full bg-black/30 border border-white/10 text-gray-400 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CONTENU */}
            <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 px-5 pb-4 md:pb-8 z-10 overflow-y-auto">
              {/* Pochette */}
              <motion.div
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', damping: 22 }}
                className={`flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-500 ${isCoverMode ? 'w-72 h-72 sm:w-80 sm:h-80 md:w-[22rem] md:h-[22rem]' : 'w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80'}`}
              >
                {currentSong.cover_url
                  ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center"><Music className="w-24 h-24 text-white/50" /></div>
                }
              </motion.div>

              {/* Controles */}
              <div className="flex flex-col gap-4 w-full max-w-sm">
                {/* Titre + artiste + actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-white text-xl sm:text-2xl font-bold leading-tight break-words drop-shadow-lg">{currentSong.title}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-gray-300 text-sm hover:text-white cursor-pointer transition-colors"
                        onClick={() => currentSong?.uploader_id && navigate(`/artist/${currentSong.uploader_id}`)}>
                        {currentSong.artist}
                      </span>
                      {/* Genre badge */}
                      {currentSong.genre && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                          {currentSong.genre}
                        </span>
                      )}
                      {showFollowButton && (
                        <button onClick={handleFollow}
                          className={`px-2 py-0.5 text-xs rounded-full border transition-all flex items-center gap-1 ${isFollowing ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10' : 'border-white/20 text-gray-400 hover:border-white/40 hover:text-white'}`}>
                          {isFollowing ? <><UserCheck className="w-3 h-3" />Abonné</> : <><UserPlus className="w-3 h-3" />S'abonner</>}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleLike} className={`transition-all active:scale-75 ${isLiked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'}`}>
                      <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }} className="text-gray-400 hover:text-white transition-colors">
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button onClick={handleDownload} className="text-gray-400 hover:text-cyan-400 transition-colors">
                      <Download className="w-5 h-5" />
                    </button>
                    {/* Ajouter à la file */}
                    <button onClick={() => addToQueue(currentSong)} className="text-gray-400 hover:text-cyan-400 transition-colors" title="Remettre en file">
                      <ListMusic className="w-4 h-4" />
                    </button>
                    {currentSong?.uploader_id && (
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/artist/${currentSong.uploader_id}`); setIsExpanded(false); setIsCoverMode(false); }}
                        className="text-gray-400 hover:text-cyan-400 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Waveform Visualizer */}
                <WaveformVisualizer
                  isPlaying={isPlaying}
                  barCount={36}
                  color={genreTheme.primary}
                  height={28}
                  className="w-full opacity-70"
                />

                {/* Seek bar */}
                <div>
                  <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1.5 tabular-nums">
                    <span>{fmtTime(currentTime)}</span>
                    <span className="text-gray-600">{duration > 0 ? `-${fmtTime(duration - currentTime)}` : fmtTime(duration)}</span>
                  </div>
                </div>

                {/* Transport */}
                <div className="flex items-center justify-between">
                  <button onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
                    className={`p-2 transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-500 hover:text-white'}`} title="Aléatoire">
                    <Shuffle className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); autoPlayRef.current = true; goPreviousRef.current?.(); }}
                    className="p-2 text-gray-300 hover:text-white hover:scale-110 active:scale-90 transition-all"
                    title="Précédent (←)">
                    <SkipBack className="w-7 h-7" />
                  </button>
                  <button onClick={togglePlay}
                    className="w-14 h-14 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${genreTheme.primary}, ${genreTheme.secondary})`,
                      boxShadow: `0 4px 24px ${genreTheme.glow}`,
                    }}>
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); autoPlayRef.current = true; goNextRef.current?.(); }}
                    className="p-2 text-gray-300 hover:text-white hover:scale-110 active:scale-90 transition-all"
                    title="Suivant (→)">
                    <SkipForward className="w-7 h-7" />
                  </button>
                  <button onClick={cycleRepeat}
                    className={`p-2 relative transition-all ${repeat !== 'off' ? 'text-cyan-400' : 'text-gray-500 hover:text-white'}`}
                    title={repeat === 'off' ? 'Répétition off' : repeat === 'one' ? 'Répéter ce son' : 'Répéter tout'}>
                    <Repeat className="w-5 h-5" />
                    {repeat === 'one' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-cyan-400 leading-none">1</span>}
                    {repeat === 'all' && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 border border-black/20" />}
                  </button>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-3">
                  <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                    <VolumeIcon className="w-5 h-5" />
                  </button>
                  <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="cursor-pointer flex-1" />
                  <span className="text-xs text-gray-500 w-6 text-right tabular-nums">{isMuted ? 0 : volume}</span>
                </div>

                {/* Vitesse de lecture */}
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(v => !v); setShowSleepMenu(false); setShowQueue(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${playbackSpeed !== 1 ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'}`}
                      title="Vitesse de lecture"
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      {playbackSpeed}×
                    </button>
                    <AnimatePresence>
                      {showSpeedMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 bottom-10 z-50 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-2 w-36"
                          onClick={e => e.stopPropagation()}
                        >
                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider px-2 mb-1.5">Vitesse</p>
                          {SPEED_OPTIONS.map(s => (
                            <button key={s}
                              onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors flex items-center justify-between ${playbackSpeed === s ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-gray-300 hover:bg-white/8 hover:text-white'}`}
                            >
                              <span>{s}×</span>
                              {s === 1 && <span className="text-[10px] text-gray-600">Normal</span>}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {currentSong?.id && (
                    <a href={`/#/song/${currentSong.id}`}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-cyan-400 transition-colors px-2 py-1 rounded-full hover:bg-white/5"
                      onClick={e => e.stopPropagation()}
                      title="Page du son"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Page du son</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── PANNEAU QUEUE (slide from bottom) ── */}
            <AnimatePresence>
              {showQueue && (
                <>
                  {/* Overlay flou derrière la playlist */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', background: 'rgba(3,7,18,0.55)' }}
                  />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 32, stiffness: 300 }}
                  className="absolute inset-x-0 bottom-0 z-20 bg-gray-950/98 border-t border-white/10 flex flex-col"
                  style={{ maxHeight: '55%', borderRadius: '20px 20px 0 0' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-4 h-4 text-cyan-400" />
                      <span className="text-white font-bold text-sm">File d'attente</span>
                      <span className="text-xs text-gray-500 bg-white/8 px-1.5 py-0.5 rounded-full">{queue.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Bouton Sons du mois */}
                      <button
                        onClick={() => { setShowQueue(false); openMonthlySongs(); }}
                        className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-2.5 py-1.5 rounded-full border border-cyan-500/20 hover:bg-cyan-500/10"
                        title="Sons publiés ce mois">
                        <Calendar className="w-3 h-3 flex-shrink-0" /><span>Ce mois</span>
                      </button>
                      {/* Bouton Ajouter à une playlist */}
                      {currentSong && currentUser && (
                        <button
                          onClick={() => { setShowQueue(false); setShowAddToPlaylist(true); }}
                          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors px-2.5 py-1.5 rounded-full border border-purple-500/20 hover:bg-purple-500/10"
                          title="Ajouter à une playlist">
                          <Plus className="w-3 h-3 flex-shrink-0" /><span>Playlist</span>
                        </button>
                      )}
                      {queue.length > 0 && (
                        <button onClick={clearQueue}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-full border border-red-500/20 hover:bg-red-500/10 min-w-[60px]">
                          <Trash2 className="w-3 h-3 flex-shrink-0" /><span>Vider</span>
                        </button>
                      )}
                      <button onClick={() => setShowQueue(false)} className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/8 ml-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 py-2">
                    {queue.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                        <ListMusic className="w-12 h-12 text-gray-700 mb-3" />
                        <p className="text-gray-500 text-sm font-medium">File vide</p>
                        <p className="text-gray-600 text-xs mt-1">Appuie sur ⊕ depuis une carte son pour ajouter ici</p>
                      </div>
                    ) : (
                      queue.map((s, i) => (
                        <div key={`${s.id}-${i}`}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.04] group transition-colors">
                          <span className="text-xs text-gray-600 w-4 text-right flex-shrink-0">{i + 1}</span>
                          {s.cover_url
                            ? <img src={s.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow-lg" />
                            : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-gray-600" /></div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{s.title}</p>
                            <p className="text-gray-500 text-xs truncate">{s.artist}</p>
                          </div>
                          <button onClick={() => removeFromQueue(i)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-400 transition-all rounded-lg hover:bg-red-500/10"
                            title="Retirer de la file">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
                </>
              )}
            </AnimatePresence>

          </motion.div>
        )}

        {/* ═══ MINI PLAYER ═══ */}
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
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Indicateur swipe */}
            <div className="flex justify-center pt-1.5 pb-0 md:hidden">
              <div className="w-8 h-1 rounded-full bg-white/15" />
            </div>

            {/* Barre de progression */}
            <div className="w-full h-1 bg-gray-800/80 cursor-pointer group relative"
              onClick={(e) => {
                if (!duration) return;
                const r = e.currentTarget.getBoundingClientRect();
                handleSeek([(e.clientX - r.left) / r.width * duration]);
              }}>
              <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-75 group-hover:h-1.5"
                style={{ width: `${progress}%` }} />
            </div>

            {/* MOBILE */}
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
                  onClick={() => setIsExpanded(true)}>
                  {currentSong.cover_url
                    ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center"><Music className="w-5 h-5 text-white" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-semibold flex items-center gap-1 overflow-hidden">
                    <span className="truncate cursor-pointer" onClick={() => setIsExpanded(true)}>{currentSong.title}</span>
                    {isPlaying && <LottieAnimation animationData={playAnimation} style={{ width: 16, height: 16 }} loop autoplay className="flex-shrink-0" />}
                    {currentSong?.id && (
                      <a href={`/#/song/${currentSong.id}`} onClick={e => e.stopPropagation()}
                        className="flex-shrink-0 text-gray-600 hover:text-cyan-400 transition-colors ml-1" title="Voir la page du son">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-gray-500 text-xs truncate cursor-pointer flex items-center gap-1" onClick={() => setIsExpanded(true)}>
                    {currentSong.artist}
                    {sleepTimer !== null && (
                      <span className="text-amber-400 text-[9px] font-bold ml-1">🌙 {fmtSleep(sleepTimer)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={handleLike} className={`p-1.5 ${isLiked ? 'text-pink-500' : 'text-gray-600'}`}>
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); goPrevious(); }} className="p-1.5 text-gray-500">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button onClick={togglePlay}
                    className="w-9 h-9 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform text-white"
                    style={{ background: `linear-gradient(135deg, ${genreTheme.primary}, ${genreTheme.secondary})` }}>
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
              <div className="flex justify-between text-[10px] text-gray-700 px-4 pb-1.5 tabular-nums">
                <span>{fmtTime(currentTime)}</span>
                <span>{fmtTime(duration)}</span>
              </div>
            </div>

            {/* DESKTOP */}
            <div className="hidden md:grid md:grid-cols-3 items-center px-4 py-3 gap-4">
              {/* Gauche */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden shadow-lg cursor-pointer group"
                  onClick={() => setIsExpanded(true)}>
                  {currentSong.cover_url
                    ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center"><Music className="w-7 h-7 text-white" /></div>
                  }
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-white text-sm font-semibold truncate cursor-pointer hover:underline"
                      onClick={() => setIsExpanded(true)} title={currentSong.title}>{currentSong.title}</span>
                    {isPlaying && <LottieAnimation animationData={playAnimation} style={{ width: 18, height: 18 }} loop autoplay className="flex-shrink-0 opacity-80" />}
                    {currentSong?.id && (
                      <a href={`/#/song/${currentSong.id}`} onClick={e => e.stopPropagation()}
                        className="flex-shrink-0 text-gray-600 hover:text-cyan-400 transition-colors" title="Page du son">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-gray-500 text-xs truncate hover:text-white cursor-pointer transition-colors"
                      onClick={() => currentSong?.uploader_id && navigate(`/artist/${currentSong.uploader_id}`)}>
                      {currentSong.artist}
                    </span>
                    {currentSong.genre && (
                      <span className="text-[9px] px-1.5 py-px rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">{currentSong.genre}</span>
                    )}
                    {sleepTimer !== null && (
                      <span className="text-[9px] text-amber-400 font-bold">🌙 {fmtSleep(sleepTimer)}</span>
                    )}
                    {showFollowButton && (
                      <button onClick={handleFollow}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-all flex items-center gap-0.5 flex-shrink-0 ${isFollowing ? 'border-cyan-500/50 text-cyan-400' : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-300'}`}>
                        {isFollowing ? <><UserCheck className="w-2.5 h-2.5" />Abonné</> : <><UserPlus className="w-2.5 h-2.5" />+Suivre</>}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={handleLike} className={`p-1.5 rounded-full transition-all ${isLiked ? 'text-pink-500' : 'text-gray-700 hover:text-pink-400'}`}>
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }} className="p-1.5 rounded-full text-gray-700 hover:text-white transition-colors">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button onClick={handleDownload} className="p-1.5 rounded-full text-gray-700 hover:text-cyan-400 transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={closePlayer} className="p-1.5 rounded-full text-gray-700 hover:text-gray-400 hover:bg-gray-800 transition-all" title="Fermer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Centre */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-4">
                  <button onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
                    className={`transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`} title="Aléatoire">
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); goPrevious(); }} className="text-gray-400 hover:text-white hover:scale-110 transition-all">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button onClick={togglePlay} className="w-9 h-9 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center text-white"
                    style={{ background: `linear-gradient(135deg, ${genreTheme.primary}, ${genreTheme.secondary})`, boxShadow: `0 2px 12px ${genreTheme.glow}` }}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="text-gray-400 hover:text-white hover:scale-110 transition-all">
                    <SkipForward className="w-5 h-5" />
                  </button>
                  <button onClick={cycleRepeat}
                    className={`relative transition-all ${repeat !== 'off' ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}>
                    <Repeat className="w-4 h-4" />
                    {repeat === 'one' && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-cyan-400 leading-none">1</span>}
                    {repeat === 'all' && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full max-w-xs lg:max-w-sm">
                  <span className="text-xs text-gray-700 w-8 text-right tabular-nums">{fmtTime(currentTime)}</span>
                  <div className="flex-1"><Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" /></div>
                  <span className="text-xs text-gray-700 w-8 tabular-nums">{fmtTime(duration)}</span>
                </div>
              </div>

              {/* Droite */}
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

      {/* ── Modal Ajouter à une playlist ── */}
      <AnimatePresence>
        {showAddToPlaylist && currentSong && (
          <AddToPlaylistModal
            song={currentSong}
            onClose={() => setShowAddToPlaylist(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Modal Sons du mois ── */}
      <AnimatePresence>
        {showMonthlySongs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowMonthlySongs(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full sm:max-w-md bg-gray-950 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
              style={{ maxHeight: '70vh' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <span className="text-white font-bold text-base">Sons du mois</span>
                  <span className="text-xs text-gray-500 bg-white/8 px-1.5 py-0.5 rounded-full">
                    {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <button onClick={() => setShowMonthlySongs(false)} className="p-2 text-gray-500 hover:text-white transition-colors rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 68px)' }}>
                {loadingMonthly ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                  </div>
                ) : monthlySongs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <Music className="w-12 h-12 text-gray-700 mb-3" />
                    <p className="text-gray-500 text-sm font-medium">Aucun son ce mois-ci</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {monthlySongs.map((s) => (
                      <button
                        key={s.id}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                        onClick={() => {
                          setShowMonthlySongs(false);
                          navigate(`/song/${s.id}`);
                        }}
                      >
                        {s.cover_url
                          ? <img src={s.cover_url} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0 shadow-lg" />
                          : <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0"><Music className="w-5 h-5 text-gray-600" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{s.title}</p>
                          <p className="text-gray-500 text-xs truncate">{s.artist}</p>
                        </div>
                        {s.genre && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 flex-shrink-0">{s.genre}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AudioPlayer;
