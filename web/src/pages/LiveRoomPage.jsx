/**
 * LiveRoomPage — NovaSound TITAN LUX v5000
 * Salles d'écoute collective en temps réel via Supabase Realtime.
 * - Créer / rejoindre une salle
 * - Chat en temps réel synchronisé avec la lecture
 * - Votes "J'adore" en live avec animation burst
 * - Affichage des participants avec avatars
 * - Hôte contrôle la lecture, les autres suivent
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Radio, Users, Play, Pause, SkipForward, Music, Send,
  Heart, Crown, LogOut, Copy, Check, Plus, Lock, Unlock,
  Headphones, Zap, X, ArrowLeft
} from 'lucide-react';

// ── Constantes ─────────────────────────────────────────────────────
const MAX_PARTICIPANTS = 12;
const BURST_EMOJIS = ['🔥', '💜', '🎵', '✨', '🎶', '❤️', '💫', '🎉'];

// ── Petit hook utilitaire avatar ────────────────────────────────────
const Avatar = ({ user, size = 9, crown = false }) => {
  const initials = (user?.username || user?.name || '?').slice(0, 2).toUpperCase();
  const colors = ['from-cyan-500 to-blue-600','from-fuchsia-500 to-purple-600',
    'from-amber-400 to-orange-500','from-emerald-400 to-teal-600',
    'from-rose-400 to-pink-600','from-indigo-400 to-violet-600'];
  const color = colors[(user?.id?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`relative w-${size} h-${size} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {user?.avatar_url
        ? <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover" />
        : initials
      }
      {crown && (
        <div className="absolute -top-1.5 -right-1.5 text-sm">👑</div>
      )}
    </div>
  );
};

// ── Burst animation cœurs/emojis ───────────────────────────────────
const EmojiBurst = ({ bursts }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <AnimatePresence>
      {bursts.map((b) => (
        <motion.div
          key={b.id}
          initial={{ opacity: 1, y: 0, x: b.x, scale: 0.5 }}
          animate={{ opacity: 0, y: -120, scale: 1.4 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="absolute text-2xl select-none"
          style={{ left: b.x, bottom: 60 }}
        >
          {b.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ══════════════════════════════════════════════════════════════════
// Composant principal
// ══════════════════════════════════════════════════════════════════
const LiveRoomPage = () => {
  const { roomId: roomIdParam } = useParams();
  const { currentUser } = useAuth();
  const { playSong, currentSong } = usePlayer();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────
  const [phase, setPhase]           = useState(roomIdParam ? 'joining' : 'lobby'); // lobby | creating | joining | room
  const [rooms, setRooms]           = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [room, setRoom]             = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages]     = useState([]);
  const [msgInput, setMsgInput]     = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isHost, setIsHost]         = useState(false);
  const [bursts, setBursts]         = useState([]);
  const [copied, setCopied]         = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const [songResults, setSongResults] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [roomName, setRoomName]     = useState('');
  const [isPrivate, setIsPrivate]   = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const chatRef  = useRef(null);
  const chanRef  = useRef(null);
  const burstId  = useRef(0);

  // ── Charger les salles publiques ───────────────────────────────
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    const { data } = await supabase
      .from('live_rooms')
      .select('*, host:host_id(id,username,avatar_url), participants_count')
      .eq('is_active', true)
      .eq('is_private', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setRooms(data || []);
    setLoadingRooms(false);
  }, []);

  useEffect(() => { if (phase === 'lobby') fetchRooms(); }, [phase, fetchRooms]);

  // joinRoomRef permet au useEffect de rejoindre la salle sans dépendance circulaire
  const joinRoomRef = useRef(null);

  // ── Créer une salle ────────────────────────────────────────────
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
          participants_count: 1,
        })
        .select()
        .single();
      if (error) throw error;
      await joinRoom(data.id, true);
    } catch (e) {
      console.error('createRoom:', e);
    } finally {
      setCreatingRoom(false);
    }
  };

  // ── Rejoindre une salle ────────────────────────────────────────
  const joinRoom = async (id, asHost = false) => {
    if (!currentUser) { navigate('/login'); return; }
    setPhase('joining');

    const { data: roomData } = await supabase
      .from('live_rooms')
      .select('*, host:host_id(id,username,avatar_url)')
      .eq('id', id)
      .single();

    if (!roomData) { setPhase('lobby'); return; }

    setRoom(roomData);
    setIsHost(asHost || roomData.host_id === currentUser.id);

    // Charger les messages récents
    const { data: msgs } = await supabase
      .from('live_room_messages')
      .select('*, user:user_id(id,username,avatar_url)')
      .eq('room_id', id)
      .order('created_at', { ascending: true })
      .limit(50);
    setMessages(msgs || []);

    // Charger le son en cours
    if (roomData.current_song_id) {
      const { data: song } = await supabase
        .from('songs')
        .select('*')
        .eq('id', roomData.current_song_id)
        .single();
      setNowPlaying(song);
    }

    // S'abonner au canal Realtime de la salle
    const chan = supabase.channel(`live_room:${id}`, {
      config: { presence: { key: currentUser.id } }
    });

    chan
      // Présence — participants
      .on('presence', { event: 'sync' }, () => {
        const state = chan.presenceState();
        const users = Object.values(state).flat().map(p => p.user);
        setParticipants(users.filter(Boolean));
      })
      // Messages chat
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages(prev => [...prev, payload]);
        setTimeout(() => {
          chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
        }, 50);
      })
      // Contrôles lecture (hôte → participants)
      .on('broadcast', { event: 'play_song' }, ({ payload }) => {
        setNowPlaying(payload.song);
        playSong(payload.song, [payload.song]);
      })
      // Réactions burst
      .on('broadcast', { event: 'burst' }, ({ payload }) => {
        addBurst(payload.emoji, payload.x);
      })
      // Mise à jour salle
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'live_rooms',
        filter: `id=eq.${id}`
      }, ({ new: updated }) => {
        setRoom(prev => ({ ...prev, ...updated }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await chan.track({
            user: {
              id: currentUser.id,
              username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0],
              avatar_url: currentUser.user_metadata?.avatar_url || null,
            }
          });
        }
      });

    chanRef.current = chan;
    setPhase('room');
  };

  // Stocker la référence pour le useEffect auto-join
  joinRoomRef.current = joinRoom;

  // ── Auto-rejoindre si URL avec roomId (après déclaration de joinRoom) ──
  useEffect(() => {
    if (roomIdParam && currentUser && joinRoomRef.current) {
      joinRoomRef.current(roomIdParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdParam, currentUser?.id]);

  // ── Quitter la salle ───────────────────────────────────────────
  const leaveRoom = async () => {
    if (chanRef.current) {
      await chanRef.current.untrack();
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
    if (isHost && room) {
      await supabase.from('live_rooms').update({ is_active: false }).eq('id', room.id);
    }
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    setPhase('lobby');
    navigate('/live');
  };

  // ── Envoyer un message ─────────────────────────────────────────
  const sendMessage = async () => {
    if (!msgInput.trim() || !chanRef.current) return;
    const msg = {
      id: crypto.randomUUID(),
      room_id: room.id,
      user_id: currentUser.id,
      content: msgInput.trim(),
      created_at: new Date().toISOString(),
      user: {
        id: currentUser.id,
        username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0],
        avatar_url: currentUser.user_metadata?.avatar_url || null,
      }
    };
    setMsgInput('');
    setMessages(prev => [...prev, msg]);
    await chanRef.current.send({ type: 'broadcast', event: 'message', payload: msg });
    // Persister
    supabase.from('live_room_messages').insert({
      room_id: room.id, user_id: currentUser.id, content: msg.content
    }).then(() => {});
    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  // ── Diffuser un son (hôte) ─────────────────────────────────────
  const broadcastSong = async (song) => {
    if (!isHost || !chanRef.current) return;
    setNowPlaying(song);
    playSong(song, [song]);
    setShowPicker(false);
    await supabase.from('live_rooms').update({ current_song_id: song.id }).eq('id', room.id);
    await chanRef.current.send({ type: 'broadcast', event: 'play_song', payload: { song } });
  };

  // ── Réaction burst ─────────────────────────────────────────────
  const addBurst = (emoji = null, x = null) => {
    const e = emoji || BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)];
    const posX = x ?? Math.random() * 80 + 10;
    const id = ++burstId.current;
    setBursts(prev => [...prev, { id, emoji: e, x: `${posX}%` }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 1500);
  };

  const sendBurst = async () => {
    if (!chanRef.current) return;
    const emoji = BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)];
    const x = Math.random() * 80 + 10;
    addBurst(emoji, `${x}%`);
    await chanRef.current.send({ type: 'broadcast', event: 'burst', payload: { emoji, x } });
  };

  // ── Recherche sons ──────────────────────────────────────────────
  useEffect(() => {
    if (!songSearch.trim()) { setSongResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('songs')
        .select('id,title,artist,cover_url,audio_url')
        .ilike('title', `%${songSearch}%`)
        .eq('is_archived', false)
        .limit(8);
      setSongResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [songSearch]);

  // ── Copier le lien ──────────────────────────────────────────────
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}#/live/${room?.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (chanRef.current) {
        chanRef.current.untrack();
        supabase.removeChannel(chanRef.current);
      }
    };
  }, []);

  // ══════════════════════════════════════════════════════════════
  // RENDER — Lobby
  // ══════════════════════════════════════════════════════════════
  if (phase === 'lobby' || phase === 'creating') {
    return (
      <>
        <Helmet><title>Live Rooms — NovaSound TITAN LUX</title></Helmet>
        <div className="min-h-screen bg-gray-950 flex flex-col">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">

            {/* Hero */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="text-center mb-10">
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

            {/* Créer une salle */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 mb-8">
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
                  className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500"
                />
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isPrivate
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {isPrivate ? 'Privée' : 'Publique'}
                </button>
                <button
                  onClick={createRoom}
                  disabled={!roomName.trim() || creatingRoom || !currentUser}
                  className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg"
                >
                  {creatingRoom ? 'Création...' : 'Créer →'}
                </button>
              </div>
              {!currentUser && (
                <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
                  <span>⚠️</span>
                  <Link to="/login" className="underline">Connecte-toi</Link> pour créer ou rejoindre une salle.
                </p>
              )}
            </motion.div>

            {/* Salles disponibles */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400" />
                Salles en direct
                {!loadingRooms && <span className="text-xs text-gray-500 font-normal">({rooms.length})</span>}
              </h2>

              {loadingRooms ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
                      <div className="h-4 bg-gray-800 rounded w-3/4 mb-3" />
                      <div className="h-3 bg-gray-800 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-2xl">
                  <Radio className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">Aucune salle active pour l'instant.</p>
                  <p className="text-gray-600 text-sm mt-1">Sois le premier à en créer une !</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rooms.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => joinRoom(r.id)}
                      className="bg-gray-900 border border-gray-800 hover:border-cyan-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:bg-gray-800/80 group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                          <h3 className="text-white font-bold group-hover:text-cyan-400 transition-colors">{r.name}</h3>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3.5 h-3.5" />
                          {r.participants_count || 0}/{MAX_PARTICIPANTS}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar user={r.host} size={7} />
                        <div>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-400" />
                            {r.host?.username || 'Anonyme'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-600">
                          {new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-cyan-400 font-medium group-hover:translate-x-0.5 transition-transform">
                          Rejoindre →
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  // Chargement
  if (phase === 'joining') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-medium">Connexion à la salle...</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER — Salle active
  // ══════════════════════════════════════════════════════════════
  return (
    <>
      <Helmet><title>{room?.name || 'Live Room'} — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col pb-24">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={leaveRoom} className="p-2 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-bold text-sm truncate max-w-[160px]">{room?.name}</span>
                {isHost && <Crown className="w-4 h-4 text-amber-400" />}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <Users className="w-4 h-4" />
                <span>{participants.length}</span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copié !' : 'Inviter'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 container mx-auto px-4 py-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">

            {/* ── Colonne gauche: Now Playing + participants ─── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Now Playing Card */}
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {nowPlaying?.cover_url && (
                  <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: `url(${nowPlaying.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px)', transform: 'scale(1.1)' }}
                  />
                )}
                <div className="relative p-5">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-800 mb-4 shadow-xl">
                    {nowPlaying?.cover_url
                      ? <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-16 h-16 text-gray-600" />
                        </div>
                    }
                  </div>
                  {nowPlaying ? (
                    <div className="mb-4">
                      <p className="text-white font-bold truncate">{nowPlaying.title}</p>
                      <p className="text-gray-400 text-sm truncate">{nowPlaying.artist}</p>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="text-gray-500 text-sm text-center">
                        {isHost ? 'Sélectionne un son pour commencer' : "En attente de l'hôte..."}
                      </p>
                    </div>
                  )}

                  {/* Contrôles hôte */}
                  {isHost && (
                    <button
                      onClick={() => setShowPicker(!showPicker)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-400 text-sm font-medium transition-all"
                    >
                      {showPicker ? '← Fermer' : '🎵 Choisir un son'}
                    </button>
                  )}
                </div>

                {/* Burst zone */}
                <div className="relative h-16 overflow-hidden border-t border-gray-800">
                  <EmojiBurst bursts={bursts} />
                  <button
                    onClick={sendBurst}
                    className="absolute inset-0 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-fuchsia-400 transition-colors text-sm"
                  >
                    <Heart className="w-4 h-4" />
                    Réagir
                  </button>
                </div>
              </div>

              {/* Song Picker (hôte) */}
              <AnimatePresence>
                {showPicker && isHost && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                  >
                    <input
                      value={songSearch}
                      onChange={e => setSongSearch(e.target.value)}
                      placeholder="Rechercher un son..."
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500"
                      autoFocus
                    />
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {songResults.map(song => (
                        <button
                          key={song.id}
                          onClick={() => broadcastSong(song)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-800 transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                            {song.cover_url
                              ? <img src={song.cover_url} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-gray-500" /></div>
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{song.title}</p>
                            <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                          </div>
                        </button>
                      ))}
                      {songSearch && songResults.length === 0 && (
                        <p className="text-center text-gray-500 text-sm py-4">Aucun résultat</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Participants */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-cyan-400" />
                  Participants ({participants.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-800 rounded-full pl-1 pr-3 py-1">
                      <Avatar user={p} size={6} crown={p.id === room?.host_id} />
                      <span className="text-xs text-gray-300">{p.username}</span>
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <p className="text-gray-600 text-xs">Personne pour l'instant...</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Colonne droite: Chat ─────────────────────── */}
            <div className="lg:col-span-2 flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ minHeight: 480, maxHeight: 640 }}>
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-fuchsia-400" />
                <span className="text-sm font-bold text-white">Chat Live</span>
              </div>

              {/* Messages */}
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-gray-600 text-sm mt-8">
                    <p>Le chat est vide.</p>
                    <p className="text-xs mt-1">Dis bonjour à tout le monde ! 👋</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = msg.user_id === currentUser?.id;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar user={msg.user} size={7} />
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {!isMe && (
                          <span className="text-[10px] text-gray-500 px-1">{msg.user?.username}</span>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm ${
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
              <div className="p-3 border-t border-gray-800">
                <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
                  <input
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Envoyer un message..."
                    className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
                  />
                  <button
                    onClick={sendBurst}
                    className="text-xl hover:scale-125 transition-transform"
                    title="Réagir"
                  >
                    🎉
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!msgInput.trim()}
                    className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-40 text-white transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LiveRoomPage;
