/**
 * LocalPlayerPage — NovaSound TITAN LUX v13000
 *
 * FIXES v13000 :
 * ✅ Onglet "Playlists" avec contenu complet (était vide !)
 * ✅ Footer ajouté en bas de page
 * ✅ BottomNav masqué (géré dans App.jsx)
 * ✅ Bouton Prev corrigé (ne déclenche plus toggle-play parasite)
 * ✅ Persistance playlists iOS/Android via localStorage + IDB
 * ✅ Covers persistées via SVG déterministe (pas de blob URL)
 * ✅ Bloc FSA_SUPPORTED sorti de la toolbar
 * ✅ PlaylistCard avec grille de covers, bouton Écouter + Réimporter
 * ✅ Notification visuelle quand reimport requis sur mobile
 * ✅ Sauvegarde universelle (IDB + localStorage fallback)
 * ✅ UX: mini liste visible dans onglet lecteur
 * ✅ Bouton Play lance le premier son si rien n'est en cours
 */
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, HardDrive, WifiOff, ListMusic, Trash2, Plus, Check,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX,
  Sliders, X, ChevronDown, ChevronRight, ArrowLeft, Home,
  Music, Save, CheckSquare, Square, Folder, ChevronUp,
  RefreshCw, AlertTriangle,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import Footer from '@/components/Footer';

// ── Extensions audio acceptées côté client ──────────────────────────────────
const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = (file) =>
  AUDIO_EXTS.test(file.name) || file.type.startsWith('audio/') || file.type === 'video/mp4';

// ── File System Access API (PC/Chrome/Edge uniquement) ───────────────────────
const FS_ACCESS_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const IDB_NAME  = 'novasound_local_v1';
const IDB_STORE = 'playlists';

const openIDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(IDB_NAME, 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
  req.onsuccess = (e) => resolve(e.target.result);
  req.onerror   = () => reject(req.error);
});

const idbSave = async (playlist) => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const safe = { ...playlist, songs: playlist.songs.map(s => ({ ...s, _fileHandle: undefined, _file: undefined })) };
    tx.objectStore(IDB_STORE).put(safe);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (e) { console.warn('[LocalPlayer] idbSave:', e); }
};

const idbDelete = async (id) => {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (e) { console.warn('[LocalPlayer] idbDelete:', e); }
};

const idbLoadAll = async () => {
  try {
    const db  = await openIDB();
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result || []); req.onerror = rej; });
  } catch (e) { return []; }
};

