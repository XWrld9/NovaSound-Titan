/**
 * LocalFilePicker — NovaSound TITAN LUX v8000
 *
 * Lecteur de fichiers audio locaux (100% hors-ligne).
 * Compatible : iPhone (iOS 14+), Android, Chrome/Firefox/Safari desktop.
 *
 * Fonctionnement :
 *  - Ouvre le gestionnaire de fichiers natif de l'appareil via <input type="file">
 *  - Crée un objectURL local → aucun réseau requis
 *  - Extrait les métadonnées ID3/MP4 via music-metadata-browser (si dispo) ou fallback nom de fichier
 *  - Injecte le son dans PlayerContext (playSong) avec une pochette SVG générative si absente
 *  - Gère une file locale (plusieurs fichiers sélectionnés)
 *  - Le bouton est discret et s'intègre au mini-player et au NowPlayingScreen
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Music2, X, ChevronRight, HardDrive, Play } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

// ── Génère une couleur pastel déterministe depuis un nom ────────────────────
const nameToColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue},60%,45%)`;
};

// ── Génère une pochette SVG si aucune image dans les métadonnées ────────────
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
  return 'data:image/svg+xml;base64,' + btoa(svg);
};

// ── Parse minimal des tags ID3v2 / MP4 sans lib externe ─────────────────────
const parseBasicTags = async (file) => {
  const meta = { title: '', artist: '', album: '', cover: null };

  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer(); // lire les 256 ko
    const bytes = new Uint8Array(buf);

    // ── ID3v2 (MP3) ─────────────────────────────────────────────────────
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) { // "ID3"
      const readSize = (b, o) =>
        ((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f);
      const tagSize = readSize(bytes, 6) + 10;
      let pos = 10;
      const dec = new TextDecoder('utf-8', { fatal: false });

      while (pos < tagSize - 10 && pos < bytes.length - 10) {
        const fid  = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
        const fsz  = (bytes[pos+4]<<24)|(bytes[pos+5]<<16)|(bytes[pos+6]<<8)|bytes[pos+7];
        if (fsz <= 0 || fsz > 200000) break;
        const data = bytes.slice(pos+10, pos+10+fsz);
        const enc  = data[0]; // encoding byte
        const txt  = enc === 0 ? dec.decode(data.slice(1)) : new TextDecoder('utf-16le',{fatal:false}).decode(data.slice(3));

        if      (fid === 'TIT2') meta.title  = txt.replace(/\0/g,'').trim();
        else if (fid === 'TPE1') meta.artist = txt.replace(/\0/g,'').trim();
        else if (fid === 'TALB') meta.album  = txt.replace(/\0/g,'').trim();
        else if (fid === 'APIC' && !meta.cover) {
          // trouver la fin du mime + '\0' + type + '\0' = début image
          let i = 1;
          while (i < data.length && data[i] !== 0) i++; i++; // skip mime
          i++; // skip picture type
          while (i < data.length && data[i] !== 0) i++; i++; // skip desc
          const imgBytes = data.slice(i);
          const mime = data[0] === 0 && i > 3 ? 'image/jpeg' : 'image/jpeg';
          const blob = new Blob([imgBytes], { type: mime });
          meta.cover = URL.createObjectURL(blob);
        }
        pos += 10 + fsz;
      }
    }
  } catch (_) { /* silencieux */ }

  return meta;
};

