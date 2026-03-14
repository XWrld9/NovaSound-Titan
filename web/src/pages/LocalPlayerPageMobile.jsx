/**
 * LocalPlayerPageMobile — NovaSound TITAN LUX V6000000
 * REFONTE TOTALE — Interface lecteur de musique natif (XPlayer / Poweramp style)
 * ✅ Pas de page import visible — bibliothèque directement accessible
 * ✅ Bottom tab bar : Bibliothèque | Lecture | Playlists
 * ✅ Lecteur plein écran avec pochette, contrôles, swipe
 * ✅ FSA (Android/Desktop) + Input (iOS) — auto-reconnect silencieux
 * ✅ Media Session, sleep timer, vitesse, visualizer
 * ✅ Persist IDB, ID3v2 parser, couvertures embarquées
 */
import React, {
  useState, useRef, useCallback, useEffect, memo, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Heart, ListMusic, Library, Disc3,
  Search, X, MoreVertical, Timer, Gauge, Plus, Trash2,
  ChevronDown, Wifi, WifiOff, RefreshCw, FolderOpen,
  CheckSquare, Square, Music2, Save, Home,
} from 'lucide-react';
import { usePlayer }     from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';
import { supabase }      from '@/lib/supabaseClient';
import NoTranslate from '@/components/NoTranslate';

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */
const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = f =>
  AUDIO_EXTS.test(f.name) || f.type.startsWith('audio/') || f.type === 'video/mp4';
const FSA_SUPPORTED = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const fmtDur = s =>
  (!s || !isFinite(s) || s <= 0) ? '--:--'
  : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtMin = s => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  return sec ? `${m}m${sec}s` : `${m}m`;
};
const vibrate = p => { try { navigator.vibrate?.(p); } catch (_) {} };

/* ═══════════════════════════════════════════════════════════════════
   INDEXEDDB
   ═══════════════════════════════════════════════════════════════════ */
const IDB_NAME = 'novasound_local_v3', IDB_VERSION = 1;
const openIDB = () => new Promise((res, rej) => {
  const r = indexedDB.open(IDB_NAME, IDB_VERSION);
  r.onupgradeneeded = e => {
    const db = e.target.result;
    ['songs_meta','song_blobs','dir_handles','playlists'].forEach(s => {
      if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    });
  };
  r.onsuccess = e => res(e.target.result);
  r.onerror   = () => rej(r.error);
});
const idbTx = async (store, mode, fn) => {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    tx.onerror = () => rej(tx.error);
    fn(tx.objectStore(store), res, rej);
  });
};
const idbGet    = (store, key)   => idbTx(store,'readonly', (os,res)=>{const r=os.get(key);    r.onsuccess=()=>res(r.result);});
const idbGetAll = (store)        => idbTx(store,'readonly', (os,res)=>{const r=os.getAll();    r.onsuccess=()=>res(r.result||[]);});
const idbPut    = (store, val)   => idbTx(store,'readwrite',(os,res)=>{os.put(val);  res();});
const idbDelete = (store, key)   => idbTx(store,'readwrite',(os,res)=>{os.delete(key); res();});
const idbClear  = (store)        => idbTx(store,'readwrite',(os,res)=>{os.clear();  res();});
const idbBulkPut= (store, items) => idbTx(store,'readwrite',(os,res)=>{items.forEach(i=>os.put(i)); res();});

/* ═══════════════════════════════════════════════════════════════════
   COVER SVG
   ═══════════════════════════════════════════════════════════════════ */
