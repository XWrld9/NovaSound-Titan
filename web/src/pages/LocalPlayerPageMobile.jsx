/**
 * LocalPlayerPageMobile — NovaSound TITAN LUX V5000000
 *
 * ✅ REFONTE TOTALE — Détection automatique des fichiers audio
 * ✅ Android/Desktop (FSA) : showDirectoryPicker → accès dossier mémorisé à vie
 *    → Auto-reconnect silencieux à chaque visite (zéro interaction utilisateur)
 * ✅ iOS Safari : <input webkitdirectory> → sélection dossier entier, blobs persistés en IDB
 * ✅ Bibliothèque restaurée instantanément depuis IndexedDB à chaque ouverture
 * ✅ Plus d'import fichier par fichier — se comporte comme VLC / Poweramp / Apple Music
 * ✅ Toutes les features conservées : Media Session, swipe cover, OSD, sleep timer, speed, visualizer
 * ✅ ID3v2 parser natif + pochettes embedded
 * ✅ Playlists persistées en IDB
 * ✅ TDZ-safe : tous les sous-composants déclarés AVANT le composant principal
 */

import React, {
  useState, useRef, useCallback, useEffect, memo, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ListMusic, Trash2, Plus, Play, Pause,
  SkipBack, SkipForward, Shuffle, Repeat, Save,
  CheckSquare, Square, Search, X, Music2,
  ChevronUp, HardDrive, WifiOff, Wifi, Volume2, VolumeX,
  Timer, Heart, FolderOpen, Gauge, ListOrdered,
  RefreshCw, AlertCircle, Clock,
} from 'lucide-react';
import { usePlayer }     from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';
import { supabase }      from '@/lib/supabaseClient';

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
   INDEXEDDB  (v3 — 4 stores)
   ═══════════════════════════════════════════════════════════════════ */
const IDB_NAME    = 'novasound_local_v3';
const IDB_VERSION = 1;

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

const idbGet    = (store, key)    => idbTx(store,'readonly', (os,res) => { const r=os.get(key);    r.onsuccess=()=>res(r.result);       });
const idbGetAll = (store)         => idbTx(store,'readonly', (os,res) => { const r=os.getAll();    r.onsuccess=()=>res(r.result||[]);    });
const idbPut    = (store, val)    => idbTx(store,'readwrite',(os,res) => { os.put(val);  res();                                         });
const idbDelete = (store, key)    => idbTx(store,'readwrite',(os,res) => { os.delete(key); res();                                       });
const idbClear  = (store)         => idbTx(store,'readwrite',(os,res) => { os.clear();  res();                                          });
const idbBulkPut= (store, items)  => idbTx(store,'readwrite',(os,res) => { items.forEach(i=>os.put(i)); res();                          });

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
  catch(_){ return `data:image/svg+xml,${encodeURIComponent(svg)}`; }
};

/* ═══════════════════════════════════════════════════════════════════
   ID3v2 PARSER
   ═══════════════════════════════════════════════════════════════════ */
const parseID3 = async file => {
  const meta = { title:'', artist:'', album:'', cover:null };
  if (file.size > 500*1024*1024) return meta;
  try {
    const bytes = new Uint8Array(await Promise.race([
      file.slice(0,512*1024).arrayBuffer(),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),8000)),
    ]));
    if (bytes[0]!==0x49||bytes[1]!==0x44||bytes[2]!==0x33) return meta;
    const ss=(b,o)=>((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f);
    let pos=10; const end=ss(bytes,6)+10;
    const dec=new TextDecoder('utf-8',{fatal:false});
    while(pos<end-10&&pos<bytes.length-10){
      const fid=String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      const fsz=(bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
      if(fsz<=0||fsz>300000) break;
      const data=bytes.slice(pos+10,pos+10+fsz);
      const txt=data[0]===0?dec.decode(data.slice(1)):new TextDecoder('utf-16le',{fatal:false}).decode(data.slice(3));
      if(fid==='TIT2') meta.title=txt.replace(/\0/g,'').trim();
      else if(fid==='TPE1') meta.artist=txt.replace(/\0/g,'').trim();
      else if(fid==='TALB') meta.album=txt.replace(/\0/g,'').trim();
      else if(fid==='APIC'&&!meta.cover){
        let me=1; while(me<data.length&&data[me]!==0) me++;
        const mime=dec.decode(data.slice(1,me))||'image/jpeg';
        let i=me+2; while(i<data.length&&data[i]!==0) i++; i++;
        try{ meta.cover=URL.createObjectURL(new Blob([data.slice(i)],{type:mime})); }catch(_){}
      }
      pos+=10+fsz;
    }
  } catch(_){}
  return meta;
};

/* ═══════════════════════════════════════════════════════════════════
   SUPABASE TRACKING
   ═══════════════════════════════════════════════════════════════════ */
const logPlayHistory = async (song, userId) => {
  try { await supabase.from('local_play_history').insert({ user_id:userId, title:song.title, artist:song.artist, file_name:song._fileName, played_at:new Date().toISOString() }); } catch(_){}
};
const startSession = async (userId, filesCount) => {
  try {
    const { data } = await supabase.from('local_player_sessions').insert({ user_id:userId, files_count:filesCount, started_at:new Date().toISOString(), platform:navigator.userAgent.slice(0,80) }).select('id').single();
    if (data?.id) localStorage.setItem('_lps_id', data.id);
  } catch(_){}
};
const endSession = async () => {
  try {
    const id=localStorage.getItem('_lps_id'); if(!id) return;
    await supabase.from('local_player_sessions').update({ ended_at:new Date().toISOString() }).eq('id',id);
    localStorage.removeItem('_lps_id');
  } catch(_){}
};

/* ═══════════════════════════════════════════════════════════════════
   DOMINANT COLOR
   ═══════════════════════════════════════════════════════════════════ */
const extractDominantColor = imgSrc => new Promise(resolve => {
  if (!imgSrc||imgSrc.startsWith('data:image/svg')){ resolve(null); return; }
  const img=new Image(); img.crossOrigin='anonymous';
  img.onload=()=>{
    try{
      const c=document.createElement('canvas'); c.width=c.height=8;
      const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,8,8);
      const d=ctx.getImageData(0,0,8,8).data; let r=0,g=0,b=0;
      for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}
      const n=d.length/4; resolve(`${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)}`);
    }catch(_){ resolve(null); }
  };
  img.onerror=()=>resolve(null); img.src=imgSrc;
});

/* ═══════════════════════════════════════════════════════════════════
   VISUALIZER HOOK
   ═══════════════════════════════════════════════════════════════════ */
const useVisualizer = (active, canvasRef) => {
  const rafRef=useRef(null), analyserRef=useRef(null), ctxRef=useRef(null);
  const connect=useCallback(()=>{
    const audio=document.querySelector('audio'); if(!audio||!canvasRef.current) return;
    try{
      if(!ctxRef.current){
        const ctx=new(window.AudioContext||window.webkitAudioContext)();
        const a=ctx.createAnalyser(); a.fftSize=64;
        ctx.createMediaElementSource(audio).connect(a); a.connect(ctx.destination);
        ctxRef.current=ctx; analyserRef.current=a;
      }
    }catch(_){}
  },[canvasRef]);
  const draw=useCallback(()=>{
    const canvas=canvasRef.current, analyser=analyserRef.current; if(!canvas||!analyser) return;
    const ctx=canvas.getContext('2d'), W=canvas.width, H=canvas.height;
    const data=new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data);
    ctx.clearRect(0,0,W,H);
    const barW=W/data.length-1;
    data.forEach((val,i)=>{
      const h=(val/255)*H, g=ctx.createLinearGradient(0,H-h,0,H);
      g.addColorStop(0,'rgba(34,211,238,0.9)'); g.addColorStop(1,'rgba(168,85,247,0.5)');
      ctx.fillStyle=g; ctx.fillRect(i*(barW+1),H-h,barW,h);
    });
    rafRef.current=requestAnimationFrame(draw);
  },[canvasRef]);
  useEffect(()=>{
    if(active){ connect(); draw(); }
    else{
      cancelAnimationFrame(rafRef.current);
      const c=canvasRef.current; if(c) c.getContext('2d')?.clearRect(0,0,c.width,c.height);
    }
    return ()=>cancelAnimationFrame(rafRef.current);
  },[active,connect,draw]);
};

