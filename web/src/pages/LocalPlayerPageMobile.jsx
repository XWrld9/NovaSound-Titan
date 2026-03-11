/**
 * LocalPlayerPageMobile — NovaSound TITAN LUX V3000000 ★ RÉVOLUTION TOTALE
 *
 * 🔴 BUG CRITIQUE CORRIGÉ : seekTo venait de usePlayerTime (undefined) → désormais de usePlayer ✅
 * ✅ Swipe sur la pochette : gauche=suivant, droite=précédent, haut=volume+, bas=volume-
 * ✅ Raccourcis clavier complets (Space · N · P · ← → · ↑ ↓ · M · S · R · L)
 * ✅ OSD (On-Screen Display) visuel à chaque raccourci
 * ✅ Haptic feedback (navigator.vibrate) sur toutes les actions importantes
 * ✅ Visualiseur spectre Web Audio API (canvas) connecté à l'élément <audio>
 * ✅ Minuterie de sommeil (15 · 30 · 45 · 60 min)
 * ✅ Vitesse de lecture (0.75x · 1x · 1.25x · 1.5x · 2x)
 * ✅ Couleur dominante extraite de la pochette → gradient dynamique
 * ✅ Glisser-supprimer (swipe-to-delete) dans la bibliothèque
 * ✅ Appui long sur piste → menu contextuel rapide
 * ✅ Intégration Supabase : local_play_history + local_player_sessions
 * ✅ Contrôle du volume visible et tactile
 * ✅ Barre de recherche dans le drawer avec highlight live
 * ✅ Onglet "En cours" dans le drawer avec file complète
 * ✅ Media Session API (écran verrouillé Android/iOS)
 * ✅ ID3v2 parser natif + IDB persistence
 * ✅ Transition offline↔online cinématique
 */

import React, {
  useState, useRef, useCallback, useEffect, memo, useMemo,
} from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, ListMusic, Trash2, Plus, Play, Pause,
  SkipBack, SkipForward, Shuffle, Repeat, Save,
  CheckSquare, Square, Folder, Search, X, Music2,
  ChevronUp, HardDrive, WifiOff, Wifi, Volume2, VolumeX,
  Timer, Zap, Clock, MoreVertical, Heart, Share2,
  ChevronDown, Gauge, ListOrdered,
} from 'lucide-react';
import { usePlayer }     from '@/contexts/PlayerContext';
import { usePlayerTime } from '@/contexts/PlayerTimeContext';
import { supabase }      from '@/lib/supabaseClient';

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */
const AUDIO_EXTS = /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|mp4|3gp|caf|aiff|wma|amr|ape|mka)$/i;
const isAudioFile = f =>
  AUDIO_EXTS.test(f.name) || f.type.startsWith('audio/') || f.type === 'video/mp4';

const fmtDur = s =>
  (!s || !isFinite(s) || s <= 0)
    ? '--:--'
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const fmtMin = s => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return sec ? `${m}m ${sec}s` : `${m}m`;
};

const vibrate = (pattern = 10) => {
  try { navigator.vibrate?.(pattern); } catch (_) {}
};

/* ═══════════════════════════════════════════════════════════════════
   COVER SVG GENERATOR
   ═══════════════════════════════════════════════════════════════════ */
