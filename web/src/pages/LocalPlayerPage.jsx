/**
 * LocalPlayerPage — NovaSound TITAN LUX v2000
 *
 * v2000 FIXES COMPLETS :
 * ✅ accept="*" → tous les fichiers sont cliquables (Xender, OTG, SD, stockage tiers)
 *    + filtre d'extension côté client → seuls les audios sont chargés
 * ✅ Lecteur local embarqué avec BARRE DE SEEK complète, draggable, tactile
 * ✅ Contrôles play/pause/prev/next directement dans la page
 * ✅ Volume + durée + temps courant affichés
 * ✅ Chargement séquentiel par batch 4 → zéro crash mémoire
 * ✅ ID3 metadata (titre, artiste, pochette) parsée localement
 * ✅ Playlists locales sauvegardées
 */
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, HardDrive, WifiOff, ListMusic, Trash2, Plus, Check,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX,
  Sliders, Share2, Download, X, ChevronDown, ChevronRight, ArrowLeft, Home,
  Music, Save, Edit3, CheckSquare, Square, Folder, ChevronUp,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';

// ── Extensions audio acceptées côté client ──────────────────────────────────
const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = (file) =>
  AUDIO_EXTS.test(file.name) || file.type.startsWith('audio/') || file.type === 'video/mp4';

// ── IndexedDB — stockage persistant des playlists locales ─────────────────
// Utilisé pour sauvegarder les FileSystemFileHandle (File System Access API)
// permettant de relire les fichiers sans re-sélection sur PC/Chrome/Edge
const IDB_NAME    = 'novasound_local_v1';
const IDB_STORE   = 'playlists';
const FS_ACCESS_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

const openIDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(IDB_NAME, 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
  req.onsuccess = (e) => resolve(e.target.result);
  req.onerror   = () => reject(req.error);
});

const idbSave = async (playlist) => {
  try {
    const db   = await openIDB();
    const tx   = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(playlist);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (e) { console.warn('[LocalPlayer] idbSave error:', e); }
};

const idbDelete = async (id) => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (e) { console.warn('[LocalPlayer] idbDelete error:', e); }
};

const idbLoadAll = async () => {
  try {
    const db  = await openIDB();
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result || []); req.onerror = rej; });
  } catch (e) { console.warn('[LocalPlayer] idbLoadAll error:', e); return []; }
};

// Tenter de résoudre les FileHandle en objets File réels
const resolveHandles = async (songs) => {
  const resolved = [];
  for (const s of songs) {
    if (s._fileHandle) {
      try {
        // Vérifier permission d'abord
        const perm = await s._fileHandle.queryPermission({ mode: 'read' });
        let file = null;
        if (perm === 'granted') {
          file = await s._fileHandle.getFile();
        } else {
          const req = await s._fileHandle.requestPermission({ mode: 'read' });
          if (req === 'granted') file = await s._fileHandle.getFile();
        }
        if (file) {
          const song = await fileToSong(file);
          song._fileHandle = s._fileHandle;
          resolved.push(song);
          continue;
        }
      } catch (_) {}
    }
    // Fallback : marqué comme nécessitant réimport
    resolved.push({ ...s, _needsReimport: true, audio_url: null });
  }
  return resolved;
};



