/**
 * LiveRoomPage — NovaSound TITAN LUX V100000
 *
 * ✅ Sync audio précise entre hôte et invités (WebRTC-like via Supabase Realtime)
 * ✅ Import fichier local par l'hôte → upload Supabase → broadcast URL
 * ✅ Playlist de l'hôte synchronisée avec tous les participants
 * ✅ File d'attente avec auto-advance quand un son se termine
 * ✅ Indicateur VERT (live actif) / ROUGE (aucun live) sur BottomNav
 * ✅ Menu masqué sur mobile (BottomNav) quand dans une room
 * ✅ Layout mobile optimisé — panneau glissant du bas
 * ✅ Chrono du live en temps réel
 * ✅ Screen Wake Lock pour l'hôte (mobile)
 * ✅ Recherche multi-source : bibliothèque + playlists perso
 * ✅ Réactions emoji flottantes
 * ✅ Messages éditable + supprimable
 * ✅ Indicateur de frappe en temps réel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import Header from '@/components/Header';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Radio, Users, Music, Send, Heart, Crown, Copy, Check, Plus, Lock, Unlock,
  Headphones, Zap, X, ArrowLeft, Loader2, WifiOff, RefreshCw, Search, Upload,
  Pencil, Trash2, CheckCircle2, XCircle, Play, ListMusic, SkipForward, LogOut,
  Smile, Share2, AlertCircle, Clock, Volume2, ChevronUp, BookOpen, Pause,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════════════════════════════════ */
const MAX_PARTICIPANTS = 50;
const SYNC_MS          = 2500;
const HEARTBEAT_MS     = 25000;
const TYPING_TIMEOUT   = 3000;
const SYNC_THRESHOLD   = 2.0; // secondes d'écart avant recalibration
const REACTION_EMOJIS  = ['🔥','💜','🎵','✨','🎶','❤️','💫','🎉','😍','🚀','👏','🤩','💎','🎸','🥁','🎤'];
const GRADIENTS        = [
  'from-cyan-500 to-blue-600','from-fuchsia-500 to-purple-600','from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600','from-rose-400 to-pink-600','from-indigo-400 to-violet-600',
  'from-sky-400 to-cyan-600','from-lime-400 to-green-600',
];

const avatarGrad = (id = '') => GRADIENTS[(id.charCodeAt(0) || 0) % GRADIENTS.length];

const relTime = (iso) => {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return 'instant';
  if (d < 3600000) return Math.floor(d / 60000) + 'm';
  return Math.floor(d / 3600000) + 'h';
};

const fmtDuration = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* ══════════════════════════════════════════════════════════════════════════
   SOUS-COMPOSANTS
   ══════════════════════════════════════════════════════════════════════════ */

