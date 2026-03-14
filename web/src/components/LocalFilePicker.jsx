/**
 * LocalFilePicker — NovaSound TITAN LUX v12000
 *
 * ✅ PERSISTANCE COMPLÈTE via IndexedDB
 *    Les playlists locales survivent à la fermeture de la page / app / PWA.
 *    Les fichiers audio sont stockés en bytes (ArrayBuffer) en base — même
 *    après fermeture, les URLs sont recréées depuis les données stockées.
 *
 * ✅ COMPATIBILITÉ TOTALE
 *    iOS 14+, Android Chrome/Firefox, Safari desktop, Chrome, Firefox, Edge.
 *    Fallback gracieux si IndexedDB indisponible (navigation privée iOS).
 *
 * ✅ MULTI-PLAYLISTS
 *    L'utilisateur peut créer, renommer et supprimer des playlists locales.
 *    Chaque playlist est persistée indépendamment.
 *
 * Fonctionnement :
 *  - Sélection via <input type="file"> (natif, compatible tous appareils)
 *  - Les bytes audio sont sauvegardés dans IndexedDB (pas juste un objectURL)
 *  - Au rechargement : les données sont relues, de nouveaux objectURLs sont créés
 *  - L'utilisateur retrouve ses playlists locales jusqu'à ce qu'il les supprime
 */

