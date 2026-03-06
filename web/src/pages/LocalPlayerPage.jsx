/**
 * LocalPlayerPage — NovaSound TITAN LUX v27000
 *
 * FIXES v27000 :
 * ✅ FileSystemFileHandle persisté dans IDB (store séparé "file_handles")
 * ✅ Restauration automatique des handles au rechargement (PC/Chrome/Edge)
 * ✅ requestPermission() appelé proprement à la reprise
 * ✅ Playlists relues sans "À recharger" sur PC si handles disponibles
 * ✅ Toutes les corrections v20000 conservées
 */
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, HardDrive, WifiOff, ListMusic, Trash2, Plus,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX,
  ChevronDown, ArrowLeft, Home,
  Save, CheckSquare, Square, Folder, ChevronUp,
  RefreshCw, AlertTriangle, RefreshCcw,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import Footer from '@/components/Footer';

const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = (f) => AUDIO_EXTS.test(f.name) || f.type.startsWith('audio/') || f.type === 'video/mp4';
const FS_ACCESS_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const IDB_NAME    = 'novasound_local_v2';
const IDB_STORE   = 'playlists';
const IDB_HANDLES = 'file_handles';

const openIDB = () => new Promise((res, rej) => {
  const r = indexedDB.open(IDB_NAME, 2);
  r.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(IDB_STORE))   db.createObjectStore(IDB_STORE,   { keyPath: 'id' });
    if (!db.objectStoreNames.contains(IDB_HANDLES)) db.createObjectStore(IDB_HANDLES, { keyPath: 'songId' });
  };
  r.onsuccess = e => res(e.target.result);
  r.onerror   = () => rej(r.error);
});

const idbSave = async (pl) => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ ...pl, songs: pl.songs.map(s => ({ ...s, _fileHandle: undefined, _file: undefined, _blobUrl: undefined })) });
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (_) {}
};
const idbDelete = async (id) => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (_) {}
};
const idbLoadAll = async () => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const r  = tx.objectStore(IDB_STORE).getAll();
    return new Promise((res, rej) => { r.onsuccess = () => res(r.result || []); r.onerror = rej; });
  } catch (_) { return []; }
};

// ── Handle persistence ────────────────────────────────────────────────────────
const idbSaveHandle = async (songId, handle) => {
  if (!handle) return;
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_HANDLES, 'readwrite');
    tx.objectStore(IDB_HANDLES).put({ songId, handle });
    return new Promise((res) => { tx.oncomplete = res; tx.onerror = () => res(); });
  } catch (_) {}
};
const idbGetHandle = async (songId) => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_HANDLES, 'readonly');
    const r  = tx.objectStore(IDB_HANDLES).get(songId);
    return new Promise((res) => { r.onsuccess = () => res(r.result?.handle || null); r.onerror = () => res(null); });
  } catch (_) { return null; }
};
const idbDeleteHandle = async (songId) => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_HANDLES, 'readwrite');
    tx.objectStore(IDB_HANDLES).delete(songId);
  } catch (_) {}
};

// ── Restaurer un handle FSA → song ───────────────────────────────────────────
const resolveFromHandle = async (saved) => {
  if (!FS_ACCESS_SUPPORTED) return null;
  const handle = saved._fileHandle || (await idbGetHandle(saved.id));
  if (!handle) return null;
  try {
    let perm = await handle.queryPermission({ mode: 'read' });
    if (perm === 'prompt') perm = await handle.requestPermission({ mode: 'read' });
    if (perm !== 'granted') return null;
    const file = await handle.getFile();
    return fileToSong(file, handle);
  } catch (_) { return null; }
};

