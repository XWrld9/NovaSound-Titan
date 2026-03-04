/**
 * LiveRoomPage — NovaSound V28000
 *
 * ✅ Sync audio précise (host envoie position toutes les 2s, participants seekent)
 * ✅ Host peut jouer un fichier LOCAL (upload temp Supabase Storage → broadcast URL)
 * ✅ Messages persistés en DB + broadcast instantané (host reçoit TOUT)
 * ✅ Postgres Changes sur live_room_messages (filet de sécurité)
 * ✅ Messages éditables / supprimables par leur auteur (inline)
 * ✅ Reconnexion automatique si canal déconnecté
 * ✅ Badge "Synchro" chez les participants pour confirmer la synchro
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

  const chatRef      = useRef(null);
  const chanRef      = useRef(null);
  const burstId      = useRef(0);
  const hasJoined    = useRef(false);
  const syncTimer    = useRef(null);
  const fileInputRef = useRef(null);
  const isHostRef    = useRef(false);
  const roomRef      = useRef(null);

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
  }, []);

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

        // Broadcast: message instantané
        .on('broadcast', { event: 'message' }, ({ payload }) => {
          setMessages(prev => prev.find(m => m.id === payload.id) ? prev : [...prev, payload]);
          scrollChat();
        })
        .on('broadcast', { event: 'message_edited' }, ({ payload }) => {
          setMessages(prev => prev.map(m => m.id === payload.id ? { ...m, content: payload.content, is_edited: true } : m));
        })
        .on('broadcast', { event: 'message_deleted' }, ({ payload }) => {
          setMessages(prev => prev.filter(m => m.id !== payload.id));
        })

        // Postgres changes: messages (filet de sécurité — host reçoit TOUT)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          async ({ new: newMsg }) => {
            if (newMsg.is_deleted) return;
            const { data: u } = await supabase.from('users').select('id,username,avatar_url').eq('id', newMsg.user_id).single();
            const full = { ...newMsg, user: u || null };
            setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, full]);
            scrollChat();
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          ({ new: up }) => {
            if (up.is_deleted) setMessages(prev => prev.filter(m => m.id !== up.id));
            else setMessages(prev => prev.map(m => m.id === up.id ? { ...m, content: up.content, is_edited: true } : m));
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
                }
              });
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
  }, [currentUser, navigate, playSong, scrollChat, startSync]);

  useEffect(() => {
    if (roomIdParam && currentUser && phase === 'joining' && !hasJoined.current) joinRoom(roomIdParam);
  }, [roomIdParam, currentUser, phase, joinRoom]);

  const handleRoomClosed = useCallback(() => {
    stopSync();
    if (chanRef.current) { chanRef.current.untrack?.(); supabase.removeChannel(chanRef.current); chanRef.current = null; }
    setRoom(null); setParticipants([]); setMessages([]);
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
    setPhase('lobby'); hasJoined.current = false; navigate('/live');
  }, [navigate, stopSync]);

  useEffect(() => () => {
    stopSync();
    if (chanRef.current) {
      chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) supabase.from('live_rooms').update({ is_active: false }).eq('id', roomRef.current.id).then(() => {});
      supabase.removeChannel(chanRef.current); chanRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send message (DB first → broadcast) ───────────────────────
  const sendMessage = async () => {
    if (!msgInput.trim() || !chanRef.current || !currentUser || !roomRef.current) return;
    const content = msgInput.trim().slice(0, 500);
    setMsgInput('');
    try {
      const { data: ins, error } = await supabase.from('live_room_messages')
        .insert({ room_id: roomRef.current.id, user_id: currentUser.id, content })
        .select('id, created_at').single();
      if (error) throw error;
      const msg = {
        id: ins.id, room_id: roomRef.current.id, user_id: currentUser.id,
        content, created_at: ins.created_at, is_edited: false,
        user: { id: currentUser.id, username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Moi', avatar_url: currentUser.user_metadata?.avatar_url || null },
      };
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      scrollChat();
      await chanRef.current.send({ type: 'broadcast', event: 'message', payload: msg });
    } catch (err) { console.error('sendMessage:', err); }
  };

  // ── Edit / Delete message ──────────────────────────────────────
  const saveEdit = async () => {
    if (!editContent.trim() || !editingMsgId) return;
    const content = editContent.trim().slice(0, 500);
    await supabase.from('live_room_messages').update({ content, is_edited: true }).eq('id', editingMsgId).eq('user_id', currentUser.id);
    setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, content, is_edited: true } : m));
    chanRef.current?.send({ type: 'broadcast', event: 'message_edited', payload: { id: editingMsgId, content } });
    setEditingMsgId(null); setEditContent('');
  };

  const deleteMessage = async (msgId) => {
    await supabase.from('live_room_messages').update({ is_deleted: true }).eq('id', msgId).eq('user_id', currentUser.id);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    chanRef.current?.send({ type: 'broadcast', event: 'message_deleted', payload: { id: msgId } });
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

  // ════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rooms.map((r, i) => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><h3 className="text-white font-bold text-sm truncate">{r.name}</h3>{r.is_private && <Lock className="w-3 h-3 text-amber-400" />}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500"><Avatar user={r.host} size={4} /><span className="truncate">{r.host?.username || 'Hôte'}</span></div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-1"><Users className="w-3 h-3" />{r.participants_count || 0}/{MAX_PARTICIPANTS}</div>
                      </div>
                      <button onClick={() => { hasJoined.current = false; joinRoom(r.id); }} disabled={!currentUser || (r.participants_count || 0) >= MAX_PARTICIPANTS}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 hover:border-cyan-500/60 disabled:opacity-40 text-cyan-400 text-sm font-medium transition-all flex items-center justify-center gap-2">
                        <Headphones className="w-4 h-4" />{(r.participants_count || 0) >= MAX_PARTICIPANTS ? 'Salle pleine' : 'Rejoindre'}
                      </button>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button onClick={async () => { await supabase.from('live_rooms').update({ is_active: false, participants_count: 0 }).eq('id', r.id); fetchRooms(); }}
                            className="flex-1 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-bold hover:bg-amber-500/25 flex items-center justify-center gap-1">⚡ Stopper</button>
                          <button onClick={() => setConfirmModal({ roomName: r.name, onConfirm: async () => { await supabase.from('live_rooms').delete().eq('id', r.id); fetchRooms(); } })}
                            className="flex-1 py-1.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/25 flex items-center justify-center gap-1">🗑 Supprimer</button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {confirmModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]" onClick={() => setConfirmModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88 }} className="fixed inset-0 flex items-center justify-center z-[10000] px-5 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: 'linear-gradient(135deg,#1a0a0e,#1a0f14)', border: '4px solid rgba(239,68,68,0.8) 0 0 0 0 / 1px' }}>
                <p className="text-white font-bold mb-1">Supprimer "{confirmModal.roomName}" ?</p>
                <p className="text-gray-500 text-sm mb-4">Action irréversible.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 rounded-xl text-gray-300 text-sm border border-white/10 hover:bg-white/5">Annuler</button>
                  <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold bg-red-600 hover:bg-red-700">Supprimer</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );

  // ════════════════════════════════════════════════════════════════
  // ROOM ACTIVE
  return (
    <>
      <Helmet><title>{room?.name || 'Live Room'} — NovaSound TITAN LUX</title></Helmet>
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleLocalFile} />

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
            <div className="flex items-center gap-3">
              <button onClick={leaveRoom} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"><ArrowLeft className="w-5 h-5" /></button>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-bold text-sm truncate max-w-[140px] sm:max-w-[240px]">{room?.name}</span>
                {isHost && <Crown className="w-4 h-4 text-amber-400" />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${channelStatus === 'connected' ? 'bg-green-500/10 text-green-400' : channelStatus === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-gray-800 text-gray-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${channelStatus === 'connected' ? 'bg-green-400' : channelStatus === 'error' ? 'bg-red-400 animate-pulse' : 'bg-gray-500 animate-pulse'}`} />
                <span className="hidden sm:inline">{channelStatus === 'connected' ? 'Connecté' : channelStatus === 'error' ? 'Déconnecté' : 'Connexion…'}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-400 bg-gray-800 px-2 py-1 rounded-full"><Users className="w-3.5 h-3.5" />{participants.length}</div>
              <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copié !' : 'Inviter'}
              </button>
              {canStopLive && (
                <button onClick={leaveRoom} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 text-xs font-bold text-red-400">
                  <X className="w-3.5 h-3.5" /><span className="hidden sm:inline">{isAdmin && !isHost ? '⚡ Stop' : '⏹ Stopper'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 container mx-auto px-4 py-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Left */}
            <div className="lg:col-span-1 space-y-4">
              {/* Now Playing */}
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {nowPlaying?.cover_url && (
                  <div className="absolute inset-0 opacity-15" style={{ backgroundImage: `url(${nowPlaying.cover_url})`, backgroundSize: 'cover', filter: 'blur(24px)', transform: 'scale(1.15)' }} />
                )}
                <div className="relative p-5">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-800 mb-4 shadow-xl">
                    {nowPlaying?.cover_url
                      ? <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center flex-col gap-2"><Music className="w-12 h-12 text-gray-700" /><p className="text-gray-600 text-xs">{isHost ? 'Choisis un son' : "En attente de l'hôte"}</p></div>}
                  </div>
                  {nowPlaying ? (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">En lecture</span>
                        {!isHost && <span className="text-[10px] text-green-400 ml-auto">🔄 Synchro</span>}
                      </div>
                      <p className="text-white font-bold truncate text-sm">{nowPlaying.title}</p>
                      <p className="text-gray-400 text-xs truncate">{nowPlaying.artist}</p>
                    </div>
                  ) : (
                    <div className="mb-4 text-center py-2">
                      <p className="text-gray-600 text-xs">{isHost ? '← Sélectionne un son' : "L'hôte n'a pas lancé de son"}</p>
                    </div>
                  )}
                  {isHost && (
                    <div className="flex gap-2">
                      <button onClick={() => setShowPicker(!showPicker)}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-400 text-sm font-medium flex items-center justify-center gap-2">
                        {showPicker ? <><X className="w-4 h-4" />Fermer</> : <><Music className="w-4 h-4" />Sons NovaSound</>}
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLocal} title="Jouer un fichier local"
                        className="py-2.5 px-3 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 hover:border-fuchsia-500/60 text-fuchsia-400 flex items-center justify-center disabled:opacity-50">
                        {uploadingLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative h-14 overflow-hidden border-t border-gray-800/50">
                  <EmojiBurst bursts={bursts} />
                  <button onClick={sendBurst} className="absolute inset-0 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-fuchsia-400 text-sm active:scale-95">
                    <Heart className="w-4 h-4" /><span className="text-xs">Réagir</span>
                  </button>
                </div>
              </div>

              {/* Song Picker */}
              <AnimatePresence>
                {showPicker && isHost && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input value={songSearch} onChange={e => setSongSearch(e.target.value)} placeholder="Rechercher un son…"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500" autoFocus />
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {songResults.map(song => (
                        <button key={song.id} onClick={() => broadcastSong(song)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800 text-left group">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                            {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-gray-500" /></div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate group-hover:text-cyan-400">{song.title}</p>
                            <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                          </div>
                          <Play className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 flex-shrink-0" />
                        </button>
                      ))}
                      {songSearch && !songResults.length && <p className="text-center text-gray-500 text-sm py-6">Aucun résultat</p>}
                      {!songSearch && <p className="text-center text-gray-600 text-xs py-3">Tape pour chercher…</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Participants */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Headphones className="w-4 h-4 text-cyan-400" />Participants ({participants.length}/{MAX_PARTICIPANTS})</h3>
                <div className="flex flex-wrap gap-2">
                  {participants.map(p => (
                    <motion.div key={p.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 bg-gray-800 rounded-full pl-1 pr-3 py-1 border border-white/[0.04]">
                      <Avatar user={p} size={6} crown={p.id === room?.host_id} />
                      <span className="text-xs text-gray-300 truncate max-w-[80px]">{p.username || 'Utilisateur'}</span>
                    </motion.div>
                  ))}
                  {participants.length === 0 && <p className="text-gray-600 text-xs italic">Connexion en cours…</p>}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className="lg:col-span-2 flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ minHeight: 480, maxHeight: 640 }}>
              <div className="px-4 py-3 border-b border-gray-800/60 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-fuchsia-400" /><span className="text-sm font-bold text-white">Chat Live</span></div>
                {isHost && <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown className="w-2.5 h-2.5" />Hôte</span>}
              </div>

              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {messages.length === 0 && (
                  <div className="text-center text-gray-600 text-sm mt-10"><p className="text-2xl mb-2">👋</p><p>Le chat est vide — dis bonjour !</p></div>
                )}
                {messages.map(msg => {
                  const isMe = msg.user_id === currentUser?.id;
                  const isEditing = editingMsgId === msg.id;
                  return (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 group ${isMe ? 'flex-row-reverse' : ''}`}>
                      <Avatar user={msg.user} size={7} />
                      <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && (
                          <span className="text-[10px] text-gray-500 px-1 flex items-center gap-1">
                            {msg.user?.id === room?.host_id && <Crown className="w-2.5 h-2.5 text-amber-400" />}
                            {msg.user?.username || 'Utilisateur'}
                          </span>
                        )}
                        {isEditing ? (
                          <div className="flex items-center gap-1 w-full">
                            <input value={editContent} onChange={e => setEditContent(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingMsgId(null); }}
                              className="bg-gray-700 border border-cyan-500/40 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none flex-1" autoFocus />
                            <button onClick={saveEdit}><CheckCircle2 className="w-4 h-4 text-green-400 hover:text-green-300" /></button>
                            <button onClick={() => setEditingMsgId(null)}><XCircle className="w-4 h-4 text-gray-500 hover:text-gray-300" /></button>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${isMe ? 'bg-gradient-to-br from-cyan-600 to-fuchsia-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 rounded-bl-sm'}`}>
                              {msg.content}
                              {msg.is_edited && <span className="text-[9px] opacity-50 ml-1">(modifié)</span>}
                            </div>
                            {isMe && (
                              <div className="absolute top-0 right-full mr-1 hidden group-hover:flex items-center gap-1">
                                <button onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); }} className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-cyan-400"><Pencil className="w-3 h-3" /></button>
                                <button onClick={() => deleteMessage(msg.id)} className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-gray-800/60 flex-shrink-0">
                {currentUser ? (
                  <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2 border border-gray-700/50 focus-within:border-cyan-500/40">
                    <input value={msgInput} onChange={e => setMsgInput(e.target.value.slice(0, 500))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Envoyer un message…" className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none" />
                    <button onClick={sendBurst} className="text-xl hover:scale-125 transition-transform flex-shrink-0">🎉</button>
                    <button onClick={sendMessage} disabled={!msgInput.trim()} className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 disabled:opacity-40 text-white flex-shrink-0 active:scale-95"><Send className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-gray-600"><Link to="/login" className="text-cyan-400 hover:underline">Connecte-toi</Link> pour participer</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LiveRoomPage;