// ── Sauvegarde universelle IDB + localStorage ─────────────────────────────
const makeCoverSvg = (title = '', artist = '') => {
  const nameToColor = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},60%,45%)`;
  };
  const c1 = nameToColor(title);
  const c2 = nameToColor(artist || title.split('').reverse().join(''));
  const letter = (title[0] || '♫').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="100" r="55" fill="rgba(0,0,0,0.25)"/><text x="100" y="118" font-family="system-ui,sans-serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle" opacity="0.9">${letter}</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

const savePlaylistsEverywhere = (playlists) => {
  playlists.forEach(pl => idbSave(pl).catch(() => {}));
  try {
    const lsSafe = playlists.map(p => ({
      ...p,
      songs: p.songs.map(s => ({
        id:          s.id,
        title:       s.title,
        artist:      s.artist,
        album:       s.album || '',
        cover_url:   s.cover_svg || (s.cover_url?.startsWith('blob:') ? makeCoverSvg(s.title, s.artist) : (s.cover_url || makeCoverSvg(s.title, s.artist))),
        cover_svg:   s.cover_svg || makeCoverSvg(s.title, s.artist),
        is_local:    true,
        _needsReimport: true,
      })),
    }));
    const str = JSON.stringify(lsSafe);
    if (str.length < 4 * 1024 * 1024) localStorage.setItem('novasound_local_playlists', str);
  } catch (_) {}
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
  const svgCover = makeCoverSvg(title, artist);
  const timestamp = Date.now(); // Pour suivre l'âge du blob
  
  return {
    id:            'local::' + file.name + '::' + file.size + '::' + timestamp,
    title, artist,
    album:         tags.album || '',
    audio_url:     url,
    cover_url:     tags.cover || svgCover,
    cover_svg:     svgCover,
    is_local:      true,
    _file:         file,
    _blobUrl:      url,
    _hasBlobCover: !!tags.cover,
    _coverBlobUrl: tags.cover || null,
    _fileHandle:   fileHandle || null,
    _blobTimestamp: timestamp, // Pour vérifier l'âge du blob
    _blobMaxAge:   24 * 60 * 60 * 1000, // 24 heures max pour les blobs
  };
};

const fmtTime = (s) => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

// ── SeekBar draggable ─────────────────────────────────────────────────────
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

  const pct = dragging ? dragPct : (duration > 0 ? currentTime / duration : 0);

  return (
    <div className="w-full select-none px-1">
      <div
        ref={trackRef}
        className="relative w-full rounded-full cursor-pointer"
        style={{ height: 20, display: 'flex', alignItems: 'center' }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
        onTouchStart={(e) => { e.preventDefault(); startDrag(e.touches[0].clientX); }}
        onClick={(e) => { if (!dragging && onSeek && duration > 0) onSeek(getPct(e.clientX) * duration); }}
      >
        <div className="absolute inset-0 my-auto rounded-full" style={{ height: 6, background: 'rgba(255,255,255,0.12)' }} />
        <div className="absolute left-0 my-auto rounded-full"
          style={{ height: 6, top: '50%', transform: 'translateY(-50%)', width: `${pct * 100}%`, background: `linear-gradient(90deg, ${color}, #a855f7)` }} />
        <div className="absolute"
          style={{
            left: `${pct * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
            width: dragging ? 22 : 16, height: dragging ? 22 : 16,
            borderRadius: '50%', background: 'white',
            boxShadow: `0 0 12px ${color}90, 0 2px 8px rgba(0,0,0,0.6)`,
            transition: dragging ? 'none' : 'width 0.15s, height 0.15s',
            cursor: 'grab',
          }}
        />
      </div>
      <div className="flex justify-between text-xs tabular-nums mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
        <span>{fmtTime(pct * (duration || 0))}</span>
        <span>{duration > 0 ? fmtTime(duration) : '--:--'}</span>
      </div>
    </div>
  );
};

// ── SongRow ───────────────────────────────────────────────────────────────
const SongRow = memo(({ song, isActive, isSelected, onPlay, onRemove, selectionMode, onToggleSelect }) => {
  const needsReimport = !!song._needsReimport;
  const cover = song.cover_svg || song.cover_url;
  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all group cursor-pointer ${
        needsReimport ? 'opacity-50 border border-amber-500/15 bg-amber-500/5' :
        isActive ? 'bg-white/10 border border-white/10' :
        isSelected ? 'bg-cyan-500/10 border border-cyan-500/20' :
        'hover:bg-white/[0.05] border border-transparent'
      }`}
      onClick={needsReimport ? undefined : (selectionMode ? onToggleSelect : onPlay)}
    >
      {selectionMode ? (
        <div className="w-5 h-5 flex-shrink-0">
          {isSelected ? <CheckSquare className="w-5 h-5 text-cyan-400" /> : <Square className="w-5 h-5 text-gray-600" />}
        </div>
      ) : (
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative">
          <img src={cover} alt={song.title} className="w-full h-full object-cover" />
          {needsReimport && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-amber-400 text-xs">⚠</span>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : needsReimport ? 'text-gray-500' : 'text-gray-300'}`}>{song.title}</p>
        <p className="text-[11px] truncate">
          {needsReimport
            ? <span className="text-amber-500/70">Fichier à recharger</span>
            : <span className="text-gray-500">{song.artist}</span>
          }
        </p>
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
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 rounded-full text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

// ── SavePlaylistModal ─────────────────────────────────────────────────────
const SavePlaylistModal = ({ selectedIds, onSave, onClose }) => {
  const [name, setName] = useState('');
  const count = selectedIds.size;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-bold text-lg mb-1">Sauvegarder la playlist</h3>
        <p className="text-gray-500 text-sm mb-4">{count} son{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}</p>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Nom de la playlist…" autoFocus
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full bg-white/[0.07] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-semibold hover:bg-white/10 transition-all">
            Annuler
          </button>
          <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
            <Save className="w-3.5 h-3.5 inline mr-1.5" />Sauvegarder
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── PlaylistCard ──────────────────────────────────────────────────────────
const PlaylistCard = ({ pl, onLoad, onDelete, onReimport, liveSongs }) => {
  const needsReimport = pl.songs.some(s => {
    const live = liveSongs.find(ls => ls.id === s.id);
    return s._needsReimport && !(live && !live._needsReimport);
  });
  const covers = pl.songs.slice(0, 4).map(s => s.cover_svg || s.cover_url || makeCoverSvg(s.title, s.artist));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-cyan-500/20 transition-all">
      {/* Cover grid */}
      <div className="relative h-24 overflow-hidden cursor-pointer" onClick={() => onLoad(pl)}>
        {covers.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-900/40 to-purple-900/40">
            <ListMusic className="w-8 h-8 text-gray-600" />
          </div>
        ) : covers.length === 1 ? (
          <img src={covers[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
            {Array.from({ length: 4 }).map((_, i) => (
              covers[i]
                ? <img key={i} src={covers[i]} alt="" className="w-full h-full object-cover" />
                : <div key={i} className="w-full h-full bg-gray-900" />
            ))}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
          <span className="text-white text-xs font-bold truncate">{pl.name}</span>
          <span className="text-gray-400 text-[10px] flex-shrink-0 ml-1">{pl.songs.length} son{pl.songs.length > 1 ? 's' : ''}</span>
        </div>
        {needsReimport && !FS_ACCESS_SUPPORTED && (
          <div className="absolute top-2 right-2 bg-amber-500/90 rounded-full p-1">
            <AlertTriangle className="w-3 h-3 text-black" />
          </div>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button onClick={() => onLoad(pl)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
          <Play className="w-3.5 h-3.5" />Écouter
        </button>
        {needsReimport && !FS_ACCESS_SUPPORTED && (
          <button onClick={() => onReimport(pl)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-all"
            title="Recharger les fichiers">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onDelete(pl.id)}
          className="p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
const LocalPlayerPage = () => {
  const inputRef    = useRef(null);
  const reimportRef = useRef(null);

  const {
    playSong, currentSong,
    audioCurrentTime, audioDuration, isPlayingGlobal,
    seekTo, togglePlayPause,
    handleNext, handlePrevious,
    shuffle, toggleShuffle,
    repeat, cycleRepeat,
  } = usePlayer();

  const navigate = useNavigate();
  const [activeSection,  setActiveSection]  = useState('player');
  const [songs,          setSongs]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [added,          setAdded]          = useState(false);
  const [selectionMode,  setSelectionMode]  = useState(false);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [showSaveModal,  setShowSaveModal]  = useState(false);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [volume,         setVolume]         = useState(80);
  const [showVolume,     setShowVolume]     = useState(false);

  // ── Vérification automatique des blobs expirés ───────────────────────────────
  const checkExpiredBlobs = useCallback(async (songsList) => {
    const expiredSongs = [];
    for (const song of songsList) {
      if (song._blobUrl && !song._needsReimport) {
        const isValid = await verifyBlobUrl(song);
        if (!isValid) {
          song._needsReimport = true;
          expiredSongs.push(song);
        }
      }
    }
    return expiredSongs;
  }, [verifyBlobUrl]);

// ── Chargement playlists au montage ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const idbPls = await idbLoadAll();
        if (idbPls.length > 0) { 
          setSavedPlaylists(idbPls); 
          return; 
        }
      } catch (_) {}
      try {
        const ls = JSON.parse(localStorage.getItem('novasound_local_playlists') || '[]');
        if (ls.length) {
          const marked = ls.map(pl => ({
            ...pl,
            songs: pl.songs.map(s => ({ ...s, _needsReimport: true })),
          }));
          setSavedPlaylists(marked);
          marked.forEach(pl => idbSave(pl).catch(() => {}));
        }
      } catch (_) {}
    })();
  }, []);

// ── Vérification périodique des blobs ───────────────────────────────────────
  useEffect(() => {
    if (songs.length === 0) return;
    
    const checkBlobs = async () => {
      const expired = await checkExpiredBlobs(songs);
      if (expired.length > 0) {
        // Mettre à jour la liste des chansons
        setSongs(prev => [...prev]);
        // Notifier l'utilisateur
        console.warn(`[LocalPlayer] ${expired.length} fichier(s) audio expiré(s), réimportation requise`);
      }
    };
    
    // Vérifier au montage
    checkBlobs();
    
    // Vérifier toutes les 5 minutes
    const interval = setInterval(checkBlobs, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [songs.length, checkExpiredBlobs]);

  // ── Révocation blobs au unmount ───────────────────────────────────────────
  useEffect(() => () => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = document.querySelector('audio');
    if (audio) audio.volume = volume / 100;
  }, [volume]);

  // ── Ouverture fichiers (FSA ou input classique) ───────────────────────────
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
        const batch = handles.slice(i, i + 4);
        const res = await Promise.all(batch.map(async h => {
          try { const f = await h.getFile(); return isAudioFile(f) ? fileToSong(f, h) : null; } catch { return null; }
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
    if (!files.length) { alert('Aucun fichier audio sélectionné. Formats supportés : MP3, M4A, WAV, FLAC, AAC, OGG, OPUS…'); return; }
    setLoading(true);
    const newSongs = [];
    for (let i = 0; i < files.length; i += 4) {
      const batch = files.slice(i, i + 4);
      const res = await Promise.all(batch.map(f => fileToSong(f).catch(() => null)));
      newSongs.push(...res.filter(Boolean));
    }
    if (!newSongs.length) { setLoading(false); return; }
    setSongs(prev => {
      const merged = [...prev, ...newSongs.filter(ns => !prev.find(p => p.id === ns.id))];
      if (prev.length === 0) setTimeout(() => playSong(newSongs[0], newSongs), 50);
      return merged;
    });
    setLoading(false);
    e.target.value = '';
    setAdded(true); setTimeout(() => setAdded(false), 2000);
  }, [playSong]);

  const onReimportFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(isAudioFile);
    if (!files.length) return;
    setLoading(true);
    const newSongs = [];
    for (let i = 0; i < files.length; i += 4) {
      const res = await Promise.all(files.slice(i, i + 4).map(f => fileToSong(f).catch(() => null)));
      newSongs.push(...res.filter(Boolean));
    }
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
    setLoading(false);
    e.target.value = '';
  }, [playSong]);

  const verifyBlobUrl = useCallback((song) => {
  if (song._blobUrl) {
    // Vérifier l'âge du blob d'abord
    const age = Date.now() - (song._blobTimestamp || 0);
    const maxAge = song._blobMaxAge || (24 * 60 * 60 * 1000); // 24h par défaut
    
    if (age > maxAge) {
      return Promise.resolve(false); // Blob trop ancien
    }
    
    // Vérifier si le blob est toujours accessible
    return fetch(song._blobUrl, { method: 'HEAD' })
      .then(res => res.ok)
      .catch(() => false);
  }
  return Promise.resolve(false);
}, []);

const playFromQueue   = useCallback(async (idx) => {
  const song = songs[idx];
  if (song._needsReimport) {
    // Demander réimportation
    alert('Ce fichier nécessite une réimportation pour être lu');
    setTimeout(() => reimportRef.current?.click(), 300);
    return;
  }
  
  // Vérifier si le blob URL est valide
  if (song._blobUrl) {
    const isValid = await verifyBlobUrl(song);
    if (!isValid) {
      song._needsReimport = true;
      alert('Le fichier audio n\'est plus disponible. Veuillez réimporter.');
      setTimeout(() => reimportRef.current?.click(), 300);
      return;
    }
  }
  
  playSong(song, songs);
}, [songs, playSong, verifyBlobUrl]);
  const removeFromQueue = useCallback((idx) => {
    setSongs(prev => {
      const s = prev[idx];
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const clearAll = useCallback(() => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl);      } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
    setSongs([]); setSelectedIds(new Set()); setSelectionMode(false);
    if (currentSong?.is_local) window.dispatchEvent(new CustomEvent('novasound:close-player'));
  }, [songs, currentSong]);

  const selectAll    = useCallback(() => setSelectedIds(new Set(songs.map(s => s.id))), [songs]);
  const deselectAll  = useCallback(() => setSelectedIds(new Set()), []);
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const savePlaylist = (name) => {
    const selected = songs.filter(s => selectedIds.has(s.id));
    const safeSongs = selected.map(s => ({
      id:         s.id, title: s.title, artist: s.artist, album: s.album || '',
      cover_url:  s.cover_svg || makeCoverSvg(s.title, s.artist),
      cover_svg:  s.cover_svg || makeCoverSvg(s.title, s.artist),
      is_local:   true,
      _needsReimport: !s._fileHandle,
      _fileHandle: s._fileHandle || null,
    }));
    const pl = { id: Date.now(), name, songs: safeSongs, createdAt: new Date().toISOString() };
    const updated = [...savedPlaylists, pl];
    setSavedPlaylists(updated);
    savePlaylistsEverywhere(updated);
    setShowSaveModal(false); setSelectionMode(false); setSelectedIds(new Set());
    setActiveSection('playlists');
  };

  const loadPlaylist = async (pl) => {
    setLoading(true);
    try {
      const resolved = pl.songs.map(saved => {
        const live = songs.find(ls => ls.id === saved.id && !ls._needsReimport);
        return live || saved;
      });
      setSongs(prev => {
        const merged = [...prev];
        resolved.forEach(saved => {
          if (!merged.find(p => p.id === saved.id)) merged.push(saved);
          else {
            const idx = merged.findIndex(p => p.id === saved.id);
            if (idx >= 0 && merged[idx]._needsReimport && !saved._needsReimport) merged[idx] = saved;
          }
        });
        const playable = resolved.filter(s => !s._needsReimport);
        if (playable.length > 0) setTimeout(() => playSong(playable[0], playable), 100);
        return merged;
      });
      if (resolved.every(s => s._needsReimport)) {
        setTimeout(() => reimportRef.current?.click(), 300);
      }
    } catch (e) { console.warn('[LocalPlayer] loadPlaylist:', e); }
    setLoading(false);
    setActiveSection('player');
  };

  const deletePlaylist = (id) => {
    const updated = savedPlaylists.filter(p => p.id !== id);
    setSavedPlaylists(updated);
    idbDelete(id).catch(() => {});
    savePlaylistsEverywhere(updated);
  };

  const activeIdx      = songs.findIndex(s => s.id === currentSong?.id);
  const isLocalPlaying = !!currentSong?.is_local;
  const activeSong     = isLocalPlaying ? currentSong : (songs.length > 0 ? songs[0] : null);
  const duration       = isLocalPlaying ? (audioDuration    || 0) : 0;
  const ct             = isLocalPlaying ? (audioCurrentTime || 0) : 0;
  const VolumeIcon     = volume === 0 ? VolumeX : Volume2;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!songs.length) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#050510]/95 backdrop-blur-md border-b border-white/[0.06]"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.07] text-gray-400 hover:text-white transition-all flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-none">Lecteur Local</p>
            <p className="text-gray-600 text-[10px] mt-0.5">100% hors-ligne</p>
          </div>
          <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center">
            <Home className="w-4 h-4" />
          </Link>
        </div>

        <input ref={inputRef}    type="file" accept="*/*" multiple onChange={onFiles}        className="hidden" />
        <input ref={reimportRef} type="file" accept="*/*" multiple onChange={onReimportFiles} className="hidden" />

        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
            className="w-full max-w-sm flex flex-col items-center gap-7 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
              {loading
                ? <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <HardDrive className="w-10 h-10 text-white" />}
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <WifiOff className="w-4 h-4 text-cyan-400" />
                <h1 className="text-white text-2xl font-black">Lecteur Local</h1>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">Lis tes fichiers audio directement depuis ton appareil — sans connexion internet.</p>
            </div>

            <motion.button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : () => inputRef.current?.click()}
              whileTap={{ scale:0.95 }} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white font-bold disabled:opacity-60"
              style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
              <FolderOpen className="w-5 h-5" />
              {loading ? 'Chargement…' : FS_ACCESS_SUPPORTED ? 'Ouvrir (fichiers persistants)' : "Ouvrir depuis l'appareil"}
            </motion.button>

            {savedPlaylists.length > 0 && (
              <div className="w-full">
                <p className="text-gray-600 text-xs mb-3 text-left font-semibold uppercase tracking-wider">Playlists sauvegardées ({savedPlaylists.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {savedPlaylists.map(pl => (
                    <button key={pl.id} onClick={() => loadPlaylist(pl)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] transition-all text-left">
                      <Folder className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{pl.name}</p>
                        <p className="text-gray-600 text-[10px]">{pl.songs.length} sons</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 w-full text-left">
              <p className="text-amber-300 text-xs font-semibold mb-1">💡 Si tes MP3 ne sont pas visibles</p>
              <p className="text-amber-200/70 text-xs leading-relaxed">Tous les fichiers sont affichés. Sélectionne depuis n'importe quel dossier (Xender, WhatsApp, SD card…).</p>
            </div>
            <p className="text-gray-600 text-[11px]">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS · WMA</p>
            <div className="w-full grid grid-cols-3 gap-2">
              {[{ icon:WifiOff, c:'#22d3ee', l:'100% offline'}, { icon:HardDrive, c:'#4ade80', l:'Tous appareils'}, { icon:Sliders, c:'#a855f7', l:'Seek + volume'}].map(({icon:Icon,c,l}) => (
                <div key={l} className="flex flex-col items-center gap-2 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                  <Icon className="w-4 h-4" style={{color:c}} />
                  <span className="text-[10px] text-gray-500 text-center">{l}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#050510] flex flex-col">
      {/* Nav */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#050510]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/[0.07] text-gray-400 hover:text-white transition-all flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-none">Lecteur Local</p>
          <p className="text-gray-600 text-[10px] mt-0.5">100% hors-ligne</p>
        </div>
        <button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : () => inputRef.current?.click()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.07] text-gray-300 hover:text-white transition-all disabled:opacity-50">
          {loading ? <div className="w-3.5 h-3.5 rounded-full border border-gray-500 border-t-cyan-400 animate-spin" /> : <><Plus className="w-3.5 h-3.5" />Ajouter</>}
        </button>
        <Link to="/" className="w-9 h-9 rounded-xl bg-white/[0.07] hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex items-center justify-center">
          <Home className="w-4 h-4" />
        </Link>
      </div>

      {/* Tabs */}
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
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeSection === key ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-gray-600'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <input ref={inputRef}    type="file" accept="*/*" multiple onChange={onFiles}        className="hidden" />
      <input ref={reimportRef} type="file" accept="*/*" multiple onChange={onReimportFiles} className="hidden" />

      <div className="flex-1 max-w-xl mx-auto w-full px-4 pt-4 pb-8 flex flex-col gap-4">

        {/* ══ ONGLET LECTEUR ══════════════════════════════════════════════ */}
        {activeSection === 'player' && (
          <div className="flex flex-col gap-4">
            {activeSong && (
              <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                className="rounded-2xl overflow-hidden border border-cyan-500/20"
                style={{ background:'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(124,58,237,0.06))' }}>
                {/* Info */}
                <div className="flex items-center gap-4 p-4 pb-3">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-xl"
                    style={{ boxShadow:'0 0 30px rgba(6,182,212,0.25)' }}>
                    <img src={activeSong.cover_svg || activeSong.cover_url} alt={activeSong.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-base truncate leading-tight">{activeSong.title}</p>
                    <p className="text-cyan-400/80 text-sm truncate mt-0.5">{activeSong.artist}</p>
                    {activeSong.album && <p className="text-gray-600 text-xs truncate mt-0.5">{activeSong.album}</p>}
                    {!isLocalPlaying && <p className="text-gray-600 text-xs mt-1 italic">Appuie sur ▶ pour démarrer</p>}
                  </div>
                </div>

                {/* Seek */}
                <div className="px-4 pb-1">
                  <SeekBar currentTime={ct} duration={duration} onSeek={seekTo} color="#22d3ee" />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between px-6 pb-4 pt-1">
                  <button onClick={toggleShuffle}
                    className={`p-2 rounded-full transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}>
                    <Shuffle className="w-4 h-4" />
                  </button>

                  {/* PREV — corrigé: ne fait plus de toggle-play */}
                  <motion.button whileTap={{ scale:0.88 }}
                    onClick={() => handlePrevious?.()}
                    className="p-2 text-gray-300 hover:text-white transition-colors">
                    <SkipBack className="w-7 h-7 fill-current" />
                  </motion.button>

                  {/* Play/Pause */}
                  <motion.button whileTap={{ scale:0.9 }}
                    onClick={() => {
                      if (activeSong && currentSong?.id === activeSong.id && isPlayingGlobal) {
                        // Pause si la chanson actuelle joue déjà
                        togglePlayPause();
                      } else if (activeSong) {
                        // Jouer la chanson active
                        playSong(activeSong, songs);
                      } else {
                        // Démarrer avec le premier fichier jouable
                        const firstPlayable = songs.find(s => !s._needsReimport && s._blobUrl);
                        if (firstPlayable) {
                          playSong(firstPlayable, songs);
                        } else if (songs.length > 0) {
                          // Vérifier si les fichiers nécessitent une réimportation
                          const needsReimport = songs.some(s => s._needsReimport);
                          if (needsReimport) {
                            // Afficher notification pour réimporter
                            alert('Veuillez réimporter les fichiers pour continuer l\'écoute');
                            setTimeout(() => reimportRef.current?.click(), 300);
                          } else {
                            // Démarrer avec le premier fichier disponible
                            playSong(songs[0], songs);
                          }
                        }
                      }
                    }}
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                    style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)', boxShadow:'0 0 40px rgba(6,182,212,0.4)' }}>
                    {isPlayingGlobal
                      ? <Pause className="w-8 h-8 text-white fill-current" />
                      : <Play  className="w-8 h-8 text-white fill-current ml-0.5" />}
                  </motion.button>

                  <motion.button whileTap={{ scale:0.88 }}
                    onClick={() => handleNext?.()}
                    className="p-2 text-gray-300 hover:text-white transition-colors">
                    <SkipForward className="w-7 h-7 fill-current" />
                  </motion.button>

                  <button onClick={cycleRepeat}
                    className={`p-2 rounded-full transition-all relative ${repeat!=='off'?'text-cyan-400':'text-gray-600 hover:text-gray-400'}`}>
                    <Repeat className="w-4 h-4" />
                    {repeat==='one' && <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-cyan-500 text-black font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
                  </button>
                </div>

                {/* Volume */}
                <div className="px-5 pb-4">
                  <button onClick={() => setShowVolume(v => !v)}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2">
                    <VolumeIcon className="w-3.5 h-3.5" />
                    <span>Volume — {volume}%</span>
                    {showVolume ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {showVolume && (
                      <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} className="overflow-hidden">
                        <input type="range" min={0} max={100} step={1} value={volume}
                          onChange={e => setVolume(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor:'#22d3ee' }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setSelectionMode(v => !v); if (selectionMode) setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${selectionMode ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/30' : 'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
                <CheckSquare className="w-3 h-3" /> Sélection
              </button>
              <button onClick={clearAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-white/[0.06] text-gray-500 hover:text-red-400 border border-white/[0.08] transition-all">
                <Trash2 className="w-3 h-3" /> Vider
              </button>
            </div>

            {/* Selection bar */}
            <AnimatePresence>
              {selectionMode && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400 text-xs font-bold">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
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

            {/* Mini liste */}
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

        {/* ══ ONGLET PLAYLISTS ══════════════════════════════════════════════ */}
        {activeSection === 'playlists' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-fuchsia-400" />
                <span className="text-white font-black text-base">Mes Playlists</span>
                {savedPlaylists.length > 0 && (
                  <span className="text-[10px] bg-fuchsia-500/15 text-fuchsia-400 px-2 py-0.5 rounded-full font-bold">{savedPlaylists.length}</span>
                )}
              </div>
              {songs.length > 0 && (
                <button onClick={() => { setSelectionMode(true); setActiveSection('player'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                  style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
                  <Plus className="w-3 h-3" /> Nouvelle
                </button>
              )}
            </div>

            {savedPlaylists.length === 0 ? (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                className="flex flex-col items-center gap-5 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.05]">
                  <Folder className="w-8 h-8 text-gray-600" />
                </div>
                <div>
                  <p className="text-gray-400 font-semibold text-sm">Aucune playlist sauvegardée</p>
                  <p className="text-gray-600 text-xs mt-1">Charge des fichiers, sélectionne des sons et crée une playlist !</p>
                </div>
                <motion.button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : () => inputRef.current?.click()}
                  whileTap={{ scale:0.95 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold"
                  style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
                  <FolderOpen className="w-4 h-4" />
                  {songs.length === 0 ? "Ouvrir des fichiers" : "Sélectionner des sons"}
                </motion.button>
              </motion.div>
            ) : (
              <>
                {/* Avertissement mobile */}
                {!FS_ACCESS_SUPPORTED && savedPlaylists.some(pl => pl.songs.some(s => s._needsReimport)) && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-300 text-xs font-semibold mb-1">Fichiers à recharger sur mobile</p>
                        <p className="text-amber-200/70 text-xs leading-relaxed">
                          Les titres, artistes et noms de playlists sont sauvegardés. Appuie sur <strong>🔄</strong> pour recharger les fichiers audio depuis ton appareil.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grille */}
                <div className="grid grid-cols-2 gap-3">
                  {savedPlaylists.map(pl => (
                    <PlaylistCard
                      key={pl.id} pl={pl}
                      onLoad={loadPlaylist}
                      onDelete={deletePlaylist}
                      onReimport={(p) => { reimportRef.current?.click(); }}
                      liveSongs={songs}
                    />
                  ))}
                </div>

                {songs.length > 0 && (
                  <button onClick={() => { setSelectionMode(true); setActiveSection('player'); }}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/[0.12] text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all text-sm font-semibold">
                    <Plus className="w-4 h-4" />
                    Créer une nouvelle playlist
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ ONGLET FICHIERS ══════════════════════════════════════════════ */}
        {activeSection === 'files' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-cyan-400" />
                <span className="text-white font-black text-base">Fichiers</span>
                <span className="text-[10px] bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded-full font-bold">{songs.length}</span>
              </div>
              <button onClick={FS_ACCESS_SUPPORTED ? openPickerFSA : () => inputRef.current?.click()} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.07] text-gray-300 hover:text-white transition-all">
                <FolderOpen className="w-3.5 h-3.5" />Ajouter
              </button>
            </div>

            {/* Sélection */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setSelectionMode(v => !v); if (selectionMode) setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${selectionMode ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/30' : 'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
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
            <button onClick={clearAll}
              className="text-xs text-gray-700 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 py-2">
              <Trash2 className="w-3.5 h-3.5" /> Vider tous les fichiers
            </button>
          </div>
        )}
      </div>

      {/* Save modal */}
      <AnimatePresence>
        {showSaveModal && (
          <SavePlaylistModal
            selectedIds={selectedIds}
            onSave={savePlaylist}
            onClose={() => setShowSaveModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LocalPlayerPage;
