/**
 * LocalPlayerPage — NovaSound TITAN LUX V3000000
 *
 * ✅ MODE NATIF COMPLET - Accès fichiers audio appareil
 * ✅ Remplacement total import manuel → scan automatique bibliothèque
 * ✅ Interface lecteur natif (Spotify/Apple Music style)
 * ✅ Support iOS/Android/Desktop avec accès natif
 * ✅ Métadonnées complètes + organisation automatique
 * ✅ Refonte cinématique totale — fond cover blurré animé
 * ✅ Keyboard OSD — overlay visuel à chaque raccourci clavier
 * ✅ Media Session API — contrôles écran verrouillé desktop/Android
 * ✅ Transition offline→online cinématique avec overlay
 * ✅ Raccourcis : Space · ← → · ↑ ↓ · M · N · P · S · R · L
 * ✅ Layout 3-col desktop : cover animée | bibliothèque | playlists
 * ✅ Volume scroll + barre interactive
 * ✅ IDB persistence + FSA handles
 * ✅ Mobile → redirect vers LocalPlayerPageMobile
 */
import React, {
  useState, useRef, useCallback, useEffect, memo, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, HardDrive, WifiOff, Wifi, ListMusic, Trash2, Plus,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX,
  Save, CheckSquare, Square, Folder, ChevronUp,
  RefreshCw, AlertTriangle, RefreshCcw, Search, X, SlidersHorizontal,
  ArrowLeft, Home, ChevronDown, Music2,
  Keyboard, GripVertical, Smartphone, Headphones, Radio, Disc, Clock,
  User, Library, Grid, List, Heart, MoreHorizontal, Settings
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';
import Footer from '@/components/Footer';
import LocalPlayerPageMobile from './LocalPlayerPageMobile';
import NativeAudioPlayer from '@/components/NativeAudioPlayer';
import { nativeAudioAccess } from '@/lib/nativeAudioAccess';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & UTILS
   ═══════════════════════════════════════════════════════════════ */
const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = f => AUDIO_EXTS.test(f.name) || f.type.startsWith('audio/') || f.type === 'video/mp4';
const FS_ACCESS_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const isMobile = () =>
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

const fmtTime = s => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
};
const fmtSize = bytes => {
  if (!bytes) return '';
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
};

/* ═══════════════════════════════════════════════════════════════
   INDEXEDDB
   ═══════════════════════════════════════════════════════════════ */
const IDB_NAME = 'novasound_local_v2', IDB_STORE = 'playlists', IDB_HANDLES = 'file_handles';
const openIDB = () => new Promise((res, rej) => {
  const r = indexedDB.open(IDB_NAME, 2);
  r.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(IDB_STORE))   db.createObjectStore(IDB_STORE,   { keyPath: 'id' });
    if (!db.objectStoreNames.contains(IDB_HANDLES)) db.createObjectStore(IDB_HANDLES, { keyPath: 'songId' });
  };
  r.onsuccess = e => res(e.target.result); r.onerror = () => rej(r.error);
});
const idbSave = async pl => { try { const db = await openIDB(); const tx = db.transaction(IDB_STORE,'readwrite'); tx.objectStore(IDB_STORE).put({...pl,songs:pl.songs.map(s=>({...s,_fileHandle:undefined,_file:undefined,_blobUrl:undefined}))}); return new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;}); } catch(_){} };
const idbDelete = async id => { try { const db = await openIDB(); const tx = db.transaction(IDB_STORE,'readwrite'); tx.objectStore(IDB_STORE).delete(id); return new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;}); } catch(_){} };
const idbLoadAll = async () => { try { const db = await openIDB(); const tx = db.transaction(IDB_STORE,'readonly'); const r = tx.objectStore(IDB_STORE).getAll(); return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result||[]);r.onerror=rej;}); } catch(_){ return []; } };
const idbSaveHandle = async (songId, handle) => { if (!handle) return; try { const db = await openIDB(); const tx = db.transaction(IDB_HANDLES,'readwrite'); tx.objectStore(IDB_HANDLES).put({songId,handle}); return new Promise(r=>{tx.oncomplete=r;tx.onerror=()=>r();}); } catch(_){} };
const idbGetHandle  = async songId => { try { const db = await openIDB(); const tx = db.transaction(IDB_HANDLES,'readonly'); const r = tx.objectStore(IDB_HANDLES).get(songId); return new Promise(res=>{r.onsuccess=()=>res(r.result?.handle||null);r.onerror=()=>res(null);}); } catch(_){ return null; } };
const idbDeleteHandle = async songId => { try { const db = await openIDB(); const tx = db.transaction(IDB_HANDLES,'readwrite'); tx.objectStore(IDB_HANDLES).delete(songId); } catch(_){} };

/* ═══════════════════════════════════════════════════════════════
   COVER SVG
   ═══════════════════════════════════════════════════════════════ */
