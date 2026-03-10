/**
 * LocalPlayerPageMobile — NovaSound TITAN LUX V2000000
 * Refonte cinématique totale :
 * ✅ Cover vinyle full-screen avec background blurré génératif
 * ✅ Media Session API → contrôles OS (écran verrouillé Android + iOS)
 * ✅ Transitions offline↔online cinématiques
 * ✅ Drawer bottom-sheet bibliothèque/playlists/file
 * ✅ ID3v2 parser + IDB persistence
 * ✅ Seek tactile fluide + EQ animé
 */
import React, { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, ListMusic, Trash2, Plus, Play, Pause,
  SkipBack, SkipForward, Shuffle, Repeat, Save,
  CheckSquare, Square, Folder, Search, X, Music2,
  ChevronUp, HardDrive, WifiOff, Wifi,
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';

/* ─── helpers ─────────────────────────────────────────────────── */
const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = f => AUDIO_EXTS.test(f.name) || f.type.startsWith('audio/') || f.type === 'video/mp4';
const fmtDur = s => (!s||!isFinite(s)||s<=0) ? '--:--' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

const _xmlEsc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const makeCoverSvg = (title='', artist='') => {
  const hue = [...(title+artist)].reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  const h2 = (hue+120)%360;
  const letter = _xmlEsc((title[0]||'♪').toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue},70%,18%)"/>
        <stop offset="100%" style="stop-color:hsl(${h2},70%,32%)"/>
      </linearGradient>
      <radialGradient id="g2" cx="60%" cy="30%">
        <stop offset="0%" style="stop-color:hsl(${hue},80%,55%);stop-opacity:0.4"/>
        <stop offset="100%" style="stop-color:transparent"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g1)"/>
    <rect width="400" height="400" fill="url(#g2)"/>
    <circle cx="200" cy="200" r="90" fill="rgba(0,0,0,0.3)"/>
    <circle cx="200" cy="200" r="18" fill="rgba(0,0,0,0.6)"/>
    <text x="200" y="225" font-family="system-ui,sans-serif" font-size="110" font-weight="800" fill="rgba(255,255,255,0.9)" text-anchor="middle">${letter}</text>
  </svg>`;
  try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); }
  catch(_) { return `data:image/svg+xml,${encodeURIComponent(svg)}`; }
};

/* ─── ID3 parser ──────────────────────────────────────────────── */
const parseID3 = async (file) => {
  const meta = { title:'', artist:'', album:'', cover:null };
  if (file.size > 500 * 1024 * 1024) return meta;
  try {
    const bytesP  = file.slice(0,512*1024).arrayBuffer();
    const timeout = new Promise((_,rej) => setTimeout(() => rej(new Error('id3 timeout')), 8000));
    const bytes   = new Uint8Array(await Promise.race([bytesP, timeout]));
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
        let me=1; while(me<data.length&&data[me]!==0)me++;
        const mime=dec.decode(data.slice(1,me))||'image/jpeg';
        let i=me+2; while(i<data.length&&data[i]!==0)i++; i++;
        try{meta.cover=URL.createObjectURL(new Blob([data.slice(i)],{type:mime}));}catch(_){}
      }
      pos+=10+fsz;
    }
  } catch(_) {}
  return meta;
};

const getAudioDuration = url => new Promise(res=>{
  const a=document.createElement('audio'); a.preload='metadata';
  a.onloadedmetadata=()=>{res(isFinite(a.duration)?a.duration:0); a.src='';};
  a.onerror=()=>res(0); a.src=url;
});

/* ─── IDB ─────────────────────────────────────────────────────── */
const IDB_NAME='novasound_local_v2', IDB_STORE='playlists';
const openIDB=()=>new Promise((res,rej)=>{
  const r=indexedDB.open(IDB_NAME,2);
  r.onupgradeneeded=e=>{
    const db=e.target.result;
    if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE,{keyPath:'id'});
    if(!db.objectStoreNames.contains('file_handles')) db.createObjectStore('file_handles',{keyPath:'songId'});
  };
  r.onsuccess=e=>res(e.target.result); r.onerror=()=>rej(r.error);
});
const idbSave=pl=>openIDB().then(db=>new Promise(res=>{
  const req=db.transaction([IDB_STORE],'readwrite').objectStore(IDB_STORE).put(pl);
  req.onsuccess=()=>res(true); req.onerror=()=>res(false);
})).catch(()=>false);
const idbLoad=()=>openIDB().then(db=>new Promise(res=>{
  const req=db.transaction([IDB_STORE],'readonly').objectStore(IDB_STORE).getAll();
  req.onsuccess=()=>res(req.result||[]); req.onerror=()=>res([]);
})).catch(()=>[]);
const idbDelete=id=>openIDB().then(db=>new Promise(res=>{
  const req=db.transaction([IDB_STORE],'readwrite').objectStore(IDB_STORE).delete(id);
  req.onsuccess=()=>res(true); req.onerror=()=>res(false);
})).catch(()=>false);

/* ─── EQ Bars ─────────────────────────────────────────────────── */
const EqBars = () => (
  <div className="flex items-end gap-[2px] h-4 w-4">
    {[0,1,2,3].map(i=>(
      <motion.div key={i} className="flex-1 rounded-[1px] bg-cyan-400"
        animate={{height:['40%','100%','55%','80%','40%']}}
        transition={{duration:1.1+i*0.15,repeat:Infinity,delay:i*0.14,ease:'easeInOut'}}
        style={{minHeight:2}}/>
    ))}
  </div>
);

/* ─── SeekBar ─────────────────────────────────────────────────── */
const SeekBar = memo(({currentTime,duration,onSeek})=>{
  const trackRef  = useRef(null);
  const boundsRef = useRef(null); // cache bounds → zéro reflow pendant le drag
  const [dragging,setDragging]=useState(false);
  const [dragPct,setDragPct]=useState(0);
  const getPct=useCallback(x=>{
    const b=boundsRef.current;
    if(!b) return 0;
    return Math.max(0,Math.min(1,(x-b.left)/b.width));
  },[]);
  const onDown=useCallback(x=>{
    if(trackRef.current) boundsRef.current=trackRef.current.getBoundingClientRect();
    setDragging(true);setDragPct(getPct(x));
  },[getPct]);
  const onMove=useCallback(x=>{if(!dragging)return;setDragPct(getPct(x));},[dragging,getPct]);
  const onUp=useCallback(x=>{
    if(!dragging)return;
    const p=getPct(x); setDragging(false); boundsRef.current=null;
    if(onSeek&&duration>0) onSeek(p*duration);
  },[dragging,getPct,onSeek,duration]);
  useEffect(()=>{
    if(!dragging) return;
    const mm=e=>onMove(e.clientX),mu=e=>onUp(e.clientX);
    const tm=e=>{e.preventDefault();onMove(e.touches[0].clientX);};
    const tu=e=>onUp(e.changedTouches[0].clientX);
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu);
    window.addEventListener('touchmove',tm,{passive:false});
    window.addEventListener('touchend',tu);
    return()=>{
      window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu);
      window.removeEventListener('touchmove',tm); window.removeEventListener('touchend',tu);
    };
  },[dragging,onMove,onUp]);
  const pct=dragging?dragPct:(duration>0?currentTime/duration:0);
  return(
    <div className="w-full select-none">
      <div ref={trackRef} className="relative w-full flex items-center cursor-pointer" style={{height:28}}
        onMouseDown={e=>{e.preventDefault();onDown(e.clientX);}}
        onTouchStart={e=>{onDown(e.touches[0].clientX);}}>
        <div className="absolute inset-0 my-auto rounded-full" style={{height:dragging?6:4,background:'rgba(255,255,255,0.12)',transition:'height .15s'}}/>
        <div className="absolute left-0 my-auto rounded-full" style={{
          height:dragging?6:4,top:'50%',transform:'translateY(-50%)',
          width:`${pct*100}%`,background:'linear-gradient(90deg,#22d3ee,#a855f7)',
          transition:dragging?'none':'height .15s',
        }}/>
        {dragging&&<div className="absolute rounded-full bg-white" style={{
          width:18,height:18,left:`${pct*100}%`,top:'50%',
          transform:'translate(-50%,-50%)',boxShadow:'0 0 14px rgba(34,211,238,0.7)',
        }}/>}
      </div>
      <div className="flex justify-between px-0.5" style={{marginTop:-4}}>
        <span className="text-[10px] text-gray-500 tabular-nums">{fmtDur(pct*(duration||0))}</span>
        <span className="text-[10px] text-gray-600 tabular-nums">{duration>0?fmtDur(duration):'--:--'}</span>
      </div>
    </div>
  );
});
SeekBar.displayName='SeekBar';

/* ─── SongItem ────────────────────────────────────────────────── */
const SongItem = memo(({song,isActive,isPlaying,selectionMode,isSelected,onSelect,onPlay,onRemove})=>{
  const cover=song.coverUrl||song.cover_url||makeCoverSvg(song.title,song.artist||'');
  return(
    <motion.div layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-20}}
      whileTap={{scale:0.98}}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer select-none
        ${isActive
          ?'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 border border-cyan-500/25'
          :'bg-white/[0.025] border border-transparent'}`}
      onClick={()=>selectionMode?onSelect(song.id):onPlay(song)}>
      {isActive&&<div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500"/>}
      {selectionMode?(
        <button type="button"
          onPointerDown={e=>{e.stopPropagation();e.preventDefault();onSelect(song.id);}}
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isSelected?'bg-cyan-500 text-white':'bg-white/10 text-gray-500'}`}>
          {isSelected?<CheckSquare className="w-4 h-4"/>:<Square className="w-4 h-4"/>}
        </button>
      ):(
        <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
          <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy"/>
          {isActive&&<div className="absolute inset-0 flex items-center justify-center bg-black/40">
            {isPlaying?<EqBars/>:<Play className="w-4 h-4 text-white ml-0.5"/>}
          </div>}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${isActive?'text-cyan-300':'text-white'}`}>{song.title}</p>
        <p className="text-gray-500 text-xs truncate">{song.artist}</p>
      </div>
      {song.duration>0&&<span className="text-gray-700 text-[10px] tabular-nums flex-shrink-0">{fmtDur(song.duration)}</span>}
      {!selectionMode&&(
        <button type="button"
          onPointerDown={e=>{e.stopPropagation();e.preventDefault();onRemove(song);}}
          className="p-2 text-gray-700 hover:text-red-400 transition-colors rounded-lg flex-shrink-0 active:scale-90">
          <Trash2 className="w-3.5 h-3.5"/>
        </button>
      )}
    </motion.div>
  );
});
SongItem.displayName='SongItem';