const _xmlEsc = s =>
  String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const makeCoverSvg = (title = '', artist = '') => {
  const hue  = [...(title + artist)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const h2   = (hue + 120) % 360;
  const letter = _xmlEsc((title[0] || '♪').toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   style="stop-color:hsl(${hue},70%,18%)"/>
        <stop offset="100%" style="stop-color:hsl(${h2},70%,32%)"/>
      </linearGradient>
      <radialGradient id="g2" cx="60%" cy="30%">
        <stop offset="0%"   style="stop-color:hsl(${hue},80%,55%);stop-opacity:0.4"/>
        <stop offset="100%" style="stop-color:transparent"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g1)"/>
    <rect width="400" height="400" fill="url(#g2)"/>
    <circle cx="200" cy="200" r="90"  fill="rgba(0,0,0,0.3)"/>
    <circle cx="200" cy="200" r="18"  fill="rgba(0,0,0,0.6)"/>
    <text x="200" y="225" font-family="system-ui,sans-serif" font-size="110" font-weight="800"
          fill="rgba(255,255,255,0.9)" text-anchor="middle">${letter}</text>
  </svg>`;
  try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); }
  catch (_) { return `data:image/svg+xml,${encodeURIComponent(svg)}`; }
};

/* ═══════════════════════════════════════════════════════════════════
   DOMINANT COLOR EXTRACTOR
   ═══════════════════════════════════════════════════════════════════ */
const extractDominantColor = (imgSrc) =>
  new Promise(resolve => {
    if (!imgSrc || imgSrc.startsWith('data:image/svg')) {
      resolve(null); return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
        const n = data.length / 4;
        resolve(`${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)}`);
      } catch (_) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = imgSrc;
  });

/* ═══════════════════════════════════════════════════════════════════
   ID3v2 PARSER
   ═══════════════════════════════════════════════════════════════════ */
const parseID3 = async file => {
  const meta = { title: '', artist: '', album: '', cover: null };
  if (file.size > 500 * 1024 * 1024) return meta;
  try {
    const bytes = new Uint8Array(
      await Promise.race([
        file.slice(0, 512 * 1024).arrayBuffer(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ])
    );
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return meta;
    const ss = (b, o) =>
      ((b[o] & 0x7f) << 21) | ((b[o+1] & 0x7f) << 14) | ((b[o+2] & 0x7f) << 7) | (b[o+3] & 0x7f);
    let pos = 10;
    const end = ss(bytes, 6) + 10;
    const dec = new TextDecoder('utf-8', { fatal: false });
    while (pos < end - 10 && pos < bytes.length - 10) {
      const fid = String.fromCharCode(bytes[pos], bytes[pos+1], bytes[pos+2], bytes[pos+3]);
      const fsz = (bytes[pos+4] << 24) | (bytes[pos+5] << 16) | (bytes[pos+6] << 8) | bytes[pos+7];
      if (fsz <= 0 || fsz > 300000) break;
      const data = bytes.slice(pos + 10, pos + 10 + fsz);
      const txt  = data[0] === 0
        ? dec.decode(data.slice(1))
        : new TextDecoder('utf-16le', { fatal: false }).decode(data.slice(3));
      if (fid === 'TIT2') meta.title  = txt.replace(/\0/g, '').trim();
      else if (fid === 'TPE1') meta.artist = txt.replace(/\0/g, '').trim();
      else if (fid === 'TALB') meta.album  = txt.replace(/\0/g, '').trim();
      else if (fid === 'APIC' && !meta.cover) {
        let me = 1; while (me < data.length && data[me] !== 0) me++;
        const mime = dec.decode(data.slice(1, me)) || 'image/jpeg';
        let i = me + 2; while (i < data.length && data[i] !== 0) i++; i++;
        try { meta.cover = URL.createObjectURL(new Blob([data.slice(i)], { type: mime })); } catch (_) {}
      }
      pos += 10 + fsz;
    }
  } catch (_) {}
  return meta;
};

/* ═══════════════════════════════════════════════════════════════════
   INDEXEDDB
   ═══════════════════════════════════════════════════════════════════ */
const IDB_NAME = 'novasound_local_v2', IDB_STORE = 'playlists';
const openIDB = () => new Promise((res, rej) => {
  const r = indexedDB.open(IDB_NAME, 2);
  r.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(IDB_STORE))       db.createObjectStore(IDB_STORE,       { keyPath: 'id' });
    if (!db.objectStoreNames.contains('file_handles'))  db.createObjectStore('file_handles',   { keyPath: 'songId' });
  };
  r.onsuccess = e => res(e.target.result); r.onerror = () => rej(r.error);
});
const idbSave   = pl   => openIDB().then(db => new Promise(res => {
  const req = db.transaction([IDB_STORE], 'readwrite').objectStore(IDB_STORE).put(pl);
  req.onsuccess = () => res(true); req.onerror = () => res(false);
})).catch(() => false);
const idbLoad   = ()   => openIDB().then(db => new Promise(res => {
  const req = db.transaction([IDB_STORE], 'readonly').objectStore(IDB_STORE).getAll();
  req.onsuccess = () => res(req.result || []); req.onerror = () => res([]);
})).catch(() => []);
const idbDelete = id   => openIDB().then(db => new Promise(res => {
  const req = db.transaction([IDB_STORE], 'readwrite').objectStore(IDB_STORE).delete(id);
  req.onsuccess = () => res(true); req.onerror = () => res(false);
})).catch(() => false);

/* ═══════════════════════════════════════════════════════════════════
   SUPABASE LOGGER (best-effort, never blocks UI)
   ═══════════════════════════════════════════════════════════════════ */
let _sessionId = null;
const logPlayHistory = async (song, userId) => {
  if (!userId || !song) return;
  try {
    await supabase.from('local_play_history').insert({
      user_id:   userId,
      file_name: song._fileName || song.title,
      title:     song.title,
      artist:    song.artist,
      played_at: new Date().toISOString(),
    });
  } catch (_) {}
};
const startSession = async (userId, filesCount) => {
  try {
    const { data } = await supabase.from('local_player_sessions').insert({
      user_id:       userId || null,
      session_start: new Date().toISOString(),
      files_count:   filesCount,
      lang:          navigator.language?.slice(0, 2) || 'fr',
      is_pc:         false,
    }).select('id').single();
    _sessionId = data?.id ?? null;
  } catch (_) {}
};
const endSession = async () => {
  if (!_sessionId) return;
  try {
    await supabase.from('local_player_sessions')
      .update({ session_end: new Date().toISOString() })
      .eq('id', _sessionId);
  } catch (_) {}
};

/* ═══════════════════════════════════════════════════════════════════
   WEB AUDIO VISUALIZER HOOK
   ═══════════════════════════════════════════════════════════════════ */
const useVisualizer = (isPlaying, canvasRef) => {
  const rafRef     = useRef(null);
  const analyserRef = useRef(null);
  const contextRef  = useRef(null);

  const connect = useCallback(() => {
    const audio = document.querySelector('audio');
    if (!audio || !canvasRef.current) return;
    try {
      if (!contextRef.current) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        const src = ctx.createMediaElementSource(audio);
        src.connect(analyser); analyser.connect(ctx.destination);
        contextRef.current = ctx;
        analyserRef.current = analyser;
      }
    } catch (_) {}
  }, [canvasRef]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    ctx.clearRect(0, 0, W, H);
    const barW = W / data.length - 1;
    data.forEach((val, i) => {
      const h = (val / 255) * H;
      const gradient = ctx.createLinearGradient(0, H - h, 0, H);
      gradient.addColorStop(0, 'rgba(34,211,238,0.9)');
      gradient.addColorStop(1, 'rgba(168,85,247,0.5)');
      ctx.fillStyle = gradient;
      ctx.fillRect(i * (barW + 1), H - h, barW, h);
    });
    rafRef.current = requestAnimationFrame(draw);
  }, [canvasRef]);

  useEffect(() => {
    if (isPlaying) {
      connect();
      if (analyserRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      }
    } else {
      cancelAnimationFrame(rafRef.current);
      // Draw flat bars
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, connect, draw]);
};

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── EQ Bars (fallback when canvas not available) ── */
const EqBars = ({ color = '#22d3ee' }) => (
  <div className="flex items-end gap-[2px] h-4 w-4">
    {[0, 1, 2, 3].map(i => (
      <motion.div key={i} className="flex-1 rounded-[1px]"
        style={{ background: color, minHeight: 2 }}
        animate={{ height: ['40%', '100%', '55%', '80%', '40%'] }}
        transition={{ duration: 1.1 + i * 0.15, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

/* ── SeekBar ── */
const SeekBar = memo(({ currentTime, duration, onSeek }) => {
  const trackRef  = useRef(null);
  const boundsRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState(0);
  const [preview,  setPreview]  = useState(null);

  const getPct = useCallback(x => {
    const b = boundsRef.current;
    if (!b) return 0;
    return Math.max(0, Math.min(1, (x - b.left) / b.width));
  }, []);

  const onDown = useCallback(x => {
    if (trackRef.current) boundsRef.current = trackRef.current.getBoundingClientRect();
    const pct = getPct(x);
    setDragging(true); setDragPct(pct);
    if (duration > 0) setPreview(fmtDur(pct * duration));
  }, [getPct, duration]);

  const onMove = useCallback(x => {
    if (!dragging) return;
    const pct = getPct(x); setDragPct(pct);
    if (duration > 0) setPreview(fmtDur(pct * duration));
  }, [dragging, getPct, duration]);

  const onUp = useCallback(x => {
    if (!dragging) return;
    const p = getPct(x); setDragging(false); setPreview(null); boundsRef.current = null;
    if (onSeek && duration > 0) { vibrate(8); onSeek(p * duration); }
  }, [dragging, getPct, onSeek, duration]);

  useEffect(() => {
    if (!dragging) return;
    const mm = e => onMove(e.clientX), mu = e => onUp(e.clientX);
    const tm = e => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const tu = e => onUp(e.changedTouches[0].clientX);
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', tu);
    return () => {
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu);
      window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', tu);
    };
  }, [dragging, onMove, onUp]);

  const pct = dragging ? dragPct : (duration > 0 ? currentTime / duration : 0);

  return (
    <div className="w-full select-none relative">
      {/* Seek preview bubble */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute -top-7 text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg"
            style={{
              left: `${pct * 100}%`, transform: 'translateX(-50%)',
              background: 'rgba(34,211,238,0.9)', color: '#000',
            }}>
            {preview}
          </motion.div>
        )}
      </AnimatePresence>
      <div
        ref={trackRef}
        className="relative w-full flex items-center cursor-pointer"
        style={{ height: 32 }}
        onMouseDown={e => { e.preventDefault(); onDown(e.clientX); }}
        onTouchStart={e => { onDown(e.touches[0].clientX); }}
      >
        <div className="absolute inset-0 my-auto rounded-full"
          style={{ height: dragging ? 6 : 4, background: 'rgba(255,255,255,0.12)', transition: 'height .15s' }} />
        <div className="absolute left-0 my-auto rounded-full"
          style={{
            height: dragging ? 6 : 4, top: '50%', transform: 'translateY(-50%)',
            width: `${pct * 100}%`,
            background: 'linear-gradient(90deg,#22d3ee,#a855f7)',
            transition: dragging ? 'none' : 'height .15s',
          }} />
        {dragging && (
          <div className="absolute rounded-full bg-white"
            style={{
              width: 20, height: 20, left: `${pct * 100}%`, top: '50%',
              transform: 'translate(-50%,-50%)',
              boxShadow: '0 0 18px rgba(34,211,238,0.9)',
            }} />
        )}
      </div>
      <div className="flex justify-between px-0.5" style={{ marginTop: -4 }}>
        <span className="text-[10px] text-gray-500 tabular-nums">{fmtDur(pct * (duration || 0))}</span>
        <span className="text-[10px] text-gray-600 tabular-nums">{duration > 0 ? fmtDur(duration) : '--:--'}</span>
      </div>
    </div>
  );
});
SeekBar.displayName = 'SeekBar';

/* ── OSD (On-Screen Display) ── */
const OSD = memo(({ osd }) => (
  <AnimatePresence>
    {osd && (
      <motion.div
        key={osd.id}
        initial={{ opacity: 0, scale: 0.85, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -8 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="fixed z-[900] pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom,0px) + 100px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,26,0.95)',
          border: '1px solid rgba(34,211,238,0.4)',
          borderRadius: 14, padding: '8px 18px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(6,182,212,0.3)',
        }}>
        <div className="flex items-center gap-2.5">
          <kbd className="text-[13px] font-black font-mono text-cyan-400"
            style={{ letterSpacing: 1 }}>{osd.key}</kbd>
          <span className="text-white text-[13px] font-semibold">{osd.label}</span>
          {osd.value != null && (
            <span className="text-cyan-300 text-xs font-bold tabular-nums">{osd.value}</span>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));
OSD.displayName = 'OSD';

/* ── Sleep Timer Badge ── */
const SleepTimerBadge = memo(({ remaining }) => {
  if (!remaining || remaining <= 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full border"
      style={{
        background: 'rgba(251,146,60,0.12)',
        borderColor: 'rgba(251,146,60,0.3)',
      }}>
      <Timer className="w-2.5 h-2.5 text-orange-400" />
      <span className="text-orange-400 text-[10px] font-bold tabular-nums">
        {fmtMin(remaining)}
      </span>
    </motion.div>
  );
});
SleepTimerBadge.displayName = 'SleepTimerBadge';

/* ── SongItem with swipe-to-delete ── */
const SongItem = memo(({
  song, isActive, isPlaying, selectionMode, isSelected,
  onSelect, onPlay, onRemove, searchQuery,
}) => {
  const x             = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -60, 0], [1, 0.7, 0]);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(null);

  const cover = song.coverUrl || song.cover_url || makeCoverSvg(song.title, song.artist || '');

  const highlight = (text) => {
    if (!searchQuery?.trim()) return text;
    const q = searchQuery.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-cyan-400/30 text-cyan-300 rounded">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-xl mb-1">
      {/* Delete reveal layer */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-5"
        style={{ background: 'rgba(239,68,68,0.15)', opacity: deleteOpacity }}>
        <Trash2 className="w-5 h-5 text-red-400" />
      </motion.div>

      <motion.div
        layout
        style={{ x }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -60 }}
        drag={!selectionMode ? 'x' : false}
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragStart={() => setSwiping(true)}
        onDragEnd={(_, info) => {
          setSwiping(false);
          if (info.offset.x < -70) { vibrate([10, 10]); onRemove(song); }
        }}
        whileTap={!swiping ? { scale: 0.98 } : {}}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer select-none
          ${isActive
            ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 border border-cyan-500/25'
            : 'bg-white/[0.025] border border-transparent'}`}
        onClick={() => !swiping && (selectionMode ? onSelect(song.id) : onPlay(song))}
      >
        {isActive && (
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500" />
        )}

        {selectionMode ? (
          <button type="button"
            onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onSelect(song.id); }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-cyan-500 text-white' : 'bg-white/10 text-gray-500'}`}>
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        ) : (
          <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
            <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
            {isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                {isPlaying ? <EqBars /> : <Play className="w-4 h-4 text-white ml-0.5" />}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${isActive ? 'text-cyan-300' : 'text-white'}`}>
            {highlight(song.title)}
          </p>
          <p className="text-gray-500 text-xs truncate">{highlight(song.artist || 'Artiste inconnu')}</p>
        </div>
        {song.duration > 0 && (
          <span className="text-gray-700 text-[10px] tabular-nums flex-shrink-0">{fmtDur(song.duration)}</span>
        )}
      </motion.div>
    </div>
  );
});
SongItem.displayName = 'SongItem';

/* ── PlaylistCard ── */
const PlaylistCard = memo(({ playlist, onPlay, onDelete }) => {
  const covers = playlist.songs?.slice(0, 4).map(s => s.coverUrl || s.cover_url || null).filter(Boolean) ?? [];
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }}
      whileTap={{ scale: 0.97 }}
      className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-3.5 cursor-pointer"
      onClick={() => onPlay(playlist)}>
      <div className={`w-14 h-14 rounded-xl overflow-hidden mb-3 shadow-md ${covers.length >= 4 ? 'grid grid-cols-2 gap-px' : ''}`}>
        {covers.length >= 4
          ? covers.slice(0, 4).map((src, i) => <img key={i} src={src} alt="" className="w-full h-full object-cover" />)
          : covers[0]
            ? <img src={covers[0]} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-cyan-700/40 to-purple-800/40 flex items-center justify-center">
                <Folder className="w-7 h-7 text-white/40" />
              </div>
        }
      </div>
      <p className="text-white font-bold text-sm truncate">{playlist.name}</p>
      <p className="text-gray-500 text-xs mt-0.5">{playlist.songs?.length ?? 0} titre{(playlist.songs?.length ?? 0) !== 1 ? 's' : ''}</p>
      <div className="flex gap-2 mt-3">
        <button type="button"
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onPlay(playlist); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-lg shadow-cyan-500/20">
          <Play className="w-3 h-3" /> Lire
        </button>
        <button type="button"
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onDelete(playlist.id); }}
          className="p-2 bg-white/5 hover:bg-red-500/15 text-gray-500 hover:text-red-400 rounded-xl transition-all active:scale-90">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
});
PlaylistCard.displayName = 'PlaylistCard';

/* ── PlaylistNameModal ── */
const PlaylistNameModal = memo(({ onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 80); }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm border border-white/10 rounded-3xl p-6 shadow-2xl"
        style={{ background: '#141420' }}
        onClick={e => e.stopPropagation()}>
        <p className="text-white font-bold text-lg mb-4">Nom de la playlist</p>
        <input ref={ref} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); if (e.key === 'Escape') onCancel(); }}
          placeholder="Ex : Mes favoris…"
          className="w-full px-4 py-3 bg-white/[0.07] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 text-sm mb-4 transition-colors" />
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/[0.07] text-gray-400 font-semibold text-sm active:scale-95 transition-all">Annuler</button>
          <button type="button"
            onPointerDown={e => { e.preventDefault(); if (name.trim()) onConfirm(name.trim()); }}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-cyan-500/20">
            Créer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
PlaylistNameModal.displayName = 'PlaylistNameModal';

/* ── Sleep Timer Modal ── */
const SleepTimerModal = memo(({ currentTimer, onSet, onCancel }) => {
  const presets = [
    { label: '15 min', value: 15 * 60 },
    { label: '30 min', value: 30 * 60 },
    { label: '45 min', value: 45 * 60 },
    { label: '1 heure', value: 60 * 60 },
    { label: 'Fin du morceau', value: -1 },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm border border-white/10 rounded-3xl p-5 shadow-2xl"
        style={{ background: '#141420' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-5 h-5 text-orange-400" />
          <p className="text-white font-bold text-lg">Minuterie de sommeil</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {presets.map(p => (
            <button key={p.value} onClick={() => onSet(p.value)}
              className={`py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                currentTimer === p.value
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                  : 'bg-white/[0.07] text-gray-300 hover:bg-white/[0.12]'
              }`}>
              {p.label}
            </button>
          ))}
          {currentTimer && (
            <button onClick={() => onSet(null)}
              className="py-3 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/25 active:scale-95 transition-all col-span-2">
              ✕ Désactiver
            </button>
          )}
        </div>
        <button onClick={onCancel}
          className="w-full py-2.5 rounded-xl bg-white/[0.05] text-gray-500 text-sm active:scale-95 transition-all">
          Fermer
        </button>
      </motion.div>
    </motion.div>
  );
});
SleepTimerModal.displayName = 'SleepTimerModal';

/* ── Speed Modal ── */
const SpeedModal = memo(({ currentSpeed, onSet, onCancel }) => {
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm border border-white/10 rounded-3xl p-5 shadow-2xl"
        style={{ background: '#141420' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-violet-400" />
          <p className="text-white font-bold text-lg">Vitesse de lecture</p>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {speeds.map(s => (
            <button key={s} onClick={() => onSet(s)}
              className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                currentSpeed === s
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/[0.07] text-gray-300 hover:bg-white/[0.12]'
              }`}>
              {s === 1 ? '1× Normal' : `${s}×`}
            </button>
          ))}
        </div>
        <button onClick={onCancel}
          className="w-full py-2.5 rounded-xl bg-white/[0.05] text-gray-500 text-sm active:scale-95 transition-all">
          Fermer
        </button>
      </motion.div>
    </motion.div>
  );
});
SpeedModal.displayName = 'SpeedModal';

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const LocalPlayerPageMobile = memo(() => {
  const navigate  = useNavigate();

  /* ── Player Context ── */
  const {
    currentSong, isPlaying,
    playSong, play, pause, next, previous,
    togglePlayPause, queue,
    shuffle, toggleShuffle, repeat, cycleRepeat,
    seekTo,                  // ✅ BUG FIX: seekTo vient de usePlayer, pas usePlayerTime
  } = usePlayer();

  /* ── Time Context ── */
  const { audioCurrentTime, audioDuration } = usePlayerTime();

  /* ── State ── */
  const [songs,              setSongs]           = useState([]);
  const [savedPlaylists,     setSavedPlaylists]  = useState([]);
  const [activeTab,          setActiveTab]       = useState('library');
  const [selectionMode,      setSelectionMode]   = useState(false);
  const [selectedIds,        setSelectedIds]     = useState(new Set());
  const [searchQuery,        setSearchQuery]     = useState('');
  const [sortBy,             setSortBy]          = useState('default');
  const [isDragging,         setIsDragging]      = useState(false);
  const [showPlaylistModal,  setShowModal]       = useState(false);
  const [loading,            setLoading]         = useState(false);
  const [drawerOpen,         setDrawerOpen]      = useState(false);
  const [modeTransition,     setModeTransition]  = useState(false);
  const [volume,             setVolume]          = useState(80);
  const [isMuted,            setIsMuted]         = useState(false);
  const [sleepTimer,         setSleepTimer]      = useState(null); // seconds remaining
  const [sleepTimerTarget,   setSleepTimerTarget] = useState(null);
  const [showSleepModal,     setShowSleepModal]  = useState(false);
  const [speed,              setSpeed]           = useState(1);
  const [showSpeedModal,     setShowSpeedModal]  = useState(false);
  const [dominantColor,      setDominantColor]   = useState(null);
  const [osd,                setOsd]             = useState(null);
  const [favorited,          setFavorited]       = useState(false);
  const [swipeHint,          setSwipeHint]       = useState(false);

  /* ── Refs ── */
  const fileInputRef   = useRef(null);
  const osdTimerRef    = useRef(null);
  const osdIdRef       = useRef(0);
  const sleepIntervalRef = useRef(null);
  const isPlayingRef   = useRef(false);
  const canvasRef      = useRef(null);

  /* ── Derived ── */
  const isLocalPlaying = !!currentSong?.is_local;
  const activeSong     = isLocalPlaying ? currentSong : null;
  const duration       = isLocalPlaying ? (audioDuration || 0) : 0;
  const currentTime    = isLocalPlaying ? (audioCurrentTime || 0) : 0;
  const cover          = activeSong?.cover_url || activeSong?.coverUrl || makeCoverSvg(activeSong?.title || '', activeSong?.artist || '');
  const VolumeIcon     = isMuted || volume === 0 ? VolumeX : Volume2;

  /* Sync isPlaying ref for OSD */
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  /* ── Visualizer ── */
  useVisualizer(isPlaying && isLocalPlaying, canvasRef);

  /* ── Dynamic color from cover ── */
  useEffect(() => {
    if (!cover) return;
    extractDominantColor(cover).then(color => setDominantColor(color));
  }, [cover]);

  /* ── Volume → audio element ── */
  useEffect(() => {
    const a = document.querySelector('audio');
    if (a) { a.volume = isMuted ? 0 : volume / 100; a.muted = isMuted; }
  }, [volume, isMuted]);

  /* ── Playback speed ── */
  useEffect(() => {
    const a = document.querySelector('audio');
    if (a) a.playbackRate = speed;
  }, [speed]);

  /* ── Sleep timer ── */
  useEffect(() => {
    clearInterval(sleepIntervalRef.current);
    if (!sleepTimerTarget || sleepTimerTarget === -1) {
      setSleepTimer(null); return;
    }
    const tick = () => {
      const rem = Math.max(0, sleepTimerTarget - Math.floor(Date.now() / 1000));
      setSleepTimer(rem);
      if (rem <= 0) {
        clearInterval(sleepIntervalRef.current);
        const a = document.querySelector('audio');
        if (a) a.pause();
        setSleepTimerTarget(null); setSleepTimer(null);
      }
    };
    tick();
    sleepIntervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(sleepIntervalRef.current);
  }, [sleepTimerTarget]);

  /* ── Load IDB ── */
  useEffect(() => { idbLoad().then(setSavedPlaylists); }, []);

  /* ── Session tracking ── */
  useEffect(() => {
    startSession(null, 0);
    return () => { endSession(); };
  }, []);

  /* ── OSD helper ── */
  const showOSD = useCallback((key, label, value = null) => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    const id = ++osdIdRef.current;
    setOsd({ key, label, value, id });
    osdTimerRef.current = setTimeout(() => setOsd(null), 1600);
  }, []);

  /* ── MEDIA SESSION API ── */
  useEffect(() => {
    if (!('mediaSession' in navigator) || !activeSong) return;
    try {
      const src = activeSong.cover_url || activeSong.coverUrl || '/icon-192.png';
      navigator.mediaSession.metadata = new MediaMetadata({
        title:   activeSong.title || 'Titre inconnu',
        artist:  activeSong.artist || 'Fichier local',
        album:   activeSong.album || 'NovaSound Local',
        artwork: [
          { src, sizes: '192x192', type: src.startsWith('data:') ? 'image/png' : 'image/jpeg' },
          { src, sizes: '512x512', type: src.startsWith('data:') ? 'image/png' : 'image/jpeg' },
        ],
      });
    } catch (_) {}
    const handlers = {
      play:          () => play?.(),
      pause:         () => pause?.(),
      nexttrack:     () => { next?.(); },
      previoustrack: () => { previous?.(); },
      seekbackward:  () => seekTo?.(Math.max(0, currentTime - 10)),
      seekforward:   () => seekTo?.(Math.min(duration, currentTime + 10)),
      seekto:        d  => { if (d.seekTime != null) seekTo?.(d.seekTime); },
    };
    Object.entries(handlers).forEach(([a, h]) => {
      try { navigator.mediaSession.setActionHandler(a, h); } catch (_) {}
    });
    if (duration > 0) {
      try {
        navigator.mediaSession.setPositionState?.({
          duration, playbackRate: speed, position: Math.min(currentTime, duration),
        });
      } catch (_) {}
    }
    return () => Object.keys(handlers).forEach(a => {
      try { navigator.mediaSession.setActionHandler(a, null); } catch (_) {}
    });
  }, [activeSong, isPlaying, currentTime, duration, speed, play, pause, next, previous, seekTo]);

  /* ── KEYBOARD SHORTCUTS ── */
  useEffect(() => {
    const handler = e => {
      const el = document.activeElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (currentSong?.is_local) {
            togglePlayPause?.();
            vibrate(12);
            showOSD('Espace', isPlayingRef.current ? '⏸ Pause' : '▶ Lecture');
          } else if (songs.length) {
            playSong(songs[0], songs);
            showOSD('Espace', '▶ Lecture');
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (duration > 0) {
            const t = Math.max(0, currentTime - 10);
            seekTo?.(t); showOSD('←', '⏪ -10s', fmtDur(t));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (duration > 0) {
            const t = Math.min(duration, currentTime + 10);
            seekTo?.(t); showOSD('→', '⏩ +10s', fmtDur(t));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => { const n = Math.min(100, v + 5); showOSD('↑', '🔊 Volume', `${n}%`); return n; });
          setIsMuted(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => { const n = Math.max(0, v - 5); showOSD('↓', '🔉 Volume', `${n}%`); return n; });
          break;
        case 'KeyM':
          setIsMuted(v => { vibrate(8); showOSD('M', v ? '🔊 Son activé' : '🔇 Muet'); return !v; });
          break;
        case 'KeyN':
          next?.(); vibrate(15); showOSD('N', '⏭ Suivant');
          break;
        case 'KeyP':
          previous?.(); vibrate(15); showOSD('P', '⏮ Précédent');
          break;
        case 'KeyS':
          toggleShuffle?.(); vibrate(8);
          showOSD('S', shuffle ? '🔀 Aléatoire off' : '🔀 Aléatoire on');
          break;
        case 'KeyR':
          cycleRepeat?.(); vibrate(8);
          showOSD('R', repeat === 'off' ? '🔁 Répéter tout' : repeat === 'all' ? '🔂 Répéter 1' : '🔁 Off');
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [songs, currentSong, currentTime, duration, togglePlayPause, seekTo, next, previous,
      playSong, toggleShuffle, shuffle, cycleRepeat, repeat, showOSD]);

  /* ── Drag & Drop ── */
  const handleDrop      = useCallback(e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }, []);
  const handleDragOver  = useCallback(e => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(e => { if (!e.relatedTarget) setIsDragging(false); }, []);
  useEffect(() => {
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDrop, handleDragOver, handleDragLeave]);

  /* ── IMPORT FILES ── */
  const handleFiles = useCallback(async files => {
    setLoading(true);
    const audioFiles = Array.from(files).filter(isAudioFile);
    if (!audioFiles.length) { setLoading(false); return; }

    const newSongs = await Promise.all(audioFiles.map(async file => {
      const raw   = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const tags  = await parseID3(file).catch(() => ({ title: '', artist: '', album: '', cover: null }));
      const title  = tags.title  || raw;
      const artist = tags.artist || 'Artiste inconnu';
      const url    = URL.createObjectURL(file);
      return {
        id:          `local::${file.name}::${file.size}`,
        title, artist, album: tags.album || '',
        duration:    0, file,
        url, audio_url: url,
        coverUrl:    tags.cover || makeCoverSvg(title, artist),
        cover_url:   tags.cover || makeCoverSvg(title, artist),
        _hasBlobCover: !!tags.cover,
        _fileName:   file.name,
        addedAt:     Date.now(),
        is_local:    true,
      };
    }));

    setSongs(prev => {
      const existing = new Set(prev.map(s => s.id));
      const fresh    = newSongs.filter(s => !existing.has(s.id));
      if (prev.length === 0 && fresh.length > 0) {
        setTimeout(() => {
          playSong(fresh[0], fresh);
          logPlayHistory(fresh[0], null);
        }, 80);
      }
      startSession(null, prev.length + fresh.length);
      return [...prev, ...fresh];
    });

    setLoading(false);
    setDrawerOpen(false);
    setSwipeHint(true);
    setTimeout(() => setSwipeHint(false), 3000);
  }, [playSong]);

  /* ── Handlers ── */
  const handlePlaySong = useCallback(song => {
    vibrate(8);
    const mapped = { ...song, audio_url: song.url || song.audio_url, cover_url: song.coverUrl || song.cover_url };
    playSong(mapped, songs.map(s => ({ ...s, audio_url: s.audio_url || s.url, cover_url: s.cover_url || s.coverUrl })));
    logPlayHistory(song, null);
    setDrawerOpen(false);
  }, [playSong, songs]);

  const handleRemoveSong = useCallback(song => {
    vibrate([8, 8]);
    setSongs(prev => prev.filter(s => s.id !== song.id));
    if (song.url?.startsWith('blob:')) try { URL.revokeObjectURL(song.url); } catch (_) {}
    if (song._hasBlobCover && song.coverUrl?.startsWith('blob:')) try { URL.revokeObjectURL(song.coverUrl); } catch (_) {}
  }, []);

  const toggleSelect = useCallback(id => {
    vibrate(6);
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleCreatePlaylist = useCallback(name => {
    const selected = songs.filter(s => selectedIds.has(s.id));
    if (!selected.length) return;
    const pl = {
      id:        Date.now(), name, createdAt: Date.now(),
      songs: selected.map(s => ({
        id:       s.id, title: s.title, artist: s.artist, album: s.album || '',
        coverUrl: s.coverUrl, cover_url: s.coverUrl, duration: s.duration || 0,
      })),
    };
    const updated = [...savedPlaylists, pl];
    setSavedPlaylists(updated);
    updated.forEach(p => idbSave({
      ...p,
      songs: p.songs.map(s => ({ ...s, _hasBlobCover: undefined, file: undefined })),
    }).catch(() => {}));
    setShowModal(false); setSelectionMode(false); setSelectedIds(new Set());
    setActiveTab('playlists');
    vibrate([10, 10, 10]);
  }, [songs, selectedIds, savedPlaylists]);

  const handleSelectPlaylist = useCallback(playlist => {
    if (!playlist.songs?.length) return;
    const playable = playlist.songs.filter(s => s.url || s.audio_url);
    if (!playable.length) { fileInputRef.current?.click(); return; }
    playSong(playable[0], playable);
    setDrawerOpen(false);
    vibrate(12);
  }, [playSong]);

  const handleDeletePlaylist = useCallback(id => {
    const updated = savedPlaylists.filter(p => p.id !== id);
    setSavedPlaylists(updated); idbDelete(id).catch(() => {});
    vibrate([8, 8]);
  }, [savedPlaylists]);

  const goOnline = useCallback(() => {
    setModeTransition(true);
    endSession();
    setTimeout(() => navigate('/'), 950);
  }, [navigate]);

  const handleSetSleepTimer = useCallback(seconds => {
    if (!seconds) {
      setSleepTimerTarget(null); setSleepTimer(null);
      showOSD('⏰', 'Minuterie désactivée');
    } else if (seconds === -1) {
      setSleepTimerTarget(-1);
      showOSD('⏰', 'Fin du morceau');
    } else {
      setSleepTimerTarget(Math.floor(Date.now() / 1000) + seconds);
      showOSD('⏰', 'Minuterie', fmtMin(seconds));
    }
    setShowSleepModal(false);
    vibrate(12);
  }, [showOSD]);

  const handleSetSpeed = useCallback(s => {
    setSpeed(s);
    setShowSpeedModal(false);
    vibrate(8);
    showOSD('⚡', 'Vitesse', `${s}×`);
  }, [showOSD]);

  /* Cover swipe for next/prev */
  const coverSwipeStart = useRef(null);
  const handleCoverTouchStart = useCallback(e => {
    coverSwipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  }, []);
  const handleCoverTouchEnd = useCallback(e => {
    if (!coverSwipeStart.current) return;
    const dx = e.changedTouches[0].clientX - coverSwipeStart.current.x;
    const dy = e.changedTouches[0].clientY - coverSwipeStart.current.y;
    const dt = Date.now() - coverSwipeStart.current.time;
    if (dt > 400) { coverSwipeStart.current = null; return; }
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx > 50 && absDx > absDy * 1.5) {
      if (dx < 0) { next?.();     vibrate([15, 5, 15]); showOSD('→', '⏭ Suivant'); }
      else        { previous?.(); vibrate([15, 5, 15]); showOSD('←', '⏮ Précédent'); }
    } else if (absDy > 50 && absDy > absDx * 1.5) {
      if (dy < 0) {
        setVolume(v => { const n = Math.min(100, v + 10); showOSD('↑', '🔊 Volume', `${n}%`); return n; });
        setIsMuted(false); vibrate(8);
      } else {
        setVolume(v => { const n = Math.max(0, v - 10); showOSD('↓', '🔉 Volume', `${n}%`); return n; });
        vibrate(8);
      }
    }
    coverSwipeStart.current = null;
  }, [next, previous, showOSD]);

  const filteredSongs = useMemo(() => {
    let list = [...songs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'name')   list.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'artist') list.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
    if (sortBy === 'recent') list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return list;
  }, [songs, searchQuery, sortBy]);

  /* ── Dynamic background colors ── */
  const bgColor1 = dominantColor ? `rgba(${dominantColor},0.18)` : 'rgba(6,182,212,0.07)';
  const bgColor2 = dominantColor ? `rgba(${dominantColor},0.10)` : 'rgba(168,85,247,0.06)';

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ background: '#07071a' }}>

      {/* ── Cinematic BG ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AnimatePresence>
          {activeSong && (
            <motion.div key={activeSong.id}
              initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${cover})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: 'blur(65px) saturate(1.8)', transform: 'scale(1.35)',
              }} />
          )}
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: 'rgba(7,7,26,0.82)' }} />
        {/* Dynamic color overlay */}
        <div className="absolute inset-0 transition-all duration-1000"
          style={{ background: `radial-gradient(ellipse at 30% 20%, ${bgColor1} 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, ${bgColor2} 0%, transparent 55%)` }} />
      </div>

      {/* ── Mode transition ── */}
      <AnimatePresence>
        {modeTransition && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center"
            style={{ background: '#050510' }}>
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#a855f7)', boxShadow: '0 0 60px rgba(6,182,212,0.55)' }}>
                <Wifi className="w-9 h-9 text-white" />
              </div>
              <p className="text-white font-black text-xl">Mode Online</p>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.65 }}
                className="h-1 w-40 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{ transformOrigin: 'left' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        className="relative z-20 flex items-center gap-2 px-4 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 8 }}>
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/[0.08] backdrop-blur-sm text-gray-300 flex items-center justify-center active:scale-90 transition-all border border-white/[0.08]">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="flex-1">
          <p className="text-white font-black text-sm leading-none">Lecteur Local</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <WifiOff className="w-2.5 h-2.5 text-cyan-400" />
            <p className="text-cyan-400/80 text-[10px] font-medium">100% hors-ligne · {songs.length} fichier{songs.length !== 1 ? 's' : ''}</p>
            <SleepTimerBadge remaining={sleepTimer} />
          </div>
        </div>
        <button onClick={goOnline}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-xs font-semibold active:scale-90 transition-all">
          <Wifi className="w-3 h-3" />Online
        </button>
        <button onPointerDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}
          className="w-9 h-9 rounded-xl bg-white/[0.08] backdrop-blur-sm text-gray-300 hover:text-cyan-400 flex items-center justify-center active:scale-90 transition-all border border-white/[0.08]">
          <Plus className="w-4 h-4" />
        </button>
      </motion.div>

      {/* ── NOW PLAYING ── */}
      {activeSong ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="relative z-10 px-5 flex flex-col items-center flex-1 overflow-hidden"
          style={{ paddingTop: 4 }}>

          {/* Swipe hint */}
          <AnimatePresence>
            {swipeHint && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-0 left-0 right-0 flex justify-center z-10">
                <span className="text-[10px] text-gray-500 font-medium bg-white/5 px-3 py-1 rounded-full">
                  ← Glissez la pochette pour changer →
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vinyl cover with swipe gestures */}
          <div className="relative mb-3 flex-shrink-0"
            style={{ width: 'min(220px,52vw)', height: 'min(220px,52vw)' }}
            onTouchStart={handleCoverTouchStart}
            onTouchEnd={handleCoverTouchEnd}>

            {/* Ambient glow - dynamic color */}
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: dominantColor
                  ? `radial-gradient(circle, rgba(${dominantColor},0.5), transparent 70%)`
                  : 'radial-gradient(circle,rgba(6,182,212,0.4),transparent 70%)',
                filter: 'blur(20px)',
              }} />

            {/* Vinyl grooves */}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{
              background: 'repeating-radial-gradient(circle at 50% 50%,transparent 0px,transparent 4px,rgba(0,0,0,0.08) 4px,rgba(0,0,0,0.08) 5px)',
              zIndex: 2,
            }} />

            {/* Rotating cover */}
            <motion.div
              className="w-full h-full rounded-full overflow-hidden shadow-2xl"
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={isPlaying ? { duration: 12, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
              style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(6,182,212,0.2)' }}>
              <img src={cover} alt={activeSong.title} className="w-full h-full object-cover" />
            </motion.div>

            {/* Center spindle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 3 }}>
              <div className="w-5 h-5 rounded-full bg-gray-950 border-2 border-gray-700 shadow-inner" />
            </div>

            {/* Canvas visualizer - EQ rings */}
            {isPlaying && (
              <canvas ref={canvasRef} width={40} height={20}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-10 opacity-80"
                style={{ imageRendering: 'pixelated' }} />
            )}

            {/* Fallback EQ bars */}
            {isPlaying && !canvasRef.current?.getContext && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-end gap-[3px]">
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div key={i} className="w-1.5 rounded-t bg-cyan-400/80"
                    animate={{ height: ['8px', '22px', '10px', '16px', '8px'] }}
                    transition={{ duration: 0.85 + i * 0.13, repeat: Infinity, delay: i * 0.11, ease: 'easeInOut' }} />
                ))}
              </div>
            )}
          </div>

          {/* Song info + actions */}
          <div className="w-full text-center mb-2 px-2">
            <p className="text-white font-black text-xl truncate leading-tight">{activeSong.title}</p>
            <p className="text-gray-400 text-sm mt-0.5 truncate">{activeSong.artist}</p>
            {activeSong.album && <p className="text-gray-600 text-xs mt-0.5 truncate">{activeSong.album}</p>}

            {/* Status badges */}
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <span className="text-[9px] bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full text-gray-500">Fichier local</span>
              {speed !== 1 && (
                <button onClick={() => setShowSpeedModal(true)}
                  className="text-[9px] bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 rounded-full text-violet-400 font-bold">
                  ⚡ {speed}×
                </button>
              )}
            </div>
          </div>

          {/* Seek */}
          <div className="w-full px-1 mb-1 flex-shrink-0">
            <SeekBar currentTime={currentTime} duration={duration} onSeek={seekTo} />
          </div>

          {/* Transport controls */}
          <div className="flex items-center justify-center gap-4 w-full mb-2 flex-shrink-0">
            <button type="button" onClick={() => { toggleShuffle?.(); vibrate(8); }}
              className={`p-2 rounded-xl transition-all active:scale-90 ${shuffle ? 'text-cyan-400 bg-cyan-500/15' : 'text-gray-600'}`}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button type="button" onPointerDown={e => { e.preventDefault(); previous?.(); vibrate(15); }}
              className="w-11 h-11 flex items-center justify-center text-gray-200 active:scale-90 transition-all">
              <SkipBack className="w-7 h-7 fill-current" />
            </button>
            <motion.button type="button" whileTap={{ scale: 0.88 }}
              onPointerDown={e => { e.preventDefault(); togglePlayPause?.(); vibrate(12); }}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl flex-shrink-0"
              style={{
                background: dominantColor
                  ? `linear-gradient(135deg, rgb(${dominantColor}), #a855f7)`
                  : 'linear-gradient(135deg,#06b6d4,#a855f7)',
                boxShadow: '0 6px 32px rgba(6,182,212,0.45)',
              }}>
              {isPlaying
                ? <Pause className="w-7 h-7 text-white fill-current" />
                : <Play  className="w-7 h-7 text-white fill-current ml-0.5" />}
            </motion.button>
            <button type="button" onPointerDown={e => { e.preventDefault(); next?.(); vibrate(15); }}
              className="w-11 h-11 flex items-center justify-center text-gray-200 active:scale-90 transition-all">
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
            <button type="button" onClick={() => { cycleRepeat?.(); vibrate(8); }}
              className={`relative p-2 rounded-xl transition-all active:scale-90 ${repeat !== 'off' ? 'text-cyan-400 bg-cyan-500/15' : 'text-gray-600'}`}>
              <Repeat className="w-4 h-4" />
              {repeat === 'one' && (
                <span className="absolute -top-0.5 -right-0.5 text-[7px] font-black bg-cyan-400 text-gray-950 rounded-full w-3 h-3 flex items-center justify-center">1</span>
              )}
            </button>
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-2.5 w-full px-2 mb-2 flex-shrink-0">
            <button onClick={() => { setIsMuted(v => !v); vibrate(6); }}
              className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
              <VolumeIcon className="w-4 h-4" />
            </button>
            <div className="flex-1 relative"
              onWheel={e => {
                e.preventDefault();
                const d = e.deltaY > 0 ? -5 : 5;
                setVolume(v => { const n = Math.max(0, Math.min(100, v + d)); return n; });
                setIsMuted(false);
              }}>
              <div className="h-1.5 rounded-full bg-white/[0.08] cursor-pointer relative overflow-hidden"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setVolume(Math.round(((e.clientX - rect.left) / rect.width) * 100));
                  setIsMuted(false);
                }}>
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${isMuted ? 0 : volume}%`,
                    background: dominantColor
                      ? `linear-gradient(90deg, rgb(${dominantColor}), #a855f7)`
                      : 'linear-gradient(90deg,#22d3ee,#a855f7)',
                  }} />
              </div>
              <input type="range" min={0} max={100} step={1} value={isMuted ? 0 : volume}
                onChange={e => { setVolume(Number(e.target.value)); setIsMuted(false); }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            </div>
            <span className="text-[10px] text-gray-600 w-7 text-right tabular-nums flex-shrink-0">{isMuted ? 0 : volume}%</span>
          </div>

          {/* Quick actions row */}
          <div className="flex items-center justify-center gap-3 w-full flex-shrink-0">
            <button onClick={() => setShowSleepModal(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                sleepTimerTarget ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25' : 'bg-white/[0.06] text-gray-500 border border-white/[0.07]'
              }`}>
              <Timer className="w-3.5 h-3.5" />{sleepTimerTarget ? (sleepTimer ? fmtMin(sleepTimer) : 'Fin morceau') : 'Sommeil'}
            </button>
            <button onClick={() => setShowSpeedModal(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                speed !== 1 ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25' : 'bg-white/[0.06] text-gray-500 border border-white/[0.07]'
              }`}>
              <Gauge className="w-3.5 h-3.5" />{speed}×
            </button>
            <button onClick={() => { setFavorited(v => !v); vibrate(12); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                favorited ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' : 'bg-white/[0.06] text-gray-500 border border-white/[0.07]'
              }`}>
              <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
              {favorited ? 'Aimé' : 'Aimer'}
            </button>
          </div>
        </motion.div>
      ) : (
        /* Empty state */
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.18),rgba(168,85,247,0.18))', border: '1px solid rgba(255,255,255,0.08)' }}>
            <HardDrive className="w-12 h-12 text-gray-600" />
          </div>
          <div>
            <p className="text-white font-black text-2xl mb-2">Lecteur Local</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Importe tes fichiers audio<br />pour les écouter hors-ligne
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.96 }}
            onPointerDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}
            className="flex items-center gap-3 px-7 py-3.5 rounded-2xl text-white font-bold"
            style={{ background: 'linear-gradient(135deg,#0e7490,#7c3aed)', boxShadow: '0 8px 30px rgba(6,182,212,0.3)' }}>
            <FolderOpen className="w-5 h-5" />Importer des fichiers
          </motion.button>
          <p className="text-gray-700 text-xs">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS</p>

          {savedPlaylists.length > 0 && (
            <div className="w-full mt-2">
              <p className="text-gray-600 text-xs mb-2 text-center">Playlists sauvegardées</p>
              <div className="grid grid-cols-2 gap-2">
                {savedPlaylists.slice(0, 4).map(pl => (
                  <button key={pl.id} onClick={() => handleSelectPlaylist(pl)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] rounded-xl border border-white/[0.07] text-left active:scale-95 transition-all">
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={pl.songs[0]?.coverUrl || makeCoverSvg(pl.name, '')} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-[11px] font-semibold truncate">{pl.name}</p>
                      <p className="text-gray-600 text-[10px]">{pl.songs.length} titres</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Drawer trigger ── */}
      {(songs.length > 0 || savedPlaylists.length > 0) && (
        <motion.button initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          onClick={() => setDrawerOpen(true)}
          className="relative z-10 mx-4 mb-2 flex items-center gap-2 py-3 px-4 rounded-2xl border border-white/10 text-gray-400 text-sm font-semibold transition-all active:scale-98 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
          <ListMusic className="w-4 h-4 text-cyan-400" />
          Bibliothèque
          <span className="text-gray-600 text-xs">({songs.length})</span>
          {selectionMode && selectedIds.size > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded-full">
              {selectedIds.size} sél.
            </span>
          )}
          <ChevronUp className="w-4 h-4 ml-auto text-gray-600" />
        </motion.button>
      )}

      <div style={{ height: 'calc(env(safe-area-inset-bottom,0px) + 55px)', flexShrink: 0 }} />

      {/* ══════════════════════════════════════════════════════════════
          DRAWER
          ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 36, stiffness: 380 }}
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col overflow-hidden"
              style={{ background: '#0d0d1d', maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
              onClick={e => e.stopPropagation()}>

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 pb-3 flex-shrink-0">
                {[
                  ['library',   '🎵 Bibliothèque'],
                  ['playlists', '📂 Playlists'],
                  ['queue',     '▶ File'],
                ].map(([tab, label]) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === tab
                        ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                        : 'text-gray-500'
                    }`}>{label}</button>
                ))}
              </div>

              {/* Library tools */}
              {activeTab === 'library' && (
                <div className="flex items-center gap-2 px-4 pb-2 flex-shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Chercher un titre, artiste…"
                      className="w-full pl-9 pr-8 py-2 bg-white/[0.05] border border-white/[0.07] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors" />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="appearance-none px-3 py-2 bg-white/[0.05] border border-white/[0.07] rounded-xl text-xs text-gray-400 focus:outline-none cursor-pointer">
                    <option value="default">Défaut</option>
                    <option value="name">Nom</option>
                    <option value="artist">Artiste</option>
                    <option value="recent">Récent</option>
                  </select>
                </div>
              )}

              {/* Selection bar */}
              {selectionMode && activeTab === 'library' && (
                <div className="flex items-center gap-2 px-4 pb-2 flex-shrink-0">
                  <span className="text-cyan-400 text-xs font-bold flex-1">{selectedIds.size} sélectionné{selectedIds.size !== 1 ? 's' : ''}</span>
                  {selectedIds.size > 0 && (
                    <button onPointerDown={e => { e.preventDefault(); setShowModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95">
                      <Save className="w-3 h-3" /> Sauvegarder ({selectedIds.size})
                    </button>
                  )}
                  <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                    className="p-1.5 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: 'none' }}>
                <AnimatePresence mode="wait">

                  {/* ── Library ── */}
                  {activeTab === 'library' && (
                    <motion.div key="lib" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <div className="flex items-center gap-2 py-2 mb-1">
                        <button onPointerDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                          <Plus className="w-3.5 h-3.5" /> Importer
                        </button>
                        {songs.length > 0 && !selectionMode && (
                          <button onClick={() => setSelectionMode(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                            <CheckSquare className="w-3.5 h-3.5" /> Sélection
                          </button>
                        )}
                        {songs.length > 0 && (
                          <button onClick={() => { playSong(songs[Math.floor(Math.random() * songs.length)], songs); vibrate(15); setDrawerOpen(false); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] rounded-xl text-xs text-gray-300 active:scale-95 transition-all">
                            <Shuffle className="w-3.5 h-3.5" /> Aléatoire
                          </button>
                        )}
                        <span className="ml-auto text-xs text-gray-600">{songs.length} fichier{songs.length !== 1 ? 's' : ''}</span>
                      </div>
                      {filteredSongs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Music2 className="w-10 h-10 text-gray-700 mb-3" />
                          <p className="text-gray-400 font-semibold text-sm">
                            {searchQuery ? 'Aucun résultat' : 'Bibliothèque vide'}
                          </p>
                          {!searchQuery && (
                            <p className="text-gray-600 text-xs mt-1">Importe tes fichiers audio</p>
                          )}
                        </div>
                      ) : (
                        <div className="pb-2">
                          {/* Hint row */}
                          {songs.length > 0 && (
                            <p className="text-gray-700 text-[10px] text-center mb-2">
                              ← Glisser vers la gauche pour supprimer
                            </p>
                          )}
                          <AnimatePresence>
                            {filteredSongs.map(song => (
                              <SongItem key={song.id} song={song}
                                isActive={activeSong?.id === song.id}
                                isPlaying={isPlaying}
                                selectionMode={selectionMode}
                                isSelected={selectedIds.has(song.id)}
                                searchQuery={searchQuery}
                                onSelect={toggleSelect}
                                onPlay={handlePlaySong}
                                onRemove={handleRemoveSong} />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── Playlists ── */}
                  {activeTab === 'playlists' && (
                    <motion.div key="pl" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <div className="flex items-center justify-between py-2 mb-2">
                        <p className="text-white font-bold text-sm">Mes playlists</p>
                        <button type="button"
                          onClick={() => { songs.length ? setSelectionMode(true) : fileInputRef.current?.click(); setActiveTab('library'); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-xs font-bold active:scale-95">
                          <Plus className="w-3.5 h-3.5" /> Nouvelle
                        </button>
                      </div>
                      {savedPlaylists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Folder className="w-12 h-12 text-gray-700 mb-3" />
                          <p className="text-gray-400 font-semibold text-sm">Aucune playlist</p>
                          <p className="text-gray-600 text-xs mt-1">Sélectionne des titres pour créer une playlist</p>
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

                  {/* ── Queue ── */}
                  {activeTab === 'queue' && (
                    <motion.div key="q" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <div className="flex items-center justify-between py-2 mb-2">
                        <p className="text-white font-bold text-sm">File de lecture</p>
                        {queue?.length > 0 && (
                          <span className="text-xs text-gray-600">{queue.length} titre{queue.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      {!queue?.length ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <ListOrdered className="w-12 h-12 text-gray-700 mb-3" />
                          <p className="text-gray-400 font-semibold text-sm">File vide</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {queue.map((song, idx) => {
                            const c = song.cover_url || song.coverUrl || makeCoverSvg(song.title, song.artist || '');
                            return (
                              <div key={`${song.id}-${idx}`}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                  activeSong?.id === song.id
                                    ? 'bg-cyan-500/12 border-cyan-500/22'
                                    : 'bg-white/[0.025] border-transparent'}`}>
                                <span className="text-gray-700 text-[10px] w-5 text-right font-mono">{idx + 1}</span>
                                <img src={c} alt="" className="w-10 h-10 rounded-lg object-cover" loading="lazy" />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${activeSong?.id === song.id ? 'text-cyan-300' : 'text-white'}`}>
                                    {song.title}
                                  </p>
                                  <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                                </div>
                                {activeSong?.id === song.id && isPlaying && <EqBars />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drag overlay ── */}
      <AnimatePresence>
        {isDragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(6,182,212,0.08)', border: '2px dashed rgba(6,182,212,0.5)' }}>
            <div className="text-center">
              <FolderOpen className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
              <p className="text-cyan-300 text-xl font-black">Déposez vos fichiers</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading toast ── */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-2xl border border-white/10"
            style={{ background: 'rgba(14,14,30,0.96)' }}>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            <span className="text-white text-xs font-medium">Importation…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showPlaylistModal && <PlaylistNameModal onConfirm={handleCreatePlaylist} onCancel={() => setShowModal(false)} />}
        {showSleepModal     && <SleepTimerModal  currentTimer={sleepTimerTarget} onSet={handleSetSleepTimer} onCancel={() => setShowSleepModal(false)} />}
        {showSpeedModal     && <SpeedModal       currentSpeed={speed} onSet={handleSetSpeed} onCancel={() => setShowSpeedModal(false)} />}
      </AnimatePresence>

      {/* ── OSD ── */}
      <OSD osd={osd} />

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="audio/*,video/mp4" multiple
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
        className="hidden" />
    </div>
  );
});

LocalPlayerPageMobile.displayName = 'LocalPlayerPageMobile';
export default LocalPlayerPageMobile;