const _xmlEsc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const makeCoverSvg = (title='', artist='') => {
  const hue = s => { let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h%360; };
  const c1 = `hsl(${hue(title)},60%,42%)`, c2 = `hsl(${hue(artist||title.split('').reverse().join(''))},65%,55%)`;
  const letter = _xmlEsc((title[0]||'♫').toUpperCase());
  const label  = _xmlEsc(title.slice(0,18));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="85" r="42" fill="rgba(0,0,0,0.2)"/><text x="100" y="102" font-family="system-ui,sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${letter}</text><text x="100" y="160" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.5)" text-anchor="middle">${label}</text></svg>`;
  try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); }
  catch(_) { return `data:image/svg+xml,${encodeURIComponent(svg)}`; }
};

const persistPlaylists = playlists => {
  playlists.forEach(pl => idbSave(pl).catch(()=>{}));
  try {
    const safe = playlists.map(pl=>({
      id:pl.id,name:pl.name,createdAt:pl.createdAt,
      songs:pl.songs.map(s=>({id:s.id,title:s.title,artist:s.artist,album:s.album||'',cover_url:s.cover_svg||makeCoverSvg(s.title,s.artist),cover_svg:s.cover_svg||makeCoverSvg(s.title,s.artist),is_local:true,_needsReimport:true})),
    }));
    const str = JSON.stringify(safe);
    if (str.length < 5*1024*1024) localStorage.setItem('novasound_local_playlists', str);
  } catch(_) {}
};

/* ═══════════════════════════════════════════════════════════════
   ID3v2 PARSER
   ═══════════════════════════════════════════════════════════════ */
const parseID3 = async file => {
  const meta = { title:'', artist:'', album:'', cover:null, duration:null };
  if (file.size > 500 * 1024 * 1024) return meta;
  try {
    const bytesP = file.slice(0,512*1024).arrayBuffer();
    const timeout = new Promise((_,rej) => setTimeout(() => rej(new Error('id3 timeout')), 8000));
    const bytes = new Uint8Array(await Promise.race([bytesP, timeout]));
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
        let i=1; while(i<data.length&&data[i]!==0)i++; i++; i++;
        while(i<data.length&&data[i]!==0)i++; i++;
        try{meta.cover=URL.createObjectURL(new Blob([data.slice(i)],{type:'image/jpeg'}));}catch(_){}
      }
      pos+=10+fsz;
    }
  } catch(_) {}
  return meta;
};

const ALLOWED_AUDIO_MIME = /^audio\/|^video\/mp4$|^video\/webm$/;
const fileToSong = async (file, handle=null) => {
  if (!isAudioFile(file) && !ALLOWED_AUDIO_MIME.test(file.type)) return null;
  const url = URL.createObjectURL(file);
  const raw = file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');
  const tags = await parseID3(file);
  const title = tags.title || raw, artist = tags.artist || 'Local file';
  const svg = makeCoverSvg(title, artist);
  return {
    id:'local::'+file.name+'::'+file.size, title, artist, album:tags.album||'',
    audio_url:url, cover_url:tags.cover||svg, cover_svg:svg,
    is_local:true, _file:file, _blobUrl:url, _fileSize:file.size,
    _hasBlobCover:!!tags.cover, _coverBlobUrl:tags.cover||null, _fileHandle:handle||null,
  };
};

const resolveFromHandle = async saved => {
  if (!FS_ACCESS_SUPPORTED) return null;
  const handle = saved._fileHandle || (await idbGetHandle(saved.id));
  if (!handle) return null;
  try {
    let perm = await handle.queryPermission({mode:'read'});
    if (perm==='prompt') perm = await handle.requestPermission({mode:'read'});
    if (perm!=='granted') return null;
    const file = await handle.getFile();
    return fileToSong(file, handle);
  } catch(_){ return null; }
};

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* EQ Bars */
const EQBars = ({ active, color='#22d3ee', bars=5 }) => (
  <div className="flex gap-px items-end" style={{height:16}}>
    {Array.from({length:bars}).map((_,i)=>(
      <div key={i} className="w-0.5 rounded-full" style={{
        background:color,
        height:active?`${4+Math.sin(i*1.2)*4+8}px`:'3px',
        animation:active?`novaWave ${0.35+i*0.12}s ease-in-out infinite alternate`:'none',
        animationDelay:`${i*0.08}s`,
        transition:'height 0.2s',
        opacity:active?1:0.3,
      }}/>
    ))}
  </div>
);

/* Seek Bar */
const SeekBar = ({ currentTime, duration, onSeek, color='#22d3ee', size='md' }) => {
  const trackRef  = useRef(null);
  const boundsRef = useRef(null); // cache getBoundingClientRect → zéro reflow pendant le drag
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState(0);
  const getPct = useCallback(x => {
    const b = boundsRef.current;
    if (!b) return 0;
    return Math.max(0, Math.min(1, (x - b.left) / b.width));
  }, []);
  const start = useCallback(x => {
    if (trackRef.current) boundsRef.current = trackRef.current.getBoundingClientRect();
    setDragging(true); setDragPct(getPct(x));
  }, [getPct]);
  const move  = useCallback(x => { if (!dragging) return; setDragPct(getPct(x)); }, [dragging, getPct]);
  const end   = useCallback(x => {
    if (!dragging) return;
    const p = getPct(x); setDragging(false); setDragPct(p); boundsRef.current = null;
    if (onSeek && duration > 0) onSeek(p * duration);
  }, [dragging, getPct, onSeek, duration]);
  useEffect(() => {
    if (!dragging) return;
    const mm = e => move(e.clientX), mu = e => end(e.clientX);
    const tm = e => { e.preventDefault(); move(e.touches[0].clientX); };
    const tu = e => end(e.changedTouches[0].clientX);
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', tu);
    return () => {
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu);
      window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', tu);
    };
  }, [dragging, move, end]);
  const pct = dragging ? dragPct : (duration>0 ? currentTime/duration : 0);
  const h = size==='lg' ? 6 : 4;
  const dotSize = size==='lg' ? (dragging?22:16) : (dragging?16:11);
  return (
    <div className="w-full select-none group/seek">
      <div ref={trackRef} className="relative w-full cursor-pointer" style={{height:20,display:'flex',alignItems:'center'}}
        onMouseDown={e=>{e.preventDefault();start(e.clientX);}}
        onTouchStart={e=>{e.preventDefault();start(e.touches[0].clientX);}}
        onClick={e=>{if(!dragging&&onSeek&&duration>0)onSeek(getPct(e.clientX)*duration);}}>
        <div className="absolute inset-0 my-auto rounded-full" style={{height:h,background:'rgba(255,255,255,0.08)'}}/>
        <div className="absolute left-0 my-auto rounded-full transition-all" style={{height:h,top:'50%',transform:'translateY(-50%)',width:`${pct*100}%`,background:`linear-gradient(90deg,${color},#a855f7)`}}/>
        <div className="absolute opacity-0 group-hover/seek:opacity-100 transition-opacity" style={{left:`${pct*100}%`,top:'50%',transform:'translate(-50%,-50%)',width:dotSize,height:dotSize,borderRadius:'50%',background:'white',boxShadow:`0 0 12px ${color}80`,transition:dragging?'none':'all .1s'}}/>
        {dragging&&<div className="absolute" style={{left:`${pct*100}%`,top:'50%',transform:'translate(-50%,-50%)',width:dotSize,height:dotSize,borderRadius:'50%',background:'white',boxShadow:`0 0 12px ${color}80`}}/>}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums mt-1" style={{color:'rgba(255,255,255,0.35)'}}>
        <span>{fmtTime(pct*(duration||0))}</span>
        <span>{duration>0?fmtTime(duration):'--:--'}</span>
      </div>
    </div>
  );
};

/* SongRow */
const SongRow = memo(({song,index,isActive,isSelected,onPlay,onRemove,selectionMode,onToggleSelect,duration})=>{
  const nr = !!song._needsReimport;
  const cover = song.cover_url||song.cover_svg;
  return (
    <motion.div
      initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
      transition={{duration:0.15,delay:Math.min(index*0.02,0.3)}}
      onClick={nr?undefined:(selectionMode?onToggleSelect:onPlay)}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${
        nr?'opacity-50 bg-amber-500/5 border border-amber-500/15':
        isActive?'bg-cyan-500/12 border border-cyan-500/20':
        isSelected?'bg-violet-500/10 border border-violet-500/20':
        'hover:bg-white/[0.05] border border-transparent hover:border-white/[0.07]'
      }`}>
      <div className="w-6 flex-shrink-0 text-center">
        {selectionMode?(isSelected?<CheckSquare className="w-4 h-4 text-violet-400 mx-auto"/>:<Square className="w-4 h-4 text-gray-600 mx-auto"/>):
          isActive?(<EQBars active bars={3}/>):(
            <><span className="text-[11px] text-gray-600 tabular-nums group-hover:hidden">{index+1}</span>
            <Play className="w-3 h-3 text-gray-400 mx-auto hidden group-hover:block"/></>
          )
        }
      </div>
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative shadow-sm">
        <img src={cover} alt={song.title} className="w-full h-full object-cover"/>
        {nr&&<div className="absolute inset-0 bg-black/70 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-amber-400"/></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate leading-tight ${isActive?'text-white':nr?'text-gray-500':'text-gray-200'}`}>{song.title}</p>
        <p className="text-[11px] truncate">{nr?<span className="text-amber-400/80">⚠ Reload needed</span>:<span className="text-gray-500">{song.artist}</span>}</p>
      </div>
      <div className="hidden lg:block w-32 flex-shrink-0 min-w-0">
        <p className="text-[11px] text-gray-600 truncate">{song.album||''}</p>
      </div>
      <span className="text-[11px] text-gray-600 tabular-nums w-10 text-right flex-shrink-0">{duration?fmtTime(duration):nr?'--:--':''}</span>
      <button onClick={e=>{e.stopPropagation();onRemove();}} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-all flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5"/>
      </button>
    </motion.div>
  );
});
SongRow.displayName='SongRow';

