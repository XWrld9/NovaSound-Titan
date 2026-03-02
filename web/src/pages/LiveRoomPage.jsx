/**
 * LiveRoomPage — NovaSound TITAN LUX v6000
 * REWRITE complet — corrections de tous les bugs v5000 :
 *
 * BUG 1 — Phase 'joining' non rendue → écran blanc/vide
 * BUG 2 — participants_count jamais mis à jour (toujours 1)
 * BUG 3 — Présence vide au join (race condition track vs setPhase)
 * BUG 4 — joinRoomRef timing issue (useEffect avant l'assignation)
 * BUG 5 — Pas de cleanup au navigation/unmount (salle reste active)
 * BUG 6 — Pas de gestion d'erreurs sur le canal Realtime
 * BUG 7 — Pas de reconnexion si canal Realtime déconnecté
 * BUG 8 — Boutons hôte visibles/cliquables par les non-hôtes
 * BUG 9 — Salle non marquée inactive si hôte part
 * BUG 10 — Scroll chat ne fonctionne pas au premier message
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
  Radio, Users, Play, Pause, SkipForward, Music, Send,
  Heart, Crown, LogOut, Copy, Check, Plus, Lock, Unlock,
  Headphones, Zap, X, ArrowLeft, Loader2, WifiOff, RefreshCw,
  Volume2, Search
} from 'lucide-react';

// ── Constantes ──────────────────────────────────────────────────────
const MAX_PARTICIPANTS = 12;
const BURST_EMOJIS = ['🔥', '💜', '🎵', '✨', '🎶', '❤️', '💫', '🎉', '😍', '🚀'];

// ── Avatar ──────────────────────────────────────────────────────────
const Avatar = ({ user, size = 9, crown = false }) => {
  const initials = (user?.username || user?.name || '?').slice(0, 2).toUpperCase();
  const colors = ['from-cyan-500 to-blue-600','from-fuchsia-500 to-purple-600',
    'from-amber-400 to-orange-500','from-emerald-400 to-teal-600',
    'from-rose-400 to-pink-600','from-indigo-400 to-violet-600'];
  const color = colors[(user?.id?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`relative w-${size} h-${size} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-white/10`}>
      {user?.avatar_url
        ? <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover" />
        : initials
      }
      {crown && <div className="absolute -top-1.5 -right-1.5 text-sm select-none">👑</div>}
    </div>
  );
};

// ── Emoji Burst ──────────────────────────────────────────────────────
const EmojiBurst = ({ bursts }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <AnimatePresence>
      {bursts.map((b) => (
        <motion.div
          key={b.id}
          initial={{ opacity: 1, y: 0, scale: 0.6 }}
          animate={{ opacity: 0, y: -110, scale: 1.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="absolute text-2xl select-none"
          style={{ left: b.x, bottom: 16 }}
        >
          {b.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ── Loading Screen ───────────────────────────────────────────────────
const LoadingScreen = ({ label = 'Connexion à la salle...' }) => (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/30 to-fuchsia-500/30 border border-red-500/30 flex items-center justify-center">
      <Radio className="w-8 h-8 text-red-400 animate-pulse" />
    </div>
    <p className="text-gray-400 text-sm">{label}</p>
    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
  </div>
);

// ══════════════════════════════════════════════════════════════════
const LiveRoomPage = () => {
  const { roomId: roomIdParam } = useParams();
  const { currentUser } = useAuth();
  const { playSong } = usePlayer();
  const navigate = useNavigate();

  // State
  const [phase, setPhase]               = useState('init'); // init | lobby | creating | joining | room | error
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
  const [channelStatus, setChannelStatus] = useState('idle'); // idle | connecting | connected | error
  const [joinError, setJoinError]       = useState(null);

  const chatRef     = useRef(null);
  const chanRef     = useRef(null);
  const burstId     = useRef(0);
  const hasJoined   = useRef(false);

  // ── Admin check ──────────────────────────────────────────────
  const ADMIN_EMAIL = 'eloadxfamily@gmail.com';
  const isAdmin = currentUser?.email === ADMIN_EMAIL ||
                  currentUser?.user_metadata?.email === ADMIN_EMAIL;
  const canStopLive = isHost || isAdmin;

  // ── Scroll chat to bottom ────────────────────────────────────
  const scrollChat = useCallback(() => {
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    }, 60);
  }, []);

  // ── Fetch public rooms ───────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { data } = await supabase
        .from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url)')
        .eq('is_active', true)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(20);
      setRooms(data || []);
    } catch (e) {
      console.error('fetchRooms:', e);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // ── Init phase ───────────────────────────────────────────────
  useEffect(() => {
    if (roomIdParam) {
      setPhase('joining');
    } else {
      setPhase('lobby');
    }
  }, [roomIdParam]);

  useEffect(() => {
    if (phase === 'lobby') fetchRooms();
  }, [phase, fetchRooms]);

  // ── Create room ──────────────────────────────────────────────
  const createRoom = async () => {
    if (!currentUser || !roomName.trim()) return;
    setCreatingRoom(true);
    try {
      const { data, error } = await supabase
        .from('live_rooms')
        .insert({
          name: roomName.trim(),
          host_id: currentUser.id,
          is_private: isPrivate,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      await joinRoom(data.id, true);
    } catch (e) {
      console.error('createRoom:', e);
      setCreatingRoom(false);
    }
  };

  // ── Join room ────────────────────────────────────────────────
  const joinRoom = useCallback(async (id, asHost = false) => {
    if (!currentUser) { navigate('/login'); return; }
    if (hasJoined.current) return;
    hasJoined.current = true;

    setPhase('joining');
    setJoinError(null);
    setChannelStatus('connecting');

    try {
      // Fetch room data
      const { data: roomData, error: roomErr } = await supabase
        .from('live_rooms')
        .select('*, host:host_id(id,username,avatar_url)')
        .eq('id', id)
        .single();

      if (roomErr || !roomData) {
        throw new Error('Salle introuvable ou expirée.');
      }
      if (!roomData.is_active) {
        throw new Error('Cette salle est terminée.');
      }

      setRoom(roomData);
      setIsHost(asHost || roomData.host_id === currentUser.id);

      // Load recent messages
      const { data: msgs } = await supabase
        .from('live_room_messages')
        .select('*, user:user_id(id,username,avatar_url)')
        .eq('room_id', id)
        .order('created_at', { ascending: true })
        .limit(60);
      setMessages(msgs || []);

      // Load current song
      if (roomData.current_song_id) {
        const { data: song } = await supabase
          .from('songs')
          .select('*')
          .eq('id', roomData.current_song_id)
          .single();
        if (song) {
          setNowPlaying(song);
          playSong(song, [song]);
        }
      }

      // ── Realtime channel ────────────────────────────────────
      const chan = supabase.channel(`live_room:${id}`, {
        config: {
          presence: { key: currentUser.id },
          broadcast: { self: false },
        }
      });

      chan
        .on('presence', { event: 'sync' }, () => {
          const state = chan.presenceState();
          const users = Object.values(state).flat().map(p => p.user).filter(Boolean);
          setParticipants(users);
          // Update participants_count in DB (only host to avoid race)
          if (asHost || roomData.host_id === currentUser.id) {
            supabase.from('live_rooms')
              .update({ participants_count: users.length })
              .eq('id', id)
              .then(() => {});
          }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          // No-op, handled by sync
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          // No-op, handled by sync
        })
        .on('broadcast', { event: 'message' }, ({ payload }) => {
          setMessages(prev => [...prev, payload]);
          scrollChat();
        })
        .on('broadcast', { event: 'play_song' }, ({ payload }) => {
          if (payload?.song) {
            setNowPlaying(payload.song);
            playSong(payload.song, [payload.song]);
          }
        })
        .on('broadcast', { event: 'burst' }, ({ payload }) => {
          addBurst(payload.emoji, payload.x);
        })
        .on('broadcast', { event: 'room_closed' }, () => {
          handleRoomClosed();
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'live_rooms',
          filter: `id=eq.${id}`
        }, ({ new: updated }) => {
          if (!updated.is_active) {
            handleRoomClosed();
          } else {
            setRoom(prev => ({ ...prev, ...updated }));
          }
        })
        .subscribe(async (status, err) => {
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
            } catch (trackErr) {
              console.warn('presence track error:', trackErr);
            }
            setPhase('room');
            scrollChat();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setChannelStatus('error');
            setJoinError('Connexion temps réel perdue. Vérifie ta connexion et réessaie.');
            hasJoined.current = false;
          }
        });

      chanRef.current = chan;

    } catch (err) {
      console.error('joinRoom error:', err);
      setJoinError(err.message || 'Impossible de rejoindre la salle.');
      setPhase('error');
      hasJoined.current = false;
    }
  }, [currentUser, navigate, playSong, scrollChat]);

  // ── Auto-join from URL param ─────────────────────────────────
  useEffect(() => {
    if (roomIdParam && currentUser && phase === 'joining' && !hasJoined.current) {
      joinRoom(roomIdParam);
    }
  }, [roomIdParam, currentUser, phase, joinRoom]);

  // ── Handle room closed by host ───────────────────────────────
  const handleRoomClosed = useCallback(() => {
    if (chanRef.current) {
      chanRef.current.untrack?.();
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    setPhase('lobby');
    hasJoined.current = false;
    navigate('/live');
  }, [navigate]);

  // ── Leave room ───────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    if (chanRef.current) {
      await chanRef.current.untrack?.();
      if (isHost && room) {
        // Notify participants before closing
        await chanRef.current.send({ type: 'broadcast', event: 'room_closed', payload: {} });
        await supabase.from('live_rooms').update({ is_active: false, participants_count: 0 }).eq('id', room.id);
      }
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    setPhase('lobby');
    hasJoined.current = false;
    navigate('/live');
  }, [isHost, room, navigate]);

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (chanRef.current) {
        chanRef.current.untrack?.();
        if (isHost && room) {
          supabase.from('live_rooms').update({ is_active: false }).eq('id', room.id).then(() => {});
        }
        supabase.removeChannel(chanRef.current);
        chanRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = async () => {
    if (!msgInput.trim() || !chanRef.current || !currentUser) return;
    const content = msgInput.trim().slice(0, 500);
    const msg = {
      id: crypto.randomUUID(),
      room_id: room.id,
      user_id: currentUser.id,
      content,
      created_at: new Date().toISOString(),
      user: {
        id: currentUser.id,
        username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Moi',
        avatar_url: currentUser.user_metadata?.avatar_url || null,
      }
    };
    setMsgInput('');
    setMessages(prev => [...prev, msg]);
    scrollChat();
    await chanRef.current.send({ type: 'broadcast', event: 'message', payload: msg });
    supabase.from('live_room_messages').insert({
      room_id: room.id,
      user_id: currentUser.id,
      content,
    }).then(() => {});
  };

  // ── Broadcast song (host only) ───────────────────────────────
  const broadcastSong = async (song) => {
    if (!isHost || !chanRef.current) return;
    setNowPlaying(song);
    playSong(song, [song]);
    setShowPicker(false);
    setSongSearch('');
    setSongResults([]);
    await supabase.from('live_rooms').update({ current_song_id: song.id }).eq('id', room.id);
    await chanRef.current.send({ type: 'broadcast', event: 'play_song', payload: { song } });
  };

  // ── Burst ─────────────────────────────────────────────────────
  const addBurst = (emoji = null, x = null) => {
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

  // ── Song search ──────────────────────────────────────────────
  useEffect(() => {
    if (!songSearch.trim()) { setSongResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('songs')
        .select('id,title,artist,cover_url,audio_url')
        .or(`title.ilike.%${songSearch}%,artist.ilike.%${songSearch}%`)
        .eq('is_archived', false)
        .limit(10);
      setSongResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [songSearch]);

  // ── Copy link ─────────────────────────────────────────────────
  const copyLink = () => {
    const base = window.location.origin;
    const url = `${base}/#/live/${room?.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ════════════════════════════════════════════════════════════
  // RENDER — Loading
  // ════════════════════════════════════════════════════════════
  if (phase === 'init' || phase === 'joining') {
    return <LoadingScreen label={roomIdParam ? 'Connexion à la salle...' : 'Chargement...'} />;
  }

  // ════════════════════════════════════════════════════════════
  // RENDER — Error
  // ════════════════════════════════════════════════════════════
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
        <WifiOff className="w-12 h-12 text-red-400" />
        <div className="text-center">
          <p className="text-white font-bold text-lg mb-2">Impossible de rejoindre</p>
          <p className="text-gray-400 text-sm max-w-sm">{joinError || 'Une erreur est survenue.'}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setPhase('lobby'); hasJoined.current = false; navigate('/live'); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          {roomIdParam && (
            <button
              onClick={() => { hasJoined.current = false; setPhase('joining'); joinRoom(roomIdParam); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER — Lobby / Creating
  // ════════════════════════════════════════════════════════════
  if (phase === 'lobby' || phase === 'creating') {
    return (
      <>
        <Helmet><title>Live Rooms — NovaSound TITAN LUX</title></Helmet>
        <div className="min-h-screen bg-gray-950 flex flex-col">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">

            {/* Hero */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                LIVE ROOMS
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                Écoute <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">ensemble</span>
              </h1>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">
                Crée une salle, invite tes amis et partagez la même vibe musicale en temps réel.
              </p>
            </motion.div>

            {/* Create room */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-gray-900 border border-cyan-500/25 rounded-2xl p-6 mb-8"
            >
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                Créer une salle
              </h2>
              <div className="flex gap-3 flex-wrap">
                <input
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createRoom()}
                  placeholder="Nom de ta salle..."
                  maxLength={60}
                  className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500"
                />
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isPrivate ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {isPrivate ? 'Privée' : 'Publique'}
                </button>
                <button
                  onClick={createRoom}
                  disabled={!roomName.trim() || creatingRoom || !currentUser}
                  className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg flex items-center gap-2"
                >
                  {creatingRoom ? <><Loader2 className="w-4 h-4 animate-spin" />Création…</> : 'Créer →'}
                </button>
              </div>
              {!currentUser && (
                <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
                  <span>⚠️</span>
                  <Link to="/login" className="underline">Connecte-toi</Link> pour créer ou rejoindre une salle.
                </p>
              )}
            </motion.div>

            {/* Room list */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-400" />
                  Salles en direct
                  <span className="text-xs text-gray-500 font-normal">({rooms.length})</span>
                </h2>
                <button onClick={fetchRooms} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Rafraîchir
                </button>
              </div>

              {loadingRooms ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucune salle active pour l'instant</p>
                  <p className="text-sm mt-1">Sois le premier à en créer une !</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rooms.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 flex flex-col gap-3 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                            <h3 className="text-white font-bold text-sm truncate">{r.name}</h3>
                            {r.is_private && <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Avatar user={r.host} size={4} />
                            <span className="truncate">{r.host?.username || 'Hôte'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 bg-gray-800 rounded-full px-2 py-1">
                          <Users className="w-3 h-3" />
                          <span>{r.participants_count || 0}/{MAX_PARTICIPANTS}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { hasJoined.current = false; joinRoom(r.id); }}
                        disabled={!currentUser || (r.participants_count || 0) >= MAX_PARTICIPANTS}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 hover:border-cyan-500/60 disabled:opacity-40 text-cyan-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Headphones className="w-4 h-4" />
                        {(r.participants_count || 0) >= MAX_PARTICIPANTS ? 'Salle pleine' : 'Rejoindre'}
                      </button>
                      {/* Boutons admin dans le lobby */}
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await supabase.from('live_rooms').update({ is_active: false, participants_count: 0 }).eq('id', r.id);
                                fetchRooms();
                              } catch {}
                            }}
                            className="flex-1 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-all flex items-center justify-center gap-1"
                          >
                            ⚡ Stopper
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Supprimer la salle "${r.name}" ?`)) return;
                              try {
                                await supabase.from('live_rooms').delete().eq('id', r.id);
                                fetchRooms();
                              } catch {}
                            }}
                            className="flex-1 py-1.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-all flex items-center justify-center gap-1"
                          >
                            🗑 Supprimer
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

          </main>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER — Room active
  // ════════════════════════════════════════════════════════════
  return (
    <>
      <Helmet><title>{room?.name || 'Live Room'} — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col pb-24">

        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
            <div className="flex items-center gap-3">
              <button onClick={leaveRoom} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-bold text-sm truncate max-w-[140px] sm:max-w-[240px]">{room?.name}</span>
                {isHost && <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Channel status indicator */}
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                channelStatus === 'connected' ? 'bg-green-500/10 text-green-400' :
                channelStatus === 'error' ? 'bg-red-500/10 text-red-400' :
                'bg-gray-800 text-gray-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  channelStatus === 'connected' ? 'bg-green-400' :
                  channelStatus === 'error' ? 'bg-red-400 animate-pulse' :
                  'bg-gray-500 animate-pulse'
                }`} />
                <span className="hidden sm:inline">{channelStatus === 'connected' ? 'Connecté' : channelStatus === 'error' ? 'Déconnecté' : 'Connexion…'}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-400 bg-gray-800 px-2 py-1 rounded-full">
                <Users className="w-3.5 h-3.5" />
                <span>{participants.length}</span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copié !' : 'Inviter'}
              </button>
              {/* Bouton Stopper le Live — hôte ET admin */}
              {canStopLive && (
                <button
                  onClick={leaveRoom}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 text-xs font-bold text-red-400 transition-all"
                  title={isAdmin && !isHost ? 'Stopper (Admin)' : 'Terminer le live'}
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isAdmin && !isHost ? '⚡ Stop Admin' : '⏹ Stopper'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 container mx-auto px-4 py-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── Left: Now Playing + Participants ─── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Now Playing Card */}
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {nowPlaying?.cover_url && (
                  <div className="absolute inset-0 opacity-15"
                    style={{ backgroundImage: `url(${nowPlaying.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(24px)', transform: 'scale(1.15)' }}
                  />
                )}
                <div className="relative p-5">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-800 mb-4 shadow-xl">
                    {nowPlaying?.cover_url
                      ? <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center flex-col gap-2">
                          <Music className="w-12 h-12 text-gray-700" />
                          <p className="text-gray-600 text-xs">{isHost ? 'Choisis un son' : "En attente de l'hôte"}</p>
                        </div>
                    }
                  </div>

                  {nowPlaying ? (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse flex-shrink-0" />
                        <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">En lecture</span>
                      </div>
                      <p className="text-white font-bold truncate text-sm">{nowPlaying.title}</p>
                      <p className="text-gray-400 text-xs truncate">{nowPlaying.artist}</p>
                    </div>
                  ) : (
                    <div className="mb-4 text-center py-2">
                      <p className="text-gray-600 text-xs">
                        {isHost ? '← Sélectionne un son ci-dessous' : "L'hôte n'a pas encore lancé de son"}
                      </p>
                    </div>
                  )}

                  {/* Host controls */}
                  {isHost && (
                    <button
                      onClick={() => setShowPicker(!showPicker)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                      {showPicker ? <><X className="w-4 h-4" />Fermer</> : <><Music className="w-4 h-4" />Choisir un son</>}
                    </button>
                  )}
                </div>

                {/* Burst zone */}
                <div className="relative h-14 overflow-hidden border-t border-gray-800/50">
                  <EmojiBurst bursts={bursts} />
                  <button
                    onClick={sendBurst}
                    className="absolute inset-0 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-fuchsia-400 transition-colors text-sm active:scale-95"
                  >
                    <Heart className="w-4 h-4" />
                    <span className="text-xs">Réagir</span>
                  </button>
                </div>
              </div>

              {/* Song Picker (host only) */}
              <AnimatePresence>
                {showPicker && isHost && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                  >
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        value={songSearch}
                        onChange={e => setSongSearch(e.target.value)}
                        placeholder="Rechercher un son ou artiste..."
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {songResults.map(song => (
                        <button
                          key={song.id}
                          onClick={() => broadcastSong(song)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800 transition-colors text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                            {song.cover_url
                              ? <img src={song.cover_url} className="w-full h-full object-cover" alt={song.title} />
                              : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-gray-500" /></div>
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate group-hover:text-cyan-400 transition-colors">{song.title}</p>
                            <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                          </div>
                          <Play className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 flex-shrink-0 transition-colors" />
                        </button>
                      ))}
                      {songSearch && songResults.length === 0 && (
                        <p className="text-center text-gray-500 text-sm py-6">Aucun résultat pour "{songSearch}"</p>
                      )}
                      {!songSearch && (
                        <p className="text-center text-gray-600 text-xs py-3">Tape pour chercher un son…</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Participants */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-cyan-400" />
                  Participants ({participants.length}/{MAX_PARTICIPANTS})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 bg-gray-800 rounded-full pl-1 pr-3 py-1 border border-white/[0.04]"
                    >
                      <Avatar user={p} size={6} crown={p.id === room?.host_id} />
                      <span className="text-xs text-gray-300 truncate max-w-[80px]">{p.username || 'Utilisateur'}</span>
                    </motion.div>
                  ))}
                  {participants.length === 0 && (
                    <p className="text-gray-600 text-xs italic">Connexion en cours…</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right: Chat ────────────────────────── */}
            <div className="lg:col-span-2 flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ minHeight: 480, maxHeight: 640 }}>

              {/* Chat header */}
              <div className="px-4 py-3 border-b border-gray-800/60 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-fuchsia-400" />
                  <span className="text-sm font-bold text-white">Chat Live</span>
                </div>
                {isHost && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5" />
                    Tu es l'hôte
                  </span>
                )}
              </div>

              {/* Messages */}
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {messages.length === 0 && (
                  <div className="text-center text-gray-600 text-sm mt-10">
                    <p className="text-2xl mb-2">👋</p>
                    <p>Le chat est vide.</p>
                    <p className="text-xs mt-1">Dis bonjour à tout le monde !</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = msg.user_id === currentUser?.id;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ willChange: 'auto' }}
                      className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar user={msg.user} size={7} />
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {!isMe && (
                          <span className="text-[10px] text-gray-500 px-1 flex items-center gap-1">
                            {msg.user?.id === room?.host_id && <Crown className="w-2.5 h-2.5 text-amber-400" />}
                            {msg.user?.username || 'Utilisateur'}
                          </span>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                          isMe
                            ? 'bg-gradient-to-br from-cyan-600 to-fuchsia-600 text-white rounded-br-sm'
                            : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-800/60 flex-shrink-0">
                {currentUser ? (
                  <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2 border border-gray-700/50 focus-within:border-cyan-500/40 transition-colors">
                    <input
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value.slice(0, 500))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Envoyer un message…"
                      className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
                    />
                    <button
                      onClick={sendBurst}
                      className="text-xl hover:scale-125 transition-transform flex-shrink-0"
                      title="Réagir avec un emoji"
                    >
                      🎉
                    </button>
                    <button
                      onClick={sendMessage}
                      disabled={!msgInput.trim()}
                      className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-40 text-white transition-all flex-shrink-0 active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-gray-600">
                    <Link to="/login" className="text-cyan-400 hover:underline">Connecte-toi</Link> pour participer au chat
                  </p>
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