/* ─── PlaylistCard ────────────────────────────────────────────── */
const PlaylistCard = memo(({playlist,onPlay,onDelete})=>{
  const covers=playlist.songs?.slice(0,4).map(s=>s.coverUrl||s.cover_url||null).filter(Boolean)??[];
  return(
    <motion.div layout initial={{opacity:0,scale:0.94}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.88}}
      whileTap={{scale:0.97}}
      className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-3.5 cursor-pointer"
      onClick={()=>onPlay(playlist)}>
      <div className={`w-14 h-14 rounded-xl overflow-hidden mb-3 shadow-md ${covers.length>=4?'grid grid-cols-2 gap-px':''}`}>
        {covers.length>=4
          ?covers.slice(0,4).map((src,i)=><img key={i} src={src} alt="" className="w-full h-full object-cover"/>)
          :covers[0]
            ?<img src={covers[0]} alt="" className="w-full h-full object-cover"/>
            :<div className="w-full h-full bg-gradient-to-br from-cyan-700/40 to-purple-800/40 flex items-center justify-center">
              <Folder className="w-7 h-7 text-white/40"/>
            </div>
        }
      </div>
      <p className="text-white font-bold text-sm truncate">{playlist.name}</p>
      <p className="text-gray-500 text-xs mt-0.5">{playlist.songs?.length??0} titre{(playlist.songs?.length??0)!==1?'s':''}</p>
      <div className="flex gap-2 mt-3">
        <button type="button"
          onPointerDown={e=>{e.stopPropagation();e.preventDefault();onPlay(playlist);}}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-lg shadow-cyan-500/20">
          <Play className="w-3 h-3"/> Lire
        </button>
        <button type="button"
          onPointerDown={e=>{e.stopPropagation();e.preventDefault();onDelete(playlist.id);}}
          className="p-2 bg-white/5 hover:bg-red-500/15 text-gray-500 hover:text-red-400 rounded-xl transition-all active:scale-90">
          <Trash2 className="w-3.5 h-3.5"/>
        </button>
      </div>
    </motion.div>
  );
});
PlaylistCard.displayName='PlaylistCard';