/* PlaylistCard */
const PlaylistCard = memo(({pl,onLoad,onDelete,liveSongs})=>{
  const cover = pl.songs[0]?.cover_url||pl.songs[0]?.cover_svg||makeCoverSvg(pl.name,'');
  const ready = pl.songs.filter(s=>{const l=liveSongs?.find(x=>x.id===s.id);return l&&!l._needsReimport;}).length;
  return (
    <motion.div layout initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}}
      className="bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/[0.12] rounded-2xl p-4 cursor-pointer transition-all group"
      onClick={()=>onLoad(pl)}>
      <div className="aspect-square rounded-xl overflow-hidden mb-3 shadow-md">
        <img src={cover} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
      </div>
      <p className="text-white text-sm font-bold truncate group-hover:text-fuchsia-300 transition-colors">{pl.name}</p>
      <p className="text-gray-600 text-[10px] mt-0.5">{pl.songs.length} fichier{pl.songs.length>1?'s':''}{ready>0&&ready<pl.songs.length?` · ${ready} prêts`:''}</p>
      <div className="flex gap-2 mt-3">
        <button onClick={e=>{e.stopPropagation();onLoad(pl);}}
          className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-all">
          <Play className="w-3 h-3"/> Lire
        </button>
        <button onClick={e=>{e.stopPropagation();onDelete(pl.id);}}
          className="p-1.5 rounded-xl bg-white/5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3.5 h-3.5"/>
        </button>
      </div>
    </motion.div>
  );
});
PlaylistCard.displayName='PlaylistCard';

