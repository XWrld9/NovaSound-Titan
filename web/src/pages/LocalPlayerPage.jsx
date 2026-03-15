/**
 * LocalPlayerPage — NovaSound TITAN LUX V6000000
 * REFONTE TOTALE DESKTOP — Glassmorphism premium, 3 colonnes
 * Mobile → délègue à LocalPlayerPageMobile
 * ✅ Fond cover blurré animé + effets verre givré
 * ✅ Layout : Sidebar player | Bibliothèque centre | Queue/Playlists droite
 * ✅ Drag & Drop, FSA, raccourcis clavier + OSD
 * ✅ Media Session, visualizer, sleep timer, vitesse
 * ✅ IDB persistence, ID3v2 parser, file handles
 */
import React, {
  useState, useRef, useCallback, useEffect, memo, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, HardDrive, WifiOff, Wifi, ListMusic, Trash2, Plus,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Save, CheckSquare, Square, ChevronUp, ChevronDown, Check,
  RefreshCcw, Search, X, SlidersHorizontal, ArrowLeft, Home,
  Music2, Keyboard, Headphones, Clock, Heart, MoreHorizontal,
  AlertTriangle, GripVertical, Timer, Gauge, List, Grid,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';
import LocalPlayerPageMobile from './LocalPlayerPageMobile';
import NoTranslate from '@/components/NoTranslate';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = f => AUDIO_EXTS.test(f.name) || f.type.startsWith('audio/') || f.type === 'video/mp4';
const FS_ACCESS_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const isMobile = () =>
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent) ||
  window.innerWidth < 768;
const fmtTime = s => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
};
const fmtSize = b => !b ? '' : b<1024*1024?`${(b/1024).toFixed(1)} KB`:`${(b/1024/1024).toFixed(1)} MB`;
const fmtMin = s => s<60?`${s}s`:s%60?`${Math.floor(s/60)}m${s%60}s`:`${Math.floor(s/60)}m`;

/* ═══════════════════════════════════════════════════════════════
   INDEXEDDB
   ═══════════════════════════════════════════════════════════════ */
const IDB_NAME='novasound_local_v2', IDB_STORE='playlists', IDB_HANDLES='file_handles';
const openIDB = () => new Promise((res,rej)=>{
  const r=indexedDB.open(IDB_NAME,2);
  r.onupgradeneeded=e=>{const db=e.target.result;['playlists','file_handles'].forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:s==='playlists'?'id':'songId'});});};
  r.onsuccess=e=>res(e.target.result);r.onerror=()=>rej(r.error);
});
const idbSave=async pl=>{try{const db=await openIDB();const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).put({...pl,songs:pl.songs.map(s=>({...s,_fileHandle:undefined,_file:undefined,_blobUrl:undefined}))});return new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;});}catch(_){}};
const idbDelete=async id=>{try{const db=await openIDB();const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).delete(id);return new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;});}catch(_){}};
const idbLoadAll=async()=>{try{const db=await openIDB();const tx=db.transaction(IDB_STORE,'readonly');const r=tx.objectStore(IDB_STORE).getAll();return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result||[]);r.onerror=rej;});}catch(_){return [];}};
const idbSaveHandle=async(songId,handle)=>{if(!handle)return;try{const db=await openIDB();const tx=db.transaction(IDB_HANDLES,'readwrite');tx.objectStore(IDB_HANDLES).put({songId,handle});return new Promise(r=>{tx.oncomplete=r;tx.onerror=()=>r();});}catch(_){}};
const idbGetHandle=async songId=>{try{const db=await openIDB();const tx=db.transaction(IDB_HANDLES,'readonly');const r=tx.objectStore(IDB_HANDLES).get(songId);return new Promise(res=>{r.onsuccess=()=>res(r.result?.handle||null);r.onerror=()=>res(null);});}catch(_){return null;}};
const idbDeleteHandle=async songId=>{try{const db=await openIDB();const tx=db.transaction(IDB_HANDLES,'readwrite');tx.objectStore(IDB_HANDLES).delete(songId);}catch(_){}};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const _xmlEsc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const makeCoverSvg = (title='',artist='')=>{
  const hue=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h%360;};
  const c1=`hsl(${hue(title)},60%,42%)`,c2=`hsl(${hue(artist||title.split('').reverse().join(''))},65%,55%)`;
  const letter=_xmlEsc((title[0]||'♫').toUpperCase()),label=_xmlEsc(title.slice(0,18));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="85" r="42" fill="rgba(0,0,0,0.2)"/><text x="100" y="102" font-family="system-ui,sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${letter}</text><text x="100" y="160" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.5)" text-anchor="middle">${label}</text></svg>`;
  try{return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));}
  catch(_){return `data:image/svg+xml,${encodeURIComponent(svg)}`;}
};
const persistPlaylists=pls=>{pls.forEach(pl=>idbSave(pl).catch(()=>{}));try{const safe=pls.map(pl=>({id:pl.id,name:pl.name,createdAt:pl.createdAt,songs:pl.songs.map(s=>({id:s.id,title:s.title,artist:s.artist,album:s.album||'',cover_url:s.cover_svg||makeCoverSvg(s.title,s.artist),cover_svg:s.cover_svg||makeCoverSvg(s.title,s.artist),is_local:true,_needsReimport:true}))}));const str=JSON.stringify(safe);if(str.length<5*1024*1024)localStorage.setItem('novasound_local_playlists',str);}catch(_){}};

/* ═══════════════════════════════════════════════════════════════
   ID3v2 PARSER
   ═══════════════════════════════════════════════════════════════ */
const parseID3=async file=>{
  const meta={title:'',artist:'',album:'',cover:null};
  if(file.size>500*1024*1024)return meta;
  try{
    const bytes=new Uint8Array(await Promise.race([file.slice(0,512*1024).arrayBuffer(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),8000))]));
    if(bytes[0]!==0x49||bytes[1]!==0x44||bytes[2]!==0x33)return meta;
    const ss=(b,o)=>((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f);
    let pos=10;const end=ss(bytes,6)+10;
    const dec=new TextDecoder('utf-8',{fatal:false});
    while(pos<end-10&&pos<bytes.length-10){
      const fid=String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      const fsz=(bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
      if(fsz<=0||fsz>300000)break;
      const data=bytes.slice(pos+10,pos+10+fsz);
      const txt=data[0]===0?dec.decode(data.slice(1)):new TextDecoder('utf-16le',{fatal:false}).decode(data.slice(3));
      if(fid==='TIT2')meta.title=txt.replace(/\0/g,'').trim();
      else if(fid==='TPE1')meta.artist=txt.replace(/\0/g,'').trim();
      else if(fid==='TALB')meta.album=txt.replace(/\0/g,'').trim();
      else if(fid==='APIC'&&!meta.cover){let i=1;while(i<data.length&&data[i]!==0)i++;i++;i++;while(i<data.length&&data[i]!==0)i++;i++;try{meta.cover=URL.createObjectURL(new Blob([data.slice(i)],{type:'image/jpeg'}));}catch(_){}}
      pos+=10+fsz;
    }
  }catch(_){}
  return meta;
};
const fileToSong=async(file,handle=null)=>{
  if(!isAudioFile(file))return null;
  const url=URL.createObjectURL(file);
  const raw=file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');
  const tags=await parseID3(file);
  const title=tags.title||raw,artist=tags.artist||'Local file';
  const svg=makeCoverSvg(title,artist);
  return{id:'local::'+file.name+'::'+file.size,title,artist,album:tags.album||'',audio_url:url,cover_url:tags.cover||svg,cover_svg:svg,is_local:true,_file:file,_blobUrl:url,_fileSize:file.size,_hasBlobCover:!!tags.cover,_coverBlobUrl:tags.cover||null,_fileHandle:handle||null};
};
const resolveFromHandle=async saved=>{
  if(!FS_ACCESS_SUPPORTED)return null;
  const handle=saved._fileHandle||(await idbGetHandle(saved.id));
  if(!handle)return null;
  try{let perm=await handle.queryPermission({mode:'read'});if(perm==='prompt')perm=await handle.requestPermission({mode:'read'});if(perm!=='granted')return null;const file=await handle.getFile();return fileToSong(file,handle);}catch(_){return null;}
};

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* EQ Bars */
const EQBars=({active,color='#22d3ee',bars=4})=>(
  <div className="flex gap-px items-end" style={{height:14}}>
    {Array.from({length:bars}).map((_,i)=>(
      <div key={i} className="w-0.5 rounded-full" style={{background:color,height:active?`${4+Math.sin(i*1.2)*4+7}px`:'3px',animation:active?`novaWave ${0.35+i*0.12}s ease-in-out infinite alternate`:'none',animationDelay:`${i*0.08}s`,transition:'height 0.2s',opacity:active?1:0.3}}/>
    ))}
  </div>
);

/* SeekBar */
const SeekBar=({currentTime,duration,onSeek,color='#22d3ee'})=>{
  const trackRef=useRef(null);const boundsRef=useRef(null);
  const[dragging,setDragging]=useState(false);const[dragPct,setDragPct]=useState(0);
  const getPct=useCallback(x=>{const b=boundsRef.current;if(!b)return 0;return Math.max(0,Math.min(1,(x-b.left)/b.width));},[]);
  const start=useCallback(x=>{if(trackRef.current)boundsRef.current=trackRef.current.getBoundingClientRect();setDragging(true);setDragPct(getPct(x));},[getPct]);
  const move=useCallback(x=>{if(!dragging)return;setDragPct(getPct(x));},[dragging,getPct]);
  const end=useCallback(x=>{if(!dragging)return;const p=getPct(x);setDragging(false);setDragPct(p);boundsRef.current=null;if(onSeek&&duration>0)onSeek(p*duration);},[dragging,getPct,onSeek,duration]);
  useEffect(()=>{if(!dragging)return;const mm=e=>move(e.clientX),mu=e=>end(e.clientX),tm=e=>{e.preventDefault();move(e.touches[0].clientX);},tu=e=>end(e.changedTouches[0].clientX);window.addEventListener('mousemove',mm);window.addEventListener('mouseup',mu);window.addEventListener('touchmove',tm,{passive:false});window.addEventListener('touchend',tu);return()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);window.removeEventListener('touchmove',tm);window.removeEventListener('touchend',tu);};},[dragging,move,end]);
  const pct=dragging?dragPct:(duration>0?currentTime/duration:0);
  return(
    <div className="w-full select-none group/seek">
      <div ref={trackRef} className="relative w-full cursor-pointer" style={{height:20,display:'flex',alignItems:'center'}}
        onMouseDown={e=>{e.preventDefault();start(e.clientX);}} onTouchStart={e=>{e.preventDefault();start(e.touches[0].clientX);}}
        onClick={e=>{if(!dragging&&onSeek&&duration>0)onSeek(getPct(e.clientX)*duration);}}>
        <div className="absolute inset-0 my-auto rounded-full" style={{height:4,background:'rgba(255,255,255,0.08)'}}/>
        <div className="absolute left-0 my-auto rounded-full" style={{height:4,top:'50%',transform:'translateY(-50%)',width:`${pct*100}%`,background:`linear-gradient(90deg,${color},#a855f7)`}}/>
        <div className="absolute opacity-0 group-hover/seek:opacity-100 transition-opacity" style={{left:`${pct*100}%`,top:'50%',transform:'translate(-50%,-50%)',width:dragging?18:12,height:dragging?18:12,borderRadius:'50%',background:'white',boxShadow:`0 0 12px ${color}80`,transition:dragging?'none':'all .1s'}}/>
        {dragging&&<div className="absolute" style={{left:`${pct*100}%`,top:'50%',transform:'translate(-50%,-50%)',width:18,height:18,borderRadius:'50%',background:'white',boxShadow:`0 0 12px ${color}80`}}/>}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums mt-1" style={{color:'rgba(255,255,255,0.3)'}}>
        <span>{fmtTime(pct*(duration||0))}</span><span>{duration>0?fmtTime(duration):'--:--'}</span>
      </div>
    </div>
  );
};

