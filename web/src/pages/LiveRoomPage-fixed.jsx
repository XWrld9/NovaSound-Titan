/**
 * LiveRoomPage — NovaSound V28000 (FIXED)
 *
 * ✅ Sync audio précise (host envoie position toutes les 2s, participants seekent)
 * ✅ Host peut jouer un fichier LOCAL (upload temp Supabase Storage → broadcast URL)
 * ✅ Messages synchronisés UNIQUEMENT via Postgres Changes (évite doublons)
 * ✅ Présence correcte avec heartbeat toutes les 30s
 * ✅ Reconnexion automatique si canal déconnecté
 * ✅ Messages éditables / supprimables par leur auteur
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
  Headphones, Zap, X, ArrowLeft, Loader2, WifiOff, RefreshCw,
  Volume2, Search, Upload, Pencil, Trash2, CheckCircle2, XCircle, Play,
} from 'lucide-react';

const MAX_PARTICIPANTS = 12;
const BURST_EMOJIS = ['🔥','💜','🎵','✨','🎶','❤️','💫','🎉','😍','🚀'];
const SYNC_MS = 2000;
const HEARTBEAT_MS = 30000;

const Avatar = ({ user, size = 9, crown = false }) => {
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();
  const colors = ['from-cyan-500 to-blue-600','from-fuchsia-500 to-purple-600','from-amber-400 to-orange-500','from-emerald-400 to-teal-600','from-rose-400 to-pink-600','from-indigo-400 to-violet-600'];
  const color = colors[(user?.id?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`relative w-${size} h-${size} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-white/10`}>
      {user?.avatar_url ? <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover" /> : initials}
      {crown && <div className="absolute -top-1.5 -right-1.5 text-sm select-none">👑</div>}
    </div>
  );
};

const EmojiBurst = ({ bursts }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <AnimatePresence>
      {bursts.map(b => (
        <motion.div key={b.id} initial={{ opacity: 1, y: 0, scale: 0.6 }} animate={{ opacity: 0, y: -110, scale: 1.6 }}
          exit={{ opacity: 0 }} transition={{ duration: 1.6, ease: 'easeOut' }}
          className="absolute text-2xl select-none" style={{ left: b.x, bottom: 16 }}>
          {b.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const LoadingScreen = ({ label = 'Connexion…' }) => (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/30 to-fuchsia-500/30 border border-red-500/30 flex items-center justify-center">
      <Radio className="w-8 h-8 text-red-400 animate-pulse" />
    </div>
    <p className="text-gray-400 text-sm">{label}</p>
    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
  </div>
);

const LiveRoomPage = () => {
  const { roomId: roomIdParam } = useParams();
  const { currentUser } = useAuth();
  const { playSong } = usePlayer();
  const navigate = useNavigate();

  const [phase, setPhase]               = useState('init');
  const [rooms, setRooms]               = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [room, setRoom]                 = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages]         = useState([]);
  const [msgInput, setMsgInput]         = useState('');
  const [nowPlaying, setNowPlaying]     = useState(null);
  const [isHost, setIsHost]             = useState(false);
  const [bursts, setBursts]             = useState([]);
  const [copied, setCopied]             = useState(false);
  const [songSearch, setSongSearch]     = useState('');
  const [songResults, setSongResults]   = useState([]);
  const [showPicker, setShowPicker]     = useState(false);
  const [roomName, setRoomName]         = useState('');
  const [isPrivate, setIsPrivate]       = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [channelStatus, setChannelStatus] = useState('idle');
  const [joinError, setJoinError]       = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editContent, setEditContent]   = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());

  const chatRef      = useRef(null);
  const chanRef      = useRef(null);
  const burstId      = useRef(0);
  const hasJoined    = useRef(false);
  const syncTimer    = useRef(null);
  const heartbeatTimer = useRef(null);
  const fileInputRef = useRef(null);
  const isHostRef    = useRef(false);
  const roomRef      = useRef(null);
  const messagesRef   = useRef([]);

  const ADMIN_EMAIL = 'eloadxfamily@gmail.com';
  const isAdmin = currentUser?.email === ADMIN_EMAIL || currentUser?.user_metadata?.email === ADMIN_EMAIL;
  const canStopLive = isHost || isAdmin;

  const scrollChat = useCallback(() => {
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 60);
  }, []);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { data } = await supabase.from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url)')
        .eq('is_active', true).eq('is_private', false)
        .order('created_at', { ascending: false }).limit(20);
      setRooms(data || []);
    } catch (e) { console.error('fetchRooms:', e); }
    finally { setLoadingRooms(false); }
  }, []);

  useEffect(() => {
    if (roomIdParam) setPhase('joining');
    else setPhase('lobby');
  }, [roomIdParam]);

  useEffect(() => { if (phase === 'lobby') fetchRooms(); }, [phase, fetchRooms]);

  // ── Host: sync broadcast every 2s ──────────────────────────────
  const startSync = useCallback(() => {
    if (syncTimer.current) clearInterval(syncTimer.current);
    syncTimer.current = setInterval(() => {
      if (!chanRef.current || !isHostRef.current) return;
      const audio = document.querySelector('audio');
      if (!audio) return;
      chanRef.current.send({
        type: 'broadcast', event: 'sync_position',
        payload: { currentTime: audio.currentTime, isPlaying: !audio.paused, timestamp: Date.now() },
      }).catch(() => {});
    }, SYNC_MS);
  }, []);

  const stopSync = useCallback(() => {
    if (syncTimer.current) { clearInterval(syncTimer.current); syncTimer.current = null; }
    if (heartbeatTimer.current) { clearInterval(heartbeatTimer.current); heartbeatTimer.current = null; }
  }, []);

  // ── Heartbeat for presence ───────────────────────────────────
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (chanRef.current && currentUser) {
        chanRef.current.track({
          user: {
            id: currentUser.id,
            username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Anonyme',
            avatar_url: currentUser.user_metadata?.avatar_url || null,
            lastSeen: Date.now()
          }
        }).catch(() => {});
      }
    }, HEARTBEAT_MS);
  }, [currentUser]);

  // ── Create room ─────────────────────────────────────────────────
  const createRoom = async () => {
    if (!currentUser || !roomName.trim()) return;
    setCreatingRoom(true);
    try {
      const { data, error } = await supabase.from('live_rooms')
        .insert({ name: roomName.trim(), host_id: currentUser.id, is_private: isPrivate, is_active: true })
        .select().single();
      if (error) throw error;
      await joinRoom(data.id, true);
    } catch (e) { console.error('createRoom:', e); setCreatingRoom(false); }
  };

  // ── Join room ────────────────────────────────────────────────────
  const joinRoom = useCallback(async (id, asHost = false) => {
    if (!currentUser) { navigate('/login'); return; }
    if (hasJoined.current) return;
    hasJoined.current = true;
    setPhase('joining'); setJoinError(null); setChannelStatus('connecting');

    try {
      const { data: roomData, error: roomErr } = await supabase.from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url)').eq('id', id).single();
      if (roomErr || !roomData) throw new Error('Salle introuvable ou expirée.');
      if (!roomData.is_active) throw new Error('Cette salle est terminée.');

      setRoom(roomData); roomRef.current = roomData;
      const amHost = asHost || roomData.host_id === currentUser.id;
      setIsHost(amHost); isHostRef.current = amHost;

      // Load messages
      const { data: msgs } = await supabase.from('live_room_messages')
        .select('*, user:user_id(id,username,avatar_url)')
        .eq('room_id', id).eq('is_deleted', false)
        .order('created_at', { ascending: true }).limit(80);
      setMessages(msgs || []);
      messagesRef.current = msgs || [];

      // Load current song
      if (roomData.current_song_id) {
        const { data: song } = await supabase.from('songs').select('*').eq('id', roomData.current_song_id).single();
        if (song) { setNowPlaying(song); playSong(song, [song]); }
      }

      const chan = supabase.channel(`live_room:${id}`, {
        config: { presence: { key: currentUser.id }, broadcast: { self: false } }
      });

      chan
        // Présence
        .on('presence', { event: 'sync' }, () => {
          const users = Object.values(chan.presenceState()).flat().map(p => p.user).filter(Boolean);
          setParticipants(users);
          if (amHost) supabase.from('live_rooms').update({ participants_count: users.length }).eq('id', id).then(() => {});
        })

        // UN SEUL SYSTÈME DE MESSAGES : Postgres Changes
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          async ({ new: newMsg }) => {
            if (newMsg.is_deleted) return;
            const { data: u } = await supabase.from('users').select('id,username,avatar_url').eq('id', newMsg.user_id).single();
            const full = { ...newMsg, user: u || null };
            setMessages(prev => {
              const exists = prev.find(m => m.id === full.id);
              if (exists) return prev;
              const updated = [...prev, full];
              messagesRef.current = updated;
              return updated;
            });
            scrollChat();
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          ({ new: up }) => {
            if (up.is_deleted) {
              setMessages(prev => {
                const updated = prev.filter(m => m.id !== up.id);
                messagesRef.current = updated;
                return updated;
              });
            } else {
              setMessages(prev => {
                const updated = prev.map(m => m.id === up.id ? { ...m, content: up.content, is_edited: true } : m);
                messagesRef.current = updated;
                return updated;
              });
            }
          })

        // Broadcast: chanson
        .on('broadcast', { event: 'play_song' }, ({ payload }) => {
          if (payload?.song) { setNowPlaying(payload.song); playSong(payload.song, [payload.song]); }
        })

        // Broadcast: sync position (participants seulement)
        .on('broadcast', { event: 'sync_position' }, ({ payload }) => {
          if (isHostRef.current || !payload) return;
          const audio = document.querySelector('audio');
          if (!audio) return;
          const lag = (Date.now() - payload.timestamp) / 1000;
          const target = payload.currentTime + lag;
          if (Math.abs(audio.currentTime - target) > 1.5) audio.currentTime = target;
          if (payload.isPlaying && audio.paused) audio.play().catch(() => {});
          if (!payload.isPlaying && !audio.paused) audio.pause();
        })

        // Broadcast: réactions
        .on('broadcast', { event: 'burst' }, ({ payload }) => addBurst(payload.emoji, payload.x))

        // Broadcast: room fermée
        .on('broadcast', { event: 'room_closed' }, () => handleRoomClosed())

        // DB: room update
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_rooms', filter: `id=eq.${id}` },
          ({ new: up }) => { if (!up.is_active) handleRoomClosed(); else setRoom(prev => ({ ...prev, ...up })); })

        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setChannelStatus('connected');
            try {
              await chan.track({
                user: {
                  id: currentUser.id,
                  username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Anonyme',
                  avatar_url: currentUser.user_metadata?.avatar_url || null,
                  lastSeen: Date.now()
                }
              });
              startHeartbeat();
            } catch (e) { console.warn('track error:', e); }
            setPhase('room');
            scrollChat();
            if (amHost) startSync();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setChannelStatus('error');
            setJoinError('Connexion perdue. Réessaie.');
            hasJoined.current = false;
          }
        });

      chanRef.current = chan;
    } catch (err) {
      console.error('joinRoom:', err);
      setJoinError(err.message || 'Impossible de rejoindre.');
      setPhase('error');
      hasJoined.current = false;
    }
  }, [currentUser, navigate, playSong, scrollChat, startSync, startHeartbeat]);

  useEffect(() => {
    if (roomIdParam && currentUser && phase === 'joining' && !hasJoined.current) joinRoom(roomIdParam);
  }, [roomIdParam, currentUser, phase, joinRoom]);

  const handleRoomClosed = useCallback(() => {
    stopSync();
    if (chanRef.current) { chanRef.current.untrack?.(); supabase.removeChannel(chanRef.current); chanRef.current = null; }
    setRoom(null); setParticipants([]); setMessages([]);
    messagesRef.current = [];
    setPhase('lobby'); hasJoined.current = false; navigate('/live');
  }, [navigate, stopSync]);

  const leaveRoom = useCallback(async () => {
    stopSync();
    if (chanRef.current) {
      await chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) {
        await chanRef.current.send({ type: 'broadcast', event: 'room_closed', payload: {} });
        await supabase.from('live_rooms').update({ is_active: false, participants_count: 0 }).eq('id', roomRef.current.id);
      }
      supabase.removeChannel(chanRef.current); chanRef.current = null;
    }
    setRoom(null); setParticipants([]); setMessages([]);
    messagesRef.current = [];
    setPhase('lobby'); hasJoined.current = false; navigate('/live');
  }, [navigate, stopSync]);

  useEffect(() => {
    return () => {
      stopSync();
      if (chanRef.current) {
        chanRef.current.untrack?.();
        if (isHostRef.current && roomRef.current) supabase.from('live_rooms').update({ is_active: false }).eq('id', roomRef.current.id).then(() => {});
        supabase.removeChannel(chanRef.current); chanRef.current = null;
      }
    };
  }, []);

  // ── Send message (DB ONLY → Postgres Changes broadcast) ───────────────────────
  const sendMessage = async () => {
    if (!msgInput.trim() || !chanRef.current || !currentUser || !roomRef.current) return;
    const content = msgInput.trim().slice(0, 500);
    setMsgInput('');
    try {
      const { data: ins, error } = await supabase.from('live_room_messages')
        .insert({ room_id: roomRef.current.id, user_id: currentUser.id, content })
        .select('id, created_at').single();
      if (error) throw error;
      // Le message sera ajouté automatiquement par Postgres Changes
      scrollChat();
    } catch (err) { console.error('sendMessage:', err); }
  };

  // ── Edit / Delete message ──────────────────────────────────────
  const saveEdit = async () => {
    if (!editContent.trim() || !editingMsgId) return;
    const content = editContent.trim().slice(0, 500);
    await supabase.from('live_room_messages').update({ content, is_edited: true }).eq('id', editingMsgId).eq('user_id', currentUser.id);
    setEditingMsgId(null); setEditContent('');
  };

  const deleteMessage = async (msgId) => {
    await supabase.from('live_room_messages').update({ is_deleted: true }).eq('id', msgId).eq('user_id', currentUser.id);
  };

  // ── Broadcast song (host) ──────────────────────────────────────
  const broadcastSong = async (song) => {
    if (!isHost || !chanRef.current || !roomRef.current) return;
    setNowPlaying(song); playSong(song, [song]);
    setShowPicker(false); setSongSearch(''); setSongResults([]);
    if (!song._isLocal) await supabase.from('live_rooms').update({ current_song_id: song.id }).eq('id', roomRef.current.id);
    await chanRef.current.send({ type: 'broadcast', event: 'play_song', payload: { song } });
  };

  // ── Local file upload ──────────────────────────────────────────
  const handleLocalFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isHost || !roomRef.current) return;
    if (!file.type.startsWith('audio/')) { alert('Fichier audio uniquement (mp3, wav, m4a…)'); return; }
    if (file.size > 50 * 1024 * 1024) { alert('Fichier trop lourd (max 50 MB)'); return; }
    setUploadingLocal(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `live-temp/${roomRef.current.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('live-room-audio').upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('live-room-audio').getPublicUrl(path);
      const fakeSong = {
        id: `local-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: currentUser.user_metadata?.username || 'Hôte',
        audio_url: urlData.publicUrl,
        cover_url: null, plays_count: 0, _isLocal: true,
      };
      await broadcastSong(fakeSong);
    } catch (err) { console.error('local upload:', err); alert('Erreur : ' + (err.message || err)); }
    finally { setUploadingLocal(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  // ── Burst ──────────────────────────────────────────────────────
  const addBurst = (emoji, x) => {
    const e = emoji || BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)];
    const posX = x ?? `${Math.random() * 80 + 10}%`;
    const id = ++burstId.current;
    setBursts(prev => [...prev, { id, emoji: e, x: posX }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 1800);
  };

  const sendBurst = async () => {
    if (!chanRef.current) return;
    const emoji = BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)];
    const x = `${Math.random() * 80 + 10}%`;
    addBurst(emoji, x);
    await chanRef.current.send({ type: 'broadcast', event: 'burst', payload: { emoji, x } });
  };

  // ── Song search ────────────────────────────────────────────────
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
    navigator.clipboard.writeText(`${window.location.origin}/#/live/${roomRef.current?.id}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  // ══════════════════════════════════════════════════════════════
  if (phase === 'init' || phase === 'joining') return <LoadingScreen label={roomIdParam ? 'Connexion à la salle...' : 'Chargement...'} />;

  if (phase === 'error') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <WifiOff className="w-12 h-12 text-red-400" />
      <div className="text-center">
        <p className="text-white font-bold text-lg mb-2">Impossible de rejoindre</p>
        <p className="text-gray-400 text-sm max-w-sm">{joinError || 'Une erreur est survenue.'}</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => { setPhase('lobby'); hasJoined.current = false; navigate('/live'); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" />Retour
        </button>
        {roomIdParam && (
          <button onClick={() => { hasJoined.current = false; setPhase('joining'); joinRoom(roomIdParam); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm">
            <RefreshCw className="w-4 h-4" />Réessayer
          </button>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // LOBBY
  if (phase === 'lobby' || phase === 'creating') return (
    <>
      <Helmet><title>Live Rooms — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />LIVE ROOMS
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
              Écoute <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">ensemble</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">Crée une salle, invite tes amis et partagez la même vibe musicale en temps réel.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-gray-900 border border-cyan-500/25 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-cyan-400" />Créer une salle</h2>
            <div className="flex gap-3 flex-wrap">
              <input value={roomName} onChange={e => setRoomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createRoom()}
                placeholder="Nom de ta salle…" maxLength={60}
                className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500" />
              <button onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${isPrivate ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}{isPrivate ? 'Privée' : 'Publique'}
              </button>
              <button onClick={createRoom} disabled={!roomName.trim() || creatingRoom || !currentUser}
                className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg flex items-center gap-2">
                {creatingRoom ? <><Loader2 className="w-4 h-4 animate-spin" />Création…</> : 'Créer →'}
              </button>
            </div>
            {!currentUser && <p className="text-xs text-amber-400 mt-3">⚠️ <Link to="/login" className="underline">Connecte-toi</Link> pour créer une salle.</p>}
          </motion.div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400" />Salles en direct <span className="text-xs text-gray-500 font-normal">({rooms.length})</span>
              </h2>
              <button onClick={fetchRooms} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Rafraîchir</button>
            </div>
            {loadingRooms ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
              : rooms.length === 0 ? (
                <div className="text-center py-16 text-gray-600"><Radio className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-medium">Aucune salle active</p></div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rooms.map(r => (
                    <motion.div key={r.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => joinRoom(r.id)}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-cyan-500/50 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <Avatar user={r.host} size={8} crown={true} />
                        <span className="text-xs text-gray-500">{r.participants_count || 0}/{MAX_PARTICIPANTS}</span>
                      </div>
                      <h3 className="text-white font-semibold mb-1">{r.name}</h3>
                      <p className="text-xs text-gray-500">par {r.host.username}</p>
                    </motion.div>
                  ))}
                </div>
              )}
          </div>
        </main>
      </div>
    </>
  );

  // ══════════════════════════════════════════════════════════════
  // ROOM
  return (
    <>
      <Helmet><title>{room?.name || 'Live Room'} — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-6 h-full">
            {/* ── Chat ───────────────────────────────────────────────────── */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="bg-gray-900 border border-gray-800 rounded-t-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar user={room?.host} size={8} crown={true} />
                  <div>
                    <h2 className="text-white font-bold">{room?.name}</h2>
                    <p className="text-xs text-gray-500">{participants.length} participant{participants.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    channelStatus === 'connected' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    channelStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {channelStatus === 'connected' ? '🟢 Connecté' :
                     channelStatus === 'connecting' ? '🟡 Connexion…' : '🔴 Déconnecté'}
                  </span>
                  <button onClick={leaveRoom} className="text-gray-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div ref={chatRef} className="flex-1 bg-gray-950 border-x border-gray-800 p-4 overflow-y-auto">
                <EmojiBurst bursts={bursts} />
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-600">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun message pour le moment</p>
                    <p className="text-xs text-gray-500 mt-1">Sois le premier à saluer !</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map(m => (
                      <div key={m.id} className={`flex gap-3 ${m.user_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                        {m.user_id !== currentUser.id && <Avatar user={m.user} size={7} />}
                        <div className={`max-w-md ${m.user_id === currentUser.id ? 'text-right' : 'text-left'}`}>
                          <div className={`inline-block px-4 py-2 rounded-2xl text-sm ${
                            m.user_id === currentUser.id 
                              ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white' 
                              : 'bg-gray-800 text-gray-200'
                          }`}>
                            {editingMsgId === m.id ? (
                              <div className="flex items-center gap-2">
                                <input value={editContent} onChange={e => setEditContent(e.target.value)} 
                                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                  className="bg-black/20 border border-white/20 rounded px-2 py-1 text-white text-sm w-48 focus:outline-none focus:border-white/40" />
                                <button onClick={saveEdit} className="text-green-400 hover:text-green-300">
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => { setEditingMsgId(null); setEditContent(''); }} className="text-red-400 hover:text-red-300">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <p className="break-words">{m.content}</p>
                            )}
                            {m.is_edited && <p className="text-xs opacity-70 mt-1">modifié</p>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{m.user?.username || 'Anonyme'}</span>
                            {m.user_id === currentUser.id && (
                              <div className="flex gap-1">
                                <button onClick={() => { setEditingMsgId(m.id); setEditContent(m.content); }} className="text-gray-400 hover:text-white">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => deleteMessage(m.id)} className="text-gray-400 hover:text-red-400">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {m.user_id === currentUser.id && <Avatar user={m.user} size={7} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-b-2xl p-3">
                <div className="flex gap-2">
                  <input value={msgInput} onChange={e => setMsgInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Tape ton message…" maxLength={500}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500" />
                  <button onClick={sendMessage} disabled={!msgInput.trim()} 
                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-50 text-white p-2 rounded-xl transition-all">
                    <Send className="w-4 h-4" />
                  </button>
                  <button onClick={sendBurst} className="bg-gray-800 hover:bg-gray-700 text-gray-400 p-2 rounded-xl transition-all">
                    <Heart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Sidebar ───────────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Participants */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-cyan-400" />Participants</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {participants.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">En attente de participants...</p>
                  ) : (
                    participants.map(p => (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <Avatar user={p} size={6} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{p.username}</p>
                          <p className="text-xs text-gray-500">Actif</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Now Playing */}
              {nowPlaying && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Music className="w-4 h-4 text-cyan-400" />En lecture</h3>
                  <div className="space-y-3">
                    {nowPlaying.cover_url && (
                      <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-full rounded-lg" />
                    )}
                    <div>
                      <p className="text-white font-medium truncate">{nowPlaying.title}</p>
                      <p className="text-gray-400 text-sm truncate">{nowPlaying.artist}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Host controls */}
              {isHost && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Headphones className="w-4 h-4 text-cyan-400" />Contrôles</h3>
                  <div className="space-y-3">
                    <button onClick={() => setShowPicker(!showPicker)} 
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-sm transition-all flex items-center gap-2">
                      <Plus className="w-4 h-4" />Changer de musique
                    </button>
                    <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleLocalFile} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLocal}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-sm transition-all flex items-center gap-2 disabled:opacity-50">
                      <Upload className="w-4 h-4" />{uploadingLocal ? 'Upload...' : 'Fichier local'}
                    </button>
                    {canStopLive && (
                      <button onClick={() => setConfirmModal('stop')} 
                        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2 text-sm transition-all flex items-center gap-2">
                        <X className="w-4 h-4" />Terminer le live
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Song Picker */}
              {showPicker && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-cyan-400" />Musique</h3>
                  <input value={songSearch} onChange={e => setSongSearch(e.target.value)} 
                    placeholder="Rechercher une musique…" 
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500" />
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {songResults.map(song => (
                      <button key={song.id} onClick={() => broadcastSong(song)}
                        className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl p-3 text-left transition-all">
                        <p className="text-sm font-medium truncate">{song.title}</p>
                        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Room info */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400" />Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Statut</span>
                    <span className="text-cyan-400">{channelStatus === 'connected' ? 'Connecté' : 'Déconnecté'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Salle</span>
                    <span className="text-white">{room?.name}</span>
                  </div>
                  <button onClick={copyLink} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-sm transition-all flex items-center gap-2">
                    <Copy className="w-4 h-4" />{copied ? <Check className="w-4 h-4 text-green-400" : 'Copier le lien'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-white font-bold mb-4">
                {confirmModal === 'stop' ? 'Terminer le live ?' : 'Quitter la salle ?'}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                {confirmModal === 'stop' 
                  ? 'Cela mettra fin à la session pour tous les participants.'
                  : 'Tu pourras revenir à tout moment.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} 
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-sm transition-all">
                  Annuler
                </button>
                <button onClick={() => {
                  if (confirmModal === 'stop') {
                    leaveRoom();
                  } else {
                    // Handle leave room logic
                  }
                  setConfirmModal(null);
                }} 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2 text-sm transition-all">
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
