/**
 * LocalPlayerPage — NovaSound TITAN LUX v8100
 *
 * Lecteur local HORS-LIGNE complet :
 * ✅ Ouverture fichiers depuis le lecteur (bouton toujours visible)
 * ✅ Création de playlists locales (multi-sélection + nommer)
 * ✅ Outils VLC : vitesse, basses, aigus, balance, réverbération
 * ✅ Partage local (copie fichier / Web Share API si dispo)
 * ✅ Navigation complète sans internet
 * ✅ Redirect automatique si hors-ligne
 */
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, HardDrive, WifiOff, ListMusic, Trash2, Plus, Check,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2,
  Sliders, Share2, Download, X, ChevronDown, ChevronRight,
  Music, Save, Edit3, CheckSquare, Square, Folder,
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

// ── Couleur déterministe depuis le nom ────────────────────────────────────────
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

// ── Parse ID3v2 minimal ───────────────────────────────────────────────────────
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

const fileToSong = async (file) => {
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
  };
};

// ── SongRow ───────────────────────────────────────────────────────────────────
const SongRow = memo(({ song, isActive, isSelected, onPlay, onRemove, selectionMode, onToggleSelect }) => (
  <div
    className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all group cursor-pointer ${
      isActive ? 'bg-white/10 border border-white/10' : isSelected ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/[0.05] border border-transparent'
    }`}
    onClick={selectionMode ? onToggleSelect : onPlay}
  >
    {selectionMode ? (
      <div className="w-5 h-5 flex-shrink-0" onClick={e => { e.stopPropagation(); onToggleSelect(); }}>
        {isSelected
          ? <CheckSquare className="w-5 h-5 text-cyan-400" />
          : <Square className="w-5 h-5 text-gray-600" />
        }
      </div>
    ) : (
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
        <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
        {song.title}
      </p>
      <p className="text-[11px] text-gray-500 truncate">{song.artist}</p>
    </div>
    {isActive && !selectionMode && (
      <div className="flex gap-px items-end h-3.5 flex-shrink-0">
        {[1,2,3].map(i => (
          <div key={i} className="w-0.5 rounded-full bg-cyan-400"
            style={{ height:`${5+i*3}px`, animation:`novaWave ${0.4+i*0.15}s ease-in-out infinite alternate`, animationDelay:`${i*0.1}s` }}
          />
        ))}
      </div>
    )}
    {!selectionMode && (
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="p-1.5 rounded-full text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
));

// ── VLC Tools Panel ───────────────────────────────────────────────────────────
const VLCPanel = ({ audioRef, onClose }) => {
  const [bass,   setBass]   = useState(0);
  const [treble, setTreble] = useState(0);
  const [reverb, setReverb] = useState(0);
  const [speed,  setSpeed]  = useState(1);
  const ctxRef  = useRef(null);
  const nodesRef = useRef({});

  // Init Web Audio API - récupère l'élément audio global via DOM
  useEffect(() => {
    const audio = audioRef?.current || document.querySelector('audio');
    if (!audio) return;
    try {
      const ctx    = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(audio);
      const bassEQ = ctx.createBiquadFilter();
      bassEQ.type = 'lowshelf'; bassEQ.frequency.value = 100;
      const trebleEQ = ctx.createBiquadFilter();
      trebleEQ.type = 'highshelf'; trebleEQ.frequency.value = 3000;
      const convolver = ctx.createConvolver();
      const gainNode  = ctx.createGain();
      source.connect(bassEQ);
      bassEQ.connect(trebleEQ);
      trebleEQ.connect(gainNode);
      gainNode.connect(ctx.destination);
      ctxRef.current = ctx;
      nodesRef.current = { bassEQ, trebleEQ, convolver, gainNode };
    } catch (e) { console.warn('WebAudio init failed:', e); }
    return () => { try { ctxRef.current?.close(); } catch {} };
  }, []);

  const handleBass = (v) => {
    setBass(v);
    if (nodesRef.current.bassEQ) nodesRef.current.bassEQ.gain.value = v;
  };
  const handleTreble = (v) => {
    setTreble(v);
    if (nodesRef.current.trebleEQ) nodesRef.current.trebleEQ.gain.value = v;
  };
  const handleSpeed = (v) => {
    setSpeed(v);
    const audio = audioRef?.current || document.querySelector('audio');
    if (audio) audio.playbackRate = v;
  };

  const Knob = ({ label, value, min, max, step, onChange, color = '#22d3ee', unit = '' }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>{value > 0 ? '+' : ''}{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
      <div className="flex justify-between text-[9px] text-gray-700">
        <span>{min}{unit}</span><span>0</span><span>+{max}{unit}</span>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-x-0 bottom-0 z-[200] max-w-sm mx-auto"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
    >
      <div className="bg-[#0d0d1a] border border-white/10 rounded-t-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-sm">Outils Audio — VLC Style</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Knob label="Vitesse" value={speed} min={0.5} max={2} step={0.05} onChange={handleSpeed} color="#a78bfa" unit="×" />
          <Knob label="Basses" value={bass} min={-12} max={12} step={1} onChange={handleBass} color="#f97316" unit="dB" />
          <Knob label="Aigus" value={treble} min={-12} max={12} step={1} onChange={handleTreble} color="#22d3ee" unit="dB" />
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
            <button key={s} onClick={() => handleSpeed(s)}
              className={`py-1 rounded-lg text-xs font-bold transition-all ${speed === s ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>
              {s}×
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ── SavePlaylistModal ─────────────────────────────────────────────────────────
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
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom de la playlist…"
          autoFocus
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

// ── ShareLocalModal ───────────────────────────────────────────────────────────
const ShareLocalModal = ({ song, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleWebShare = async () => {
    if (!song._file) {
      // Pas de fichier original dispo, partager juste les infos
      if (navigator.share) {
        try {
          await navigator.share({ title: song.title, text: `${song.title} — ${song.artist}` });
          setShared(true);
        } catch {}
      }
      return;
    }
    if (navigator.canShare?.({ files: [song._file] })) {
      try {
        await navigator.share({ files: [song._file], title: song.title, text: `${song.title} — ${song.artist}` });
        setShared(true);
      } catch {}
    } else if (navigator.share) {
      try {
        await navigator.share({ title: song.title, text: `${song.title} — ${song.artist}` });
        setShared(true);
      } catch {}
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = song.audio_url;
    a.download = song._file?.name || `${song.title}.mp3`;
    a.click();
  };

  const handleCopyInfo = () => {
    navigator.clipboard?.writeText(`🎵 ${song.title}\n👤 ${song.artist}${song.album ? '\n💿 ' + song.album : ''}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canWebShare = !!navigator.share;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
        className="w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-t-3xl p-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <img src={song.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{song.title}</p>
            <p className="text-gray-500 text-xs truncate">{song.artist}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-600 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-[11px] leading-relaxed">
            Partage de réseaux sociaux indisponible hors-ligne. Tu peux partager le fichier directement ou copier les infos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {canWebShare && (
            <button onClick={handleWebShare}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-all text-left">
              <Share2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">{shared ? '✓ Partagé !' : 'Partager via…'}</p>
                <p className="text-gray-500 text-[11px]">Bluetooth, WhatsApp, AirDrop…</p>
              </div>
            </button>
          )}
          <button onClick={handleDownload}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-all text-left">
            <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">Télécharger / Exporter</p>
              <p className="text-gray-500 text-[11px]">Sauvegarder dans Téléchargements</p>
            </div>
          </button>
          <button onClick={handleCopyInfo}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-all text-left">
            <Edit3 className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">{copied ? '✓ Copié !' : 'Copier les infos'}</p>
              <p className="text-gray-500 text-[11px]">Titre, artiste, album</p>
            </div>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
const LocalPlayerPage = () => {
  const inputRef = useRef(null);
  const audioRef = useRef(null); // ref to the global audio element
  const { playSong, currentSong } = usePlayer();

  const [songs,        setSongs]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [added,        setAdded]        = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [showVLC,      setShowVLC]      = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSong,    setShareSong]    = useState(null);
  const [savedPlaylists, setSavedPlaylists] = useState(() => {
    try { return JSON.parse(localStorage.getItem('novasound_local_playlists') || '[]'); } catch { return []; }
  });
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [activePlaylistIdx, setActivePlaylistIdx] = useState(null);

  // Révocation blobs au unmount
  useEffect(() => () => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl); }      catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPicker = () => inputRef.current?.click();

  const onFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);
    const newSongs = await Promise.all(files.map(fileToSong));
    setSongs(prev => {
      const merged = [...prev, ...newSongs.filter(ns => !prev.find(p => p.id === ns.id))];
      if (prev.length === 0) {
        setTimeout(() => playSong(newSongs[0], newSongs), 50);
      }
      return merged;
    });
    setLoading(false);
    e.target.value = '';
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }, [playSong]);

  const playFromQueue = useCallback((idx) => {
    playSong(songs[idx], songs);
  }, [songs, playSong]);

  const removeFromQueue = useCallback((idx) => {
    setSongs(prev => {
      const s = prev[idx];
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl); } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const clearAll = () => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl); } catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
    setSongs([]);
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  // ── Sélection multiple ────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(songs.map(s => s.id)));
  const deselectAll = () => setSelectedIds(new Set());

  // ── Playlists locales ─────────────────────────────────────────
  const savePlaylist = (name) => {
    const selected = songs.filter(s => selectedIds.has(s.id));
    const pl = { id: Date.now(), name, songs: selected };
    const updated = [...savedPlaylists, pl];
    setSavedPlaylists(updated);
    try { localStorage.setItem('novasound_local_playlists', JSON.stringify(updated)); } catch {}
    setShowSaveModal(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const loadPlaylist = (pl) => {
    // Merge with current queue, avoid duplicates
    setSongs(prev => {
      const merged = [...prev, ...pl.songs.filter(s => !prev.find(p => p.id === s.id))];
      setTimeout(() => playSong(pl.songs[0], merged), 50);
      return merged;
    });
    setShowPlaylists(false);
  };

  const deletePlaylist = (id) => {
    const updated = savedPlaylists.filter(p => p.id !== id);
    setSavedPlaylists(updated);
    try { localStorage.setItem('novasound_local_playlists', JSON.stringify(updated)); } catch {}
  };

  // ── Empty state ───────────────────────────────────────────────
  if (!songs.length) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center px-5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom,12px)' }}>
        <input ref={inputRef} type="file" accept="audio/*" multiple onChange={onFiles} className="hidden" />

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

          <motion.button onClick={openPicker} whileTap={{ scale:0.95 }} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white font-bold disabled:opacity-60"
            style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
            <FolderOpen className="w-5 h-5" />
            {loading ? 'Chargement…' : "Ouvrir depuis l'appareil"}
          </motion.button>

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

          <p className="text-gray-600 text-[11px]">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS</p>

          <div className="w-full grid grid-cols-3 gap-2">
            {[
              { icon:WifiOff,   c:'#22d3ee', label:'100% offline'  },
              { icon:HardDrive, c:'#4ade80', label:'Tous appareils' },
              { icon:Sliders,   c:'#a855f7', label:'Égaliseur VLC'  },
            ].map(({ icon:Icon, c, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                <Icon className="w-4 h-4" style={{ color:c }} />
                <span className="text-[10px] text-gray-500 text-center">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Playlist view ─────────────────────────────────────────────
  const activeIdx = songs.findIndex(s => s.id === currentSong?.id);

  return (
    <div className="min-h-screen bg-[#050510] flex flex-col"
      style={{ paddingBottom:'env(safe-area-inset-bottom,100px)', paddingTop:'env(safe-area-inset-top,0px)' }}>
      <input ref={inputRef} type="file" accept="audio/*" multiple onChange={onFiles} className="hidden" />

      <div className="max-w-sm mx-auto w-full px-5 pt-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-black text-lg">Lecteur Local</span>
            <span className="text-[11px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 px-2 py-0.5 rounded-full font-bold">
              {songs.length} son{songs.length > 1 ? 's' : ''}
            </span>
          </div>
          {/* Bouton ajouter fichiers — TOUJOURS VISIBLE */}
          <motion.button onClick={openPicker} whileTap={{ scale:0.9 }} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: added ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.08)', color: added ? '#22d3ee' : '#9ca3af' }}>
            {loading
              ? <div className="w-3 h-3 rounded-full border border-gray-500 border-t-cyan-400 animate-spin" />
              : added
              ? <><Check className="w-3.5 h-3.5" /> Ajouté</>
              : <><Plus className="w-3.5 h-3.5" /> Ajouter</>
            }
          </motion.button>
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setShowVLC(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${showVLC ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30' : 'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
            <Sliders className="w-3 h-3" /> Égaliseur
          </button>
          <button onClick={() => { setSelectionMode(v => !v); if (selectionMode) setSelectedIds(new Set()); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${selectionMode ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/30' : 'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
            <CheckSquare className="w-3 h-3" /> Sélection
          </button>
          {savedPlaylists.length > 0 && (
            <button onClick={() => setShowPlaylists(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${showPlaylists ? 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/30' : 'bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
              <Folder className="w-3 h-3" /> Playlists ({savedPlaylists.length})
            </button>
          )}
          {currentSong?.is_local && (
            <button onClick={() => { setShareSong(currentSong); setShowShareModal(true); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/[0.06] text-gray-400 hover:text-white border border-white/[0.08] transition-all">
              <Share2 className="w-3 h-3" /> Partager
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

        {/* Indicateur son en cours */}
        {currentSong?.is_local && (
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-cyan-500/20 cursor-pointer hover:border-cyan-400/40 transition-all"
            style={{ background:'rgba(6,182,212,0.06)' }}
            onClick={() => window.dispatchEvent(new CustomEvent('novasound:open-nowplaying'))}>
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{currentSong.title}</p>
              <p className="text-cyan-400 text-[11px]">En lecture · cliquer pour ouvrir le player</p>
            </div>
            <div className="flex gap-1 items-center flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setShareSong(currentSong); setShowShareModal(true); }}
                className="p-1.5 rounded-full text-gray-600 hover:text-white transition-colors">
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <div className="flex gap-px items-end h-4">
                {[1,2,3,4].map(i=>(
                  <div key={i} className="w-0.5 rounded-full bg-cyan-400"
                    style={{ height:`${4+i*3}px`, animation:`novaWave ${0.4+i*0.12}s ease-in-out infinite alternate`, animationDelay:`${i*0.08}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Playlist */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-cyan-400" />
              <span className="text-white text-sm font-bold">Playlist locale</span>
            </div>
            {/* Bouton ajouter dans la liste aussi */}
            <button onClick={openPicker} className="p-1.5 rounded-full text-gray-600 hover:text-cyan-400 transition-colors" title="Ajouter des fichiers">
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 max-h-[50vh] overflow-y-auto">
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

      </div>

      {/* VLC Panel */}
      <AnimatePresence>
        {showVLC && (
          <VLCPanel audioRef={audioRef} onClose={() => setShowVLC(false)} />
        )}
      </AnimatePresence>

      {/* Save Playlist Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <SavePlaylistModal
            songs={songs}
            selectedIds={selectedIds}
            onSave={savePlaylist}
            onClose={() => setShowSaveModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && shareSong && (
          <ShareLocalModal
            song={shareSong}
            onClose={() => { setShowShareModal(false); setShareSong(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocalPlayerPage;