const Avatar = ({ user, size = 9, crown = false, pulse = false }) => {
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();
  const grad = avatarGrad(user?.id || '');
  return (
    <div className={`relative w-${size} h-${size} rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-white/10`}>
      {user?.avatar_url
        ? <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover" />
        : <span className="select-none">{initials}</span>
      }
      {crown && <div className="absolute -top-2 -right-1.5 text-sm select-none drop-shadow">👑</div>}
      {pulse && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-gray-900" />}
    </div>
  );
};

const Eq = ({ active = true, color = 'cyan' }) => {
  const bars = [0.4, 0.7, 1, 0.6, 0.85];
  const c = { cyan: 'bg-cyan-400', fuchsia: 'bg-fuchsia-400', green: 'bg-green-400' }[color] || 'bg-cyan-400';
  return (
    <div className="flex items-end gap-0.5 h-4 flex-shrink-0">
      {bars.map((h, i) => (
        <motion.div key={i} className={`w-0.5 rounded-full ${c}`}
          animate={active ? { height: [`${h * 100}%`, '20%', `${h * 80}%`, '100%`, `${h * 100}%`] } : { height: '20%' }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ height: '20%' }} />
      ))}
    </div>
  );
};

const EmojiBurst = ({ bursts }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
    <AnimatePresence>
      {bursts.map(b => (
        <motion.div key={b.id} initial={{ opacity: 1, y: 0, scale: 0.6 }} animate={{ opacity: 0, y: -140, scale: 2 }}
          exit={{ opacity: 0 }} transition={{ duration: 1.8, ease: 'easeOut' }}
          className="absolute text-3xl select-none" style={{ left: b.x, bottom: 20 }}>
          {b.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const TypingDots = () => (
  <div className="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-2xl w-fit">
    {[0, 1, 2].map(i => (
      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
    ))}
  </div>
);

const ConnBadge = ({ status }) => {
  const cfg = {
    connected:  { label: 'Connecté',   dot: 'bg-green-400',              cls: 'bg-green-500/10 border-green-500/30 text-green-400' },
    connecting: { label: 'Connexion…', dot: 'bg-yellow-400 animate-pulse', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
    error:      { label: 'Déconnecté', dot: 'bg-red-400',                 cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    idle:       { label: 'Inactif',    dot: 'bg-gray-400',                cls: 'bg-gray-800 border-gray-700 text-gray-400' },
  }[status] || { label: status, dot: 'bg-gray-400', cls: 'bg-gray-800 border-gray-700 text-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
    </span>
  );
};

/* Card dans le lobby */
const RoomCard = ({ room, onJoin }) => {
  const full = (room.participants_count || 0) >= MAX_PARTICIPANTS;
  const pct  = Math.min((room.participants_count || 0) / MAX_PARTICIPANTS, 1);
  return (
    <motion.div whileHover={{ scale: full ? 1 : 1.02, y: full ? 0 : -2 }} whileTap={{ scale: full ? 1 : 0.97 }}
      onClick={() => !full && onJoin(room.id)}
      className={`relative bg-gray-900/80 backdrop-blur border rounded-2xl p-5 transition-all overflow-hidden
        ${full ? 'border-gray-800 opacity-60 cursor-not-allowed' : 'border-gray-800 hover:border-green-500/50 cursor-pointer hover:shadow-lg hover:shadow-green-500/5'}`}>
      {/* Indicateur LIVE — vert = actif */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="text-xs text-green-400 font-bold">LIVE</span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={room.host} size={10} crown />
        <div className="min-w-0">
          <h3 className="text-white font-bold text-base truncate">{room.name}</h3>
          <p className="text-xs text-gray-500 truncate">par {room.host?.username || 'Anonyme'}</p>
        </div>
      </div>
      {room.current_song && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-gray-800/60 rounded-xl">
          <Eq active={!full} />
          <div className="min-w-0">
            <p className="text-xs text-gray-300 truncate font-medium">{room.current_song.title}</p>
            <p className="text-xs text-gray-500 truncate">{room.current_song.artist}</p>
          </div>
        </div>
      )}
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{room.participants_count || 0} / {MAX_PARTICIPANTS}</span>
        <span>{full ? 'Salle pleine' : `${MAX_PARTICIPANTS - (room.participants_count || 0)} libres`}</span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${full ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-cyan-500'}`}
          initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6 }} />
      </div>
    </motion.div>
  );
};

/* Item de la file d'attente */
const QueueItem = ({ song, index, isHost, isNowPlaying, onPlay, onRemove }) => (
  <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
    className={`flex items-center gap-3 p-2.5 rounded-xl group transition-all ${isNowPlaying ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-gray-800'}`}>
    <span className="w-5 text-gray-600 text-xs font-mono flex-shrink-0 text-center">
      {isNowPlaying ? <Eq active size={4} /> : index + 1}
    </span>
    {song.cover_url
      ? <img src={song.cover_url} alt={song.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
      : <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-gray-500" /></div>
    }
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-medium truncate ${isNowPlaying ? 'text-cyan-300' : 'text-white'}`}>{song.title}</p>
      <p className="text-gray-500 text-xs truncate">{song.artist}</p>
    </div>
    {isHost && (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isNowPlaying && <button onClick={() => onPlay(song)} className="p-1 text-gray-400 hover:text-cyan-400 transition-colors"><Play className="w-3.5 h-3.5" /></button>}
        <button onClick={() => onRemove(song.id)} className="p-1 text-gray-400 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
    )}
  </motion.div>
);

/* Message de chat */
const ChatMsg = ({ m, isMine, currentUserId, isEditing, editContent, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onChangeEdit }) => (
  <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
    className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'} group`}>
    {!isMine && <Avatar user={m.user} size={7} pulse />}
    <div className={`max-w-[78%] ${isMine ? 'text-right' : 'text-left'}`}>
      {!isMine && <p className="text-xs text-gray-500 mb-1 ml-1">{m.user?.username || 'Anonyme'}</p>}
      <div className={`inline-block px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine ? 'bg-gradient-to-br from-cyan-500 to-fuchsia-500 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input value={editContent} onChange={e => onChangeEdit(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
              className="bg-black/20 border border-white/30 rounded-lg px-2 py-1 text-white text-sm w-44 focus:outline-none focus:border-white/60"
              autoFocus />
            <button onClick={onSaveEdit} className="text-green-300 hover:text-green-200"><CheckCircle2 className="w-4 h-4" /></button>
            <button onClick={onCancelEdit} className="text-red-300 hover:text-red-200"><XCircle className="w-4 h-4" /></button>
          </div>
        ) : (
          <><p className="break-words whitespace-pre-wrap">{m.content}</p>{m.is_edited && <p className="text-xs opacity-50 mt-0.5">modifié</p>}</>
        )}
      </div>
      <div className={`flex items-center gap-1.5 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
        <span className="text-[10px] text-gray-600">{relTime(m.created_at)}</span>
        {isMine && !isEditing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onStartEdit} className="text-gray-600 hover:text-gray-300"><Pencil className="w-3 h-3" /></button>
            <button onClick={onDelete} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
    {isMine && <Avatar user={m.user} size={7} />}
  </motion.div>
);

const SysMsg = ({ text, icon: Icon = Zap }) => (
  <div className="flex items-center justify-center gap-2 my-2">
    <div className="h-px flex-1 bg-gray-800" />
    <div className="flex items-center gap-1.5 text-xs text-gray-600 px-2"><Icon className="w-3 h-3" />{text}</div>
    <div className="h-px flex-1 bg-gray-800" />
  </div>
);

const LoadingScreen = ({ label = 'Connexion…' }) => (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/20 to-cyan-500/20 border border-green-500/20 flex items-center justify-center">
        <Radio className="w-9 h-9 text-green-400" />
      </div>
      <motion.div className="absolute inset-0 rounded-2xl border-2 border-green-500/40"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
    </div>
    <div className="text-center">
      <p className="text-white font-semibold mb-2">{label}</p>
      <div className="flex items-center justify-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
        ))}
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ════════════════════════════════════════════════════════════════════════════ */
const LiveRoomPage = () => {
  const { roomId: roomIdParam } = useParams();
  const { currentUser }        = useAuth();
  const { playSong }           = usePlayer();
  const navigate               = useNavigate();

  /* Phases */
  const [phase, setPhase]               = useState('init');
  const [rooms, setRooms]               = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [room, setRoom]                 = useState(null);
  const [channelStatus, setChannelStatus] = useState('idle');
  const [joinError, setJoinError]       = useState(null);

  /* Live */
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages]         = useState([]);
  const [msgInput, setMsgInput]         = useState('');
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editContent, setEditContent]   = useState('');
  const [typingUsers, setTypingUsers]   = useState([]);
  const [nowPlaying, setNowPlaying]     = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [queue, setQueue]               = useState([]);
  const [isHost, setIsHost]             = useState(false);

  /* Lobby / Create */
  const [roomName, setRoomName]         = useState('');
  const [isPrivate, setIsPrivate]       = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  /* UI */
  const [showPicker, setShowPicker]     = useState(false);
  const [songSearch, setSongSearch]     = useState('');
  const [songResults, setSongResults]   = useState([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [myPlaylists, setMyPlaylists]   = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const [bursts, setBursts]             = useState([]);
  const [copied, setCopied]             = useState(false);
  const [sideTab, setSideTab]           = useState('participants');
  const [showReactions, setShowReactions] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // 'stop' | 'leave'
  const [mobileSideOpen, setMobileSideOpen] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);
  const [syncQuality, setSyncQuality]   = useState(100); // 0-100

  /* Refs */
  const chatRef        = useRef(null);
  const chanRef        = useRef(null);
  const burstId        = useRef(0);
  const hasJoined      = useRef(false);
  const syncTimer      = useRef(null);
  const heartbeatTimer = useRef(null);
  const durationTimer  = useRef(null);
  const typingTimer    = useRef(null);
  const isTyping       = useRef(false);
  const fileInputRef   = useRef(null);
  const isHostRef      = useRef(false);
  const roomRef        = useRef(null);
  const messagesRef    = useRef([]);
  const queueRef       = useRef([]);
  const startedAtRef   = useRef(null);
  const wakeLockRef    = useRef(null);

  const isAdmin = currentUser?.email === 'eloadxfamily@gmail.com';
  const canStop = isHost || isAdmin;

  const scrollChat = useCallback(() => {
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 60);
  }, []);

  /* ── Screen Wake Lock (hôte mobile) ─────────────────────────── */
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  }, []);

  /* ── Fetch lobby ──────────────────────────────────────────────── */
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { data } = await supabase.from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url), current_song:current_song_id(id,title,artist,cover_url)')
        .eq('is_active', true).eq('is_private', false)
        .order('participants_count', { ascending: false }).limit(20);
      setRooms(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingRooms(false); }
  }, []);

  useEffect(() => { if (roomIdParam) setPhase('joining'); else setPhase('lobby'); }, [roomIdParam]);
  useEffect(() => { if (phase === 'lobby') fetchRooms(); }, [phase, fetchRooms]);

  /* ── Queue helpers ──────────────────────────────────────────────── */
  const addToQueue = useCallback((song) => {
    if (!isHostRef.current || queueRef.current.find(s => s.id === song.id)) return;
    const upd = [...queueRef.current, song];
    queueRef.current = upd; setQueue(upd);
    chanRef.current?.send({ type: 'broadcast', event: 'queue_update', payload: { queue: upd } }).catch(() => {});
  }, []);

  const removeFromQueue = useCallback((id) => {
    const upd = queueRef.current.filter(s => s.id !== id);
    queueRef.current = upd; setQueue(upd);
    chanRef.current?.send({ type: 'broadcast', event: 'queue_update', payload: { queue: upd } }).catch(() => {});
  }, []);

  /* ── Chrono du live ──────────────────────────────────────────────── */
  const startDurationTimer = useCallback(() => {
    if (durationTimer.current) clearInterval(durationTimer.current);
    startedAtRef.current = Date.now();
    durationTimer.current = setInterval(() => {
      setLiveDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  }, []);

  /* ── Sync / Heartbeat ──────────────────────────────────────────── */
  const startSync = useCallback(() => {
    if (syncTimer.current) clearInterval(syncTimer.current);
    syncTimer.current = setInterval(() => {
      if (!chanRef.current || !isHostRef.current) return;
      const audio = document.querySelector('audio');
      if (!audio) return;
      chanRef.current.send({
        type: 'broadcast', event: 'sync_position',
        payload: {
          currentTime: audio.currentTime,
          duration: audio.duration || 0,
          isPlaying: !audio.paused,
          timestamp: Date.now(),
        }
      }).catch(() => {});
    }, SYNC_MS);
  }, []);

  const stopSync = useCallback(() => {
    [syncTimer, heartbeatTimer, durationTimer].forEach(r => {
      if (r.current) { clearInterval(r.current); r.current = null; }
    });
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (chanRef.current && currentUser) {
        chanRef.current.track({
          user: {
            id: currentUser.id,
            username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Anonyme',
            avatar_url: currentUser.user_metadata?.avatar_url || null,
            lastSeen: Date.now(),
          }
        }).catch(() => {});
      }
    }, HEARTBEAT_MS);
  }, [currentUser]);

  /* ── Typing ─────────────────────────────────────────────────────── */
  const broadcastTyping = useCallback(() => {
    if (!chanRef.current || !currentUser) return;
    if (!isTyping.current) {
      isTyping.current = true;
      chanRef.current.send({ type: 'broadcast', event: 'typing',
        payload: { userId: currentUser.id, username: currentUser.user_metadata?.username || 'Anonyme', typing: true }
      }).catch(() => {});
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      chanRef.current?.send({ type: 'broadcast', event: 'typing',
        payload: { userId: currentUser.id, username: currentUser.user_metadata?.username || 'Anonyme', typing: false }
      }).catch(() => {});
    }, TYPING_TIMEOUT);
  }, [currentUser]);

  /* ── Message système ──────────────────────────────────────────── */
  const injectSys = useCallback((text, type = 'system') => {
    const sys = { id: `sys-${Date.now()}-${Math.random()}`, _system: true, _type: type, content: text, created_at: new Date().toISOString() };
    setMessages(prev => { const u = [...prev, sys]; messagesRef.current = u; return u; });
    scrollChat();
  }, [scrollChat]);

  /* ── Créer une salle ─────────────────────────────────────────── */
  const createRoom = async () => {
    if (!currentUser || !roomName.trim()) return;
    setCreatingRoom(true);
    try {
      const { data, error } = await supabase.from('live_rooms')
        .insert({ name: roomName.trim(), host_id: currentUser.id, is_private: isPrivate, is_active: true })
        .select().single();
      if (error) throw error;
      await joinRoom(data.id, true);
    } catch (e) { console.error(e); setCreatingRoom(false); }
  };

  /* ── Rejoindre une salle ─────────────────────────────────────── */
  const joinRoom = useCallback(async (id, asHost = false) => {
    if (!currentUser) { navigate('/login'); return; }
    if (hasJoined.current) return;
    hasJoined.current = true;
    setPhase('joining'); setJoinError(null); setChannelStatus('connecting');

    try {
      const { data: rd, error: re } = await supabase.from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url), current_song:current_song_id(id,title,artist,cover_url,audio_url)')
        .eq('id', id).single();
      if (re || !rd) throw new Error('Salle introuvable ou expirée.');
      if (!rd.is_active) throw new Error('Cette salle est terminée.');

      setRoom(rd); roomRef.current = rd;
      const amHost = asHost || rd.host_id === currentUser.id;
      setIsHost(amHost); isHostRef.current = amHost;

      const { data: msgs } = await supabase.from('live_room_messages')
        .select('*, user:user_id(id,username,avatar_url)')
        .eq('room_id', id).eq('is_deleted', false)
        .order('created_at', { ascending: true }).limit(100);
      setMessages(msgs || []); messagesRef.current = msgs || [];

      if (rd.current_song) {
        setNowPlaying(rd.current_song);
        playSong(rd.current_song, [rd.current_song]);
      }

      const chan = supabase.channel(`live_room:${id}`, {
        config: { presence: { key: currentUser.id }, broadcast: { self: false } }
      });

      chan
        .on('presence', { event: 'sync' }, () => {
          const users = Object.values(chan.presenceState()).flat().map(p => p.user).filter(Boolean);
          setParticipants(users);
          if (amHost) supabase.from('live_rooms').update({ participants_count: users.length }).eq('id', id).then(() => {});
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          const u = newPresences?.[0]?.user;
          if (u && u.id !== currentUser.id) injectSys(`${u.username} a rejoint 👋`, 'join');
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          const u = leftPresences?.[0]?.user;
          if (u && u.id !== currentUser.id) injectSys(`${u.username} a quitté`, 'leave');
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          async ({ new: nm }) => {
            if (nm.is_deleted) return;
            const { data: u } = await supabase.from('users').select('id,username,avatar_url').eq('id', nm.user_id).single();
            const full = { ...nm, user: u || null };
            setMessages(prev => { if (prev.find(m => m.id === full.id)) return prev; const upd = [...prev, full]; messagesRef.current = upd; return upd; });
            scrollChat();
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          ({ new: up }) => {
            if (up.is_deleted) {
              setMessages(prev => { const u = prev.filter(m => m.id !== up.id); messagesRef.current = u; return u; });
            } else {
              setMessages(prev => { const u = prev.map(m => m.id === up.id ? { ...m, content: up.content, is_edited: true } : m); messagesRef.current = u; return u; });
            }
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_rooms', filter: `id=eq.${id}` },
          ({ new: up }) => { if (!up.is_active) handleRoomClosed(); else setRoom(prev => ({ ...prev, ...up })); })
        .on('broadcast', { event: 'play_song' }, ({ payload }) => {
          if (payload?.song) {
            setNowPlaying(payload.song);
            playSong(payload.song, [payload.song]);
            setSyncProgress(0);
            injectSys(`🎵 ${payload.song.title} — ${payload.song.artist}`, 'song');
          }
        })
        .on('broadcast', { event: 'sync_position' }, ({ payload }) => {
          if (!payload) return;
          if (payload.duration > 0) setSyncProgress(payload.currentTime / payload.duration);
          if (isHostRef.current) return; // l'hôte ne se re-sync pas sur lui-même
          const audio = document.querySelector('audio');
          if (!audio) return;
          const lag = (Date.now() - payload.timestamp) / 1000;
          const target = payload.currentTime + lag;
          const drift = Math.abs(audio.currentTime - target);
          // Qualité de sync (100 = parfaite, 0 = très décalé)
          setSyncQuality(Math.max(0, Math.round(100 - drift * 10)));
          if (drift > SYNC_THRESHOLD) {
            audio.currentTime = target;
          }
          if (payload.isPlaying && audio.paused) audio.play().catch(() => {});
          if (!payload.isPlaying && !audio.paused) audio.pause();
        })
        .on('broadcast', { event: 'queue_update' }, ({ payload }) => {
          if (payload?.queue) { queueRef.current = payload.queue; setQueue(payload.queue); }
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (!payload || payload.userId === currentUser.id) return;
          setTypingUsers(prev => payload.typing
            ? prev.find(u => u.userId === payload.userId) ? prev : [...prev, { userId: payload.userId, username: payload.username }]
            : prev.filter(u => u.userId !== payload.userId));
        })
        .on('broadcast', { event: 'burst' }, ({ payload }) => addBurst(payload.emoji, payload.x))
        .on('broadcast', { event: 'room_closed' }, () => handleRoomClosed())
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setChannelStatus('connected');
            const uPayload = {
              user: {
                id: currentUser.id,
                username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Anonyme',
                avatar_url: currentUser.user_metadata?.avatar_url || null,
                lastSeen: Date.now(),
              }
            };
            try { await chan.track(uPayload); startHeartbeat(); } catch {}
            setPhase('room'); scrollChat();
            if (amHost) { startSync(); startDurationTimer(); acquireWakeLock(); }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setChannelStatus('error'); setJoinError('Connexion perdue.'); hasJoined.current = false;
          }
        });

      chanRef.current = chan;
    } catch (err) {
      console.error('joinRoom:', err); setJoinError(err.message || 'Impossible de rejoindre.'); setPhase('error'); hasJoined.current = false;
    }
  }, [currentUser, navigate, playSong, scrollChat, startSync, startHeartbeat, startDurationTimer, acquireWakeLock, injectSys]); // eslint-disable-line

  useEffect(() => {
    if (roomIdParam && currentUser && phase === 'joining' && !hasJoined.current) joinRoom(roomIdParam);
  }, [roomIdParam, currentUser, phase, joinRoom]);

  const handleRoomClosed = useCallback(() => {
    stopSync(); releaseWakeLock();
    if (chanRef.current) { chanRef.current.untrack?.(); supabase.removeChannel(chanRef.current); chanRef.current = null; }
    setRoom(null); setParticipants([]); setMessages([]); messagesRef.current = []; queueRef.current = []; setQueue([]);
    setPhase('lobby'); hasJoined.current = false; navigate('/live');
  }, [navigate, stopSync, releaseWakeLock]);

  const leaveRoom = useCallback(async () => {
    stopSync(); releaseWakeLock();
    if (chanRef.current) {
      await chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) {
        await chanRef.current.send({ type: 'broadcast', event: 'room_closed', payload: {} });
        await supabase.from('live_rooms').update({ is_active: false, participants_count: 0 }).eq('id', roomRef.current.id);
      }
      supabase.removeChannel(chanRef.current); chanRef.current = null;
    }
    setRoom(null); setParticipants([]); setMessages([]); messagesRef.current = []; queueRef.current = []; setQueue([]);
    setPhase('lobby'); hasJoined.current = false; navigate('/live');
  }, [navigate, stopSync, releaseWakeLock]);

  useEffect(() => () => {
    stopSync(); releaseWakeLock();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (chanRef.current) {
      chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) supabase.from('live_rooms').update({ is_active: false }).eq('id', roomRef.current.id).then(() => {});
      supabase.removeChannel(chanRef.current); chanRef.current = null;
    }
  }, []); // eslint-disable-line

  /* ── Envoyer un message ─────────────────────────────────────── */
  const sendMessage = async () => {
    if (!msgInput.trim() || !chanRef.current || !currentUser || !roomRef.current) return;
    const content = msgInput.trim().slice(0, 500);
    setMsgInput(''); isTyping.current = false;
    if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = null; }
    chanRef.current.send({ type: 'broadcast', event: 'typing',
      payload: { userId: currentUser.id, username: currentUser.user_metadata?.username || 'Anonyme', typing: false }
    }).catch(() => {});
    try {
      await supabase.from('live_room_messages').insert({ room_id: roomRef.current.id, user_id: currentUser.id, content });
      scrollChat();
    } catch (err) { console.error(err); }
  };

  const saveEdit = async () => {
    if (!editContent.trim() || !editingMsgId) return;
    await supabase.from('live_room_messages')
      .update({ content: editContent.trim().slice(0, 500), is_edited: true })
      .eq('id', editingMsgId).eq('user_id', currentUser.id);
    setEditingMsgId(null); setEditContent('');
  };

  const deleteMessage = async (msgId) => {
    await supabase.from('live_room_messages').update({ is_deleted: true }).eq('id', msgId).eq('user_id', currentUser.id);
  };

  /* ── Diffuser un son ─────────────────────────────────────────── */
  const broadcastSong = useCallback(async (song) => {
    if (!isHostRef.current || !chanRef.current || !roomRef.current) return;
    setNowPlaying(song); playSong(song, [song]); setSyncProgress(0);
    setShowPicker(false); setSongSearch(''); setSongResults([]);
    if (!song._isLocal) await supabase.from('live_rooms').update({ current_song_id: song.id }).eq('id', roomRef.current.id);
    await chanRef.current.send({ type: 'broadcast', event: 'play_song', payload: { song } });
    injectSys(`🎵 ${song.title} — ${song.artist}`, 'song');
  }, [playSong, injectSys]);

  const skipToNext = useCallback(() => {
    if (!isHostRef.current || queueRef.current.length === 0) return;
    const [next, ...rest] = queueRef.current; queueRef.current = rest; setQueue(rest);
    chanRef.current?.send({ type: 'broadcast', event: 'queue_update', payload: { queue: rest } }).catch(() => {});
    broadcastSong(next);
  }, [broadcastSong]);

  /* ── Auto-avance quand le son se termine ───────────────────────── */
  useEffect(() => {
    if (!isHost) return;
    const audio = document.querySelector('audio');
    if (!audio) return;
    const onEnded = () => {
      if (queueRef.current.length > 0) skipToNext();
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [isHost, skipToNext]);

  /* ── Fichier local ──────────────────────────────────────────────── */
  const handleLocalFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isHostRef.current || !roomRef.current) return;
    if (!file.type.startsWith('audio/')) { alert('Fichier audio uniquement (.mp3, .m4a, .wav…)'); return; }
    if (file.size > 80 * 1024 * 1024) { alert('Fichier trop volumineux (max 80 Mo)'); return; }
    setUploadingLocal(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `live-temp/${roomRef.current.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('live-room-audio').upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('live-room-audio').getPublicUrl(path);
      const title = file.name.replace(/\.[^.]+$/, '');
      await broadcastSong({
        id: `local-${Date.now()}`, title, artist: currentUser.user_metadata?.username || 'Hôte',
        audio_url: urlData.publicUrl, cover_url: null, plays_count: 0, _isLocal: true,
      });
    } catch (err) { alert('Erreur upload : ' + (err.message || err)); }
    finally { setUploadingLocal(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  /* ── Charger mes playlists ────────────────────────────────────── */
  const loadMyPlaylists = async () => {
    if (!currentUser) return;
    setLoadingPlaylists(true);
    try {
      const { data } = await supabase.from('playlists')
        .select('id, name, cover_url, playlist_songs(songs(id,title,artist,cover_url,audio_url))')
        .eq('owner_id', currentUser.id).order('updated_at', { ascending: false }).limit(10);
      setMyPlaylists(data || []);
    } catch {}
    finally { setLoadingPlaylists(false); }
  };

  const addPlaylistToQueue = (playlist) => {
    const songs = (playlist.playlist_songs || []).map(ps => ps.songs).filter(Boolean);
    songs.forEach(s => addToQueue(s));
    injectSys(`📋 ${songs.length} son(s) de "${playlist.name}" ajoutés à la file`, 'system');
    setShowPlaylists(false);
  };

  /* ── Bursts emoji ───────────────────────────────────────────────── */
  const addBurst = (emoji, x) => {
    const e = emoji || REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
    const posX = x ?? `${Math.random() * 80 + 10}%`;
    const id = ++burstId.current;
    setBursts(prev => [...prev, { id, emoji: e, x: posX }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 2000);
  };

  const sendBurst = async (emoji) => {
    if (!chanRef.current) return;
    const e = emoji || REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
    const x = `${Math.random() * 80 + 10}%`;
    addBurst(e, x); setShowReactions(false);
    await chanRef.current.send({ type: 'broadcast', event: 'burst', payload: { emoji: e, x } });
  };

  /* ── Recherche ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!songSearch.trim()) { setSongResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('songs').select('id,title,artist,cover_url,audio_url')
        .or(`title.ilike.%${songSearch}%,artist.ilike.%${songSearch}%`).eq('is_archived', false).limit(10);
      setSongResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [songSearch]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#/live/${roomRef.current?.id}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  /* Computed */
  const otherTyping = typingUsers.filter(u => u.userId !== currentUser?.id);
  const typingLabel = otherTyping.length === 1 ? `${otherTyping[0].username} écrit…`
    : otherTyping.length > 1 ? `${otherTyping.length} personnes écrivent…` : null;
  const pctCap = participants.length / MAX_PARTICIPANTS;

  /* ════════════════════════════════════════════════════════════════
     PHASES
     ════════════════════════════════════════════════════════════════ */
  if (phase === 'init' || phase === 'joining')
    return <LoadingScreen label={roomIdParam ? 'Connexion à la salle…' : 'Chargement…'} />;

  if (phase === 'error') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center"><WifiOff className="w-8 h-8 text-red-400" /></div>
      <div className="text-center"><p className="text-white font-bold text-xl mb-2">Impossible de rejoindre</p><p className="text-gray-400 text-sm max-w-sm">{joinError}</p></div>
      <div className="flex gap-3">
        <button onClick={() => { setPhase('lobby'); hasJoined.current = false; navigate('/live'); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" />Retour
        </button>
        {roomIdParam && <button onClick={() => { hasJoined.current = false; setPhase('joining'); joinRoom(roomIdParam); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm">
          <RefreshCw className="w-4 h-4" />Réessayer
        </button>}
      </div>
    </div>
  );

  /* ── LOBBY ─────────────────────────────────────────────────────── */
  if (phase === 'lobby' || phase === 'creating') return (
    <>
      <Helmet><title>Live Rooms — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 max-w-5xl pb-28">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2.5 bg-green-500/10 border border-green-500/25 text-green-400 px-5 py-2 rounded-full text-sm font-bold mb-5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              LIVE ROOMS
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
              Écoute <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">ensemble</span>
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">Crée une salle, invite tes amis et partagez la même vibe musicale en temps réel.</p>
          </motion.div>

          {/* Créer */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-5 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-green-400" />Créer une salle</h2>
            <div className="flex gap-3 flex-wrap">
              <input value={roomName} onChange={e => setRoomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createRoom()}
                placeholder="Nom de ta salle…" maxLength={60}
                className="flex-1 min-w-[160px] bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 placeholder-gray-500 transition-colors" />
              <button onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${isPrivate ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}{isPrivate ? 'Privée' : 'Publique'}
              </button>
              <button onClick={createRoom} disabled={!roomName.trim() || creatingRoom || !currentUser}
                className="bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-green-500/20 flex items-center gap-2">
                {creatingRoom ? <><Loader2 className="w-4 h-4 animate-spin" />Création…</> : <><Zap className="w-4 h-4" />Créer</>}
              </button>
            </div>
            {!currentUser && <p className="text-xs text-amber-400 mt-3 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /><Link to="/login" className="underline hover:text-amber-300">Connecte-toi</Link> pour créer une salle.</p>}
          </motion.div>

          {/* Grille de salles */}
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-green-400" />Salles en direct
                <span className="text-xs text-gray-600 font-normal bg-gray-800 px-2 py-0.5 rounded-full">{rooms.length}</span>
              </h2>
              <button onClick={fetchRooms} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />Actualiser
              </button>
            </div>
            {loadingRooms
              ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-green-400 animate-spin" /></div>
              : rooms.length === 0
                ? <div className="text-center py-16 sm:py-20">
                    <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4"><Radio className="w-8 h-8 text-gray-700" /></div>
                    <p className="text-gray-500 font-medium mb-1">Aucune salle active</p>
                    <p className="text-gray-700 text-sm">Sois le premier à en créer une !</p>
                  </div>
                : <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((r, i) => (
                      <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <RoomCard room={r} onJoin={joinRoom} />
                      </motion.div>
                    ))}
                  </div>
            }
          </div>
        </main>
      </div>
    </>
  );

  /* ══════════════════════════════════════════════════════════════════
     ROOM — Interface principale
     ══════════════════════════════════════════════════════════════════ */
  return (
    <>
      <Helmet><title>{room?.name || 'Live Room'} — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <main className="flex-1 flex flex-col" style={{ height: 'calc(100dvh - 64px)', maxHeight: 'calc(100dvh - 64px)' }}>

          {/* ── Barre supérieure ──────────────────────────────────── */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button onClick={() => setConfirmModal('leave')} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Avatar user={room?.host} size={8} crown />
              <div className="min-w-0">
                <h1 className="text-white font-bold text-sm sm:text-base truncate">{room?.name}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-500 hidden sm:block">par {room?.host?.username}</p>
                  <ConnBadge status={channelStatus} />
                  {liveDuration > 0 && (
                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{fmtDuration(liveDuration)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Compteur participants */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                <Users className="w-3.5 h-3.5" />
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pctCap >= 1 ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-cyan-500'}`} style={{ width: `${pctCap * 100}%` }} />
                </div>
                <span>{participants.length}/{MAX_PARTICIPANTS}</span>
              </div>
              {/* Qualité de sync (invités) */}
              {!isHost && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-gray-600">
                  <Volume2 className="w-3 h-3" />
                  <span className={syncQuality > 70 ? 'text-green-400' : syncQuality > 40 ? 'text-amber-400' : 'text-red-400'}>{syncQuality}%</span>
                </span>
              )}
              <button onClick={copyLink} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all">
                {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Copié</> : <><Share2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Partager</span></>}
              </button>
              {/* Bouton panneau mobile */}
              <button onClick={() => setMobileSideOpen(!mobileSideOpen)}
                className="lg:hidden flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 px-2.5 py-1.5 rounded-lg transition-colors">
                <Users className="w-3.5 h-3.5" />
                {participants.length > 0 && <span className="text-xs font-bold text-cyan-400">{participants.length}</span>}
              </button>
            </div>
          </div>

          {/* ── Corps principal ───────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden">

            {/* Chat (zone principale) */}
            <div className="flex-1 flex flex-col min-w-0">

              {/* Now Playing bar */}
              {nowPlaying && (
                <div className="flex-shrink-0 bg-gray-900/80 border-b border-gray-800 px-3 sm:px-4 py-2.5 flex items-center gap-3">
                  {nowPlaying.cover_url
                    ? <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Eq active />
                      <p className="text-white text-xs sm:text-sm font-semibold truncate">{nowPlaying.title}</p>
                    </div>
                    <p className="text-gray-500 text-[11px] sm:text-xs truncate">{nowPlaying.artist}</p>
                    <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
                        style={{ width: `${syncProgress * 100}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                  {isHost && queue.length > 0 && (
                    <button onClick={skipToNext} className="flex-shrink-0 p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                      <SkipForward className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 relative overflow-hidden">
                <div ref={chatRef} className="absolute inset-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-2 scrollbar-hide">
                  <EmojiBurst bursts={bursts} />
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4"><Headphones className="w-7 h-7 text-gray-700" /></div>
                      <p className="text-gray-500 text-sm font-medium">Aucun message</p>
                      <p className="text-gray-700 text-xs mt-1">Commence la conversation !</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {messages.map(m => m._system ? (
                        <SysMsg key={m.id} text={m.content}
                          icon={m._type === 'song' ? Music : m._type === 'join' ? Users : m._type === 'leave' ? LogOut : Zap} />
                      ) : (
                        <ChatMsg key={m.id} m={m}
                          isMine={m.user_id === currentUser?.id}
                          currentUserId={currentUser?.id}
                          isEditing={editingMsgId === m.id} editContent={editContent}
                          onStartEdit={() => { setEditingMsgId(m.id); setEditContent(m.content); }}
                          onSaveEdit={saveEdit} onCancelEdit={() => { setEditingMsgId(null); setEditContent(''); }}
                          onDelete={() => deleteMessage(m.id)} onChangeEdit={setEditContent} />
                      ))}
                    </AnimatePresence>
                  )}
                  {typingLabel && (
                    <div className="flex items-center gap-2 px-1"><TypingDots /><span className="text-xs text-gray-600 italic">{typingLabel}</span></div>
                  )}
                </div>
              </div>

              {/* Input chat */}
              <div className="flex-shrink-0 p-2.5 sm:p-3 bg-gray-900/95 border-t border-gray-800">
                <AnimatePresence>
                  {showReactions && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="flex flex-wrap gap-2 mb-2.5 p-3 bg-gray-800 rounded-xl">
                      {REACTION_EMOJIS.map(e => (
                        <button key={e} onClick={() => sendBurst(e)} className="text-xl hover:scale-125 transition-transform active:scale-90">{e}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex gap-2 items-center">
                  <input value={msgInput} onChange={e => { setMsgInput(e.target.value); broadcastTyping(); }}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Tape ton message…" maxLength={500}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500 transition-colors" />
                  <button onClick={() => setShowReactions(!showReactions)}
                    className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${showReactions ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                    <Smile className="w-4 h-4" />
                  </button>
                  <button onClick={sendMessage} disabled={!msgInput.trim()}
                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all flex-shrink-0 shadow-lg shadow-cyan-500/20">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── SIDEBAR desktop ───────────────────────────────────── */}
            <div className="hidden lg:flex w-72 xl:w-80 flex-col border-l border-gray-800 bg-gray-950/50 overflow-y-auto">
              {/* Tabs */}
              <div className="flex-shrink-0 flex bg-gray-900 border-b border-gray-800 p-1 gap-1">
                {[['participants', '👥'], ['queue', '🎵'], ['controls', '⚙️']].map(([id, emoji]) => (
                  <button key={id} onClick={() => setSideTab(id)}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all ${sideTab === id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-3 overflow-y-auto">
                {sideTab === 'participants' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-green-400" />Participants</h3>
                      <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{participants.length}/{MAX_PARTICIPANTS}</span>
                    </div>
                    {participants.length === 0
                      ? <p className="text-gray-600 text-xs text-center py-6">En attente de participants…</p>
                      : participants.map(p => (
                        <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-800 transition-colors">
                          <Avatar user={p} size={7} pulse />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold truncate">{p.username}</p>
                            {p.id === room?.host_id && <p className="text-amber-400 text-[10px]">Hôte</p>}
                          </div>
                          {p.id === room?.host_id && <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                        </div>
                      ))
                    }
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pctCap >= 1 ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-cyan-500'}`} style={{ width: `${pctCap * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">{MAX_PARTICIPANTS - participants.length} place{MAX_PARTICIPANTS - participants.length !== 1 ? 's' : ''} libre{MAX_PARTICIPANTS - participants.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )}

                {sideTab === 'queue' && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm flex items-center gap-2"><ListMusic className="w-4 h-4 text-cyan-400" />File d'attente</h3>
                      {queue.length > 0 && <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{queue.length}</span>}
                    </div>
                    {queue.length === 0
                      ? <div className="flex flex-col items-center justify-center py-8 text-center">
                          <ListMusic className="w-8 h-8 text-gray-800 mb-2" />
                          <p className="text-gray-600 text-xs">File vide</p>
                          {isHost && <p className="text-gray-700 text-[11px] mt-1">Ajoute des sons depuis Contrôles</p>}
                        </div>
                      : <AnimatePresence>
                          {queue.map((s, i) => (
                            <QueueItem key={s.id} song={s} index={i} isHost={isHost}
                              isNowPlaying={nowPlaying?.id === s.id}
                              onPlay={broadcastSong} onRemove={removeFromQueue} />
                          ))}
                        </AnimatePresence>
                    }
                  </div>
                )}

                {sideTab === 'controls' && (
                  <div className="space-y-3">
                    {isHost && (
                      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" />Contrôles Hôte</h3>
                        <div className="space-y-2">
                          <button onClick={() => { setShowPicker(!showPicker); setShowPlaylists(false); }}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2">
                            <Search className="w-4 h-4 text-cyan-400" />Chercher une musique
                          </button>
                          <button onClick={() => { setShowPlaylists(!showPlaylists); if (!showPlaylists) loadMyPlaylists(); setShowPicker(false); }}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-fuchsia-400" />Mes playlists
                          </button>
                          <input ref={fileInputRef} type="file"
                            accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,audio/flac,audio/x-m4a,audio/*"
                            onChange={handleLocalFile} className="hidden" />
                          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLocal}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2 disabled:opacity-50">
                            <Upload className="w-4 h-4 text-green-400" />{uploadingLocal ? 'Upload en cours…' : 'Importer un fichier local'}
                          </button>
                          {queue.length > 0 && (
                            <button onClick={skipToNext}
                              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2">
                              <SkipForward className="w-4 h-4 text-cyan-400" />Passer au suivant ({queue.length})
                            </button>
                          )}
                          {canStop && (
                            <button onClick={() => setConfirmModal('stop')}
                              className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2">
                              <X className="w-4 h-4" />Terminer le live
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recherche de son */}
                    <AnimatePresence>
                      {showPicker && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="bg-gray-900 border border-gray-800 rounded-2xl p-4 overflow-hidden">
                          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-cyan-400" />Recherche</h3>
                          <input value={songSearch} onChange={e => setSongSearch(e.target.value)}
                            placeholder="Titre ou artiste…" autoFocus
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500 transition-colors" />
                          <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-hide">
                            {songResults.map(s => (
                              <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-800 group transition-colors cursor-pointer">
                                {s.cover_url
                                  ? <img src={s.cover_url} alt={s.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                  : <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-gray-500" /></div>
                                }
                                <div className="flex-1 min-w-0" onClick={() => broadcastSong(s)}>
                                  <p className="text-white text-xs font-medium truncate">{s.title}</p>
                                  <p className="text-gray-500 text-xs truncate">{s.artist}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => broadcastSong(s)} className="p-1.5 text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 rounded-lg" title="Jouer maintenant"><Play className="w-3 h-3" /></button>
                                  <button onClick={() => addToQueue(s)} className="p-1.5 text-fuchsia-400 hover:text-fuchsia-300 bg-fuchsia-500/10 rounded-lg" title="Ajouter à la file"><Plus className="w-3 h-3" /></button>
                                </div>
                              </div>
                            ))}
                            {songSearch.trim() && songResults.length === 0 && <p className="text-gray-600 text-xs text-center py-4">Aucun résultat</p>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Mes playlists */}
                    <AnimatePresence>
                      {showPlaylists && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="bg-gray-900 border border-gray-800 rounded-2xl p-4 overflow-hidden">
                          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-fuchsia-400" />Mes playlists</h3>
                          {loadingPlaylists
                            ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" /></div>
                            : myPlaylists.length === 0
                              ? <p className="text-gray-600 text-xs text-center py-4">Aucune playlist</p>
                              : <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-hide">
                                  {myPlaylists.map(pl => (
                                    <div key={pl.id}
                                      onClick={() => addPlaylistToQueue(pl)}
                                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-800 cursor-pointer group transition-colors">
                                      {pl.cover_url
                                        ? <img src={pl.cover_url} alt={pl.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                        : <div className="w-9 h-9 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0"><ListMusic className="w-4 h-4 text-gray-500" /></div>
                                      }
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white text-xs font-semibold truncate group-hover:text-fuchsia-300 transition-colors">{pl.name}</p>
                                        <p className="text-gray-500 text-[10px]">{(pl.playlist_songs || []).length} son{(pl.playlist_songs || []).length !== 1 ? 's' : ''}</p>
                                      </div>
                                      <Plus className="w-4 h-4 text-gray-600 group-hover:text-fuchsia-400 flex-shrink-0 transition-colors" />
                                    </div>
                                  ))}
                                </div>
                          }
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Infos room */}
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400" />Infos</h3>
                      <div className="space-y-2 text-xs mb-3">
                        <div className="flex justify-between items-center"><span className="text-gray-500">Statut</span><ConnBadge status={channelStatus} /></div>
                        <div className="flex justify-between"><span className="text-gray-500">Salle</span><span className="text-white font-medium truncate ml-2 max-w-[120px]">{room?.name}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Visibilité</span><span className={room?.is_private ? 'text-amber-400' : 'text-green-400'}>{room?.is_private ? '🔒 Privée' : '🌐 Publique'}</span></div>
                        {isHost && <div className="flex justify-between"><span className="text-gray-500">Durée</span><span className="text-green-400">{fmtDuration(liveDuration)}</span></div>}
                      </div>
                      <button onClick={copyLink} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-xs transition-all flex items-center justify-center gap-2">
                        {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Lien copié !</> : <><Copy className="w-3.5 h-3.5" />Copier le lien</>}
                      </button>
                    </div>

                    {!isHost && (
                      <button onClick={() => setConfirmModal('leave')}
                        className="w-full bg-gray-900 border border-gray-800 hover:border-red-500/40 hover:bg-red-500/5 text-gray-400 hover:text-red-400 rounded-2xl px-4 py-3 text-sm transition-all flex items-center justify-center gap-2">
                        <LogOut className="w-4 h-4" />Quitter la salle
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Panneau mobile (bottom sheet) ──────────────────────── */}
      <AnimatePresence>
        {mobileSideOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileSideOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-gray-900 border-t border-gray-700 rounded-t-3xl max-h-[80vh] flex flex-col">
              {/* Handle */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
                  {[['participants', '👥'], ['queue', '🎵'], ['controls', '⚙️']].map(([id, emoji]) => (
                    <button key={id} onClick={() => setSideTab(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sideTab === id ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
                      {emoji} {id === 'participants' ? id.slice(0,4) : id === 'queue' ? 'File' : 'Ctrl'}
                    </button>
                  ))}
                </div>
                <button onClick={() => setMobileSideOpen(false)} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-8">
                {sideTab === 'participants' && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 mb-3">{participants.length} / {MAX_PARTICIPANTS} participants</p>
                    {participants.map(p => (
                      <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <Avatar user={p} size={8} pulse />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{p.username}</p>
                          {p.id === room?.host_id && <p className="text-amber-400 text-xs">Hôte 👑</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sideTab === 'queue' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-3">{queue.length} son{queue.length !== 1 ? 's' : ''} dans la file</p>
                    {queue.length === 0
                      ? <p className="text-gray-600 text-sm text-center py-8">File vide</p>
                      : <AnimatePresence>
                          {queue.map((s, i) => (
                            <QueueItem key={s.id} song={s} index={i} isHost={isHost}
                              isNowPlaying={nowPlaying?.id === s.id}
                              onPlay={broadcastSong} onRemove={removeFromQueue} />
                          ))}
                        </AnimatePresence>
                    }
                  </div>
                )}

                {sideTab === 'controls' && (
                  <div className="space-y-3">
                    {isHost ? (
                      <>
                        <button onClick={() => { setShowPicker(!showPicker); setShowPlaylists(false); }}
                          className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2">
                          <Search className="w-4 h-4 text-cyan-400" />Chercher une musique
                        </button>
                        <button onClick={() => { setShowPlaylists(!showPlaylists); if (!showPlaylists) loadMyPlaylists(); setShowPicker(false); }}
                          className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-fuchsia-400" />Mes playlists
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLocal}
                          className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2 disabled:opacity-50">
                          <Upload className="w-4 h-4 text-green-400" />{uploadingLocal ? 'Upload…' : 'Fichier local (MP3, WAV…)'}
                        </button>
                        {queue.length > 0 && (
                          <button onClick={() => { skipToNext(); setMobileSideOpen(false); }}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2">
                            <SkipForward className="w-4 h-4 text-cyan-400" />Passer au suivant
                          </button>
                        )}
                        {canStop && (
                          <button onClick={() => { setConfirmModal('stop'); setMobileSideOpen(false); }}
                            className="w-full bg-red-600/20 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2">
                            <X className="w-4 h-4" />Terminer le live
                          </button>
                        )}

                        {/* Picker dans le panneau mobile */}
                        {showPicker && (
                          <div className="bg-gray-800 rounded-2xl p-3">
                            <input value={songSearch} onChange={e => setSongSearch(e.target.value)}
                              placeholder="Titre ou artiste…" autoFocus
                              className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500" />
                            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                              {songResults.map(s => (
                                <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-700 cursor-pointer transition-colors"
                                  onClick={() => { broadcastSong(s); setMobileSideOpen(false); }}>
                                  {s.cover_url ? <img src={s.cover_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0"><Music className="w-3 h-3 text-gray-400" /></div>}
                                  <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{s.title}</p><p className="text-gray-400 text-[10px] truncate">{s.artist}</p></div>
                                  <div className="flex gap-1">
                                    <button onClick={e => { e.stopPropagation(); broadcastSong(s); setMobileSideOpen(false); }} className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded"><Play className="w-3 h-3" /></button>
                                    <button onClick={e => { e.stopPropagation(); addToQueue(s); }} className="p-1 text-fuchsia-400 hover:bg-fuchsia-500/10 rounded"><Plus className="w-3 h-3" /></button>
                                  </div>
                                </div>
                              ))}
                              {songSearch.trim() && songResults.length === 0 && <p className="text-gray-500 text-xs text-center py-3">Aucun résultat</p>}
                            </div>
                          </div>
                        )}

                        {/* Playlists dans le panneau mobile */}
                        {showPlaylists && (
                          <div className="bg-gray-800 rounded-2xl p-3">
                            {loadingPlaylists
                              ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" /></div>
                              : myPlaylists.length === 0
                                ? <p className="text-gray-500 text-xs text-center py-4">Aucune playlist trouvée</p>
                                : myPlaylists.map(pl => (
                                  <div key={pl.id} onClick={() => { addPlaylistToQueue(pl); setMobileSideOpen(false); }}
                                    className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-700 cursor-pointer transition-colors mb-1">
                                    {pl.cover_url ? <img src={pl.cover_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0"><ListMusic className="w-4 h-4 text-gray-400" /></div>}
                                    <div className="flex-1 min-w-0"><p className="text-white text-xs font-semibold truncate">{pl.name}</p><p className="text-gray-500 text-[10px]">{(pl.playlist_songs || []).length} sons</p></div>
                                    <Plus className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
                                  </div>
                                ))
                            }
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-800 rounded-2xl p-4 text-center">
                          <Volume2 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                          <p className="text-white text-sm font-semibold mb-1">Mode Auditeur</p>
                          <p className="text-gray-500 text-xs">Tu écoutes le live de {room?.host?.username}</p>
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="text-xs text-gray-500">Sync :</span>
                            <span className={`text-sm font-bold ${syncQuality > 70 ? 'text-green-400' : syncQuality > 40 ? 'text-amber-400' : 'text-red-400'}`}>{syncQuality}%</span>
                          </div>
                        </div>
                        <button onClick={() => { setConfirmModal('leave'); setMobileSideOpen(false); }}
                          className="w-full bg-gray-900 border border-gray-700 hover:border-red-500/40 hover:bg-red-500/5 text-gray-400 hover:text-red-400 rounded-2xl px-4 py-3 text-sm transition-all flex items-center justify-center gap-2">
                          <LogOut className="w-4 h-4" />Quitter la salle
                        </button>
                      </>
                    )}
                    <button onClick={copyLink} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-xs transition-all flex items-center justify-center gap-2">
                      {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Lien copié !</> : <><Copy className="w-3.5 h-3.5" />Copier le lien</>}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals de confirmation ─────────────────────────────── */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={e => { if (e.target === e.currentTarget) setConfirmModal(null); }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${confirmModal === 'stop' ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                {confirmModal === 'stop' ? <X className="w-6 h-6 text-red-400" /> : <LogOut className="w-6 h-6 text-amber-400" />}
              </div>
              <h3 className="text-white font-bold text-lg text-center mb-2">
                {confirmModal === 'stop' ? 'Terminer le live ?' : 'Quitter la salle ?'}
              </h3>
              <p className="text-gray-400 text-sm text-center mb-6">
                {confirmModal === 'stop'
                  ? 'Cette action mettra fin à la session pour tous les participants.'
                  : "Tu pourras revenir en utilisant le lien d'invitation."}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors">
                  Annuler
                </button>
                <button onClick={() => { leaveRoom(); setConfirmModal(null); }}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${confirmModal === 'stop' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {confirmModal === 'stop' ? 'Terminer' : 'Quitter'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveRoomPage;
