/**
 * LiveRoomPage — NovaSound TITAN LUX V40000
 *
 * ✅ Song queue management (host adds/removes songs, auto-advance)
 * ✅ Typing indicators (real-time broadcast)
 * ✅ Join/leave system messages in chat
 * ✅ Animated equalizer for now-playing
 * ✅ Tab sidebar: Participants | Queue | Controls
 * ✅ Mobile bottom drawer for sidebar
 * ✅ Emoji reaction picker (12 emojis)
 * ✅ Message timestamps (relative)
 * ✅ Capacity progress bar
 * ✅ Auto-reconnection logic
 * ✅ Now-playing progress bar synced via broadcast
 * ✅ Play now OR add to queue from song search
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
  Smile, Share2, AlertCircle,
} from 'lucide-react';

const MAX_PARTICIPANTS = 12;
const SYNC_MS          = 2000;
const HEARTBEAT_MS     = 30000;
const TYPING_TIMEOUT   = 3000;
const REACTION_EMOJIS  = ['🔥','💜','🎵','✨','🎶','❤️','💫','🎉','😍','🚀','👏','🤩'];
const GRADIENTS        = ['from-cyan-500 to-blue-600','from-fuchsia-500 to-purple-600','from-amber-400 to-orange-500','from-emerald-400 to-teal-600','from-rose-400 to-pink-600','from-indigo-400 to-violet-600','from-sky-400 to-cyan-600','from-lime-400 to-green-600'];

const avatarGrad = (id='') => GRADIENTS[(id.charCodeAt(0)||0)%GRADIENTS.length];

const relTime = (iso) => {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return 'instant';
  if (d < 3600000) return Math.floor(d/60000)+'m';
  return Math.floor(d/3600000)+'h';
};

/* ── Avatar ── */
const Avatar = ({ user, size=9, crown=false, pulse=false }) => {
  const initials = (user?.username||'?').slice(0,2).toUpperCase();
  const grad = avatarGrad(user?.id);
  return (
    <div className={`relative w-${size} h-${size} rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-white/10`}>
      {user?.avatar_url ? <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover"/> : <span className="select-none">{initials}</span>}
      {crown && <div className="absolute -top-2 -right-1.5 text-sm select-none drop-shadow">👑</div>}
      {pulse && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-gray-900"/>}
    </div>
  );
};

/* ── Animated Equalizer ── */
const Eq = ({ active=true, color='cyan' }) => {
  const bars = [0.4,0.7,1,0.6,0.85];
  const c = {cyan:'bg-cyan-400',fuchsia:'bg-fuchsia-400',green:'bg-green-400'}[color]||'bg-cyan-400';
  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map((h,i)=>(
        <motion.div key={i} className={`w-0.5 rounded-full ${c}`}
          animate={active?{height:[`${h*100}%`,'20%',`${h*80}%`,'100%',`${h*100}%`]}:{height:'20%'}}
          transition={{duration:1.2,repeat:Infinity,delay:i*0.15,ease:'easeInOut'}}
          style={{height:'20%'}}/>
      ))}
    </div>
  );
};

