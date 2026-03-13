/**
 * NativeAudioPlayer — NovaSound TITAN LUX
 *
 * Lecteur de musique local complet, style natif (Apple Music / Spotify).
 * ─ Scan auto au démarrage (Android FSA) ou chargement blobs (iOS)
 * ─ Bibliothèque : Chansons / Albums / Artistes / Playlists
 * ─ Lecteur plein écran avec artwork, barre de progression, contrôles
 * ─ Mini-player persistant
 * ─ Media Session API (contrôles écran verrouillé)
 * ─ Shuffle / Repeat / Favoris / Playlists
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Heart, MoreHorizontal, Search, Music2, ListMusic, User, Disc,
  FolderOpen, ChevronDown, ChevronUp, Plus, X, Check, Trash2,
  RefreshCw, Volume2, VolumeX, MicVocal, Clock
} from 'lucide-react';

import {
  tryAutoScan, setupMusicFolder, selectFilesIOS,
  loadSavedTracks, getPlaybackUrl, rescan,
  getPlatform, isIOS, hasFSA
} from '@/lib/nativeAudioAccess';
import { tracks as tracksDB, playlists as playlistsDB, settings } from '@/lib/localMusicDB';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const groupBy = (arr, key) => arr.reduce((acc, item) => {
  const k = item[key] || 'Inconnu';
  if (!acc[k]) acc[k] = [];
  acc[k].push(item);
  return acc;
}, {});

// ── Artwork placeholder ──────────────────────────────────────────────────────
const ArtworkPlaceholder = memo(({ size = 48, className = '' }) => (
  <div className={`bg-gradient-to-br from-cyan-900/60 to-fuchsia-900/60 flex items-center justify-center flex-shrink-0 ${className}`}
    style={{ width: size, height: size, borderRadius: size * 0.15 }}>
    <Music2 className="text-white/30" style={{ width: size * 0.4, height: size * 0.4 }} />
  </div>
));

const Artwork = memo(({ src, size = 48, className = '' }) =>
  src
    ? <img src={src} alt="" className={`object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size, borderRadius: size * 0.15 }} />
    : <ArtworkPlaceholder size={size} className={className} />
);

// ── Setup screen (premier lancement) ────────────────────────────────────────
const SetupScreen = memo(({ onSetup, isScanning, scanCount, platform }) => {
  const ios = isIOS();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center"
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-24 h-24 mb-8 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center"
      >
        <Music2 className="w-12 h-12 text-cyan-400" />
      </motion.div>

      <h1 className="text-2xl font-black text-white mb-3">
        Bibliothèque musicale
      </h1>
      <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">
        {ios
          ? 'Sélectionnez vos fichiers audio une seule fois. Ils seront mémorisés pour toutes les prochaines visites.'
          : 'Choisissez votre dossier de musique. L\'application le mémorisera et se mettra à jour automatiquement à chaque visite.'
        }
      </p>

      {isScanning ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-cyan-400 text-sm font-medium">
            {scanCount > 0 ? `${scanCount} fichiers trouvés…` : 'Scan en cours…'}
          </p>
        </div>
      ) : (
        <button
          onClick={onSetup}
          className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/25 active:scale-95 transition-transform"
        >
          <FolderOpen className="w-5 h-5" />
          {ios ? 'Choisir mes fichiers audio' : 'Choisir mon dossier de musique'}
        </button>
      )}

      {!ios && (
        <p className="text-gray-600 text-xs mt-6">
          Après cette étape, aucune action ne sera requise au prochain lancement
        </p>
      )}
    </motion.div>
  );
});

// ── Track row ────────────────────────────────────────────────────────────────
const TrackRow = memo(({ track, isActive, isPlaying, onPlay, onToggleFav }) => (
  <motion.div
    layout
    onClick={() => onPlay(track)}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors active:scale-[0.98] ${
      isActive ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/5'
    }`}
  >
    <div className="relative flex-shrink-0">
      <Artwork src={track.artwork} size={44} />
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[7px]">
          {isPlaying
            ? <div className="flex items-end gap-[2px] h-4">
                {[0,1,2].map(i => (
                  <motion.div key={i} className="w-[3px] bg-cyan-400 rounded-full"
                    animate={{ height: ['4px','14px','4px'] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            : <Play className="w-4 h-4 text-white fill-white" />
          }
        </div>
      )}
    </div>

    <div className="flex-1 min-w-0">
      <p className={`font-semibold truncate text-sm ${isActive ? 'text-cyan-400' : 'text-white'}`}>
        {track.title || track.name}
      </p>
      <p className="text-gray-500 text-xs truncate">
        {track.artist || 'Artiste inconnu'}
        {track.album ? ` · ${track.album}` : ''}
      </p>
    </div>

    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={e => { e.stopPropagation(); onToggleFav(track.id); }}
        className="p-1.5 rounded-lg"
      >
        <Heart className={`w-4 h-4 ${track.isFavorite ? 'text-red-400 fill-red-400' : 'text-gray-600'}`} />
      </button>
      <span className="text-gray-600 text-xs w-9 text-right">{fmt(track.duration)}</span>
    </div>
  </motion.div>
));

// ── Full Player ──────────────────────────────────────────────────────────────
const FullPlayer = memo(({
  track, isPlaying, currentTime, duration, volume,
  isMuted, isShuffled, repeatMode,
  onTogglePlay, onSeek, onPrev, onNext,
  onToggleShuffle, onToggleRepeat, onToggleMute, onVolumeChange,
  onToggleFav, onClose
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0d0d1a 0%, #050508 100%)' }}
    >
      {/* Fond ambiance basé sur artwork */}
      {track?.artwork && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img src={track.artwork} alt="" className="w-full h-full object-cover opacity-10 blur-3xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/80" />
        </div>
      )}

      <div className="relative flex flex-col flex-1 px-6 pt-12 pb-8 max-w-sm mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white">
            <ChevronDown className="w-6 h-6" />
          </button>
          <p className="text-white/60 text-sm font-medium">En écoute</p>
          <button className="p-2 rounded-xl text-gray-400 hover:text-white">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>

        {/* Artwork */}
        <motion.div
          className="mb-8 mx-auto"
          animate={{ scale: isPlaying ? 1 : 0.88 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          {track?.artwork
            ? <img src={track.artwork} alt=""
                className="w-64 h-64 rounded-3xl shadow-2xl shadow-black/50 mx-auto object-cover" />
            : <div className="w-64 h-64 rounded-3xl bg-gradient-to-br from-cyan-900/40 to-fuchsia-900/40 border border-white/10 flex items-center justify-center mx-auto">
                <Music2 className="w-24 h-24 text-white/20" />
              </div>
          }
        </motion.div>

        {/* Infos + Favori */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-white font-black text-xl leading-tight truncate">
              {track?.title || track?.name || 'Aucune piste'}
            </h2>
            <p className="text-gray-400 mt-1 truncate">
              {track?.artist || 'Artiste inconnu'}
            </p>
          </div>
          <button onClick={() => track && onToggleFav(track.id)}>
            <Heart className={`w-6 h-6 transition-colors ${track?.isFavorite ? 'text-red-400 fill-red-400' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div
            className="relative w-full h-1.5 bg-white/10 rounded-full cursor-pointer"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              onSeek(ratio * duration);
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md"
              style={{ left: `calc(${progress}% - 7px)` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-500 text-xs">{fmt(currentTime)}</span>
            <span className="text-gray-500 text-xs">{fmt(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onToggleShuffle} className={`p-2 ${isShuffled ? 'text-cyan-400' : 'text-gray-500'}`}>
            <Shuffle className="w-5 h-5" />
          </button>

          <button onClick={onPrev} className="p-2 text-white">
            <SkipBack className="w-7 h-7 fill-white" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          >
            {isPlaying
              ? <Pause className="w-7 h-7 text-black fill-black" />
              : <Play  className="w-7 h-7 text-black fill-black ml-1" />
            }
          </button>

          <button onClick={onNext} className="p-2 text-white">
            <SkipForward className="w-7 h-7 fill-white" />
          </button>

          <button onClick={onToggleRepeat} className={`p-2 ${repeatMode !== 'off' ? 'text-cyan-400' : 'text-gray-500'}`}>
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <button onClick={onToggleMute}>
            {isMuted ? <VolumeX className="w-4 h-4 text-gray-500" /> : <Volume2 className="w-4 h-4 text-gray-500" />}
          </button>
          <div
            className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              onVolumeChange((e.clientX - rect.left) / rect.width);
            }}
          >
            <div className="h-full bg-white/40 rounded-full" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
          </div>
          <Volume2 className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </motion.div>
  );
});

// ── Mini Player ──────────────────────────────────────────────────────────────
const MiniPlayer = memo(({ track, isPlaying, currentTime, duration, onTogglePlay, onNext, onOpen }) => (
  <motion.div
    initial={{ y: 100 }}
    animate={{ y: 0 }}
    exit={{ y: 100 }}
    onClick={onOpen}
    className="fixed bottom-16 left-3 right-3 z-40 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl cursor-pointer"
  >
    {/* Progress bar */}
    <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 rounded-t-2xl overflow-hidden">
      <div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all"
        style={{ width: `${duration > 0 ? (currentTime/duration)*100 : 0}%` }} />
    </div>

    <div className="flex items-center gap-3">
      <Artwork src={track?.artwork} size={40} />

      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{track?.title || track?.name}</p>
        <p className="text-gray-500 text-xs truncate">{track?.artist || 'Artiste inconnu'}</p>
      </div>

      <button onClick={e => { e.stopPropagation(); onTogglePlay(); }}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10">
        {isPlaying
          ? <Pause className="w-4 h-4 text-white fill-white" />
          : <Play  className="w-4 h-4 text-white fill-white ml-0.5" />
        }
      </button>

      <button onClick={e => { e.stopPropagation(); onNext(); }}
        className="w-9 h-9 flex items-center justify-center rounded-full">
        <SkipForward className="w-5 h-5 text-gray-400" />
      </button>
    </div>
  </motion.div>
));

// ═══════════════════════════════════════════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════════════════════════════════════════
const NativeAudioPlayer = () => {
  // ── State ────────────────────────────────────────────────────────────────
  const [allTracks,    setAllTracks]    = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isShuffled,   setIsShuffled]   = useState(false);
  const [repeatMode,   setRepeatMode]   = useState('off'); // off | all | one
  const [tab,          setTab]          = useState('songs'); // songs | albums | artists | playlists | favorites
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showPlayer,   setShowPlayer]   = useState(false);
  const [isScanning,   setIsScanning]   = useState(false);
  const [scanCount,    setScanCount]    = useState(0);
  const [needsSetup,   setNeedsSetup]   = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [sortBy,       setSortBy]       = useState('title'); // title | artist | album | recent
  const [playlist,     setPlaylist]     = useState([]); // queue actuelle
  const [userPlaylists,setUserPlaylists]= useState([]);
  const [expandedAlbum,setExpandedAlbum]= useState(null);
  const [expandedArtist,setExpandedArtist]= useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const audioRef      = useRef(null);
  const currentUrlRef = useRef(null); // pour révoquer l'URL précédente

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    initLibrary();
    loadUserPlaylists();
  }, []);

  const initLibrary = async () => {
    setIsLoading(true);
    try {
      // 1. Essayer le scan auto (Android/Desktop)
      const autoScanned = await tryAutoScan(count => setScanCount(count));
      if (autoScanned !== null) {
        setAllTracks(autoScanned);
        setPlaylist(autoScanned);
        setIsLoading(false);
        return;
      }

      // 2. Charger la bibliothèque sauvegardée (iOS blobs ou précédente session)
      const saved = await loadSavedTracks();
      if (saved.length > 0) {
        setAllTracks(saved);
        setPlaylist(saved);
        setIsLoading(false);
        return;
      }

      // 3. Première utilisation → setup
      setNeedsSetup(true);
    } catch (err) {
      console.error('[NativeAudioPlayer] Init:', err);
      setNeedsSetup(true);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPlaylists = async () => {
    try {
      const pls = await playlistsDB.getAll();
      setUserPlaylists(pls);
    } catch (_) {}
  };

  // ── Setup (premier lancement) ────────────────────────────────────────────
  const handleSetup = async () => {
    setIsScanning(true);
    setScanCount(0);
    try {
      let found;
      if (isIOS()) {
        found = await selectFilesIOS();
      } else {
        found = await setupMusicFolder(count => setScanCount(count));
      }
      setAllTracks(found);
      setPlaylist(found);
      setNeedsSetup(false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[NativeAudioPlayer] Setup:', err);
      }
    } finally {
      setIsScanning(false);
    }
  };

  // ── Rescan ───────────────────────────────────────────────────────────────
  const handleRescan = async () => {
    setIsScanning(true);
    setScanCount(0);
    try {
      const found = isIOS()
        ? await selectFilesIOS()
        : await rescan(count => setScanCount(count));
      if (found?.length) {
        setAllTracks(found);
        setPlaylist(found);
      }
    } catch (_) {}
    finally { setIsScanning(false); }
  };

  // ── Lecture ──────────────────────────────────────────────────────────────
  const playTrack = useCallback(async (track, queue = null) => {
    if (!track) return;

    // Révoquer l'ancienne URL blob
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }

    try {
      const url = await getPlaybackUrl(track);
      currentUrlRef.current = url;

      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }

      setCurrentTrack(track);
      setIsPlaying(true);
      if (queue) setPlaylist(queue);

      // Media Session API
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:  track.title  || track.name,
          artist: track.artist || 'Artiste inconnu',
          album:  track.album  || '',
          artwork: track.artwork
            ? [{ src: track.artwork, sizes: '256x256' }]
            : [{ src: '/icon-192.png', sizes: '192x192' }]
        });
        navigator.mediaSession.setActionHandler('play',         () => { audioRef.current?.play(); setIsPlaying(true); });
        navigator.mediaSession.setActionHandler('pause',        () => { audioRef.current?.pause(); setIsPlaying(false); });
        navigator.mediaSession.setActionHandler('nexttrack',    () => handleNext());
        navigator.mediaSession.setActionHandler('previoustrack',() => handlePrev());
      }

      // Statistiques
      await tracksDB.update(track.id, {
        playCount:  (track.playCount || 0) + 1,
        lastPlayed: Date.now()
      });
      setAllTracks(prev => prev.map(t =>
        t.id === track.id ? { ...t, playCount: (t.playCount||0)+1, lastPlayed: Date.now() } : t
      ));
    } catch (err) {
      console.error('[NativeAudioPlayer] Play:', err);
    }
  }, []);

  // handleNext / handlePrev déclarés AVANT tout useEffect qui les utilise
  const handleNext = useCallback(() => {
    if (!currentTrack || !playlist.length) return;
    let idx = playlist.findIndex(t => t.id === currentTrack.id);
    if (isShuffled) {
      idx = Math.floor(Math.random() * playlist.length);
    } else {
      idx = (idx + 1) % playlist.length;
    }
    playTrack(playlist[idx]);
  }, [currentTrack, playlist, isShuffled, playTrack]);

  const handlePrev = useCallback(() => {
    if (!currentTrack || !playlist.length) return;
    // Si > 3s → retour au début
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    let idx = playlist.findIndex(t => t.id === currentTrack.id);
    idx = idx === 0 ? playlist.length - 1 : idx - 1;
    playTrack(playlist[idx]);
  }, [currentTrack, playlist, playTrack]);

  // Media session handlers update
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('nexttrack',     () => handleNext());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrev());
  }, [handleNext, handlePrev]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else           { audioRef.current.play();  setIsPlaying(true);  }
  }, [isPlaying]);

  const handleSeek = useCallback((time) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((v) => {
    const vol = Math.max(0, Math.min(1, v));
    setVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const next = !isMuted;
    audioRef.current.muted = next;
    setIsMuted(next);
  }, [isMuted]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off');
  }, []);

  const toggleFavorite = useCallback(async (id) => {
    setAllTracks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next = { ...t, isFavorite: !t.isFavorite };
      tracksDB.update(id, { isFavorite: next.isFavorite });
      return next;
    }));
    if (currentTrack?.id === id) {
      setCurrentTrack(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : prev);
    }
  }, [currentTrack]);

  // ── Audio events ─────────────────────────────────────────────────────────
  const onTimeUpdate  = useCallback(() => setCurrentTime(audioRef.current?.currentTime || 0), []);
  const onLoadedMeta  = useCallback(() => setDuration(audioRef.current?.duration || 0), []);
  const onEnded       = useCallback(() => {
    if (repeatMode === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      handleNext();
    }
  }, [repeatMode, handleNext]);

  // ── Filtrage / tri ───────────────────────────────────────────────────────
  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let result = q
      ? allTracks.filter(t =>
          (t.title||t.name||'').toLowerCase().includes(q) ||
          (t.artist||'').toLowerCase().includes(q) ||
          (t.album||'').toLowerCase().includes(q)
        )
      : [...allTracks];

    switch (sortBy) {
      case 'title':  result.sort((a,b) => (a.title||a.name||'').localeCompare(b.title||b.name||'')); break;
      case 'artist': result.sort((a,b) => (a.artist||'').localeCompare(b.artist||'')); break;
      case 'album':  result.sort((a,b) => (a.album||'').localeCompare(b.album||'')); break;
      case 'recent': result.sort((a,b) => (b.lastPlayed||0) - (a.lastPlayed||0)); break;
    }
    return result;
  }, [allTracks, searchQuery, sortBy]);

  const albums   = useMemo(() => groupBy(allTracks.filter(t => t.album), 'album'),   [allTracks]);
  const artists  = useMemo(() => groupBy(allTracks, 'artist'),                       [allTracks]);
  const favorites= useMemo(() => allTracks.filter(t => t.isFavorite),               [allTracks]);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">Chargement de la bibliothèque…</p>
    </div>
  );

  if (needsSetup) return (
    <SetupScreen
      onSetup={handleSetup}
      isScanning={isScanning}
      scanCount={scanCount}
      platform={getPlatform()}
    />
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 pb-36">
      {/* ── Barre de recherche ── */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-xl border-b border-white/[0.06] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Titres, artistes, albums…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            )}
          </div>

          <button
            onClick={handleRescan}
            disabled={isScanning}
            className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-gray-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {[
            { id: 'songs',     icon: Music2,    label: 'Chansons' },
            { id: 'albums',    icon: Disc,      label: 'Albums'   },
            { id: 'artists',   icon: User,      label: 'Artistes' },
            { id: 'favorites', icon: Heart,     label: 'Favoris'  },
            { id: 'playlists', icon: ListMusic, label: 'Playlists'},
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === id
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats barre ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
        <span className="text-gray-600 text-xs">
          {allTracks.length} {allTracks.length === 1 ? 'chanson' : 'chansons'}
          {isScanning && <span className="text-cyan-500 ml-2">Scan… {scanCount}</span>}
        </span>

        {tab === 'songs' && (
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(v => !v)}
              className="text-gray-500 text-xs flex items-center gap-1 hover:text-gray-300"
            >
              Trier <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-full mt-1 bg-gray-900 border border-white/10 rounded-xl p-1 shadow-2xl z-50 min-w-[130px]"
                >
                  {[
                    { id: 'title',  label: 'Titre'   },
                    { id: 'artist', label: 'Artiste' },
                    { id: 'album',  label: 'Album'   },
                    { id: 'recent', label: 'Récents' },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSortBy(s.id); setShowSortMenu(false); }}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                        sortBy === s.id ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {s.label}
                      {sortBy === s.id && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Contenu par onglet ── */}
      <div className="flex-1 px-2">

        {/* SONGS */}
        {tab === 'songs' && (
          <div className="py-2">
            {filteredTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                <Music2 className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">{searchQuery ? 'Aucun résultat' : 'Bibliothèque vide'}</p>
              </div>
            ) : (
              filteredTracks.map(track => (
                <TrackRow
                  key={track.id}
                  track={track}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying && currentTrack?.id === track.id}
                  onPlay={t => playTrack(t, filteredTracks)}
                  onToggleFav={toggleFavorite}
                />
              ))
            )}
          </div>
        )}

        {/* ALBUMS */}
        {tab === 'albums' && (
          <div className="py-2">
            {Object.entries(albums).map(([album, albumTracks]) => (
              <div key={album}>
                <button
                  onClick={() => setExpandedAlbum(expandedAlbum === album ? null : album)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <Artwork src={albumTracks[0]?.artwork} size={48} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-white font-semibold truncate">{album}</p>
                    <p className="text-gray-500 text-xs">
                      {albumTracks[0]?.artist || 'Artiste inconnu'} · {albumTracks.length} titres
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${expandedAlbum === album ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {expandedAlbum === album && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-4"
                    >
                      {albumTracks.map(track => (
                        <TrackRow
                          key={track.id}
                          track={track}
                          isActive={currentTrack?.id === track.id}
                          isPlaying={isPlaying && currentTrack?.id === track.id}
                          onPlay={t => playTrack(t, albumTracks)}
                          onToggleFav={toggleFavorite}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {Object.keys(albums).length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                <Disc className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Aucun album</p>
                <p className="text-xs mt-1 text-gray-700">Les fichiers avec tags ID3 apparaîtront ici</p>
              </div>
            )}
          </div>
        )}

        {/* ARTISTS */}
        {tab === 'artists' && (
          <div className="py-2">
            {Object.entries(artists).sort(([a],[b]) => a.localeCompare(b)).map(([artist, artistTracks]) => (
              <div key={artist}>
                <button
                  onClick={() => setExpandedArtist(expandedArtist === artist ? null : artist)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-900/60 to-cyan-900/60 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white/40" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-white font-semibold truncate">{artist || 'Artiste inconnu'}</p>
                    <p className="text-gray-500 text-xs">{artistTracks.length} titres</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${expandedArtist === artist ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {expandedArtist === artist && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-4"
                    >
                      {artistTracks.map(track => (
                        <TrackRow
                          key={track.id}
                          track={track}
                          isActive={currentTrack?.id === track.id}
                          isPlaying={isPlaying && currentTrack?.id === track.id}
                          onPlay={t => playTrack(t, artistTracks)}
                          onToggleFav={toggleFavorite}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* FAVORITES */}
        {tab === 'favorites' && (
          <div className="py-2">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                <Heart className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Aucun favori</p>
                <p className="text-xs mt-1 text-gray-700">Appuyez sur ♡ pour ajouter une chanson</p>
              </div>
            ) : favorites.map(track => (
              <TrackRow
                key={track.id}
                track={track}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying && currentTrack?.id === track.id}
                onPlay={t => playTrack(t, favorites)}
                onToggleFav={toggleFavorite}
              />
            ))}
          </div>
        )}

        {/* PLAYLISTS */}
        {tab === 'playlists' && (
          <div className="py-2 px-2">
            <button
              onClick={async () => {
                const name = prompt('Nom de la playlist :');
                if (name?.trim()) {
                  await playlistsDB.create(name.trim());
                  loadUserPlaylists();
                }
              }}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors mb-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle playlist
            </button>

            {userPlaylists.map(pl => {
              const plTracks = allTracks.filter(t => pl.trackIds?.includes(t.id));
              return (
                <button
                  key={pl.id}
                  onClick={() => playTrack(plTracks[0], plTracks)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-900/60 to-fuchsia-900/60 border border-white/10 flex items-center justify-center">
                    <ListMusic className="w-5 h-5 text-white/40" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-white font-semibold truncate">{pl.name}</p>
                    <p className="text-gray-500 text-xs">{plTracks.length} titres</p>
                  </div>
                </button>
              );
            })}

            {userPlaylists.length === 0 && (
              <p className="text-center text-gray-700 text-sm py-8">Aucune playlist</p>
            )}
          </div>
        )}
      </div>

      {/* ── Audio element ── */}
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMeta}
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* ── Mini Player ── */}
      <AnimatePresence>
        {currentTrack && !showPlayer && (
          <MiniPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onTogglePlay={togglePlayPause}
            onNext={handleNext}
            onOpen={() => setShowPlayer(true)}
          />
        )}
      </AnimatePresence>

      {/* ── Full Player ── */}
      <AnimatePresence>
        {showPlayer && (
          <FullPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            isShuffled={isShuffled}
            repeatMode={repeatMode}
            onTogglePlay={togglePlayPause}
            onSeek={handleSeek}
            onPrev={handlePrev}
            onNext={handleNext}
            onToggleShuffle={() => setIsShuffled(v => !v)}
            onToggleRepeat={toggleRepeat}
            onToggleMute={toggleMute}
            onVolumeChange={handleVolumeChange}
            onToggleFav={toggleFavorite}
            onClose={() => setShowPlayer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default NativeAudioPlayer;