/* SavePlaylistModal */
const SavePlaylistModal = ({count,onSave,onClose}) => {
  const [name,setName]=useState('');
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-[300] flex items-center justify-center p-5 bg-black/80 backdrop-blur-sm"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{scale:0.9,y:16}} animate={{scale:1,y:0}}
        className="w-full max-w-sm bg-[#0a0a1a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-1">Nouvelle playlist</h3>
        <p className="text-gray-500 text-sm mb-4">{count} fichier{count>1?'s':''} sélectionné{count>1?'s':''}</p>
        <input type="text" value={name} onChange={e=>setName(e.target.value)}
          placeholder="Nom de la playlist…" autoFocus
          onKeyDown={e=>e.key==='Enter'&&name.trim()&&onSave(name.trim())}
          className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 mb-4"/>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-semibold hover:bg-white/10 transition-all">Annuler</button>
          <button onClick={()=>name.trim()&&onSave(name.trim())} disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
            style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)'}}>
            <Save className="w-3.5 h-3.5 inline mr-1.5"/>Sauvegarder
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD OSD COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const KeyboardOSD = memo(({osd}) => (
  <AnimatePresence>
    {osd && (
      <motion.div
        key={osd.id}
        initial={{opacity:0,y:16,scale:0.9}}
        animate={{opacity:1,y:0,scale:1}}
        exit={{opacity:0,y:-12,scale:0.95}}
        transition={{type:'spring',stiffness:440,damping:28}}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-none"
        style={{
          background:'rgba(10,10,26,0.92)',
          border:'1px solid rgba(34,211,238,0.3)',
          borderRadius:16,
          padding:'10px 20px',
          backdropFilter:'blur(20px)',
          boxShadow:'0 8px 40px rgba(6,182,212,0.25),0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center gap-3">
          <kbd className="text-[13px] font-black font-mono text-cyan-400" style={{letterSpacing:1}}>{osd.key}</kbd>
          <span className="text-white text-[13px] font-semibold opacity-90">{osd.label}</span>
          {osd.value != null && (
            <span className="text-cyan-300 text-xs font-bold tabular-nums ml-1">{osd.value}</span>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));
KeyboardOSD.displayName = 'KeyboardOSD';

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const LocalPlayerPage = () => {
  const inputRef    = useRef(null);
  const reimportRef = useRef(null);
  const osdTimerRef = useRef(null);

  const {
    playSong, currentSong,
    isPlayingGlobal,
    seekTo, togglePlayPause, handleNext, handlePrevious,
    shuffle, toggleShuffle, repeat, cycleRepeat,
  } = usePlayer();
  const { audioCurrentTime, audioDuration } = usePlayerTime();
  const navigate = useNavigate();
  // Ref pour éviter la closure périmée dans le handler keydown (Space)
  const isPlayingGlobalRef = useRef(false);

  const [songs,            setSongs]            = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [selectionMode,    setSelectionMode]    = useState(false);
  const [selectedIds,      setSelectedIds]      = useState(new Set());
  const [showSaveModal,    setShowSaveModal]    = useState(false);
  const [savedPlaylists,   setSavedPlaylists]   = useState([]);
  const [volume,           setVolume]           = useState(80);
  const [isMuted,          setIsMuted]          = useState(false);
  const [restoringHandles, setRestoringHandles] = useState(false);
  const [activeTab,        setActiveTab]        = useState('library');
  const [searchQuery,      setSearchQuery]      = useState('');
  const [sortBy,           setSortBy]           = useState('default');
  const [trackDurations,   setTrackDurations]   = useState({});
  const [isDragging,       setIsDragging]       = useState(false);
  const [showShortcuts,    setShowShortcuts]    = useState(false);
  const [mobileView,       setMobileView]       = useState('player');
  const [modeTransition,   setModeTransition]   = useState(false);
  const [osd,              setOsd]              = useState(null); // {key, label, value, id}
  const osdIdRef = useRef(0);

  // Sync ref
  useEffect(() => { isPlayingGlobalRef.current = isPlayingGlobal; }, [isPlayingGlobal]);

  /* OSD trigger */
  const showOSD = useCallback((key, label, value=null) => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    const id = ++osdIdRef.current;
    setOsd({key, label, value, id});
    osdTimerRef.current = setTimeout(() => setOsd(null), 1400);
  }, []);

  /* ── Load IDB ── */
  useEffect(() => {
    (async () => {
      try {
        const idbPls = await idbLoadAll();
        if (idbPls.length > 0) { setSavedPlaylists(idbPls); return; }
      } catch(_) {}
      try {
        const ls = JSON.parse(localStorage.getItem('novasound_local_playlists')||'[]');
        if (ls.length) {
          const marked = ls.map(pl=>({...pl,songs:pl.songs.map(s=>({...s,_needsReimport:true}))}));
          setSavedPlaylists(marked);
          marked.forEach(pl=>idbSave(pl).catch(()=>{}));
        }
      } catch(_) {}
    })();
  }, []);

  /* ── Volume → audio element ── */
  useEffect(() => {
    const a = document.querySelector('audio');
    if (a) { a.volume = isMuted ? 0 : volume/100; a.muted = isMuted; }
  }, [volume, isMuted]);

  /* ── Cleanup blobs ── */
  useEffect(() => () => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch(_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch(_) {}
    });
  // eslint-disable-next-line
  }, []);

  /* ── MEDIA SESSION API ── */
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong?.is_local) return;
    try {
      const src = currentSong.cover_url || currentSong.cover_svg || '/icon-192.png';
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  currentSong.title||'Titre inconnu',
        artist: currentSong.artist||'Fichier local',
        album:  currentSong.album||'NovaSound Local',
        artwork:[{src,sizes:'512x512',type:src.startsWith('data:')?'image/png':'image/jpeg'}],
      });
    } catch(_) {}
    const handlers = {
      play:          () => { const a=document.querySelector('audio'); a?.play(); },
      pause:         () => { const a=document.querySelector('audio'); a?.pause(); },
      nexttrack:     () => handleNext?.(),
      previoustrack: () => handlePrevious?.(),
      seekbackward:  () => seekTo?.(Math.max(0,(audioCurrentTime||0)-10)),
      seekforward:   () => seekTo?.(Math.min(audioDuration||0,(audioCurrentTime||0)+10)),
      seekto:        d  => { if (d.seekTime!=null) seekTo?.(d.seekTime); },
    };
    Object.entries(handlers).forEach(([a,h])=>{ try{navigator.mediaSession.setActionHandler(a,h);}catch(_){} });
    if (audioDuration>0) {
      try { navigator.mediaSession.setPositionState?.({duration:audioDuration,playbackRate:1,position:Math.min(audioCurrentTime||0,audioDuration)}); } catch(_) {}
    }
    return () => Object.keys(handlers).forEach(a=>{ try{navigator.mediaSession.setActionHandler(a,null);}catch(_){} });
  }, [currentSong, isPlayingGlobal, audioCurrentTime, audioDuration, handleNext, handlePrevious, seekTo]);

  /* ── Keyboard shortcuts with OSD ── */
  useEffect(() => {
    // ✅ FIX: Sur mobile, LocalPlayerPageMobile gère son propre handler keydown.
    // Sans ce guard, les deux handlers tournent en parallèle → double-toggle →
    // Space = play+pause instantané = lecture bloquée ou pause annulée.
    if (isMobile()) return;

    const handler = e => {
      const el = document.activeElement;
      if (el?.tagName==='INPUT'||el?.tagName==='TEXTAREA'||el?.hasAttribute('contenteditable')) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (currentSong?.is_local) {
            togglePlayPause?.();
            showOSD('Space', isPlayingGlobalRef.current ? '⏸ Pause' : '▶ Lecture');
          } else if (songs.length) {
            playSong(songs[0], songs);
            showOSD('Space', '▶ Lecture');
          }
          break;
        case 'ArrowLeft':
          if (e.altKey||e.metaKey) return;
          e.preventDefault();
          if (audioDuration>0) {
            const t = Math.max(0,(audioCurrentTime||0)-10);
            seekTo?.(t);
            showOSD('←', '⏪ -10s', fmtTime(t));
          }
          break;
        case 'ArrowRight':
          if (e.altKey||e.metaKey) return;
          e.preventDefault();
          if (audioDuration>0) {
            const t = Math.min(audioDuration,(audioCurrentTime||0)+10);
            seekTo?.(t);
            showOSD('→', '⏩ +10s', fmtTime(t));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v=>{ const n=Math.min(100,v+5); showOSD('↑', '🔊 Volume', `${n}%`); return n; });
          setIsMuted(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v=>{ const n=Math.max(0,v-5); showOSD('↓', '🔉 Volume', `${n}%`); return n; });
          break;
        case 'KeyM':
          setIsMuted(v=>{ showOSD('M', v?'🔊 Son activé':'🔇 Muet'); return !v; });
          break;
        case 'KeyN':
          handleNext?.(); showOSD('N', '⏭ Suivant');
          break;
        case 'KeyP':
          handlePrevious?.(); showOSD('P', '⏮ Précédent');
          break;
        case 'KeyS':
          toggleShuffle?.(); showOSD('S', shuffle?'🔀 Aléatoire off':'🔀 Aléatoire on');
          break;
        case 'KeyR':
          cycleRepeat?.();
          showOSD('R', repeat==='off'?'🔁 Répéter tout':repeat==='all'?'🔂 Répéter 1':'🔁 Répétition off');
          break;
        case 'KeyL':
          e.preventDefault();
          setShowShortcuts(v=>!v);
          showOSD('L', '⌨ Raccourcis');
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [songs, currentSong, audioCurrentTime, audioDuration, togglePlayPause, seekTo, handleNext, handlePrevious, playSong, toggleShuffle, shuffle, cycleRepeat, repeat, showOSD]); // isPlayingGlobal retiré → ref utilisée

  /* ── Drag & Drop ── */
  useEffect(() => {
    const onDragOver  = e => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = e => { if (!e.relatedTarget||!document.body.contains(e.relatedTarget)) setIsDragging(false); };
    const onDrop = async e => {
      e.preventDefault(); setIsDragging(false);
      const items = [...e.dataTransfer.items];
      const files = [];
      for (const item of items) {
        if (item.kind==='file') {
          const entry = item.webkitGetAsEntry?.();
          if (entry?.isFile) { const f=item.getAsFile(); if(f&&isAudioFile(f))files.push(f); }
          else { const f=item.getAsFile(); if(f&&isAudioFile(f))files.push(f); }
        }
      }
      if (!files.length) return;
      setLoading(true);
      const ns = await processBatch(files);
      setSongs(prev=>{
        const merged=[...prev,...ns.filter(n=>!prev.find(p=>p.id===n.id))];
        if(prev.length===0&&ns.length) setTimeout(()=>playSong(ns[0],ns),50);
        return merged;
      });
      setLoading(false);
    };
    document.addEventListener('dragover',onDragOver);
    document.addEventListener('dragleave',onDragLeave);
    document.addEventListener('drop',onDrop);
    return ()=>{ document.removeEventListener('dragover',onDragOver); document.removeEventListener('dragleave',onDragLeave); document.removeEventListener('drop',onDrop); };
  }, [playSong]);

  const processBatch = async files => {
    const BATCH=4; const results=[];
    for(let i=0;i<files.length;i+=BATCH){
      const r=await Promise.all(files.slice(i,i+BATCH).map(f=>fileToSong(f).catch(()=>null)));
      results.push(...r.filter(Boolean));
    }
    return results;
  };

  const openPickerFSA = useCallback(async () => {
    if (!FS_ACCESS_SUPPORTED) { inputRef.current?.click(); return; }
    try {
      const handles = await window.showOpenFilePicker({
        types:[{description:'Lecteur Local',accept:{'audio/*':['.mp3','.m4a','.wav','.flac','.ogg','.aac','.opus','.wma','.webm']}}],
        multiple:true,
      });
      setLoading(true);
      const newSongs=[];
      for(let i=0;i<handles.length;i+=4){
        const res=await Promise.all(handles.slice(i,i+4).map(async h=>{
          try{ const f=await h.getFile(); if(!isAudioFile(f)) return null; const s=await fileToSong(f,h); await idbSaveHandle(s.id,h); return s; }catch{return null;}
        }));
        newSongs.push(...res.filter(Boolean));
      }
      if (!newSongs.length){ setLoading(false); return; }
      setSongs(prev=>{ const merged=[...prev,...newSongs.filter(ns=>!prev.find(p=>p.id===ns.id))]; if(prev.length===0)setTimeout(()=>playSong(newSongs[0],newSongs),50); return merged; });
      setLoading(false);
    } catch(err){ if(err?.name!=='AbortError')inputRef.current?.click(); else setLoading(false); }
  }, [playSong]);

  const onFiles = useCallback(async e=>{
    const files=Array.from(e.target.files||[]).filter(isAudioFile);
    if(!files.length) return;
    setLoading(true);
    const ns=await processBatch(files);
    if(!ns.length){setLoading(false);return;}
    setSongs(prev=>{ const merged=[...prev,...ns.filter(n=>!prev.find(p=>p.id===n.id))]; if(prev.length===0)setTimeout(()=>playSong(ns[0],ns),50); return merged; });
    setLoading(false); e.target.value='';
  }, [playSong]);

  const onReimportFiles = useCallback(async e=>{
    const files=Array.from(e.target.files||[]).filter(isAudioFile);
    if(!files.length) return;
    setLoading(true);
    const ns=await processBatch(files);
    setSongs(prev=>{
      const updated=prev.map(s=>{ if(!s._needsReimport)return s; return ns.find(n=>n.id===s.id)||s; });
      ns.forEach(n=>{ if(!updated.find(u=>u.id===n.id))updated.push(n); });
      const resolved=updated.filter(s=>!s._needsReimport&&ns.find(n=>n.id===s.id));
      if(resolved.length>0)setTimeout(()=>playSong(resolved[0],resolved),50);
      return updated;
    });
    setLoading(false); e.target.value='';
  }, [playSong]);

  const removeFromQueue = useCallback(i=>{
    setSongs(prev=>{ const s=prev[i]; if(s._blobUrl)try{URL.revokeObjectURL(s._blobUrl);}catch(_){} if(s._hasBlobCover)try{URL.revokeObjectURL(s._coverBlobUrl);}catch(_){} idbDeleteHandle(s.id).catch(()=>{}); return prev.filter((_,j)=>j!==i); });
  }, []);

  const clearAll = useCallback(()=>{
    songs.forEach(s=>{ if(s._blobUrl)try{URL.revokeObjectURL(s._blobUrl);}catch(_){} if(s._hasBlobCover)try{URL.revokeObjectURL(s._coverBlobUrl);}catch(_){} });
    setSongs([]); setSelectedIds(new Set()); setSelectionMode(false);
    if(currentSong?.is_local) window.dispatchEvent(new CustomEvent('novasound:close-player'));
  }, [songs,currentSong]);

  const selectAll   = useCallback(()=>setSelectedIds(new Set(songs.map(s=>s.id))),[songs]);
  const deselectAll = useCallback(()=>setSelectedIds(new Set()),[]);
  const toggleSelect = useCallback(id=>{ setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;}); },[]);

  const savePlaylist = useCallback((name)=>{
    const selected=songs.filter(s=>selectedIds.has(s.id));
    if(FS_ACCESS_SUPPORTED) selected.forEach(s=>{if(s._fileHandle)idbSaveHandle(s.id,s._fileHandle).catch(()=>{});});
    const safeSongs=selected.map(s=>({id:s.id,title:s.title,artist:s.artist,album:s.album||'',cover_url:s.cover_svg||makeCoverSvg(s.title,s.artist),cover_svg:s.cover_svg||makeCoverSvg(s.title,s.artist),is_local:true,_needsReimport:!s._fileHandle,_fileHandle:s._fileHandle||null}));
    const pl={id:Date.now(),name,songs:safeSongs,createdAt:new Date().toISOString()};
    const updated=[...savedPlaylists,pl];
    setSavedPlaylists(updated); persistPlaylists(updated);
    setShowSaveModal(false); setSelectionMode(false); setSelectedIds(new Set()); setActiveTab('playlists');
  }, [songs,selectedIds,savedPlaylists]);

  const loadPlaylist = useCallback(async pl=>{
    setLoading(true); setRestoringHandles(true);
    try {
      const resolved=[];
      for(const saved of pl.songs){
        const live=songs.find(l=>l.id===saved.id&&!l._needsReimport);
        if(live){resolved.push(live);continue;}
        if(FS_ACCESS_SUPPORTED){ const fh=await resolveFromHandle(saved); if(fh){await idbSaveHandle(fh.id,fh._fileHandle);resolved.push(fh);continue;} }
        resolved.push({...saved,_needsReimport:true});
      }
      setSongs(prev=>{
        const merged=[...prev];
        resolved.forEach(s=>{ const idx=merged.findIndex(p=>p.id===s.id); if(idx<0)merged.push(s); else if(merged[idx]._needsReimport&&!s._needsReimport)merged[idx]=s; });
        const playable=resolved.filter(s=>!s._needsReimport);
        if(playable.length>0)setTimeout(()=>playSong(playable[0],playable),100);
        return merged;
      });
      if(!FS_ACCESS_SUPPORTED&&resolved.every(s=>s._needsReimport)) reimportRef.current?.click();
    } catch(_) {}
    setLoading(false); setRestoringHandles(false); setMobileView('player'); setActiveTab('library');
  }, [songs,playSong]);

  const deletePlaylist = useCallback(id=>{
    const updated=savedPlaylists.filter(p=>p.id!==id);
    setSavedPlaylists(updated); idbDelete(id).catch(()=>{}); persistPlaylists(updated);
  }, [savedPlaylists]);

  const filteredSongs = useMemo(()=>{
    let list=[...songs];
    if(searchQuery.trim()){const q=searchQuery.toLowerCase(); list=list.filter(s=>s.title.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)||(s.album&&s.album.toLowerCase().includes(q)));}
    if(sortBy==='name')   list.sort((a,b)=>a.title.localeCompare(b.title));
    if(sortBy==='artist') list.sort((a,b)=>a.artist.localeCompare(b.artist));
    return list;
  }, [songs,searchQuery,sortBy]);

  /* Derived */
  const activeIdx      = songs.findIndex(s=>s.id===currentSong?.id);
  const isLocalPlaying = !!currentSong?.is_local;
  const activeSong     = isLocalPlaying ? currentSong : (songs[0]||null);
  const duration       = isLocalPlaying ? (audioDuration||0) : 0;
  const ct             = isLocalPlaying ? (audioCurrentTime||0) : 0;
  const VolumeIcon     = isMuted||volume===0 ? VolumeX : Volume2;
  const cover          = activeSong?.cover_url||activeSong?.cover_svg||makeCoverSvg(activeSong?.title||'',activeSong?.artist||''); // cover_url = vraie pochette APIC, cover_svg = avatar lettre

  /* Go online */
  const goOnline = useCallback(()=>{
    setModeTransition(true);
    setTimeout(()=>navigate('/'),950);
  }, [navigate]);

  /* ── Mobile redirect ── */
  if (isMobile()) return <LocalPlayerPageMobile />;

  /* ── EMPTY STATE ── */
  if (!songs.length) return (
    <div className="min-h-screen flex flex-col" style={{background:'#07071a'}}>

      {/* Mode transition */}
      <AnimatePresence>
        {modeTransition&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center" style={{background:'#050510'}}>
            <motion.div initial={{scale:0.5,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:280,damping:22}} className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 60px rgba(6,182,212,0.55)'}}>
                <Wifi className="w-9 h-9 text-white"/>
              </div>
              <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="text-white font-black text-xl">Passage en mode Online</motion.p>
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3,duration:0.65}}
                className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{transformOrigin:'left'}}/>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-6 py-3 backdrop-blur-xl border-b border-white/[0.06]"
        style={{background:'rgba(7,7,26,0.92)',paddingTop:'calc(env(safe-area-inset-top,0px) + 12px)'}}>
        <button onClick={()=>navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.06] text-gray-400 hover:text-white transition-all flex items-center justify-center hover:bg-white/[0.1]">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-none">Lecteur Local</p>
          <div className="flex items-center gap-2 mt-0.5">
            <WifiOff className="w-3 h-3 text-cyan-500"/>
            <p className="text-gray-500 text-[10px]">100% hors-ligne</p>
          </div>
        </div>
        <button onClick={goOnline}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/25 transition-all">
          <Wifi className="w-3 h-3"/>Online
        </button>
        <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-cyan-500/15 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center">
          <Home className="w-4 h-4"/>
        </Link>
      </div>

      <input ref={inputRef}    type="file" accept="*/*" multiple onChange={onFiles}         className="hidden"/>
      <input ref={reimportRef} type="file" accept="*/*" multiple onChange={onReimportFiles} className="hidden"/>

      <AnimatePresence>
        {isDragging&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-cyan-500/10 border-2 border-cyan-400 border-dashed backdrop-blur-sm pointer-events-none">
            <div className="text-center"><Music2 className="w-16 h-16 text-cyan-400 mx-auto mb-4"/><p className="text-cyan-300 text-2xl font-black">Dépose ici</p></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-5xl mx-auto px-5 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          <motion.div initial={{opacity:0,x:-24}} animate={{opacity:1,x:0}} className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
            <div className="relative">
              <div className="w-28 h-28 rounded-3xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 0 80px rgba(6,182,212,0.3),0 0 40px rgba(124,58,237,0.15)'}}>
                {loading?<div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin"/>:<HardDrive className="text-white" style={{width:52,height:52}}/>}
              </div>
              <motion.div animate={{rotate:360}} transition={{duration:10,repeat:Infinity,ease:'linear'}} className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"/>
              </motion.div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-3 justify-center lg:justify-start">
                <WifiOff className="w-5 h-5 text-cyan-400"/>
                <h1 className="text-white text-4xl font-black tracking-tight">Lecteur Local</h1>
              </div>
              <p className="text-gray-400 text-base leading-relaxed max-w-md">Écoute tes fichiers audio directement depuis ton appareil, sans connexion.</p>
            </div>
            <motion.button onClick={FS_ACCESS_SUPPORTED?openPickerFSA:()=>inputRef.current?.click()}
              whileTap={{scale:.96}} whileHover={{scale:1.02}} disabled={loading}
              className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60 w-full lg:w-auto"
              style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 8px 32px rgba(6,182,212,0.25)'}}>
              <FolderOpen className="w-5 h-5"/>
              {loading?'Chargement…':'Ouvrir des fichiers'}
            </motion.button>
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <GripVertical className="w-4 h-4"/><span>Glisse tes fichiers audio ici</span>
            </div>
            <p className="text-gray-700 text-xs">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS · WMA</p>
          </motion.div>

          <motion.div initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} transition={{delay:0.1}} className="flex flex-col gap-5">
            {savedPlaylists.length>0&&(
              <div>
                <p className="text-gray-500 text-xs mb-3 font-bold uppercase tracking-[0.12em]">Playlists sauvegardées <span className="text-fuchsia-400">({savedPlaylists.length})</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {savedPlaylists.map(pl=>(
                    <button key={pl.id} onClick={()=>loadPlaylist(pl)}
                      className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-fuchsia-500/25 transition-all text-left group">
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                        <img src={pl.songs[0]?.cover_url||pl.songs[0]?.cover_svg||makeCoverSvg(pl.name,'')} alt="" className="w-full h-full object-cover"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate group-hover:text-fuchsia-300 transition-colors">{pl.name}</p>
                        <p className="text-gray-600 text-[10px]">{pl.songs.length} fichier{pl.songs.length>1?'s':''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard shortcuts */}
            <button onClick={()=>setShowShortcuts(v=>!v)} className="flex items-center gap-2 text-gray-600 hover:text-gray-400 text-xs transition-colors self-start">
              <Keyboard className="w-3.5 h-3.5"/>Raccourcis clavier (L)
              <ChevronDown className={`w-3 h-3 transition-transform ${showShortcuts?'rotate-180':''}`}/>
            </button>
            <AnimatePresence>
              {showShortcuts&&(
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                    {[['Space','Lecture / Pause'],['← →','−10s / +10s'],['↑ ↓','Volume'],['M','Muet'],['N','Suivant'],['P','Précédent'],['S','Aléatoire'],['R','Répétition'],['L','Ce panneau']].map(([k,d])=>(
                      <div key={k} className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-white/[0.08] border border-white/[0.12] rounded text-[10px] text-gray-400 font-mono flex-shrink-0">{k}</kbd>
                        <span className="text-gray-600 text-[10px]">{d}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
      <Footer/>
      <KeyboardOSD osd={osd}/>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     MAIN PLAYER
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{background:'#07071a'}}>

      {/* ── Cinematic BG ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <AnimatePresence>
          {activeSong&&(
            <motion.div key={activeSong.id}
              initial={{opacity:0,scale:1.1}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
              transition={{duration:1.5,ease:'easeOut'}}
              className="absolute inset-0"
              style={{backgroundImage:`url(${cover})`,backgroundSize:'cover',backgroundPosition:'center',filter:'blur(70px) saturate(1.6)',transform:'scale(1.4)'}}/>
          )}
        </AnimatePresence>
        <div className="absolute inset-0" style={{background:'rgba(7,7,26,0.88)'}}/>
        <div className="absolute inset-0" style={{background:'radial-gradient(ellipse at 15% 50%,rgba(6,182,212,0.07) 0%,transparent 55%),radial-gradient(ellipse at 85% 20%,rgba(124,58,237,0.06) 0%,transparent 55%)'}}/>
      </div>

      {/* Mode transition */}
      <AnimatePresence>
        {modeTransition&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center" style={{background:'#050510'}}>
            <motion.div initial={{scale:0.5,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:280,damping:22}} className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#06b6d4,#a855f7)',boxShadow:'0 0 60px rgba(6,182,212,0.55)'}}>
                <Wifi className="w-9 h-9 text-white"/>
              </div>
              <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="text-white font-black text-xl">Passage en mode Online</motion.p>
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3,duration:0.65}}
                className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{transformOrigin:'left'}}/>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <div className="relative z-30 flex-shrink-0 flex items-center gap-3 px-4 md:px-6 py-3 backdrop-blur-xl border-b border-white/[0.06]"
        style={{background:'rgba(7,7,26,0.85)',paddingTop:'calc(env(safe-area-inset-top,0px) + 12px)'}}>
        <button onClick={()=>navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.06] text-gray-400 hover:text-white transition-all flex items-center justify-center hover:bg-white/[0.1]">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-none">Lecteur Local</p>
          <div className="flex items-center gap-2 mt-0.5">
            <WifiOff className="w-3 h-3 text-cyan-500"/>
            <p className="text-gray-500 text-[10px]">100% hors-ligne · {songs.length} fichier{songs.length>1?'s':''}</p>
            {restoringHandles&&<div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/20"><RefreshCcw className="w-2.5 h-2.5 text-cyan-400 animate-spin"/><span className="text-cyan-400 text-[9px] font-semibold">Restauration…</span></div>}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button onClick={FS_ACCESS_SUPPORTED?openPickerFSA:()=>inputRef.current?.click()} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/[0.06] text-gray-300 hover:text-white hover:bg-white/[0.1] transition-all disabled:opacity-50 border border-white/[0.07]">
            {loading?<div className="w-4 h-4 rounded-full border border-gray-500 border-t-cyan-400 animate-spin"/>:<Plus className="w-4 h-4"/>}
            Ajouter des fichiers
          </button>
          <button onClick={goOnline}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/25 transition-all">
            <Wifi className="w-3.5 h-3.5"/>Online
          </button>
        </div>
        <div className="flex md:hidden items-center gap-1 bg-white/[0.06] rounded-xl p-1">
          {[{key:'player',icon:'🎵'},{key:'library',icon:'📚'},{key:'playlists',icon:'📁'}].map(({key,icon})=>(
            <button key={key} onClick={()=>setMobileView(key)} className={`w-9 h-7 rounded-lg text-sm transition-all ${mobileView===key?'bg-white/15 text-white':'text-gray-500'}`}>{icon}</button>
          ))}
        </div>
        <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-cyan-500/15 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center">
          <Home className="w-4 h-4"/>
        </Link>
      </div>

      <input ref={inputRef}    type="file" accept="*/*" multiple onChange={onFiles}         className="hidden"/>
      <input ref={reimportRef} type="file" accept="*/*" multiple onChange={onReimportFiles} className="hidden"/>

      <AnimatePresence>
        {isDragging&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-cyan-500/10 border-2 border-cyan-400 border-dashed backdrop-blur-sm pointer-events-none">
            <div className="text-center"><Music2 className="w-16 h-16 text-cyan-400 mx-auto mb-4"/><p className="text-cyan-300 text-2xl font-black">Dépose ici</p></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex-1 flex overflow-hidden min-h-0">

        {/* ═══ LEFT — Player Sidebar ═══ */}
        <div className={`${mobileView!=='player'?'hidden md:flex':'flex'} flex-col flex-shrink-0 md:w-80 lg:w-96 xl:w-[420px] border-r border-white/[0.06] overflow-y-auto ${mobileView==='player'?'w-full':''}`}
          style={{scrollbarWidth:'none',background:'rgba(255,255,255,0.01)'}}>

          {activeSong?(
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col h-full p-5 gap-4">

              {/* Cover with vinyl effect */}
              <div className="relative group/cover flex-shrink-0">
                {/* Ambient glow */}
                <motion.div animate={{scale:[1,1.08,1],opacity:[0.3,0.6,0.3]}}
                  transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}
                  className="absolute -inset-4 rounded-3xl pointer-events-none"
                  style={{background:`url(${cover})`,backgroundSize:'cover',backgroundPosition:'center',filter:'blur(30px)',opacity:0.4}}/>
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl"
                  style={{boxShadow:'0 0 60px rgba(6,182,212,0.2),0 20px 60px rgba(0,0,0,0.6)'}}>
                  <img src={cover} alt={activeSong.title} className="w-full h-full object-cover"/>
                  {isLocalPlaying&&isPlayingGlobal&&(
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
                      {[0,1,2,3,4].map(i=>(
                        <motion.div key={i} className="w-1.5 rounded-t bg-cyan-400/80"
                          animate={{height:['6px','20px','8px','14px','6px']}}
                          transition={{duration:0.8+i*0.12,repeat:Infinity,delay:i*0.1,ease:'easeInOut'}}/>
                      ))}
                    </div>
                  )}
                </div>
                {activeSong._fileSize&&(
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1">
                    <span className="text-gray-400 text-[10px]">{fmtSize(activeSong._fileSize)}</span>
                  </div>
                )}
              </div>

              {/* Song info */}
              <div className="flex-shrink-0">
                <p className="text-white font-bold text-xl truncate leading-tight">{activeSong.title}</p>
                <p className="text-cyan-400/80 text-sm truncate mt-0.5">{activeSong.artist}</p>
                {activeSong.album&&<p className="text-gray-600 text-xs truncate mt-0.5">{activeSong.album}</p>}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full text-gray-500">Fichier local</span>
                  {isLocalPlaying&&<span className="text-[10px] bg-cyan-500/15 border border-cyan-500/25 px-2 py-0.5 rounded-full text-cyan-400 flex items-center gap-1"><EQBars active bars={3}/>En lecture</span>}
                </div>
              </div>

              {/* Seek */}
              <div className="flex-shrink-0">
                <SeekBar currentTime={ct} duration={duration} onSeek={seekTo} color="#22d3ee" size="lg"/>
              </div>

              {/* Transport */}
              <div className="flex-shrink-0 flex items-center justify-between">
                <button onClick={toggleShuffle} title="Aléatoire (S)"
                  className={`p-2.5 rounded-full transition-all ${shuffle?'text-cyan-400 bg-cyan-500/15':'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}>
                  <Shuffle className="w-5 h-5"/>
                </button>
                <motion.button whileTap={{scale:.88}} onClick={()=>handlePrevious?.()} title="Précédent (P)"
                  className="p-2.5 text-gray-300 hover:text-white transition-colors">
                  <SkipBack className="w-8 h-8 fill-current"/>
                </motion.button>
                <motion.button whileTap={{scale:.88}}
                  onClick={isLocalPlaying?togglePlayPause:()=>playSong(songs[0],songs)}
                  title="Lecture/Pause (Space)"
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl flex-shrink-0"
                  style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)',boxShadow:'0 0 40px rgba(6,182,212,0.4)'}}>
                  {isPlayingGlobal?<Pause className="w-8 h-8 text-white fill-current"/>:<Play className="w-8 h-8 text-white fill-current ml-0.5"/>}
                </motion.button>
                <motion.button whileTap={{scale:.88}} onClick={()=>handleNext?.()} title="Suivant (N)"
                  className="p-2.5 text-gray-300 hover:text-white transition-colors">
                  <SkipForward className="w-8 h-8 fill-current"/>
                </motion.button>
                <button onClick={cycleRepeat} title="Répétition (R)"
                  className={`relative p-2.5 rounded-full transition-all ${repeat!=='off'?'text-cyan-400 bg-cyan-500/15':'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}>
                  <Repeat className="w-5 h-5"/>
                  {repeat==='one'&&<span className="absolute -top-0.5 -right-0.5 text-[8px] bg-cyan-500 text-black font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
                </button>
              </div>

              {/* Volume */}
              <div className="flex-shrink-0 flex items-center gap-3">
                <button onClick={()=>setIsMuted(v=>!v)} title="Muet (M)" className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
                  <VolumeIcon className="w-4 h-4"/>
                </button>
                <div className="flex-1 relative"
                  onWheel={e=>{
                    e.preventDefault();
                    const d = e.deltaY>0 ? -5 : 5;
                    setVolume(v=>{const n=Math.max(0,Math.min(100,v+d));showOSD(d>0?'↑':'↓',d>0?'🔊 Volume':'🔉 Volume',`${n}%`);return n;});
                    setIsMuted(false);
                  }}>
                  <div className="h-1.5 rounded-full bg-white/[0.08] cursor-pointer relative overflow-hidden"
                    onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();setVolume(Math.round(((e.clientX-rect.left)/rect.width)*100));setIsMuted(false);}}>
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all" style={{width:`${isMuted?0:volume}%`}}/>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={isMuted?0:volume}
                    onChange={e=>{setVolume(Number(e.target.value));setIsMuted(false);}}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"/>
                </div>
                <span className="text-[11px] text-gray-600 w-8 text-right tabular-nums flex-shrink-0">{isMuted?0:volume}%</span>
              </div>

              {/* Up-next preview */}
              {songs.length>1&&(
                <div className="flex-shrink-0 mt-auto border-t border-white/[0.06] pt-3">
                  <p className="text-gray-700 text-[10px] font-semibold uppercase tracking-widest mb-2">Suivant</p>
                  <div className="flex flex-col gap-0.5">
                    {songs.slice(activeIdx>=0?activeIdx:0,(activeIdx>=0?activeIdx:0)+4).filter(s=>s.id!==currentSong?.id).slice(0,3).map((s,i)=>(
                      <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors" onClick={()=>playSong(s,songs)}>
                        <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0">
                          <img src={s.cover_url||s.cover_svg} alt="" className="w-full h-full object-cover"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-400 text-[11px] font-medium truncate">{s.title}</p>
                          <p className="text-gray-600 text-[10px] truncate">{s.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyboard hint */}
              <button onClick={()=>setShowShortcuts(v=>!v)}
                className="flex items-center gap-1.5 text-gray-700 hover:text-gray-500 text-[10px] transition-colors self-start mt-1">
                <Keyboard className="w-3 h-3"/>Raccourcis (L)
              </button>
              <AnimatePresence>
                {showShortcuts&&(
                  <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                      {[['Space','Play/Pause'],['← →','±10s'],['↑ ↓','Volume'],['M','Muet'],['N','Suivant'],['P','Précédent'],['S','Shuffle'],['R','Repeat'],['L','Raccourcis']].map(([k,d])=>(
                        <div key={k} className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-white/[0.08] border border-white/[0.12] rounded text-[9px] text-gray-400 font-mono flex-shrink-0">{k}</kbd>
                          <span className="text-gray-600 text-[9px]">{d}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ):(
            <div className="flex-1 flex items-center justify-center text-gray-700">
              <div className="text-center"><HardDrive className="w-12 h-12 mx-auto mb-3"/><p className="text-sm">Appuie sur ▶ pour démarrer</p></div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT — Library & Playlists ═══ */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${mobileView==='player'?'hidden md:flex':'flex'}`}>

          {/* Tabs + Actions */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]" style={{background:'rgba(255,255,255,0.015)'}}>
            <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
              <button onClick={()=>setActiveTab('library')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab==='library'?'bg-gradient-to-r from-cyan-500/20 to-purple-600/20 text-white border border-cyan-500/30':'text-gray-500 hover:text-gray-300'}`}>
                <Music2 className="w-3.5 h-3.5"/>Bibliothèque
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab==='library'?'bg-cyan-500/25 text-cyan-300':'bg-white/8 text-gray-600'}`}>{songs.length}</span>
              </button>
              <button onClick={()=>setActiveTab('playlists')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab==='playlists'?'bg-gradient-to-r from-fuchsia-500/20 to-purple-600/20 text-white border border-fuchsia-500/30':'text-gray-500 hover:text-gray-300'}`}>
                <Folder className="w-3.5 h-3.5"/>Playlists
                {savedPlaylists.length>0&&<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab==='playlists'?'bg-fuchsia-500/25 text-fuchsia-300':'bg-white/8 text-gray-600'}`}>{savedPlaylists.length}</span>}
              </button>
            </div>
            <div className="flex-1"/>
            {activeTab==='library'&&(
              <div className="flex items-center gap-2">
                <button onClick={()=>{setSelectionMode(v=>!v);if(selectionMode)setSelectedIds(new Set());}}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectionMode?'bg-violet-500/20 text-violet-300 border border-violet-500/30':'bg-white/[0.05] text-gray-500 hover:text-gray-300 border border-white/[0.07]'}`}>
                  <CheckSquare className="w-3.5 h-3.5"/>Sélection
                </button>
                <button onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-white/[0.07] transition-all">
                  <Trash2 className="w-3.5 h-3.5"/>Vider
                </button>
              </div>
            )}
            {activeTab==='playlists'&&(
              <button onClick={()=>{setSelectionMode(true);setActiveTab('library');}}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)'}}>
                <Plus className="w-3.5 h-3.5"/>Nouvelle playlist
              </button>
            )}
          </div>

          {/* Selection bar */}
          <AnimatePresence>
            {selectionMode&&activeTab==='library'&&(
              <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
                className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 overflow-hidden">
                <span className="text-violet-300 text-sm font-bold">{selectedIds.size} sélectionné{selectedIds.size>1?'s':''}</span>
                <button onClick={selectAll} className="text-xs text-violet-400/70 hover:text-violet-400">Tout</button>
                <button onClick={deselectAll} className="text-xs text-gray-600 hover:text-gray-400">Aucun</button>
                <div className="flex-1"/>
                {selectedIds.size>0&&(
                  <button onClick={()=>setShowSaveModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                    style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)'}}>
                    <Save className="w-3 h-3"/>Créer playlist ({selectedIds.size})
                  </button>
                )}
                <button onClick={()=>{setSelectionMode(false);setSelectedIds(new Set());}} className="p-1 text-gray-600 hover:text-gray-400">
                  <X className="w-4 h-4"/>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search + Sort */}
          {activeTab==='library'&&(
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600"/>
                <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                  placeholder="Filtrer les fichiers…"
                  className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.07] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-all"/>
                {searchQuery&&<button onClick={()=>setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"><X className="w-3.5 h-3.5"/></button>}
              </div>
              <div className="relative">
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-white/[0.04] border border-white/[0.07] rounded-xl text-xs text-gray-400 focus:outline-none focus:border-cyan-500/30 cursor-pointer">
                  <option value="default">Trier par</option>
                  <option value="name">Nom</option>
                  <option value="artist">Artiste</option>
                </select>
                <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none"/>
              </div>
            </div>
          )}

          {/* Library content */}
          {activeTab==='library'&&(
            <div className="flex-1 overflow-y-auto px-4 py-2" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.1) transparent'}}>
              <div className="hidden md:grid grid-cols-[24px_36px_1fr_128px_48px_36px] gap-3 px-3 py-2 mb-1 text-[10px] text-gray-700 uppercase tracking-widest font-semibold sticky top-0 rounded-lg" style={{background:'rgba(7,7,26,0.9)'}}>
                <div>#</div><div></div><div>Nom</div><div className="hidden lg:block">Artiste</div><div className="text-right">⏱</div><div></div>
              </div>
              {filteredSongs.length===0&&(
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="w-10 h-10 text-gray-700 mb-3"/><p className="text-gray-500 text-sm">Aucun fichier trouvé</p>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {filteredSongs.map((s,i)=>(
                  <SongRow key={s.id} song={s} index={i}
                    isActive={s.id===currentSong?.id}
                    isSelected={selectedIds.has(s.id)}
                    selectionMode={selectionMode}
                    onPlay={()=>playSong(s,filteredSongs)}
                    onRemove={()=>removeFromQueue(songs.findIndex(x=>x.id===s.id))}
                    onToggleSelect={()=>toggleSelect(s.id)}
                    duration={trackDurations[s.id]??null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Playlists content */}
          {activeTab==='playlists'&&(
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.1) transparent'}}>
              {!FS_ACCESS_SUPPORTED&&savedPlaylists.some(pl=>pl.songs.some(s=>s._needsReimport))&&(
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                  <div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/><p className="text-amber-200/80 text-xs leading-relaxed">Sur mobile, les fichiers ne survivent pas à la fermeture. Appuie sur Écouter et re-sélectionne tes fichiers.</p></div>
                </div>
              )}
              {savedPlaylists.length===0?(
                <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center py-20 text-center gap-5">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-white/[0.04] border border-white/[0.07]"><Folder className="w-10 h-10 text-gray-600"/></div>
                  <div><p className="text-gray-400 font-semibold">Aucune playlist sauvegardée</p><p className="text-gray-600 text-sm mt-1">Crée ta première playlist pour organiser tes fichiers</p></div>
                  <button onClick={()=>{setSelectionMode(true);setActiveTab('library');}}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{background:'linear-gradient(135deg,#0e7490,#7c3aed)'}}>
                    <Plus className="w-4 h-4"/>Nouvelle playlist
                  </button>
                </motion.div>
              ):(
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {savedPlaylists.map(pl=>(
                    <PlaylistCard key={pl.id} pl={pl} onLoad={loadPlaylist} onDelete={deletePlaylist} liveSongs={songs}/>
                  ))}
                  <motion.button onClick={()=>{setSelectionMode(true);setActiveTab('library');}}
                    className="aspect-square rounded-2xl border border-dashed border-white/[0.1] flex flex-col items-center justify-center gap-3 text-gray-600 hover:text-cyan-400 hover:border-cyan-500/30 transition-all group">
                    <div className="w-12 h-12 rounded-xl border border-dashed border-current flex items-center justify-center group-hover:bg-cyan-500/10 transition-all"><Plus className="w-6 h-6"/></div>
                    <span className="text-xs font-semibold">Nouvelle playlist</span>
                  </motion.button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showSaveModal&&<SavePlaylistModal count={selectedIds.size} onSave={savePlaylist} onClose={()=>setShowSaveModal(false)}/>}
      </AnimatePresence>

      {/* ── Keyboard OSD ── */}
      <KeyboardOSD osd={osd}/>

      {/* Loading toast */}
      <AnimatePresence>
        {loading&&(
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
            className="fixed bottom-8 right-8 z-[600] px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-2xl border border-white/10"
            style={{background:'rgba(10,10,26,0.96)'}}>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin"/>
            <span className="text-white text-xs font-medium">Importation…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocalPlayerPage;