// ── Convertit un File audio en objet "song" jouable par PlayerContext ────────
const fileToSong = async (file) => {
  // Validation du type de fichier
  const audioTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/m4a', 'audio/mp4'];
  if (!audioTypes.some(type => file.type.includes(type)) && !file.name.match(/\.(mp3|wav|flac|aac|ogg|m4a|mp4)$/i)) {
    throw new Error(`Format non supporté: ${file.type || file.name}`);
  }

  // Validation de la taille (max 100MB)
  if (file.size > 100 * 1024 * 1024) {
    throw new Error(`Fichier trop volumineux: ${Math.round(file.size / 1024 / 1024)}MB (max 100MB)`);
  }

  const objectUrl = URL.createObjectURL(file);
  const rawName   = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

  console.log('[LocalFilePicker] Traitement du fichier:', file.name, 'Type:', file.type, 'Taille:', file.size);

  try {
    const tags = await parseBasicTags(file);

    const title  = tags.title  || rawName;
    const artist = tags.artist || 'Fichier local';
    const album  = tags.album  || '';

    const cover = tags.cover || makeFallbackCover(title, artist);

    return {
      id:          'local::' + objectUrl,   // ID unique, préfixe "local::" pour distinguer
      title,
      artist,
      album,
      audio_url:   objectUrl,
      cover_url:   cover,
      genre:       null,
      uploader_id: null,
      is_local:    true,                    // flag pour désactiver les features Supabase
      _objectUrl:  objectUrl,              // pour révoquer plus tard
      _coverIsBlob: !!tags.cover,
    };
  } catch (err) {
    // Révoquer l'URL object en cas d'erreur
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
const LocalFilePicker = ({ compact = false }) => {
  const { playSong, setPlaylist } = usePlayer();
  const inputRef  = useRef(null);
  const [localQueue,  setLocalQueue]  = useState([]);
  const [showDrawer,  setShowDrawer]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  // Révoquer les objectURLs lors du démontage pour éviter les fuites mémoire
  useEffect(() => {
    return () => {
      localQueue.forEach(s => {
        if (s._objectUrl) URL.revokeObjectURL(s._objectUrl);
        if (s._coverIsBlob && s.cover_url) URL.revokeObjectURL(s.cover_url);
      });
    };
  }, [localQueue]);

  const openPicker = () => {
    setError(null);
    inputRef.current?.click();
  };

  const onFilesSelected = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[LocalFilePicker] Fichiers sélectionnés:', files.map(f => f.name + ' (' + f.size + ' bytes)'));
      const songs = await Promise.all(files.map(fileToSong));
      console.log('[LocalFilePicker] Songs créés:', songs.map(s => ({ title: s.title, audio_url: s.audio_url?.substring(0, 50) + '...' })));
      setLocalQueue(prev => {
        // Dédupliquer par nom de fichier
        const existing = new Set(prev.map(s => s.title + s.artist));
        const fresh = songs.filter(s => !existing.has(s.title + s.artist));
        return [...prev, ...fresh];
      });
      // Jouer le premier immédiatement, les autres en playlist
      console.log('[LocalFilePicker] Lecture de:', songs[0].title);
      playSong(songs[0], songs.slice(1));
      if (songs.length > 1) setShowDrawer(true);
    } catch (err) {
      console.error('[LocalFilePicker]', err);
      let errorMessage = 'Impossible de lire ce fichier. Essaie un autre format.';
      
      if (err.message.includes('Format non supporté')) {
        errorMessage = 'Format audio non supporté. Utilise MP3, WAV, FLAC, AAC, OGG ou M4A.';
      } else if (err.message.includes('trop volumineux')) {
        errorMessage = err.message;
      } else if (err.message.includes('quota')) {
        errorMessage = 'Espace de stockage insuffisant. Essayez avec un fichier plus petit.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      // Reset l'input pour permettre de re-sélectionner les mêmes fichiers
      e.target.value = '';
    }
  }, [playSong]);

  const playFromQueue = (song, idx) => {
    playSong(song, localQueue.slice(idx + 1));
    setShowDrawer(false);
  };

  const removeFromQueue = (idx) => {
    setLocalQueue(prev => {
      const s = prev[idx];
      if (s._objectUrl) URL.revokeObjectURL(s._objectUrl);
      if (s._coverIsBlob && s.cover_url) URL.revokeObjectURL(s.cover_url);
      return prev.filter((_,i) => i !== idx);
    });
  };

  if (compact) {
    // Version icône seule pour intégration dans la barre du player
    return (
      <>
        <input ref={inputRef} type="file" accept="audio/*" multiple onChange={onFilesSelected}
          className="hidden" aria-label="Ouvrir fichier audio local" />
        <motion.button
          onClick={openPicker}
          whileTap={{ scale: 0.88 }}
          disabled={loading}
          className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
          title="Lire un fichier local (hors-ligne)"
        >
          {loading
            ? <div className="w-5 h-5 rounded-full border-2 border-gray-600 border-t-cyan-400 animate-spin" />
            : <HardDrive className="w-5 h-5" />
          }
          <span className="text-[9px]">Local</span>
        </motion.button>
      </>
    );
  }

  // Version complète (page /local-player ou modal)
  return (
    <div className="flex flex-col items-center w-full">
      <input ref={inputRef} type="file" accept="audio/*" multiple onChange={onFilesSelected}
        className="hidden" aria-label="Ouvrir fichier audio local" />

      {/* Bouton principal */}
      <motion.button
        onClick={openPicker}
        whileTap={{ scale: 0.95 }}
        disabled={loading}
        className="w-full max-w-xs flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white font-semibold text-sm disabled:opacity-50 transition-all"
        style={{ background: 'linear-gradient(135deg, #0e7490, #7c3aed)' }}
      >
        {loading
          ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          : <FolderOpen className="w-5 h-5" />
        }
        {loading ? 'Chargement…' : 'Ouvrir depuis l\'appareil'}
      </motion.button>

      {error && (
        <p className="mt-3 text-red-400 text-xs text-center px-4">{error}</p>
      )}

      {/* Formats supportés */}
      <p className="mt-2 text-gray-600 text-[10px] text-center">
        MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS
      </p>

      {/* Bouton ouvrir la file locale si elle existe */}
      {localQueue.length > 0 && (
        <motion.button
          onClick={() => setShowDrawer(true)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 text-cyan-400 text-xs font-medium hover:text-cyan-300 transition-colors"
        >
          <Music2 className="w-4 h-4" />
          {localQueue.length} fichier{localQueue.length > 1 ? 's' : ''} local{localQueue.length > 1 ? 'aux' : ''}
          <ChevronRight className="w-3.5 h-3.5" />
        </motion.button>
      )}

      {/* Drawer file locale */}
      <AnimatePresence>
        {showDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowDrawer(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              className="w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col"
              style={{ background: '#1a1a2e', maxHeight: '75dvh', paddingBottom: 'env(safe-area-inset-bottom,12px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <span className="text-white font-bold text-sm">Fichiers locaux</span>
                  <span className="text-[10px] text-gray-500 bg-white/10 px-1.5 py-0.5 rounded-full">{localQueue.length}</span>
                </div>
                <button onClick={() => setShowDrawer(false)} className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-4">
                {localQueue.map((song, idx) => (
                  <div key={song.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/[0.05] transition-colors group">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{song.title}</p>
                      <p className="text-gray-500 text-[11px] truncate">{song.artist}</p>
                    </div>
                    <button
                      onClick={() => playFromQueue(song, idx)}
                      className="p-2 rounded-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => removeFromQueue(idx)}
                      className="p-1.5 rounded-full text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-2 flex-shrink-0">
                <button
                  onClick={openPicker}
                  className="w-full py-3 rounded-xl bg-white/[0.07] text-gray-300 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  Ajouter d'autres fichiers
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocalFilePicker;
