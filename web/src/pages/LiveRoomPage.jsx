/**
 * LiveRoomPage — NovaSound TITAN LUX V110000
 *
 * ✅ V100000 — Sync audio, playlist, file locale, réactions, typing, WakeLock
 * ✅ V110000 — Fix zone de saisie mobile (BottomNav masqué = input visible)
 * ✅ V110000 — Notifications join/leave remplacées par floating toast discret
 * ✅ V110000 — Zone réaction : fermeture manuelle (croix) + pas d'auto-close
 * ✅ V110000 — Pause/Resume live par l'hôte + broadcast aux auditeurs
 * ✅ V110000 — Partage du lien en live dans le chat global
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_GENRES, GENRE_THEMES_MAP } from '@/hooks/useGenreTheme';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LiveLikeButton from '@/components/LiveLikeButton';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { notifyFollowers, notifyUser } from '@/lib/notifUtils';
import {
  Radio, Users, Music, Send, Heart, Crown, Copy, Check, Plus, Lock, Unlock,
  Headphones, Zap, X, ArrowLeft, Loader2, WifiOff, RefreshCw, Search, Upload,
  Pencil, Trash2, CheckCircle2, XCircle, Play, ListMusic, SkipForward, LogOut,
  Smile, Share2, AlertCircle, Clock, Volume2, ChevronUp, BookOpen, Pause,
  MessageCircle,
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

// Descriptions personnalisées par genre musical
const GENRE_DESCRIPTIONS = {
  'bikutsi': '🔥 Plonge dans l\'énergie effrénée du Bikutsi camerounais ! Rythmes endiablés et danse traditionnelle beti.',
  'makossa': '🌍 Voyage au cœur de la Makossa, le son qui a conquis le monde. Groove doux et mélodies envoûtantes.',
  'assiko': '🌿 Laisse-toi porter par les rythmes traditionnels Assiko du littoral camerounais. Ambiance nature et authenticité.',
  'ambas-bay': '🌊 Découvre les sonorités folkloriques Yabassi. Musique authentique des rivières et traditions ancestrales.',
  'benskin': '🎭 Fusion unique entre traditions camerounaises et influences modernes. Le son urbain de Douala.',
  'mbole': '🥁 Rythmes puissants de la forêt équatoriale. Énergie brute et chants traditionnels Bantou.',
  'afrobeats': '🎵 Le son qui fait vibrer l\'Afrique ! Fusion moderne de rythmes traditionnels et influences urbaines.',
  'hip-hop': '🎤 Culture urbaine et flows puissants. Beats qui marquent l\'histoire et paroles qui font réfléchir.',
  'r&b': '💜 Sensualité et mélodies douces. Le son qui fait vibrer les cœurs.',
  'pop': '⭐ Hits radio et mélodies entraînantes. La musique qui plaît à tous.',
  'electronique': '🎧 Futurisme et beats synthétiques. L\'énergie de la nuit et des festivals.',
  'trap': '🔥 Basses lourdes et 808 puissants. Le son des rues et des clubs.',
  'gospel': '🙌 Musique sacrée et voix puissantes. Élévation spirituelle et harmonie.',
  'jazz': '🎺 Improvisation et sophistication. Le son chic des salles de concert.',
  'reggae': '🌺 Rythmes jamaïcains et messages positifs. Peace & Love.',
  'dancehall': '🔥 Énergie des tropiques et vibrations. Le son qui fait bouger les corps.',
  'amapiano': '🎹 Piano log et basses profondes. Le son d\'Afrique du Sud qui conquiert le monde.',
  'coupe-decale': '🎵 Côte d\'Ivoire et rythmes entraînants. Le son qui fait danser l\'Afrique de l\'Ouest.',
  'rock': '🎸 Guitares électriques et énergie brute. Le son de la rébellion.',
  'classique': '🎻 Œuvres intemporelles et orchestres majestueux. La musique des siècles.',
  'folk': '🎸 Acoustique et authenticité. Le son des racines et des histoires.',
  'country': '🤠 Guitares acoustiques et histoires de vie. Le son de l\'Amérique profonde.',
  'latin': '💃 Salsa, reggaeton et rythmes latinos. La passion et la fiesta.',
  'drill': '🔥 Basses sombres et flows rapides. Le son des rues modernes.',
  'outro': '🎯 Expérimental et avant-garde. Le son de demain.',
};
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
          animate={active ? { height: [`${h * 100}%`, '20%', `${h * 80}%`, '100%', `${h * 100}%`] } : { height: '20%' }}
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
          <h3 className="text-white font-bold text-base truncate">{room.title || room.name}</h3>
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
  const { playSong, isVisible: playerVisible, currentSong: playerSong } = usePlayer();
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
  const [mentionUsers,  setMentionUsers]  = useState([]);
  const [showMention,   setShowMention]   = useState(false);
  const msgInputRef = useRef(null);
  const mentionDebounce = useRef(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editContent, setEditContent]   = useState('');
  const [typingUsers, setTypingUsers]   = useState([]);
  const [nowPlaying, setNowPlaying]     = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [queue, setQueue]               = useState([]);
  const [isHost, setIsHost]             = useState(false);

  /* Lobby / Create */
  const [roomName, setRoomName]         = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomGenre, setRoomGenre]       = useState('');
  const [maxParticipants, setMaxParticipants] = useState(20);
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
  // V110000 — nouvelles features
  const [liveIsPaused, setLiveIsPaused] = useState(false);
  const [joinLeaveToast, setJoinLeaveToast] = useState(null); // { text, type }
  const [chatShared, setChatShared]     = useState(false);

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
  const joinLeaveTimer = useRef(null); // V110000

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

  /* ── Créer une salle ───────────────────────────────────────────── */
  const createRoom = useCallback(async () => {
    if (!currentUser || !roomName.trim() || creatingRoom) return;
    
    setCreatingRoom(true);
    setPhase('creating');
    
    try {
      // Utiliser la description personnalisée ou celle du genre
      const finalDescription = roomDescription?.trim() || 
        (roomGenre && GENRE_DESCRIPTIONS[roomGenre] ? GENRE_DESCRIPTIONS[roomGenre] : 
         'Rejoignez ce live pour découvrir de la musique incroyable !');

      // Créer la salle avec toutes les options
      const { data: roomData, error } = await supabase
        .from('live_rooms')
        .insert({
          title: roomName.trim(),
          description: finalDescription,
          genre: roomGenre || null,
          max_participants: maxParticipants,
          host_id: currentUser.id,
          is_active: true,
          is_private: isPrivate,
          participants_count: 1, // L'hôte compte comme participant
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Ajouter l'hôte comme participant
      await supabase
        .from('live_room_participants')
        .insert({
          room_id: roomData.id,
          user_id: currentUser.id,
          joined_at: new Date().toISOString(),
          is_host: true
        });
      
      // Notifier les followers (si public)
      if (!isPrivate) {
        try {
          await notifyFollowers(supabase, currentUser.id, {
            type:     'live_start',
            title:    `🎙️ ${currentUser.username || 'Quelqu\'un'} est en live !`,
            body:     roomName.trim(),
            url:      `/live/${roomData.id}`,
            icon_url: currentUser.avatar_url || '/icon-192.png',
          });
        } catch (_) { /* non-fatal */ }
      }
      
      // Rediriger vers la salle
      navigate(`/live/${roomData.id}`);
      
    } catch (error) {
      console.error('Erreur création salle:', error);
      setPhase('lobby');
      alert('Erreur lors de la création : ' + (error.message || 'Veuillez réessayer.'));
    } finally {
      setCreatingRoom(false);
      // Réinitialiser le formulaire
      setRoomName('');
      setRoomDescription('');
      setRoomGenre('');
      setMaxParticipants(20);
      setIsPrivate(false);
    }
  }, [currentUser, roomName, roomDescription, roomGenre, maxParticipants, isPrivate, creatingRoom, navigate]);

  /* ── Fetch lobby ──────────────────────────────────────────────── */
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { data } = await supabase.from('live_rooms')
        .select('id,title,description,genre,is_active,is_private,host_id,participants_count,created_at,host:host_id(id,username,avatar_url),current_song:current_song_id(id,title,artist,cover_url)')
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

  /* ── V110000 : floating toast pour join/leave (discret, non-intrusif) ── */
  const showJoinLeave = useCallback((text, type) => {
    if (joinLeaveTimer.current) clearTimeout(joinLeaveTimer.current);
    setJoinLeaveToast({ text, type });
    joinLeaveTimer.current = setTimeout(() => setJoinLeaveToast(null), 3000);
  }, []);

  /* ── V110000 : Pause / Resume live par l'hôte ──────────────────── */
  const togglePause = useCallback(async () => {
    if (!isHostRef.current || !chanRef.current) return;
    const audio = document.querySelector('audio');
    const newPaused = !liveIsPaused;
    setLiveIsPaused(newPaused);
    if (audio) {
      try { newPaused ? audio.pause() : await audio.play(); } catch {}
    }
    chanRef.current.send({ type: 'broadcast', event: 'live_pause', payload: { isPaused: newPaused } }).catch(() => {});
    if (roomRef.current) {
      try { await supabase.from('live_rooms').update({ is_paused: newPaused }).eq('id', roomRef.current.id); } catch (_) {}
    }
  }, [liveIsPaused]);

  /* ── V110000 : Partager le lien du live dans le chat global ─────── */
  const shareInGlobalChat = useCallback(async () => {
    if (!currentUser || !roomRef.current) return;
    const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Quelqu\'un';
    const link = `${window.location.origin}/#/live/${roomRef.current.id}`;
    const content = `🔴 LIVE • ${roomRef.current.name}\n${username} vous invite à rejoindre !\n👉 ${link}`;
    try {
      await supabase.from('chat_messages').insert({ user_id: currentUser.id, content: content.slice(0, 1000) });
      setChatShared(true);
      setTimeout(() => setChatShared(false), 3000);
    } catch (err) { console.error('shareInGlobalChat:', err); }
  }, [currentUser]);

  /* ── Ancienne fonction createRoom supprimée (remplacée par la version complète) ── */

  /* ── Rejoindre une salle ─────────────────────────────────────── */
  const joinRoom = useCallback(async (id, asHost = false) => {
    if (!currentUser) { navigate('/login'); return; }
    if (hasJoined.current) return;
    hasJoined.current = true;
    setPhase('joining'); setJoinError(null); setChannelStatus('connecting');

    try {
      const { data: rd, error: re } = await supabase.from('live_rooms')
        .select('id,title,description,genre,is_active,is_private,host_id,participants_count,created_at,current_song_id,host:host_id(id,username,avatar_url),current_song:current_song_id(id,title,artist,cover_url,audio_url)')
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
          if (u && u.id !== currentUser.id) {
            showJoinLeave(`${u.username} a rejoint 👋`, 'join');
            // Notifier l'hôte qu'un participant a rejoint
            if (roomRef.current?.host_id && roomRef.current.host_id !== u.id) {
              notifyUser(supabase, roomRef.current.host_id, {
                type:     'live_join',
                title:    `👋 ${u.username} a rejoint ton live`,
                body:     roomRef.current.title || 'Live Room',
                url:      `/live/${roomRef.current.id}`,
                icon_url: u.avatar_url || '/icon-192.png',
                metadata: { roomId: roomRef.current.id, userId: u.id },
              }).catch(() => {});
            }
          }
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          const u = leftPresences?.[0]?.user;
          if (u && u.id !== currentUser.id) showJoinLeave(`${u.username} a quitté`, 'leave');
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
        // V110000 — Pause / Resume live reçu par les auditeurs
        .on('broadcast', { event: 'live_pause' }, ({ payload }) => {
          if (!payload || isHostRef.current) return;
          setLiveIsPaused(payload.isPaused);
          const audio = document.querySelector('audio');
          if (!audio) return;
          if (payload.isPaused) { audio.pause(); }
          else { audio.play().catch(() => {}); }
        })
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
  }, [currentUser, navigate, playSong, scrollChat, startSync, startHeartbeat, startDurationTimer, acquireWakeLock, injectSys, showJoinLeave]); // eslint-disable-line

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
  // ── @mention autocomplétion (Live) ─────────────────────────────
  const handleMsgChange = useCallback((e) => {
    const val = e.target.value.slice(0, 500);
    setMsgInput(val);
    broadcastTyping();
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match  = before.match(/@([\w-]*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setShowMention(true);
      if (q.length >= 1) {
        clearTimeout(mentionDebounce.current);
        mentionDebounce.current = setTimeout(async () => {
          // Chercher parmi les participants du live d'abord, sinon tous les users
          const participantUsernames = participants.map(p => p.username).filter(Boolean);
          if (participantUsernames.length) {
            const filtered = participants.filter(p =>
              p.username?.toLowerCase().startsWith(q)
            ).slice(0, 5);
            setMentionUsers(filtered);
          } else {
            try {
              const { data } = await supabase.from('users')
                .select('id,username,avatar_url').ilike('username', `${q}%`).limit(5);
              setMentionUsers(data || []);
            } catch { setMentionUsers([]); }
          }
        }, 150);
      } else {
        // @ seul → montrer tous les participants
        setMentionUsers(participants.slice(0, 5));
      }
    } else {
      setShowMention(false);
      setMentionUsers([]);
    }
  }, [participants, broadcastTyping]);

  const insertMention = useCallback((username) => {
    const cursor    = msgInputRef.current?.selectionStart || msgInput.length;
    const before    = msgInput.slice(0, cursor);
    const after     = msgInput.slice(cursor);
    const newBefore = before.replace(/@([\w-]*)$/, `@${username} `);
    const newText   = (newBefore + after).slice(0, 500);
    setMsgInput(newText);
    setShowMention(false);
    setMentionUsers([]);
    setTimeout(() => {
      if (msgInputRef.current) {
        msgInputRef.current.focus();
        const pos = newBefore.length;
        msgInputRef.current.setSelectionRange(pos, pos);
      }
    }, 50);
  }, [msgInput]);

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
      // Notifier l'hôte (si c'est pas lui qui envoie)
      if (roomRef.current?.host_id && roomRef.current.host_id !== currentUser.id) {
        const uname = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Quelqu\'un';
        notifyUser(supabase, roomRef.current.host_id, {
          type:     'live_comment',
          title:    `💬 ${uname} dans ton live`,
          body:     content.slice(0, 100),
          url:      `/live/${roomRef.current.id}`,
          icon_url: currentUser.user_metadata?.avatar_url || '/icon-192.png',
          metadata: { roomId: roomRef.current.id },
        }).catch(() => {});
      }
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
    if (!file.type.startsWith('audio/')) { alert('Fichiers audio uniquement (mp3, wav…)'); return; }
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
    addBurst(e, x);
    // V110000 : ne pas fermer automatiquement — l'utilisateur ferme manuellement
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
      <div className="text-center"><p className="text-white font-bold text-xl mb-2">{'Impossible de rejoindre'}</p><p className="text-gray-400 text-sm max-w-sm">{joinError}</p></div>
      <div className="flex gap-3">
        <button onClick={() => { setPhase('lobby'); hasJoined.current = false; navigate('/live'); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" />{'Retour'}
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
        <main className="flex-1 w-full max-w-screen-xl mx-auto px-4 md:px-8 lg:px-12 py-4 sm:py-8 pb-28">

          {/* Hero — compact on mobile */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5 sm:mb-12">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 px-3 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs sm:text-sm font-bold mb-3 sm:mb-5">
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-green-500" />
              </span>
              LIVE ROOMS
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white mb-2 sm:mb-4 tracking-tight">
              {'Écoute'} <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">{'ensemble'}</span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-lg max-w-lg mx-auto leading-relaxed hidden sm:block">{'Crée une salle, invite tes amis et partagez la même vibe musicale en temps réel.'}</p>
          </motion.div>

          {/* Créer une salle - Interface améliorée */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-gray-900/60 backdrop-blur-md border border-white/[0.06] rounded-2xl p-4 sm:p-8 mb-5 sm:mb-10 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center">
                <Radio className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">Créer ta salle live</h2>
                <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">Lance un live et partage ta musique avec tes amis</p>
              </div>
            </div>

            {/* Formulaire de création */}
            <div className="space-y-4">
              {/* Titre du live */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Titre du live</label>
                <input 
                  value={roomName} 
                  onChange={e => setRoomName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && createRoom()}
                  placeholder="Ex: Soirée Chill, Session Hip-Hop, Mix Electro..." 
                  maxLength={60}
                  className="w-full bg-gray-800/90 border border-white/[0.10] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-cyan-500/50 focus:bg-gray-800 transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">{roomName.length}/60 caractères</p>
              </div>

              {/* Description optionnelle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (optionnel)</label>
                <textarea
                  value={roomDescription || ''}
                  onChange={e => setRoomDescription(e.target.value)}
                  placeholder="Décris ton live... ambiance, style musical, etc."
                  maxLength={200}
                  rows={2}
                  className="w-full bg-gray-800/90 border border-white/[0.10] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 focus:bg-gray-800 transition-all resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{(roomDescription || '').length}/200 caractères</p>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isPrivate 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' 
                      : 'bg-gray-800/90 border-white/[0.10] text-gray-400 hover:border-cyan-500/30'
                  }`}
                >
                  {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {isPrivate ? 'Privée' : 'Publique'}
                </button>

                <button 
                  onClick={() => setMaxParticipants(maxParticipants === 10 ? 50 : maxParticipants - 10)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.10] bg-gray-800/90 text-gray-400 hover:border-cyan-500/30 text-sm font-medium transition-all"
                >
                  <Users className="w-4 h-4" />
                  Max: {maxParticipants}
                </button>

                <div className="flex flex-wrap gap-2">
                  {ALL_GENRES.map(g => (
                    <button key={g} type="button"
                      onClick={() => setRoomGenre(roomGenre === g ? '' : g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        roomGenre === g
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-gray-200'
                      }`}
                    >{g}</button>
                  ))}
                </div>

                {/* Aperçu de la description personnalisée */}
                {roomGenre && GENRE_DESCRIPTIONS[roomGenre] && (
                  <div className="mt-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                    <p className="text-xs text-cyan-300 leading-relaxed">
                      💡 Description automatique : {GENRE_DESCRIPTIONS[roomGenre]}
                    </p>
                  </div>
                )}
              </div>

              {/* Bouton de création */}
              <button 
                onClick={createRoom} 
                disabled={!roomName.trim() || creatingRoom || !currentUser}
                className="w-full bg-gradient-to-r from-green-500 via-cyan-500 to-purple-500 hover:from-green-600 hover:via-cyan-600 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-all shadow-xl shadow-green-500/30 flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {creatingRoom ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Création de la salle...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>Lancer le live maintenant</span>
                  </>
                )}
              </button>

              {!currentUser && (
                <p className="text-amber-400 text-sm text-center flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <Link to="/login" className="underline hover:text-amber-300 font-medium">
                    Connecte-toi pour créer une salle
                  </Link>
                </p>
              )}
            </div>
          </motion.div>

          {/* Grille de salles */}
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-green-400" />{'Écoute'}
                <span className="text-xs text-gray-600 font-normal bg-gray-800 px-2 py-0.5 rounded-full">{rooms.length}</span>
              </h2>
              <button onClick={fetchRooms} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />{'Réessayer'}
              </button>
            </div>
            {loadingRooms
              ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-green-400 animate-spin" /></div>
              : rooms.length === 0
                ? <div className="text-center py-16 sm:py-20">
                    <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4"><Radio className="w-8 h-8 text-gray-700" /></div>
                    <p className="text-gray-500 font-medium mb-1">{'Aucune salle active'}</p>
                    <p className="text-gray-700 text-sm">{'Sois le premier à lancer une session live !'}</p>
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
        <Footer />
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

        <main className="flex-1 flex flex-col overflow-hidden"
          style={{
            /* Sur mobile on réserve la place pour le BottomNav (56px) */
            height: 'calc(100dvh - 120px)',
            maxHeight: 'calc(100dvh - 120px)',
            paddingBottom: 'var(--bottom-nav-h, 0px)',
          }}>
          <style>{`:root { --bottom-nav-h: 56px; } @media (min-width: 768px) { :root { --bottom-nav-h: 0px; } }`}</style>

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
                  {/* V110000 — indicateur pause */}
                  {liveIsPaused && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                      <Pause className="w-2.5 h-2.5" />En pause
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
              {/* V110000 — Bouton Pause/Resume hôte */}
              {isHost && (
                <button onClick={togglePause}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${liveIsPaused ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                  {liveIsPaused ? <><Play className="w-3.5 h-3.5" /><span className="hidden sm:inline">{'Reprendre'}</span></> : <><Pause className="w-3.5 h-3.5" /><span className="hidden sm:inline">{'Pause'}</span></>}
                </button>
              )}
              <button onClick={copyLink} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all">
                {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Copié</> : <><Share2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Partager</span></>}
              </button>
              {/* Live Like Button */}
              <LiveLikeButton 
                roomId={room?.id}
                initialLikes={room?.likes_count || 0}
                roomTitle={room?.name}
                hostId={room?.host_id}
                compact={true}
              />
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
                {/* V110000 — Toast discret join/leave en haut du chat */}
                <AnimatePresence>
                  {joinLeaveToast && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.25 }}
                      className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                    >
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border backdrop-blur-sm
                        ${joinLeaveToast.type === 'join'
                          ? 'bg-green-500/15 border-green-500/30 text-green-300'
                          : 'bg-gray-800/90 border-gray-700 text-gray-400'}`}>
                        {joinLeaveToast.type === 'join' ? <Users className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        {joinLeaveToast.text}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={chatRef} className="absolute inset-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-2 scrollbar-hide">
                  <EmojiBurst bursts={bursts} />
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4"><Headphones className="w-7 h-7 text-gray-700" /></div>
                      <p className="text-gray-500 text-sm font-medium">{'Aucun message'}</p>
                      <p className="text-gray-700 text-xs mt-1">{'Commence la conversation !'}</p>
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
              <div
                className="flex-shrink-0 px-3 pt-2.5 pb-3 bg-gray-900/98 border-t border-gray-800"
                style={{
                  paddingBottom: `calc(env(safe-area-inset-bottom, 10px) + 10px${playerVisible && playerSong ? ' + 72px' : ''})`,
                }}
              >
                <AnimatePresence>
                  {showReactions && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="flex flex-wrap gap-2 mb-2.5 p-3 bg-gray-800 rounded-xl relative">
                      <button
                        onClick={() => setShowReactions(false)}
                        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                        title="Fermer">
                        <X className="w-3 h-3" />
                      </button>
                      <div className="w-full flex flex-wrap gap-2 pr-6">
                        {REACTION_EMOJIS.map(e => (
                          <button key={e} onClick={() => sendBurst(e)} className="text-xl hover:scale-125 transition-transform active:scale-90">{e}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex gap-2 items-end">
                  <div className="relative flex-1">
                    {showMention && mentionUsers.length > 0 && (
                      <div className="absolute bottom-full mb-1 left-0 right-0 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                        {mentionUsers.map(u => (
                          <button key={u.id} onClick={() => insertMention(u.username)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 transition-colors text-left">
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                              : <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs text-cyan-400 flex-shrink-0">{u.username?.[0]?.toUpperCase()}</div>
                            }
                            <span className="text-white text-sm font-medium">@{u.username}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={msgInputRef}
                      value={msgInput}
                      onChange={handleMsgChange}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                      placeholder="Écrire un message… (@nom pour mentionner)"
                      maxLength={500}
                      rows={1}
                      style={{ resize: 'none', minHeight: 60, maxHeight: 140 }}
                      onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-cyan-500 placeholder-gray-500 transition-colors leading-relaxed overflow-y-auto"
                    />
                  </div>
                  <button onClick={() => setShowReactions(!showReactions)}
                    className={`p-2.5 rounded-xl transition-all flex-shrink-0 mb-0.5 ${showReactions ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                    <Smile className="w-4 h-4" />
                  </button>
                  <button onClick={sendMessage} disabled={!msgInput.trim()}
                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all flex-shrink-0 shadow-lg shadow-cyan-500/20 mb-0.5">
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
                      <h3 className="text-white font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-green-400" />{'Participants'}</h3>
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
                      <h3 className="text-white font-bold text-sm flex items-center gap-2"><ListMusic className="w-4 h-4 text-cyan-400" />{'File musicale'}</h3>
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
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-base mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500 transition-colors" />
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
                      {/* V110000 — Partager dans le chat global */}
                      <button onClick={shareInGlobalChat} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-xs transition-all flex items-center justify-center gap-2">
                        {chatShared ? <><Check className="w-3.5 h-3.5 text-green-400" />Partagé dans le chat !</> : <><MessageCircle className="w-3.5 h-3.5 text-fuchsia-400" />Partager dans le chat global</>}
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
                        {/* V110000 — Pause mobile */}
                        {isHost && (
                          <button onClick={() => { togglePause(); }}
                            className={`w-full rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2 border ${liveIsPaused ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'}`}>
                            {liveIsPaused ? <><Play className="w-4 h-4" />Reprendre le live</> : <><Pause className="w-4 h-4" />Mettre en pause</>}
                          </button>
                        )}

                        {/* Picker dans le panneau mobile */}
                        {showPicker && (
                          <div className="bg-gray-800 rounded-2xl p-3">
                            <input value={songSearch} onChange={e => setSongSearch(e.target.value)}
                              placeholder="Titre ou artiste…" autoFocus
                              className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-base mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500" />
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
                    {/* V110000 — Partager dans le chat global (mobile) */}
                    <button onClick={() => { shareInGlobalChat(); setMobileSideOpen(false); }}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-xs transition-all flex items-center justify-center gap-2">
                      {chatShared ? <><Check className="w-3.5 h-3.5 text-green-400" />Partagé !</> : <><MessageCircle className="w-3.5 h-3.5 text-fuchsia-400" />Partager dans le chat global</>}
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
        <Footer />
    </>
  );
};

export default LiveRoomPage;
