/**
 * LocalPlayerPage — NovaSound TITAN LUX v8003
 *
 * Sélecteur de fichiers locaux — PAS d'audio element propre.
 * Tout passe par PlayerContext → AudioPlayer → NowPlayingScreen (vagues).
 * La cover change automatiquement via key={currentSong.id} dans NowPlayingScreen.
 */
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, HardDrive, WifiOff, ListMusic, Trash2, Plus, Check,
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <circle cx="100" cy="100" r="55" fill="rgba(0,0,0,0.25)"/>
    <text x="100" y="118" font-family="system-ui,sans-serif" font-size="64"
      font-weight="bold" fill="white" text-anchor="middle" opacity="0.9">${'${(title[0]||\"♫\").toUpperCase()}'}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
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
    _blobUrl:      url,
    _hasBlobCover: !!tags.cover,
    _coverBlobUrl: tags.cover || null,
  };
};

// ── SongRow ───────────────────────────────────────────────────────────────────
const SongRow = memo(({ song, isActive, onPlay, onRemove }) => (
  <div
    className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all group cursor-pointer ${
      isActive ? 'bg-white/10 border border-white/10' : 'hover:bg-white/[0.05]'
    }`}
    onClick={onPlay}
  >
    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
      <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
        {song.title}
      </p>
      <p className="text-[11px] text-gray-500 truncate">{song.artist}</p>
    </div>
    {isActive && (
      <div className="flex gap-px items-end h-3.5 flex-shrink-0">
        {[1,2,3].map(i => (
          <div key={i} className="w-0.5 rounded-full bg-cyan-400"
            style={{ height:`${5+i*3}px`, animation:`novaWave ${0.4+i*0.15}s ease-in-out infinite alternate`, animationDelay:`${i*0.1}s` }}
          />
        ))}
      </div>
    )}
    <button
      onClick={e => { e.stopPropagation(); onRemove(); }}
      className="p-1.5 rounded-full text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
));

// ═════════════════════════════════════════════════════════════════════════════
const LocalPlayerPage = () => {
  const inputRef = useRef(null);
  const { playSong, currentSong } = usePlayer();

  const [songs,   setSongs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [added,   setAdded]   = useState(false);

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
      const merged = [...prev, ...newSongs];
      if (prev.length === 0) {
        // 1er chargement → jouer le 1er fichier avec toute la liste
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
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl); }      catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const clearAll = () => {
    songs.forEach(s => {
      if (s._blobUrl)      try { URL.revokeObjectURL(s._blobUrl); }      catch (_) {}
      if (s._hasBlobCover) try { URL.revokeObjectURL(s._coverBlobUrl); } catch (_) {}
    });
    setSongs([]);
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
              Le lecteur principal avec les vagues s'ouvrira automatiquement.
            </p>
          </div>

          <motion.button onClick={openPicker} whileTap={{ scale:0.95 }} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white font-bold disabled:opacity-60"
            style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
            <FolderOpen className="w-5 h-5" />
            {loading ? 'Chargement…' : "Ouvrir depuis l'appareil"}
          </motion.button>

          <p className="text-gray-600 text-[11px]">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS</p>

          <div className="w-full grid grid-cols-3 gap-2">
            {[
              { icon:WifiOff,   c:'#22d3ee', label:'100% offline'  },
              { icon:HardDrive, c:'#4ade80', label:'Tous appareils' },
              { icon:ListMusic, c:'#a855f7', label:'Playlists'      },
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

        {/* Indicateur son en cours */}
        {currentSong?.is_local && (
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-cyan-500/20"
            style={{ background:'rgba(6,182,212,0.06)' }}>
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{currentSong.title}</p>
              <p className="text-cyan-400 text-[11px]">En lecture · swipe ↑ pour le plein écran</p>
            </div>
            <div className="flex gap-px items-end h-4 flex-shrink-0">
              {[1,2,3,4].map(i=>(
                <div key={i} className="w-0.5 rounded-full bg-cyan-400"
                  style={{ height:`${4+i*3}px`, animation:`novaWave ${0.4+i*0.12}s ease-in-out infinite alternate`, animationDelay:`${i*0.08}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Playlist */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
            <ListMusic className="w-4 h-4 text-cyan-400" />
            <span className="text-white text-sm font-bold">Playlist locale</span>
          </div>
          <div className="p-2 max-h-[60vh] overflow-y-auto">
            {songs.map((s, i) => (
              <SongRow key={s.id} song={s} isActive={i === activeIdx}
                onPlay={() => playFromQueue(i)} onRemove={() => removeFromQueue(i)} />
            ))}
          </div>
        </div>

        <button onClick={clearAll}
          className="text-xs text-gray-700 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 py-2">
          <Trash2 className="w-3.5 h-3.5" /> Vider la playlist locale
        </button>

      </div>
    </div>
  );
};

export default LocalPlayerPage;
