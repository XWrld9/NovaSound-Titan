/**
 * NowPlayingScreen — NovaSound TITAN LUX v8000
 *
 * v8000 :
 *  - Icône Heart réduite (w-5) pour laisser place aux autres options
 *  - Rangée d'actions complète : Like · Share · Repost · Download · Follow
 *  - Chaque action a son propre état + logique Supabase + retry
 *  - SongShareModal intégré
 *  - Gestion ERR_CONNECTION_CLOSED via retry silencieux
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
} from 'lucide-react';
import SongShareModal from '@/components/SongShareModal';

const IdleWave = ({ isPlaying, color }) => {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
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

const GENRE_COLORS = {
  'Rap':'#a855f7','Trap':'#ef4444','R&B':'#ec4899','Afrobeats':'#f59e0b',
  'Hip-Hop':'#8b5cf6','Électronique':'#06b6d4','Gospel':'#10b981',
  'Drill':'#ef4444','Pop':'#06b6d4','Zouk':'#f43f5e','Afropop':'#f59e0b','Soul':'#ec4899',
};

const NowPlayingScreen = ({ onClose, isPlaying, onTogglePlay, onNext, onPrev, shuffle, onToggleShuffle, repeat, onToggleRepeat }) => {
  const { currentUser } = useAuth();
  const { currentSong, playlist, queue } = usePlayer();

  const [showLyrics, setShowLyrics]     = useState(false);
  const [showQueue,  setShowQueue]      = useState(false);
  const [showShare,  setShowShare]      = useState(false);
  const [lyricsContent, setLyricsContent] = useState(null);

  const [isLiked,     setIsLiked]      = useState(false);
  const [likeId,      setLikeId]       = useState(null);
  const [likeBurst,   setLikeBurst]    = useState(false);
  const [likeLoading, setLikeLoading]  = useState(false);

  const [hasReposted,    setHasReposted]   = useState(false);
  const [repostBurst,    setRepostBurst]   = useState(false);
  const [repostLoading,  setRepostLoading] = useState(false);

  const [isFollowing,   setIsFollowing]   = useState(false);
  const [followId,      setFollowId]      = useState(null);
  const [followLoading, setFollowLoading] = useState(false);

  const color = GENRE_COLORS[currentSong?.genre] || '#22d3ee';

  const withRetry = useCallback(async (fn, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try { return await fn(); }
      catch (err) { if (i === retries) throw err; await new Promise(r => setTimeout(r, 600*(i+1))); }
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !currentSong) {
      setIsLiked(false); setLikeId(null); setHasReposted(false);
      setIsFollowing(false); setFollowId(null); return;
    }
    // Sons locaux : pas de requêtes Supabase
    if (currentSong.is_local) {
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
    a.href = currentSong.audio_url; a.download = (currentSong.title||'audio')+'.m4a'; a.target='_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (!currentSong) return null;
  const upcoming = [...(queue||[]),...(playlist||[])].slice(0,6);
  const showFollowBtn = currentUser && currentSong?.uploader_id && currentSong.uploader_id !== currentUser.id;
  const isLocal = !!currentSong.is_local;

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

      <div className="relative flex flex-col h-full max-w-sm mx-auto w-full px-6"
        style={{ paddingTop:'env(safe-area-inset-top, 16px)' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between pt-5 pb-4 flex-shrink-0">
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90">
            <ChevronDown className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">En lecture</p>
            {currentSong.genre && <p className="text-[11px] font-bold mt-0.5" style={{color}}>{currentSong.genre}</p>}
          </div>
          <button onClick={()=>{setShowQueue(!showQueue);setShowLyrics(false);}}
            className={`p-2 rounded-full transition-all active:scale-90 ${showQueue?'bg-white/20 text-white':'bg-white/10 text-gray-400 hover:text-white'}`}>
            <List className="w-5 h-5" />
          </button>
        </div>

        {/* Pochette */}
        <div className="flex-1 flex items-center justify-center py-2 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div key={currentSong.id}
              initial={{ scale:0.82, opacity:0 }}
              animate={{ scale:isPlaying?[1,1.025,1]:0.96, opacity:1 }}
              exit={{ scale:0.82, opacity:0 }}
              transition={{ duration:isPlaying?2.5:0.4, repeat:isPlaying?Infinity:0, ease:'easeInOut' }}
              className="w-full max-w-[260px] aspect-square rounded-3xl overflow-hidden"
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
        <div className="mb-3 flex-shrink-0">
          <AnimatePresence mode="wait">
            <motion.p key={currentSong.title}
              initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
              className="text-white text-xl font-black truncate">{currentSong.title}</motion.p>
          </AnimatePresence>
          {isLocal
            ? <p className="text-gray-400 text-sm">{currentSong.artist}</p>
            : <Link to={`/artist/${currentSong.uploader_id}`} onClick={onClose}
                className="text-gray-400 text-sm hover:text-white transition-colors">{currentSong.artist}</Link>
          }
        </div>

        {/* ── Actions : Like · Share · Repost · Download · Follow/Paroles ── */}
        {!isLocal && (
        <div className="flex items-center justify-between mb-4 flex-shrink-0 px-1">

          {/* Like */}
          <motion.button onClick={toggleLike} whileTap={{scale:0.85}}
            disabled={likeLoading||!currentUser}
            className="relative flex flex-col items-center gap-0.5 disabled:opacity-40" title="Like">
            <AnimatePresence>
              {likeBurst && (
                <motion.span key="lb" initial={{scale:0.5,opacity:1}} animate={{scale:2.4,opacity:0}}
                  exit={{opacity:0}} transition={{duration:0.6}}
                  className="absolute inset-0 rounded-full bg-red-400/20 pointer-events-none" />
              )}
            </AnimatePresence>
            <Heart className={`w-5 h-5 transition-all ${isLiked?'fill-current text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]':'text-gray-500 hover:text-gray-300'}`} />
            <span className="text-[9px] text-gray-500">Like</span>
          </motion.button>

          {/* Share */}
          <motion.button onClick={()=>setShowShare(true)} whileTap={{scale:0.85}}
            className="flex flex-col items-center gap-0.5" title="Partager">
            <Share2 className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition-colors" />
            <span className="text-[9px] text-gray-500">Partager</span>
          </motion.button>

          {/* Repost */}
          <motion.button onClick={toggleRepost} whileTap={{scale:0.85}}
            disabled={repostLoading||!currentUser}
            className="relative flex flex-col items-center gap-0.5 disabled:opacity-40" title="Repost">
            <AnimatePresence>
              {repostBurst && (
                <motion.span key="rb" initial={{scale:0.5,opacity:1}} animate={{scale:2.2,opacity:0}}
                  exit={{opacity:0}} transition={{duration:0.5}}
                  className="absolute inset-0 rounded-full bg-green-400/20 pointer-events-none" />
              )}
            </AnimatePresence>
            <motion.div animate={repostBurst?{rotate:[0,-20,20,0]}:{rotate:0}} transition={{duration:0.4}}>
              <Repeat2 className={`w-5 h-5 transition-colors ${hasReposted?'text-green-400':'text-gray-500 hover:text-green-400'}`} />
            </motion.div>
            <span className="text-[9px] text-gray-500">Repost</span>
          </motion.button>

          {/* Download */}
          <motion.button onClick={handleDownload} whileTap={{scale:0.85}}
            className="flex flex-col items-center gap-0.5" title="Télécharger">
            <Download className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition-colors" />
            <span className="text-[9px] text-gray-500">Sauver</span>
          </motion.button>

          {/* Follow ou Paroles */}
          {showFollowBtn ? (
            <motion.button onClick={toggleFollow} whileTap={{scale:0.85}} disabled={followLoading}
              className="flex flex-col items-center gap-0.5 disabled:opacity-40"
              title={isFollowing?'Se désabonner':"S'abonner"}>
              {isFollowing
                ? <UserCheck className="w-5 h-5 text-cyan-400" />
                : <UserPlus  className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition-colors" />}
              <span className="text-[9px] text-gray-500">{isFollowing?'Abonné':'Suivre'}</span>
            </motion.button>
          ) : (
            <button onClick={()=>{setShowLyrics(!showLyrics);setShowQueue(false);}} disabled={!lyricsContent}
              className={`flex flex-col items-center gap-0.5 transition-all active:scale-90 ${
                showLyrics?'text-fuchsia-400':lyricsContent?'text-gray-400 hover:text-white':'text-gray-700 cursor-not-allowed opacity-40'}`}
              title="Paroles">
              <Mic2 className="w-5 h-5" />
              <span className="text-[9px]">Paroles</span>
            </button>
          )}
        </div>
        )} {/* end !isLocal */}

        {/* Options secondaires */}
        <div className="flex items-center justify-around mb-5 flex-shrink-0">
          <button onClick={onToggleShuffle}
            className={`flex flex-col items-center gap-1 text-xs transition-all active:scale-90 ${shuffle?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
            <Shuffle className="w-5 h-5" /><span>Aléat.</span>
          </button>
          <button onClick={()=>{setShowLyrics(!showLyrics);setShowQueue(false);}} disabled={!lyricsContent}
            className={`flex flex-col items-center gap-1 text-xs transition-all active:scale-90 ${
              showLyrics?'text-fuchsia-400':lyricsContent?'text-gray-400 hover:text-white':'text-gray-700 cursor-not-allowed opacity-40'}`}>
            <Mic2 className="w-5 h-5" /><span>Paroles</span>
          </button>
          <button onClick={onToggleRepeat}
            className={`flex flex-col items-center gap-1 text-xs transition-all active:scale-90 relative ${repeat!=='off'?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
            <Repeat className="w-5 h-5" />
            <span>{repeat==='one'?'1×':'Répéter'}</span>
            {repeat==='one' && <span className="absolute -top-1 -right-1 text-[8px] bg-cyan-500 text-black font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
          </button>
        </div>

        {/* Contrôles transport */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <motion.button whileTap={{scale:0.85}} onClick={onPrev} className="p-3 text-gray-300 hover:text-white transition-colors">
            <SkipBack className="w-9 h-9 fill-current" />
          </motion.button>
          <motion.button whileTap={{scale:0.9}} onClick={onTogglePlay}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background:`linear-gradient(135deg,${color},#a855f7)`, boxShadow:`0 0 50px ${color}50` }}>
            {isPlaying ? <Pause className="w-9 h-9 text-white fill-current" /> : <Play className="w-9 h-9 text-white fill-current ml-1" />}
          </motion.button>
          <motion.button whileTap={{scale:0.85}} onClick={onNext} className="p-3 text-gray-300 hover:text-white transition-colors">
            <SkipForward className="w-9 h-9 fill-current" />
          </motion.button>
        </div>

        {/* Queue */}
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
        <div className="pb-8 flex-shrink-0" />
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
              <button onClick={()=>setShowLyrics(false)}
                className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white transition-colors">
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
