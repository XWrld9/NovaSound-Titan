/**
 * LocalPlayerPageMobile — NovaSound TITAN LUX VFINAL
 *
 * Refonte complète :
 * ✅ Carte "Now Playing" intégrée en haut (cover, titre, artiste, contrôles, seek bar)
 * ✅ Contrôles play/pause/prev/next/shuffle/repeat directement dans la page
 * ✅ Seek bar tactile fluide
 * ✅ Parser ID3 pour métadonnées + cover embarquée
 * ✅ Durée chargée via <audio> silencieux en arrière-plan
 * ✅ Onglets Bibliothèque / Playlists / File d'attente
 * ✅ Mode sélection → créer playlist → persistance IndexedDB
 * ✅ Recherche + tri (nom, artiste, durée, date)
 * ✅ Drag & Drop fichiers
 * ✅ Appui long sur un morceau → ajout en file
 * ✅ Mini player global masqué sur cette page (LocalPlayer gère ses propres contrôles)
 * ✅ Blob URLs révoqués proprement à la suppression
 * ✅ Modal nom de playlist (plus de prompt natif)
 * ✅ onPointerDown sur tous les boutons → fonctionne sur mobile
 */

import React, { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FolderOpen, ListMusic, Trash2, Plus,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Save, CheckSquare, Square, Folder,
  Search, X, ArrowLeft, Music2,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';

const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = (f) =>
  AUDIO_EXTS.test(f.name) || f.type.startsWith('audio/') || f.type === 'video/mp4';

// ── Cover SVG fallback ─────────────────────────────────────────
const makeCoverSvg = (title = '', artist = '') => {
  const letter = (title[0] || artist[0] || '♪').toUpperCase();
  const hue = [...(title + artist)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue},65%,28%)"/>
      <stop offset="100%" style="stop-color:hsl(${(hue+60)%360},65%,46%)"/>
    </linearGradient></defs>
    <rect width="256" height="256" fill="url(#g)"/>
    <text x="128" y="160" font-family="Arial,sans-serif" font-size="108" font-weight="bold"
      fill="rgba(255,255,255,0.88)" text-anchor="middle">${letter}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

// ── ID3v2 parser ───────────────────────────────────────────────
const parseID3 = async (file) => {
  const meta = { title: '', artist: '', album: '', cover: null };
  try {
    const bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return meta;
    const ss = (b, o) =>
      ((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f);
    let pos = 10; const end = ss(bytes, 6) + 10;
    const dec = new TextDecoder('utf-8', { fatal: false });
    while (pos < end - 10 && pos < bytes.length - 10) {
      const fid = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      const fsz = (bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
      if (fsz <= 0 || fsz > 300000) break;
      const data = bytes.slice(pos+10, pos+10+fsz);
      const txt  = data[0]===0 ? dec.decode(data.slice(1))
                                : new TextDecoder('utf-16le',{fatal:false}).decode(data.slice(3));
      if      (fid==='TIT2') meta.title  = txt.replace(/\0/g,'').trim();
      else if (fid==='TPE1') meta.artist = txt.replace(/\0/g,'').trim();
      else if (fid==='TALB') meta.album  = txt.replace(/\0/g,'').trim();
      else if (fid==='APIC' && !meta.cover) {
        let me=1; while(me<data.length&&data[me]!==0)me++;
        const mime = dec.decode(data.slice(1,me)) || 'image/jpeg';
        let i=me+2; while(i<data.length&&data[i]!==0)i++; i++;
        try { meta.cover = URL.createObjectURL(new Blob([data.slice(i)], { type: mime })); } catch(_){}
      }
      pos += 10+fsz;
    }
  } catch (_) {}
  return meta;
};

const getAudioDuration = (url) => new Promise(res => {
  const a = document.createElement('audio');
  a.preload = 'metadata';
  a.onloadedmetadata = () => { res(isFinite(a.duration) ? a.duration : 0); a.src = ''; };
  a.onerror = () => res(0);
  a.src = url;
});

// ── IndexedDB ──────────────────────────────────────────────────
const IDB_NAME = 'novasound_local_v2';
const IDB_STORE = 'playlists';
const openIDB = () => new Promise((res, rej) => {
  const r = indexedDB.open(IDB_NAME, 2);
  r.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(IDB_STORE))
      db.createObjectStore(IDB_STORE, { keyPath: 'id' });
    if (!db.objectStoreNames.contains('file_handles'))
      db.createObjectStore('file_handles', { keyPath: 'songId' });
  };
  r.onsuccess = e => res(e.target.result);
  r.onerror   = () => rej(r.error);
});
const idbSave   = pl => openIDB().then(db => new Promise(res => {
  const req = db.transaction([IDB_STORE],'readwrite').objectStore(IDB_STORE).put(pl);
  req.onsuccess = ()=>res(true); req.onerror = ()=>res(false);
})).catch(()=>false);
const idbLoad   = () => openIDB().then(db => new Promise(res => {
  const req = db.transaction([IDB_STORE],'readonly').objectStore(IDB_STORE).getAll();
  req.onsuccess = ()=>res(req.result||[]); req.onerror = ()=>res([]);
})).catch(()=>[]);
const idbDelete = id => openIDB().then(db => new Promise(res => {
  const req = db.transaction([IDB_STORE],'readwrite').objectStore(IDB_STORE).delete(id);
  req.onsuccess = ()=>res(true); req.onerror = ()=>res(false);
})).catch(()=>false);

const fmtDur = s => {
  if (!s || !isFinite(s) || s <= 0) return '--:--';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
};

// ── Barres EQ animées ──────────────────────────────────────────
const EqBars = () => (
  <div className="flex items-end gap-px h-4 w-4">
    {[0,1,2].map(i => (
      <motion.div key={i} className="w-1 rounded-full bg-cyan-400"
        animate={{ height: ['55%','100%','40%','80%','55%'] }}
        transition={{ duration:1.2, repeat:Infinity, delay:i*0.18, ease:'easeInOut' }}
        style={{ minHeight:2 }}
      />
    ))}
  </div>
);

// ── Now Playing Card ───────────────────────────────────────────
const NowPlayingCard = memo(({ song, isPlaying, currentTime, duration,
  onTogglePlay, onPrev, onNext, onSeek, repeat, onCycleRepeat, shuffle, onToggleShuffle
}) => {
  if (!song) return null;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const cover = song.coverUrl || song.cover_url || makeCoverSvg(song.title, song.artist || '');

  const handleSeekTouch = useCallback(e => {
    e.stopPropagation();
    const touch = e.touches?.[0] || e.changedTouches?.[0] || e;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  return (
    <motion.div
      initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
      className="mx-4 mt-3 mb-1 rounded-2xl overflow-hidden border border-white/[0.07]"
      style={{
        background:'linear-gradient(135deg,rgba(6,182,212,0.10) 0%,rgba(168,85,247,0.09) 100%)',
        backdropFilter:'blur(16px)',
      }}
    >
      {/* Info + contrôles secondaires */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-1.5">
        {/* Cover */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <motion.img
            src={cover} alt={song.title}
            className="w-14 h-14 rounded-xl object-cover shadow-lg"
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={isPlaying
              ? { repeat:Infinity, duration:12, ease:'linear' }
              : { duration:0.4 }}
          />
          {isPlaying && (
            <div className="absolute inset-0 rounded-xl ring-2 ring-cyan-400/35 animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Titre / artiste */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{song.title || 'Titre inconnu'}</p>
          <p className="text-gray-400 text-xs truncate mt-0.5">{song.artist || 'Artiste inconnu'}</p>
          {song.album && <p className="text-gray-600 text-[10px] truncate mt-0.5">{song.album}</p>}
        </div>

        {/* Shuffle + Repeat */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <button type="button" onClick={onToggleShuffle}
            className={`p-1.5 rounded-lg transition-colors ${shuffle ? 'text-cyan-400 bg-cyan-500/15' : 'text-gray-600'}`}>
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onCycleRepeat}
            className={`p-1.5 rounded-lg transition-colors relative ${repeat !== 'off' ? 'text-cyan-400 bg-cyan-500/15' : 'text-gray-600'}`}>
            <Repeat className="w-3.5 h-3.5" />
            {repeat === 'one' && (
              <span className="absolute -top-0.5 -right-0.5 text-[7px] font-black bg-cyan-400 text-gray-950 rounded-full w-3 h-3 flex items-center justify-center leading-none">1</span>
            )}
          </button>
        </div>
      </div>

      {/* Seek bar */}
      <div className="px-3 pb-1">
        <div className="relative h-7 flex items-center cursor-pointer group"
          onClick={handleSeekTouch}
          onTouchStart={handleSeekTouch}
          onTouchMove={handleSeekTouch}
        >
          <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-visible group-active:h-2 transition-all">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full relative transition-all duration-75"
              style={{ width:`${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-active:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 -mt-0.5 px-0.5">
          <span>{fmtDur(currentTime)}</span>
          <span>{fmtDur(duration)}</span>
        </div>
      </div>

      {/* Contrôles principaux */}
      <div className="flex items-center justify-center gap-5 px-4 pb-3 pt-1">
        <motion.button type="button" whileTap={{ scale:0.87 }} onClick={onPrev}
          className="w-10 h-10 flex items-center justify-center text-gray-300">
          <SkipBack className="w-5 h-5" />
        </motion.button>

        <motion.button type="button" whileTap={{ scale:0.91 }} onClick={onTogglePlay}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
          style={{ background:'linear-gradient(135deg,#06b6d4,#a855f7)', boxShadow:'0 4px 20px rgba(6,182,212,0.45)' }}
        >
          {isPlaying
            ? <Pause className="w-6 h-6 text-white" />
            : <Play className="w-6 h-6 text-white ml-0.5" />
          }
        </motion.button>

        <motion.button type="button" whileTap={{ scale:0.87 }} onClick={onNext}
          className="w-10 h-10 flex items-center justify-center text-gray-300">
          <SkipForward className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
});
NowPlayingCard.displayName = 'NowPlayingCard';

// ── SongItem ───────────────────────────────────────────────────
const SongItem = memo(({ song, isActive, isPlaying, selectionMode, isSelected,
  onSelect, onPlay, onRemove, onQueue
}) => {
  const pressTimer = useRef(null);

  const handlePressStart = useCallback(() => {
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      onQueue?.(song);
      navigator.vibrate?.(35);
    }, 600);
  }, [song, onQueue]);

  const handlePressEnd = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, x:-16 }}
      whileTap={{ scale:0.98 }}
      className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer select-none border transition-colors
        ${isActive
          ? 'bg-gradient-to-r from-cyan-500/14 to-purple-500/9 border-cyan-500/22'
          : 'bg-white/[0.025] border-transparent hover:bg-white/[0.05]'}`}
      onClick={() => selectionMode ? onSelect(song.id) : onPlay(song)}
      onMouseDown={handlePressStart} onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart} onTouchEnd={handlePressEnd}
    >
      {isActive && isPlaying && (
        <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-gradient-to-b from-cyan-400 to-purple-500 rounded-full" />
      )}

      {selectionMode && (
        <button type="button"
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onSelect(song.id); }}
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
            ${isSelected ? 'bg-cyan-500 text-white' : 'bg-white/10 text-gray-500'}`}>
          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      )}

      <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
        <img src={song.coverUrl || makeCoverSvg(song.title, song.artist)}
          alt="" className="w-full h-full object-cover" loading="lazy" />
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            {isPlaying ? <EqBars /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${isActive ? 'text-cyan-400' : 'text-white'}`}>
          {song.title}
        </p>
        <p className="text-gray-500 text-xs truncate">{song.artist}</p>
        {song.duration > 0 && (
          <p className="text-gray-700 text-[10px] mt-0.5 font-mono">{fmtDur(song.duration)}</p>
        )}
      </div>

      {!selectionMode && (
        <button type="button"
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onRemove(song); }}
          className="p-2 text-gray-700 hover:text-red-400 transition-colors rounded-lg flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
});
SongItem.displayName = 'SongItem';

// ── PlaylistCard ───────────────────────────────────────────────
const PlaylistCard = memo(({ playlist, onPlay, onDelete }) => {
  const covers = playlist.songs?.slice(0,4).map(s=>s.coverUrl||null).filter(Boolean) ?? [];
  return (
    <motion.div
      layout initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }}
      exit={{ opacity:0, scale:0.88 }} whileTap={{ scale:0.97 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 cursor-pointer"
      onClick={() => onPlay(playlist)}
    >
      <div className={`w-14 h-14 rounded-xl overflow-hidden mb-3 shadow-md ${covers.length >= 4 ? 'grid grid-cols-2 gap-px' : ''}`}>
        {covers.length >= 4
          ? covers.slice(0,4).map((src,i) => <img key={i} src={src} alt="" className="w-full h-full object-cover" />)
          : covers[0]
            ? <img src={covers[0]} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-cyan-700/50 to-purple-800/50 flex items-center justify-center">
                <Folder className="w-6 h-6 text-white/50" />
              </div>
        }
      </div>
      <p className="text-white font-bold text-sm truncate">{playlist.name}</p>
      <p className="text-gray-500 text-xs mt-0.5">{playlist.songs?.length ?? 0} morceau{(playlist.songs?.length??0)!==1?'x':''}</p>
      <div className="flex items-center gap-2 mt-3">
        <button type="button"
          onPointerDown={e=>{ e.stopPropagation(); e.preventDefault(); onPlay(playlist); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-all">
          <Play className="w-3 h-3" /> Lire
        </button>
        <button type="button"
          onPointerDown={e=>{ e.stopPropagation(); e.preventDefault(); onDelete(playlist.id); }}
          className="p-2 bg-white/5 hover:bg-red-500/15 text-gray-500 hover:text-red-400 rounded-xl transition-all active:scale-90">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
});
PlaylistCard.displayName = 'PlaylistCard';

// ── Modal nom de playlist ──────────────────────────────────────
const PlaylistNameModal = memo(({ onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 80); }, []);
  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 pb-10"
      style={{ background:'rgba(0,0,0,0.82)', backdropFilter:'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ y:50, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:50, opacity:0 }}
        transition={{ type:'spring', stiffness:360, damping:28 }}
        className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-3xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-white font-bold text-lg mb-4">Nom de la playlist</p>
        <input ref={ref} value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'&&name.trim())onConfirm(name.trim()); if(e.key==='Escape')onCancel(); }}
          placeholder="Ex : Mes favoris…"
          className="w-full px-4 py-3 bg-white/[0.07] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 text-sm mb-4 transition-colors"
        />
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/[0.07] text-gray-400 font-semibold text-sm active:scale-95 transition-all">
            Annuler
          </button>
          <button type="button"
            onPointerDown={e=>{ e.preventDefault(); if(name.trim())onConfirm(name.trim()); }}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all">
            Créer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
PlaylistNameModal.displayName = 'PlaylistNameModal';

// ── Composant principal ────────────────────────────────────────
const LocalPlayerPageMobile = memo(() => {
  const {
    activeSong, isPlaying, playSong, queue, addToQueue,
    togglePlayPause, next: playerNext, previous: playerPrevious,
    shuffle, toggleShuffle, repeat, cycleRepeat, seek,
  } = usePlayer();
  const { audioCurrentTime } = usePlayerTime();

  const [songs, setSongs]                   = useState([]);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [activeTab, setActiveTab]           = useState('library');
  const [selectionMode, setSelectionMode]   = useState(false);
  const [selectedIds, setSelectedIds]       = useState(new Set());
  const [searchQuery, setSearchQuery]       = useState('');
  const [sortBy, setSortBy]                 = useState('name');
  const [sortAsc, setSortAsc]               = useState(true);
  const [isDragging, setIsDragging]         = useState(false);
  const [showPlaylistModal, setShowModal]   = useState(false);
  const [loading, setLoading]               = useState(false);
  const fileInputRef = useRef(null);

  // Durée du morceau actif (depuis la liste locale)
  const activeSongLocal = useMemo(() =>
    songs.find(s => activeSong && (s.id === activeSong.id || s.url === activeSong.audio_url)) || null
  , [songs, activeSong]);

  const currentDuration = activeSongLocal?.duration || 0;

  // Charger playlists
  useEffect(() => { idbLoad().then(setSavedPlaylists); }, []);

  // Charger durées manquantes
  useEffect(() => {
    const pending = songs.filter(s => s.duration === 0 && s.url);
    if (!pending.length) return;
    let alive = true;
    pending.forEach(song => {
      getAudioDuration(song.url).then(dur => {
        if (!alive || dur <= 0) return;
        setSongs(prev => prev.map(s => s.id === song.id ? { ...s, duration: dur } : s));
      });
    });
    return () => { alive = false; };
  }, [songs.length]); // eslint-disable-line

  // Import fichiers
  const handleFiles = useCallback(async (files) => {
    setLoading(true);
    const audioFiles = Array.from(files).filter(isAudioFile);
    if (!audioFiles.length) { setLoading(false); return; }

    const newSongs = await Promise.all(audioFiles.map(async file => {
      const raw    = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const tags   = await parseID3(file);
      const title  = tags.title  || raw;
      const artist = tags.artist || 'Artiste inconnu';
      return {
        id: `${file.name}-${file.size}-${file.lastModified}`,
        title, artist,
        album: tags.album || '',
        duration: 0,
        file,
        url: URL.createObjectURL(file),
        coverUrl: tags.cover || makeCoverSvg(title, artist),
        _hasBlobCover: !!tags.cover,
        addedAt: Date.now(),
        is_local: true,
      };
    }));

    setSongs(prev => {
      const existing = new Set(prev.map(s => s.id));
      const fresh = newSongs.filter(s => !existing.has(s.id));
      if (prev.length === 0 && fresh.length > 0) {
        setTimeout(() => {
          const mapped = fresh.map(x => ({ ...x, audio_url: x.url, cover_url: x.coverUrl }));
          playSong(mapped[0], mapped);
        }, 80);
      }
      return [...prev, ...fresh];
    });
    setLoading(false);
  }, [playSong]);

  const handleDrop      = useCallback(e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);
  const handleDragOver  = useCallback(e => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(e => { e.preventDefault(); setIsDragging(false); }, []);

  const handlePlaySong = useCallback(song => {
    if (!song?.url) return;
    const mapped = songs.map(s => ({ ...s, audio_url: s.url, cover_url: s.coverUrl }));
    playSong({ ...song, audio_url: song.url, cover_url: song.coverUrl }, mapped);
  }, [songs, playSong]);

  const handlePlayAll = useCallback((shuffled = false) => {
    if (!songs.length) return;
    const mapped = songs.map(s => ({ ...s, audio_url: s.url, cover_url: s.coverUrl }));
    const list = shuffled ? [...mapped].sort(() => Math.random() - 0.5) : mapped;
    playSong(list[0], list);
  }, [songs, playSong]);

  const handleRemoveSong = useCallback(song => {
    setSongs(prev => {
      const next = prev.filter(s => s.id !== song.id);
      if (song._hasBlobCover && song.coverUrl?.startsWith('blob:')) try { URL.revokeObjectURL(song.coverUrl); } catch(_){}
      if (song.url?.startsWith('blob:')) try { URL.revokeObjectURL(song.url); } catch(_){}
      return next;
    });
  }, []);

  const handleSelectSong = useCallback(id => {
    setSelectedIds(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  }, []);

  const handleQueueSong = useCallback(song => {
    if (!song?.url) return;
    addToQueue({ ...song, audio_url: song.url, cover_url: song.coverUrl });
  }, [addToQueue]);

  const handleCreatePlaylist = useCallback(async name => {
    setShowModal(false);
    if (!name || selectedIds.size === 0) return;
    const pl = { id:`pl-${Date.now()}`, name, songs: songs.filter(s => selectedIds.has(s.id)), createdAt: Date.now() };
    if (await idbSave(pl)) { setSavedPlaylists(prev => [...prev, pl]); setSelectionMode(false); setSelectedIds(new Set()); }
  }, [selectedIds, songs]);

  const handleDeletePlaylist = useCallback(async id => {
    if (await idbDelete(id)) setSavedPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleSelectPlaylist = useCallback(playlist => {
    if (!playlist?.songs?.length) return;
    const pSongs = playlist.songs.map(s => ({ ...s, url: s.url || s.audio_url, coverUrl: s.coverUrl || s.cover_url }));
    setSongs(prev => { const ex = new Set(prev.map(s=>s.id)); return [...prev, ...pSongs.filter(s=>!ex.has(s.id))]; });
    setActiveTab('library');
    if (pSongs[0]) setTimeout(() => handlePlaySong(pSongs[0]), 80);
  }, [handlePlaySong]);

  const filteredSongs = useMemo(() => {
    let list = searchQuery
      ? songs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.artist.toLowerCase().includes(searchQuery.toLowerCase()))
      : [...songs];
    list.sort((a,b) => {
      const cmp = sortBy==='name' ? a.title.localeCompare(b.title)
                : sortBy==='artist' ? a.artist.localeCompare(b.artist)
                : sortBy==='duration' ? (a.duration||0)-(b.duration||0)
                : (a.addedAt||0)-(b.addedAt||0);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [songs, searchQuery, sortBy, sortAsc]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <motion.header initial={{ y:-20, opacity:0 }} animate={{ y:0, opacity:1 }}
        className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-xl border-b border-white/[0.05] px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link to="/" className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl active:scale-90">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="text-center">
            <h1 className="text-base font-bold text-white">Lecteur Local</h1>
            <p className="text-[10px] text-gray-500">{songs.length} morceau{songs.length!==1?'x':''}</p>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-cyan-400 transition-colors rounded-xl active:scale-90">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </motion.header>

      {/* Now Playing card */}
      <AnimatePresence>
        {activeSongLocal && (
          <NowPlayingCard
            song={activeSongLocal}
            isPlaying={isPlaying}
            currentTime={audioCurrentTime}
            duration={currentDuration}
            onTogglePlay={togglePlayPause}
            onPrev={playerPrevious}
            onNext={playerNext}
            onSeek={seek}
            repeat={repeat}
            onCycleRepeat={cycleRepeat}
            shuffle={shuffle}
            onToggleShuffle={toggleShuffle}
          />
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden"
        onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>

        {/* Tabs */}
        <div className="flex gap-1.5 px-4 pt-3 pb-0 flex-shrink-0">
          {[
            { key:'library',   label:'Bibliothèque', icon:<Music2 className="w-3.5 h-3.5" /> },
            { key:'playlists', label:'Playlists',    icon:<Folder className="w-3.5 h-3.5" /> },
            { key:'queue',     label:'File',         icon:<ListMusic className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95
                ${activeTab===key ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.07] hover:text-white'}`}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ scrollbarWidth:'none', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <AnimatePresence mode="wait">

            {/* ── BIBLIOTHÈQUE ── */}
            {activeTab === 'library' && (
              <motion.div key="library" initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-14 }} className="space-y-3">

                {/* Recherche + tri */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                    <input type="text" placeholder="Rechercher…" value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 bg-white/[0.05] border border-white/[0.07] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                    {searchQuery && (
                      <button type="button"
                        onPointerDown={e=>{ e.preventDefault(); setSearchQuery(''); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                    className="px-2 py-2 bg-white/[0.05] border border-white/[0.07] rounded-xl text-gray-300 text-xs focus:outline-none cursor-pointer">
                    <option value="name">Nom</option>
                    <option value="artist">Artiste</option>
                    <option value="duration">Durée</option>
                    <option value="date">Date</option>
                  </select>
                  <button type="button" onClick={() => setSortAsc(v=>!v)}
                    className="p-2.5 bg-white/[0.05] border border-white/[0.07] rounded-xl text-gray-400 hover:text-white transition-colors active:scale-90">
                    {sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Barre d'actions */}
                {songs.length > 0 && (
                  <div className="flex items-center gap-2">
                    {!selectionMode ? (
                      <>
                        <button type="button" onClick={() => handlePlayAll(false)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 rounded-xl text-xs font-bold active:scale-95 transition-all">
                          <Play className="w-3 h-3" /> Lire tout
                        </button>
                        <button type="button" onClick={() => handlePlayAll(true)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.05] border border-white/[0.07] text-gray-400 rounded-xl text-xs font-semibold active:scale-95 transition-all">
                          <Shuffle className="w-3 h-3" /> Aléatoire
                        </button>
                        <button type="button" onClick={() => setSelectionMode(true)}
                          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-white/[0.05] border border-white/[0.07] text-gray-400 rounded-xl text-xs font-semibold active:scale-95 transition-all">
                          <CheckSquare className="w-3 h-3" /> Sélection
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 w-full px-3 py-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                        <span className="text-xs text-cyan-300 font-semibold flex-1">{selectedIds.size} sélectionné{selectedIds.size>1?'s':''}</span>
                        <button type="button" onClick={()=>{ setSelectionMode(false); setSelectedIds(new Set()); }}
                          className="px-3 py-1.5 bg-white/10 text-gray-400 rounded-lg text-xs font-semibold active:scale-95">Annuler</button>
                        <button type="button"
                          onPointerDown={e=>{ e.preventDefault(); if(selectedIds.size>0) setShowModal(true); }}
                          disabled={selectedIds.size===0}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg text-xs font-bold disabled:opacity-40 active:scale-95">
                          <Save className="w-3 h-3" /> Playlist
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Liste */}
                {filteredSongs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                      <Music2 className="w-10 h-10 text-gray-700" />
                    </div>
                    <p className="text-gray-300 font-semibold mb-1">{searchQuery ? 'Aucun résultat' : 'Aucun morceau'}</p>
                    <p className="text-gray-600 text-sm mb-5">{searchQuery ? 'Essaie une autre recherche' : 'Appuie sur + pour importer des fichiers audio'}</p>
                    {!searchQuery && (
                      <button type="button" onClick={()=>fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-cyan-500/25">
                        <FolderOpen className="w-4 h-4" /> Importer des fichiers
                      </button>
                    )}
                  </div>
                ) : (
                  <AnimatePresence>
                    {filteredSongs.map(song => (
                      <SongItem key={song.id} song={song}
                        isActive={activeSongLocal?.id === song.id}
                        isPlaying={isPlaying}
                        selectionMode={selectionMode} isSelected={selectedIds.has(song.id)}
                        onSelect={handleSelectSong} onPlay={handlePlaySong}
                        onRemove={handleRemoveSong} onQueue={handleQueueSong}
                      />
                    ))}
                  </AnimatePresence>
                )}

                {songs.length > 0 && !selectionMode && !searchQuery && (
                  <div className="pt-1 flex justify-center">
                    <button type="button" onClick={() => {
                      songs.forEach(s => {
                        if (s.url?.startsWith('blob:')) try { URL.revokeObjectURL(s.url); } catch(_){}
                        if (s._hasBlobCover && s.coverUrl?.startsWith('blob:')) try { URL.revokeObjectURL(s.coverUrl); } catch(_){}
                      });
                      setSongs([]);
                    }} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-red-400 text-xs font-medium transition-colors rounded-xl active:scale-95">
                      <Trash2 className="w-3.5 h-3.5" /> Vider la bibliothèque
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── PLAYLISTS ── */}
            {activeTab === 'playlists' && (
              <motion.div key="playlists" initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-14 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold">Mes playlists</p>
                  <button type="button" onClick={() => {
                    if (songs.length === 0) { setActiveTab('library'); setTimeout(()=>fileInputRef.current?.click(),100); }
                    else { setActiveTab('library'); setSelectionMode(true); }
                  }} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Nouvelle
                  </button>
                </div>
                {savedPlaylists.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                      <Folder className="w-10 h-10 text-gray-700" />
                    </div>
                    <p className="text-gray-300 font-semibold mb-1">Aucune playlist</p>
                    <p className="text-gray-600 text-sm">Sélectionne des morceaux et sauvegarde-les</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <AnimatePresence>
                      {savedPlaylists.map(pl => (
                        <PlaylistCard key={pl.id} playlist={pl} onPlay={handleSelectPlaylist} onDelete={handleDeletePlaylist} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── FILE ── */}
            {activeTab === 'queue' && (
              <motion.div key="queue" initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-14 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold">File de lecture</p>
                  {queue?.length > 0 && <span className="text-xs text-gray-500">{queue.length} morceau{queue.length>1?'x':''}</span>}
                </div>
                {!queue?.length ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                      <ListMusic className="w-10 h-10 text-gray-700" />
                    </div>
                    <p className="text-gray-300 font-semibold mb-1">File vide</p>
                    <p className="text-gray-600 text-sm">Appui long sur un morceau pour l'ajouter</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {queue.map((song, idx) => (
                      <motion.div key={`${song.id}-${idx}`}
                        initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-14 }}
                        className="flex items-center gap-3 p-3 bg-white/[0.025] border border-white/[0.05] rounded-xl">
                        <span className="text-gray-700 text-xs w-5 text-right font-mono flex-shrink-0">{idx+1}</span>
                        <img src={song.cover_url||song.coverUrl||makeCoverSvg(song.title,song.artist||'')}
                          alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{song.title}</p>
                          <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                        </div>
                        {song.duration > 0 && (
                          <span className="text-gray-600 text-[10px] font-mono flex-shrink-0">{fmtDur(song.duration)}</span>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
            style={{ background:'rgba(6,182,212,0.10)', border:'2px dashed rgba(6,182,212,0.55)' }}>
            <div className="text-center">
              <FolderOpen className="w-16 h-16 text-cyan-400 mx-auto mb-3" />
              <p className="text-cyan-300 text-xl font-black">Déposez vos fichiers ici</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal playlist */}
      <AnimatePresence>
        {showPlaylistModal && (
          <PlaylistNameModal onConfirm={handleCreatePlaylist} onCancel={() => setShowModal(false)} />
        )}
      </AnimatePresence>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-900/95 border border-white/10 rounded-full text-xs text-gray-300 flex items-center gap-2 shadow-xl">
            <div className="w-3 h-3 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            Importation en cours…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input fichier */}
      <input ref={fileInputRef} type="file" accept="audio/*,video/mp4" multiple
        onChange={e=>{ handleFiles(e.target.files); e.target.value=''; }}
        className="hidden" />
    </div>
  );
});

LocalPlayerPageMobile.displayName = 'LocalPlayerPageMobile';
export default LocalPlayerPageMobile;