/* ═══════════════════════════════════════════════════════════════════
   FSA DIRECTORY WALKER
   ═══════════════════════════════════════════════════════════════════ */
async function* walkDir(dirHandle, path='') {
  for await (const entry of dirHandle.values()) {
    const p = path ? `${path}/${entry.name}` : entry.name;
    if (entry.kind==='file' && AUDIO_EXTS.test(entry.name)) yield { entry, path: p };
    else if (entry.kind==='directory') yield* walkDir(entry, p);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS  — MUST be declared BEFORE main component (TDZ-safe)
   ═══════════════════════════════════════════════════════════════════ */

/* SeekBar */
const SeekBar = memo(({ currentTime, duration, onSeek }) => {
  const pct = duration>0 ? (currentTime/duration)*100 : 0;
  return (
    <div className="w-full px-1 flex flex-col gap-1">
      <div className="relative h-1 rounded-full bg-white/[0.10] cursor-pointer"
        onClick={e=>{const r=e.currentTarget.getBoundingClientRect(); onSeek?.((e.clientX-r.left)/r.width*duration);}}>
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all" style={{width:`${pct}%`}}/>
        <input type="range" min={0} max={duration||0} step={0.5} value={currentTime}
          onChange={e=>onSeek?.(+e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"/>
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-gray-600">
        <span>{fmtDur(currentTime)}</span><span>{fmtDur(duration)}</span>
      </div>
    </div>
  );
});
SeekBar.displayName='SeekBar';

/* SleepTimerBadge */
const SleepTimerBadge = memo(({ remaining }) => {
  if (!remaining) return null;
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[9px] font-bold rounded-full border border-orange-500/20">
      <Clock className="w-2.5 h-2.5"/>{fmtMin(remaining)}
    </span>
  );
});
SleepTimerBadge.displayName='SleepTimerBadge';

/* SleepModal */
const SleepModal = memo(({ onSet, onCancel }) => {
  const options=[{label:'Fin du morceau',value:-1},{label:'15 min',value:900},{label:'30 min',value:1800},{label:'45 min',value:2700},{label:'1 heure',value:3600},{label:'Désactiver',value:0}];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-[300] flex items-end justify-center"
      style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(6px)'}}
      onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
        transition={{type:'spring',damping:36,stiffness:380}}
        className="w-full rounded-t-3xl p-6 flex flex-col gap-3"
        style={{background:'#0d0d1d',paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 16px)'}}>
        <p className="text-white font-black text-base mb-1 text-center">⏰ Minuterie de sommeil</p>
        <div className="grid grid-cols-2 gap-2">
          {options.map(o=>(
            <button key={o.value} onClick={()=>onSet(o.value)}
              className="py-3 rounded-xl text-sm font-bold text-gray-300 active:scale-95 transition-all bg-white/[0.07] hover:bg-white/[0.12]">
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="w-full py-2.5 rounded-xl bg-white/[0.05] text-gray-500 text-sm active:scale-95">Fermer</button>
      </motion.div>
    </motion.div>
  );
});
SleepModal.displayName='SleepModal';

/* SpeedModal */
const SpeedModal = memo(({ currentSpeed, onSet, onCancel }) => {
  const speeds=[0.5,0.75,1,1.25,1.5,2];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-[300] flex items-end justify-center"
      style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(6px)'}}
      onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
        transition={{type:'spring',damping:36,stiffness:380}}
        className="w-full rounded-t-3xl p-6 flex flex-col gap-3"
        style={{background:'#0d0d1d',paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 16px)'}}>
        <p className="text-white font-black text-base mb-1 text-center">⚡ Vitesse de lecture</p>
        <div className="grid grid-cols-3 gap-2">
          {speeds.map(s=>(
            <button key={s} onClick={()=>onSet(s)}
              className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${currentSpeed===s?'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg':'bg-white/[0.07] text-gray-300 hover:bg-white/[0.12]'}`}>
              {s===1?'1× Normal':`${s}×`}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="w-full py-2.5 rounded-xl bg-white/[0.05] text-gray-500 text-sm active:scale-95">Fermer</button>
      </motion.div>
    </motion.div>
  );
});
SpeedModal.displayName='SpeedModal';

/* PlaylistModal */
const PlaylistModal = memo(({ onSave, onCancel }) => {
  const [name,setName]=useState('');
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)'}}
      onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{background:'#0d0d1d',border:'1px solid rgba(255,255,255,0.08)'}}>
        <p className="text-white font-black text-lg text-center">💾 Nouvelle playlist</p>
        <input ref={r=>{if(r){r.focus();r.select();}}}
          value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&name.trim()) onSave(name.trim());}}
          placeholder="Nom de la playlist…"
          className="px-4 py-3 bg-white/[0.06] border border-white/[0.10] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"/>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-gray-500 text-sm active:scale-95">Annuler</button>
          <button onClick={()=>name.trim()&&onSave(name.trim())}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold active:scale-95"
            style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)'}}>Créer</button>
        </div>
      </motion.div>
    </motion.div>
  );
});
PlaylistModal.displayName='PlaylistModal';

/* AccessScreen — shown on first launch or after permission revocation */
const AccessScreen = memo(({ onGrantFSA, onGrantInput, isScanning, scanStats }) => (
  <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
    className="relative z-10 flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
    <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
      style={{background:'linear-gradient(135deg,rgba(6,182,212,0.18),rgba(168,85,247,0.18))',border:'1px solid rgba(255,255,255,0.08)'}}>
      <HardDrive className="w-12 h-12 text-gray-600"/>
    </div>
    <div>
      <p className="text-white font-black text-2xl mb-2">Lecteur Local</p>
      <p className="text-gray-500 text-sm leading-relaxed">
        {FSA_SUPPORTED && !isIOS()
          ? "Accorde l'accès à ton dossier Musique.\nNovaSound s'en souvient automatiquement."
          : "Sélectionne ton dossier de musique.\nTes fichiers sont sauvegardés pour la prochaine fois."}
      </p>
    </div>
    {isScanning ? (
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"/>
        <p className="text-cyan-400 text-sm font-semibold">Scan en cours…</p>
        {scanStats.current && <p className="text-gray-600 text-xs truncate max-w-xs">{scanStats.current}</p>}
        {scanStats.total>0 && (
          <div className="w-full max-w-xs">
            <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full transition-all"
                style={{width:`${Math.min(100,(scanStats.processed/scanStats.total)*100)}%`}}/>
            </div>
            <p className="text-gray-600 text-[10px] text-center mt-1">{scanStats.processed} / {scanStats.total} fichiers</p>
          </div>
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <motion.button whileTap={{scale:0.96}}
          onClick={FSA_SUPPORTED && !isIOS() ? onGrantFSA : onGrantInput}
          className="flex items-center justify-center gap-3 px-7 py-4 rounded-2xl text-white font-bold text-base"
          style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 8px 30px rgba(6,182,212,0.3)'}}>
          <FolderOpen className="w-5 h-5"/>Accéder à ma musique
        </motion.button>
        <p className="text-gray-700 text-xs">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS</p>
      </div>
    )}
  </motion.div>
));
AccessScreen.displayName='AccessScreen';

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const LocalPlayerPageMobile = memo(() => {
  const navigate = useNavigate();

  /* ── Player Context ── */
  const {
    currentSong, isPlaying,
    playSong, play, pause, next, previous,
    togglePlayPause, queue,
    shuffle, toggleShuffle, repeat, cycleRepeat,
    seekTo,
  } = usePlayer();

  const { audioCurrentTime, audioDuration } = usePlayerTime();

  /* ── Library state ── */
  const [songs,          setSongs]          = useState([]);
  const [libReady,       setLibReady]       = useState(false);
  const [accessGranted,  setAccessGranted]  = useState(false);
  const [isScanning,     setIsScanning]     = useState(false);
  const [scanStats,      setScanStats]      = useState({ processed:0, total:0, current:'' });
  const [scanError,      setScanError]      = useState(null);

  /* ── Playlist state ── */
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [activeTab,      setActiveTab]      = useState('library');
  const [selectionMode,  setSelectionMode]  = useState(false);
  const [selectedIds,    setSelectedIds]    = useState(new Set());

  /* ── UI state ── */
  const [searchQuery,    setSearchQuery]    = useState('');
  const [sortBy,         setSortBy]         = useState('default');
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [showPlaylistModal, setShowModal]   = useState(false);
  const [modeTransition, setModeTransition] = useState(false);

  /* ── Player UI state ── */
  const [volume,         setVolume]         = useState(80);
  const [isMuted,        setIsMuted]        = useState(false);
  const [sleepTimer,     setSleepTimer]     = useState(null);
  const [sleepTimerTarget, setSleepTimerTarget] = useState(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [speed,          setSpeed]          = useState(1);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [dominantColor,  setDominantColor]  = useState(null);
  const [osd,            setOsd]            = useState(null);
  const [favorited,      setFavorited]      = useState(false);
  const [swipeHint,      setSwipeHint]      = useState(false);

  /* ── Refs ── */
  const folderInputRef    = useRef(null);
  const osdTimerRef       = useRef(null);
  const osdIdRef          = useRef(0);
  const sleepIntervalRef  = useRef(null);
  const isPlayingRef      = useRef(false);
  const canvasRef         = useRef(null);
  const dirHandleRef      = useRef(null);

  /* ── Derived ── */
  const isLocalPlaying = !!currentSong?.is_local;
  const activeSong     = isLocalPlaying ? currentSong : null;
  const duration       = isLocalPlaying ? (audioDuration||0) : 0;
  const currentTime    = isLocalPlaying ? (audioCurrentTime||0) : 0;
  const cover          = activeSong?.cover_url || activeSong?.coverUrl || makeCoverSvg(activeSong?.title||'', activeSong?.artist||'');
  const VolumeIcon     = isMuted||volume===0 ? VolumeX : Volume2;

  useEffect(()=>{ isPlayingRef.current=isPlaying; },[isPlaying]);
  useVisualizer(isPlaying&&isLocalPlaying, canvasRef);
  useEffect(()=>{ if(cover) extractDominantColor(cover).then(setDominantColor); },[cover]);
  useEffect(()=>{ const a=document.querySelector('audio'); if(a){ a.volume=isMuted?0:volume/100; a.muted=isMuted; } },[volume,isMuted]);
  useEffect(()=>{ const a=document.querySelector('audio'); if(a) a.playbackRate=speed; },[speed]);

  /* sleep timer */
  useEffect(()=>{
    clearInterval(sleepIntervalRef.current);
    if(!sleepTimerTarget||sleepTimerTarget===-1){ setSleepTimer(null); return; }
    const tick=()=>{
      const rem=Math.max(0,sleepTimerTarget-Math.floor(Date.now()/1000));
      setSleepTimer(rem);
      if(rem<=0){ clearInterval(sleepIntervalRef.current); document.querySelector('audio')?.pause(); setSleepTimerTarget(null); setSleepTimer(null); }
    };
    tick(); sleepIntervalRef.current=setInterval(tick,1000);
    return ()=>clearInterval(sleepIntervalRef.current);
  },[sleepTimerTarget]);

  /* session */
  useEffect(()=>{ startSession(null,0); return ()=>{ endSession(); }; },[]);

  /* ════════════════════════════════════════════════════════════════
     LIBRARY INIT — load IDB → auto-reconnect FSA if available
     ════════════════════════════════════════════════════════════════ */
  useEffect(()=>{ initLibrary(); },[]);

  const initLibrary = async () => {
    try {
      const [savedMeta, playlists] = await Promise.all([idbGetAll('songs_meta'), idbGetAll('playlists')]);
      setSavedPlaylists(playlists);

      if (savedMeta.length > 0) {
        /* Restore blob URLs for iOS songs stored as ArrayBuffers */
        const restored = await Promise.all(savedMeta.map(async meta => {
          if (!meta._hasBlobStored) return meta;
          try {
            const rec = await idbGet('song_blobs', meta.id);
            if (rec?.buffer) {
              const url = URL.createObjectURL(new Blob([rec.buffer], {type:meta._mimeType||'audio/mpeg'}));
              return {...meta, url, audio_url:url};
            }
          } catch(_){}
          return meta;
        }));
        /* Afficher toutes les chansons connues : FSA songs sans URL auront leur URL
           résolue par autoReconnectFSA (background) ou à la demande par handlePlaySong */
        setSongs(restored);
        setAccessGranted(true);
      }
      setLibReady(true);

      /* Try silent FSA reconnect (Android/Desktop) */
      if (FSA_SUPPORTED && !isIOS()) autoReconnectFSA();

    } catch(err) {
      console.error('[LocalPlayer] initLibrary:', err);
      setLibReady(true);
    }
  };

  /* Silent FSA auto-reconnect — no UI prompt, uses stored handle */
  const autoReconnectFSA = async () => {
    try {
      const stored = await idbGet('dir_handles','default');
      if (!stored?.handle) return;
      dirHandleRef.current = stored.handle;
      const perm = await stored.handle.queryPermission({mode:'read'});
      if (perm==='granted') {
        setAccessGranted(true);
        scanFromHandle(stored.handle, true); /* silent background scan */
      }
    } catch(_){}
  };

  /* ════════════════════════════════════════════════════════════════
     FSA — Grant access (Android / Desktop)
     ════════════════════════════════════════════════════════════════ */
  const grantFSAAccess = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({mode:'read', startIn:'music'});
      dirHandleRef.current = handle;
      await idbPut('dir_handles', {id:'default', handle});
      setAccessGranted(true);
      await scanFromHandle(handle, false);
    } catch(err) {
      if (err.name!=='AbortError') setScanError("Impossible d'accéder au dossier. Réessaie.");
    }
  },[]);

  /* ════════════════════════════════════════════════════════════════
     INPUT — iOS / fallback : <input webkitdirectory>
     ════════════════════════════════════════════════════════════════ */
  const grantInputAccess = useCallback(()=>{ folderInputRef.current?.click(); },[]);

  const handleFolderInput = useCallback(async e => {
    const files = Array.from(e.target.files||[]).filter(isAudioFile);
    e.target.value = '';
    if (!files.length) return;

    setIsScanning(true); setScanError(null);
    setScanStats({processed:0, total:files.length, current:''});

    const newSongs = [];
    for (let i=0; i<files.length; i++) {
      const file=files[i];
      setScanStats(s=>({...s, processed:i+1, current:file.name}));
      const raw=file.name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' ');
      const tags=await parseID3(file).catch(()=>({title:'',artist:'',album:'',cover:null}));
      const title=tags.title||raw, artist=tags.artist||'Artiste inconnu';
      const url=URL.createObjectURL(file);
      const id=`local::${file.name}::${file.size}`;
      let hasBlobStored=false;
      try{ const buf=await file.arrayBuffer(); await idbPut('song_blobs',{id,buffer:buf}); hasBlobStored=true; }catch(_){}
      newSongs.push({
        id, title, artist, album:tags.album||'', duration:0,
        url, audio_url:url,
        coverUrl:tags.cover||makeCoverSvg(title,artist),
        cover_url:tags.cover||makeCoverSvg(title,artist),
        _hasBlobCover:!!tags.cover, _hasBlobStored:hasBlobStored,
        _mimeType:file.type, _fileName:file.name, addedAt:Date.now(), is_local:true,
      });
    }

    /* Persist metadata (without blob URLs which are session-only) */
    await idbBulkPut('songs_meta', newSongs.map(s=>({...s,url:undefined,audio_url:undefined})));

    setSongs(prev=>{
      const ex=new Set(prev.map(s=>s.id));
      const fresh=newSongs.filter(s=>!ex.has(s.id));
      const merged=[...prev,...fresh];
      if(prev.length===0&&fresh.length>0) setTimeout(()=>{ playSong(fresh[0],fresh); logPlayHistory(fresh[0],null); },80);
      startSession(null,merged.length);
      return merged;
    });
    setAccessGranted(true);
    setIsScanning(false);
    setScanStats({processed:0,total:0,current:''});
    setDrawerOpen(false);
    setSwipeHint(true); setTimeout(()=>setSwipeHint(false),3000);
  },[playSong]);

  /* ════════════════════════════════════════════════════════════════
     FSA SCAN — walk directory
     • Nouvelles chansons  → parse ID3, ajouter à la lib
     • Chansons existantes → recréer leur blob URL (perdue entre sessions)
     ════════════════════════════════════════════════════════════════ */
  const scanFromHandle = useCallback(async (handle, silent=false) => {
    if (!silent){ setIsScanning(true); setScanError(null); }
    setScanStats({processed:0,total:0,current:''});
    try {
      const savedMeta    = await idbGetAll('songs_meta');
      const existingMap  = new Map(savedMeta.map(s=>[s.id,s]));
      const newSongs     = [];
      const urlRefresh   = []; // { id, url } pour les chansons déjà connues
      let processed      = 0;

      for await (const {entry, path} of walkDir(handle)) {
        const file = await entry.getFile();
        const id   = `local::${file.name}::${file.size}`;
        setScanStats(s=>({...s, processed:++processed, current:file.name}));

        const url = URL.createObjectURL(file);

        if (existingMap.has(id)) {
          /* Chanson déjà connue : on mémorise juste la nouvelle blob URL */
          urlRefresh.push({id, url});
        } else {
          /* Nouvelle chanson : parser les tags ID3 */
          const raw   = file.name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' ');
          const tags  = await parseID3(file).catch(()=>({title:'',artist:'',album:'',cover:null}));
          const title = tags.title||raw;
          const artist= tags.artist||'Artiste inconnu';
          newSongs.push({
            id, title, artist, album:tags.album||'', duration:0,
            url, audio_url:url,
            coverUrl  : tags.cover||makeCoverSvg(title,artist),
            cover_url : tags.cover||makeCoverSvg(title,artist),
            _hasBlobCover:!!tags.cover, _hasBlobStored:false,
            _mimeType:file.type, _fileName:file.name, _fsaPath:path,
            addedAt:Date.now(), is_local:true,
          });
        }
      }

      /* Persister les nouvelles chansons en IDB */
      if (newSongs.length>0) {
        await idbBulkPut('songs_meta', newSongs.map(s=>({...s,url:undefined,audio_url:undefined})));
      }

      /* Mettre à jour le state : injecter les blob URLs dans les chansons existantes + ajouter les nouvelles */
      setSongs(prev=>{
        const refreshMap = new Map(urlRefresh.map(r=>[r.id,r.url]));

        /* Chansons existantes avec URL fraîche */
        const refreshed = prev.map(s=>{
          const u = refreshMap.get(s.id);
          return u ? {...s, url:u, audio_url:u} : s;
        });

        /* Nouvelles chansons non encore présentes */
        const exIds  = new Set(refreshed.map(s=>s.id));
        const fresh  = newSongs.filter(s=>!exIds.has(s.id));
        const merged = [...refreshed, ...fresh];

        if (prev.length===0 && fresh.length>0) {
          setTimeout(()=>{ playSong(fresh[0],fresh); logPlayHistory(fresh[0],null); },80);
        }
        startSession(null, merged.length);
        if (!silent){ setDrawerOpen(false); setSwipeHint(true); setTimeout(()=>setSwipeHint(false),3000); }
        return merged;
      });

    } catch(err) {
      console.error('[LocalPlayer] scan:', err);
      if (!silent) setScanError('Erreur lors du scan : '+err.message);
    } finally {
      setIsScanning(false); setScanStats({processed:0,total:0,current:''});
    }
  },[playSong]);

  /* Rescan — request permission if needed */
  const handleRescan = useCallback(async () => {
    const stored=await idbGet('dir_handles','default').catch(()=>null);
    if (stored?.handle) {
      const perm=await stored.handle.requestPermission({mode:'read'});
      if (perm==='granted'){ dirHandleRef.current=stored.handle; scanFromHandle(stored.handle,false); return; }
    }
    grantFSAAccess();
  },[grantFSAAccess, scanFromHandle]);

  /* Clear entire library */
  const handleClearLibrary = useCallback(async () => {
    await Promise.all([idbClear('songs_meta'),idbClear('song_blobs'),idbClear('dir_handles')]);
    setSongs([]); setAccessGranted(false); dirHandleRef.current=null;
  },[]);

  /* ── Playlist management ── */
  const handleSavePlaylist = useCallback(async name => {
    const ids=selectionMode?[...selectedIds]:songs.map(s=>s.id);
    const sel=songs.filter(s=>ids.includes(s.id)); if(!sel.length) return;
    const pl={
      id:`pl-${Date.now()}`, name, createdAt:Date.now(),
      songs:sel.map(s=>({id:s.id,title:s.title,artist:s.artist,album:s.album||'',
        coverUrl:s.cover_url||s.coverUrl||makeCoverSvg(s.title,s.artist),
        cover_url:s.cover_url||s.coverUrl||makeCoverSvg(s.title,s.artist),
        is_local:true, _needsReimport:!s._hasBlobStored})),
    };
    await idbPut('playlists',pl);
    setSavedPlaylists(prev=>[...prev,pl]);
    setShowModal(false); setSelectionMode(false); setSelectedIds(new Set()); vibrate(20);
  },[selectionMode,selectedIds,songs]);

  const handleDeletePlaylist = useCallback(async id => {
    await idbDelete('playlists',id); setSavedPlaylists(prev=>prev.filter(p=>p.id!==id));
  },[]);

  const handleSelectPlaylist = useCallback(async pl => {
    const restored = await Promise.all(pl.songs.map(async meta => {
      /* 1. iOS blob store */
      if (meta._needsReimport) {
        try {
          const rec = await idbGet('song_blobs', meta.id);
          if (rec?.buffer) {
            const url = URL.createObjectURL(new Blob([rec.buffer], {type:'audio/mpeg'}));
            return {...meta, url, audio_url:url};
          }
        } catch(_) {}
      }
      /* 2. Chanson déjà en state avec URL */
      const live = songs.find(s => s.id === meta.id);
      if (live?.url || live?.audio_url) return live;
      /* 3. FSA fallback — recréer URL depuis directory handle */
      if (dirHandleRef.current && meta._fileName) {
        try {
          const file = await getFileByName(dirHandleRef.current, meta._fileName);
          if (file) {
            const url = URL.createObjectURL(file);
            return {...meta, url, audio_url:url};
          }
        } catch(_) {}
      }
      return meta;
    }));
    const playable = restored.filter(s => s.url || s.audio_url);
    if (!playable.length) { setScanError('Chansons introuvables. Rescanne ta bibliothèque.'); return; }
    playSong(playable[0], playable);
    setDrawerOpen(false);
    vibrate(15);
  },[songs, playSong, getFileByName]);

  const handleRemoveSong = useCallback(async song => {
    await Promise.all([idbDelete('songs_meta',song.id),idbDelete('song_blobs',song.id)].map(p=>p.catch(()=>{})));
    setSongs(prev=>prev.filter(s=>s.id!==song.id));
  },[]);

  /* Helper — trouver un fichier audio par nom dans un directory handle FSA */
  const getFileByName = useCallback(async (dirHandle, fileName) => {
    try {
      for await (const {entry} of walkDir(dirHandle)) {
        if (entry.name === fileName) return await entry.getFile();
      }
    } catch (_) {}
    return null;
  }, []);

  const handlePlaySong = useCallback(async song => {
    vibrate(8);
    let s = song;

    /* Si la chanson n'a pas d'URL (FSA song restaurée depuis IDB sans blob URL),
       on tente de récupérer le fichier depuis le directory handle stocké. */
    if (!s.url && !s.audio_url && dirHandleRef.current && s._fileName) {
      try {
        const file = await getFileByName(dirHandleRef.current, s._fileName);
        if (file) {
          const url = URL.createObjectURL(file);
          s = {...s, url, audio_url:url};
          /* Mettre à jour aussi le state pour les lectures suivantes */
          setSongs(prev => prev.map(p => p.id === s.id ? {...p, url, audio_url:url} : p));
        }
      } catch (_) {}
    }

    /* Si toujours pas d'URL : demander à l'utilisateur de rescanner */
    if (!s.url && !s.audio_url) {
      setScanError('Fichier introuvable. Rescanne ta bibliothèque pour rétablir l\'accès.');
      return;
    }

    playSong(
      {...s, audio_url:s.url||s.audio_url, cover_url:s.coverUrl||s.cover_url},
      songs.map(s=>({...s, audio_url:s.audio_url||s.url, cover_url:s.cover_url||s.coverUrl}))
    );
    logPlayHistory(song, null);
    setDrawerOpen(false);
  },[playSong, songs, getFileByName]);

  const goOnline = useCallback(()=>{ endSession(); setModeTransition(true); setTimeout(()=>navigate('/'),950); },[navigate]);

  /* OSD */
  const showOSD = useCallback((key,label,value=null)=>{
    if(osdTimerRef.current) clearTimeout(osdTimerRef.current);
    const id=++osdIdRef.current; setOsd({key,label,value,id});
    osdTimerRef.current=setTimeout(()=>setOsd(null),1600);
  },[]);

  const handleSetSleepTimer = useCallback(seconds=>{
    if(!seconds){ setSleepTimerTarget(null); setSleepTimer(null); showOSD('⏰','Minuterie désactivée'); }
    else if(seconds===-1){ setSleepTimerTarget(-1); showOSD('⏰','Fin du morceau'); }
    else{ setSleepTimerTarget(Math.floor(Date.now()/1000)+seconds); showOSD('⏰','Minuterie',fmtMin(seconds)); }
    setShowSleepModal(false); vibrate(12);
  },[showOSD]);

  const handleSetSpeed = useCallback(s=>{ setSpeed(s); setShowSpeedModal(false); vibrate(8); showOSD('⚡','Vitesse',`${s}×`); },[showOSD]);

  /* Cover swipe */
  const coverSwipeStart=useRef(null);
  const handleCoverTouchStart=useCallback(e=>{ coverSwipeStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now()}; },[]);
  const handleCoverTouchEnd=useCallback(e=>{
    if(!coverSwipeStart.current) return;
    const dx=e.changedTouches[0].clientX-coverSwipeStart.current.x;
    const dy=e.changedTouches[0].clientY-coverSwipeStart.current.y;
    const dt=Date.now()-coverSwipeStart.current.time;
    if(dt>400){ coverSwipeStart.current=null; return; }
    const ax=Math.abs(dx), ay=Math.abs(dy);
    if(ax>50&&ax>ay*1.5){
      if(dx<0){ next?.(); vibrate([15,5,15]); showOSD('→','⏭ Suivant'); }
      else{ previous?.(); vibrate([15,5,15]); showOSD('←','⏮ Précédent'); }
    } else if(ay>50&&ay>ax*1.5){
      if(dy<0){ setVolume(v=>{const n=Math.min(100,v+10); showOSD('↑','🔊 Volume',`${n}%`); return n;}); setIsMuted(false); vibrate(8); }
      else{ setVolume(v=>{const n=Math.max(0,v-10); showOSD('↓','🔉 Volume',`${n}%`); return n;}); vibrate(8); }
    }
    coverSwipeStart.current=null;
  },[next,previous,showOSD]);

  /* Filtered songs */
  const filteredSongs = useMemo(()=>{
    let list=[...songs];
    if(searchQuery.trim()){ const q=searchQuery.toLowerCase(); list=list.filter(s=>s.title.toLowerCase().includes(q)||(s.artist||'').toLowerCase().includes(q)); }
    if(sortBy==='name') list.sort((a,b)=>a.title.localeCompare(b.title));
    if(sortBy==='artist') list.sort((a,b)=>(a.artist||'').localeCompare(b.artist||''));
    if(sortBy==='recent') list.sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
    return list;
  },[songs,searchQuery,sortBy]);

  /* Media Session */
  useEffect(()=>{
    if(!('mediaSession' in navigator)||!activeSong) return;
    try{
      const src=activeSong.cover_url||activeSong.coverUrl||'/icon-192.png';
      navigator.mediaSession.metadata=new MediaMetadata({
        title:activeSong.title||'Titre inconnu', artist:activeSong.artist||'Fichier local',
        album:activeSong.album||'NovaSound Local',
        artwork:[{src,sizes:'192x192',type:src.startsWith('data:')?'image/png':'image/jpeg'},{src,sizes:'512x512',type:src.startsWith('data:')?'image/png':'image/jpeg'}],
      });
    }catch(_){}
    const h={play:()=>play?.(),pause:()=>pause?.(),nexttrack:()=>next?.(),previoustrack:()=>previous?.(),
      seekbackward:()=>seekTo?.(Math.max(0,currentTime-10)),seekforward:()=>seekTo?.(Math.min(duration,currentTime+10)),
      seekto:d=>{if(d.seekTime!=null) seekTo?.(d.seekTime);}};
    Object.entries(h).forEach(([a,fn])=>{ try{ navigator.mediaSession.setActionHandler(a,fn); }catch(_){} });
    if(duration>0) try{ navigator.mediaSession.setPositionState?.({duration,playbackRate:speed,position:Math.min(currentTime,duration)}); }catch(_){}
    return ()=>Object.keys(h).forEach(a=>{ try{ navigator.mediaSession.setActionHandler(a,null); }catch(_){} });
  },[activeSong,isPlaying,currentTime,duration,speed,play,pause,next,previous,seekTo]);

  /* Keyboard */
  useEffect(()=>{
    const h=e=>{
      const el=document.activeElement;
      if(el?.tagName==='INPUT'||el?.tagName==='TEXTAREA') return;
      switch(e.code){
        case 'Space': e.preventDefault();
          if(currentSong?.is_local){ togglePlayPause?.(); vibrate(12); showOSD('Espace',isPlayingRef.current?'⏸ Pause':'▶ Lecture'); }
          else if(songs.length){ playSong(songs[0],songs); showOSD('Espace','▶ Lecture'); } break;
        case 'ArrowLeft': e.preventDefault(); if(duration>0){ const t=Math.max(0,currentTime-10); seekTo?.(t); showOSD('←','⏪ -10s',fmtDur(t)); } break;
        case 'ArrowRight': e.preventDefault(); if(duration>0){ const t=Math.min(duration,currentTime+10); seekTo?.(t); showOSD('→','⏩ +10s',fmtDur(t)); } break;
        case 'ArrowUp': e.preventDefault(); setVolume(v=>{const n=Math.min(100,v+5); showOSD('↑','🔊 Volume',`${n}%`); return n;}); setIsMuted(false); break;
        case 'ArrowDown': e.preventDefault(); setVolume(v=>{const n=Math.max(0,v-5); showOSD('↓','🔉 Volume',`${n}%`); return n;}); break;
        case 'KeyM': setIsMuted(v=>{vibrate(8); showOSD('M',v?'🔊 Son activé':'🔇 Muet'); return !v;}); break;
        case 'KeyN': next?.(); vibrate(15); showOSD('N','⏭ Suivant'); break;
        case 'KeyP': previous?.(); vibrate(15); showOSD('P','⏮ Précédent'); break;
        case 'KeyS': toggleShuffle?.(); vibrate(8); showOSD('S',shuffle?'🔀 off':'🔀 Aléatoire'); break;
        case 'KeyR': cycleRepeat?.(); vibrate(8); showOSD('R',repeat==='off'?'🔁 Répéter tout':repeat==='all'?'🔂 Répéter 1':'🔁 Off'); break;
        default: break;
      }
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[songs,currentSong,currentTime,duration,togglePlayPause,seekTo,next,previous,playSong,toggleShuffle,shuffle,cycleRepeat,repeat,showOSD]);

  /* Dynamic BG */
  const bg1=dominantColor?`rgba(${dominantColor},0.18)`:'rgba(6,182,212,0.07)';
  const bg2=dominantColor?`rgba(${dominantColor},0.10)`:'rgba(168,85,247,0.06)';

  /* ════════════════════════════════════════════════════════════════
     LOADING SCREEN
     ════════════════════════════════════════════════════════════════ */
  if (!libReady) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{background:'#07071a'}}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"/>
        <p className="text-gray-500 text-sm">Chargement de la bibliothèque…</p>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{background:'#07071a'}}>

      {/* Hidden folder input (iOS / fallback) */}
      <input ref={folderInputRef} type="file" accept="audio/*,video/mp4" multiple
        webkitdirectory="" directory="" className="hidden"
        onChange={handleFolderInput}/>

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
        <div className="absolute inset-0" style={{background:'rgba(7,7,26,0.82)'}}/>
        <div className="absolute inset-0 transition-all duration-1000"
          style={{background:`radial-gradient(ellipse at 30% 20%, ${bg1} 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, ${bg2} 0%, transparent 55%)`}}/>
      </div>

      {/* ── Mode transition ── */}
      <AnimatePresence>
        {modeTransition && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center" style={{background:'#050510'}}>
            <motion.div initial={{scale:0.5,opacity:0}} animate={{scale:1,opacity:1}}
              transition={{type:'spring',stiffness:280,damping:22}} className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 60px rgba(6,182,212,0.55)'}}>
                <Wifi className="w-9 h-9 text-white"/>
              </div>
              <p className="text-white font-black text-xl">Mode Online</p>
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3,duration:0.65}}
                className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{transformOrigin:'left'}}/>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.div initial={{y:-30,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.1}}
        className="relative z-20 flex items-center gap-2 px-4 flex-shrink-0"
        style={{paddingTop:'calc(env(safe-area-inset-top,0px) + 12px)',paddingBottom:8}}>
        <button onClick={()=>navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/[0.08] backdrop-blur-sm text-gray-300 flex items-center justify-center active:scale-90 transition-all border border-white/[0.08]">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="flex-1">
          <p className="text-white font-black text-sm leading-none">Lecteur Local</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <WifiOff className="w-2.5 h-2.5 text-cyan-400"/>
            <p className="text-cyan-400/80 text-[10px] font-medium">
              100% hors-ligne · {songs.length} fichier{songs.length!==1?'s':''}
            </p>
            <SleepTimerBadge remaining={sleepTimer}/>
          </div>
        </div>
        <button onClick={goOnline}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-xs font-semibold active:scale-90 transition-all">
          <Wifi className="w-3 h-3"/>Online
        </button>
        {accessGranted && (
          <button onClick={isScanning?undefined:(FSA_SUPPORTED&&!isIOS()?handleRescan:grantInputAccess)}
            className="w-9 h-9 rounded-xl bg-white/[0.08] backdrop-blur-sm text-gray-300 hover:text-cyan-400 flex items-center justify-center active:scale-90 transition-all border border-white/[0.08]">
            <RefreshCw className={`w-4 h-4 ${isScanning?'animate-spin text-cyan-400':''}`}/>
          </button>
        )}
      </motion.div>

      {/* ── Scan progress (slim bar) ── */}
      <AnimatePresence>
        {isScanning && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="relative z-20 px-4 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-cyan-400 text-[10px] font-semibold flex-1 truncate">
                {scanStats.current?`Scan : ${scanStats.current}`:'Scan en cours…'}
              </p>
              {scanStats.total>0 && <p className="text-gray-600 text-[10px] tabular-nums">{scanStats.processed}/{scanStats.total}</p>}
            </div>
            <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
                animate={{width:scanStats.total>0?`${(scanStats.processed/scanStats.total)*100}%`:'60%'}}
                transition={{duration:0.3}}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OSD ── */}
      <AnimatePresence>
        {osd && (
          <motion.div key={osd.id} initial={{opacity:0,scale:0.85,y:-10}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.9}}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-0.5 px-5 py-2.5 rounded-2xl pointer-events-none"
            style={{background:'rgba(10,10,28,0.92)',border:'1px solid rgba(255,255,255,0.12)',backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            <p className="text-white text-sm font-bold whitespace-nowrap">{osd.label}</p>
            {osd.value && <p className="text-cyan-400 text-[11px] font-semibold">{osd.value}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scan error ── */}
      <AnimatePresence>
        {scanError && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            className="relative z-20 mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/25 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0"/>
            <p className="text-red-400 text-xs flex-1">{scanError}</p>
            <button onClick={()=>setScanError(null)} className="text-red-400/60 hover:text-red-400"><X className="w-3.5 h-3.5"/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════
          MAIN CONTENT
          ════════════════════════════════════════════════════════════ */}
      {!accessGranted && !isScanning ? (
        <AccessScreen onGrantFSA={grantFSAAccess} onGrantInput={grantInputAccess}
          isScanning={isScanning} scanStats={scanStats}/>

      ) : activeSong ? (
        /* ── NOW PLAYING ── */
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.15}}
          className="relative z-10 px-5 flex flex-col items-center flex-1 overflow-hidden" style={{paddingTop:4}}>

          <AnimatePresence>
            {swipeHint && (
              <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="absolute top-0 left-0 right-0 flex justify-center z-10">
                <span className="text-[10px] text-gray-500 font-medium bg-white/5 px-3 py-1 rounded-full">← Glissez la pochette pour changer →</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vinyl cover */}
          <div className="relative mb-3 flex-shrink-0"
            style={{width:'min(220px,52vw)',height:'min(220px,52vw)'}}
            onTouchStart={handleCoverTouchStart} onTouchEnd={handleCoverTouchEnd}>
            <motion.div animate={{scale:[1,1.12,1],opacity:[0.4,0.7,0.4]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{background:dominantColor?`radial-gradient(circle,rgba(${dominantColor},0.5),transparent 70%)`:'radial-gradient(circle,rgba(6,182,212,0.4),transparent 70%)',filter:'blur(20px)'}}/>
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{background:'repeating-radial-gradient(circle at 50% 50%,transparent 0px,transparent 4px,rgba(0,0,0,0.08) 4px,rgba(0,0,0,0.08) 5px)',zIndex:2}}/>
            <motion.div className="w-full h-full rounded-full overflow-hidden shadow-2xl"
              animate={{rotate:isPlaying?360:0}}
              transition={isPlaying?{duration:12,repeat:Infinity,ease:'linear'}:{duration:0.5}}
              style={{boxShadow:'0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(6,182,212,0.2)'}}>
              <img src={cover} alt={activeSong.title} className="w-full h-full object-cover"/>
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{zIndex:3}}>
              <div className="w-5 h-5 rounded-full bg-gray-950 border-2 border-gray-700 shadow-inner"/>
            </div>
            {isPlaying && <canvas ref={canvasRef} width={40} height={20} className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-10 opacity-80" style={{imageRendering:'pixelated'}}/>}
          </div>

          {/* Song info */}
          <div className="w-full text-center mb-2 px-2">
            <p className="text-white font-black text-xl truncate leading-tight">{activeSong.title}</p>
            <p className="text-gray-400 text-sm mt-0.5 truncate">{activeSong.artist}</p>
            {activeSong.album && <p className="text-gray-600 text-xs mt-0.5 truncate">{activeSong.album}</p>}
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <span className="text-[9px] bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full text-gray-500">Fichier local</span>
              {speed!==1 && <button onClick={()=>setShowSpeedModal(true)} className="text-[9px] bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 rounded-full text-violet-400 font-bold">⚡ {speed}×</button>}
            </div>
          </div>

          <div className="w-full px-1 mb-1 flex-shrink-0">
            <SeekBar currentTime={currentTime} duration={duration} onSeek={seekTo}/>
          </div>

          {/* Transport */}
          <div className="flex items-center justify-center gap-4 w-full mb-2 flex-shrink-0">
            <button type="button" onClick={()=>{toggleShuffle?.(); vibrate(8);}}
              className={`p-2 rounded-xl transition-all active:scale-90 ${shuffle?'text-cyan-400 bg-cyan-500/15':'text-gray-600'}`}>
              <Shuffle className="w-4 h-4"/>
            </button>
            <button type="button" onPointerDown={e=>{e.preventDefault(); previous?.(); vibrate(15);}}
              className="w-11 h-11 flex items-center justify-center text-gray-200 active:scale-90 transition-all">
              <SkipBack className="w-7 h-7 fill-current"/>
            </button>
            <motion.button type="button" whileTap={{scale:0.88}}
              onPointerDown={e=>{e.preventDefault(); togglePlayPause?.(); vibrate(12);}}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl flex-shrink-0"
              style={{background:dominantColor?`linear-gradient(135deg,rgb(${dominantColor}),#a855f7)`:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 6px 32px rgba(6,182,212,0.45)'}}>
              {isPlaying?<Pause className="w-7 h-7 text-white fill-current"/>:<Play className="w-7 h-7 text-white fill-current ml-0.5"/>}
            </motion.button>
            <button type="button" onPointerDown={e=>{e.preventDefault(); next?.(); vibrate(15);}}
              className="w-11 h-11 flex items-center justify-center text-gray-200 active:scale-90 transition-all">
              <SkipForward className="w-7 h-7 fill-current"/>
            </button>
            <button type="button" onClick={()=>{cycleRepeat?.(); vibrate(8);}}
              className={`relative p-2 rounded-xl transition-all active:scale-90 ${repeat!=='off'?'text-cyan-400 bg-cyan-500/15':'text-gray-600'}`}>
              <Repeat className="w-4 h-4"/>
              {repeat==='one' && <span className="absolute -top-0.5 -right-0.5 text-[7px] font-black bg-cyan-400 text-gray-950 rounded-full w-3 h-3 flex items-center justify-center">1</span>}
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2.5 w-full px-2 mb-2 flex-shrink-0">
            <button onClick={()=>{setIsMuted(v=>!v); vibrate(6);}} className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
              <VolumeIcon className="w-4 h-4"/>
            </button>
            <div className="flex-1 relative"
              onWheel={e=>{e.preventDefault(); const d=e.deltaY>0?-5:5; setVolume(v=>Math.max(0,Math.min(100,v+d))); setIsMuted(false);}}>
              <div className="h-1.5 rounded-full bg-white/[0.08] cursor-pointer relative overflow-hidden"
                onClick={e=>{const r=e.currentTarget.getBoundingClientRect(); setVolume(Math.round(((e.clientX-r.left)/r.width)*100)); setIsMuted(false);}}>
                <div className="h-full rounded-full transition-all"
                  style={{width:`${isMuted?0:volume}%`,background:dominantColor?`linear-gradient(90deg,rgb(${dominantColor}),#a855f7)`:'linear-gradient(90deg,#22d3ee,#a855f7)'}}/>
              </div>
              <input type="range" min={0} max={100} step={1} value={isMuted?0:volume}
                onChange={e=>{setVolume(Number(e.target.value)); setIsMuted(false);}}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"/>
            </div>
            <span className="text-[10px] text-gray-600 w-7 text-right tabular-nums flex-shrink-0">{isMuted?0:volume}%</span>
          </div>

          {/* Quick actions */}
          <div className="flex items-center justify-center gap-3 w-full flex-shrink-0">
            <button onClick={()=>setShowSleepModal(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${sleepTimerTarget?'bg-orange-500/15 text-orange-400 border border-orange-500/25':'bg-white/[0.06] text-gray-500 border border-white/[0.07]'}`}>
              <Timer className="w-3.5 h-3.5"/>{sleepTimerTarget?(sleepTimer?fmtMin(sleepTimer):'Fin morceau'):'Sommeil'}
            </button>
            <button onClick={()=>setShowSpeedModal(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${speed!==1?'bg-violet-500/15 text-violet-400 border border-violet-500/25':'bg-white/[0.06] text-gray-500 border border-white/[0.07]'}`}>
              <Gauge className="w-3.5 h-3.5"/>{speed}×
            </button>
            <button onClick={()=>{setFavorited(v=>!v); vibrate(12);}}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${favorited?'bg-rose-500/15 text-rose-400 border border-rose-500/25':'bg-white/[0.06] text-gray-500 border border-white/[0.07]'}`}>
              <Heart className={`w-3.5 h-3.5 ${favorited?'fill-current':''}`}/>{favorited?'Aimé':'Aimer'}
            </button>
          </div>
        </motion.div>

      ) : (
        /* ── EMPTY / RECONNECT STATE ── */
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
          className="relative z-10 flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{background:'linear-gradient(135deg,rgba(6,182,212,0.18),rgba(168,85,247,0.18))',border:'1px solid rgba(255,255,255,0.08)'}}>
            <HardDrive className="w-12 h-12 text-gray-600"/>
          </div>
          <div>
            <p className="text-white font-black text-2xl mb-2">{songs.length>0?'Bibliothèque chargée':'Prêt à écouter'}</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              {songs.length>0?`${songs.length} morceaux dans ta bibliothèque`
                :FSA_SUPPORTED&&!isIOS()?"Accorde l'accès à ton dossier Musique."
                :"Sélectionne ton dossier de musique."}
            </p>
          </div>
          {songs.length===0 && (
            <motion.button whileTap={{scale:0.96}}
              onClick={FSA_SUPPORTED&&!isIOS()?grantFSAAccess:grantInputAccess}
              className="flex items-center gap-3 px-7 py-3.5 rounded-2xl text-white font-bold"
              style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 8px 30px rgba(6,182,212,0.3)'}}>
              <FolderOpen className="w-5 h-5"/>Accéder à ma musique
            </motion.button>
          )}
          {songs.length>0 && savedPlaylists.length>0 && (
            <div className="w-full mt-2">
              <p className="text-gray-600 text-xs mb-2">Playlists sauvegardées</p>
              <div className="grid grid-cols-2 gap-2">
                {savedPlaylists.slice(0,4).map(pl=>(
                  <button key={pl.id} onClick={()=>handleSelectPlaylist(pl)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] rounded-xl border border-white/[0.07] text-left active:scale-95 transition-all">
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={pl.songs[0]?.coverUrl||makeCoverSvg(pl.name,'')} alt="" className="w-full h-full object-cover"/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-[11px] font-semibold truncate">{pl.name}</p>
                      <p className="text-gray-600 text-[10px]">{pl.songs.length} titres</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Drawer trigger ── */}
      {(songs.length>0||savedPlaylists.length>0) && (
        <motion.button initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.3}}
          onClick={()=>setDrawerOpen(true)}
          className="relative z-10 mx-4 mb-2 flex items-center gap-2 py-3 px-4 rounded-2xl border border-white/10 text-gray-400 text-sm font-semibold transition-all active:scale-98 flex-shrink-0"
          style={{background:'rgba(255,255,255,0.05)',backdropFilter:'blur(12px)'}}>
          <ListMusic className="w-4 h-4 text-cyan-400"/>Bibliothèque
          <span className="text-gray-600 text-xs">({songs.length})</span>
          {selectionMode&&selectedIds.size>0 && <span className="ml-1 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded-full">{selectedIds.size} sél.</span>}
          <ChevronUp className="w-4 h-4 ml-auto text-gray-600"/>
        </motion.button>
      )}

      <div style={{height:'calc(env(safe-area-inset-bottom,0px) + 55px)',flexShrink:0}}/>

      {/* ══════════════════════════════════════════════════════════════
          DRAWER
          ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[200]"
            style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)'}}
            onClick={e=>{if(e.target===e.currentTarget) setDrawerOpen(false);}}>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
              transition={{type:'spring',damping:36,stiffness:380}}
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col overflow-hidden"
              style={{background:'#0d0d1d',maxHeight:'88dvh',paddingBottom:'env(safe-area-inset-bottom,0px)'}}
              onClick={e=>e.stopPropagation()}>

              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20"/>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 pb-3 flex-shrink-0">
                {[['library','🎵 Bibliothèque'],['playlists','📂 Playlists'],['queue','▶ File']].map(([tab,label])=>(
                  <button key={tab} type="button" onClick={()=>setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab===tab?'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30':'text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Library tools */}
              {activeTab==='library' && (
                <div className="flex items-center gap-2 px-4 pb-2 flex-shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600"/>
                    <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                      placeholder="Chercher un titre, artiste…"
                      className="w-full pl-9 pr-8 py-2 bg-white/[0.05] border border-white/[0.07] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors"/>
                    {searchQuery && (
                      <button onClick={()=>setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                        <X className="w-3.5 h-3.5"/>
                      </button>
                    )}
                  </div>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                    className="appearance-none px-3 py-2 bg-white/[0.05] border border-white/[0.07] rounded-xl text-xs text-gray-400 focus:outline-none cursor-pointer">
                    <option value="default">Défaut</option>
                    <option value="name">Nom</option>
                    <option value="artist">Artiste</option>
                    <option value="recent">Récent</option>
                  </select>
                </div>
              )}

              {/* Selection bar */}
              {selectionMode&&activeTab==='library' && (
                <div className="flex items-center gap-2 px-4 pb-2 flex-shrink-0">
                  <span className="text-cyan-400 text-xs font-bold flex-1">{selectedIds.size} sélectionné{selectedIds.size!==1?'s':''}</span>
                  {selectedIds.size>0 && (
                    <button onPointerDown={e=>{e.preventDefault(); setShowModal(true);}}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95">
                      <Save className="w-3 h-3"/>Sauvegarder ({selectedIds.size})
                    </button>
                  )}
                  <button onClick={()=>{setSelectionMode(false); setSelectedIds(new Set());}} className="p-1.5 text-gray-500 hover:text-white">
                    <X className="w-4 h-4"/>
                  </button>
                </div>
              )}

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto px-4 pb-4" style={{scrollbarWidth:'none'}}>
                <AnimatePresence mode="wait">

                  {/* Library */}
                  {activeTab==='library' && (
                    <motion.div key="lib" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}>
                      <div className="flex items-center gap-2 py-2 mb-1 flex-wrap">
                        <button onPointerDown={e=>{e.preventDefault(); FSA_SUPPORTED&&!isIOS()?handleRescan():grantInputAccess();}}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                          <RefreshCw className="w-3.5 h-3.5"/>{FSA_SUPPORTED&&!isIOS()?'Rescanner':'Ajouter'}
                        </button>
                        {songs.length>0&&!selectionMode && (
                          <button onClick={()=>setSelectionMode(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                            <CheckSquare className="w-3.5 h-3.5"/>Sélection
                          </button>
                        )}
                        {songs.length>0 && (
                          <button onClick={()=>{playSong(songs[Math.floor(Math.random()*songs.length)],songs); vibrate(15); setDrawerOpen(false);}}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                            <Shuffle className="w-3.5 h-3.5"/>Aléatoire
                          </button>
                        )}
                        {songs.length>0 && (
                          <button onClick={handleClearLibrary}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 rounded-xl text-xs text-red-400/70 active:scale-95 transition-all border border-red-500/10">
                            <Trash2 className="w-3.5 h-3.5"/>Effacer
                          </button>
                        )}
                      </div>

                      {filteredSongs.length===0 ? (
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                          <Music2 className="w-10 h-10 text-gray-700"/>
                          <p className="text-gray-600 text-sm">{songs.length===0?'Aucun fichier audio':'Aucun résultat'}</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {filteredSongs.map((song,idx)=>{
                            const isActive=currentSong?.id===song.id;
                            const isSelected=selectedIds.has(song.id);
                            return (
                              <motion.div key={song.id}
                                initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
                                transition={{delay:Math.min(idx*0.02,0.3)}}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer ${
                                  isActive?'bg-cyan-500/12 border border-cyan-500/20':
                                  isSelected?'bg-purple-500/10 border border-purple-500/15':'hover:bg-white/[0.04]'
                                }`}
                                onClick={()=>{
                                  if(selectionMode){
                                    setSelectedIds(prev=>{const n=new Set(prev); n.has(song.id)?n.delete(song.id):n.add(song.id); return n;});
                                  } else { handlePlaySong(song); }
                                }}
                                onContextMenu={e=>{e.preventDefault(); setSelectionMode(true); setSelectedIds(new Set([song.id]));}}>
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                                  <img src={song.cover_url||song.coverUrl} alt="" className="w-full h-full object-cover"/>
                                  {isActive&&isPlaying && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                      <div className="flex items-end gap-[2px]">
                                        {[0,1,2].map(i=>(
                                          <motion.div key={i} className="w-[3px] rounded-t bg-cyan-400"
                                            animate={{height:['4px','10px','4px']}}
                                            transition={{duration:0.7,repeat:Infinity,delay:i*0.12}}/>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {selectionMode && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      {isSelected?<CheckSquare className="w-5 h-5 text-purple-400"/>:<Square className="w-5 h-5 text-gray-500"/>}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${isActive?'text-cyan-400':'text-white'}`}>{song.title}</p>
                                  <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                                </div>
                                {!selectionMode && (
                                  <button onClick={e=>{e.stopPropagation(); handleRemoveSong(song);}}
                                    className="p-1.5 text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">
                                    <Trash2 className="w-3.5 h-3.5"/>
                                  </button>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Playlists */}
                  {activeTab==='playlists' && (
                    <motion.div key="pl" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}>
                      <button onClick={()=>setShowModal(true)}
                        className="flex items-center gap-2 w-full px-4 py-3 mb-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/15 text-cyan-400 text-sm font-semibold active:scale-95 transition-all">
                        <Plus className="w-4 h-4"/>Nouvelle playlist depuis la sélection
                      </button>
                      {savedPlaylists.length===0 ? (
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                          <ListMusic className="w-10 h-10 text-gray-700"/>
                          <p className="text-gray-600 text-sm">Aucune playlist sauvegardée</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {savedPlaylists.map(pl=>(
                            <div key={pl.id} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                              <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={()=>handleSelectPlaylist(pl)}>
                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                                  <img src={pl.songs[0]?.coverUrl||makeCoverSvg(pl.name,'')} alt="" className="w-full h-full object-cover"/>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white text-sm font-semibold truncate">{pl.name}</p>
                                  <p className="text-gray-600 text-xs">{pl.songs.length} titre{pl.songs.length!==1?'s':''}</p>
                                </div>
                              </button>
                              <button onClick={()=>handleDeletePlaylist(pl.id)} className="p-1.5 text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Queue */}
                  {activeTab==='queue' && (
                    <motion.div key="q" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}>
                      {!queue?.length ? (
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                          <ListOrdered className="w-10 h-10 text-gray-700"/>
                          <p className="text-gray-600 text-sm">File de lecture vide</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {queue.map((song,idx)=>(
                            <div key={`${song.id}-${idx}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04]">
                              <span className="text-gray-700 text-xs w-5 text-center tabular-nums">{idx+1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{song.title||song.audio_url}</p>
                                <p className="text-gray-500 text-xs truncate">{song.artist||'—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showSleepModal  && <SleepModal onSet={handleSetSleepTimer} onCancel={()=>setShowSleepModal(false)}/>}
        {showSpeedModal  && <SpeedModal currentSpeed={speed} onSet={handleSetSpeed} onCancel={()=>setShowSpeedModal(false)}/>}
        {showPlaylistModal && <PlaylistModal onSave={handleSavePlaylist} onCancel={()=>setShowModal(false)}/>}
      </AnimatePresence>

    </div>
  );
});

LocalPlayerPageMobile.displayName = 'LocalPlayerPageMobile';
export default LocalPlayerPageMobile;
