/**
 * NowPlayingScreen — NovaSound TITAN LUX v8600
 *
 * v8600 :
 *  - Player exclusif pour fichiers locaux (is_local=true) ET disponible sur PC
 *  - Barre de seek complète avec currentTime / duration
 *  - Contrôle du volume avec slider
 *  - Animation de vague canvas (IdleWave)
 *  - Actions réseau (Like, Share, Repost, Follow) masquées pour fichiers locaux
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Link } from 'react-router-dom';
import {
  X, Heart, SkipBack, SkipForward, Play, Pause,
  List, Mic2, ChevronDown, Shuffle, Repeat, Music,
  Share2, Repeat2, Download, UserPlus, UserCheck,
  Volume2, VolumeX, Volume1,
} from 'lucide-react';
import SongShareModal from '@/components/SongShareModal';

const fmtTime = (s) => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const IdleWave = ({ isPlaying, color }) => {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    let frame = 0;
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      frame++;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      const t = frame / 60, amp = isPlaying ? 10 : 5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const y = H/2 + Math.sin(x/28+t*1.8)*amp + Math.sin(x/55+t*0.9)*amp*0.6;
        x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.strokeStyle = `${color}55`; ctx.lineWidth = 2; ctx.stroke();
      if (isPlaying) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const y = H/2 + Math.sin(x/35+t*2.2+1.2)*amp*0.7 + Math.sin(x/70+t*1.1)*amp*0.4;
          x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
        }
        ctx.strokeStyle = `${color}30`; ctx.lineWidth = 1.5; ctx.stroke();
      }
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, [isPlaying, color]);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-70 pointer-events-none" />;
};

// Barre de seek custom (compatible mobile et PC)
const SeekBar = ({ currentTime, duration, onSeek, color }) => {
  const trackRef  = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState(0);

  const getPct = (clientX) => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - left) / width));
  };

  const startDrag = useCallback((clientX) => {
    setDragging(true);
    setDragPct(getPct(clientX));
  }, []);

  const moveDrag = useCallback((clientX) => {
    if (!dragging) return;
    setDragPct(getPct(clientX));
  }, [dragging]);

  const endDrag = useCallback((clientX) => {
    if (!dragging) return;
    setDragging(false);
    const pct = getPct(clientX);
    setDragPct(pct);
    if (onSeek && duration > 0) onSeek(pct * duration);
  }, [dragging, onSeek, duration]);

  useEffect(() => {
    if (!dragging) return;
    const mm = (e) => moveDrag(e.clientX);
    const mu = (e) => endDrag(e.clientX);
    const tm = (e) => moveDrag(e.touches[0].clientX);
    const tu = (e) => endDrag(e.changedTouches[0].clientX);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup',   mu);
    window.addEventListener('touchmove', tm, { passive: true });
    window.addEventListener('touchend',  tu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup',   mu);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend',  tu);
    };
  }, [dragging, moveDrag, endDrag]);

  const pct = dragging ? dragPct : (duration > 0 ? currentTime / duration : 0);
  const displayed = pct * (duration || 0);

  return (
    <div className="w-full select-none">
      <div
        ref={trackRef}
        className="relative w-full h-1.5 rounded-full cursor-pointer group"
        style={{ background: 'rgba(255,255,255,0.12)' }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onClick={(e) => { if (!dragging && onSeek && duration > 0) onSeek(getPct(e.clientX) * duration); }}
      >
        <div className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: color }} />
        <div className="absolute top-1/2 w-4 h-4 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${pct * 100}%`, transform: 'translate(-50%, -50%)', boxShadow: `0 0 8px ${color}` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1.5 tabular-nums">
        <span>{fmtTime(displayed)}</span>
        <span>{duration > 0 ? `-${fmtTime(duration - displayed)}` : '--:--'}</span>
      </div>
    </div>
  );
};

const GENRE_COLORS = {
  'Rap':'#a855f7','Trap':'#ef4444','R&B':'#ec4899','Afrobeats':'#f59e0b',
  'Hip-Hop':'#8b5cf6','Électronique':'#06b6d4','Gospel':'#10b981',
  'Drill':'#ef4444','Pop':'#06b6d4','Zouk':'#f43f5e','Afropop':'#f59e0b','Soul':'#ec4899',
};

const NowPlayingScreen = ({
  onClose,
  isPlaying, isBuffering = false,
  onTogglePlay, onNext, onPrev,
  shuffle, onToggleShuffle,
  repeat,  onToggleRepeat,
  currentTime = 0, duration = 0,
  onSeek,
  volume = 70, isMuted = false,
  onVolumeChange, onToggleMute,
}) => {
  const { currentUser } = useAuth();
  const { currentSong, playlist, queue } = usePlayer();

  const [showQueue,  setShowQueue]  = useState(false);
  const [showShare,  setShowShare]  = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsContent, setLyricsContent] = useState(null);

  const [isLiked,    setIsLiked]    = useState(false);
  const [likeId,     setLikeId]     = useState(null);
  const [likeBurst,  setLikeBurst]  = useState(false);
  const [likeLoading,setLikeLoading]= useState(false);
  const [hasReposted,   setHasReposted]   = useState(false);
  const [repostBurst,   setRepostBurst]   = useState(false);
  const [repostLoading, setRepostLoading] = useState(false);
  const [isFollowing,   setIsFollowing]   = useState(false);
  const [followId,      setFollowId]      = useState(null);
  const [followLoading, setFollowLoading] = useState(false);

  const color = (currentSong?.genre && GENRE_COLORS[currentSong.genre]) || '#22d3ee';

  const withRetry = useCallback(async (fn, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try { return await fn(); }
      catch (err) { if (i === retries) throw err; await new Promise(r => setTimeout(r, 600*(i+1))); }
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !currentSong || currentSong.is_local) {
      setIsLiked(false); setLikeId(null); setHasReposted(false);
      setIsFollowing(false); setFollowId(null); return;
    }
    const sid = currentSong.id, uid = currentSong.uploader_id;
    withRetry(() => supabase.from('likes').select('id').eq('song_id',sid).eq('user_id',currentUser.id).maybeSingle())
      .then(({data}) => { setIsLiked(!!data); setLikeId(data?.id||null); }).catch(()=>{});
    withRetry(() => supabase.from('song_reposts').select('id').eq('song_id',sid).eq('user_id',currentUser.id).maybeSingle())
      .then(({data}) => setHasReposted(!!data)).catch(()=>{});
    if (uid && uid !== currentUser.id) {
      withRetry(() => supabase.from('follows').select('id').eq('follower_id',currentUser.id).eq('following_id',uid).maybeSingle())
        .then(({data}) => { setIsFollowing(!!data); setFollowId(data?.id||null); }).catch(()=>{});
    }
  }, [currentUser, currentSong?.id, withRetry]);

  useEffect(() => {
    if (!currentSong || currentSong.is_local) { setLyricsContent(null); return; }
    supabase.from('song_lyrics').select('content').eq('song_id',currentSong.id).maybeSingle()
      .then(({data}) => setLyricsContent(data?.content||null)).catch(()=>{});
  }, [currentSong?.id]);

  const toggleLike = async () => {
    if (!currentUser || !currentSong || likeLoading) return;
    const was = isLiked; setIsLiked(!was); setLikeLoading(true);
    if (!was) { setLikeBurst(true); setTimeout(()=>setLikeBurst(false), 900); }
    try {
      if (was && likeId) { await withRetry(()=>supabase.from('likes').delete().eq('id',likeId)); setLikeId(null); }
      else { const {data} = await withRetry(()=>supabase.from('likes').insert({song_id:currentSong.id,user_id:currentUser.id}).select('id').single()); setLikeId(data?.id||null); }
    } catch { setIsLiked(was); } finally { setLikeLoading(false); }
  };

  const toggleRepost = async () => {
    if (!currentUser || !currentSong || repostLoading) return;
    const was = hasReposted; setHasReposted(!was); setRepostLoading(true);
    if (!was) { setRepostBurst(true); setTimeout(()=>setRepostBurst(false), 600); }
    try {
      if (was) await withRetry(()=>supabase.from('song_reposts').delete().eq('song_id',currentSong.id).eq('user_id',currentUser.id));
      else await withRetry(()=>supabase.from('song_reposts').insert({song_id:currentSong.id,user_id:currentUser.id}));
    } catch { setHasReposted(was); } finally { setRepostLoading(false); }
  };

  const toggleFollow = async () => {
    if (!currentUser || !currentSong?.uploader_id || followLoading) return;
    if (currentSong.uploader_id === currentUser.id) return;
    const was = isFollowing; setIsFollowing(!was); setFollowLoading(true);
    try {
      if (was && followId) { await withRetry(()=>supabase.from('follows').delete().eq('id',followId)); setFollowId(null); }
      else { const {data} = await withRetry(()=>supabase.from('follows').insert({follower_id:currentUser.id,following_id:currentSong.uploader_id}).select('id').single()); setFollowId(data?.id||null); }
    } catch { setIsFollowing(was); } finally { setFollowLoading(false); }
  };

  const handleDownload = () => {
    if (!currentSong?.audio_url) return;
    const a = document.createElement('a');
    a.href = currentSong.audio_url;
    a.download = (currentSong.title||'audio') + (currentSong.is_local ? '' : '.m4a');
    a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (!currentSong) return null;

  const upcoming = [...(queue||[]),...(playlist||[])].slice(0,6);
  const showFollowBtn = currentUser && currentSong?.uploader_id && currentSong.uploader_id !== currentUser.id;
  const isLocal = !!currentSong.is_local;
  const VolumeIcon = (isMuted || volume === 0) ? VolumeX : volume < 40 ? Volume1 : Volume2;

  return (
    <>
    <motion.div
      initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
      transition={{ type:'spring', stiffness:340, damping:36 }}
      className="fixed inset-0 z-[300] flex flex-col overflow-hidden"
      style={{ background:'#050510' }}
    >
      {currentSong.cover_url && (
        <div className="absolute inset-0 opacity-20 scale-110 pointer-events-none"
          style={{ backgroundImage:`url(${currentSong.cover_url})`, backgroundSize:'cover', backgroundPosition:'center', filter:'blur(55px)' }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85 pointer-events-none" />
      <IdleWave isPlaying={isPlaying} color={color} />

      <div className="relative flex flex-col h-full max-w-sm mx-auto w-full px-6 overflow-y-auto"
        style={{ paddingTop:'env(safe-area-inset-top, 16px)', paddingBottom:'env(safe-area-inset-bottom, 24px)' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between pt-5 pb-3 flex-shrink-0">
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90">
            <ChevronDown className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
              {isLocal ? '📁 Lecture locale' : 'En lecture'}
            </p>
            {currentSong.genre && <p className="text-[11px] font-bold mt-0.5" style={{color}}>{currentSong.genre}</p>}
          </div>
          <button onClick={()=>{setShowQueue(!showQueue);setShowLyrics(false);}}
            className={`p-2 rounded-full transition-all active:scale-90 ${showQueue?'bg-white/20 text-white':'bg-white/10 text-gray-400 hover:text-white'}`}>
            <List className="w-5 h-5" />
          </button>
        </div>

        {/* Pochette */}
        <div className="flex-shrink-0 flex items-center justify-center py-2">
          <AnimatePresence mode="wait">
            <motion.div key={currentSong.id}
              initial={{ scale:0.82, opacity:0 }}
              animate={{ scale: isPlaying ? [1,1.025,1] : 0.96, opacity:1 }}
              exit={{ scale:0.82, opacity:0 }}
              transition={{ duration:isPlaying?2.5:0.4, repeat:isPlaying?Infinity:0, ease:'easeInOut' }}
              className="w-full max-w-[240px] aspect-square rounded-3xl overflow-hidden"
              style={{ boxShadow:`0 0 80px ${color}45, 0 24px 60px rgba(0,0,0,0.8)` }}
            >
              {currentSong.cover_url
                ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center" style={{background:`linear-gradient(135deg,${color}25,#111)`}}>
                    <Music className="w-20 h-20 opacity-20" style={{color}} />
                  </div>
              }
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Titre + artiste */}
        <div className="mb-4 flex-shrink-0">
          <AnimatePresence mode="wait">
            <motion.p key={currentSong.title}
              initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
              className="text-white text-xl font-black truncate">{currentSong.title}</motion.p>
          </AnimatePresence>
          {isLocal
            ? <p className="text-gray-400 text-sm mt-0.5">{currentSong.artist}</p>
            : <Link to={`/artist/${currentSong.uploader_id}`} onClick={onClose}
                className="text-gray-400 text-sm hover:text-white transition-colors mt-0.5 block">{currentSong.artist}</Link>
          }
        </div>

        {/* ── SEEK BAR ── */}
        <div className="mb-5 flex-shrink-0">
          <SeekBar currentTime={currentTime} duration={duration} onSeek={onSeek} color={color} />
        </div>

        {/* Actions (online only) */}
        {!isLocal && (
          <div className="flex items-center justify-between mb-4 flex-shrink-0 px-1">
            <motion.button onClick={toggleLike} whileTap={{scale:0.85}}
              disabled={likeLoading||!currentUser}
              className="relative flex flex-col items-center gap-0.5 disabled:opacity-40">
              <AnimatePresence>
                {likeBurst && <motion.span key="lb" initial={{scale:0.5,opacity:1}} animate={{scale:2.4,opacity:0}} exit={{opacity:0}} transition={{duration:0.6}}
                  className="absolute inset-0 rounded-full bg-red-400/20 pointer-events-none" />}
              </AnimatePresence>
              <Heart className={`w-5 h-5 ${isLiked?'fill-current text-red-500':' text-gray-500 hover:text-gray-300'}`} />
              <span className="text-[9px] text-gray-500">Like</span>
            </motion.button>

            <motion.button onClick={()=>setShowShare(true)} whileTap={{scale:0.85}} className="flex flex-col items-center gap-0.5">
              <Share2 className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition-colors" />
              <span className="text-[9px] text-gray-500">Partager</span>
            </motion.button>

            <motion.button onClick={toggleRepost} whileTap={{scale:0.85}}
              disabled={repostLoading||!currentUser}
              className="relative flex flex-col items-center gap-0.5 disabled:opacity-40">
              <AnimatePresence>
                {repostBurst && <motion.span key="rb" initial={{scale:0.5,opacity:1}} animate={{scale:2.2,opacity:0}} exit={{opacity:0}} transition={{duration:0.5}}
                  className="absolute inset-0 rounded-full bg-green-400/20 pointer-events-none" />}
              </AnimatePresence>
              <Repeat2 className={`w-5 h-5 transition-colors ${hasReposted?'text-green-400':'text-gray-500 hover:text-green-400'}`} />
              <span className="text-[9px] text-gray-500">Repost</span>
            </motion.button>

            <motion.button onClick={handleDownload} whileTap={{scale:0.85}} className="flex flex-col items-center gap-0.5">
              <Download className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition-colors" />
              <span className="text-[9px] text-gray-500">Sauver</span>
            </motion.button>

            {showFollowBtn ? (
              <motion.button onClick={toggleFollow} whileTap={{scale:0.85}} disabled={followLoading} className="flex flex-col items-center gap-0.5 disabled:opacity-40">
                {isFollowing ? <UserCheck className="w-5 h-5 text-cyan-400" /> : <UserPlus className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition-colors" />}
                <span className="text-[9px] text-gray-500">{isFollowing?'Abonné':'Suivre'}</span>
              </motion.button>
            ) : (
              <button onClick={()=>{setShowLyrics(!showLyrics);setShowQueue(false);}} disabled={!lyricsContent}
                className={`flex flex-col items-center gap-0.5 transition-all active:scale-90 ${showLyrics?'text-fuchsia-400':lyricsContent?'text-gray-400 hover:text-white':'text-gray-700 cursor-not-allowed opacity-40'}`}>
                <Mic2 className="w-5 h-5" />
                <span className="text-[9px]">Paroles</span>
              </button>
            )}
          </div>
        )}

        {/* Actions locales */}
        {isLocal && (
          <div className="flex items-center justify-center gap-8 mb-4 flex-shrink-0">
            <motion.button onClick={handleDownload} whileTap={{scale:0.85}} className="flex flex-col items-center gap-0.5">
              <Download className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition-colors" />
              <span className="text-[9px] text-gray-500">Exporter</span>
            </motion.button>
          </div>
        )}

        {/* Options secondaires */}
        <div className="flex items-center justify-around mb-4 flex-shrink-0">
          <button onClick={onToggleShuffle}
            className={`flex flex-col items-center gap-1 text-xs transition-all active:scale-90 ${shuffle?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
            <Shuffle className="w-5 h-5" /><span>Aléat.</span>
          </button>

          <button onClick={()=>setShowVolume(v=>!v)}
            className={`flex flex-col items-center gap-1 text-xs transition-all active:scale-90 ${showVolume?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
            <VolumeIcon className="w-5 h-5" /><span>Volume</span>
          </button>

          <button onClick={onToggleRepeat}
            className={`flex flex-col items-center gap-1 text-xs transition-all active:scale-90 relative ${repeat!=='off'?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
            <Repeat className="w-5 h-5" />
            <span>{repeat==='one'?'1×':'Répéter'}</span>
            {repeat==='one' && <span className="absolute -top-1 -right-1 text-[8px] bg-cyan-500 text-black font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
          </button>
        </div>

        {/* Volume slider */}
        <AnimatePresence>
          {showVolume && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
              className="mb-4 flex-shrink-0 overflow-hidden">
              <div className="flex items-center gap-3 bg-white/[0.05] rounded-2xl px-4 py-3 border border-white/[0.06]">
                <button onClick={onToggleMute} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                  <VolumeIcon className="w-4 h-4" />
                </button>
                <input
                  type="range" min={0} max={100} step={1} value={isMuted ? 0 : volume}
                  onChange={e => onVolumeChange?.(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: color }}
                />
                <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{isMuted ? 0 : volume}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contrôles transport */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <motion.button whileTap={{scale:0.85}} onClick={onPrev} className="p-3 text-gray-300 hover:text-white transition-colors">
            <SkipBack className="w-9 h-9 fill-current" />
          </motion.button>
          <motion.button whileTap={{scale:0.9}} onClick={onTogglePlay}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background:`linear-gradient(135deg,${color},#a855f7)`, boxShadow:`0 0 50px ${color}50` }}>
            {isBuffering
              ? <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : isPlaying
                ? <Pause className="w-9 h-9 text-white fill-current" />
                : <Play  className="w-9 h-9 text-white fill-current ml-1" />
            }
          </motion.button>
          <motion.button whileTap={{scale:0.85}} onClick={onNext} className="p-3 text-gray-300 hover:text-white transition-colors">
            <SkipForward className="w-9 h-9 fill-current" />
          </motion.button>
        </div>

        {/* File d'attente */}
        <AnimatePresence>
          {showQueue && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
              className="overflow-hidden mb-4 flex-shrink-0">
              <div className="bg-white/[0.06] backdrop-blur-sm rounded-2xl p-3 max-h-44 overflow-y-auto border border-white/[0.06]">
                <p className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-widest">Suivants</p>
                {upcoming.length === 0
                  ? <p className="text-gray-600 text-xs text-center py-3">File d'attente vide</p>
                  : upcoming.map((s,i) => (
                    <div key={s.id} className="flex items-center gap-3 py-1.5">
                      <span className="text-gray-700 text-[10px] w-4 text-center flex-shrink-0">{i+1}</span>
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                        {s.cover_url ? <img src={s.cover_url} className="w-full h-full object-cover" alt={s.title} />
                          : <div className="w-full h-full bg-gray-700 flex items-center justify-center"><Music className="w-3 h-3 text-gray-500" /></div>}
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

        <div className="pb-4 flex-shrink-0" />
      </div>

      {/* Paroles overlay */}
      <AnimatePresence>
        {showLyrics && lyricsContent && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
            className="absolute inset-x-0 bottom-0 top-20 bg-black/93 backdrop-blur-2xl rounded-t-3xl p-6 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-fuchsia-400" />
                <span className="text-sm font-bold text-white">Paroles</span>
              </div>
              <button onClick={()=>setShowLyrics(false)} className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-center pb-12">
              {lyricsContent.split('\n').map((line,i) => (
                <p key={i} className={line.trim()?'text-white text-base leading-relaxed':'py-2'}>{line||'\u00A0'}</p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    <AnimatePresence>
      {showShare && <SongShareModal song={currentSong} onClose={()=>setShowShare(false)} />}
    </AnimatePresence>
    </>
  );
};

export default NowPlayingScreen;