/* ── Emoji bursts ── */
const EmojiBurst = ({ bursts }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
    <AnimatePresence>
      {bursts.map(b=>(
        <motion.div key={b.id} initial={{opacity:1,y:0,scale:0.6}} animate={{opacity:0,y:-130,scale:1.8}}
          exit={{opacity:0}} transition={{duration:1.8,ease:'easeOut'}}
          className="absolute text-3xl select-none" style={{left:b.x,bottom:20}}>
          {b.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

/* ── Typing dots ── */
const TypingDots = () => (
  <div className="flex items-center gap-1 px-4 py-2 bg-gray-800 rounded-2xl w-fit">
    {[0,1,2].map(i=>(
      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
        animate={{opacity:[0.3,1,0.3],scale:[0.8,1.2,0.8]}}
        transition={{duration:1,repeat:Infinity,delay:i*0.2}}/>
    ))}
  </div>
);

/* ── Connection badge ── */
const ConnBadge = ({ status }) => {
  const cfg = {
    connected:  {label:'Connecté',  dot:'bg-green-400',  cls:'bg-green-500/10 border-green-500/30 text-green-400'},
    connecting: {label:'Connexion…',dot:'bg-yellow-400 animate-pulse',cls:'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'},
    error:      {label:'Déconnecté',dot:'bg-red-400',    cls:'bg-red-500/10 border-red-500/30 text-red-400'},
    idle:       {label:'Inactif',   dot:'bg-gray-400',   cls:'bg-gray-800 border-gray-700 text-gray-400'},
  }[status]||{label:status,dot:'bg-gray-400',cls:'bg-gray-800 border-gray-700 text-gray-400'};
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
    </span>
  );
};

/* ── Room card (lobby) ── */
const RoomCard = ({ room, onJoin }) => {
  const full = (room.participants_count||0) >= MAX_PARTICIPANTS;
  const pct  = Math.min((room.participants_count||0)/MAX_PARTICIPANTS,1);
  return (
    <motion.div whileHover={{scale:full?1:1.02,y:full?0:-2}} whileTap={{scale:full?1:0.97}}
      onClick={()=>!full&&onJoin(room.id)}
      className={`relative bg-gray-900/80 backdrop-blur border rounded-2xl p-5 transition-all overflow-hidden
        ${full?'border-gray-800 opacity-60 cursor-not-allowed':'border-gray-800 hover:border-cyan-500/50 cursor-pointer hover:shadow-lg hover:shadow-cyan-500/5'}`}>
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"/></span>
        <span className="text-xs text-red-400 font-semibold">LIVE</span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={room.host} size={10} crown/>
        <div className="min-w-0">
          <h3 className="text-white font-bold text-base truncate">{room.name}</h3>
          <p className="text-xs text-gray-500 truncate">par {room.host?.username||'Anonyme'}</p>
        </div>
      </div>
      {room.current_song && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-gray-800/60 rounded-xl">
          <Eq active={!full}/><div className="min-w-0"><p className="text-xs text-gray-300 truncate font-medium">{room.current_song.title}</p><p className="text-xs text-gray-500 truncate">{room.current_song.artist}</p></div>
        </div>
      )}
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{room.participants_count||0} participants</span>
        <span>{full?'Salle pleine':`${MAX_PARTICIPANTS-(room.participants_count||0)} libres`}</span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${full?'bg-red-500':'bg-gradient-to-r from-cyan-500 to-fuchsia-500'}`}
          initial={{width:0}} animate={{width:`${pct*100}%`}} transition={{duration:0.6}}/>
      </div>
    </motion.div>
  );
};

/* ── Queue item ── */
const QueueItem = ({ song, index, isHost, onPlay, onRemove }) => (
  <motion.div layout initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:10}}
    className="flex items-center gap-3 p-2.5 rounded-xl group hover:bg-gray-800 transition-all">
    <span className="w-6 text-gray-600 text-xs font-mono flex-shrink-0 text-center">{index+1}</span>
    {song.cover_url?<img src={song.cover_url} alt={song.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0"/>
      :<div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-gray-500"/></div>}
    <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{song.title}</p><p className="text-gray-500 text-xs truncate">{song.artist}</p></div>
    {isHost&&(
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={()=>onPlay(song)} className="p-1 text-gray-400 hover:text-cyan-400 transition-colors"><Play className="w-3.5 h-3.5"/></button>
        <button onClick={()=>onRemove(song.id)} className="p-1 text-gray-400 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5"/></button>
      </div>
    )}
  </motion.div>
);

/* ── Chat message ── */
const ChatMsg = ({ m, isMine, isEditing, editContent, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onChangeEdit }) => (
  <motion.div layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.2}}
    className={`flex gap-2.5 ${isMine?'justify-end':'justify-start'} group`}>
    {!isMine&&<Avatar user={m.user} size={7} pulse/>}
    <div className={`max-w-[75%] ${isMine?'text-right':'text-left'}`}>
      {!isMine&&<p className="text-xs text-gray-500 mb-1 ml-1">{m.user?.username||'Anonyme'}</p>}
      <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine?'bg-gradient-to-br from-cyan-500 to-fuchsia-500 text-white rounded-tr-sm':'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
        {isEditing?(
          <div className="flex items-center gap-2">
            <input value={editContent} onChange={e=>onChangeEdit(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')onSaveEdit();if(e.key==='Escape')onCancelEdit();}}
              className="bg-black/20 border border-white/30 rounded-lg px-2 py-1 text-white text-sm w-44 focus:outline-none focus:border-white/60" autoFocus/>
            <button onClick={onSaveEdit} className="text-green-300 hover:text-green-200"><CheckCircle2 className="w-4 h-4"/></button>
            <button onClick={onCancelEdit} className="text-red-300 hover:text-red-200"><XCircle className="w-4 h-4"/></button>
          </div>
        ):(
          <><p className="break-words whitespace-pre-wrap">{m.content}</p>{m.is_edited&&<p className="text-xs opacity-50 mt-0.5">modifié</p>}</>
        )}
      </div>
      <div className={`flex items-center gap-1.5 mt-1 ${isMine?'justify-end':'justify-start'}`}>
        <span className="text-[10px] text-gray-600">{relTime(m.created_at)}</span>
        {isMine&&!isEditing&&(
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onStartEdit} className="text-gray-600 hover:text-gray-300 transition-colors"><Pencil className="w-3 h-3"/></button>
            <button onClick={onDelete} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3"/></button>
          </div>
        )}
      </div>
    </div>
    {isMine&&<Avatar user={m.user} size={7}/>}
  </motion.div>
);

/* ── System message ── */
const SysMsg = ({ text, Icon=Zap }) => (
  <div className="flex items-center justify-center gap-2 my-3">
    <div className="h-px flex-1 bg-gray-800"/>
    <div className="flex items-center gap-1.5 text-xs text-gray-600 px-2"><Icon className="w-3 h-3"/>{text}</div>
    <div className="h-px flex-1 bg-gray-800"/>
  </div>
);

/* ── Loading screen ── */
const LoadingScreen = ({ label='Connexion…' }) => (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/20 to-fuchsia-500/20 border border-red-500/20 flex items-center justify-center">
        <Radio className="w-9 h-9 text-red-400"/>
      </div>
      <motion.div className="absolute inset-0 rounded-2xl border-2 border-cyan-500/40"
        animate={{scale:[1,1.15,1],opacity:[0.5,0,0.5]}} transition={{duration:2,repeat:Infinity}}/>
    </div>
    <div className="text-center">
      <p className="text-white font-semibold mb-2">{label}</p>
      <div className="flex items-center justify-center gap-1.5">
        {[0,1,2].map(i=>(
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400"
            animate={{opacity:[0.3,1,0.3]}} transition={{duration:1,repeat:Infinity,delay:i*0.2}}/>
        ))}
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                              */
/* ════════════════════════════════════════════════════════════════════════════ */
const LiveRoomPage = () => {
  const { roomId: roomIdParam } = useParams();
  const { currentUser }        = useAuth();
  const { playSong }           = usePlayer();
  const navigate               = useNavigate();

  const [phase, setPhase]               = useState('init');
  const [rooms, setRooms]               = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [room, setRoom]                 = useState(null);
  const [channelStatus, setChannelStatus] = useState('idle');
  const [joinError, setJoinError]       = useState(null);

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
  const [showPicker, setShowPicker]     = useState(false);
  const [songSearch, setSongSearch]     = useState('');
  const [songResults, setSongResults]   = useState([]);
  const [uploadingLocal, setUploadingLocal] = useState(false);

  const [bursts, setBursts]             = useState([]);
  const [copied, setCopied]             = useState(false);
  const [sideTab, setSideTab]           = useState('participants');
  const [showReactions, setShowReactions] = useState(false);
  const [roomName, setRoomName]         = useState('');
  const [isPrivate, setIsPrivate]       = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [mobileSideOpen, setMobileSideOpen] = useState(false);

  const chatRef        = useRef(null);
  const chanRef        = useRef(null);
  const burstId        = useRef(0);
  const hasJoined      = useRef(false);
  const syncTimer      = useRef(null);
  const heartbeatTimer = useRef(null);
  const typingTimer    = useRef(null);
  const isTyping       = useRef(false);
  const fileInputRef   = useRef(null);
  const isHostRef      = useRef(false);
  const roomRef        = useRef(null);
  const messagesRef    = useRef([]);
  const queueRef       = useRef([]);

  const isAdmin    = currentUser?.email === 'eloadxfamily@gmail.com' || currentUser?.user_metadata?.email === 'eloadxfamily@gmail.com';
  const canStop    = isHost || isAdmin;

  const scrollChat = useCallback(() => {
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 60);
  }, []);

  /* ── Fetch lobby rooms ─────────────────────────────────────────────── */
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { data } = await supabase.from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url), current_song:current_song_id(id,title,artist,cover_url)')
        .eq('is_active', true).eq('is_private', false)
        .order('created_at', { ascending: false }).limit(20);
      setRooms(data || []);
    } catch(e) { console.error(e); }
    finally { setLoadingRooms(false); }
  }, []);

  useEffect(() => { if (roomIdParam) setPhase('joining'); else setPhase('lobby'); }, [roomIdParam]);
  useEffect(() => { if (phase === 'lobby') fetchRooms(); }, [phase, fetchRooms]);

  /* ── Queue helpers ──────────────────────────────────────────────────── */
  const addToQueue = useCallback((song) => {
    if (!isHostRef.current || queueRef.current.find(s=>s.id===song.id)) return;
    const upd = [...queueRef.current, song];
    queueRef.current = upd; setQueue(upd);
    chanRef.current?.send({ type:'broadcast', event:'queue_update', payload:{ queue:upd } }).catch(()=>{});
  }, []);

  const removeFromQueue = useCallback((id) => {
    const upd = queueRef.current.filter(s=>s.id!==id);
    queueRef.current = upd; setQueue(upd);
    chanRef.current?.send({ type:'broadcast', event:'queue_update', payload:{ queue:upd } }).catch(()=>{});
  }, []);

  /* ── Sync / Heartbeat ──────────────────────────────────────────────── */
  const startSync = useCallback(() => {
    if (syncTimer.current) clearInterval(syncTimer.current);
    syncTimer.current = setInterval(() => {
      if (!chanRef.current || !isHostRef.current) return;
      const audio = document.querySelector('audio'); if (!audio) return;
      chanRef.current.send({ type:'broadcast', event:'sync_position',
        payload:{ currentTime:audio.currentTime, duration:audio.duration||0, isPlaying:!audio.paused, timestamp:Date.now() }
      }).catch(()=>{});
    }, SYNC_MS);
  }, []);

  const stopSync = useCallback(() => {
    [syncTimer, heartbeatTimer].forEach(r => { if (r.current) { clearInterval(r.current); r.current = null; }});
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (chanRef.current && currentUser) {
        chanRef.current.track({ user:{
          id:currentUser.id,
          username:currentUser.user_metadata?.username||currentUser.email?.split('@')[0]||'Anonyme',
          avatar_url:currentUser.user_metadata?.avatar_url||null, lastSeen:Date.now()
        }}).catch(()=>{});
      }
    }, HEARTBEAT_MS);
  }, [currentUser]);

  /* ── Typing ─────────────────────────────────────────────────────────── */
  const broadcastTyping = useCallback(() => {
    if (!chanRef.current || !currentUser) return;
    if (!isTyping.current) {
      isTyping.current = true;
      chanRef.current.send({ type:'broadcast', event:'typing',
        payload:{ userId:currentUser.id, username:currentUser.user_metadata?.username||'Anonyme', typing:true }
      }).catch(()=>{});
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      chanRef.current?.send({ type:'broadcast', event:'typing',
        payload:{ userId:currentUser.id, username:currentUser.user_metadata?.username||'Anonyme', typing:false }
      }).catch(()=>{});
    }, TYPING_TIMEOUT);
  }, [currentUser]);

  /* ── Inject system msg ──────────────────────────────────────────────── */
  const injectSys = useCallback((text, type='system') => {
    const sys = { id:`sys-${Date.now()}-${Math.random()}`, _system:true, _type:type, content:text, created_at:new Date().toISOString() };
    setMessages(prev => { const u=[...prev,sys]; messagesRef.current=u; return u; });
    scrollChat();
  }, [scrollChat]);

  /* ── Create room ────────────────────────────────────────────────────── */
  const createRoom = async () => {
    if (!currentUser || !roomName.trim()) return;
    setCreatingRoom(true);
    try {
      const { data, error } = await supabase.from('live_rooms')
        .insert({ name:roomName.trim(), host_id:currentUser.id, is_private:isPrivate, is_active:true })
        .select().single();
      if (error) throw error;
      await joinRoom(data.id, true);
    } catch(e) { console.error(e); setCreatingRoom(false); }
  };

  /* ── Join room ──────────────────────────────────────────────────────── */
  const joinRoom = useCallback(async (id, asHost=false) => {
    if (!currentUser) { navigate('/login'); return; }
    if (hasJoined.current) return;
    hasJoined.current = true;
    setPhase('joining'); setJoinError(null); setChannelStatus('connecting');

    try {
      const { data:rd, error:re } = await supabase.from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url), current_song:current_song_id(id,title,artist,cover_url,audio_url)')
        .eq('id', id).single();
      if (re||!rd) throw new Error('Salle introuvable ou expirée.');
      if (!rd.is_active) throw new Error('Cette salle est terminée.');

      setRoom(rd); roomRef.current = rd;
      const amHost = asHost || rd.host_id === currentUser.id;
      setIsHost(amHost); isHostRef.current = amHost;

      const { data:msgs } = await supabase.from('live_room_messages')
        .select('*, user:user_id(id,username,avatar_url)')
        .eq('room_id', id).eq('is_deleted', false)
        .order('created_at', { ascending: true }).limit(80);
      setMessages(msgs||[]); messagesRef.current = msgs||[];

      if (rd.current_song) { setNowPlaying(rd.current_song); playSong(rd.current_song,[rd.current_song]); }

      const chan = supabase.channel(`live_room:${id}`, {
        config:{ presence:{ key:currentUser.id }, broadcast:{ self:false } }
      });

      chan
        .on('presence',{ event:'sync' }, () => {
          const users = Object.values(chan.presenceState()).flat().map(p=>p.user).filter(Boolean);
          setParticipants(users);
          if (amHost) supabase.from('live_rooms').update({ participants_count:users.length }).eq('id',id).then(()=>{});
        })
        .on('presence',{ event:'join' }, ({ newPresences }) => {
          const u = newPresences?.[0]?.user;
          if (u && u.id !== currentUser.id) injectSys(`${u.username} a rejoint la salle 👋`, 'join');
        })
        .on('presence',{ event:'leave' }, ({ leftPresences }) => {
          const u = leftPresences?.[0]?.user;
          if (u && u.id !== currentUser.id) injectSys(`${u.username} a quitté la salle`, 'leave');
        })
        .on('postgres_changes',{ event:'INSERT', schema:'public', table:'live_room_messages', filter:`room_id=eq.${id}` },
          async ({ new:nm }) => {
            if (nm.is_deleted) return;
            const { data:u } = await supabase.from('users').select('id,username,avatar_url').eq('id',nm.user_id).single();
            const full = { ...nm, user:u||null };
            setMessages(prev => { if (prev.find(m=>m.id===full.id)) return prev; const upd=[...prev,full]; messagesRef.current=upd; return upd; });
            scrollChat();
          })
        .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'live_room_messages', filter:`room_id=eq.${id}` },
          ({ new:up }) => {
            if (up.is_deleted) {
              setMessages(prev=>{ const u=prev.filter(m=>m.id!==up.id); messagesRef.current=u; return u; });
            } else {
              setMessages(prev=>{ const u=prev.map(m=>m.id===up.id?{...m,content:up.content,is_edited:true}:m); messagesRef.current=u; return u; });
            }
          })
        .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'live_rooms', filter:`id=eq.${id}` },
          ({ new:up }) => { if (!up.is_active) handleRoomClosed(); else setRoom(prev=>({...prev,...up})); })
        .on('broadcast',{ event:'play_song' }, ({ payload }) => {
          if (payload?.song) { setNowPlaying(payload.song); playSong(payload.song,[payload.song]); setSyncProgress(0);
            injectSys(`🎵 ${payload.song.title} — ${payload.song.artist}`, 'song'); }
        })
        .on('broadcast',{ event:'sync_position' }, ({ payload }) => {
          if (!payload) return;
          if (payload.duration>0) setSyncProgress(payload.currentTime/payload.duration);
          if (isHostRef.current) return;
          const audio = document.querySelector('audio'); if (!audio) return;
          const lag = (Date.now()-payload.timestamp)/1000;
          const target = payload.currentTime+lag;
          if (Math.abs(audio.currentTime-target)>1.5) audio.currentTime=target;
          if (payload.isPlaying&&audio.paused) audio.play().catch(()=>{});
          if (!payload.isPlaying&&!audio.paused) audio.pause();
        })
        .on('broadcast',{ event:'queue_update' }, ({ payload }) => {
          if (payload?.queue) { queueRef.current=payload.queue; setQueue(payload.queue); }
        })
        .on('broadcast',{ event:'typing' }, ({ payload }) => {
          if (!payload||payload.userId===currentUser.id) return;
          setTypingUsers(prev => payload.typing
            ? prev.find(u=>u.userId===payload.userId)?prev:[...prev,{userId:payload.userId,username:payload.username}]
            : prev.filter(u=>u.userId!==payload.userId));
        })
        .on('broadcast',{ event:'burst' }, ({ payload }) => addBurst(payload.emoji,payload.x))
        .on('broadcast',{ event:'room_closed' }, () => handleRoomClosed())
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setChannelStatus('connected');
            const uPayload = { user:{ id:currentUser.id, username:currentUser.user_metadata?.username||currentUser.email?.split('@')[0]||'Anonyme', avatar_url:currentUser.user_metadata?.avatar_url||null, lastSeen:Date.now() }};
            try { await chan.track(uPayload); startHeartbeat(); } catch {}
            setPhase('room'); scrollChat(); if (amHost) startSync();
          } else if (status==='CHANNEL_ERROR'||status==='TIMED_OUT') {
            setChannelStatus('error'); setJoinError('Connexion perdue.'); hasJoined.current=false;
          }
        });

      chanRef.current = chan;
    } catch(err) {
      console.error('joinRoom:', err); setJoinError(err.message||'Impossible de rejoindre.'); setPhase('error'); hasJoined.current=false;
    }
  }, [currentUser, navigate, playSong, scrollChat, startSync, startHeartbeat, injectSys]); // eslint-disable-line

  useEffect(() => {
    if (roomIdParam && currentUser && phase==='joining' && !hasJoined.current) joinRoom(roomIdParam);
  }, [roomIdParam, currentUser, phase, joinRoom]);

  const handleRoomClosed = useCallback(() => {
    stopSync();
    if (chanRef.current) { chanRef.current.untrack?.(); supabase.removeChannel(chanRef.current); chanRef.current=null; }
    setRoom(null); setParticipants([]); setMessages([]); messagesRef.current=[]; queueRef.current=[]; setQueue([]);
    setPhase('lobby'); hasJoined.current=false; navigate('/live');
  }, [navigate, stopSync]);

  const leaveRoom = useCallback(async () => {
    stopSync();
    if (chanRef.current) {
      await chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) {
        await chanRef.current.send({ type:'broadcast', event:'room_closed', payload:{} });
        await supabase.from('live_rooms').update({ is_active:false, participants_count:0 }).eq('id',roomRef.current.id);
      }
      supabase.removeChannel(chanRef.current); chanRef.current=null;
    }
    setRoom(null); setParticipants([]); setMessages([]); messagesRef.current=[]; queueRef.current=[]; setQueue([]);
    setPhase('lobby'); hasJoined.current=false; navigate('/live');
  }, [navigate, stopSync]);

  useEffect(() => () => {
    stopSync();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (chanRef.current) {
      chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) supabase.from('live_rooms').update({ is_active:false }).eq('id',roomRef.current.id).then(()=>{});
      supabase.removeChannel(chanRef.current); chanRef.current=null;
    }
  }, []); // eslint-disable-line

  /* ── Send message ───────────────────────────────────────────────────── */
  const sendMessage = async () => {
    if (!msgInput.trim()||!chanRef.current||!currentUser||!roomRef.current) return;
    const content = msgInput.trim().slice(0,500);
    setMsgInput(''); isTyping.current=false;
    if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current=null; }
    chanRef.current.send({ type:'broadcast', event:'typing',
      payload:{ userId:currentUser.id, username:currentUser.user_metadata?.username||'Anonyme', typing:false }
    }).catch(()=>{});
    try {
      await supabase.from('live_room_messages').insert({ room_id:roomRef.current.id, user_id:currentUser.id, content });
      scrollChat();
    } catch(err) { console.error(err); }
  };

  const saveEdit = async () => {
    if (!editContent.trim()||!editingMsgId) return;
    await supabase.from('live_room_messages').update({ content:editContent.trim().slice(0,500), is_edited:true }).eq('id',editingMsgId).eq('user_id',currentUser.id);
    setEditingMsgId(null); setEditContent('');
  };

  const deleteMessage = async (msgId) => {
    await supabase.from('live_room_messages').update({ is_deleted:true }).eq('id',msgId).eq('user_id',currentUser.id);
  };

  /* ── Broadcast song ─────────────────────────────────────────────────── */
  const broadcastSong = useCallback(async (song) => {
    if (!isHostRef.current||!chanRef.current||!roomRef.current) return;
    setNowPlaying(song); playSong(song,[song]); setSyncProgress(0);
    setShowPicker(false); setSongSearch(''); setSongResults([]);
    if (!song._isLocal) await supabase.from('live_rooms').update({ current_song_id:song.id }).eq('id',roomRef.current.id);
    await chanRef.current.send({ type:'broadcast', event:'play_song', payload:{ song } });
  }, [playSong]);

  const skipToNext = useCallback(() => {
    if (!isHostRef.current||queueRef.current.length===0) return;
    const [next,...rest] = queueRef.current; queueRef.current=rest; setQueue(rest);
    chanRef.current?.send({ type:'broadcast', event:'queue_update', payload:{ queue:rest } }).catch(()=>{});
    broadcastSong(next);
  }, [broadcastSong]);

  /* ── Local file ─────────────────────────────────────────────────────── */
  const handleLocalFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file||!isHostRef.current||!roomRef.current) return;
    if (!file.type.startsWith('audio/')) { alert('Fichier audio uniquement'); return; }
    if (file.size > 50*1024*1024) { alert('Max 50 MB'); return; }
    setUploadingLocal(true);
    try {
      const ext=file.name.split('.').pop();
      const path=`live-temp/${roomRef.current.id}/${Date.now()}.${ext}`;
      const { error:upErr } = await supabase.storage.from('live-room-audio').upload(path,file,{ contentType:file.type, upsert:true });
      if (upErr) throw upErr;
      const { data:urlData } = supabase.storage.from('live-room-audio').getPublicUrl(path);
      await broadcastSong({ id:`local-${Date.now()}`, title:file.name.replace(/\.[^.]+$/,''), artist:currentUser.user_metadata?.username||'Hôte', audio_url:urlData.publicUrl, cover_url:null, plays_count:0, _isLocal:true });
    } catch(err) { alert('Erreur : '+(err.message||err)); }
    finally { setUploadingLocal(false); if (fileInputRef.current) fileInputRef.current.value=''; }
  };

  /* ── Bursts ─────────────────────────────────────────────────────────── */
  const addBurst = (emoji, x) => {
    const e=emoji||REACTION_EMOJIS[Math.floor(Math.random()*REACTION_EMOJIS.length)];
    const posX=x??`${Math.random()*80+10}%`;
    const id=++burstId.current;
    setBursts(prev=>[...prev,{ id,emoji:e,x:posX }]);
    setTimeout(()=>setBursts(prev=>prev.filter(b=>b.id!==id)),2000);
  };

  const sendBurst = async (emoji) => {
    if (!chanRef.current) return;
    const e=emoji||REACTION_EMOJIS[Math.floor(Math.random()*REACTION_EMOJIS.length)];
    const x=`${Math.random()*80+10}%`;
    addBurst(e,x); setShowReactions(false);
    await chanRef.current.send({ type:'broadcast', event:'burst', payload:{ emoji:e, x } });
  };

  /* ── Song search ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!songSearch.trim()) { setSongResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('songs').select('id,title,artist,cover_url,audio_url')
        .or(`title.ilike.%${songSearch}%,artist.ilike.%${songSearch}%`).eq('is_archived',false).limit(8);
      setSongResults(data||[]);
    }, 300);
    return ()=>clearTimeout(t);
  }, [songSearch]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#/live/${roomRef.current?.id}`)
      .then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2500); });
  };

  /* ── Computed ────────────────────────────────────────────────────────── */
  const otherTyping = typingUsers.filter(u=>u.userId!==currentUser?.id);
  const typingLabel = otherTyping.length===1?`${otherTyping[0].username} écrit…`
    : otherTyping.length>1?`${otherTyping.length} personnes écrivent…`:null;
  const pctCap = participants.length/MAX_PARTICIPANTS;

  /* ════════════════════════════════════════════════════════════════════ */
  /* PHASES                                                               */
  /* ════════════════════════════════════════════════════════════════════ */
  if (phase==='init'||phase==='joining') return <LoadingScreen label={roomIdParam?'Connexion à la salle…':'Chargement…'}/>;

  if (phase==='error') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center"><WifiOff className="w-8 h-8 text-red-400"/></div>
      <div className="text-center"><p className="text-white font-bold text-xl mb-2">Impossible de rejoindre</p><p className="text-gray-400 text-sm max-w-sm">{joinError}</p></div>
      <div className="flex gap-3">
        <button onClick={()=>{ setPhase('lobby'); hasJoined.current=false; navigate('/live'); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm"><ArrowLeft className="w-4 h-4"/>Retour</button>
        {roomIdParam&&<button onClick={()=>{ hasJoined.current=false; setPhase('joining'); joinRoom(roomIdParam); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm"><RefreshCw className="w-4 h-4"/>Réessayer</button>}
      </div>
    </div>
  );

  /* ── LOBBY ───────────────────────────────────────────────────────────── */
  if (phase==='lobby'||phase==='creating') return (
    <>
      <Helmet><title>Live Rooms — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header/>
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl pb-28">

          {/* Hero */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="text-center mb-12">
            <div className="inline-flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 text-red-400 px-5 py-2 rounded-full text-sm font-bold mb-5">
              <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"/></span>
              LIVE ROOMS
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
              Écoute <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">ensemble</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">Crée une salle, invite tes amis et partagez la même vibe musicale en temps réel.</p>
          </motion.div>

          {/* Create */}
          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.1}}
            className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-cyan-400"/>Créer une salle</h2>
            <div className="flex gap-3 flex-wrap">
              <input value={roomName} onChange={e=>setRoomName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createRoom()}
                placeholder="Nom de ta salle…" maxLength={60}
                className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500 transition-colors"/>
              <button onClick={()=>setIsPrivate(!isPrivate)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${isPrivate?'bg-amber-500/15 border-amber-500/40 text-amber-400':'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                {isPrivate?<Lock className="w-4 h-4"/>:<Unlock className="w-4 h-4"/>}{isPrivate?'Privée':'Publique'}
              </button>
              <button onClick={createRoom} disabled={!roomName.trim()||creatingRoom||!currentUser}
                className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                {creatingRoom?<><Loader2 className="w-4 h-4 animate-spin"/>Création…</>:<><Zap className="w-4 h-4"/>Créer</>}
              </button>
            </div>
            {!currentUser&&<p className="text-xs text-amber-400 mt-3 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5"/><Link to="/login" className="underline hover:text-amber-300">Connecte-toi</Link> pour créer une salle.</p>}
          </motion.div>

          {/* Rooms grid */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Radio className="w-4 h-4 text-red-400"/>Salles en direct<span className="text-xs text-gray-600 font-normal bg-gray-800 px-2 py-0.5 rounded-full">{rooms.length}</span></h2>
              <button onClick={fetchRooms} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors"><RefreshCw className="w-3.5 h-3.5"/>Actualiser</button>
            </div>
            {loadingRooms
              ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin"/></div>
              : rooms.length===0
                ? <div className="text-center py-20"><div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4"><Radio className="w-8 h-8 text-gray-700"/></div><p className="text-gray-500 font-medium mb-1">Aucune salle active</p><p className="text-gray-700 text-sm">Sois le premier à en créer une !</p></div>
                : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((r,i)=>(
                      <motion.div key={r.id} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}>
                        <RoomCard room={r} onJoin={joinRoom}/>
                      </motion.div>
                    ))}
                  </div>}
          </div>
        </main>
      </div>
    </>
  );

  /* ── ROOM ────────────────────────────────────────────────────────────── */
  return (
    <>
      <Helmet><title>{room?.name||'Live Room'} — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header/>
        <main className="flex-1 container mx-auto px-3 md:px-6 py-4 max-w-7xl">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={()=>setShowLeaveConfirm(true)} className="text-gray-500 hover:text-white transition-colors flex-shrink-0"><ArrowLeft className="w-4 h-4"/></button>
              <Avatar user={room?.host} size={8} crown/>
              <div className="min-w-0">
                <h1 className="text-white font-bold text-base truncate">{room?.name}</h1>
                <div className="flex items-center gap-2 flex-wrap"><p className="text-xs text-gray-500">par {room?.host?.username}</p><ConnBadge status={channelStatus}/></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                <Users className="w-3.5 h-3.5"/>
                <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pctCap>=1?'bg-red-500':'bg-gradient-to-r from-cyan-500 to-fuchsia-500'}`} style={{width:`${pctCap*100}%`}}/>
                </div>
                <span>{participants.length}/{MAX_PARTICIPANTS}</span>
              </div>
              <button onClick={copyLink} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-all">
                {copied?<><Check className="w-3.5 h-3.5 text-green-400"/>Copié</>:<><Share2 className="w-3.5 h-3.5"/>Partager</>}
              </button>
              <button onClick={()=>setMobileSideOpen(!mobileSideOpen)} className="lg:hidden flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">
                <Users className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="grid lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{height:'calc(100vh - 200px)',minHeight:500}}>

            {/* Chat */}
            <div className="lg:col-span-2 xl:col-span-3 flex flex-col min-h-0">
              {/* Now playing */}
              {nowPlaying&&(
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-3 flex items-center gap-3 flex-shrink-0">
                  {nowPlaying.cover_url
                    ?<img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
                    :<div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0"><Music className="w-5 h-5 text-gray-600"/></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5"><Eq active/><p className="text-white text-sm font-semibold truncate">{nowPlaying.title}</p></div>
                    <p className="text-gray-500 text-xs truncate">{nowPlaying.artist}</p>
                    <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-full" style={{width:`${syncProgress*100}%`}} transition={{duration:0.5}}/>
                    </div>
                  </div>
                  {isHost&&queue.length>0&&(
                    <button onClick={skipToNext} className="flex-shrink-0 text-gray-400 hover:text-white p-1.5 hover:bg-gray-800 rounded-lg transition-colors"><SkipForward className="w-4 h-4"/></button>
                  )}
                </div>
              )}

              {/* Messages area */}
              <div className="flex-1 relative overflow-hidden">
                <div ref={chatRef} className="absolute inset-0 overflow-y-auto px-1 py-2 space-y-2 scrollbar-hide">
                  <EmojiBurst bursts={bursts}/>
                  {messages.length===0?(
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4"><Headphones className="w-7 h-7 text-gray-700"/></div>
                      <p className="text-gray-500 text-sm font-medium">Aucun message</p>
                      <p className="text-gray-700 text-xs mt-1">Commence la conversation !</p>
                    </div>
                  ):(
                    <AnimatePresence initial={false}>
                      {messages.map(m=>m._system?(
                        <SysMsg key={m.id} text={m.content}
                          Icon={m._type==='song'?Music:m._type==='join'?Users:LogOut}/>
                      ):(
                        <ChatMsg key={m.id} m={m} isMine={m.user_id===currentUser?.id}
                          isEditing={editingMsgId===m.id} editContent={editContent}
                          onStartEdit={()=>{ setEditingMsgId(m.id); setEditContent(m.content); }}
                          onSaveEdit={saveEdit} onCancelEdit={()=>{ setEditingMsgId(null); setEditContent(''); }}
                          onDelete={()=>deleteMessage(m.id)} onChangeEdit={setEditContent}/>
                      ))}
                    </AnimatePresence>
                  )}
                  {typingLabel&&(
                    <div className="flex items-center gap-2 px-1"><TypingDots/><span className="text-xs text-gray-600 italic">{typingLabel}</span></div>
                  )}
                </div>
              </div>

              {/* Input */}
              <div className="mt-3 bg-gray-900 border border-gray-800 rounded-2xl p-3 flex-shrink-0">
                <AnimatePresence>
                  {showReactions&&(
                    <motion.div initial={{opacity:0,y:8,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:0.95}}
                      className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-800 rounded-xl">
                      {REACTION_EMOJIS.map(e=>(
                        <button key={e} onClick={()=>sendBurst(e)} className="text-xl hover:scale-125 transition-transform active:scale-90">{e}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex gap-2 items-center">
                  <input value={msgInput} onChange={e=>{ setMsgInput(e.target.value); broadcastTyping(); }}
                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
                    placeholder="Tape ton message…" maxLength={500}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500 transition-colors"/>
                  <button onClick={()=>setShowReactions(!showReactions)}
                    className={`p-2.5 rounded-xl transition-all ${showReactions?'bg-fuchsia-500/20 text-fuchsia-400':'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                    <Smile className="w-4 h-4"/>
                  </button>
                  <button onClick={sendMessage} disabled={!msgInput.trim()}
                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20">
                    <Send className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className={`lg:flex flex-col gap-3 ${mobileSideOpen?'fixed inset-0 z-40 bg-gray-950/95 backdrop-blur-xl p-4 overflow-y-auto flex flex-col':'hidden'} lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:overflow-y-auto lg:h-full`}>
              {mobileSideOpen&&(
                <div className="flex items-center justify-between mb-2 lg:hidden">
                  <span className="text-white font-bold">Panneau</span>
                  <button onClick={()=>setMobileSideOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
              )}

              {/* Sidebar tabs */}
              <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800 flex-shrink-0">
                {[['participants','👥'],['queue','🎵'],['controls','⚙️']].map(([id,emoji])=>(
                  <button key={id} onClick={()=>setSideTab(id)}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all ${sideTab===id?'bg-gray-800 text-white':'text-gray-500 hover:text-gray-300'}`}>
                    <span>{emoji}</span>
                  </button>
                ))}
              </div>

              {/* Participants */}
              {sideTab==='participants'&&(
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-cyan-400"/>Participants</h3>
                    <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{participants.length}/{MAX_PARTICIPANTS}</span>
                  </div>
                  <div className="space-y-1 overflow-y-auto flex-1 scrollbar-hide">
                    {participants.length===0
                      ?<p className="text-gray-600 text-xs text-center py-6">En attente…</p>
                      :participants.map(p=>(
                        <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-800 transition-colors">
                          <Avatar user={p} size={7} pulse/>
                          <div className="flex-1 min-w-0"><p className="text-white text-xs font-semibold truncate">{p.username}</p>{p.id===room?.host_id&&<p className="text-amber-400 text-[10px]">Hôte</p>}</div>
                          {p.id===room?.host_id&&<Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0"/>}
                        </div>
                      ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pctCap>=1?'bg-red-500':'bg-gradient-to-r from-cyan-500 to-fuchsia-500'}`} style={{width:`${pctCap*100}%`}}/>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">{MAX_PARTICIPANTS-participants.length} place{MAX_PARTICIPANTS-participants.length!==1?'s':''} libre{MAX_PARTICIPANTS-participants.length!==1?'s':''}</p>
                  </div>
                </div>
              )}

              {/* Queue */}
              {sideTab==='queue'&&(
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2"><ListMusic className="w-4 h-4 text-cyan-400"/>File d'attente</h3>
                    {queue.length>0&&<span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{queue.length}</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {queue.length===0
                      ?<div className="flex flex-col items-center justify-center py-8 text-center"><ListMusic className="w-8 h-8 text-gray-800 mb-2"/><p className="text-gray-600 text-xs">File vide</p>{isHost&&<p className="text-gray-700 text-[11px] mt-1">Ajoute des sons depuis les contrôles</p>}</div>
                      :<AnimatePresence>{queue.map((s,i)=><QueueItem key={s.id} song={s} index={i} isHost={isHost} onPlay={broadcastSong} onRemove={removeFromQueue}/>)}</AnimatePresence>}
                  </div>
                </div>
              )}

              {/* Controls */}
              {sideTab==='controls'&&(
                <div className="space-y-3">
                  {isHost&&(
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400"/>Contrôles Hôte</h3>
                      <div className="space-y-2">
                        <button onClick={()=>setShowPicker(!showPicker)} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2"><Search className="w-4 h-4 text-cyan-400"/>Chercher une musique</button>
                        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleLocalFile} className="hidden"/>
                        <button onClick={()=>fileInputRef.current?.click()} disabled={uploadingLocal} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2 disabled:opacity-50"><Upload className="w-4 h-4 text-fuchsia-400"/>{uploadingLocal?'Upload…':'Fichier local'}</button>
                        {queue.length>0&&<button onClick={skipToNext} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2"><SkipForward className="w-4 h-4 text-cyan-400"/>Passer au suivant</button>}
                        {canStop&&<button onClick={()=>setConfirmModal('stop')} className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl px-4 py-2.5 text-sm transition-all flex items-center gap-2"><X className="w-4 h-4"/>Terminer le live</button>}
                      </div>
                    </div>
                  )}

                  {/* Song picker */}
                  <AnimatePresence>
                    {showPicker&&(
                      <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                        className="bg-gray-900 border border-gray-800 rounded-2xl p-4 overflow-hidden">
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-cyan-400"/>Recherche</h3>
                        <input value={songSearch} onChange={e=>setSongSearch(e.target.value)} placeholder="Titre ou artiste…" autoFocus
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500 transition-colors"/>
                        <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-hide">
                          {songResults.map(s=>(
                            <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-800 group transition-colors">
                              {s.cover_url?<img src={s.cover_url} alt={s.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0"/>
                                :<div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-gray-500"/></div>}
                              <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>broadcastSong(s)}>
                                <p className="text-white text-xs font-medium truncate">{s.title}</p><p className="text-gray-500 text-xs truncate">{s.artist}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={()=>broadcastSong(s)} className="p-1.5 text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 rounded-lg" title="Jouer"><Play className="w-3 h-3"/></button>
                                <button onClick={()=>addToQueue(s)} className="p-1.5 text-fuchsia-400 hover:text-fuchsia-300 bg-fuchsia-500/10 rounded-lg" title="File d'attente"><Plus className="w-3 h-3"/></button>
                              </div>
                            </div>
                          ))}
                          {songSearch.trim()&&songResults.length===0&&<p className="text-gray-600 text-xs text-center py-4">Aucun résultat</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Room info */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400"/>Infos</h3>
                    <div className="space-y-2 text-xs mb-3">
                      <div className="flex justify-between items-center"><span className="text-gray-500">Statut</span><ConnBadge status={channelStatus}/></div>
                      <div className="flex justify-between"><span className="text-gray-500">Salle</span><span className="text-white font-medium truncate ml-2 max-w-[120px]">{room?.name}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Visibilité</span><span className={room?.is_private?'text-amber-400':'text-green-400'}>{room?.is_private?'🔒 Privée':'🌐 Publique'}</span></div>
                    </div>
                    <button onClick={copyLink} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-xs transition-all flex items-center justify-center gap-2">
                      {copied?<><Check className="w-3.5 h-3.5 text-green-400"/>Lien copié !</>:<><Copy className="w-3.5 h-3.5"/>Copier le lien</>}
                    </button>
                  </div>

                  {!isHost&&(
                    <button onClick={()=>setShowLeaveConfirm(true)} className="w-full bg-gray-900 border border-gray-800 hover:border-red-500/40 hover:bg-red-500/5 text-gray-400 hover:text-red-400 rounded-2xl px-4 py-3 text-sm transition-all flex items-center justify-center gap-2">
                      <LogOut className="w-4 h-4"/>Quitter la salle
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(confirmModal||showLeaveConfirm)&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={e=>{ if (e.target===e.currentTarget){ setConfirmModal(null); setShowLeaveConfirm(false); }}}>
            <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9,y:20}}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${confirmModal==='stop'?'bg-red-500/15':'bg-amber-500/15'}`}>
                {confirmModal==='stop'?<X className="w-6 h-6 text-red-400"/>:<LogOut className="w-6 h-6 text-amber-400"/>}
              </div>
              <h3 className="text-white font-bold text-lg text-center mb-2">{confirmModal==='stop'?'Terminer le live ?':'Quitter la salle ?'}</h3>
              <p className="text-gray-400 text-sm text-center mb-6">{confirmModal==='stop'?'Cette action mettra fin à la session pour tous les participants.':'Tu pourras revenir en utilisant le lien d\'invitation.'}</p>
              <div className="flex gap-3">
                <button onClick={()=>{ setConfirmModal(null); setShowLeaveConfirm(false); }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium">Annuler</button>
                <button onClick={()=>{ leaveRoom(); setConfirmModal(null); setShowLeaveConfirm(false); }}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white ${confirmModal==='stop'?'bg-red-600 hover:bg-red-700':'bg-amber-600 hover:bg-amber-700'}`}>
                  {confirmModal==='stop'?'Terminer':'Quitter'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {mobileSideOpen&&<div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={()=>setMobileSideOpen(false)}/>}
    </>
  );
};

export default LiveRoomPage;
