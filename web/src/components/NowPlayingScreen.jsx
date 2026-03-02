/**
 * NowPlayingScreen — NovaSound TITAN LUX v5000
 * Écran fullscreen immersif avec :
 * - Visualiseur canvas WebAudio (barres spectrales + cercle pulsant)
 * - Paroles en overlay
 * - File d'attente inline
 * - Like inline
 * - Geste pochette pulsante
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Link } from 'react-router-dom';
import {
  X, Heart, SkipBack, SkipForward, Play, Pause,
  List, Mic2, ChevronDown, Shuffle, Repeat, Music
} from 'lucide-react';

// ── Canvas Visualizer ───────────────────────────────────────────────
const CanvasVisualizer = ({ analyserRef, isPlaying, color }) => {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef?.current;
    if (!canvas) return;

    const ctx2d = canvas.getContext('2d');
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx2d.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx2d.clearRect(0, 0, W, H);

      if (!analyser || !isPlaying) {
        // Idle wave
        const t = Date.now() / 1000;
        ctx2d.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const y = H / 2 + Math.sin(x / 30 + t) * 6 * (0.3 + 0.7 * Math.sin(x / 80 + t * 0.7));
          x === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
        }
        ctx2d.strokeStyle = `${color}50`;
        ctx2d.lineWidth = 2;
        ctx2d.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const barCount = 56;
      const barW = W / barCount - 1.5;

      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bufferLength * 0.7);
        const val = dataArray[idx] / 255;
        const barH = val * H * 0.75 + 3;
        const hue = 180 + val * 80;
        const alpha = 0.4 + val * 0.6;
        ctx2d.fillStyle = `hsla(${hue}, 75%, 65%, ${alpha})`;
        ctx2d.beginPath();
        ctx2d.roundRect(i * (barW + 1.5), H / 2 - barH / 2, barW, barH, 3);
        ctx2d.fill();
      }

      // Cercle pulsant
      const avg = Array.from(dataArray.slice(0, 20)).reduce((a, b) => a + b, 0) / 20;
      const pulse = 0.6 + (avg / 255) * 0.5;
      const r = Math.min(W, H) * 0.06 * pulse;
      const grd = ctx2d.createRadialGradient(W/2, H/2, 0, W/2, H/2, r);
      grd.addColorStop(0, `${color}80`);
      grd.addColorStop(1, `${color}00`);
      ctx2d.fillStyle = grd;
      ctx2d.beginPath();
      ctx2d.arc(W/2, H/2, r, 0, Math.PI * 2);
      ctx2d.fill();
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [analyserRef, isPlaying, color]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-60"
      style={{ imageRendering: 'auto' }}
    />
  );
};

// ══════════════════════════════════════════════════════════════════
const NowPlayingScreen = ({
  audioRef,
  onClose,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  shuffle,
  onToggleShuffle,
  repeat,
  onToggleRepeat,
}) => {
  const { currentUser } = useAuth();
  const { currentSong, playlist, queue, audioCurrentTime } = usePlayer();

  const [showLyrics, setShowLyrics]     = useState(false);
  const [isLiked, setIsLiked]           = useState(false);
  const [likeId, setLikeId]             = useState(null);
  const [lyricsContent, setLyricsContent] = useState(null);
  const [showQueue, setShowQueue]       = useState(false);
  const analyserRef                     = useRef(null);

  const genreColors = {
    'Rap': '#a855f7', 'Trap': '#ef4444', 'R&B': '#ec4899',
    'Afrobeats': '#f59e0b', 'Hip-Hop': '#8b5cf6',
    'Électronique': '#06b6d4', 'Gospel': '#10b981',
    'Drill': '#ef4444', 'Pop': '#06b6d4',
  };
  const color = genreColors[currentSong?.genre] || '#22d3ee';

  // WebAudio setup
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio || analyserRef.current) return;
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      const src = actx.createMediaElementSource(audio);
      src.connect(analyser);
      analyser.connect(actx.destination);
      analyserRef.current = analyser;
    } catch (e) {
      console.warn('[NowPlaying] WebAudio:', e);
    }
  }, [audioRef]);

  // Like status
  useEffect(() => {
    if (!currentUser || !currentSong) return;
    supabase.from('likes').select('id')
      .eq('song_id', currentSong.id).eq('user_id', currentUser.id).maybeSingle()
      .then(({ data }) => { setIsLiked(!!data); setLikeId(data?.id || null); });
  }, [currentUser, currentSong?.id]);

  // Lyrics
  useEffect(() => {
    if (!currentSong) return;
    supabase.from('song_lyrics').select('content').eq('song_id', currentSong.id).maybeSingle()
      .then(({ data }) => setLyricsContent(data?.content || null));
  }, [currentSong?.id]);

  const toggleLike = async () => {
    if (!currentUser || !currentSong) return;
    if (isLiked && likeId) {
      await supabase.from('likes').delete().eq('id', likeId);
      setIsLiked(false); setLikeId(null);
    } else {
      const { data } = await supabase.from('likes').insert({
        song_id: currentSong.id, user_id: currentUser.id
      }).select('id').single();
      setIsLiked(true); setLikeId(data?.id);
    }
  };

  if (!currentSong) return null;

  // Upcoming songs
  const upcoming = [...(queue || []), ...(playlist || [])].slice(0, 5);

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 340, damping: 36 }}
      className="fixed inset-0 z-[300] flex flex-col overflow-hidden"
      style={{ background: '#050510' }}
    >
      {/* Fond ambiance */}
      {currentSong.cover_url && (
        <div className="absolute inset-0 opacity-25 scale-110"
          style={{ backgroundImage: `url(${currentSong.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(50px)' }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

      {/* Canvas Visualizer */}
      <CanvasVisualizer analyserRef={analyserRef} isPlaying={isPlaying} color={color} />

      {/* Contenu */}
      <div className="relative flex flex-col h-full max-w-sm mx-auto w-full px-6 pt-safe">

        {/* Top bar */}
        <div className="flex items-center justify-between pt-5 pb-4 flex-shrink-0">
          <button onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">
            <ChevronDown className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">En lecture</p>
            {currentSong.genre && (
              <p className="text-[11px] font-bold mt-0.5" style={{ color }}>{currentSong.genre}</p>
            )}
          </div>
          <button onClick={() => setShowQueue(!showQueue)}
            className={`p-2 rounded-full transition-all ${showQueue ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}>
            <List className="w-5 h-5" />
          </button>
        </div>

        {/* Pochette */}
        <div className="flex-1 flex items-center justify-center py-2 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div key={currentSong.id}
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: isPlaying ? [1, 1.02, 1] : 1, opacity: 1 }}
              exit={{ scale: 0.82, opacity: 0 }}
              transition={{ duration: isPlaying ? 2 : 0.4, repeat: isPlaying ? Infinity : 0, ease: 'easeInOut' }}
              className="w-full max-w-[260px] aspect-square rounded-3xl overflow-hidden"
              style={{ boxShadow: `0 0 80px ${color}50, 0 24px 60px rgba(0,0,0,0.8)` }}
            >
              {currentSong.cover_url
                ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${color}25, #111)` }}>
                    <Music className="w-20 h-20 opacity-20" style={{ color }} />
                  </div>
              }
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Titre + like */}
        <div className="flex items-center gap-4 mb-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p key={currentSong.title}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="text-white text-xl font-black truncate">{currentSong.title}
              </motion.p>
            </AnimatePresence>
            <Link to={`/artist/${currentSong.uploader_id}`} onClick={onClose}
              className="text-gray-400 text-sm hover:text-white transition-colors">{currentSong.artist}
            </Link>
          </div>
          <motion.button onClick={toggleLike} whileTap={{ scale: 1.5 }} className="p-1.5 flex-shrink-0">
            <Heart className={`w-7 h-7 transition-all ${isLiked ? 'fill-current text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-gray-500'}`} />
          </motion.button>
        </div>

        {/* Options secondaires */}
        <div className="flex items-center justify-around mb-5 flex-shrink-0">
          <button onClick={onToggleShuffle}
            className={`flex flex-col items-center gap-1 text-xs transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}>
            <Shuffle className="w-5 h-5" />
            <span>Aléat.</span>
          </button>
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            disabled={!lyricsContent}
            className={`flex flex-col items-center gap-1 text-xs transition-all ${showLyrics ? 'text-fuchsia-400' : lyricsContent ? 'text-gray-400 hover:text-white' : 'text-gray-700 cursor-not-allowed'}`}
          >
            <Mic2 className="w-5 h-5" />
            <span>Paroles</span>
          </button>
          <button onClick={onToggleRepeat}
            className={`flex flex-col items-center gap-1 text-xs transition-all ${repeat !== 'off' ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}>
            <Repeat className="w-5 h-5" />
            <span>{repeat === 'one' ? '1×' : 'Répéter'}</span>
          </button>
        </div>

        {/* Contrôles */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <motion.button whileTap={{ scale: 0.85 }} onClick={onPrev}
            className="p-3 text-gray-300 hover:text-white transition-colors">
            <SkipBack className="w-9 h-9 fill-current" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onTogglePlay}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${color}, #a855f7)`, boxShadow: `0 0 50px ${color}50` }}
          >
            {isPlaying
              ? <Pause className="w-9 h-9 text-white fill-current" />
              : <Play className="w-9 h-9 text-white fill-current ml-1" />
            }
          </motion.button>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onNext}
            className="p-3 text-gray-300 hover:text-white transition-colors">
            <SkipForward className="w-9 h-9 fill-current" />
          </motion.button>
        </div>

        {/* File d'attente */}
        <AnimatePresence>
          {showQueue && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-5 flex-shrink-0">
              <div className="bg-white/5 rounded-2xl p-3 max-h-40 overflow-y-auto">
                <p className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-widest">Suivants</p>
                {upcoming.length === 0
                  ? <p className="text-gray-600 text-xs text-center py-2">File vide</p>
                  : upcoming.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-1.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                        {s.cover_url ? <img src={s.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-700 flex items-center justify-center"><Music className="w-3 h-3 text-gray-500" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{s.title}</p>
                        <p className="text-gray-500 text-[10px] truncate">{s.artist}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Safe area bottom */}
        <div className="pb-8 flex-shrink-0" />
      </div>

      {/* Paroles overlay — LyricsPanel v5000 avec sync LRC */}
      <AnimatePresence>
        {showLyrics && lyricsContent && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute inset-x-0 bottom-0 top-20 bg-black/92 backdrop-blur-2xl rounded-t-3xl p-6 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-fuchsia-400" />
                <span className="text-sm font-bold text-white">Paroles</span>
              </div>
              <button onClick={() => setShowLyrics(false)} className="p-1.5 rounded-full bg-white/10 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-center pb-10">
              {lyricsContent.split('\n').map((line, i) => (
                <p key={i} className={line ? 'text-white text-base leading-relaxed' : 'py-1'}>{line || '\u00A0'}</p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NowPlayingScreen;