// ── Couleur déterministe depuis le nom ─────────────────────────────────────
const nameToColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360},60%,45%)`;
};

const makeCover = (title = '', artist = '') => {
  const c1 = nameToColor(title);
  const c2 = nameToColor(artist || title.split('').reverse().join(''));
  const letter = (title[0] || '♫').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <circle cx="100" cy="100" r="55" fill="rgba(0,0,0,0.25)"/>
    <text x="100" y="118" font-family="system-ui,sans-serif" font-size="64"
      font-weight="bold" fill="white" text-anchor="middle" opacity="0.9">${letter}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

// ── Parse ID3v2 minimal ────────────────────────────────────────────────────
const parseID3 = async (file) => {
  const meta = { title: '', artist: '', album: '', cover: null };
  try {
    const bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return meta;
    const ss  = (b, o) => ((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f);
    let pos   = 10;
    const end = ss(bytes, 6) + 10;
    const dec = new TextDecoder('utf-8', { fatal: false });
    while (pos < end - 10 && pos < bytes.length - 10) {
      const fid = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      const fsz = (bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
      if (fsz <= 0 || fsz > 300000) break;
      const data = bytes.slice(pos + 10, pos + 10 + fsz);
      const txt  = data[0] === 0
        ? dec.decode(data.slice(1))
        : new TextDecoder('utf-16le', { fatal: false }).decode(data.slice(3));
      if      (fid === 'TIT2') meta.title  = txt.replace(/\0/g,'').trim();
      else if (fid === 'TPE1') meta.artist = txt.replace(/\0/g,'').trim();
      else if (fid === 'TALB') meta.album  = txt.replace(/\0/g,'').trim();
      else if (fid === 'APIC' && !meta.cover) {
        let i = 1;
        while (i < data.length && data[i] !== 0) i++;
        i++; i++; while (i < data.length && data[i] !== 0) i++; i++;
        meta.cover = URL.createObjectURL(new Blob([data.slice(i)], { type: 'image/jpeg' }));
      }
      pos += 10 + fsz;
    }
  } catch (_) {}
  return meta;
};

const fileToSong = async (file, fileHandle = null) => {
  const url    = URL.createObjectURL(file);
  const raw    = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  const tags   = await parseID3(file);
  const title  = tags.title  || raw;
  const artist = tags.artist || 'Fichier local';
  return {
    id:            'local::' + file.name + '::' + file.size,
    title, artist,
    album:         tags.album || '',
    audio_url:     url,
    cover_url:     tags.cover || makeCover(title, artist),
    is_local:      true,
    _file:         file,
    _blobUrl:      url,
    _hasBlobCover: !!tags.cover,
    _coverBlobUrl: tags.cover || null,
    _fileHandle:   fileHandle || null,  // FileSystemFileHandle pour persistance
  };
};

// ── Format time ───────────────────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

// ── SeekBar draggable (touch + mouse) ────────────────────────────────────
const SeekBar = ({ currentTime, duration, onSeek, color = '#22d3ee' }) => {
  const trackRef  = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState(0);

  const getPct = (clientX) => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - left) / width));
  };

  const startDrag = (clientX) => { setDragging(true); setDragPct(getPct(clientX)); };
  const moveDrag  = useCallback((clientX) => { if (!dragging) return; setDragPct(getPct(clientX)); }, [dragging]);
  const endDrag   = useCallback((clientX) => {
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

  const pct  = dragging ? dragPct : (duration > 0 ? currentTime / duration : 0);
  const disp = pct * (duration || 0);

  return (
    <div className="w-full select-none px-1">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative w-full rounded-full cursor-pointer group"
        style={{ height: 20, display: 'flex', alignItems: 'center' }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
        onTouchStart={(e) => { e.preventDefault(); startDrag(e.touches[0].clientX); }}
        onClick={(e) => { if (!dragging && onSeek && duration > 0) onSeek(getPct(e.clientX) * duration); }}
      >
        {/* Background track */}
        <div className="absolute inset-0 my-auto rounded-full" style={{ height: 6, background: 'rgba(255,255,255,0.12)' }} />
        {/* Filled portion */}
        <div className="absolute left-0 my-auto rounded-full transition-all"
          style={{ height: 6, top: '50%', transform: 'translateY(-50%)', width: `${pct * 100}%`, background: `linear-gradient(90deg, ${color}, #a855f7)` }} />
        {/* Thumb */}
        <div className="absolute"
          style={{
            left: `${pct * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: dragging ? 22 : 16,
            height: dragging ? 22 : 16,
            borderRadius: '50%',
            background: 'white',
            boxShadow: `0 0 12px ${color}90, 0 2px 8px rgba(0,0,0,0.6)`,
            transition: dragging ? 'none' : 'width 0.15s, height 0.15s',
            cursor: 'grab',
          }}
        />
      </div>
      {/* Temps */}
      <div className="flex justify-between text-xs tabular-nums mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
        <span>{fmtTime(disp)}</span>
        <span>{duration > 0 ? fmtTime(duration) : '--:--'}</span>
      </div>
    </div>
  );
};

// ── SongRow ────────────────────────────────────────────────────────────────
const SongRow = memo(({ song, isActive, isSelected, onPlay, onRemove, selectionMode, onToggleSelect }) => {
  const needsReimport = !!song._needsReimport;
  return (
  <div
    className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all group cursor-pointer ${
      needsReimport ? 'opacity-50 border border-amber-500/15 bg-amber-500/5' :
      isActive ? 'bg-white/10 border border-white/10' : isSelected ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/[0.05] border border-transparent'
    }`}
    onClick={needsReimport ? undefined : (selectionMode ? onToggleSelect : onPlay)}
    title={needsReimport ? 'Fichier non disponible — recharge tes fichiers pour lire ce son' : undefined}
  >
    {selectionMode ? (
      <div className="w-5 h-5 flex-shrink-0">
        {isSelected
          ? <CheckSquare className="w-5 h-5 text-cyan-400" />
          : <Square className="w-5 h-5 text-gray-600" />
        }
      </div>
    ) : (
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative">
        <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        {needsReimport && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-amber-400 text-xs">⚠</span>
          </div>
        )}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : needsReimport ? 'text-gray-500' : 'text-gray-300'}`}>{song.title}</p>
      <p className="text-[11px] truncate">{needsReimport ? <span className="text-amber-500/70">Fichier à recharger</span> : <span className="text-gray-500">{song.artist}</span>}</p>
    </div>
    {isActive && !selectionMode && !needsReimport && (
      <div className="flex gap-px items-end h-3.5 flex-shrink-0">
        {[1,2,3].map(i => (
          <div key={i} className="w-0.5 rounded-full bg-cyan-400"
            style={{ height:`${5+i*3}px`, animation:`novaWave ${0.4+i*0.15}s ease-in-out infinite alternate`, animationDelay:`${i*0.1}s` }} />
        ))}
      </div>
    )}
    {!selectionMode && (
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="p-1.5 rounded-full text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
      ><Trash2 className="w-3.5 h-3.5" /></button>
    )}
  </div>
  );
});

// ── SavePlaylistModal ─────────────────────────────────────────────────────
const SavePlaylistModal = ({ songs, selectedIds, onSave, onClose }) => {
  const [name, setName] = useState('');
  const count = selectedIds.size;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-6"
      >
        <h3 className="text-white font-bold text-lg mb-1">Sauvegarder la playlist</h3>
        <p className="text-gray-500 text-sm mb-4">{count} son{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}</p>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Nom de la playlist…" autoFocus
          className="w-full bg-white/[0.07] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-semibold hover:bg-white/10 transition-all">
            Annuler
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#0e7490,#7c3aed)' }}
          >
            <Save className="w-3.5 h-3.5 inline mr-1.5" />
            Sauvegarder
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
const LocalPlayerPage = () => {
  const inputRef    = useRef(null);
  const reimportRef  = useRef(null);  // pour ré-importer les fichiers des playlists sauvegardées
  const [reimportTarget, setReimportTarget] = useState(null); // playlist en attente de reimport
  const {
    playSong, currentSong, playlist,
    audioCurrentTime, audioDuration, isPlayingGlobal,
    seekTo, togglePlayPause,
    handleNext, handlePrevious,
    shuffle, toggleShuffle,
    repeat, cycleRepeat,
  } = usePlayer();

  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('player'); // 'player' | 'playlists' | 'files'

  const [songs,         setSongs]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [added,         setAdded]         = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  // Charger les playlists depuis IndexedDB au montage
  useEffect(() => {
    idbLoadAll().then(pls => {
      if (pls.length > 0) setSavedPlaylists(pls);
      else {
        // Migration depuis localStorage si IDB vide
        try {
          const ls = JSON.parse(localStorage.getItem('novasound_local_playlists') || '[]');
          if (ls.length) {
            setSavedPlaylists(ls);
            ls.forEach(pl => idbSave(pl).catch(() => {}));
          }
        } catch {}
      }
    });
  }, []);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [volume,        setVolume]        = useState(80);
  const [showVolume,    setShowVolume]    = useState(false);

  // Révocation blobs au unmount
  useEffect(() => () => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File System Access API (PC/Chrome/Edge) — handles persistants ──────────
  const openPickerFSA = useCallback(async () => {
    if (!FS_ACCESS_SUPPORTED) { openPicker(); return; }
    try {
      const handles = await window.showOpenFilePicker({
        types: [{ description: 'Fichiers Audio', accept: { 'audio/*': ['.mp3','.m4a','.wav','.flac','.ogg','.aac','.opus','.wma','.webm'] } }],
        multiple: true,
      });
      setLoading(true);
      const BATCH = 4;
      const newSongs = [];
      for (let i = 0; i < handles.length; i += BATCH) {
        const batch = handles.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async h => {
          try {
            const file = await h.getFile();
            if (!isAudioFile(file)) return null;
            return fileToSong(file, h); // passer le handle pour persistance
          } catch { return null; }
        }));
        newSongs.push(...results.filter(Boolean));
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
      if (err?.name !== 'AbortError') openPicker(); // fallback input classique
    }
  }, [playSong]);

  const openPicker = () => inputRef.current?.click();

  const onFiles = useCallback(async (e) => {
    // Filtrer les fichiers audio côté client (accept="*/*" = tous les fichiers visibles)
    const files = Array.from(e.target.files || []).filter(isAudioFile);
    if (!files.length) {
      alert('Aucun fichier audio sélectionné. Formats supportés : MP3, M4A, WAV, FLAC, AAC, OGG, OPUS…');
      return;
    }
    setLoading(true);
    // Batch de 4 → évite le crash mémoire sur sélection multiple
    const BATCH = 4;
    const newSongs = [];
    try {
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(f => fileToSong(f).catch(() => null)));
        newSongs.push(...results.filter(Boolean));
      }
    } catch (err) { console.warn('[LocalPlayer] onFiles error:', err); }
    if (!newSongs.length) { setLoading(false); return; }
    setSongs(prev => {
      const merged = [...prev, ...newSongs.filter(ns => !prev.find(p => p.id === ns.id))];
      if (prev.length === 0) setTimeout(() => playSong(newSongs[0], newSongs), 50);
      return merged;
    });
    setLoading(false);
    e.target.value = '';
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }, [playSong]);

  const playFromQueue = useCallback((idx) => playSong(songs[idx], songs), [songs, playSong]);

  const removeFromQueue = useCallback((idx) => {
    setSongs(prev => {
      const s = prev[idx];
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const clearAll = useCallback(() => {
    if (!songs.length) return;
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
    setSongs([]);
    setSelectedIds(new Set());
    setSelectionMode(false);
    // Arrêter le lecteur global si un son local est en cours
    if (currentSong?.is_local) {
      window.dispatchEvent(new CustomEvent('novasound:close-player'));
    }
  }, [songs, currentSong]);

  const selectAll    = useCallback(() => setSelectedIds(new Set(songs.map(s => s.id))), [songs]);
  const deselectAll  = useCallback(() => setSelectedIds(new Set()), []);
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const savePlaylist = (name) => {
    const selected = songs.filter(s => selectedIds.has(s.id));
    const safeSongs = selected.map(s => ({
      id:           s.id,
      title:        s.title,
      artist:       s.artist,
      album:        s.album || '',
      cover_url:    s.cover_url?.startsWith('blob:') ? makeCover(s.title, s.artist) : (s.cover_url || makeCover(s.title, s.artist)),
      is_local:     true,
      _needsReimport: !s._fileHandle, // pas besoin de reimport si on a le handle
      _fileHandle:  s._fileHandle || null, // FileSystemFileHandle — persistant!
    }));
    const pl = { id: Date.now(), name, songs: safeSongs, createdAt: new Date().toISOString() };
    const updated = [...savedPlaylists, pl];
    setSavedPlaylists(updated);
    // Sauvegarder en IndexedDB (supporte les FileHandle)
    idbSave(pl).catch(() => {});
    // Fallback localStorage (sans les handles qui ne sont pas sérialisables)
    try {
      const lsSafe = updated.map(p => ({ ...p, songs: p.songs.map(s => ({ ...s, _fileHandle: undefined })) }));
      localStorage.setItem('novasound_local_playlists', JSON.stringify(lsSafe));
    } catch {}
    setShowSaveModal(false); setSelectionMode(false); setSelectedIds(new Set());
  };

  const loadPlaylist = async (pl) => {
    setShowPlaylists(false);
    setLoading(true);
    try {
      // Tenter de résoudre les FileHandle (PC/Chrome avec File System Access API)
      const withHandles = pl.songs.filter(s => s._fileHandle);
      const resolved = withHandles.length > 0 ? await resolveHandles(pl.songs) : pl.songs.map(s => ({ ...s, _needsReimport: true }));

      setSongs(prev => {
        const merged = [...prev];
        resolved.forEach(saved => {
          const live = prev.find(p => p.id === saved.id);
          if (!live) merged.push(live || saved);
          else {
            // Si la version live a un blob URL valide, on la garde
            const idx = merged.findIndex(p => p.id === saved.id);
            if (idx >= 0 && !merged[idx]._needsReimport) return;
            if (idx >= 0) merged[idx] = saved;
          }
        });
        const playable = merged.filter(s => resolved.find(r => r.id === s.id) && !s._needsReimport);
        if (playable.length > 0) setTimeout(() => playSong(playable[0], playable), 50);
        return merged;
      });
    } catch (e) {
      console.warn('[LocalPlayer] loadPlaylist error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Réimport des fichiers pour restaurer une playlist — matching par nom+taille (id = 'local::name::size')
  const onReimportFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(isAudioFile);
    if (!files.length) return;
    setLoading(true);
    const BATCH = 4;
    const newSongs = [];
    try {
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(f => fileToSong(f).catch(() => null)));
        newSongs.push(...results.filter(Boolean));
      }
    } catch (err) { console.warn('[LocalPlayer] reimport error:', err); }
    setSongs(prev => {
      // Remplacer les songs _needsReimport par les nouvelles versions si l'id correspond
      const updated = prev.map(s => {
        if (!s._needsReimport) return s;
        const match = newSongs.find(ns => ns.id === s.id);
        return match || s;  // si match trouvé → version avec blob URL valide
      });
      // Ajouter aussi les nouvelles songs non encore présentes
      newSongs.forEach(ns => { if (!updated.find(u => u.id === ns.id)) updated.push(ns); });
      // Lancer la lecture sur les songs fraîchement résolues
      const resolved = updated.filter(s => !s._needsReimport && newSongs.find(ns => ns.id === s.id));
      if (resolved.length > 0) setTimeout(() => playSong(resolved[0], resolved), 50);
      return updated;
    });
    setLoading(false);
    e.target.value = '';
  }, [playSong]);

  const deletePlaylist = (id) => {
    const updated = savedPlaylists.filter(p => p.id !== id);
    setSavedPlaylists(updated);
    idbDelete(id).catch(() => {});
    try {
      const lsSafe = updated.map(p => ({ ...p, songs: p.songs.map(s => ({ ...s, _fileHandle: undefined })) }));
      localStorage.setItem('novasound_local_playlists', JSON.stringify(lsSafe));
    } catch {}
  };

  // ── Volume → applique sur l'élément audio global ─────────────────────
  useEffect(() => {
    const audio = document.querySelector('audio');
    if (audio) audio.volume = volume / 100;
  }, [volume]);

  const activeIdx = songs.findIndex(s => s.id === currentSong?.id);
  const isLocalPlaying = !!currentSong?.is_local;

  // ── Empty state ───────────────────────────────────────────────────────
  if (!songs.length) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom,12px)' }}>
      {/* Nav bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#050510]/95 backdrop-blur-md border-b border-white/[0.06]" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-gray-400 hover:text-white transition-all flex items-center justify-center flex-shrink-0" aria-label="Retour"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0"><p className="text-white font-black text-base leading-none">Lecteur Local</p><p className="text-gray-600 text-[10px] mt-0.5">100% hors-ligne</p></div>
        <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center flex-shrink-0" aria-label="Accueil"><Home className="w-4 h-4" /></Link>
      </div>
        <div className="flex-1 flex items-center justify-center px-5">
        {/* accept="*" → TOUS les fichiers visibles dans le picker (Xender, OTG, SD...) */}
        <input ref={inputRef}   type="file" id="local-file-input"    name="local-file-input"    accept="*/*" multiple onChange={onFiles}        className="hidden" />
      <input ref={reimportRef} type="file" id="local-reimport-input" name="local-reimport-input" accept="*/*" multiple onChange={onReimportFiles} className="hidden" />

        <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
          className="w-full max-w-sm flex flex-col items-center gap-8 text-center">

          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
            {loading
              ? <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <HardDrive className="w-10 h-10 text-white" />
            }
          </div>

          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <WifiOff className="w-4 h-4 text-cyan-400" />
              <h1 className="text-white text-2xl font-black">Lecteur Local</h1>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Lis tes fichiers audio directement depuis ton appareil — sans connexion internet.
            </p>
          </div>

          <motion.button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : openPicker} whileTap={{ scale:0.95 }} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white font-bold disabled:opacity-60"
            style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
            <FolderOpen className="w-5 h-5" />
            {loading ? 'Chargement…' : FS_ACCESS_SUPPORTED ? 'Ouvrir (fichiers persistants)' : "Ouvrir depuis l'appareil"}
          </motion.button>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 w-full text-left">
            <p className="text-amber-300 text-xs font-semibold mb-1">💡 Si tes MP3 ne sont pas cliquables</p>
            <p className="text-amber-200/70 text-xs leading-relaxed">
              Tous les fichiers sont affichés. Sélectionne tes fichiers audio depuis n'importe quel dossier (Xender, WhatsApp, SD card…). Les non-audio sont automatiquement ignorés.
            </p>
          </div>

          {FS_ACCESS_SUPPORTED && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 w-full text-left">
              <p className="text-green-300 text-xs font-semibold mb-1">✅ Mode PC — Playlists persistantes</p>
              <p className="text-green-200/70 text-xs leading-relaxed">
                Tes fichiers sont mémorisés entre les sessions. Tes playlists resteront disponibles même après plusieurs jours.
              </p>
            </div>
          )}

          {savedPlaylists.length > 0 && (
            <div className="w-full">
              <p className="text-gray-600 text-xs mb-2 text-left font-semibold">Playlists sauvegardées</p>
              <div className="flex flex-col gap-1.5">
                {savedPlaylists.map(pl => (
                  <button key={pl.id} onClick={() => loadPlaylist(pl)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] transition-all text-left border border-white/[0.06]">
                    <Folder className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{pl.name}</p>
                      <p className="text-gray-600 text-xs">{pl.songs.length} son{pl.songs.length > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-gray-600 text-[11px]">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS · WMA</p>

          <div className="w-full grid grid-cols-3 gap-2">
            {[
              { icon:WifiOff,   c:'#22d3ee', label:'100% offline'  },
              { icon:HardDrive, c:'#4ade80', label:'Tous appareils' },
              { icon:Sliders,   c:'#a855f7', label:'Seek + volume'  },
            ].map(({ icon:Icon, c, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                <Icon className="w-4 h-4" style={{ color:c }} />
                <span className="text-[10px] text-gray-500 text-center">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER — Lecteur avec playlist
  // ════════════════════════════════════════════════════════════════
  const activeSong  = isLocalPlaying ? currentSong : songs[0];
  const duration    = isLocalPlaying ? (audioDuration || 0) : 0;
  const currentTime = isLocalPlaying ? (audioCurrentTime || 0) : 0;
  const pctBar      = duration > 0 ? currentTime / duration : 0;
  const VolumeIcon  = volume === 0 ? VolumeX : Volume2;

  return (
    <div className="min-h-screen bg-[#050510] flex flex-col"
      style={{ paddingBottom:'env(safe-area-inset-bottom,120px)' }}>
      {/* Nav bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#050510]/95 backdrop-blur-md border-b border-white/[0.06]" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-gray-400 hover:text-white transition-all flex items-center justify-center flex-shrink-0" aria-label="Retour"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0"><p className="text-white font-black text-base leading-none">Lecteur Local</p><p className="text-gray-600 text-[10px] mt-0.5">100% hors-ligne</p></div>
        <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center flex-shrink-0" aria-label="Accueil"><Home className="w-4 h-4" /></Link>
      </div>
      {/* Section tabs */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.05]">
        {[
          { key: 'player',    label: 'Lecteur',   icon: '\uD83C\uDFB5' },
          { key: 'playlists', label: 'Playlists', icon: '\uD83D\uDCC2', count: savedPlaylists.length },
          { key: 'files',     label: 'Fichiers',  icon: '\uD83C\uDFB6', count: songs.length },
        ].map(({ key, label, icon, count }) => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex-1 justify-center ${
              activeSection === key
                ? 'bg-gradient-to-r from-cyan-500/25 to-purple-600/25 text-white border-cyan-500/40'
                : 'bg-white/[0.04] text-gray-500 border-white/[0.07] hover:text-gray-300'
            }`}>
            <span>{icon}</span><span>{label}</span>
            {count !== undefined && count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                activeSection === key ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-gray-600'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>
      {/* accept="*" = TOUS les fichiers visibles depuis n'importe quel dossier */}
      <input ref={inputRef}   type="file" id="local-file-input"    name="local-file-input"    accept="*/*" multiple onChange={onFiles}        className="hidden" />
      <input ref={reimportRef} type="file" id="local-reimport-input" name="local-reimport-input" accept="*/*" multiple onChange={onReimportFiles} className="hidden" />

      <div className="max-w-sm mx-auto w-full px-4 pt-5 flex flex-col gap-3">

      {activeSection === 'player' && (
      <div className="w-full">
        {/* ══ LECTEUR LOCAL EMBARQUÉ ══════════════════════════════ */}
        {isLocalPlaying && activeSong && (
          <motion.div
            initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }}
            className="rounded-2xl overflow-hidden border border-cyan-500/20"
            style={{ background:'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(124,58,237,0.06))' }}
          >
            {/* Cover + Info */}
            <div className="flex items-center gap-3 p-4 pb-2">
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-lg"
                style={{ boxShadow:'0 0 20px rgba(6,182,212,0.3)' }}>
                <img src={activeSong.cover_url} alt={activeSong.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{activeSong.title}</p>
                <p className="text-cyan-400/80 text-xs truncate">{activeSong.artist}</p>
                {activeSong.album && <p className="text-gray-600 text-[10px] truncate">{activeSong.album}</p>}
              </div>
              {/* Bouton ajouter + */}
              <motion.button onClick={openPicker} whileTap={{ scale:0.9 }} disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold flex-shrink-0"
                style={{ background: added ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.08)', color: added ? '#22d3ee' : '#9ca3af' }}>
                {loading ? <div className="w-3 h-3 rounded-full border border-gray-500 border-t-cyan-400 animate-spin" />
                  : added ? <><Check className="w-3 h-3" />Ajouté</>
                  : <><Plus className="w-3 h-3" />Ajouter</>
                }
              </motion.button>
            </div>

            {/* ── BARRE DE SEEK ── */}
            <div className="px-3 pb-1">
              <SeekBar
                currentTime={currentTime}
                duration={duration}
                onSeek={seekTo}
                color="#22d3ee"
              />
            </div>

            {/* ── CONTRÔLES PRINCIPAUX ── */}
            <div className="flex items-center justify-between px-6 pb-3">
              {/* Shuffle */}
              <button onClick={toggleShuffle}
                className={`p-2 rounded-full transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}>
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Prev */}
              <motion.button whileTap={{ scale:0.88 }}
                onClick={() => { window.dispatchEvent(new CustomEvent('novasound:toggle-play')); handlePrevious?.(); }}
                className="p-2 text-gray-300 hover:text-white transition-colors">
                <SkipBack className="w-7 h-7 fill-current" />
              </motion.button>

              {/* Play/Pause — GRAND BOUTON */}
              <motion.button
                whileTap={{ scale:0.9 }}
                onClick={togglePlayPause}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)', boxShadow:'0 0 40px rgba(6,182,212,0.4)' }}
              >
                {isPlayingGlobal
                  ? <Pause className="w-8 h-8 text-white fill-current" />
                  : <Play  className="w-8 h-8 text-white fill-current ml-0.5" />
                }
              </motion.button>

              {/* Next */}
              <motion.button whileTap={{ scale:0.88 }}
                onClick={() => { handleNext?.(); }}
                className="p-2 text-gray-300 hover:text-white transition-colors">
                <SkipForward className="w-7 h-7 fill-current" />
              </motion.button>

              {/* Repeat */}
              <button onClick={cycleRepeat}
                className={`p-2 rounded-full transition-all relative ${repeat!=='off'?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
                <Repeat className="w-4 h-4" />
                {repeat==='one' && <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-cyan-500 text-black font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
              </button>
            </div>

            {/* ── VOLUME ── */}
            <div className="px-5 pb-4">
              <button onClick={() => setShowVolume(v => !v)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2">
                <VolumeIcon className="w-3.5 h-3.5" />
                <span>Volume — {volume}%</span>
                {showVolume ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <AnimatePresence>
                {showVolume && (
                  <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                    className="overflow-hidden">
                    <input
                      type="range" min={0} max={100} step={1} value={volume}
                      onChange={e => setVolume(Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{ accentColor:'#22d3ee' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ══ HEADER / TOOLBAR ════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-black text-base">Lecteur Local</span>
            <span className="text-[11px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 px-2 py-0.5 rounded-full font-bold">
              {songs.length} son{songs.length > 1 ? 's' : ''}
            </span>
          </div>
          {!isLocalPlaying && (
            <motion.button onClick={openPicker} whileTap={{ scale:0.9 }} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/[0.08] text-gray-400 hover:text-white transition-all">
              {loading
                ? <div className="w-3 h-3 rounded-full border border-gray-500 border-t-cyan-400 animate-spin" />
                : <><FolderOpen className="w-3.5 h-3.5" /> Ouvrir</>
              }
            </motion.button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => { setSelectionMode(v => !v); if (selectionMode) setSelectedIds(new Set()); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${selectionMode ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/30' : 'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
            <CheckSquare className="w-3 h-3" /> Sélection
          </button>
          {FS_ACCESS_SUPPORTED && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 w-full text-left">
              <p className="text-green-300 text-xs font-semibold mb-1">✅ Mode PC — Playlists persistantes</p>
              <p className="text-green-200/70 text-xs leading-relaxed">
                Tes fichiers sont mémorisés entre les sessions. Tes playlists resteront disponibles même après plusieurs jours.
              </p>
            </div>
          )}

          {savedPlaylists.length > 0 && (
            <button onClick={() => setShowPlaylists(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${showPlaylists ? 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/30' : 'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
              <Folder className="w-3 h-3" /> Playlists ({savedPlaylists.length})
            </button>
          )}
        </div>

        {/* Selection bar */}
        <AnimatePresence>
          {selectionMode && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
              className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 text-xs font-bold">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                <button onClick={selectAll} className="text-[10px] text-cyan-400/70 hover:text-cyan-400">Tout</button>
                <button onClick={deselectAll} className="text-[10px] text-gray-600 hover:text-gray-400">Aucun</button>
              </div>
              <button
                onClick={() => selectedIds.size > 0 && setShowSaveModal(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg,#0e7490,#7c3aed)', color: 'white' }}>
                <Save className="w-3 h-3" /> Créer playlist
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved playlists */}
        <AnimatePresence>
          {showPlaylists && savedPlaylists.length > 0 && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
              className="bg-white/[0.04] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                <Folder className="w-4 h-4 text-fuchsia-400" />
                <span className="text-white text-sm font-bold">Mes playlists locales</span>
              </div>
              <div className="p-2">
                {savedPlaylists.map(pl => (
                  <div key={pl.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.05] transition-all group">
                    <button onClick={() => loadPlaylist(pl)} className="flex-1 flex items-center gap-2 text-left">
                      <ListMusic className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-semibold">{pl.name}</p>
                        <p className="text-gray-600 text-xs">{pl.songs.length} sons</p>
                      </div>
                    </button>
                    <button
                      onClick={() => reimportRef.current?.click()}
                      title="Recharger les fichiers de cette playlist"
                      className="p-1.5 rounded-lg text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deletePlaylist(pl.id)}
                      className="p-1 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>)}
      {activeSection === 'files' && (
      <>
        {/* ══ LISTE ════════════════════════════════════════════════ */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-cyan-400" />
              <span className="text-white text-sm font-bold">Playlist locale</span>
            </div>
            <button onClick={openPicker} className="p-1.5 rounded-full text-gray-600 hover:text-cyan-400 transition-colors" title="Ajouter des fichiers">
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 max-h-[45vh] overflow-y-auto">
            {songs.map((s, i) => (
              <SongRow key={s.id} song={s} isActive={i === activeIdx}
                isSelected={selectedIds.has(s.id)}
                selectionMode={selectionMode}
                onPlay={() => playFromQueue(i)}
                onRemove={() => removeFromQueue(i)}
                onToggleSelect={() => toggleSelect(s.id)}
              />
            ))}
          </div>
        </div>

        <button onClick={clearAll}
          className="text-xs text-gray-700 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 py-2">
          <Trash2 className="w-3.5 h-3.5" /> Vider la playlist locale
        </button>
      </>)}



      {/* Save Playlist Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <SavePlaylistModal songs={songs} selectedIds={selectedIds} onSave={savePlaylist} onClose={() => setShowSaveModal(false)} />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default LocalPlayerPage;