const _xe = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const makeCoverSvg = (title='', artist='') => {
  const hue = s => { let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h%360; };
  const c1=`hsl(${hue(title)},60%,42%)`, c2=`hsl(${hue(artist||title.split('').reverse().join(''))},65%,55%)`;
  const letter=_xe((title[0]||'♫').toUpperCase()), label=_xe(title.slice(0,18));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="85" r="42" fill="rgba(0,0,0,0.2)"/><text x="100" y="102" font-family="system-ui,sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${letter}</text><text x="100" y="160" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.5)" text-anchor="middle">${label}</text></svg>`;
  try { return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg))); }
  catch(_) { return 'data:image/svg+xml;base64,'+btoa(svg); }
};

/* ═══════════════════════════════════════════════════════════════════
   ID3v2 PARSER
   ═══════════════════════════════════════════════════════════════════ */
const parseID3 = async file => {
  const result = { title:'', artist:'', album:'', cover:null };
  try {
    const buf = await file.slice(0, 256*1024).arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes[0]!==0x49||bytes[1]!==0x44||bytes[2]!==0x33) return result;
    const dec = new TextDecoder('utf-8',{fatal:false});
    let pos = 10;
    const tagSize = ((bytes[6]&0x7f)<<21)|((bytes[7]&0x7f)<<14)|((bytes[8]&0x7f)<<7)|(bytes[9]&0x7f);
    while (pos < tagSize && pos + 10 < bytes.length) {
      const frameId = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      const fsize = (bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
      if (fsize<=0||fsize>tagSize) break;
      const data = bytes.slice(pos+10, pos+10+fsize);
      if (frameId==='TIT2'||frameId==='TPE1'||frameId==='TALB') {
        const enc = data[0]; let text='';
        if (enc===1||enc===2) text = new TextDecoder(enc===1?'utf-16':'utf-16be',{fatal:false}).decode(data.slice(1));
        else text = dec.decode(data.slice(1));
        text = text.replace(/\0/g,'').trim();
        if (frameId==='TIT2') result.title = text;
        else if (frameId==='TPE1') result.artist = text;
        else if (frameId==='TALB') result.album = text;
      } else if (frameId==='APIC') {
        try {
          let i=1; while(i<data.length&&data[i]!==0) i++; i++;
          while(i<data.length&&data[i]!==0) i++; i++;
          const mimeEnd = data.indexOf(0,1)+1;
          const mime = dec.decode(data.slice(1,mimeEnd-1))||'image/jpeg';
          const imgData = data.slice(i);
          if (imgData.length>100) {
            const blob = new Blob([imgData],{type:mime.includes('png')?'image/png':'image/jpeg'});
            result.cover = URL.createObjectURL(blob);
          }
        } catch(_) {}
      }
      pos += 10 + fsize;
    }
  } catch(_) {}
  return result;
};

/* Supabase helpers */
const logPlayHistory = async (song, userId) => {
  try { await supabase.from('local_play_history').insert({ user_id:userId, title:song.title, artist:song.artist, file_name:song._fileName, played_at:new Date().toISOString() }); } catch(_){}
};
const startSession = async (userId, filesCount) => {
  try {
    const { data, error } = await supabase.from('local_player_sessions')
      .insert({ user_id:userId, files_count:filesCount, session_start:new Date().toISOString(), lang:navigator.language?.slice(0,2)||'fr', is_pc:false })
      .select('id').single();
    if (!error && data?.id) window._lpsId = data.id;
  } catch(_){}
};
const endSession = async () => {
  if (!window._lpsId) return;
  try {
    const { error } = await supabase.from('local_player_sessions')
      .update({ session_end: new Date().toISOString() }).eq('id', window._lpsId);
    if (!error) window._lpsId = null;
  } catch(_){}
};

/* Dominant color */
const extractDominantColor = imgSrc => new Promise(resolve => {
  if (!imgSrc || imgSrc.startsWith('data:image/svg')) { resolve(null); return; }
  const img = new Image(); img.crossOrigin='anonymous';
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 8;
      c.getContext('2d').drawImage(img,0,0,8,8);
      const d = c.getContext('2d').getImageData(0,0,8,8).data;
      let r=0,g=0,b=0,n=0;
      for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
      resolve(`${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)}`);
    } catch(_) { resolve(null); }
  };
  img.onerror=()=>resolve(null);
  img.src=imgSrc;
});

/* Walk FSA directory */
async function* walkDir(handle, path='') {
  for await (const [name, entry] of handle.entries()) {
    const p = path ? `${path}/${name}` : name;
    if (entry.kind === 'file' && isAudioFile({name})) yield { entry, path:p };
    else if (entry.kind === 'directory') yield* walkDir(entry, p);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   VISUALIZER HOOK
   ═══════════════════════════════════════════════════════════════════ */
const useVisualizer = (active, canvasRef) => {
  const ctxRef = useRef(null); const rafRef = useRef(null);
  const connect = useCallback(() => {
    const audio = document.querySelector('audio'); if (!audio || !canvasRef.current) return;
    try {
      if (!window._nsAC) window._nsAC = new AudioContext();
      if (!window._nsSrc) { window._nsSrc = window._nsAC.createMediaElementSource(audio); window._nsSrc.connect(window._nsAC.destination); }
      if (!window._nsAn) { window._nsAn = window._nsAC.createAnalyser(); window._nsAn.fftSize=64; window._nsSrc.connect(window._nsAn); }
      ctxRef.current = { analyser: window._nsAn, ac: window._nsAC };
    } catch(_){}
  }, [canvasRef]);
  const draw = useCallback(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!ctx || !ctxRef.current?.analyser) { rafRef.current=requestAnimationFrame(draw); return; }
    const { analyser } = ctxRef.current;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const bw = W/buf.length*1.8;
    buf.forEach((v,i)=>{
      const h=v/255*H*0.9, x=i*bw, alpha=0.5+v/512;
      const g=ctx.createLinearGradient(0,H-h,0,H);
      g.addColorStop(0,'rgba(6,182,212,'+alpha+')');
      g.addColorStop(1,'rgba(168,85,247,'+alpha+')');
      ctx.fillStyle=g; ctx.beginPath();
      ctx.roundRect?ctx.roundRect(x,H-h,Math.max(1,bw-1),h,2):ctx.rect(x,H-h,Math.max(1,bw-1),h);
      ctx.fill();
    });
    rafRef.current=requestAnimationFrame(draw);
  }, [canvasRef]);
  useEffect(()=>{
    if (active) { connect(); rafRef.current=requestAnimationFrame(draw); }
    else { cancelAnimationFrame(rafRef.current); const c=canvasRef.current?.getContext('2d'); if(c) c.clearRect(0,0,999,999); }
    return ()=>cancelAnimationFrame(rafRef.current);
  },[active,connect,draw,canvasRef]);
};

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* Mini song row */
const SongRow = memo(({ song, isPlaying, isActive, onPlay, onRemove, selectionMode, isSelected, onToggleSelect }) => (
  <motion.div
    initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
    className={`flex items-center gap-3 px-4 py-3 active:bg-white/[0.06] transition-all cursor-pointer ${isActive?'bg-white/[0.06]':''}`}
    onClick={() => selectionMode ? onToggleSelect(song.id) : onPlay(song)}
  >
    {selectionMode && (
      <div className="flex-shrink-0 text-cyan-400">
        {isSelected ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4 text-gray-600"/>}
      </div>
    )}
    <div className={`relative flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden border ${isActive?'border-cyan-500/40':'border-white/[0.06]'}`}>
      <img src={song.cover_url||song.coverUrl||makeCoverSvg(song.title,song.artist)} alt="" className="w-full h-full object-cover"/>
      {isActive && isPlaying && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="flex items-end gap-[2px]">
            {[0,1,2].map(i=>(
              <motion.div key={i} className="w-0.5 rounded-t bg-cyan-400"
                animate={{height:['3px','10px','5px','8px','3px']}}
                transition={{duration:0.7+i*0.1,repeat:Infinity,delay:i*0.08,ease:'easeInOut'}}/>
            ))}
          </div>
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <NoTranslate tag="p" className={`text-sm font-semibold truncate notranslate ${isActive?'text-cyan-400':'text-white'}`} translate="no"><NoTranslate className="truncate">{song.title}</NoTranslate></NoTranslate>
      <NoTranslate tag="p" className="text-gray-500 text-xs truncate notranslate"><NoTranslate className="truncate">{song.artist}</NoTranslate></NoTranslate>
    </div>
    <button
      className="flex-shrink-0 p-2 text-gray-700 hover:text-red-400 active:scale-90 transition-all"
      onClick={e=>{e.stopPropagation();onRemove(song);}}
    >
      <Trash2 className="w-3.5 h-3.5"/>
    </button>
  </motion.div>
));

/* OSD overlay */
const OSDOverlay = memo(({ osd }) => (
  <AnimatePresence>
    {osd && (
      <motion.div key={osd.id}
        initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.8}}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-xl rounded-2xl px-6 py-4 text-center border border-white/10">
          <p className="text-4xl mb-1">{osd.key}</p>
          <p className="text-white font-bold text-sm">{osd.label}</p>
          {osd.value != null && <p className="text-cyan-400 text-xs mt-0.5">{osd.value}</p>}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

/* Sleep timer badge */
const SleepBadge = memo(({ remaining }) => {
  if (remaining == null) return null;
  if (remaining === -1) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold">
      <Timer className="w-2.5 h-2.5"/>Fin morceau
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold">
      <Timer className="w-2.5 h-2.5"/>{fmtMin(remaining)}
    </span>
  );
});

/* Progress bar */
const ProgressBar = memo(({ current, duration, onSeek }) => {
  const barRef = useRef(null);
  const pct = duration > 0 ? Math.min(1, current / duration) : 0;
  const handleTouch = useCallback(e => {
    const rect = barRef.current?.getBoundingClientRect(); if (!rect||!duration) return;
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    onSeek(Math.max(0, Math.min(duration, (x / rect.width) * duration)));
  }, [duration, onSeek]);
  return (
    <div ref={barRef} className="relative h-8 flex items-center cursor-pointer touch-none"
      onTouchStart={handleTouch} onTouchMove={handleTouch} onClick={handleTouch}>
      <div className="w-full h-1 bg-white/[0.1] rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
          style={{width:`${pct*100}%`}} transition={{type:'tween',duration:0.1}}/>
      </div>
      <motion.div className="absolute w-4 h-4 rounded-full bg-white shadow-lg shadow-black/40"
        style={{left:`calc(${pct*100}% - 8px)`}} transition={{type:'tween',duration:0.1}}/>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const LocalPlayerPageMobile = memo(() => {
  const navigate = useNavigate();
  const {
    currentSong, isPlaying, playSong, play, pause, next, previous,
    togglePlayPause, shuffle, toggleShuffle, repeat, cycleRepeat, seekTo,
  } = usePlayer();
  const { audioCurrentTime, audioDuration } = usePlayerTime();

  /* State */
  const [songs,          setSongs]          = useState([]);
  const [libReady,       setLibReady]       = useState(false);
  const [accessGranted,  setAccessGranted]  = useState(false);
  const [isScanning,     setIsScanning]     = useState(false);
  const [scanStats,      setScanStats]      = useState({ processed:0, total:0, current:'' });
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [activeTab,      setActiveTab]      = useState('player');
  const [selectionMode,  setSelectionMode]  = useState(false);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [searchQuery,    setSearchQuery]    = useState('');
  const [sortBy,         setSortBy]         = useState('default');
  const [showPlaylistModal, setShowModal]   = useState(false);
  const [newPlName,      setNewPlName]      = useState('');
  const [modeTransition, setModeTransition] = useState(false);
  const [volume,         setVolume]         = useState(80);
  const [isMuted,        setIsMuted]        = useState(false);
  const [sleepTimer,     setSleepTimer]     = useState(null);
  const [sleepTimerTarget,setSleepTimerTarget] = useState(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [speed,          setSpeed]          = useState(1);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [dominantColor,  setDominantColor]  = useState(null);
  const [osd,            setOsd]            = useState(null);
  const [favorited,      setFavorited]      = useState(false);
  const [showMenu,       setShowMenu]       = useState(false);

  const folderInputRef  = useRef(null);
  const osdTimerRef     = useRef(null);
  const osdIdRef        = useRef(0);
  const sleepIntervalRef= useRef(null);
  const isPlayingRef    = useRef(false);
  const canvasRef       = useRef(null);
  const dirHandleRef    = useRef(null);
  const coverSwipeStart = useRef(null);

  const isLocalPlaying = !!currentSong?.is_local;
  const activeSong     = isLocalPlaying ? currentSong : null;
  const duration       = isLocalPlaying ? (audioDuration||0) : 0;
  const currentTime    = isLocalPlaying ? (audioCurrentTime||0) : 0;
  const cover          = activeSong?.cover_url||activeSong?.coverUrl||makeCoverSvg(activeSong?.title||'',activeSong?.artist||'');
  const VolumeIcon     = isMuted||volume===0 ? VolumeX : Volume2;

  useEffect(()=>{ isPlayingRef.current=isPlaying; },[isPlaying]);
  useVisualizer(isPlaying&&isLocalPlaying, canvasRef);
  useEffect(()=>{ if(cover) extractDominantColor(cover).then(setDominantColor); },[cover]);
  useEffect(()=>{ const a=document.querySelector('audio'); if(a){a.volume=isMuted?0:volume/100;a.muted=isMuted;} },[volume,isMuted]);
  useEffect(()=>{ const a=document.querySelector('audio'); if(a) a.playbackRate=speed; },[speed]);

  /* Sleep timer */
  useEffect(()=>{
    clearInterval(sleepIntervalRef.current);
    if(!sleepTimerTarget||sleepTimerTarget===-1){setSleepTimer(null); return;}
    const tick=()=>{
      const rem=Math.max(0,sleepTimerTarget-Math.floor(Date.now()/1000));
      setSleepTimer(rem);
      if(rem<=0){clearInterval(sleepIntervalRef.current);document.querySelector('audio')?.pause();setSleepTimerTarget(null);setSleepTimer(null);}
    };
    tick(); sleepIntervalRef.current=setInterval(tick,1000);
    return ()=>clearInterval(sleepIntervalRef.current);
  },[sleepTimerTarget]);

  useEffect(()=>{ startSession(null,0); return ()=>{endSession();}; },[]);
  useEffect(()=>{ initLibrary(); },[]);

  /* ── Init library ── */
  const initLibrary = async () => {
    try {
      const [savedMeta, playlists] = await Promise.all([idbGetAll('songs_meta'), idbGetAll('playlists')]);
      setSavedPlaylists(playlists);
      if (savedMeta.length > 0) {
        const restored = await Promise.all(savedMeta.map(async meta => {
          // Régénérer les cover blob URLs périmées après reload de page
          let cover = meta.cover_url;
          if (!cover || cover.startsWith('blob:')) {
            cover = makeCoverSvg(meta.title||'', meta.artist||'');
          }
          const fixedMeta = {...meta, cover_url: cover, coverUrl: cover};

          if (!fixedMeta._hasBlobStored) return fixedMeta;
          try {
            const rec = await idbGet('song_blobs', fixedMeta.id);
            if (rec?.buffer) {
              const url = URL.createObjectURL(new Blob([rec.buffer],{type:fixedMeta._mimeType||'audio/mpeg'}));
              return {...fixedMeta, url, audio_url:url};
            }
          } catch(_){}
          return fixedMeta;
        }));
        setSongs(restored);
        setAccessGranted(true);
        // Ne pas jouer automatiquement — l'utilisateur choisit son son
      }
      setLibReady(true);
      if (FSA_SUPPORTED && !isIOS()) autoReconnectFSA();
    } catch(err) {
      console.error('[LocalPlayer] initLibrary:', err);
      setLibReady(true);
    }
  };

  const autoReconnectFSA = async () => {
    try {
      const stored = await idbGet('dir_handles','default');
      if (!stored?.handle) return;
      dirHandleRef.current = stored.handle;
      const perm = await stored.handle.queryPermission({mode:'read'});
      if (perm==='granted') { setAccessGranted(true); scanFromHandle(stored.handle, true); }
    } catch(_){}
  };

  /* ── FSA access ── */
  const grantFSAAccess = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({mode:'read', startIn:'music'});
      dirHandleRef.current = handle;
      await idbPut('dir_handles', {id:'default', handle});
      setAccessGranted(true);
      await scanFromHandle(handle, false);
    } catch(err) {
      if (err.name!=='AbortError') console.warn('[LocalPlayer] FSA:', err);
    }
  },[]);

  const grantInputAccess = useCallback(()=>{ folderInputRef.current?.click(); },[]);

  const handleFolderInput = useCallback(async e => {
    const files = Array.from(e.target.files||[]).filter(isAudioFile);
    e.target.value = '';
    if (!files.length) return;
    setIsScanning(true); setScanStats({processed:0,total:files.length,current:''});
    const newSongs = [];
    for (let i=0; i<files.length; i++) {
      const file=files[i];
      setScanStats(s=>({...s,processed:i+1,current:file.name}));
      const raw=file.name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' ');
      const tags=await parseID3(file).catch(()=>({title:'',artist:'',album:'',cover:null}));
      const title=tags.title||raw, artist=tags.artist||'Artiste inconnu';
      const url=URL.createObjectURL(file);
      const id=`local::${file.name}::${file.size}`;
      let hasBlobStored=false;
      try{const buf=await file.arrayBuffer();await idbPut('song_blobs',{id,buffer:buf});hasBlobStored=true;}catch(_){}
      newSongs.push({
        id,title,artist,album:tags.album||'',duration:0,url,audio_url:url,
        coverUrl:tags.cover||makeCoverSvg(title,artist),
        cover_url:tags.cover||makeCoverSvg(title,artist),
        _hasBlobCover:!!tags.cover,_hasBlobStored:hasBlobStored,
        _mimeType:file.type,_fileName:file.name,addedAt:Date.now(),is_local:true,
      });
    }
    await idbBulkPut('songs_meta',newSongs.map(s=>({...s,url:undefined,audio_url:undefined})));
    setSongs(prev=>{
      const ex=new Set(prev.map(s=>s.id));
      const fresh=newSongs.filter(s=>!ex.has(s.id));
      const merged=[...prev,...fresh];
      if(prev.length===0&&fresh.length>0) setTimeout(()=>{playSong(fresh[0],fresh);logPlayHistory(fresh[0],null);},80);
      startSession(null,merged.length);
      return merged;
    });
    setAccessGranted(true); setIsScanning(false); setScanStats({processed:0,total:0,current:''});
    setActiveTab('player');
  },[playSong]);

  /* ── FSA Scan ── */
  const scanFromHandle = useCallback(async (handle, silent=false) => {
    if (!silent){setIsScanning(true);}
    setScanStats({processed:0,total:0,current:''});
    try {
      const savedMeta=await idbGetAll('songs_meta');
      const existingMap=new Map(savedMeta.map(s=>[s.id,s]));
      const newSongs=[]; const urlRefresh=[]; let processed=0;
      for await (const {entry,path} of walkDir(handle)) {
        const file=await entry.getFile();
        const id=`local::${file.name}::${file.size}`;
        setScanStats(s=>({...s,processed:++processed,current:file.name}));
        const url=URL.createObjectURL(file);
        if (existingMap.has(id)) { urlRefresh.push({id,url}); }
        else {
          const raw=file.name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' ');
          const tags=await parseID3(file).catch(()=>({title:'',artist:'',album:'',cover:null}));
          const title=tags.title||raw, artist=tags.artist||'Artiste inconnu';
          newSongs.push({
            id,title,artist,album:tags.album||'',duration:0,url,audio_url:url,
            coverUrl:tags.cover||makeCoverSvg(title,artist),
            cover_url:tags.cover||makeCoverSvg(title,artist),
            _hasBlobCover:!!tags.cover,_hasBlobStored:false,
            _mimeType:file.type,_fileName:file.name,_fsaPath:path,addedAt:Date.now(),is_local:true,
          });
        }
      }
      if (newSongs.length>0) await idbBulkPut('songs_meta',newSongs.map(s=>({...s,url:undefined,audio_url:undefined})));
      setSongs(prev=>{
        const refreshMap=new Map(urlRefresh.map(r=>[r.id,r.url]));
        const refreshed=prev.map(s=>{const u=refreshMap.get(s.id);return u?{...s,url:u,audio_url:u}:s;});
        const exIds=new Set(refreshed.map(s=>s.id));
        const fresh=newSongs.filter(s=>!exIds.has(s.id));
        const merged=[...refreshed,...fresh];
        if(prev.length===0&&fresh.length>0) setTimeout(()=>{playSong(fresh[0],fresh);logPlayHistory(fresh[0],null);},80);
        startSession(null,merged.length);
        return merged;
      });
    } catch(err){ console.error('[LocalPlayer] scan:',err); }
    finally { setIsScanning(false); setScanStats({processed:0,total:0,current:''}); }
  },[playSong]);

  const handleRescan = useCallback(async () => {
    const stored=await idbGet('dir_handles','default').catch(()=>null);
    if (stored?.handle){
      const perm=await stored.handle.requestPermission({mode:'read'});
      if (perm==='granted'){dirHandleRef.current=stored.handle;scanFromHandle(stored.handle,false);return;}
    }
    grantFSAAccess();
  },[grantFSAAccess,scanFromHandle]);

  const handleClearLibrary = useCallback(async () => {
    await Promise.all([idbClear('songs_meta'),idbClear('song_blobs'),idbClear('dir_handles')]);
    setSongs([]);setAccessGranted(false);dirHandleRef.current=null;
  },[]);

  /* ── Playlist management ── */
  const handleSavePlaylist = useCallback(async name => {
    const ids=selectionMode?[...selectedIds]:songs.map(s=>s.id);
    const sel=songs.filter(s=>ids.includes(s.id)); if(!sel.length) return;
    const pl={
      id:`pl-${Date.now()}`,name,createdAt:Date.now(),
      songs:sel.map(s=>({id:s.id,title:s.title,artist:s.artist,album:s.album||'',
        coverUrl:s.cover_url||s.coverUrl||makeCoverSvg(s.title,s.artist),
        cover_url:s.cover_url||s.coverUrl||makeCoverSvg(s.title,s.artist),
        is_local:true,_needsReimport:!s._hasBlobStored})),
    };
    await idbPut('playlists',pl);
    setSavedPlaylists(prev=>[...prev,pl]);
    setShowModal(false);setSelectionMode(false);setSelectedIds(new Set());vibrate(20);
  },[selectionMode,selectedIds,songs]);

  const handleDeletePlaylist = useCallback(async id => {
    await idbDelete('playlists',id);setSavedPlaylists(prev=>prev.filter(p=>p.id!==id));
  },[]);

  const getFileByName = useCallback(async (dirHandle, fileName) => {
    try {
      for await (const {entry} of walkDir(dirHandle)) {
        if (entry.name===fileName) return await entry.getFile();
      }
    } catch(_){}
    return null;
  },[]);

  const handleSelectPlaylist = useCallback(async pl => {
    const restored=await Promise.all(pl.songs.map(async meta=>{
      if(meta._needsReimport){
        try{const rec=await idbGet('song_blobs',meta.id);if(rec?.buffer){const url=URL.createObjectURL(new Blob([rec.buffer],{type:'audio/mpeg'}));return{...meta,url,audio_url:url};}}catch(_){}
      }
      const live=songs.find(s=>s.id===meta.id);
      if(live?.url||live?.audio_url) return live;
      if(dirHandleRef.current&&meta._fileName){
        try{const file=await getFileByName(dirHandleRef.current,meta._fileName);if(file){const url=URL.createObjectURL(file);return{...meta,url,audio_url:url};}}catch(_){}
      }
      return meta;
    }));
    const playable=restored.filter(s=>s.url||s.audio_url);
    if(!playable.length) return;
    playSong(playable[0],playable);
    setActiveTab('player');vibrate(15);
  },[songs,playSong,getFileByName]);

  const handleRemoveSong = useCallback(async song => {
    await Promise.all([idbDelete('songs_meta',song.id),idbDelete('song_blobs',song.id)].map(p=>p.catch(()=>{})));
    setSongs(prev=>prev.filter(s=>s.id!==song.id));
  },[]);

  const handlePlaySong = useCallback(async song => {
    vibrate(8); let s=song;
    if (!s.url&&!s.audio_url&&dirHandleRef.current&&s._fileName){
      try{const file=await getFileByName(dirHandleRef.current,s._fileName);if(file){const url=URL.createObjectURL(file);s={...s,url,audio_url:url};setSongs(prev=>prev.map(p=>p.id===s.id?{...p,url,audio_url:url}:p));}}catch(_){}
    }
    if (!s.url&&!s.audio_url) return;
    playSong({...s,audio_url:s.url||s.audio_url,cover_url:s.coverUrl||s.cover_url},songs.map(s=>({...s,audio_url:s.audio_url||s.url,cover_url:s.cover_url||s.coverUrl})));
    logPlayHistory(song,null);
    setActiveTab('player');
  },[playSong,songs,getFileByName]);

  const goOnline = useCallback(()=>{endSession();setModeTransition(true);setTimeout(()=>navigate('/'),950);},[navigate]);

  /* OSD */
  const showOSD = useCallback((key,label,value=null)=>{
    if(osdTimerRef.current) clearTimeout(osdTimerRef.current);
    const id=++osdIdRef.current; setOsd({key,label,value,id});
    osdTimerRef.current=setTimeout(()=>setOsd(null),1600);
  },[]);

  const handleSetSleepTimer = useCallback(seconds=>{
    if(!seconds){setSleepTimerTarget(null);setSleepTimer(null);showOSD('⏰','Minuterie désactivée');}
    else if(seconds===-1){setSleepTimerTarget(-1);showOSD('⏰','Fin du morceau');}
    else{setSleepTimerTarget(Math.floor(Date.now()/1000)+seconds);showOSD('⏰','Minuterie',fmtMin(seconds));}
    setShowSleepModal(false);vibrate(12);
  },[showOSD]);

  const handleSetSpeed = useCallback(s=>{setSpeed(s);setShowSpeedModal(false);vibrate(8);showOSD('⚡','Vitesse',`${s}×`);},[showOSD]);

  /* Cover swipe */
  const handleCoverTouchStart = useCallback(e=>{
    coverSwipeStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now()};
  },[]);
  const handleCoverTouchEnd = useCallback(e=>{
    if(!coverSwipeStart.current) return;
    const dx=e.changedTouches[0].clientX-coverSwipeStart.current.x;
    const dy=e.changedTouches[0].clientY-coverSwipeStart.current.y;
    const dt=Date.now()-coverSwipeStart.current.time;
    if(dt>400){coverSwipeStart.current=null;return;}
    const ax=Math.abs(dx),ay=Math.abs(dy);
    if(ax>50&&ax>ay*1.5){
      if(dx<0){next?.();vibrate([15,5,15]);showOSD('→','⏭ Suivant');}
      else{previous?.();vibrate([15,5,15]);showOSD('←','⏮ Précédent');}
    } else if(ay>50&&ay>ax*1.5){
      if(dy<0){setVolume(v=>{const n=Math.min(100,v+10);showOSD('↑','🔊 Volume',`${n}%`);return n;});setIsMuted(false);vibrate(8);}
      else{setVolume(v=>{const n=Math.max(0,v-10);showOSD('↓','🔉 Volume',`${n}%`);return n;});vibrate(8);}
    }
    coverSwipeStart.current=null;
  },[next,previous,showOSD]);

  /* Media Session */
  useEffect(()=>{
    if(!('mediaSession' in navigator)||!activeSong) return;
    try{
      const src=activeSong.cover_url||activeSong.coverUrl||'/icon-192.png';
      navigator.mediaSession.metadata=new MediaMetadata({title:activeSong.title||'Titre inconnu',artist:activeSong.artist||'Fichier local',album:activeSong.album||'NovaSound Local',artwork:[{src,sizes:'512x512',type:src.startsWith('data:')?'image/png':'image/jpeg'}]});
    }catch(_){}
    const h={play:()=>play?.(),pause:()=>pause?.(),nexttrack:()=>next?.(),previoustrack:()=>previous?.(),seekbackward:()=>seekTo?.(Math.max(0,currentTime-10)),seekforward:()=>seekTo?.(Math.min(duration,currentTime+10)),seekto:d=>{if(d.seekTime!=null)seekTo?.(d.seekTime);}};
    Object.entries(h).forEach(([a,fn])=>{try{navigator.mediaSession.setActionHandler(a,fn);}catch(_){}});
    if(duration>0) try{navigator.mediaSession.setPositionState?.({duration,playbackRate:speed,position:Math.min(currentTime,duration)});}catch(_){}
    return()=>Object.keys(h).forEach(a=>{try{navigator.mediaSession.setActionHandler(a,null);}catch(_){};});
  },[activeSong,isPlaying,currentTime,duration,speed,play,pause,next,previous,seekTo]);

  /* Filtered songs */
  const filteredSongs = useMemo(()=>{
    let list=[...songs];
    if(searchQuery.trim()){const q=searchQuery.toLowerCase();list=list.filter(s=>s.title.toLowerCase().includes(q)||(s.artist||'').toLowerCase().includes(q));}
    if(sortBy==='name') list.sort((a,b)=>a.title.localeCompare(b.title));
    if(sortBy==='artist') list.sort((a,b)=>(a.artist||'').localeCompare(b.artist||''));
    if(sortBy==='recent') list.sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
    return list;
  },[songs,searchQuery,sortBy]);

  const bg1 = dominantColor?`rgba(${dominantColor},0.20)`:'rgba(6,182,212,0.08)';
  const bg2 = dominantColor?`rgba(${dominantColor},0.12)`:'rgba(168,85,247,0.06)';

  /* ════════════════════════════════════════════════════════════════
     LOADING
     ════════════════════════════════════════════════════════════════ */
  if (!libReady) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{background:'#07071a'}}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)'}}>
          <Music2 className="w-8 h-8 text-white"/>
        </div>
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"/>
        <p className="text-gray-500 text-sm">Chargement…</p>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{background:'#07071a'}}>

      {/* Hidden input */}
      <input ref={folderInputRef} type="file" accept="audio/*,video/mp4" multiple
        webkitdirectory="" directory="" className="hidden" onChange={handleFolderInput}/>

      {/* ── Cinematic BG ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AnimatePresence>
          {activeSong && (
            <motion.div key={activeSong.id}
              initial={{opacity:0,scale:1.1}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
              transition={{duration:1.4,ease:'easeOut'}}
              className="absolute inset-0"
              style={{backgroundImage:`url(${cover})`,backgroundSize:'cover',backgroundPosition:'center',filter:'blur(65px) saturate(1.8)',transform:'scale(1.35)'}}/>
          )}
        </AnimatePresence>
        <div className="absolute inset-0" style={{background:'rgba(7,7,26,0.85)'}}/>
        <div className="absolute inset-0 transition-all duration-1000"
          style={{background:`radial-gradient(ellipse at 30% 20%,${bg1} 0%,transparent 55%),radial-gradient(ellipse at 70% 80%,${bg2} 0%,transparent 55%)`}}/>
      </div>

      {/* Mode transition */}
      <AnimatePresence>
        {modeTransition && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[1000] flex items-center justify-center" style={{background:'#050510'}}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 60px rgba(6,182,212,0.55)'}}>
                <Wifi className="w-9 h-9 text-white"/>
              </div>
              <p className="text-white font-black text-xl">Mode Online</p>
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3,duration:0.65}}
                className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{transformOrigin:'left'}}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════
          TAB: PLAYER (Now Playing)
      ════════════════════════════════════════════════════════════ */}
      {activeTab === 'player' && (
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Header */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4 pt-safe pb-2"
            style={{paddingTop:'calc(env(safe-area-inset-top,0px)+12px)'}}>
            <button onClick={()=>navigate('/')}
              className="w-9 h-9 rounded-xl bg-white/[0.08] backdrop-blur-sm text-gray-300 flex items-center justify-center active:scale-90 transition-all">
              <Home className="w-4 h-4"/>
            </button>
            <div className="flex-1 text-center">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">En lecture</p>
            </div>
            <button onClick={goOnline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-xs font-semibold active:scale-90 transition-all">
              <Wifi className="w-3 h-3"/>Online
            </button>
          </div>

          {/* Scan bar */}
          <AnimatePresence>
            {isScanning && (
              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                className="flex-shrink-0 px-4 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-cyan-400 text-[10px] font-semibold flex-1 truncate">
                    {scanStats.current?`Scan : ${scanStats.current}`:'Scan en cours…'}
                  </p>
                  {scanStats.total>0&&<p className="text-gray-600 text-[10px]">{scanStats.processed}/{scanStats.total}</p>}
                </div>
                <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
                    style={{width:scanStats.total>0?`${(scanStats.processed/scanStats.total)*100}%`:'30%'}}
                    animate={scanStats.total===0?{x:['0%','70%','0%']}:{}}
                    transition={{duration:1.5,repeat:Infinity,ease:'easeInOut'}}/>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!activeSong ? (
            /* ── EMPTY STATE ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
              <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}}
                className="w-24 h-24 rounded-3xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 0 80px rgba(6,182,212,0.3)'}}>
                <Music2 className="w-12 h-12 text-white"/>
              </motion.div>
              <div>
                <h2 className="text-white font-black text-2xl mb-2">Lecteur Local</h2>
                <p className="text-gray-400 text-sm leading-relaxed">Aucun fichier chargé.<br/>Ouvre un dossier pour commencer.</p>
              </div>
              <motion.button whileTap={{scale:0.95}}
                onClick={FSA_SUPPORTED&&!isIOS()?grantFSAAccess:grantInputAccess}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-base w-full"
                style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 8px 32px rgba(6,182,212,0.25)'}}>
                <FolderOpen className="w-5 h-5"/>
                Ouvrir ma musique
              </motion.button>
              <p className="text-gray-700 text-xs">MP3 · FLAC · AAC · WAV · OGG</p>
            </div>
          ) : (
            /* ── NOW PLAYING ── */
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 px-6 pt-2">

              {/* Cover — grande, cliquable pour swipe */}
              <div className="flex-shrink-0 relative my-4"
                onTouchStart={handleCoverTouchStart} onTouchEnd={handleCoverTouchEnd}>
                {/* Ambient glow */}
                <div className="absolute -inset-6 rounded-3xl pointer-events-none"
                  style={{background:`url(${cover})`,backgroundSize:'cover',backgroundPosition:'center',filter:'blur(40px)',opacity:0.35,transform:'scale(1.1)'}}/>
                <motion.div
                  animate={isPlaying&&isLocalPlaying?{scale:[1,1.01,1]}:{scale:1}}
                  transition={{duration:2,repeat:Infinity,ease:'easeInOut'}}
                  className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl"
                  style={{boxShadow:'0 0 60px rgba(6,182,212,0.15),0 20px 60px rgba(0,0,0,0.7)'}}>
                  <img src={cover} alt={activeSong.title} className="w-full h-full object-cover"/>
                  {/* Visualizer overlay */}
                  <canvas ref={canvasRef} className="absolute bottom-0 left-0 right-0 h-12 opacity-70"
                    width={400} height={48}/>
                </motion.div>
                {/* Swipe hint */}
                <p className="text-center text-gray-700 text-[10px] mt-2">← Glisse pour changer →</p>
              </div>

              {/* Song info + like */}
              <div className="flex-shrink-0 flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <NoTranslate tag="p" className="text-white font-black text-xl truncate notranslate leading-tight" translate="no"><NoTranslate className="truncate">{activeSong.title}</NoTranslate></NoTranslate>
                  <NoTranslate tag="p" className="text-cyan-400/80 text-sm truncate notranslate mt-0.5" translate="no"><NoTranslate className="truncate">{activeSong.artist}</NoTranslate></NoTranslate>
                  {activeSong.album && <p className="text-gray-600 text-xs truncate mt-0.5">{activeSong.album}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                  <SleepBadge remaining={sleepTimer}/>
                  <button onClick={()=>setFavorited(v=>!v)} className={`p-2 rounded-full transition-all active:scale-90 ${favorited?'text-pink-500':'text-gray-600 hover:text-pink-400'}`}>
                    <Heart className={`w-5 h-5 ${favorited?'fill-current':''}`}/>
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="flex-shrink-0 mb-1">
                <ProgressBar current={currentTime} duration={duration} onSeek={t=>seekTo?.(t)}/>
                <div className="flex justify-between text-gray-600 text-[10px] tabular-nums -mt-1">
                  <span>{fmtDur(currentTime)}</span>
                  <span>{fmtDur(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex-shrink-0 flex items-center justify-between mb-4">
                <button onClick={()=>{toggleShuffle?.();vibrate(8);showOSD('🔀',shuffle?'Aléatoire off':'Aléatoire');}}
                  className={`p-3 rounded-full transition-all active:scale-90 ${shuffle?'text-cyan-400 bg-cyan-500/15':'text-gray-500'}`}>
                  <Shuffle className="w-5 h-5"/>
                </button>
                <button onClick={()=>{previous?.();vibrate(15);}}
                  className="p-3 rounded-full text-white hover:text-cyan-400 active:scale-90 transition-all">
                  <SkipBack className="w-7 h-7"/>
                </button>
                <motion.button whileTap={{scale:0.9}}
                  onClick={()=>{togglePlayPause?.();vibrate(12);}}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl"
                  style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 30px rgba(6,182,212,0.4)'}}>
                  {isPlaying&&isLocalPlaying
                    ? <Pause className="w-7 h-7"/>
                    : <Play className="w-7 h-7 ml-0.5"/>}
                </motion.button>
                <button onClick={()=>{next?.();vibrate(15);}}
                  className="p-3 rounded-full text-white hover:text-cyan-400 active:scale-90 transition-all">
                  <SkipForward className="w-7 h-7"/>
                </button>
                <button onClick={()=>{cycleRepeat?.();vibrate(8);}}
                  className={`p-3 rounded-full transition-all active:scale-90 ${repeat!=='off'?'text-cyan-400 bg-cyan-500/15':'text-gray-500'}`}>
                  {repeat==='one' ? <Repeat1 className="w-5 h-5"/> : <Repeat className="w-5 h-5"/>}
                </button>
              </div>

              {/* Volume + Extra controls */}
              <div className="flex-shrink-0 flex items-center gap-3 mb-4">
                <button onClick={()=>setIsMuted(v=>!v)} className="text-gray-500 active:scale-90 transition-all">
                  <VolumeIcon className="w-4 h-4"/>
                </button>
                <div className="flex-1 relative h-6 flex items-center cursor-pointer"
                  onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setVolume(Math.round(((e.clientX-r.left)/r.width)*100));setIsMuted(false);}}>
                  <div className="w-full h-1 bg-white/[0.1] rounded-full">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400" style={{width:`${isMuted?0:volume}%`}}/>
                  </div>
                </div>
                <button onClick={()=>setShowMenu(v=>!v)} className="text-gray-500 active:scale-90 transition-all">
                  <MoreVertical className="w-4 h-4"/>
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB: LIBRARY
      ════════════════════════════════════════════════════════════ */}
      {activeTab === 'library' && (
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Header */}
          <div className="flex-shrink-0 px-4 pb-2"
            style={{paddingTop:'calc(env(safe-area-inset-top,0px)+12px)'}}>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1">
                <p className="text-white font-black text-lg">Ma bibliothèque</p>
                <p className="text-gray-500 text-xs">{songs.length} fichier{songs.length!==1?'s':''}</p>
              </div>
              {accessGranted && (
                <button onClick={isScanning?undefined:(FSA_SUPPORTED&&!isIOS()?handleRescan:grantInputAccess)}
                  className="w-9 h-9 rounded-xl bg-white/[0.08] text-gray-400 hover:text-cyan-400 flex items-center justify-center active:scale-90 transition-all">
                  <RefreshCw className={`w-4 h-4 ${isScanning?'animate-spin text-cyan-400':''}`}/>
                </button>
              )}
              <button onClick={FSA_SUPPORTED&&!isIOS()?grantFSAAccess:grantInputAccess}
                className="w-9 h-9 rounded-xl bg-white/[0.08] text-gray-400 hover:text-cyan-400 flex items-center justify-center active:scale-90 transition-all">
                <FolderOpen className="w-4 h-4"/>
              </button>
              {songs.length>0&&(
                <button onClick={()=>{setSelectionMode(v=>!v);setSelectedIds(new Set());}}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectionMode?'bg-cyan-500/20 text-cyan-400':'bg-white/[0.08] text-gray-400'}`}>
                  {selectionMode?'Annuler':'Sélect.'}
                </button>
              )}
            </div>
            {/* Search + Sort */}
            {songs.length > 0 && (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-2 border border-white/[0.08]">
                  <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0"/>
                  <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                    placeholder="Titre, artiste…" className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 outline-none min-w-0"/>
                  {searchQuery && <button onClick={()=>setSearchQuery('')}><X className="w-3.5 h-3.5 text-gray-500"/></button>}
                </div>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                  className="bg-white/[0.06] border border-white/[0.08] text-gray-400 rounded-xl px-2 text-xs outline-none">
                  <option value="default">Défaut</option>
                  <option value="name">Titre</option>
                  <option value="artist">Artiste</option>
                  <option value="recent">Récent</option>
                </select>
              </div>
            )}
            {/* Selection actions */}
            {selectionMode && selectedIds.size > 0 && (
              <div className="flex gap-2 mt-2">
                <button onClick={()=>setShowModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-xs font-semibold active:scale-95 transition-all">
                  <Save className="w-3.5 h-3.5"/>Créer playlist ({selectedIds.size})
                </button>
                <button onClick={()=>{[...selectedIds].forEach(id=>{const s=songs.find(x=>x.id===id);if(s)handleRemoveSong(s);});setSelectionMode(false);setSelectedIds(new Set());}}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold active:scale-95 transition-all">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            )}
          </div>

          {/* Scan bar */}
          <AnimatePresence>
            {isScanning && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-shrink-0 px-4 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-cyan-400 text-[10px] flex-1 truncate">{scanStats.current||'Scan en cours…'}</p>
                  {scanStats.total>0&&<p className="text-gray-600 text-[10px]">{scanStats.processed}/{scanStats.total}</p>}
                </div>
                <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
                    style={{width:scanStats.total>0?`${(scanStats.processed/scanStats.total)*100}%`:'30%'}}
                    animate={scanStats.total===0?{x:['0%','70%','0%']}:{}}
                    transition={{duration:1.5,repeat:Infinity,ease:'easeInOut'}}/>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Song list */}
          <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:'none'}}>
            {filteredSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-12 px-8 text-center">
                <Music2 className="w-12 h-12 text-gray-700"/>
                {songs.length === 0 ? (
                  <>
                    <p className="text-gray-400 text-sm">Aucun fichier.<br/>Appuie sur 📂 pour ouvrir ta musique.</p>
                    <button onClick={FSA_SUPPORTED&&!isIOS()?grantFSAAccess:grantInputAccess}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold text-sm"
                      style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)'}}>
                      <FolderOpen className="w-4 h-4"/>Ouvrir ma musique
                    </button>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">Aucun résultat pour « {searchQuery} »</p>
                )}
              </div>
            ) : (
              <div className="pb-4">
                {filteredSongs.map(song=>(
                  <SongRow key={song.id} song={song}
                    isActive={currentSong?.id===song.id} isPlaying={isPlaying}
                    onPlay={handlePlaySong} onRemove={handleRemoveSong}
                    selectionMode={selectionMode} isSelected={selectedIds.has(song.id)}
                    onToggleSelect={id=>setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;})}/>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB: PLAYLISTS
      ════════════════════════════════════════════════════════════ */}
      {activeTab === 'playlists' && (
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-shrink-0 px-4 pb-3"
            style={{paddingTop:'calc(env(safe-area-inset-top,0px)+12px)'}}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-white font-black text-lg">Playlists</p>
                <p className="text-gray-500 text-xs">{savedPlaylists.length} playlist{savedPlaylists.length!==1?'s':''}</p>
              </div>
              {songs.length>0&&(
                <button onClick={()=>{setNewPlName('');setShowModal(true);}}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-sm font-semibold active:scale-90 transition-all">
                  <Plus className="w-4 h-4"/>Créer
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4" style={{scrollbarWidth:'none'}}>
            {savedPlaylists.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <ListMusic className="w-12 h-12 text-gray-700"/>
                <p className="text-gray-400 text-sm">Aucune playlist.<br/>Crée une playlist depuis ta bibliothèque.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-4">
                {savedPlaylists.map(pl=>(
                  <motion.div key={pl.id} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                    className="relative group bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden active:scale-95 transition-all cursor-pointer"
                    onClick={()=>handleSelectPlaylist(pl)}>
                    <div className="aspect-square relative">
                      <img src={pl.songs[0]?.cover_url||pl.songs[0]?.coverUrl||makeCoverSvg(pl.name,'')} alt="" className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <NoTranslate tag="p" className="text-white text-xs font-bold truncate notranslate" translate="no">{pl.name}</NoTranslate>
                        <p className="text-gray-400 text-[10px]">{pl.songs.length} titre{pl.songs.length!==1?'s':''}</p>
                      </div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();handleDeletePlaylist(pl.id);}}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-all">
                      <X className="w-3 h-3"/>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          BOTTOM TAB BAR — style lecteur natif
      ════════════════════════════════════════════════════════════ */}
      <div className="relative z-30 flex-shrink-0 border-t border-white/[0.06]"
        style={{background:'rgba(7,7,26,0.92)',backdropFilter:'blur(20px)',paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
        <div className="flex">
          {[
            { key:'library', icon:Library, label:'Bibliothèque' },
            { key:'player',  icon:Disc3,   label:'Lecture' },
            { key:'playlists',icon:ListMusic,label:'Playlists' },
          ].map(({key,icon:Icon,label})=>(
            <button key={key} onClick={()=>setActiveTab(key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all active:scale-90 ${activeTab===key?'text-cyan-400':'text-gray-600'}`}>
              <div className="relative">
                <Icon className="w-5 h-5"/>
                {/* Badge playing indicator on player tab */}
                {key==='player'&&isLocalPlaying&&isPlaying&&(
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 border border-gray-950"/>
                )}
              </div>
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════ */}

      {/* Playlist save modal */}
      <AnimatePresence>
        {showPlaylistModal && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={()=>setShowModal(false)}/>
            <motion.div initial={{opacity:0,y:60}} animate={{opacity:1,y:0}} exit={{opacity:0,y:60}}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
              style={{background:'#111827',paddingBottom:'calc(env(safe-area-inset-bottom,0px)+24px)'}}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5"/>
              <p className="text-white font-black text-lg mb-4">Nouvelle playlist</p>
              <input value={newPlName} onChange={e=>setNewPlName(e.target.value)}
                placeholder="Nom de la playlist…"
                className="w-full bg-white/[0.06] border border-white/[0.1] text-white rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-cyan-500/50 placeholder-gray-600"
                autoFocus/>
              <div className="flex gap-3">
                <button onClick={()=>setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] text-gray-400 font-semibold text-sm">
                  Annuler
                </button>
                <button onClick={()=>newPlName.trim()&&handleSavePlaylist(newPlName.trim())}
                  disabled={!newPlName.trim()}
                  className="flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40"
                  style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)'}}>
                  Créer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sleep timer modal */}
      <AnimatePresence>
        {showSleepModal && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={()=>setShowSleepModal(false)}/>
            <motion.div initial={{opacity:0,y:60}} animate={{opacity:1,y:0}} exit={{opacity:0,y:60}}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5"
              style={{background:'#111827',paddingBottom:'calc(env(safe-area-inset-bottom,0px)+20px)'}}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"/>
              <p className="text-white font-black text-base mb-4 flex items-center gap-2"><Timer className="w-4 h-4 text-amber-400"/>Minuterie de sommeil</p>
              <div className="grid grid-cols-3 gap-2">
                {[null,[5*60,'5 min'],[10*60,'10 min'],[15*60,'15 min'],[30*60,'30 min'],[60*60,'1h'],[-1,'Fin morceau']].map((item,i)=>{
                  const [val,label] = item ? item : [null,'Désactiver'];
                  return (
                    <button key={i} onClick={()=>handleSetSleepTimer(val)}
                      className={`py-3 rounded-xl text-sm font-semibold transition-all active:scale-90 ${!val&&!sleepTimerTarget?'bg-amber-500/20 border border-amber-500/30 text-amber-400':'bg-white/[0.06] border border-white/[0.08] text-gray-300 hover:bg-white/[0.1]'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Speed modal */}
      <AnimatePresence>
        {showSpeedModal && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={()=>setShowSpeedModal(false)}/>
            <motion.div initial={{opacity:0,y:60}} animate={{opacity:1,y:0}} exit={{opacity:0,y:60}}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5"
              style={{background:'#111827',paddingBottom:'calc(env(safe-area-inset-bottom,0px)+20px)'}}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"/>
              <p className="text-white font-black text-base mb-4 flex items-center gap-2"><Gauge className="w-4 h-4 text-cyan-400"/>Vitesse de lecture</p>
              <div className="grid grid-cols-4 gap-2">
                {[0.5,0.75,1,1.25,1.5,1.75,2,2.5].map(s=>(
                  <button key={s} onClick={()=>handleSetSpeed(s)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-90 ${speed===s?'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400':'bg-white/[0.06] border border-white/[0.08] text-gray-300'}`}>
                    {s}×
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* More menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="fixed inset-0 z-40 bg-black/50" onClick={()=>setShowMenu(false)}/>
            <motion.div initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:0.95}}
              className="fixed bottom-24 right-4 z-50 w-48 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              style={{background:'#1a1a2e'}}>
              {[
                {icon:Timer,label:'Minuterie sommeil',action:()=>{setShowMenu(false);setShowSleepModal(true);}},
                {icon:Gauge,label:`Vitesse (${speed}×)`,action:()=>{setShowMenu(false);setShowSpeedModal(true);}},
                {icon:Save,label:'Créer playlist',action:()=>{setShowMenu(false);setNewPlName('');setShowModal(true);}},
                {icon:Trash2,label:'Vider bibliothèque',action:()=>{setShowMenu(false);handleClearLibrary();}},
                {icon:WifiOff,label:'Mode hors-ligne',action:()=>setShowMenu(false)},
              ].map(({icon:Icon,label,action},i)=>(
                <button key={i} onClick={action}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-white/[0.05] text-sm transition-all border-b border-white/[0.05] last:border-0">
                  <Icon className="w-4 h-4 text-cyan-400 flex-shrink-0"/>
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* OSD */}
      <OSDOverlay osd={osd}/>
    </div>
  );
});

export default LocalPlayerPageMobile;