// ── SVG Cover déterministe ─────────────────────────────────────────────────────
const makeCoverSvg = (title = '', artist = '') => {
  const hue = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; };
  const c1 = `hsl(${hue(title)},60%,42%)`;
  const c2 = `hsl(${hue(artist || title.split('').reverse().join(''))},65%,55%)`;
  const letter = (title[0] || '♫').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="85" r="42" fill="rgba(0,0,0,0.2)"/><text x="100" y="102" font-family="system-ui,sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${letter}</text><text x="100" y="160" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.5)" text-anchor="middle">${title.slice(0,18)}</text></svg>`;
  try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); }
  catch (_) { return `data:image/svg+xml,${encodeURIComponent(svg)}`; }
};

const persistPlaylists = (playlists) => {
  playlists.forEach(pl => idbSave(pl).catch(() => {}));
  try {
    const safe = playlists.map(pl => ({
      id: pl.id, name: pl.name, createdAt: pl.createdAt,
      songs: pl.songs.map(s => ({
        id: s.id, title: s.title, artist: s.artist, album: s.album || '',
        cover_url: s.cover_svg || makeCoverSvg(s.title, s.artist),
        cover_svg: s.cover_svg || makeCoverSvg(s.title, s.artist),
        is_local: true, _needsReimport: true,
      })),
    }));
    const str = JSON.stringify(safe);
    if (str.length < 5 * 1024 * 1024) localStorage.setItem('novasound_local_playlists', str);
  } catch (_) {}
};

// ── Parse ID3v2 ───────────────────────────────────────────────────────────────
const parseID3 = async (file) => {
  const meta = { title: '', artist: '', album: '', cover: null };
  try {
    const bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return meta;
    const ss  = (b, o) => ((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f);
    let pos = 10; const end = ss(bytes, 6) + 10;
    const dec = new TextDecoder('utf-8', { fatal: false });
    while (pos < end - 10 && pos < bytes.length - 10) {
      const fid = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      const fsz = (bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
      if (fsz <= 0 || fsz > 300000) break;
      const data = bytes.slice(pos+10, pos+10+fsz);
      const txt  = data[0]===0 ? dec.decode(data.slice(1)) : new TextDecoder('utf-16le',{fatal:false}).decode(data.slice(3));
      if      (fid==='TIT2') meta.title  = txt.replace(/\0/g,'').trim();
      else if (fid==='TPE1') meta.artist = txt.replace(/\0/g,'').trim();
      else if (fid==='TALB') meta.album  = txt.replace(/\0/g,'').trim();
      else if (fid==='APIC' && !meta.cover) {
        let i=1; while(i<data.length&&data[i]!==0)i++; i++; i++;
        while(i<data.length&&data[i]!==0)i++; i++;
        try { meta.cover = URL.createObjectURL(new Blob([data.slice(i)],{type:'image/jpeg'})); } catch(_){}
      }
      pos += 10+fsz;
    }
  } catch (_) {}
  return meta;
};

const fileToSong = async (file, handle = null) => {
  const url    = URL.createObjectURL(file);
  const raw    = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  const tags   = await parseID3(file);
  const title  = tags.title  || raw;
  const artist = tags.artist || 'Fichier local';
  const svg    = makeCoverSvg(title, artist);
  return {
    id: 'local::' + file.name + '::' + file.size,
    title, artist, album: tags.album || '',
    audio_url: url, cover_url: tags.cover || svg, cover_svg: svg,
    is_local: true, _file: file, _blobUrl: url,
    _hasBlobCover: !!tags.cover, _coverBlobUrl: tags.cover || null,
    _fileHandle: handle || null,
  };
};

const fmtTime = (s) => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
};

// ── SeekBar ───────────────────────────────────────────────────────────────────
const SeekBar = ({ currentTime, duration, onSeek, color = '#22d3ee' }) => {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState(0);
  const getPct = (x) => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - left) / width));
  };
  const start = x => { setDragging(true); setDragPct(getPct(x)); };
  const move  = useCallback(x => { if (!dragging) return; setDragPct(getPct(x)); }, [dragging]);
  const end   = useCallback(x => {
    if (!dragging) return;
    const p = getPct(x); setDragging(false); setDragPct(p);
    if (onSeek && duration > 0) onSeek(p * duration);
  }, [dragging, onSeek, duration]);

  useEffect(() => {
    if (!dragging) return;
    const mm = e => move(e.clientX), mu = e => end(e.clientX);
    const tm = e => move(e.touches[0].clientX), tu = e => end(e.changedTouches[0].clientX);
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: true }); window.addEventListener('touchend', tu);
    return () => {
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu);
      window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', tu);
    };
  }, [dragging, move, end]);

  const pct = dragging ? dragPct : (duration > 0 ? currentTime / duration : 0);
  return (
    <div className="w-full select-none">
      <div ref={trackRef} className="relative w-full cursor-pointer" style={{ height: 20, display: 'flex', alignItems: 'center' }}
        onMouseDown={e => { e.preventDefault(); start(e.clientX); }}
        onTouchStart={e => { e.preventDefault(); start(e.touches[0].clientX); }}
        onClick={e => { if (!dragging && onSeek && duration > 0) onSeek(getPct(e.clientX) * duration); }}>
        <div className="absolute inset-0 my-auto rounded-full" style={{ height: 5, background: 'rgba(255,255,255,0.1)' }} />
        <div className="absolute left-0 my-auto rounded-full" style={{ height: 5, top: '50%', transform: 'translateY(-50%)', width: `${pct * 100}%`, background: `linear-gradient(90deg, ${color}, #a855f7)` }} />
        <div className="absolute" style={{
          left: `${pct * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
          width: dragging ? 20 : 14, height: dragging ? 20 : 14, borderRadius: '50%', background: 'white',
          boxShadow: `0 0 10px ${color}80, 0 2px 6px rgba(0,0,0,0.5)`,
          transition: dragging ? 'none' : 'all .12s', cursor: 'grab',
        }} />
      </div>
      <div className="flex justify-between text-xs tabular-nums mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <span>{fmtTime(pct * (duration || 0))}</span>
        <span>{duration > 0 ? fmtTime(duration) : '--:--'}</span>
      </div>
    </div>
  );
};

// ── SongRow ───────────────────────────────────────────────────────────────────
const SongRow = memo(({ song, isActive, isSelected, onPlay, onRemove, selectionMode, onToggleSelect }) => {
  const nr = !!song._needsReimport;
  const cover = song.cover_svg || song.cover_url;
  return (
    <div onClick={nr ? undefined : (selectionMode ? onToggleSelect : onPlay)}
      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all group cursor-pointer ${
        nr ? 'opacity-50 border border-amber-500/15 bg-amber-500/5' :
        isActive ? 'bg-white/10 border border-white/10' :
        isSelected ? 'bg-cyan-500/10 border border-cyan-500/20' :
        'hover:bg-white/[0.06] border border-transparent'
      }`}>
      {selectionMode
        ? <div className="w-5 h-5 flex-shrink-0">{isSelected ? <CheckSquare className="w-5 h-5 text-cyan-400" /> : <Square className="w-5 h-5 text-gray-600" />}</div>
        : <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative">
            <img src={cover} alt={song.title} className="w-full h-full object-cover" />
            {nr && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-amber-400 text-xs">⚠</span></div>}
          </div>
      }
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : nr ? 'text-gray-500' : 'text-gray-300'}`}>{song.title}</p>
        <p className="text-[11px] truncate">{nr ? <span className="text-amber-500/70">À recharger</span> : <span className="text-gray-500">{song.artist}</span>}</p>
      </div>
      {isActive && !selectionMode && !nr && (
        <div className="flex gap-px items-end h-3.5 flex-shrink-0">
          {[1,2,3].map(i => <div key={i} className="w-0.5 rounded-full bg-cyan-400" style={{ height:`${5+i*3}px`, animation:`novaWave ${0.4+i*.15}s ease-in-out infinite alternate`, animationDelay:`${i*.1}s` }} />)}
        </div>
      )}
      {!selectionMode && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-full text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

// ── SavePlaylistModal ──────────────────────────────────────────────────────────
const SavePlaylistModal = ({ count, onSave, onClose }) => {
  const [name, setName] = useState('');
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-5 bg-black/75 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.9, y:16 }} animate={{ scale:1, y:0 }}
        className="w-full max-w-sm bg-[#0c0c1a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-1">Nouvelle playlist</h3>
        <p className="text-gray-500 text-sm mb-4">{count} son{count>1?'s':''} sélectionné{count>1?'s':''}</p>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Nom de la playlist…" autoFocus
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full bg-white/[0.07] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-semibold hover:bg-white/10 transition-all">Annuler</button>
          <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
            style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
            <Save className="w-3.5 h-3.5 inline mr-1.5" />Sauvegarder
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── PlaylistCard ───────────────────────────────────────────────────────────────
const PlaylistCard = ({ pl, onLoad, onDelete, onReimport, liveSongs }) => {
  const needsReimport = pl.songs.some(s => {
    const live = liveSongs.find(l => l.id === s.id);
    return s._needsReimport && !(live && !live._needsReimport);
  });
  const covers = pl.songs.slice(0, 4).map(s => s.cover_svg || s.cover_url || makeCoverSvg(s.title, s.artist));
  return (
    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      className="bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-cyan-500/20 transition-all">
      <div className="relative h-28 overflow-hidden cursor-pointer" onClick={() => onLoad(pl)}>
        {covers.length === 0
          ? <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-900/40 to-purple-900/40"><ListMusic className="w-9 h-9 text-gray-600" /></div>
          : covers.length === 1
            ? <img src={covers[0]} alt="" className="w-full h-full object-cover" />
            : <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                {Array.from({length:4}).map((_,i) => covers[i]
                  ? <img key={i} src={covers[i]} alt="" className="w-full h-full object-cover" />
                  : <div key={i} className="w-full h-full bg-gray-900" />)}
              </div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
          <span className="text-white text-xs font-bold truncate drop-shadow">{pl.name}</span>
          <span className="text-gray-300/70 text-[10px] flex-shrink-0">{pl.songs.length} son{pl.songs.length>1?'s':''}</span>
        </div>
        {needsReimport && !FS_ACCESS_SUPPORTED && (
          <div className="absolute top-2 right-2 bg-amber-500/90 rounded-full p-1"><AlertTriangle className="w-3 h-3 text-black" /></div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button onClick={() => onLoad(pl)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
          <Play className="w-3.5 h-3.5" />Écouter
        </button>
        {needsReimport && !FS_ACCESS_SUPPORTED && (
          <button onClick={() => onReimport(pl)} title="Recharger les fichiers"
            className="flex items-center px-2.5 py-2 rounded-xl text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onDelete(pl.id)} className="p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
const LocalPlayerPage = () => {
  const inputRef    = useRef(null);
  const reimportRef = useRef(null);

  const {
    playSong, currentSong,
    audioCurrentTime, audioDuration, isPlayingGlobal,
    seekTo, togglePlayPause, handleNext, handlePrevious,
    shuffle, toggleShuffle, repeat, cycleRepeat,
  } = usePlayer();

  const navigate = useNavigate();
  const [activeSection,      setActiveSection]      = useState('player');
  const [songs,              setSongs]              = useState([]);
  const [loading,            setLoading]            = useState(false);
  const [added,              setAdded]              = useState(false);
  const [selectionMode,      setSelectionMode]      = useState(false);
  const [selectedIds,        setSelectedIds]        = useState(new Set());
  const [showSaveModal,      setShowSaveModal]      = useState(false);
  const [savedPlaylists,     setSavedPlaylists]     = useState([]);
  const [volume,             setVolume]             = useState(80);
  const [showVolume,         setShowVolume]         = useState(false);
  const [restoringHandles,   setRestoringHandles]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const idbPls = await idbLoadAll();
        if (idbPls.length > 0) { setSavedPlaylists(idbPls); return; }
      } catch (_) {}
      try {
        const ls = JSON.parse(localStorage.getItem('novasound_local_playlists') || '[]');
        if (ls.length) {
          const marked = ls.map(pl => ({ ...pl, songs: pl.songs.map(s => ({ ...s, _needsReimport: true })) }));
          setSavedPlaylists(marked);
          marked.forEach(pl => idbSave(pl).catch(() => {}));
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => () => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const a = document.querySelector('audio');
    if (a) a.volume = volume / 100;
  }, [volume]);

  const processBatch = async (files) => {
    const BATCH = 4; const results = [];
    for (let i = 0; i < files.length; i += BATCH) {
      const r = await Promise.all(files.slice(i, i + BATCH).map(f => fileToSong(f).catch(() => null)));
      results.push(...r.filter(Boolean));
    }
    return results;
  };

  const openPickerFSA = useCallback(async () => {
    if (!FS_ACCESS_SUPPORTED) { inputRef.current?.click(); return; }
    try {
      const handles = await window.showOpenFilePicker({
        types: [{ description: 'Fichiers Audio', accept: { 'audio/*': ['.mp3','.m4a','.wav','.flac','.ogg','.aac','.opus','.wma','.webm'] } }],
        multiple: true,
      });
      setLoading(true);
      const newSongs = [];
      for (let i = 0; i < handles.length; i += 4) {
        const res = await Promise.all(handles.slice(i, i+4).map(async h => {
          try {
            const f = await h.getFile();
            if (!isAudioFile(f)) return null;
            const song = await fileToSong(f, h);
            await idbSaveHandle(song.id, h);
            return song;
          } catch { return null; }
        }));
        newSongs.push(...res.filter(Boolean));
      }
      if (!newSongs.length) { setLoading(false); return; }
      setSongs(prev => {
        const merged = [...prev, ...newSongs.filter(ns => !prev.find(p => p.id === ns.id))];
        if (prev.length === 0) setTimeout(() => playSong(newSongs[0], newSongs), 50);
        return merged;
      });
      setLoading(false);
      setAdded(true); setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      if (err?.name !== 'AbortError') inputRef.current?.click();
    }
  }, [playSong]);

  const onFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(isAudioFile);
    if (!files.length) { aler''; return; }
    setLoading(true);
    const newSongs = await processBatch(files);
    if (!newSongs.length) { setLoading(false); return; }
    setSongs(prev => {
      const merged = [...prev, ...newSongs.filter(ns => !prev.find(p => p.id === ns.id))];
      if (prev.length === 0) setTimeout(() => playSong(newSongs[0], newSongs), 50);
      return merged;
    });
    setLoading(false); e.target.value = '';
    setAdded(true); setTimeout(() => setAdded(false), 2000);
  }, [playSong]);

  const onReimportFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(isAudioFile);
    if (!files.length) return;
    setLoading(true);
    const newSongs = await processBatch(files);
    setSongs(prev => {
      const updated = prev.map(s => {
        if (!s._needsReimport) return s;
        return newSongs.find(ns => ns.id === s.id) || s;
      });
      newSongs.forEach(ns => { if (!updated.find(u => u.id === ns.id)) updated.push(ns); });
      const resolved = updated.filter(s => !s._needsReimport && newSongs.find(ns => ns.id === s.id));
      if (resolved.length > 0) setTimeout(() => playSong(resolved[0], resolved), 50);
      return updated;
    });
    setLoading(false); e.target.value = '';
  }, [playSong]);

  const playFromQueue   = useCallback((i) => playSong(songs[i], songs), [songs, playSong]);
  const removeFromQueue = useCallback((i) => {
    setSongs(prev => {
      const s = prev[i];
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
      idbDeleteHandle(s.id).catch(() => {});
      return prev.filter((_, j) => j !== i);
    });
  }, []);

  const clearAll = useCallback(() => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
    setSongs([]); setSelectedIds(new Set()); setSelectionMode(false);
    if (currentSong?.is_local) window.dispatchEvent(new CustomEven'novasound:close-player');
  }, [songs, currentSong]);

  const selectAll    = useCallback(() => setSelectedIds(new Set(songs.map(s => s.id))), [songs]);
  const deselectAll  = useCallback(() => setSelectedIds(new Set()), []);
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const savePlaylist = useCallback((name) => {
    const selected = songs.filter(s => selectedIds.has(s.id));
    if (FS_ACCESS_SUPPORTED) {
      selected.forEach(s => { if (s._fileHandle) idbSaveHandle(s.id, s._fileHandle).catch(() => {}); });
    }
    const safeSongs = selected.map(s => ({
      id: s.id, title: s.title, artist: s.artist, album: s.album || '',
      cover_url: s.cover_svg || makeCoverSvg(s.title, s.artist),
      cover_svg: s.cover_svg || makeCoverSvg(s.title, s.artist),
      is_local: true, _needsReimport: !s._fileHandle, _fileHandle: s._fileHandle || null,
    }));
    const pl = { id: Date.now(), name, songs: safeSongs, createdAt: new Date().toISOString() };
    const updated = [...savedPlaylists, pl];
    setSavedPlaylists(updated);
    persistPlaylists(updated);
    setShowSaveModal(false); setSelectionMode(false); setSelectedIds(new Set());
    setActiveSection('playlists');
  }, [songs, selectedIds, savedPlaylists]);

  // ── Chargement playlist avec restauration auto FSA ────────────────────────────
  // IMPORTANT: séquentiel (pas Promise.all) — Chrome n'autorise qu'un
  // requestPermission par geste utilisateur. En parallèle, les handles 2…N
  // sont refusés silencieusement et les fichiers restent "_needsReimport".
  const loadPlaylist = useCallback(async (pl) => {
    setLoading(true);
    setRestoringHandles(true);
    try {
      const resolved = [];
      for (const saved of pl.songs) {
        const live = songs.find(l => l.id === saved.id && !l._needsReimport);
        if (live) { resolved.push(live); continue; }
        if (FS_ACCESS_SUPPORTED) {
          const fromHandle = await resolveFromHandle(saved);
          if (fromHandle) {
            await idbSaveHandle(fromHandle.id, fromHandle._fileHandle);
            resolved.push(fromHandle);
            continue;
          }
        }
        resolved.push({ ...saved, _needsReimport: true });
      }

      setSongs(prev => {
        const merged = [...prev];
        resolved.forEach(s => {
          const idx = merged.findIndex(p => p.id === s.id);
          if (idx < 0) merged.push(s);
          else if (merged[idx]._needsReimport && !s._needsReimport) merged[idx] = s;
        });
        const playable = resolved.filter(s => !s._needsReimport);
        if (playable.length > 0) setTimeout(() => playSong(playable[0], playable), 100);
        return merged;
      });

      if (!FS_ACCESS_SUPPORTED && resolved.every(s => s._needsReimport)) {
        reimportRef.current?.click();
      }
    } catch (_) {}
    setLoading(false);
    setRestoringHandles(false);
    setActiveSection('player');
  }, [songs, playSong]);

  const deletePlaylist = useCallback((id) => {
    const updated = savedPlaylists.filter(p => p.id !== id);
    setSavedPlaylists(updated);
    idbDelete(id).catch(() => {});
    persistPlaylists(updated);
  }, [savedPlaylists]);

  const activeIdx      = songs.findIndex(s => s.id === currentSong?.id);
  const isLocalPlaying = !!currentSong?.is_local;
  const activeSong     = isLocalPlaying ? currentSong : (songs[0] || null);
  const duration       = isLocalPlaying ? (audioDuration    || 0) : 0;
  const ct             = isLocalPlaying ? (audioCurrentTime || 0) : 0;
  const VolumeIcon     = volume === 0 ? VolumeX : Volume2;

  if (!songs.length) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#050510]/95 backdrop-blur-md border-b border-white/[0.06]"
          style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.07] text-gray-400 hover:text-white transition-all flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-none">{'Lecteur Local'}</p>
            <p className="text-gray-600 text-[10px] mt-0.5">{'100% hors-ligne'}</p>
          </div>
          <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center">
            <Home className="w-4 h-4" />
          </Link>
        </div>
        <input ref={inputRef}    type="file" accept="*/*" multiple onChange={onFiles}         className="hidden" />
        <input ref={reimportRef} type="file" accept="*/*" multiple onChange={onReimportFiles} className="hidden" />
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
          {/* Background glow effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
            <div className="absolute top-1/3 left-1/3 w-60 h-60 rounded-full bg-fuchsia-500/5 blur-3xl" />
          </div>
          <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
            className="w-full max-w-md flex flex-col items-center gap-7 text-center relative z-10">
            
            {/* Icon hero */}
            <div className="relative">
              <div className="w-28 h-28 rounded-3xl flex items-center justify-center relative"
                style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)', boxShadow:'0 0 80px rgba(6,182,212,0.35), 0 0 40px rgba(124,58,237,0.2)' }}>
                {loading
                  ? <div className="w-10 h-10 rounded-full border-3 border-white/30 border-t-white animate-spin" />
                  : <HardDrive className="w-13 h-13 text-white drop-shadow-lg" style={{ width: 52, height: 52 }} />
                }
              </div>
              {/* Orbiting dot */}
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
              </motion.div>
            </div>

            {/* Title */}
            <div>
              <div className="flex items-center justify-center gap-2.5 mb-3">
                <WifiOff className="w-4 h-4 text-cyan-400" />
                <h1 className="text-white text-3xl font-black tracking-tight">{'Lecteur Local'}</h1>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{'Écoute tes fichiers audio directement depuis ton appareil, sans connexion.'}</p>
            </div>

            {/* CTA button */}
            <motion.button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : () => inputRef.current?.click()}
              whileTap={{ scale:.96 }} whileHover={{ scale: 1.02 }} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60 transition-shadow"
              style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)', boxShadow:'0 8px 32px rgba(6,182,212,0.3)' }}>
              <FolderOpen className="w-5 h-5" />
              {loading ? 'Chargement…' : 'Ouvrir (fichiers persistants)'}
            </motion.button>

            {/* Saved playlists */}
            {savedPlaylists.length > 0 && (
              <div className="w-full">
                <p className="text-gray-500 text-xs mb-3 text-left font-bold uppercase tracking-[0.12em]">
                  {'Playlists sauvegardées'} <span className="text-fuchsia-400">({savedPlaylists.length})</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {savedPlaylists.map(pl => (
                    <button key={pl.id} onClick={() => loadPlaylist(pl)}
                      className="flex items-center gap-2.5 px-3 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] hover:border-fuchsia-500/30 transition-all text-left group">
                      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={pl.songs[0]?.cover_svg || pl.songs[0]?.cover_url || makeCoverSvg(pl.name, '')} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate group-hover:text-fuchsia-300 transition-colors">{pl.name}</p>
                        <p className="text-gray-600 text-[10px]">{pl.songs.length} {'Fichiers'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tip card */}
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-4 w-full text-left">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">💡</span>
                <div>
                  <p className="text-amber-300 text-xs font-bold mb-1">{'Astuce'}</p>
                  <p className="text-amber-200/60 text-xs leading-relaxed">
                    {FS_ACCESS_SUPPORTED ? 'Sur PC, les fichiers sont mémorisés. Tes playlists se rechargent automatiquement.' : "Sélectionne depuis n'importe quel dossier (WhatsApp, Xender, SD card…)."}
                  </p>
                </div>
              </div>
            </div>

            {/* Formats */}
            <p className="text-gray-700 text-[11px] tracking-wide">{'Formats supportés : MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS · WMA'}</p>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] flex flex-col">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#050510]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.07] text-gray-400 hover:text-white transition-all flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-none">{'Lecteur Local'}</p>
          <p className="text-gray-600 text-[10px] mt-0.5">{'100% hors-ligne'} · {songs.length} {'Fichiers'}</p>
        </div>
        {restoringHandles && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/25">
            <RefreshCcw className="w-3 h-3 text-cyan-400 animate-spin" />
            <span className="text-cyan-400 text-[10px] font-semibold">Restauration…</span>
          </div>
        )}
        <button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : () => inputRef.current?.click()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.07] text-gray-300 hover:text-white transition-all disabled:opacity-50">
          {loading ? <div className="w-3.5 h-3.5 rounded-full border border-gray-500 border-t-cyan-400 animate-spin" /> : <><Plus className="w-3.5 h-3.5" />Ajouter</>}
        </button>
        <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center">
          <Home className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.05]">
        {[
          { key:'player',    label:'Lecteur',   icon:'🎵' },
          { key:'playlists', label:'Playlists', icon:'📂', count: savedPlaylists.length },
          { key:'files',     label:'Fichiers',  icon:'🎶', count: songs.length },
        ].map(({ key, label, icon, count }) => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex-1 justify-center ${
              activeSection === key
                ? 'bg-gradient-to-r from-cyan-500/25 to-purple-600/25 text-white border-cyan-500/40'
                : 'bg-white/[0.04] text-gray-500 border-white/[0.07] hover:text-gray-300'
            }`}>
            <span>{icon}</span><span>{label}</span>
            {count !== undefined && count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeSection===key?'bg-cyan-500/30 text-cyan-300':'bg-white/10 text-gray-600'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <input ref={inputRef}    type="file" accept="*/*" multiple onChange={onFiles}         className="hidden" />
      <input ref={reimportRef} type="file" accept="*/*" multiple onChange={onReimportFiles} className="hidden" />

      {/* ── Layout PC : sidebar gauche (player fixe) + panneau droit (fichiers/playlists) ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{ minHeight: 0 }}>

        {/* ══ SIDEBAR GAUCHE (PC) : Player toujours visible ══ */}
        {activeSong && (
          <div className="hidden md:flex md:flex-col md:w-72 lg:w-80 xl:w-96 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto"
            style={{ scrollbarWidth:'none', background:'linear-gradient(180deg,rgba(6,182,212,0.04),rgba(124,58,237,0.03))' }}>
            <motion.div initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }}
              className="p-5 flex flex-col gap-4">
              {/* Pochette grande */}
              <div className="w-full aspect-square rounded-2xl overflow-hidden flex-shrink-0"
                style={{ boxShadow:'0 0 40px rgba(6,182,212,0.3)' }}>
                <img src={activeSong.cover_svg || activeSong.cover_url} alt={activeSong.title} className="w-full h-full object-cover" />
              </div>
              {/* Info */}
              <div>
                <p className="text-white font-bold text-lg truncate leading-tight">{activeSong.title}</p>
                <p className="text-cyan-400/80 text-sm truncate mt-0.5">{activeSong.artist}</p>
                {activeSong.album && <p className="text-gray-600 text-xs truncate mt-0.5">{activeSong.album}</p>}
              </div>
              {/* SeekBar */}
              <SeekBar currentTime={ct} duration={duration} onSeek={seekTo} color="#22d3ee" />
              {/* Transport */}
              <div className="flex items-center justify-between">
                <button onClick={toggleShuffle} className={`p-2 rounded-full transition-all ${shuffle?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
                  <Shuffle className="w-5 h-5" />
                </button>
                <motion.button whileTap={{ scale:.88 }} onClick={() => handlePrevious?.()}
                  className="p-2 text-gray-300 hover:text-white transition-colors">
                  <SkipBack className="w-8 h-8 fill-current" />
                </motion.button>
                <motion.button whileTap={{ scale:.9 }}
                  onClick={isLocalPlaying ? togglePlayPause : () => playSong(songs[0], songs)}
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                  style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)', boxShadow:'0 0 40px rgba(6,182,212,0.4)' }}>
                  {isPlayingGlobal ? <Pause className="w-8 h-8 text-white fill-current" /> : <Play className="w-8 h-8 text-white fill-current ml-0.5" />}
                </motion.button>
                <motion.button whileTap={{ scale:.88 }} onClick={() => handleNext?.()}
                  className="p-2 text-gray-300 hover:text-white transition-colors">
                  <SkipForward className="w-8 h-8 fill-current" />
                </motion.button>
                <button onClick={cycleRepeat} className={`p-2 rounded-full transition-all relative ${repeat!=='off'?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
                  <Repeat className="w-5 h-5" />
                  {repeat==='one' && <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-cyan-500 text-black font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
                </button>
              </div>
              {/* Volume */}
              <div className="flex items-center gap-3">
                <VolumeIcon className="w-4 h-4 text-gray-500" />
                <input type="range" min={0} max={100} step={1} value={volume} onChange={e => setVolume(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor:'#22d3ee' }} />
                <span className="text-xs text-gray-600 w-8 text-right tabular-nums">{volume}%</span>
              </div>
            </motion.div>
          </div>
        )}

        {/* ══ PANNEAU PRINCIPAL : mobile colonne / desktop côté droit ══ */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 md:pb-8 flex flex-col gap-4" style={{ scrollbarWidth:'none' }}>

        {/* Player mobile uniquement (caché sur desktop si sidebar visible) */}
        {activeSection === 'player' && (
          <div className="flex flex-col gap-4">
            {activeSong && (
              <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                className="md:hidden rounded-2xl overflow-hidden border border-cyan-500/20"
                style={{ background:'linear-gradient(135deg,rgba(6,182,212,0.08),rgba(124,58,237,0.06))' }}>
                <div className="flex flex-col md:flex-row gap-0">
                  {/* Colonne gauche : pochette + info */}
                  <div className="flex items-center gap-4 p-4 pb-3 md:flex-col md:items-start md:gap-3 md:w-64 md:flex-shrink-0 md:pb-4">
                    <div className="w-20 h-20 md:w-full md:h-48 rounded-2xl overflow-hidden flex-shrink-0"
                      style={{ boxShadow:'0 0 28px rgba(6,182,212,0.3)' }}>
                      <img src={activeSong.cover_svg || activeSong.cover_url} alt={activeSong.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 md:w-full">
                      <p className="text-white font-bold text-base truncate leading-tight">{activeSong.title}</p>
                      <p className="text-cyan-400/80 text-sm truncate mt-0.5">{activeSong.artist}</p>
                      {activeSong.album && <p className="text-gray-600 text-xs truncate mt-0.5">{activeSong.album}</p>}
                      {!isLocalPlaying && <p className="text-gray-600 text-xs mt-1 italic">Appuie sur ▶ pour démarrer</p>}
                    </div>
                  </div>
                  {/* Colonne droite : contrôles */}
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="px-4 pb-1 pt-0 md:pt-4">
                      <SeekBar currentTime={ct} duration={duration} onSeek={seekTo} color="#22d3ee" />
                    </div>
                    <div className="flex items-center justify-between px-6 pb-4 pt-1">
                      <button onClick={toggleShuffle} className={`p-2 rounded-full transition-all ${shuffle?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
                        <Shuffle className="w-4 h-4" />
                      </button>
                      <motion.button whileTap={{ scale:.88 }} onClick={() => handlePrevious?.()}
                        className="p-2 text-gray-300 hover:text-white transition-colors">
                        <SkipBack className="w-7 h-7 fill-current" />
                      </motion.button>
                      <motion.button whileTap={{ scale:.9 }}
                        onClick={isLocalPlaying ? togglePlayPause : () => playSong(songs[0], songs)}
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                        style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)', boxShadow:'0 0 40px rgba(6,182,212,0.4)' }}>
                        {isPlayingGlobal ? <Pause className="w-8 h-8 text-white fill-current" /> : <Play className="w-8 h-8 text-white fill-current ml-0.5" />}
                      </motion.button>
                      <motion.button whileTap={{ scale:.88 }} onClick={() => handleNext?.()}
                        className="p-2 text-gray-300 hover:text-white transition-colors">
                        <SkipForward className="w-7 h-7 fill-current" />
                      </motion.button>
                      <button onClick={cycleRepeat} className={`p-2 rounded-full transition-all relative ${repeat!=='off'?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
                        <Repeat className="w-4 h-4" />
                        {repeat==='one' && <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-cyan-500 text-black font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
                      </button>
                    </div>
                    <div className="px-5 pb-4">
                      <button onClick={() => setShowVolume(v => !v)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 mb-2 transition-colors">
                        <VolumeIcon className="w-3.5 h-3.5" /><span>Volume — {volume}%</span>
                        {showVolume ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <AnimatePresence>
                        {showVolume && (
                          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} className="overflow-hidden">
                            <input type="range" min={0} max={100} step={1} value={volume} onChange={e => setVolume(Number(e.target.value))}
                              className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor:'#22d3ee' }} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectionMode(v => !v); if (selectionMode) setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${selectionMode?'bg-cyan-500/25 text-cyan-300 border border-cyan-500/30':'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
                <CheckSquare className="w-3 h-3" /> Sélection
              </button>
              <button onClick={clearAll} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-white/[0.06] text-gray-500 hover:text-red-400 border border-white/[0.08] transition-all">
                <Trash2 className="w-3 h-3" /> Vider
              </button>
            </div>
            <AnimatePresence>
              {selectionMode && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400 text-xs font-bold">{selectedIds.size} sélectionné{selectedIds.size>1?'s':''}</span>
                    <button onClick={selectAll} className="text-[10px] text-cyan-400/70 hover:text-cyan-400">Tout</button>
                    <button onClick={deselectAll} className="text-[10px] text-gray-600 hover:text-gray-400">Aucun</button>
                  </div>
                  <button onClick={() => selectedIds.size > 0 && setShowSaveModal(true)} disabled={selectedIds.size === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-40 text-white"
                    style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
                    <Save className="w-3 h-3" /> Créer playlist
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.05] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-white text-xs font-bold">Playlist locale</span>
                  <span className="text-[9px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded-full">{songs.length}</span>
                </div>
                <button onClick={() => setActiveSection('files')} className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors">Tout voir →</button>
              </div>
              <div className="p-1.5 max-h-52 overflow-y-auto">
                {songs.slice(0, 7).map((s, i) => (
                  <SongRow key={s.id} song={s} isActive={i === activeIdx}
                    isSelected={selectedIds.has(s.id)} selectionMode={selectionMode}
                    onPlay={() => playFromQueue(i)} onRemove={() => removeFromQueue(i)}
                    onToggleSelect={() => toggleSelect(s.id)} />
                ))}
                {songs.length > 7 && (
                  <button onClick={() => setActiveSection('files')} className="w-full text-center py-2 text-xs text-gray-600 hover:text-cyan-400 transition-colors">
                    + {songs.length - 7} autres sons
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'playlists' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-fuchsia-400" />
                <span className="text-white font-black text-base">{'Playlists sauvegardées'}</span>
                {savedPlaylists.length > 0 && (
                  <span className="text-[10px] bg-fuchsia-500/15 text-fuchsia-400 px-2 py-0.5 rounded-full font-bold">{savedPlaylists.length}</span>
                )}
              </div>
              <button onClick={() => { setSelectionMode(true); setActiveSection('player'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
                <Plus className="w-3 h-3" /> {'Nouvelle playlist'}
              </button>
            </div>
            {savedPlaylists.length === 0 ? (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                className="flex flex-col items-center gap-5 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.05]">
                  <Folder className="w-8 h-8 text-gray-600" />
                </div>
                <div>
                  <p className="text-gray-400 font-semibold text-sm">{'Aucune playlist sauvegardée'}</p>
                  <p className="text-gray-600 text-xs mt-1">{'Crée ta première playlist pour organiser tes fichiers'}</p>
                </div>
              </motion.div>
            ) : (
              <>
                {!FS_ACCESS_SUPPORTED && savedPlaylists.some(pl => pl.songs.some(s => s._needsReimport)) && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-300 text-xs font-bold mb-0.5">Fichiers à recharger</p>
                        <p className="text-amber-200/70 text-xs leading-relaxed">
                          Sur mobile, les fichiers audio ne peuvent pas être sauvegardés entre les sessions.
                          Appuie sur <strong className="text-amber-300">Écouter</strong> puis re-sélectionne tes fichiers — la playlist est conservée.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {FS_ACCESS_SUPPORTED && savedPlaylists.some(pl => pl.songs.some(s => s._needsReimport)) && (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-2">
                      <RefreshCcw className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <p className="text-cyan-200/80 text-xs leading-relaxed">
                        Clique sur <strong>Écouter</strong> — les fichiers seront restaurés automatiquement.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {savedPlaylists.map(pl => (
                    <PlaylistCard key={pl.id} pl={pl}
                      onLoad={loadPlaylist} onDelete={deletePlaylist}
                      onReimport={() => reimportRef.current?.click()}
                      liveSongs={songs} />
                  ))}
                </div>
                <button onClick={() => { setSelectionMode(true); setActiveSection('player'); }}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/[0.12] text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all text-sm font-semibold">
                  <Plus className="w-4 h-4" /> {'Nouvelle playlist'}
                </button>
              </>
            )}
          </div>
        )}

        {activeSection === 'files' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-cyan-400" />
                <span className="text-white font-black text-base">{'Fichiers'}</span>
                <span className="text-[10px] bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded-full font-bold">{songs.length}</span>
              </div>
              <button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : () => inputRef.current?.click()} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.07] text-gray-300 hover:text-white transition-all">
                <FolderOpen className="w-3.5 h-3.5" />{'Ajouter des fichiers'}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setSelectionMode(v => !v); if (selectionMode) setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${selectionMode?'bg-cyan-500/25 text-cyan-300 border border-cyan-500/30':'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
                <CheckSquare className="w-3 h-3" /> Sélection
              </button>
              {selectionMode && (
                <>
                  <button onClick={selectAll} className="text-[10px] text-cyan-400/70 hover:text-cyan-400 px-2">Tout</button>
                  <button onClick={deselectAll} className="text-[10px] text-gray-600 hover:text-gray-400 px-2">Aucun</button>
                  {selectedIds.size > 0 && (
                    <button onClick={() => setShowSaveModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white ml-auto"
                      style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
                      <Save className="w-3 h-3" /> Créer ({selectedIds.size})
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.05] overflow-hidden">
              <div className="p-2 flex flex-col gap-0.5">
                {songs.map((s, i) => (
                  <SongRow key={s.id} song={s} isActive={i === activeIdx}
                    isSelected={selectedIds.has(s.id)} selectionMode={selectionMode}
                    onPlay={() => playFromQueue(i)} onRemove={() => removeFromQueue(i)}
                    onToggleSelect={() => toggleSelect(s.id)} />
                ))}
              </div>
            </div>
            <button onClick={clearAll} className="text-xs text-gray-700 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 py-2">
              <Trash2 className="w-3.5 h-3.5" /> {'Supprimer'}
            </button>
          </div>
        )}
      </div>{/* fin panneau principal */}
      </div>{/* fin layout flex PC */}

      <AnimatePresence>
        {showSaveModal && (
          <SavePlaylistModal count={selectedIds.size} onSave={savePlaylist} onClose={() => setShowSaveModal(false)} />
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
};

export default LocalPlayerPage;