/* Song row */
const SongRow=memo(({song,index,isActive,isSelected,onPlay,onRemove,selectionMode,onToggleSelect,duration})=>{
  const nr=!!song._needsReimport;
  const rawCover=song.cover_url||song.cover_svg;
  const cover=(!rawCover||rawCover.startsWith('blob:'))?makeCoverSvg(song.title||'',song.artist||''):rawCover;
  return(
    <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:0.12,delay:Math.min(index*0.015,0.25)}}
      onClick={nr?undefined:(selectionMode?onToggleSelect:onPlay)}
      className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${nr?'opacity-50 bg-amber-500/5 border border-amber-500/15':isActive?'bg-white/[0.08] border border-white/[0.12]':isSelected?'bg-violet-500/10 border border-violet-500/20':'hover:bg-white/[0.05] border border-transparent hover:border-white/[0.07]'}`}>
      <div className="w-6 flex-shrink-0 text-center">
        {selectionMode?(isSelected?<CheckSquare className="w-4 h-4 text-violet-400 mx-auto"/>:<Square className="w-4 h-4 text-gray-600 mx-auto"/>):
          isActive?<EQBars active bars={3}/>:(
            <><span className="text-[11px] text-gray-600 tabular-nums group-hover:hidden">{index+1}</span>
            <Play className="w-3 h-3 text-gray-400 mx-auto hidden group-hover:block"/></>
          )
        }
      </div>
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative">
        <img src={cover} alt={song.title} className="w-full h-full object-cover"/>
        {nr&&<div className="absolute inset-0 bg-black/70 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-amber-400"/></div>}
      </div>
      <div className="flex-1 min-w-0">
        <NoTranslate tag="p" className={`text-sm font-medium truncate notranslate ${isActive?'text-white':nr?'text-gray-500':'text-gray-200'}`} translate="no"><NoTranslate className="truncate">{song.title}</NoTranslate></NoTranslate>
        <p className="text-[11px] text-gray-500 truncate notranslate" translate="no">{nr?<span className="text-amber-400/80">⚠ Reload needed</span>:<span translate="no" className="notranslate truncate">{song.artist}</span>}</p>
      </div>
      <span className="hidden lg:block text-[11px] text-gray-700 w-24 truncate flex-shrink-0">{song.album||''}</span>
      <span className="text-[11px] text-gray-600 tabular-nums w-10 text-right flex-shrink-0">{duration?fmtTime(duration):nr?'--:--':''}</span>
      <button onClick={e=>{e.stopPropagation();onRemove();}} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-all flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5"/>
      </button>
    </motion.div>
  );
});
SongRow.displayName='SongRow';

/* Keyboard OSD */
const KeyboardOSD=memo(({osd})=>(
  <AnimatePresence>
    {osd&&(
      <motion.div key={osd.id} initial={{opacity:0,y:16,scale:0.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-12,scale:0.95}} transition={{type:'spring',stiffness:440,damping:28}}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-none"
        style={{background:'rgba(10,10,26,0.92)',border:'1px solid rgba(34,211,238,0.3)',borderRadius:16,padding:'10px 24px',backdropFilter:'blur(20px)',boxShadow:'0 8px 40px rgba(6,182,212,0.25)'}}>
        <div className="flex items-center gap-3">
          <kbd className="text-[13px] font-black font-mono text-cyan-400">{osd.key}</kbd>
          <span className="text-white text-[13px] font-semibold">{osd.label}</span>
          {osd.value!=null&&<span className="text-cyan-300 text-xs font-bold ml-1">{osd.value}</span>}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));
KeyboardOSD.displayName='KeyboardOSD';

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const LocalPlayerPage=()=>{
  const inputRef=useRef(null),reimportRef=useRef(null),osdTimerRef=useRef(null),canvasRef=useRef(null);
  const{playSong,currentSong,isPlayingGlobal,seekTo,togglePlayPause,handleNext,handlePrevious,shuffle,toggleShuffle,repeat,cycleRepeat,localFavoriteIds,localFavoriteSongs,toggleLocalFavorite}=usePlayer();
  const{audioCurrentTime,audioDuration}=usePlayerTime();
  const navigate=useNavigate();
  const isPlayingGlobalRef=useRef(false);
  useEffect(()=>{isPlayingGlobalRef.current=isPlayingGlobal;},[isPlayingGlobal]);

  const[songs,setSongs]=useState([]);
  const[loading,setLoading]=useState(false);
  const[selectionMode,setSelectionMode]=useState(false);
  const[selectedIds,setSelectedIds]=useState(new Set());
  const[showSaveModal,setShowSaveModal]=useState(false);
  const[savedPlaylists,setSavedPlaylists]=useState([]);
  const[volume,setVolume]=useState(80);
  const[isMuted,setIsMuted]=useState(false);
  const[restoringHandles,setRestoringHandles]=useState(false);
  const[activeTab,setActiveTab]=useState('library');
  const[searchQuery,setSearchQuery]=useState('');
  const[sortBy,setSortBy]=useState('default');
  const[showSortMenu,setShowSortMenu]=useState(false);
  const[trackDurations,setTrackDurations]=useState({});
  const[isDragging,setIsDragging]=useState(false);
  const[showShortcuts,setShowShortcuts]=useState(false);
  const[modeTransition,setModeTransition]=useState(false);
  const[osd,setOsd]=useState(null);
  const[sleepTimer,setSleepTimer]=useState(null);
  const[sleepTimerTarget,setSleepTimerTarget]=useState(null);
  const[showSleepPanel,setShowSleepPanel]=useState(false);
  const[speed,setSpeed]=useState(1);
  const[showSpeedPanel,setShowSpeedPanel]=useState(false);
  const[dominantColor,setDominantColor]=useState(null);
  const osdIdRef=useRef(0);
  const sleepIntervalRef=useRef(null);

  /* OSD */
  const showOSD=useCallback((key,label,value=null)=>{
    if(osdTimerRef.current)clearTimeout(osdTimerRef.current);
    const id=++osdIdRef.current;setOsd({key,label,value,id});
    osdTimerRef.current=setTimeout(()=>setOsd(null),1400);
  },[]);

  /* Sleep timer */
  useEffect(()=>{
    clearInterval(sleepIntervalRef.current);
    if(!sleepTimerTarget||sleepTimerTarget===-1){setSleepTimer(null);return;}
    const tick=()=>{const rem=Math.max(0,sleepTimerTarget-Math.floor(Date.now()/1000));setSleepTimer(rem);if(rem<=0){clearInterval(sleepIntervalRef.current);document.querySelector('audio')?.pause();setSleepTimerTarget(null);setSleepTimer(null);}};
    tick();sleepIntervalRef.current=setInterval(tick,1000);
    return()=>clearInterval(sleepIntervalRef.current);
  },[sleepTimerTarget]);

  /* Load IDB playlists */
  useEffect(()=>{
    (async()=>{
      try{const pls=await idbLoadAll();if(pls.length>0){setSavedPlaylists(pls);return;}}catch(_){}
      try{const ls=JSON.parse(localStorage.getItem('novasound_local_playlists')||'[]');if(ls.length){const marked=ls.map(pl=>({...pl,songs:pl.songs.map(s=>({...s,_needsReimport:true}))}));setSavedPlaylists(marked);marked.forEach(pl=>idbSave(pl).catch(()=>{}));}}catch(_){}
    })();
  },[]);

  /* Volume */
  useEffect(()=>{const a=document.querySelector('audio');if(a){a.volume=isMuted?0:volume/100;a.muted=isMuted;}},[volume,isMuted]);
  /* Speed */
  useEffect(()=>{const a=document.querySelector('audio');if(a)a.playbackRate=speed;},[speed]);
  /* Cleanup blobs */
  useEffect(()=>()=>{songs.forEach(s=>{if(s._blobUrl)try{URL.revokeObjectURL(s._blobUrl);}catch(_){}if(s._hasBlobCover)try{URL.revokeObjectURL(s._coverBlobUrl);}catch(_){}});},[]);

  /* Dominant color from cover */
  const activeSong=!!currentSong?.is_local?currentSong:(songs[0]||null);
  // Favoris : calculé après activeSong pour éviter TDZ
  const favorited=activeSong?localFavoriteIds.has(activeSong.id):false;
  const rawActiveCover=activeSong?.cover_url||activeSong?.cover_svg;
  // Pour l'affichage : on garde les blob: URLs (vraie pochette MP3)
  const cover=rawActiveCover||makeCoverSvg(activeSong?.title||'',activeSong?.artist||'');
  // Pour mediaSession : les blob: URLs ne sont pas supportées → fallback svg
  const coverForSession=(!rawActiveCover||rawActiveCover.startsWith('blob:'))?makeCoverSvg(activeSong?.title||'',activeSong?.artist||''):rawActiveCover;
  useEffect(()=>{
    if(!cover||cover.startsWith('data:image/svg'))return;
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=8;c.getContext('2d').drawImage(img,0,0,8,8);const d=c.getContext('2d').getImageData(0,0,8,8).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}setDominantColor(`${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)}`);}catch(_){}};
    img.onerror=()=>{};img.src=cover;
  },[cover]);

  /* Visualizer */
  useEffect(()=>{
    const audio=document.querySelector('audio');
    const canvas=canvasRef.current;
    if(!audio||!canvas||!isPlayingGlobal||!currentSong?.is_local)return;
    let rafId;
    try{
      if(!window._nsAC)window._nsAC=new AudioContext();
      if(!window._nsSrc){window._nsSrc=window._nsAC.createMediaElementSource(audio);window._nsSrc.connect(window._nsAC.destination);}
      if(!window._nsAn){window._nsAn=window._nsAC.createAnalyser();window._nsAn.fftSize=128;window._nsSrc.connect(window._nsAn);}
      const analyser=window._nsAn;
      const draw=()=>{
        const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
        const buf=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(buf);
        ctx.clearRect(0,0,W,H);
        const bw=W/buf.length*2;
        buf.forEach((v,i)=>{const h=v/255*H*0.85,x=i*bw;const g=ctx.createLinearGradient(0,H-h,0,H);g.addColorStop(0,`rgba(6,182,212,${0.6+v/512})`);g.addColorStop(1,`rgba(168,85,247,${0.4+v/512})`);ctx.fillStyle=g;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,H-h,Math.max(1,bw-1),h,2);else ctx.rect(x,H-h,Math.max(1,bw-1),h);ctx.fill();});
        rafId=requestAnimationFrame(draw);
      };
      draw();
    }catch(_){}
    return()=>{cancelAnimationFrame(rafId);const ctx=canvas.getContext('2d');if(ctx)ctx.clearRect(0,0,canvas.width,canvas.height);};
  },[isPlayingGlobal,currentSong?.is_local]);

  /* Media Session */
  useEffect(()=>{
    if(!('mediaSession' in navigator)||!currentSong?.is_local)return;
    // blob: URLs ne sont pas supportées par mediaSession → on utilise coverForSession
    const src=coverForSession&&!coverForSession.startsWith('blob:')?coverForSession:'/icon-192.png';
    const artType=src.startsWith('data:')?'image/png':src.endsWith('.png')?'image/png':'image/jpeg';
    try{navigator.mediaSession.metadata=new MediaMetadata({title:currentSong.title||'Titre inconnu',artist:currentSong.artist||'Fichier local',album:currentSong.album||'NovaSound Local',artwork:[{src,sizes:'192x192',type:artType},{src,sizes:'512x512',type:artType}]});}catch(_){}
    const handlers={play:()=>{const a=document.querySelector('audio');a?.play();},pause:()=>{const a=document.querySelector('audio');a?.pause();},nexttrack:()=>handleNext?.(),previoustrack:()=>handlePrevious?.(),seekbackward:()=>seekTo?.(Math.max(0,(audioCurrentTime||0)-10)),seekforward:()=>seekTo?.(Math.min(audioDuration||0,(audioCurrentTime||0)+10)),seekto:d=>{if(d.seekTime!=null)seekTo?.(d.seekTime);}};
    Object.entries(handlers).forEach(([a,h])=>{try{navigator.mediaSession.setActionHandler(a,h);}catch(_){}});
    if(audioDuration>0)try{navigator.mediaSession.setPositionState?.({duration:audioDuration,playbackRate:1,position:Math.min(audioCurrentTime||0,audioDuration)});}catch(_){}
    return()=>Object.keys(handlers).forEach(a=>{try{navigator.mediaSession.setActionHandler(a,null);}catch(_){};});
  },[currentSong,coverForSession,isPlayingGlobal,audioCurrentTime,audioDuration,handleNext,handlePrevious,seekTo]);

  /* Media Session — playbackState (bouton play/pause du mini lecteur OS) */
  useEffect(()=>{
    if(!('mediaSession' in navigator)||!currentSong?.is_local)return;
    try{navigator.mediaSession.playbackState=isPlayingGlobal?'playing':'paused';}catch(_){}
  },[isPlayingGlobal,currentSong?.is_local]);

  /* Sync depuis les événements natifs audio → mini lecteur OS toujours correct */
  useEffect(()=>{
    if(!('mediaSession' in navigator))return;
    const audio=document.querySelector('audio');
    if(!audio)return;
    const onPlay =()=>{try{navigator.mediaSession.playbackState='playing';}catch(_){}};
    const onPause=()=>{try{navigator.mediaSession.playbackState='paused';}catch(_){}};
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause',onPause);
    return()=>{audio.removeEventListener('play',onPlay);audio.removeEventListener('pause',onPause);};
  },[]);

  /* Keyboard shortcuts */
  useEffect(()=>{
    if(isMobile())return;
    const handler=e=>{
      const el=document.activeElement;
      if(el?.tagName==='INPUT'||el?.tagName==='TEXTAREA'||el?.hasAttribute('contenteditable'))return;
      switch(e.code){
        case'Space':e.preventDefault();if(currentSong?.is_local){togglePlayPause?.();showOSD('Space',isPlayingGlobalRef.current?'⏸ Pause':'▶ Lecture');}else if(songs.length){playSong(songs[0],songs);showOSD('Space','▶ Lecture');}break;
        case'ArrowLeft':if(e.altKey||e.metaKey)return;e.preventDefault();if(audioDuration>0){const t=Math.max(0,(audioCurrentTime||0)-10);seekTo?.(t);showOSD('←','⏪ -10s',fmtTime(t));}break;
        case'ArrowRight':if(e.altKey||e.metaKey)return;e.preventDefault();if(audioDuration>0){const t=Math.min(audioDuration,(audioCurrentTime||0)+10);seekTo?.(t);showOSD('→','⏩ +10s',fmtTime(t));}break;
        case'ArrowUp':e.preventDefault();setVolume(v=>{const n=Math.min(100,v+5);showOSD('↑','🔊 Volume',`${n}%`);return n;});setIsMuted(false);break;
        case'ArrowDown':e.preventDefault();setVolume(v=>{const n=Math.max(0,v-5);showOSD('↓','🔉 Volume',`${n}%`);return n;});break;
        case'KeyM':setIsMuted(v=>{showOSD('M',v?'🔊 Son activé':'🔇 Muet');return!v;});break;
        case'KeyN':handleNext?.();showOSD('N','⏭ Suivant');break;
        case'KeyP':handlePrevious?.();showOSD('P','⏮ Précédent');break;
        case'KeyS':toggleShuffle?.();showOSD('S',shuffle?'🔀 off':'🔀 Aléatoire');break;
        case'KeyR':cycleRepeat?.();showOSD('R',repeat==='off'?'🔁 Répéter tout':repeat==='all'?'🔂 Répéter 1':'🔁 Off');break;
        case'KeyL':e.preventDefault();setShowShortcuts(v=>!v);showOSD('L','⌨ Raccourcis');break;
        default:break;
      }
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[songs,currentSong,audioCurrentTime,audioDuration,togglePlayPause,seekTo,handleNext,handlePrevious,playSong,toggleShuffle,shuffle,cycleRepeat,repeat,showOSD]);

  /* Drag & Drop */
  useEffect(()=>{
    const onDragOver=e=>{e.preventDefault();setIsDragging(true);};
    const onDragLeave=e=>{if(!e.relatedTarget||!document.body.contains(e.relatedTarget))setIsDragging(false);};
    const onDrop=async e=>{
      e.preventDefault();setIsDragging(false);
      const files=[];
      for(const item of[...e.dataTransfer.items]){if(item.kind==='file'){const f=item.getAsFile();if(f&&isAudioFile(f))files.push(f);}}
      if(!files.length)return;
      setLoading(true);
      const ns=await processBatch(files);
      setSongs(prev=>{const merged=[...prev,...ns.filter(n=>!prev.find(p=>p.id===n.id))];if(prev.length===0&&ns.length)setTimeout(()=>playSong(ns[0],ns),50);return merged;});
      setLoading(false);
    };
    document.addEventListener('dragover',onDragOver);document.addEventListener('dragleave',onDragLeave);document.addEventListener('drop',onDrop);
    return()=>{document.removeEventListener('dragover',onDragOver);document.removeEventListener('dragleave',onDragLeave);document.removeEventListener('drop',onDrop);};
  },[playSong]);

  const processBatch=async files=>{const BATCH=4;const results=[];for(let i=0;i<files.length;i+=BATCH){const r=await Promise.all(files.slice(i,i+BATCH).map(f=>fileToSong(f).catch(()=>null)));results.push(...r.filter(Boolean));}return results;};

  const openPickerFSA=useCallback(async()=>{
    if(!FS_ACCESS_SUPPORTED){inputRef.current?.click();return;}
    try{
      const handles=await window.showOpenFilePicker({types:[{description:'Lecteur Local',accept:{'audio/*':['.mp3','.m4a','.wav','.flac','.ogg','.aac','.opus','.wma','.webm']}}],multiple:true});
      setLoading(true);const newSongs=[];
      for(let i=0;i<handles.length;i+=4){const res=await Promise.all(handles.slice(i,i+4).map(async h=>{try{const f=await h.getFile();if(!isAudioFile(f))return null;const s=await fileToSong(f,h);await idbSaveHandle(s.id,h);return s;}catch{return null;}}));newSongs.push(...res.filter(Boolean));}
      if(!newSongs.length){setLoading(false);return;}
      setSongs(prev=>{const merged=[...prev,...newSongs.filter(ns=>!prev.find(p=>p.id===ns.id))];if(prev.length===0)setTimeout(()=>playSong(newSongs[0],newSongs),50);return merged;});
      setLoading(false);
    }catch(err){if(err?.name!=='AbortError')inputRef.current?.click();else setLoading(false);}
  },[playSong]);

  const onFiles=useCallback(async e=>{
    const files=Array.from(e.target.files||[]).filter(isAudioFile);if(!files.length)return;
    setLoading(true);const ns=await processBatch(files);if(!ns.length){setLoading(false);return;}
    setSongs(prev=>{const merged=[...prev,...ns.filter(n=>!prev.find(p=>p.id===n.id))];if(prev.length===0)setTimeout(()=>playSong(ns[0],ns),50);return merged;});
    setLoading(false);e.target.value='';
  },[playSong]);

  const onReimportFiles=useCallback(async e=>{
    const files=Array.from(e.target.files||[]).filter(isAudioFile);if(!files.length)return;
    setLoading(true);const ns=await processBatch(files);
    setSongs(prev=>{const updated=prev.map(s=>{if(!s._needsReimport)return s;return ns.find(n=>n.id===s.id)||s;});ns.forEach(n=>{if(!updated.find(u=>u.id===n.id))updated.push(n);});const resolved=updated.filter(s=>!s._needsReimport&&ns.find(n=>n.id===s.id));if(resolved.length>0)setTimeout(()=>playSong(resolved[0],resolved),50);return updated;});
    setLoading(false);e.target.value='';
  },[playSong]);

  const removeFromQueue=useCallback(i=>{setSongs(prev=>{const s=prev[i];if(s._blobUrl)try{URL.revokeObjectURL(s._blobUrl);}catch(_){}if(s._hasBlobCover)try{URL.revokeObjectURL(s._coverBlobUrl);}catch(_){}idbDeleteHandle(s.id).catch(()=>{});return prev.filter((_,j)=>j!==i);});},[]);
  const clearAll=useCallback(()=>{songs.forEach(s=>{if(s._blobUrl)try{URL.revokeObjectURL(s._blobUrl);}catch(_){}if(s._hasBlobCover)try{URL.revokeObjectURL(s._coverBlobUrl);}catch(_){}});setSongs([]);setSelectedIds(new Set());setSelectionMode(false);},[songs]);
  const selectAll=useCallback(()=>setSelectedIds(new Set(songs.map(s=>s.id))),[songs]);
  const deselectAll=useCallback(()=>setSelectedIds(new Set()),[]);
  const toggleSelect=useCallback(id=>{setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});},[]);

  const savePlaylist=useCallback((name)=>{
    const selected=songs.filter(s=>selectedIds.has(s.id));
    if(FS_ACCESS_SUPPORTED)selected.forEach(s=>{if(s._fileHandle)idbSaveHandle(s.id,s._fileHandle).catch(()=>{});});
    const safeSongs=selected.map(s=>({id:s.id,title:s.title,artist:s.artist,album:s.album||'',cover_url:s.cover_svg||makeCoverSvg(s.title,s.artist),cover_svg:s.cover_svg||makeCoverSvg(s.title,s.artist),is_local:true,_needsReimport:!s._fileHandle,_fileHandle:s._fileHandle||null}));
    const pl={id:Date.now(),name,songs:safeSongs,createdAt:new Date().toISOString()};
    const updated=[...savedPlaylists,pl];setSavedPlaylists(updated);persistPlaylists(updated);
    setShowSaveModal(false);setSelectionMode(false);setSelectedIds(new Set());setActiveTab('playlists');
  },[songs,selectedIds,savedPlaylists]);

  const loadPlaylist=useCallback(async pl=>{
    setLoading(true);setRestoringHandles(true);
    try{
      const resolved=[];
      for(const saved of pl.songs){const live=songs.find(l=>l.id===saved.id&&!l._needsReimport);if(live){resolved.push(live);continue;}if(FS_ACCESS_SUPPORTED){const fh=await resolveFromHandle(saved);if(fh){await idbSaveHandle(fh.id,fh._fileHandle);resolved.push(fh);continue;}}resolved.push({...saved,_needsReimport:true});}
      setSongs(prev=>{const merged=[...prev];resolved.forEach(s=>{const idx=merged.findIndex(p=>p.id===s.id);if(idx<0)merged.push(s);else if(merged[idx]._needsReimport&&!s._needsReimport)merged[idx]=s;});const playable=resolved.filter(s=>!s._needsReimport);if(playable.length>0)setTimeout(()=>playSong(playable[0],playable),100);return merged;});
      if(!FS_ACCESS_SUPPORTED&&resolved.every(s=>s._needsReimport))reimportRef.current?.click();
    }catch(_){}
    setLoading(false);setRestoringHandles(false);setActiveTab('library');
  },[songs,playSong]);

  const deletePlaylist=useCallback(id=>{const updated=savedPlaylists.filter(p=>p.id!==id);setSavedPlaylists(updated);idbDelete(id).catch(()=>{});persistPlaylists(updated);},[savedPlaylists]);

  const filteredSongs=useMemo(()=>{
    let list=[...songs];
    if(searchQuery.trim()){const q=searchQuery.toLowerCase();list=list.filter(s=>s.title.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)||(s.album&&s.album.toLowerCase().includes(q)));}
    if(sortBy==='name')list.sort((a,b)=>a.title.localeCompare(b.title));
    if(sortBy==='artist')list.sort((a,b)=>a.artist.localeCompare(b.artist));
    return list;
  },[songs,searchQuery,sortBy]);

  const isLocalPlaying=!!currentSong?.is_local;
  const duration=isLocalPlaying?(audioDuration||0):0;
  const ct=isLocalPlaying?(audioCurrentTime||0):0;
  const VolumeIcon=isMuted||volume===0?VolumeX:Volume2;
  const glowColor=dominantColor?`rgba(${dominantColor},0.18)`:'rgba(6,182,212,0.08)';
  const glowColor2=dominantColor?`rgba(${dominantColor},0.10)`:'rgba(168,85,247,0.06)';

  const goOnline=useCallback(()=>{setModeTransition(true);setTimeout(()=>navigate('/'),950);},[navigate]);

  /* ── Mobile redirect ── */
  if(isMobile())return <LocalPlayerPageMobile/>;

  /* ═══════════════════════════════════════════════════════════════
     EMPTY STATE
     ═══════════════════════════════════════════════════════════════ */
  if(!songs.length) return(
    <div className="h-screen flex flex-col overflow-hidden" style={{background:'#07071a'}}>
      <AnimatePresence>
        {modeTransition&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[1000] flex items-center justify-center" style={{background:'#050510'}}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 60px rgba(6,182,212,0.55)'}}><Wifi className="w-9 h-9 text-white"/></div>
              <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="text-white font-black text-xl">Mode Online</motion.p>
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3,duration:0.65}} className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{transformOrigin:'left'}}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glass header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b" style={{background:'rgba(255,255,255,0.03)',backdropFilter:'blur(20px)',borderColor:'rgba(255,255,255,0.06)'}}>
        <button onClick={()=>navigate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all" style={{background:'rgba(255,255,255,0.06)'}}>
          <ArrowLeft className="w-5 h-5 text-gray-400"/>
        </button>
        <div className="flex-1">
          <p className="text-white font-black text-base">Lecteur Local</p>
          <p className="text-gray-600 text-xs flex items-center gap-1.5"><WifiOff className="w-3 h-3 text-cyan-500"/>100% hors-ligne</p>
        </div>
        <button onClick={goOnline} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-cyan-400 text-sm font-semibold transition-all" style={{background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.2)'}}>
          <Wifi className="w-3.5 h-3.5"/>Online
        </button>
        <Link to="/" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-cyan-400 transition-all" style={{background:'rgba(255,255,255,0.06)'}}><Home className="w-4 h-4"/></Link>
      </div>

      <input ref={inputRef} type="file" accept="audio/*" multiple onChange={onFiles} className="hidden"/>
      <input ref={reimportRef} type="file" accept="audio/*" multiple onChange={onReimportFiles} className="hidden"/>

      {/* Empty state with glass cards */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          <motion.div initial={{opacity:0,x:-30}} animate={{opacity:1,x:0}} className="flex flex-col gap-6">
            <div className="relative w-36 h-36">
              {/* Anneaux orbitaux */}
              <motion.div animate={{rotate:360}} transition={{duration:16,repeat:Infinity,ease:'linear'}}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{border:'1.5px dashed rgba(6,182,212,0.25)'}}>
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/80"/>
              </motion.div>
              <motion.div animate={{rotate:-360}} transition={{duration:10,repeat:Infinity,ease:'linear'}}
                className="absolute inset-3 rounded-full pointer-events-none"
                style={{border:'1.5px dashed rgba(168,85,247,0.3)'}}>
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-fuchsia-400 shadow-lg shadow-fuchsia-400/80"/>
              </motion.div>
              <motion.div animate={{rotate:360}} transition={{duration:6,repeat:Infinity,ease:'linear'}}
                className="absolute inset-6 rounded-full pointer-events-none"
                style={{border:'1px dashed rgba(34,211,238,0.2)'}}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-300 shadow-md shadow-cyan-300/80"/>
              </motion.div>
              {/* Halo pulse */}
              <motion.div animate={{scale:[1,1.18,1],opacity:[0.15,0.35,0.15]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{background:'radial-gradient(circle,rgba(6,182,212,0.4) 0%,transparent 70%)'}}/>
              <motion.div animate={{scale:[1,1.3,1],opacity:[0.1,0.25,0.1]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut',delay:1.5}}
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{background:'radial-gradient(circle,rgba(168,85,247,0.35) 0%,transparent 70%)'}}/>
              {/* Icône centrale */}
              <motion.div
                animate={{boxShadow:['0 0 40px rgba(6,182,212,0.3),0 0 20px rgba(124,58,237,0.2)','0 0 80px rgba(6,182,212,0.6),0 0 40px rgba(124,58,237,0.4)','0 0 40px rgba(6,182,212,0.3),0 0 20px rgba(124,58,237,0.2)']}}
                transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}
                className="absolute inset-6 rounded-2xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)'}}>
                <motion.div animate={loading?{rotate:360}:{scale:[1,1.08,1]}} transition={loading?{duration:1,repeat:Infinity,ease:'linear'}:{duration:2,repeat:Infinity,ease:'easeInOut'}}>
                  {loading
                    ?<div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                    :<HardDrive className="w-9 h-9 text-white drop-shadow-lg"/>}
                </motion.div>
              </motion.div>
            </div>
            <div>
              <h1 className="text-white text-5xl font-black tracking-tight mb-3">Lecteur Local</h1>
              <p className="text-gray-400 text-lg leading-relaxed">Écoute tes fichiers audio directement depuis ton appareil, sans aucune connexion internet.</p>
            </div>
            <motion.button onClick={FS_ACCESS_SUPPORTED?openPickerFSA:()=>inputRef.current?.click()}
              whileTap={{scale:.97}} whileHover={{scale:1.02}} disabled={loading}
              className="flex items-center justify-center gap-3 px-10 py-4 rounded-2xl text-white font-bold text-lg disabled:opacity-60 w-full lg:w-auto"
              style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 12px 40px rgba(6,182,212,0.3),0 4px 16px rgba(0,0,0,0.3)'}}>
              <FolderOpen className="w-6 h-6"/>
              {loading?'Chargement…':'Ouvrir des fichiers audio'}
            </motion.button>
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <GripVertical className="w-4 h-4"/>Glisse tes fichiers audio ici
            </div>
            <p className="text-gray-700 text-xs">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS · WMA</p>
          </motion.div>

          {/* Saved playlists preview */}
          <motion.div initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} transition={{delay:0.1}} className="flex flex-col gap-4">
            {savedPlaylists.length>0&&(
              <>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Playlists sauvegardées <span className="text-fuchsia-400">({savedPlaylists.length})</span></p>
                <div className="grid grid-cols-2 gap-3">
                  {savedPlaylists.slice(0,4).map(pl=>(
                    <button key={pl.id} onClick={()=>loadPlaylist(pl)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all hover:border-fuchsia-500/30"
                      style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(10px)'}}>
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={pl.songs[0]?.cover_url||pl.songs[0]?.cover_svg||makeCoverSvg(pl.name,'')} alt="" className="w-full h-full object-cover"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <NoTranslate tag="p" className="text-white text-xs font-semibold truncate truncate">{pl.name}</NoTranslate>
                        <p className="text-gray-600 text-[10px]">{pl.songs.length} fichier{pl.songs.length>1?'s':''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {/* Shortcuts */}
            <button onClick={()=>setShowShortcuts(v=>!v)} className="flex items-center gap-2 text-gray-600 hover:text-gray-400 text-xs transition-colors">
              <Keyboard className="w-3.5 h-3.5"/>Raccourcis clavier (L)
              <ChevronUp className={`w-3 h-3 transition-transform ${showShortcuts?'':'rotate-180'}`}/>
            </button>
            <AnimatePresence>
              {showShortcuts&&(
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-4 rounded-2xl" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    {[['Space','Lecture/Pause'],['← →','-10s/+10s'],['↑ ↓','Volume'],['M','Muet'],['N','Suivant'],['P','Précédent'],['S','Aléatoire'],['R','Répétition'],['L','Ce panneau']].map(([k,d])=>(
                      <div key={k} className="flex items-center gap-2">
                        <kbd className="min-w-[28px] px-1.5 py-0.5 rounded text-[10px] text-center font-mono font-bold text-cyan-300" style={{background:'rgba(6,182,212,0.12)',border:'1px solid rgba(6,182,212,0.2)'}}>{k}</kbd>
                        <span className="text-gray-500 text-[11px]">{d}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
      <KeyboardOSD osd={osd}/>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     MAIN PLAYER — 3 COLONNES GLASSMORPHISM
     ═══════════════════════════════════════════════════════════════ */
  return(
    <div className="h-screen flex flex-col overflow-hidden relative" style={{background:'#07071a'}}>

      {/* ── Cinematic background ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <AnimatePresence>
          {activeSong&&(
            <motion.div key={activeSong.id} initial={{opacity:0,scale:1.15}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:2,ease:'easeOut'}}
              className="absolute inset-0"
              style={{backgroundImage:`url(${cover})`,backgroundSize:'cover',backgroundPosition:'center',filter:'blur(80px) saturate(1.8)',transform:'scale(1.5)'}}/>
          )}
        </AnimatePresence>
        <div className="absolute inset-0" style={{background:'rgba(7,7,26,0.88)'}}/>
        <div className="absolute inset-0 transition-all duration-2000"
          style={{background:`radial-gradient(ellipse at 20% 50%,${glowColor} 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,${glowColor2} 0%,transparent 50%)`}}/>
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',backgroundSize:'60px 60px'}}/>
      </div>

      {/* Mode transition */}
      <AnimatePresence>
        {modeTransition&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[1000] flex items-center justify-center" style={{background:'#050510'}}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 60px rgba(6,182,212,0.55)'}}><Wifi className="w-9 h-9 text-white"/></div>
              <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="text-white font-black text-xl">Mode Online</motion.p>
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3,duration:0.65}} className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{transformOrigin:'left'}}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag & Drop overlay */}
      <AnimatePresence>
        {isDragging&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{background:'rgba(6,182,212,0.06)',border:'2px dashed rgba(6,182,212,0.4)',backdropFilter:'blur(4px)'}}>
            <div className="text-center"><Music2 className="w-20 h-20 text-cyan-400 mx-auto mb-4"/><p className="text-cyan-300 text-3xl font-black">Dépose ici</p></div>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={inputRef} type="file" accept="audio/*" multiple onChange={onFiles} className="hidden"/>
      <input ref={reimportRef} type="file" accept="audio/*" multiple onChange={onReimportFiles} className="hidden"/>

      {/* ── TOP BAR — glass ── */}
      <div className="relative z-30 flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b"
        style={{background:'rgba(7,7,26,0.7)',backdropFilter:'blur(24px)',borderColor:'rgba(255,255,255,0.06)',paddingTop:'calc(env(safe-area-inset-top,0px)+10px)'}}>
        <button onClick={()=>navigate(-1)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.08]" style={{background:'rgba(255,255,255,0.05)'}}><ArrowLeft className="w-4 h-4 text-gray-400"/></button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm leading-none">Lecteur Local</p>
          <div className="flex items-center gap-2 mt-0.5">
            <WifiOff className="w-2.5 h-2.5 text-cyan-400"/>
            <p className="text-gray-600 text-[10px]">100% hors-ligne · {songs.length} fichier{songs.length>1?'s':''}</p>
            {restoringHandles&&<span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold text-cyan-400" style={{background:'rgba(6,182,212,0.1)'}}><RefreshCcw className="w-2.5 h-2.5 animate-spin"/>Restauration…</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={FS_ACCESS_SUPPORTED?openPickerFSA:()=>inputRef.current?.click()} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)'}}>
            {loading?<div className="w-3.5 h-3.5 rounded-full border border-gray-500 border-t-cyan-400 animate-spin"/>:<Plus className="w-3.5 h-3.5 text-gray-300"/>}
            <span className="text-gray-300 hidden md:inline">Ajouter</span>
          </button>
          <button onClick={goOnline} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-cyan-400 text-sm font-semibold transition-all" style={{background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.2)'}}>
            <Wifi className="w-3.5 h-3.5"/>Online
          </button>
          <Link to="/" className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-cyan-400 transition-all" style={{background:'rgba(255,255,255,0.05)'}}><Home className="w-4 h-4"/></Link>
        </div>
      </div>

      {/* ── MAIN 3-COL LAYOUT ── */}
      <div className="relative z-10 flex-1 flex overflow-hidden min-h-0">

        {/* ═════════════════════════════════════
            LEFT — PLAYER GLASS PANEL
        ═════════════════════════════════════ */}
        <div className="flex-shrink-0 w-72 xl:w-80 border-r flex flex-col overflow-hidden"
          style={{background:'rgba(255,255,255,0.02)',backdropFilter:'blur(20px)',borderColor:'rgba(255,255,255,0.06)'}}>
          {activeSong?(
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col h-full p-4 gap-3 overflow-y-auto" style={{scrollbarWidth:'none'}}>

              {/* Cover with ambient glow */}
              <div className="relative flex-shrink-0">
                <motion.div animate={{scale:[1,1.06,1],opacity:[0.3,0.55,0.3]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut'}}
                  className="absolute -inset-4 rounded-2xl pointer-events-none"
                  style={{background:`url(${cover})`,backgroundSize:'cover',backgroundPosition:'center',filter:'blur(35px)',opacity:0.35}}/>
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl"
                  style={{boxShadow:'0 0 50px rgba(6,182,212,0.18),0 20px 60px rgba(0,0,0,0.7)'}}>
                  <img src={cover} alt={activeSong.title} className="w-full h-full object-cover"/>
                  {/* Visualizer overlay */}
                  <canvas ref={canvasRef} className="absolute bottom-0 left-0 right-0 h-14 opacity-75" width={400} height={56}/>
                  {isLocalPlaying&&isPlayingGlobal&&(
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-[3px] pointer-events-none">
                      {[0,1,2,3,4].map(i=>(
                        <motion.div key={i} className="w-1.5 rounded-t bg-cyan-400/80"
                          animate={{height:['5px','18px','7px','14px','5px']}}
                          transition={{duration:0.7+i*0.1,repeat:Infinity,delay:i*0.1,ease:'easeInOut'}}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Song info */}
              <div className="flex-shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <NoTranslate tag="p" className="text-white font-black text-lg truncate notranslate leading-tight"><NoTranslate className="truncate">{activeSong.title}</NoTranslate></NoTranslate>
                    <NoTranslate tag="p" className="text-cyan-400/80 text-sm truncate notranslate mt-0.5"><NoTranslate className="truncate">{activeSong.artist}</NoTranslate></NoTranslate>
                    {activeSong.album&&<p className="text-gray-600 text-xs truncate mt-0.5">{activeSong.album}</p>}
                  </div>
                  <button onClick={()=>toggleLocalFavorite(activeSong)} className={`flex-shrink-0 p-2 rounded-full transition-all ${favorited?'text-pink-500':'text-gray-600 hover:text-pink-400'}`}>
                    <Heart className={`w-4 h-4 ${favorited?'fill-current':''}`}/>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.4)'}}>Fichier local</span>
                  {activeSong._fileSize&&<span className="text-[10px] text-gray-700">{fmtSize(activeSong._fileSize)}</span>}
                  {isLocalPlaying&&<span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-cyan-400" style={{background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.2)'}}><EQBars active bars={3}/>En lecture</span>}
                  {sleepTimer!=null&&<span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-amber-400 font-medium" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)'}}><Timer className="w-2.5 h-2.5"/>{sleepTimer===-1?'Fin morceau':fmtMin(sleepTimer)}</span>}
                </div>
              </div>

              {/* Seek */}
              <div className="flex-shrink-0">
                <SeekBar currentTime={ct} duration={duration} onSeek={t=>seekTo?.(t)}/>
              </div>

              {/* Controls */}
              <div className="flex-shrink-0 flex items-center justify-between">
                <button onClick={()=>{toggleShuffle?.();showOSD('🔀',shuffle?'Aléatoire off':'Aléatoire');}} className={`p-2 rounded-xl transition-all ${shuffle?'text-cyan-400':'text-gray-600 hover:text-gray-300'}`} style={shuffle?{background:'rgba(6,182,212,0.12)'}:{}}><Shuffle className="w-4 h-4"/></button>
                <button onClick={()=>handlePrevious?.()} className="p-2 rounded-xl text-gray-300 hover:text-white transition-all"><SkipBack className="w-6 h-6"/></button>
                <motion.button whileTap={{scale:0.9}} onClick={()=>togglePlayPause?.()}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl"
                  style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 30px rgba(6,182,212,0.4),0 4px 16px rgba(0,0,0,0.4)'}}>
                  {isLocalPlaying&&isPlayingGlobal?<Pause className="w-6 h-6"/>:<Play className="w-6 h-6 ml-0.5"/>}
                </motion.button>
                <button onClick={()=>handleNext?.()} className="p-2 rounded-xl text-gray-300 hover:text-white transition-all"><SkipForward className="w-6 h-6"/></button>
                <button onClick={()=>{cycleRepeat?.();showOSD('🔁',repeat==='off'?'Répéter tout':repeat==='all'?'Répéter 1':'Off');}} className={`p-2 rounded-xl transition-all ${repeat!=='off'?'text-cyan-400':'text-gray-600 hover:text-gray-300'}`} style={repeat!=='off'?{background:'rgba(6,182,212,0.12)'}:{}}>{repeat==='one'?<Repeat1 className="w-4 h-4"/>:<Repeat className="w-4 h-4"/>}</button>
              </div>

              {/* Volume */}
              <div className="flex-shrink-0 flex items-center gap-3">
                <button onClick={()=>setIsMuted(v=>!v)} className="text-gray-600 hover:text-gray-300 transition-all flex-shrink-0"><VolumeIcon className="w-4 h-4"/></button>
                <div className="flex-1 relative h-5 flex items-center cursor-pointer group"
                  onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setVolume(Math.round(((e.clientX-r.left)/r.width)*100));setIsMuted(false);}}>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.08)'}}>
                    <div className="h-full rounded-full transition-all" style={{width:`${isMuted?0:volume}%`,background:'linear-gradient(90deg,#06b6d4,#a855f7)'}}/>
                  </div>
                </div>
                <span className="text-gray-600 text-[10px] tabular-nums w-7 text-right flex-shrink-0">{isMuted?'0':volume}%</span>
              </div>

              {/* Speed + Sleep */}
              <div className="flex-shrink-0 flex gap-2">
                <button onClick={()=>setShowSpeedPanel(v=>!v)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{background:showSpeedPanel?'rgba(6,182,212,0.12)':'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:showSpeedPanel?'#22d3ee':'rgba(255,255,255,0.4)'}}>
                  <Gauge className="w-3.5 h-3.5"/>{speed}×
                </button>
                <button onClick={()=>setShowSleepPanel(v=>!v)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{background:showSleepPanel?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:showSleepPanel?'#fbbf24':'rgba(255,255,255,0.4)'}}>
                  <Timer className="w-3.5 h-3.5"/>Sommeil
                </button>
              </div>

              {/* Speed panel */}
              <AnimatePresence>
                {showSpeedPanel&&(
                  <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="flex-shrink-0 overflow-hidden">
                    <div className="grid grid-cols-4 gap-1 p-2 rounded-xl" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
                      {[0.5,0.75,1,1.25,1.5,1.75,2,2.5].map(s=>(
                        <button key={s} onClick={()=>{setSpeed(s);showOSD('⚡','Vitesse',`${s}×`);}}
                          className="py-1.5 rounded-lg text-[11px] font-bold transition-all"
                          style={speed===s?{background:'rgba(6,182,212,0.2)',color:'#22d3ee',border:'1px solid rgba(6,182,212,0.3)'}:{background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.06)'}}>
                          {s}×
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sleep panel */}
              <AnimatePresence>
                {showSleepPanel&&(
                  <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="flex-shrink-0 overflow-hidden">
                    <div className="grid grid-cols-3 gap-1 p-2 rounded-xl" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
                      {[[null,'Off'],[5*60,'5m'],[10*60,'10m'],[15*60,'15m'],[30*60,'30m'],[60*60,'1h']].map(([val,lbl])=>(
                        <button key={lbl} onClick={()=>{if(!val){setSleepTimerTarget(null);setSleepTimer(null);showOSD('⏰','Minuterie off');}else{setSleepTimerTarget(Math.floor(Date.now()/1000)+val);showOSD('⏰','Minuterie',lbl);}setShowSleepPanel(false);}}
                          className="py-1.5 rounded-lg text-[11px] font-bold transition-all"
                          style={{background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.06)'}}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          ):(
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',opacity:0.7}}><Headphones className="w-8 h-8 text-white"/></div>
              <p className="text-gray-500 text-sm">Lance la lecture pour voir le lecteur ici</p>
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════
            CENTER — LIBRARY
        ═════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tab bar + search */}
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b"
            style={{background:'rgba(255,255,255,0.02)',backdropFilter:'blur(12px)',borderColor:'rgba(255,255,255,0.05)'}}>
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{background:'rgba(255,255,255,0.04)'}}>
              {[{k:'library',l:'Bibliothèque'},{k:'playlists',l:'Playlists'},{k:'favoris',l:'❤ Favoris'}].map(({k,l})=>(
                <button key={k} onClick={()=>setActiveTab(k)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={activeTab===k?{background:'rgba(6,182,212,0.18)',color:'#22d3ee',border:'1px solid rgba(6,182,212,0.25)'}:{color:'rgba(255,255,255,0.4)'}}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 min-w-0" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}}>
              <Search className="w-3.5 h-3.5 text-gray-600 flex-shrink-0"/>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                placeholder="Rechercher…" className="flex-1 bg-transparent text-white text-sm placeholder-gray-700 outline-none min-w-0"/>
              {searchQuery&&<button onClick={()=>setSearchQuery('')}><X className="w-3.5 h-3.5 text-gray-600 hover:text-gray-400"/></button>}
            </div>
            {/* Custom sort dropdown */}
            <div className="relative">
              <button
                onClick={()=>setShowSortMenu(v=>!v)}
                className="flex items-center gap-1.5 text-xs rounded-xl px-2.5 py-2 transition-all"
                style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${showSortMenu?'rgba(6,182,212,0.4)':'rgba(255,255,255,0.07)'}`,color:showSortMenu?'#22d3ee':'rgba(255,255,255,0.4)'}}>
                <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu?'rotate-180 text-cyan-400':''}`}/>
                <span>{sortBy==='default'?'Défaut':sortBy==='name'?'Titre':'Artiste'}</span>
              </button>
              <AnimatePresence>
                {showSortMenu&&(
                  <>
                    <div className="fixed inset-0 z-10" onClick={()=>setShowSortMenu(false)}/>
                    <motion.div
                      initial={{opacity:0,y:-6,scale:0.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6,scale:0.96}}
                      transition={{duration:0.12}}
                      className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden min-w-[110px]"
                      style={{background:'rgba(6,6,22,0.97)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(20px)',boxShadow:'0 16px 40px rgba(0,0,0,0.6)'}}>
                      {[['default','Défaut','🔀'],['name','Titre','🔤'],['artist','Artiste','🎤']].map(([v,l,e])=>(
                        <button key={v} onClick={()=>{setSortBy(v);setShowSortMenu(false);}}
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-left transition-all"
                          style={sortBy===v?{background:'rgba(6,182,212,0.12)',color:'#22d3ee'}:{color:'rgba(255,255,255,0.6)'}}>
                          <span>{e}</span>{l}
                          {sortBy===v&&<Check className="w-3 h-3 ml-auto text-cyan-400"/>}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            {activeTab==='library'&&songs.length>0&&(
              <div className="flex items-center gap-1">
                <button onClick={()=>{setSelectionMode(v=>{if(v){setSelectedIds(new Set());}return !v;});}}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={selectionMode?{background:'rgba(139,92,246,0.15)',color:'#a78bfa',border:'1px solid rgba(139,92,246,0.25)'}:{background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.07)'}}>
                  {selectionMode?`${selectedIds.size} sél.`:'Sélect.'}
                </button>
                {selectionMode&&selectedIds.size>0&&(
                  <button onClick={()=>setShowSaveModal(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                    style={{background:'rgba(6,182,212,0.12)',color:'#22d3ee',border:'1px solid rgba(6,182,212,0.2)'}}>
                    <Save className="w-3 h-3"/>Playlist
                  </button>
                )}
                <button onClick={clearAll} className="p-1.5 rounded-xl text-red-400/60 hover:text-red-400 transition-all" style={{background:'rgba(255,255,255,0.04)'}}><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:'none'}}>
            {activeTab==='library'&&(
              <div className="p-2">
                {/* Column headers */}
                {filteredSongs.length>0&&(
                  <div className="flex items-center gap-3 px-3 py-1 mb-1 text-[10px] text-gray-700 uppercase tracking-widest">
                    <div className="w-6"/>
                    <div className="w-9 flex-shrink-0"/>
                    <div className="flex-1">Titre</div>
                    <div className="hidden lg:block w-24 flex-shrink-0">Album</div>
                    <div className="w-10 text-right flex-shrink-0">Durée</div>
                    <div className="w-8 flex-shrink-0"/>
                  </div>
                )}
                {filteredSongs.length===0?(
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Music2 className="w-12 h-12 text-gray-700 mb-3"/>
                    {songs.length===0?(
                      <><p className="text-gray-500 text-sm mb-4">Aucun fichier. Ouvre un dossier ou glisse tes fichiers ici.</p>
                      <button onClick={FS_ACCESS_SUPPORTED?openPickerFSA:()=>inputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold" style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)'}}><FolderOpen className="w-4 h-4"/>Ouvrir</button></>
                    ):<p className="text-gray-600 text-sm">Aucun résultat pour « {searchQuery} »</p>}
                  </div>
                ):(
                  filteredSongs.map((song,i)=>(
                    <SongRow key={song.id} song={song} index={i}
                      isActive={currentSong?.id===song.id}
                      isSelected={selectedIds.has(song.id)}
                      onPlay={()=>{playSong({...song,audio_url:song.audio_url||song._blobUrl},songs);}}
                      onRemove={()=>removeFromQueue(songs.indexOf(song))}
                      selectionMode={selectionMode}
                      onToggleSelect={()=>toggleSelect(song.id)}
                      duration={trackDurations[song.id]}/>
                  ))
                )}
              </div>
            )}

            {activeTab==='playlists'&&(
              <div className="p-4">
                {savedPlaylists.length===0?(
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <ListMusic className="w-12 h-12 text-gray-700 mb-3"/>
                    <p className="text-gray-500 text-sm">Aucune playlist sauvegardée.<br/>Sélectionne des fichiers et clique sur « Playlist ».</p>
                  </div>
                ):(
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {savedPlaylists.map(pl=>(
                      <motion.div key={pl.id} layout initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                        className="rounded-2xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.02]"
                        style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(10px)'}}
                        onClick={()=>loadPlaylist(pl)}>
                        <div className="aspect-square relative overflow-hidden">
                          <img src={pl.songs[0]?.cover_url||pl.songs[0]?.cover_svg||makeCoverSvg(pl.name,'')} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{background:'rgba(6,182,212,0.9)'}}><Play className="w-5 h-5 text-white fill-current ml-0.5"/></div>
                          </div>
                        </div>
                        <div className="p-3">
                          <NoTranslate tag="p" className="text-white text-sm font-bold truncate truncate">{pl.name}</NoTranslate>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-gray-600 text-[10px]">{pl.songs.length} titre{pl.songs.length>1?'s':''}</p>
                            <button onClick={e=>{e.stopPropagation();deletePlaylist(pl.id);}} className="text-gray-700 hover:text-red-400 transition-all p-1 rounded"><Trash2 className="w-3 h-3"/></button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab==='favoris'&&(
              <div className="p-4">
                {localFavoriteSongs.length===0?(
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <motion.div animate={{scale:[1,1.15,1]}} transition={{duration:2,repeat:Infinity,ease:'easeInOut'}}>
                      <Heart className="w-12 h-12 text-pink-500/30 mb-3"/>
                    </motion.div>
                    <p className="text-gray-500 text-sm">Aucun favori pour l'instant.<br/>Clique sur ❤ pour ajouter un son.</p>
                  </div>
                ):(
                  <div className="space-y-1">
                    {/* En-tête */}
                    <div className="flex items-center justify-between px-3 py-2 mb-2">
                      <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">{localFavoriteSongs.length} titre{localFavoriteSongs.length>1?'s':''}</p>
                      <button
                        onClick={()=>{
                          const playable=localFavoriteSongs.filter(s=>!s._needsReimport);
                          if(playable.length>0)playSong(playable[0],playable);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{background:'rgba(236,72,153,0.12)',color:'#f472b6',border:'1px solid rgba(236,72,153,0.2)'}}>
                        <Play className="w-3 h-3 fill-current"/>Tout lire
                      </button>
                    </div>
                    {localFavoriteSongs.map((song,i)=>{
                      const isActive=currentSong?.id===song.id;
                      const coverSrc=song.cover_url||song.cover_svg||makeCoverSvg(song.title,song.artist);
                      return(
                        <motion.div key={song.id} layout initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${isActive?'bg-white/[0.08] border border-pink-500/20':'hover:bg-white/[0.05] border border-transparent'}`}
                          onClick={()=>{const live=songs.find(s=>s.id===song.id);if(live)playSong(live,songs.filter(s=>localFavoriteIds.has(s.id)));}}> 
                          {/* Cover */}
                          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative">
                            <img src={coverSrc} alt="" className="w-full h-full object-cover"/>
                            {isActive&&<div className="absolute inset-0 bg-black/40 flex items-center justify-center"><EQBars active bars={3}/></div>}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <NoTranslate tag="p" className={`text-xs font-semibold truncate ${isActive?'text-pink-400':'text-white'}`}>{song.title}</NoTranslate>
                            <NoTranslate tag="p" className="text-[10px] text-gray-600 truncate">{song.artist}</NoTranslate>
                          </div>
                          {/* Bouton retirer */}
                          <button
                            onClick={e=>{e.stopPropagation();toggleLocalFavorite(song);}}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 transition-all flex-shrink-0"
                            title="Retirer des favoris">
                            <Heart className="w-3.5 h-3.5 fill-current"/>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═════════════════════════════════════
            RIGHT — QUEUE / INFO
        ═════════════════════════════════════ */}
        <div className="hidden xl:flex flex-col flex-shrink-0 w-64 border-l overflow-hidden"
          style={{background:'rgba(255,255,255,0.02)',backdropFilter:'blur(20px)',borderColor:'rgba(255,255,255,0.06)'}}>
          <div className="flex-shrink-0 px-4 py-3 border-b flex items-center justify-between" style={{borderColor:'rgba(255,255,255,0.05)'}}>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">File d'attente</p>
            <span className="text-gray-700 text-[10px]">{songs.length} fichier{songs.length>1?'s':''}</span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:'none'}}>
            {songs.map((song,i)=>{
              const isActive=currentSong?.id===song.id;
              return(
                <div key={song.id} onClick={()=>playSong({...song,audio_url:song.audio_url||song._blobUrl},songs)}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all ${isActive?'bg-white/[0.06]':'hover:bg-white/[0.04]'}`}>
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={song.cover_url||song.cover_svg} alt="" className="w-full h-full object-cover"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <NoTranslate tag="p" className={`text-xs font-semibold truncate notranslate ${isActive?'text-cyan-300':'text-gray-300'}`} translate="no"><NoTranslate className="truncate">{song.title}</NoTranslate></NoTranslate>
                    <NoTranslate tag="p" className="text-[10px] text-gray-600 truncate notranslate"><NoTranslate className="truncate">{song.artist}</NoTranslate></NoTranslate>
                  </div>
                  {isActive&&<EQBars active bars={3}/>}
                </div>
              );
            })}
          </div>
          {/* Shortcuts */}
          <div className="flex-shrink-0 border-t p-3" style={{borderColor:'rgba(255,255,255,0.05)'}}>
            <button onClick={()=>setShowShortcuts(v=>!v)} className="flex items-center gap-2 text-gray-700 hover:text-gray-500 text-[10px] transition-all w-full">
              <Keyboard className="w-3 h-3"/>Raccourcis (L)
              <ChevronUp className={`w-3 h-3 ml-auto transition-transform ${showShortcuts?'':'rotate-180'}`}/>
            </button>
            <AnimatePresence>
              {showShortcuts&&(
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden mt-2">
                  {[['Space','Lecture/Pause'],['← →','±10s'],['↑ ↓','Volume'],['M','Muet'],['N/P','Suivant/Préc.'],['S/R','Aléa./Répét.']].map(([k,d])=>(
                    <div key={k} className="flex items-center gap-2 py-0.5">
                      <kbd className="min-w-[28px] px-1 py-0.5 rounded text-[9px] text-center font-mono text-cyan-400" style={{background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.15)'}}>{k}</kbd>
                      <span className="text-gray-700 text-[10px]">{d}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Save Playlist Modal ── */}
      <AnimatePresence>
        {showSaveModal&&(
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm" onClick={()=>setShowSaveModal(false)}/>
            <motion.div initial={{scale:0.92,y:20,opacity:0}} animate={{scale:1,y:0,opacity:1}} exit={{scale:0.92,y:20,opacity:0}}
              transition={{type:'spring',stiffness:420,damping:30}}
              className="fixed inset-0 z-[301] flex items-center justify-center p-5">
              <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
                style={{background:'rgba(6,6,20,0.98)',border:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(32px)',boxShadow:'0 32px 80px rgba(0,0,0,0.8),0 0 0 1px rgba(6,182,212,0.08)'}}>
                {/* Header gradient line */}
                <div className="h-px w-full" style={{background:'linear-gradient(90deg,transparent,rgba(6,182,212,0.6),rgba(168,85,247,0.6),transparent)'}}/>
                <div className="p-6">
                  {/* Icon + title */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{background:'linear-gradient(135deg,rgba(6,182,212,0.15),rgba(168,85,247,0.15))',border:'1px solid rgba(255,255,255,0.08)'}}>
                      <ListMusic className="w-5 h-5 text-cyan-400"/>
                    </div>
                    <div>
                      <h3 className="text-white font-black text-base leading-tight">Nouvelle playlist</h3>
                      <p className="text-gray-600 text-xs mt-0.5">{selectedIds.size} fichier{selectedIds.size>1?'s':''} sélectionné{selectedIds.size>1?'s':''}</p>
                    </div>
                  </div>
                  {/* Input */}
                  <div className="relative mb-4">
                    <input type="text" placeholder="Nom de la playlist…" autoFocus
                      onKeyDown={e=>e.key==='Enter'&&e.target.value.trim()&&savePlaylist(e.target.value.trim())}
                      id="pl-name-input"
                      className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none pr-10 transition-all"
                      style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',caretColor:'#22d3ee'}}
                      onFocus={e=>{e.target.style.borderColor='rgba(6,182,212,0.4)';e.target.style.boxShadow='0 0 0 3px rgba(6,182,212,0.06)';}}
                      onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none';}}/>
                    <Music2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700 pointer-events-none"/>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={()=>setShowSaveModal(false)}
                      className="flex-1 py-2.5 rounded-xl text-gray-500 text-sm font-semibold transition-all hover:text-gray-300"
                      style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
                      Annuler
                    </button>
                    <button onClick={()=>{const v=document.getElementById('pl-name-input')?.value?.trim();if(v)savePlaylist(v);}}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:brightness-110 flex items-center justify-center gap-2"
                      style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 4px 16px rgba(6,182,212,0.25)'}}>
                      <Save className="w-3.5 h-3.5"/>Sauvegarder
                    </button>
                  </div>
                </div>
                <div className="h-px w-full" style={{background:'linear-gradient(90deg,transparent,rgba(168,85,247,0.3),transparent)'}}/>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <KeyboardOSD osd={osd}/>
    </div>
  );
};

export default LocalPlayerPage;