import React, {
  useRef, useState, useCallback, useEffect,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Music2, X, Play, HardDrive, ListMusic,
  Plus, Trash2, Check, ChevronRight, AlertTriangle, Save, PenLine,
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import NoTranslate from '@/components/NoTranslate';

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — IndexedDB helper (compatible iOS 14+)
// ════════════════════════════════════════════════════════════════════════════

const DB_NAME         = 'novasound-local-v1';
const DB_VERSION      = 1;
const STORE_TRACKS    = 'tracks';
const STORE_PLAYLISTS = 'playlists';

/** Ouvre (ou crée) la base IndexedDB. Retourne null si indisponible. */
async function openDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        const store = db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
        store.createIndex('playlistId', 'playlistId', { unique: false });
        store.createIndex('order',      'order',      { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = ()  => resolve(null);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const idb = {
  async savePlaylists(playlists) {
    const conn = await openDB(); if (!conn) return;
    const tx = conn.transaction(STORE_PLAYLISTS, 'readwrite');
    // Clear then put all (idempotent)
    tx.objectStore(STORE_PLAYLISTS).clear();
    playlists.forEach(pl => tx.objectStore(STORE_PLAYLISTS).put(pl));
    return new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
  },

  async loadPlaylists() {
    const conn = await openDB(); if (!conn) return [];
    const tx = conn.transaction(STORE_PLAYLISTS, 'readonly');
    return new Promise((resolve) => {
      const req = tx.objectStore(STORE_PLAYLISTS).getAll();
      req.onsuccess = () =>
        resolve((req.result || []).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => resolve([]);
    });
  },

  async deletePlaylistAndTracks(playlistId) {
    const conn = await openDB(); if (!conn) return;
    const tx = conn.transaction([STORE_PLAYLISTS, STORE_TRACKS], 'readwrite');
    tx.objectStore(STORE_PLAYLISTS).delete(playlistId);
    const store = tx.objectStore(STORE_TRACKS);
    const req   = store.index('playlistId').getAllKeys(IDBKeyRange.only(playlistId));
    req.onsuccess = () => (req.result || []).forEach(k => store.delete(k));
    return new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
  },

  async saveTrack(track) {
    const conn = await openDB(); if (!conn) return false;
    const tx = conn.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).put(track);
    return new Promise(r => {
      tx.oncomplete = () => r(true);
      tx.onerror    = () => r(false);
    });
  },

  async loadTracks(playlistId) {
    const conn = await openDB(); if (!conn) return [];
    const tx = conn.transaction(STORE_TRACKS, 'readonly');
    return new Promise((resolve) => {
      const req = tx.objectStore(STORE_TRACKS).index('playlistId')
        .getAll(IDBKeyRange.only(playlistId));
      req.onsuccess = () =>
        resolve((req.result || []).sort((a, b) => a.order - b.order));
      req.onerror = () => resolve([]);
    });
  },

  async deleteTrack(trackId) {
    const conn = await openDB(); if (!conn) return;
    const tx = conn.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(trackId);
    return new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
  },

  async estimateUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const { usage, quota } = await navigator.storage.estimate();
        return { usage: usage || 0, quota: quota || 0 };
      } catch (_) {}
    }
    return { usage: 0, quota: 0 };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Utilitaires audio
// ════════════════════════════════════════════════════════════════════════════

const nameToColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360},60%,45%)`;
};

const makeFallbackCover = (title = '', artist = '') => {
  const c1 = nameToColor(title);
  const c2 = nameToColor(artist || title.split('').reverse().join(''));
  const initial = (title[0] || '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <circle cx="100" cy="100" r="55" fill="rgba(0,0,0,0.25)"/>
    <text x="100" y="118" font-family="system-ui,sans-serif" font-size="64"
      font-weight="bold" fill="white" text-anchor="middle" opacity="0.9">${initial}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

/** Parse ID3v2 tags depuis un ArrayBuffer (sans lib externe) */
const parseBasicTags = (buffer) => {
  const meta = { title: '', artist: '', album: '', coverDataUrl: null };
  try {
    const bytes = new Uint8Array(buffer.slice(0, 512 * 1024));
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const readSize = (b, o) =>
        ((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f);
      const tagSize = readSize(bytes, 6) + 10;
      let pos = 10;
      const dec = new TextDecoder('utf-8', { fatal: false });
      while (pos < tagSize - 10 && pos < bytes.length - 10) {
        const fid = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
        const fsz = (bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
        if (fsz <= 0 || fsz > 500000) break;
        const data = bytes.slice(pos+10, pos+10+fsz);
        const enc  = data[0];
        const txt  = enc === 0
          ? dec.decode(data.slice(1))
          : new TextDecoder('utf-16le', { fatal: false }).decode(data.slice(3));
        if      (fid === 'TIT2') meta.title  = txt.replace(/\0/g,'').trim();
        else if (fid === 'TPE1') meta.artist = txt.replace(/\0/g,'').trim();
        else if (fid === 'TALB') meta.album  = txt.replace(/\0/g,'').trim();
        else if (fid === 'APIC' && !meta.coverDataUrl) {
          let i = 1;
          while (i < data.length && data[i] !== 0) i++; i++;
          i++;
          while (i < data.length && data[i] !== 0) i++; i++;
          const imgBytes = data.slice(i);
          let b64 = '';
          for (let j = 0; j < imgBytes.length; j++) b64 += String.fromCharCode(imgBytes[j]);
          meta.coverDataUrl = `data:image/jpeg;base64,${btoa(b64)}`;
        }
        pos += 10 + fsz;
      }
    }
  } catch (_) {}
  return meta;
};

/**
 * Lit un File en ArrayBuffer.
 * Utilise file.arrayBuffer() si dispo (iOS 14.5+), sinon FileReader.
 */
const readFileAsArrayBuffer = (file) => {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Recrée un objet "song" jouable depuis un enregistrement IndexedDB.
 * Crée un objectURL frais à chaque appel.
 */
const dbTrackToSong = (rec) => {
  // Détecter le vrai type MIME depuis le nom de fichier
  const ext = (rec.fileName || '').split('.').pop().toLowerCase();
  const mimeMap = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
    wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg',
    opus: 'audio/ogg', mp4: 'audio/mp4',
  };
  const mimeType = mimeMap[ext] || 'audio/mpeg';
  const blob = new Blob([rec.audioBuffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  return {
    id:          'local::' + rec.id,
    _dbId:       rec.id,
    title:       rec.title,
    artist:      rec.artist,
    album:       rec.album || '',
    audio_url:   objectUrl,
    cover_url:   rec.coverDataUrl || makeFallbackCover(rec.title, rec.artist),
    genre:       null,
    uploader_id: null,
    is_local:    true,
    _objectUrl:  objectUrl,
    fileSize:    rec.fileSize,
    playlistId:  rec.playlistId,
  };
};

const fmtSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Composant principal
// ════════════════════════════════════════════════════════════════════════════

const LocalFilePicker = ({ compact = false }) => {
  const { playSong } = usePlayer();
  const inputRef = useRef(null);

  const [playlists,        setPlaylists]        = useState([]);
  const [activeId,         setActiveId]         = useState(null);
  const [tracks,           setTracks]           = useState([]);
  const [showDrawer,       setShowDrawer]       = useState(false);
  const [showManager,      setShowManager]      = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [initializing,     setInitializing]     = useState(true);
  const [error,            setError]            = useState(null);
  const [dbAvailable,      setDbAvailable]      = useState(true);
  const [storageInfo,      setStorageInfo]      = useState(null);
  const [renamingId,       setRenamingId]       = useState(null);
  const [renameValue,      setRenameValue]      = useState('');
  const [newPlName,        setNewPlName]        = useState('');

  // ── Initialisation au montage ─────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const conn = await openDB();
        if (!conn) {
          if (active) { setDbAvailable(false); setInitializing(false); }
          return;
        }
        let pls = await idb.loadPlaylists();
        if (!active) return;

        if (pls.length === 0) {
          const def = { id: uid(), name: 'Ma playlist locale', createdAt: Date.now() };
          await idb.savePlaylists([def]);
          pls = [def];
        }
        setPlaylists(pls);
        setActiveId(pls[0].id);

        const stored = await idb.loadTracks(pls[0].id);
        if (!active) return;
        setTracks(stored.map(dbTrackToSong));

        const info = await idb.estimateUsage();
        if (active) setStorageInfo(info);
      } catch (e) {
        console.warn('[LocalFilePicker] init:', e);
        if (active) setDbAvailable(false);
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // ── Révoquer les URLs au démontage ────────────────────────────────────
  useEffect(() => {
    return () => {
      tracks.forEach(s => { if (s._objectUrl) URL.revokeObjectURL(s._objectUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Changer de playlist active ────────────────────────────────────────
  const switchPlaylist = useCallback(async (id) => {
    if (id === activeId) return;
    tracks.forEach(s => { if (s._objectUrl) URL.revokeObjectURL(s._objectUrl); });
    setActiveId(id);
    setLoading(true);
    try {
      const stored = await idb.loadTracks(id);
      setTracks(stored.map(dbTrackToSong));
    } catch (_) {}
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ── Sélection de fichiers ─────────────────────────────────────────────
  const onFilesSelected = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !activeId) return;
    const supportedExt = new Set(['mp3','wav','flac','aac','ogg','m4a','mp4','opus','weba','webm']);
    setLoading(true); setError(null);
    try {
      const existing = new Set(tracks.map(s => s.title + '|' + s.artist));
      const nextOrder = tracks.length;
      const newSongs  = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext  = file.name.toLowerCase().split('.').pop();
        const isAudio = /audio/.test(file.type) || supportedExt.has(ext);
        if (!isAudio) continue;

        try {
          const buffer = await readFileAsArrayBuffer(file);
          const tags   = parseBasicTags(buffer);
          const rawName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
          const title  = tags.title  || rawName;
          const artist = tags.artist || 'Fichier local';
          const key    = title + '|' + artist;
          if (existing.has(key)) continue;
          existing.add(key);

          const rec = {
            id:           uid(),
            playlistId:   activeId,
            title,
            artist,
            album:        tags.album || '',
            coverDataUrl: tags.coverDataUrl || makeFallbackCover(title, artist),
            audioBuffer:  buffer,
            fileName:     file.name,
            fileSize:     file.size,
            order:        nextOrder + newSongs.length,
            addedAt:      Date.now(),
          };

          if (dbAvailable) await idb.saveTrack(rec);
          newSongs.push(dbTrackToSong(rec));
        } catch (fe) {
          console.warn('[LocalFilePicker] skip file:', file.name, fe);
        }
      }

      if (newSongs.length === 0) {
        setError('Aucun fichier audio compatible trouvé. Formats : MP3, M4A, WAV, FLAC, AAC, OGG, OPUS');
        setLoading(false); e.target.value = ''; return;
      }

      const updated = [...tracks, ...newSongs];
      setTracks(updated);
      playSong(newSongs[0], updated.slice(updated.indexOf(newSongs[0]) + 1));
      if (updated.length > 1) setShowDrawer(true);

      const info = await idb.estimateUsage();
      setStorageInfo(info);
    } catch (err) {
      console.error('[LocalFilePicker] onFilesSelected:', err);
      setError('Erreur lors du chargement. Réessaie avec un autre fichier.');
    } finally {
      setLoading(false); e.target.value = '';
    }
  }, [activeId, tracks, dbAvailable, playSong]);

  // ── Supprimer un track ────────────────────────────────────────────────
  const removeTrack = useCallback(async (dbId, objUrl) => {
    if (dbAvailable) await idb.deleteTrack(dbId);
    if (objUrl) URL.revokeObjectURL(objUrl);
    setTracks(prev => prev.filter(s => s._dbId !== dbId));
    const info = await idb.estimateUsage();
    setStorageInfo(info);
  }, [dbAvailable]);

  // ── Créer une playlist ────────────────────────────────────────────────
  const createPlaylist = useCallback(async () => {
    const name = newPlName.trim() || `Playlist ${playlists.length + 1}`;
    const pl   = { id: uid(), name, createdAt: Date.now() };
    const updated = [...playlists, pl];
    if (dbAvailable) await idb.savePlaylists(updated);
    setPlaylists(updated);
    setNewPlName('');
    await switchPlaylist(pl.id);
  }, [newPlName, playlists, dbAvailable, switchPlaylist]);

  // ── Renommer une playlist ─────────────────────────────────────────────
  const renamePlaylist = useCallback(async (id) => {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    const updated = playlists.map(pl => pl.id === id ? { ...pl, name } : pl);
    if (dbAvailable) await idb.savePlaylists(updated);
    setPlaylists(updated);
    setRenamingId(null); setRenameValue('');
  }, [renameValue, playlists, dbAvailable]);

  // ── Supprimer une playlist ────────────────────────────────────────────
  const deletePlaylist = useCallback(async (id) => {
    if (playlists.length <= 1) return;
    if (dbAvailable) await idb.deletePlaylistAndTracks(id);
    const updated = playlists.filter(pl => pl.id !== id);
    setPlaylists(updated);
    if (activeId === id) {
      tracks.forEach(s => { if (s._objectUrl) URL.revokeObjectURL(s._objectUrl); });
      setTracks([]);
      await switchPlaylist(updated[0].id);
    }
  }, [playlists, activeId, tracks, dbAvailable, switchPlaylist]);

  const activeName = playlists.find(pl => pl.id === activeId)?.name || '';

  // ── RENDU compact (icône dans barre player) ───────────────────────────
  if (compact) {
    return (
      <>
        <input ref={inputRef} type="file" accept="audio/*" multiple
          onChange={onFilesSelected} className="hidden" />
        <motion.button onClick={() => inputRef.current?.click()}
          whileTap={{ scale: 0.88 }} disabled={loading || initializing}
          className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
          title="Lire un fichier local">
          {loading
            ? <div className="w-5 h-5 rounded-full border-2 border-gray-600 border-t-cyan-400 animate-spin"/>
            : <HardDrive className="w-5 h-5"/>}
          <span className="text-[9px]">Local</span>
        </motion.button>
      </>
    );
  }

  // ── RENDU complet ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full">
      <input ref={inputRef} type="file" accept="audio/*" multiple
        onChange={onFilesSelected} className="hidden" />

      {/* Avertissement navigation privée */}
      {!dbAvailable && (
        <div className="w-full max-w-sm mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', color: '#ca8a04' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
          <span>Mode privé détecté — les playlists ne seront <strong>pas sauvegardées</strong> après fermeture.</span>
        </div>
      )}

      {/* Sélecteur de playlists */}
      {!initializing && playlists.length > 0 && (
        <div className="w-full max-w-sm mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Playlist active</span>
            <button onClick={() => setShowManager(true)}
              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
              <ListMusic className="w-3.5 h-3.5"/>Gérer
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {playlists.map(pl => (
              <button key={pl.id} onClick={() => switchPlaylist(pl.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  pl.id === activeId
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-gray-300 border border-white/5'
                }`}>
                {pl.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bouton principal */}
      <motion.button onClick={() => inputRef.current?.click()}
        whileTap={{ scale: 0.95 }} disabled={loading || initializing}
        className="w-full max-w-sm flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white font-semibold text-sm disabled:opacity-50 transition-all"
        style={{ background: 'linear-gradient(135deg, #0e7490, #7c3aed)' }}>
        {loading || initializing
          ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
          : <FolderOpen className="w-5 h-5"/>}
        {initializing ? 'Chargement...' : loading ? 'Traitement...' : 'Ajouter à la playlist'}
      </motion.button>

      {error && <p className="mt-2 text-red-400 text-xs text-center px-4">{error}</p>}

      <p className="mt-2 text-gray-600 text-[10px] text-center">
        MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS
      </p>

      {/* Indicateur sauvegarde */}
      {dbAvailable && !initializing && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-500/70">
          <Save className="w-3 h-3"/>
          <span>Sauvegardé — retrouve ta playlist même après fermeture</span>
        </div>
      )}

      {/* Info stockage */}
      {storageInfo && storageInfo.usage > 0 && (
        <p className="mt-1 text-[10px] text-gray-600 text-center">
          {fmtSize(storageInfo.usage)} utilisés
          {storageInfo.quota > 0 ? ` / ${fmtSize(storageInfo.quota)}` : ''}
        </p>
      )}

      {/* Bouton ouvrir la queue */}
      {tracks.length > 0 && (
        <motion.button onClick={() => setShowDrawer(true)}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 text-cyan-400 text-xs font-medium hover:text-cyan-300 transition-colors">
          <Music2 className="w-4 h-4"/>
          {tracks.length} morceau{tracks.length > 1 ? 'x' : ''} · {activeName}
          <ChevronRight className="w-3.5 h-3.5"/>
        </motion.button>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DRAWER — Queue de lecture
          ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDrawer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowDrawer(false); }}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              className="w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col"
              style={{ background: '#1a1a2e', maxHeight: '78dvh', paddingBottom: 'env(safe-area-inset-bottom,12px)' }}
              onClick={e => e.stopPropagation()}>

              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full bg-white/20"/>
              </div>

              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cyan-400"/>
                  <span className="text-white font-bold text-sm">{activeName}</span>
                  <span className="text-[10px] text-gray-500 bg-white/10 px-1.5 py-0.5 rounded-full">{tracks.length}</span>
                  {dbAvailable && (
                    <span className="text-[9px] text-green-500/60 flex items-center gap-0.5">
                      <Save className="w-2.5 h-2.5"/>sauvegardé
                    </span>
                  )}
                </div>
                <button onClick={() => setShowDrawer(false)}
                  className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white">
                  <X className="w-4 h-4"/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-2">
                {tracks.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">
                    <Music2 className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                    <p>Aucun morceau dans cette playlist</p>
                  </div>
                ) : tracks.map((song, idx) => (
                  <div key={song.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/[0.05] transition-colors group">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <NoTranslate tag="p" className="text-white text-sm font-medium truncate truncate">{song.title}</NoTranslate>
                      <p className="text-gray-500 text-[11px] truncate">
                        {song.artist}
                        {song.fileSize ? <span className="ml-1 text-gray-600">· {fmtSize(song.fileSize)}</span> : null}
                      </p>
                    </div>
                    <button onClick={() => { playSong(song, tracks.slice(idx + 1)); setShowDrawer(false); }}
                      className="p-2 rounded-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors opacity-0 group-hover:opacity-100 md:opacity-100 flex-shrink-0">
                      <Play className="w-3.5 h-3.5 fill-current"/>
                    </button>
                    <button onClick={() => removeTrack(song._dbId, song._objectUrl)}
                      className="p-1.5 rounded-full text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-2 flex-shrink-0 flex gap-2">
                <button onClick={() => { setShowDrawer(false); inputRef.current?.click(); }}
                  className="flex-1 py-3 rounded-xl bg-white/[0.07] text-gray-300 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                  <FolderOpen className="w-4 h-4"/>Ajouter des fichiers
                </button>
                <button onClick={() => { setShowDrawer(false); setShowManager(true); }}
                  className="py-3 px-4 rounded-xl bg-white/[0.07] text-gray-400 flex items-center justify-center hover:bg-white/10 transition-colors"
                  title="Gérer les playlists">
                  <ListMusic className="w-4 h-4"/>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════
          MANAGER — Gestion des playlists
          ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showManager && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[410] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowManager(false); }}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              className="w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col"
              style={{ background: '#141420', maxHeight: '80dvh', paddingBottom: 'env(safe-area-inset-bottom,12px)' }}
              onClick={e => e.stopPropagation()}>

              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full bg-white/20"/>
              </div>

              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
                <span className="text-white font-bold text-sm flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-purple-400"/>Mes playlists locales
                </span>
                <button onClick={() => setShowManager(false)}
                  className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white">
                  <X className="w-4 h-4"/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-2">
                {playlists.map(pl => (
                  <div key={pl.id}
                    className={`flex items-center gap-3 py-3 px-3 rounded-xl mb-1 transition-colors ${
                      pl.id === activeId
                        ? 'bg-cyan-500/10 border border-cyan-500/20'
                        : 'hover:bg-white/[0.04]'
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      pl.id === activeId ? 'bg-cyan-500/20' : 'bg-white/[0.07]'
                    }`}>
                      {pl.id === activeId
                        ? <Check className="w-4 h-4 text-cyan-400"/>
                        : <Music2 className="w-4 h-4 text-gray-500"/>}
                    </div>

                    <div className="flex-1 min-w-0">
                      {renamingId === pl.id ? (
                        <input autoFocus value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renamePlaylist(pl.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="w-full bg-white/10 text-white text-sm rounded-lg px-2 py-1 outline-none border border-cyan-500/40"
                          placeholder="Nom de la playlist" maxLength={40}/>
                      ) : (
                        <button onClick={() => switchPlaylist(pl.id)} className="text-left w-full">
                          <p className={`text-sm font-medium truncate ${
                            pl.id === activeId ? 'text-cyan-300' : 'text-white'
                          }`}>{pl.name}</p>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {renamingId === pl.id ? (
                        <button onClick={() => renamePlaylist(pl.id)}
                          className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors">
                          <Check className="w-3.5 h-3.5"/>
                        </button>
                      ) : (
                        <button onClick={() => { setRenamingId(pl.id); setRenameValue(pl.name); }}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 transition-colors">
                          <PenLine className="w-3.5 h-3.5"/>
                        </button>
                      )}
                      <button onClick={() => deletePlaylist(pl.id)}
                        disabled={playlists.length <= 1}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Créer une nouvelle playlist */}
              <div className="px-4 py-3 flex-shrink-0 border-t border-white/5">
                <div className="flex gap-2">
                  <input value={newPlName} onChange={e => setNewPlName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createPlaylist(); }}
                    placeholder="Nouvelle playlist..."
                    maxLength={40}
                    className="flex-1 bg-white/[0.07] text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-white/5 focus:border-cyan-500/40 placeholder-gray-600 transition-colors"/>
                  <button onClick={createPlaylist}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors flex items-center gap-1.5">
                    <Plus className="w-4 h-4"/>Créer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocalFilePicker;