/* ─── PlaylistNameModal ───────────────────────────────────────── */
const PlaylistNameModal = memo(({onConfirm,onCancel})=>{
  const [name,setName]=useState('');
  const ref=useRef(null);
  useEffect(()=>{setTimeout(()=>ref.current?.focus(),80);},[]);
  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-[300] flex items-end justify-center p-4"
      style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)'}}
      onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}}
        transition={{type:'spring',stiffness:380,damping:30}}
        className="w-full max-w-sm border border-white/10 rounded-3xl p-6 shadow-2xl"
        style={{background:'#141420'}}
        onClick={e=>e.stopPropagation()}>
        <p className="text-white font-bold text-lg mb-4">Nom de la playlist</p>
        <input ref={ref} value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&name.trim())onConfirm(name.trim());if(e.key==='Escape')onCancel();}}
          placeholder="Ex : Mes favoris…"
          className="w-full px-4 py-3 bg-white/[0.07] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 text-sm mb-4 transition-colors"/>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/[0.07] text-gray-400 font-semibold text-sm active:scale-95 transition-all">Annuler</button>
          <button type="button"
            onPointerDown={e=>{e.preventDefault();if(name.trim())onConfirm(name.trim());}}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-cyan-500/20">
            Créer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
PlaylistNameModal.displayName='PlaylistNameModal';

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const LocalPlayerPageMobile = memo(()=>{
  const navigate=useNavigate();
  const {
    currentSong,isPlaying,
    playSong,play,pause,next,previous,
    togglePlayPause,queue,
    shuffle,toggleShuffle,repeat,cycleRepeat,
  }=usePlayer();
  // Aliases for MediaSession
  const resumeSong = play;
  const pauseSong  = pause;
  const nextSong   = next;
  const prevSong   = previous;
  const {currentTime:audioCurrentTime,duration:audioDuration,seekTo}=usePlayerTime();

  const [songs,setSongs]                   =useState([]);
  const [savedPlaylists,setSavedPlaylists] =useState([]);
  const [activeTab,setActiveTab]           =useState('library');
  const [selectionMode,setSelectionMode]   =useState(false);
  const [selectedIds,setSelectedIds]       =useState(new Set());
  const [searchQuery,setSearchQuery]       =useState('');
  const [sortBy,setSortBy]                 =useState('default');
  const [isDragging,setIsDragging]         =useState(false);
  const [showPlaylistModal,setShowModal]   =useState(false);
  const [loading,setLoading]               =useState(false);
  const [drawerOpen,setDrawerOpen]         =useState(false);
  const [modeTransition,setModeTransition] =useState(false);
  const fileInputRef=useRef(null);

  const isLocalPlaying=!!currentSong?.is_local;
  const activeSong    =isLocalPlaying?currentSong:null;
  const duration      =isLocalPlaying?(audioDuration||0):0;
  const currentTime   =isLocalPlaying?(audioCurrentTime||0):0;
  const cover         =activeSong?.cover_url||activeSong?.coverUrl||makeCoverSvg(activeSong?.title||'',activeSong?.artist||'');

  /* load IDB */
  useEffect(()=>{idbLoad().then(setSavedPlaylists);},[]);

  /* load durations */
  useEffect(()=>{
    const pending=songs.filter(s=>(!s.duration||s.duration===0)&&s.url);
    if(!pending.length) return;
    let alive=true;
    pending.forEach(song=>{
      getAudioDuration(song.url).then(dur=>{
        if(!alive||dur<=0) return;
        setSongs(prev=>prev.map(s=>s.id===song.id?{...s,duration:dur}:s));
      });
    });
    return()=>{alive=false;};
  },[songs.length]); // eslint-disable-line

  /* ── MEDIA SESSION API ─────────────────────────────────────── */
  useEffect(()=>{
    if(!('mediaSession' in navigator)||!activeSong) return;
    try{
      const src=activeSong.cover_url||activeSong.coverUrl||'/icon-192.png';
      navigator.mediaSession.metadata=new MediaMetadata({
        title: activeSong.title||'Titre inconnu',
        artist:activeSong.artist||'Fichier local',
        album: activeSong.album||'NovaSound Local',
        artwork:[
          {src,sizes:'192x192',type:src.startsWith('data:')?'image/png':'image/jpeg'},
          {src,sizes:'512x512',type:src.startsWith('data:')?'image/png':'image/jpeg'},
        ],
      });
    }catch(_){}
    const handlers={
      play:         ()=>resumeSong?.(),
      pause:        ()=>pauseSong?.(),
      nexttrack:    ()=>nextSong?.(),
      previoustrack:()=>prevSong?.(),
      seekbackward: ()=>seekTo?.(Math.max(0,currentTime-10)),
      seekforward:  ()=>seekTo?.(Math.min(duration,currentTime+10)),
      seekto:       d=>{if(d.seekTime!=null)seekTo?.(d.seekTime);},
    };
    Object.entries(handlers).forEach(([a,h])=>{
      try{navigator.mediaSession.setActionHandler(a,h);}catch(_){}
    });
    if(duration>0){
      try{navigator.mediaSession.setPositionState?.({
        duration,playbackRate:1,position:Math.min(currentTime,duration),
      });}catch(_){}
    }
    return()=>Object.keys(handlers).forEach(a=>{
      try{navigator.mediaSession.setActionHandler(a,null);}catch(_){}
    });
  },[activeSong,isPlaying,currentTime,duration,pauseSong,resumeSong,nextSong,prevSong,seekTo]);

  /* ── import ────────────────────────────────────────────────── */
  const handleFiles=useCallback(async(files)=>{
    setLoading(true);
    const audioFiles=Array.from(files).filter(isAudioFile);
    if(!audioFiles.length){setLoading(false);return;}
    const newSongs=await Promise.all(audioFiles.map(async file=>{
      const raw=file.name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' ');
      const tags=await parseID3(file).catch(()=>({title:'',artist:'',album:'',cover:null}));
      const title=tags.title||raw;
      const artist=tags.artist||'Artiste inconnu';
      const url=URL.createObjectURL(file);
      return{
        id:`local::${file.name}::${file.size}`,
        title,artist,album:tags.album||'',duration:0,file,
        url,audio_url:url,
        coverUrl:tags.cover||makeCoverSvg(title,artist),
        cover_url:tags.cover||makeCoverSvg(title,artist),
        _hasBlobCover:!!tags.cover,addedAt:Date.now(),is_local:true,
      };
    }));
    setSongs(prev=>{
      const existing=new Set(prev.map(s=>s.id));
      const fresh=newSongs.filter(s=>!existing.has(s.id));
      if(prev.length===0&&fresh.length>0)
        setTimeout(()=>playSong(fresh[0],fresh),80);
      return[...prev,...fresh];
    });
    setLoading(false);
    setDrawerOpen(false);
  },[playSong]);

  /* drag & drop */
  const handleDrop     =useCallback(e=>{e.preventDefault();setIsDragging(false);handleFiles(e.dataTransfer.files);},[handleFiles]);
  const handleDragOver =useCallback(e=>{e.preventDefault();setIsDragging(true);},[]);
  const handleDragLeave=useCallback(e=>{if(!e.relatedTarget)setIsDragging(false);},[]);
  useEffect(()=>{
    document.addEventListener('dragover',handleDragOver);
    document.addEventListener('dragleave',handleDragLeave);
    document.addEventListener('drop',handleDrop);
    return()=>{
      document.removeEventListener('dragover',handleDragOver);
      document.removeEventListener('dragleave',handleDragLeave);
      document.removeEventListener('drop',handleDrop);
    };
  },[handleDrop,handleDragOver,handleDragLeave]);

  /* handlers */
  const handlePlaySong=useCallback(song=>{
    const mapped={...song,audio_url:song.url||song.audio_url,cover_url:song.coverUrl||song.cover_url};
    playSong(mapped,songs.map(s=>({...s,audio_url:s.audio_url||s.url,cover_url:s.cover_url||s.coverUrl})));
  },[playSong,songs]);

  const handleRemoveSong=useCallback(song=>{
    setSongs(prev=>prev.filter(s=>s.id!==song.id));
    if(song.url?.startsWith('blob:'))try{URL.revokeObjectURL(song.url);}catch(_){}
    if(song._hasBlobCover&&song.coverUrl?.startsWith('blob:'))try{URL.revokeObjectURL(song.coverUrl);}catch(_){}
  },[]);

  const toggleSelect=useCallback(id=>{
    setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  },[]);

  const handleCreatePlaylist=useCallback((name)=>{
    const selected=songs.filter(s=>selectedIds.has(s.id));
    if(!selected.length) return;
    const pl={
      id:Date.now(),name,createdAt:Date.now(),
      songs:selected.map(s=>({
        id:s.id,title:s.title,artist:s.artist,album:s.album||'',
        coverUrl:s.coverUrl,cover_url:s.coverUrl,duration:s.duration||0,
      })),
    };
    const updated=[...savedPlaylists,pl];
    setSavedPlaylists(updated);
    updated.forEach(p=>idbSave({...p,songs:p.songs.map(s=>({...s,_hasBlobCover:undefined,file:undefined}))}).catch(()=>{}));
    setShowModal(false);setSelectionMode(false);setSelectedIds(new Set());
    setActiveTab('playlists');
  },[songs,selectedIds,savedPlaylists]);

  const handleSelectPlaylist=useCallback(playlist=>{
    if(!playlist.songs?.length) return;
    const playable=playlist.songs.filter(s=>s.url||s.audio_url);
    if(!playable.length){fileInputRef.current?.click();return;}
    playSong(playable[0],playable);
    setDrawerOpen(false);
  },[playSong]);

  const handleDeletePlaylist=useCallback(id=>{
    const updated=savedPlaylists.filter(p=>p.id!==id);
    setSavedPlaylists(updated);
    idbDelete(id).catch(()=>{});
  },[savedPlaylists]);

  const goOnline=useCallback(()=>{
    setModeTransition(true);
    setTimeout(()=>navigate('/'),950);
  },[navigate]);

  const filteredSongs=useMemo(()=>{
    let list=[...songs];
    if(searchQuery.trim()){
      const q=searchQuery.toLowerCase();
      list=list.filter(s=>s.title.toLowerCase().includes(q)||(s.artist||'').toLowerCase().includes(q));
    }
    if(sortBy==='name')   list.sort((a,b)=>a.title.localeCompare(b.title));
    if(sortBy==='artist') list.sort((a,b)=>(a.artist||'').localeCompare(b.artist||''));
    if(sortBy==='recent') list.sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
    return list;
  },[songs,searchQuery,sortBy]);

  return(
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{background:'#07071a'}}>

      {/* ── Cinematic BG ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AnimatePresence>
          {activeSong&&(
            <motion.div key={activeSong.id}
              initial={{opacity:0,scale:1.1}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
              transition={{duration:1.4,ease:'easeOut'}}
              className="absolute inset-0"
              style={{backgroundImage:`url(${cover})`,backgroundSize:'cover',backgroundPosition:'center',filter:'blur(65px) saturate(1.6)',transform:'scale(1.35)'}}/>
          )}
        </AnimatePresence>
        <div className="absolute inset-0" style={{background:'rgba(7,7,26,0.84)'}}/>
        <div className="absolute inset-0" style={{background:'radial-gradient(ellipse at center,transparent 20%,rgba(7,7,26,0.7) 100%)'}}/>
      </div>

      {/* ── Mode transition overlay ── */}
      <AnimatePresence>
        {modeTransition&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center"
            style={{background:'#050510'}}>
            <motion.div initial={{scale:0.5,opacity:0}} animate={{scale:1,opacity:1}}
              transition={{type:'spring',stiffness:280,damping:22}}
              className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 60px rgba(6,182,212,0.55)'}}>
                <Wifi className="w-9 h-9 text-white"/>
              </div>
              <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
                className="text-white font-black text-xl">Mode Online</motion.p>
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3,duration:0.65}}
                className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{transformOrigin:'left'}}/>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.div initial={{y:-30,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.1}}
        className="relative z-20 flex items-center gap-3 px-4 flex-shrink-0"
        style={{paddingTop:'calc(env(safe-area-inset-top,0px) + 14px)',paddingBottom:10}}>
        <button onClick={()=>navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/[0.08] backdrop-blur-sm text-gray-300 flex items-center justify-center active:scale-90 transition-all border border-white/[0.08]">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="flex-1">
          <p className="text-white font-black text-sm leading-none">Lecteur Local</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <WifiOff className="w-2.5 h-2.5 text-cyan-400"/>
            <p className="text-cyan-400/80 text-[10px] font-medium">Hors-ligne · 100% local</p>
          </div>
        </div>
        <button onClick={goOnline}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-xs font-semibold active:scale-90 transition-all">
          <Wifi className="w-3 h-3"/>Online
        </button>
        <button onPointerDown={e=>{e.preventDefault();fileInputRef.current?.click();}}
          className="w-9 h-9 rounded-xl bg-white/[0.08] backdrop-blur-sm text-gray-300 hover:text-cyan-400 flex items-center justify-center active:scale-90 transition-all border border-white/[0.08]">
          <Plus className="w-4 h-4"/>
        </button>
      </motion.div>

      {/* ── NOW PLAYING ── */}
      {activeSong?(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.15}}
          className="relative z-10 px-5 flex flex-col items-center flex-shrink-0" style={{paddingTop:4}}>

          {/* vinyl cover */}
          <div className="relative mb-4" style={{width:'min(248px,58vw)',height:'min(248px,58vw)'}}>
            <motion.div animate={{scale:[1,1.1,1],opacity:[0.45,0.75,0.45]}}
              transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}
              className="absolute inset-0 rounded-full"
              style={{background:`radial-gradient(circle,rgba(6,182,212,0.35),transparent 70%)`,filter:'blur(20px)'}}/>
            {/* vinyl grooves */}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{
              background:'repeating-radial-gradient(circle at 50% 50%,transparent 0px,transparent 4px,rgba(0,0,0,0.08) 4px,rgba(0,0,0,0.08) 5px)',
              zIndex:2,
            }}/>
            <motion.div className="w-full h-full rounded-full overflow-hidden shadow-2xl"
              animate={{rotate:isPlaying?360:0}}
              transition={isPlaying?{duration:12,repeat:Infinity,ease:'linear'}:{duration:0.5}}
              style={{boxShadow:'0 0 60px rgba(0,0,0,0.8),0 0 30px rgba(6,182,212,0.2)'}}>
              <img src={cover} alt={activeSong.title} className="w-full h-full object-cover"/>
            </motion.div>
            {/* center spindle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{zIndex:3}}>
              <div className="w-5 h-5 rounded-full bg-gray-950 border-2 border-gray-700 shadow-inner"/>
            </div>
            {/* EQ bars */}
            {isPlaying&&(
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-end gap-[3px]">
                {[0,1,2,3,4].map(i=>(
                  <motion.div key={i} className="w-1.5 rounded-t bg-cyan-400/80"
                    animate={{height:['8px','22px','10px','16px','8px']}}
                    transition={{duration:0.85+i*0.13,repeat:Infinity,delay:i*0.11,ease:'easeInOut'}}/>
                ))}
              </div>
            )}
          </div>

          {/* song info */}
          <div className="w-full text-center mb-3 px-2">
            <p className="text-white font-black text-xl truncate leading-tight">{activeSong.title}</p>
            <p className="text-gray-400 text-sm mt-0.5 truncate">{activeSong.artist}</p>
          </div>

          {/* seek */}
          <div className="w-full px-1 mb-2">
            <SeekBar currentTime={currentTime} duration={duration} onSeek={seekTo}/>
          </div>

          {/* controls */}
          <div className="flex items-center justify-center gap-5 w-full mb-3">
            <button type="button" onClick={toggleShuffle}
              className={`p-2 rounded-xl transition-all active:scale-90 ${shuffle?'text-cyan-400 bg-cyan-500/15':'text-gray-600'}`}>
              <Shuffle className="w-4 h-4"/>
            </button>
            <button type="button" onPointerDown={e=>{e.preventDefault();prevSong?.();}}
              className="w-11 h-11 flex items-center justify-center text-gray-200 active:scale-90 transition-all">
              <SkipBack className="w-6 h-6"/>
            </button>
            <motion.button type="button" whileTap={{scale:0.91}}
              onPointerDown={e=>{e.preventDefault();togglePlayPause?.();}}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
              style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 6px 32px rgba(6,182,212,0.5)'}}>
              {isPlaying?<Pause className="w-7 h-7 text-white"/>:<Play className="w-7 h-7 text-white ml-0.5"/>}
            </motion.button>
            <button type="button" onPointerDown={e=>{e.preventDefault();nextSong?.();}}
              className="w-11 h-11 flex items-center justify-center text-gray-200 active:scale-90 transition-all">
              <SkipForward className="w-6 h-6"/>
            </button>
            <button type="button" onClick={cycleRepeat}
              className={`p-2 rounded-xl transition-all active:scale-90 relative ${repeat!=='off'?'text-cyan-400 bg-cyan-500/15':'text-gray-600'}`}>
              <Repeat className="w-4 h-4"/>
              {repeat==='one'&&<span className="absolute -top-0.5 -right-0.5 text-[7px] font-black bg-cyan-400 text-gray-950 rounded-full w-3 h-3 flex items-center justify-center">1</span>}
            </button>
          </div>
        </motion.div>
      ):(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
          className="relative z-10 flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{background:'linear-gradient(135deg,rgba(6,182,212,0.18),rgba(168,85,247,0.18))',border:'1px solid rgba(255,255,255,0.08)'}}>
            <HardDrive className="w-12 h-12 text-gray-600"/>
          </div>
          <div>
            <p className="text-white font-black text-2xl mb-2">Lecteur Local</p>
            <p className="text-gray-500 text-sm leading-relaxed">Importe tes fichiers audio<br/>pour les écouter hors-ligne</p>
          </div>
          <motion.button whileTap={{scale:0.96}}
            onPointerDown={e=>{e.preventDefault();fileInputRef.current?.click();}}
            className="flex items-center gap-3 px-7 py-3.5 rounded-2xl text-white font-bold"
            style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 8px 30px rgba(6,182,212,0.3)'}}>
            <FolderOpen className="w-5 h-5"/>Importer des fichiers
          </motion.button>
          <p className="text-gray-700 text-xs">MP3 · M4A · WAV · FLAC · AAC · OGG</p>
        </motion.div>
      )}

      {/* ── Drawer trigger ── */}
      {(songs.length>0||savedPlaylists.length>0)&&(
        <motion.button initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.3}}
          onClick={()=>setDrawerOpen(true)}
          className="relative z-10 mx-4 mb-2 flex items-center gap-2 py-3 px-4 rounded-2xl border border-white/10 text-gray-400 text-sm font-semibold transition-all active:scale-98 flex-shrink-0"
          style={{background:'rgba(255,255,255,0.05)',backdropFilter:'blur(12px)'}}>
          <ListMusic className="w-4 h-4 text-cyan-400"/>
          Bibliothèque
          <span className="text-gray-600 text-xs">({songs.length})</span>
          <ChevronUp className="w-4 h-4 ml-auto text-gray-600"/>
        </motion.button>
      )}

      <div style={{height:'calc(env(safe-area-inset-bottom,0px) + 60px)',flexShrink:0}}/>

      {/* ══ DRAWER ══════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[200]"
            style={{background:'rgba(0,0,0,0.72)',backdropFilter:'blur(4px)'}}
            onClick={e=>{if(e.target===e.currentTarget)setDrawerOpen(false);}}>
            <motion.div
              initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
              transition={{type:'spring',damping:36,stiffness:380}}
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col overflow-hidden"
              style={{background:'#0e0e1e',maxHeight:'85dvh',paddingBottom:'env(safe-area-inset-bottom,0px)'}}
              onClick={e=>e.stopPropagation()}>

              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20"/>
              </div>

              {/* tabs */}
              <div className="flex items-center gap-1 px-4 pb-3 flex-shrink-0">
                {[['library','🎵 Bibliothèque'],['playlists','📂 Playlists'],['queue','▶ File']].map(([tab,label])=>(
                  <button key={tab} type="button" onClick={()=>setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab===tab
                        ?'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                        :'text-gray-500'
                    }`}>{label}</button>
                ))}
              </div>

              {/* library tools */}
              {activeTab==='library'&&(
                <div className="flex items-center gap-2 px-4 pb-2 flex-shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600"/>
                    <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                      placeholder="Chercher…"
                      className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/[0.07] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors"/>
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

              {/* selection bar */}
              {selectionMode&&activeTab==='library'&&(
                <div className="flex items-center gap-2 px-4 pb-2 flex-shrink-0">
                  <span className="text-cyan-400 text-xs font-bold flex-1">{selectedIds.size} sélectionné{selectedIds.size!==1?'s':''}</span>
                  {selectedIds.size>0&&(
                    <button onPointerDown={e=>{e.preventDefault();setShowModal(true);}}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95">
                      <Save className="w-3 h-3"/> Sauvegarder
                    </button>
                  )}
                  <button onClick={()=>{setSelectionMode(false);setSelectedIds(new Set());}}
                    className="p-1.5 text-gray-500 hover:text-white"><X className="w-4 h-4"/></button>
                </div>
              )}

              {/* content */}
              <div className="flex-1 overflow-y-auto px-4 pb-4" style={{scrollbarWidth:'none'}}>
                <AnimatePresence mode="wait">

                  {activeTab==='library'&&(
                    <motion.div key="lib" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} className="space-y-1 pb-2">
                      <div className="flex items-center gap-2 py-2">
                        <button onPointerDown={e=>{e.preventDefault();fileInputRef.current?.click();}}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                          <Plus className="w-3.5 h-3.5"/> Importer
                        </button>
                        {songs.length>0&&!selectionMode&&(
                          <button onClick={()=>setSelectionMode(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                            <CheckSquare className="w-3.5 h-3.5"/> Sélection
                          </button>
                        )}
                        <span className="ml-auto text-xs text-gray-600">{songs.length} fichier{songs.length!==1?'s':''}</span>
                      </div>
                      {filteredSongs.length===0?(
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Music2 className="w-10 h-10 text-gray-700 mb-3"/>
                          <p className="text-gray-400 font-semibold text-sm">{searchQuery?'Aucun résultat':'Bibliothèque vide'}</p>
                        </div>
                      ):(
                        <AnimatePresence>
                          {filteredSongs.map(song=>(
                            <SongItem key={song.id} song={song}
                              isActive={activeSong?.id===song.id} isPlaying={isPlaying}
                              selectionMode={selectionMode} isSelected={selectedIds.has(song.id)}
                              onSelect={toggleSelect} onPlay={handlePlaySong} onRemove={handleRemoveSong}/>
                          ))}
                        </AnimatePresence>
                      )}
                    </motion.div>
                  )}

                  {activeTab==='playlists'&&(
                    <motion.div key="pl" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}>
                      <div className="flex items-center justify-between py-2 mb-2">
                        <p className="text-white font-bold text-sm">Mes playlists</p>
                        <button type="button"
                          onClick={()=>{songs.length?setSelectionMode(true):fileInputRef.current?.click();setActiveTab('library');}}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95">
                          <Plus className="w-3.5 h-3.5"/> Nouvelle
                        </button>
                      </div>
                      {savedPlaylists.length===0?(
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Folder className="w-12 h-12 text-gray-700 mb-3"/>
                          <p className="text-gray-400 font-semibold text-sm">Aucune playlist</p>
                        </div>
                      ):(
                        <div className="grid grid-cols-2 gap-3">
                          <AnimatePresence>
                            {savedPlaylists.map(pl=>(
                              <PlaylistCard key={pl.id} playlist={pl} onPlay={handleSelectPlaylist} onDelete={handleDeletePlaylist}/>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab==='queue'&&(
                    <motion.div key="q" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}>
                      <div className="flex items-center justify-between py-2 mb-2">
                        <p className="text-white font-bold text-sm">File de lecture</p>
                        {queue?.length>0&&<span className="text-xs text-gray-600">{queue.length} titre{queue.length!==1?'s':''}</span>}
                      </div>
                      {!queue?.length?(
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <ListMusic className="w-12 h-12 text-gray-700 mb-3"/>
                          <p className="text-gray-400 font-semibold text-sm">File vide</p>
                        </div>
                      ):(
                        <div className="space-y-1.5">
                          {queue.map((song,idx)=>{
                            const c=song.cover_url||song.coverUrl||makeCoverSvg(song.title,song.artist||'');
                            return(
                              <div key={`${song.id}-${idx}`}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${activeSong?.id===song.id?'bg-cyan-500/12 border-cyan-500/22':'bg-white/[0.025] border-transparent'}`}>
                                <span className="text-gray-700 text-[10px] w-5 text-right font-mono">{idx+1}</span>
                                <img src={c} alt="" className="w-10 h-10 rounded-lg object-cover" loading="lazy"/>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${activeSong?.id===song.id?'text-cyan-300':'text-white'}`}>{song.title}</p>
                                  <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                                </div>
                              </div>
                            );
                          })}
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

      {/* drag overlay */}
      <AnimatePresence>
        {isDragging&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none"
            style={{background:'rgba(6,182,212,0.08)',border:'2px dashed rgba(6,182,212,0.5)'}}>
            <div className="text-center">
              <FolderOpen className="w-14 h-14 text-cyan-400 mx-auto mb-3"/>
              <p className="text-cyan-300 text-xl font-black">Déposez vos fichiers</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* loading toast */}
      <AnimatePresence>
        {loading&&(
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-2xl border border-white/10"
            style={{background:'rgba(14,14,30,0.96)'}}>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin"/>
            <span className="text-white text-xs font-medium">Importation…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* playlist modal */}
      <AnimatePresence>
        {showPlaylistModal&&<PlaylistNameModal onConfirm={handleCreatePlaylist} onCancel={()=>setShowModal(false)}/>}
      </AnimatePresence>

      <input ref={fileInputRef} type="file" accept="audio/*,video/mp4" multiple
        onChange={e=>{handleFiles(e.target.files);e.target.value='';}}
        className="hidden"/>
    </div>
  );
});
LocalPlayerPageMobile.displayName='LocalPlayerPageMobile';
export default LocalPlayerPageMobile;
