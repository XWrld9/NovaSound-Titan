/**
 * LiveListPage — NovaSound TITAN LUX V600000
 * Page de découverte des salons live actifs
 *
 * V600000 FEATURES:
 * - Glassmorphism design moderne
 * - Liste des salons actifs avec participants
 * - Filtres par genre, popularité
 * - Recherche de salons
 * - Join direct ou preview
 * - Stats en temps réel
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnline } from '@/contexts/OnlineContext';
import { supabase } from '@/lib/supabaseClient';
// eslint-disable-next-line no-unused-vars
import LiveLikeButton from '@/components/LiveLikeButton';
import Header from '@/components/Header';
import {
  Search, Users, Music, Radio, TrendingUp, Clock,
  Filter, ChevronRight, Play, Eye, Zap, Crown,
  Loader2, WifiOff, RefreshCw, Mic, Headphones,
  Sparkles, Flame, Star, Heart, X, Plus, Lock, Globe
} from 'lucide-react';

const GENRES = [
  { id: 'all', name: 'Tous', color: 'from-cyan-500 to-purple-500' },
  // Genres camerounais en premier
  { id: 'bikutsi', name: 'Bikutsi', color: 'from-red-600 to-red-800' },
  { id: 'makossa', name: 'Makossa', color: 'from-yellow-600 to-yellow-800' },
  { id: 'assiko', name: 'Assiko', color: 'from-green-600 to-green-800' },
  { id: 'ambas-bay', name: 'Ambas-Bay', color: 'from-blue-600 to-blue-800' },
  { id: 'benskin', name: 'Benskin', color: 'from-purple-600 to-purple-800' },
  { id: 'mbole', name: 'Mbolé', color: 'from-orange-600 to-orange-800' },
  // Genres africains et mondiaux
  { id: 'afrobeats', name: 'Afrobeats', color: 'from-amber-600 to-amber-800' },
  { id: 'hip-hop', name: 'Hip-Hop', color: 'from-violet-600 to-violet-800' },
  { id: 'r&b', name: 'R&B', color: 'from-pink-600 to-pink-800' },
  { id: 'pop', name: 'Pop', color: 'from-cyan-600 to-cyan-800' },
  { id: 'electronique', name: 'Électronique', color: 'from-emerald-600 to-emerald-800' },
  { id: 'trap', name: 'Trap', color: 'from-red-600 to-red-800' },
  { id: 'gospel', name: 'Gospel', color: 'from-orange-600 to-orange-800' },
  { id: 'jazz', name: 'Jazz', color: 'from-violet-600 to-violet-800' },
  { id: 'reggae', name: 'Reggae', color: 'from-lime-600 to-lime-800' },
  { id: 'dancehall', name: 'Dancehall', color: 'from-yellow-600 to-yellow-800' },
  { id: 'amapiano', name: 'Amapiano', color: 'from-emerald-600 to-emerald-800' },
  { id: 'coupe-decale', name: 'Coupé-Décalé', color: 'from-pink-600 to-pink-800' },
  { id: 'rock', name: 'Rock', color: 'from-orange-600 to-orange-800' },
  { id: 'classique', name: 'Classique', color: 'from-yellow-600 to-yellow-800' },
  { id: 'folk', name: 'Folk', color: 'from-green-600 to-green-800' },
  { id: 'country', name: 'Country', color: 'from-amber-600 to-amber-800' },
  { id: 'latin', name: 'Latin', color: 'from-red-600 to-red-800' },
  { id: 'drill', name: 'Drill', color: 'from-slate-600 to-slate-800' },
  { id: 'outro', name: 'Outro', color: 'from-purple-600 to-purple-800' },
];

const SORT_OPTIONS = [
  { id: 'popular', name: 'Populaire', icon: TrendingUp },
  { id: 'recent', name: 'Récent', icon: Clock },
  { id: 'active', name: 'Actif', icon: Zap },
];

const getGenreColorById = (genreName) => {
  if (!genreName) return 'from-gray-600 to-gray-700';
  const g = GENRES.find(x => x.name === genreName || x.name.toLowerCase() === genreName.toLowerCase());
  return g?.color || 'from-gray-600 to-gray-700';
};

const LiveListPage = () => {
  const { currentUser } = useAuth();
  const { isOnline } = useOnline();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [refreshing, setRefreshing] = useState(false);

  // ── Create Room Modal ──────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', genre: 'Bikutsi', isPrivate: false });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreateRoom = async () => {
    if (!currentUser) { navigate('/login'); return; }
    if (!createForm.name.trim()) { setCreateError('Le nom du salon est requis'); return; }
    setCreating(true); setCreateError('');
    try {
      const { data: existing } = await supabase
        .from('live_rooms').select('id').eq('host_id', currentUser.id).eq('is_active', true).maybeSingle();
      if (existing) {
        navigate(`/live/${existing.id}`); return;
      }
      const { data, error } = await supabase.from('live_rooms').insert({
        title:       createForm.name.trim(),
        description: createForm.description.trim() || null,
        genre:       createForm.genre,
        host_id:     currentUser.id,
        is_active:   true,
        is_live:     true,
        is_private:  createForm.isPrivate,
        participants_count: 1,
      }).select().single();
      if (error) throw error;
      // Rejoindre comme participant hôte
      await supabase.from('live_room_participants').insert({ room_id: data.id, user_id: currentUser.id, is_host: true }).catch(() => {});
      setShowCreateModal(false);
      navigate(`/live/${data.id}`);
    } catch (err) {
      setCreateError(err.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  // Charger les salons actifs
  const loadRooms = useCallback(async () => {
    if (!isOnline) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('live_rooms')
        .select(`
          id, title, description, genre, is_active, is_private,
          host_id, participants_count, created_at, updated_at,
          host:users!host_id(username, avatar_url)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms(data || []);
    } catch (err) {
      console.error('[LiveListPage] Error loading rooms:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Filtrer et trier les salons
  const filteredRooms = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = rooms.filter(room => {
      const matchesSearch = !search ||
        (room.title || '').toLowerCase().includes(q) ||
        (room.description || '').toLowerCase().includes(q) ||
        (room.host?.username || '').toLowerCase().includes(q);
      const matchesGenre = selectedGenre === 'all' || (room.genre || '') === selectedGenre;
      return matchesSearch && matchesGenre;
    });
    return filtered.sort((a, b) => {
      if (sortBy === 'popular') return (b.participants_count || 0) - (a.participants_count || 0);
      if (sortBy === 'recent')  return new Date(b.created_at) - new Date(a.created_at);
      return 0;
    });
  }, [rooms, search, selectedGenre, sortBy]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRooms();
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/live/${roomId}`);
  };

  if (!isOnline) {
    return (
      <>
        <Helmet>
          <title>Live Rooms - NovaSound TITAN LUX</title>
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <WifiOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Hors ligne</h2>
            <p className="text-gray-400">Connectez-vous pour voir les salons live</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Live Rooms - NovaSound TITAN LUX</title>
        <meta name="description" content="Découvrez et rejoignez les salons live actifs sur NovaSound" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a18] to-[#050510]">
        {/* Header avec glassmorphism */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a18]/95 backdrop-blur-xl border-b border-white/[0.07]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                  ← Accueil
                </Link>
                <div className="flex items-center gap-2">
                  <Radio className="w-6 h-6 text-cyan-400" />
                  <h1 className="text-2xl font-bold text-white">Live Rooms</h1>
                </div>
              </div>
              
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              {currentUser && (
                <button
                  onClick={() => { setCreateForm({ name: '', description: '', genre: 'Bikutsi', isPrivate: false }); setCreateError(''); setShowCreateModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:opacity-90 rounded-xl text-white font-semibold transition-all shadow-lg shadow-cyan-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Créer un salon
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtres et recherche */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Barre de recherche */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un salon, un artiste..."
              className="w-full pl-12 pr-4 py-4 bg-gray-800/50 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-800/70 transition-all"
            />
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap gap-4 mb-6">
            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(genre.id)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    selectedGenre === genre.id
                      ? `bg-gradient-to-r ${genre.color} text-white shadow-lg`
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 hover:text-white'
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>

            {/* Tri */}
            <div className="flex gap-2 ml-auto">
              {SORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSortBy(option.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                      sortBy === option.id
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {option.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Liste des salons */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-20">
              <Radio className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Aucun salon actif</h3>
              <p className="text-gray-400 mb-6">
                {search || selectedGenre !== 'all' 
                  ? 'Essayez de modifier vos filtres'
                  : 'Soyez le premier à créer un salon live !'
                }
              </p>
              <button
                onClick={() => { if (!currentUser) { navigate('/login'); return; } setCreateForm({ name: '', description: '', genre: 'Bikutsi', isPrivate: false }); setCreateError(''); setShowCreateModal(true); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                <Radio className="w-5 h-5" />
                Créer un salon
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredRooms.map((room) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[#0a0a18]/80 backdrop-blur-xl rounded-2xl border border-white/[0.07] p-6 hover:border-white/[0.12] transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                  >
                    {/* Header du salon */}
                    <div className={`h-32 rounded-t-2xl bg-gradient-to-br ${getGenreColorById(room.genre)} p-4 flex items-end`}>
                      <div className="flex items-center gap-3">
                        {room.host?.avatar_url ? (
                          <img src={room.host.avatar_url} alt="" className="w-12 h-12 rounded-full border-2 border-white/20" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-white font-bold text-lg truncate">{room.title || room.name}</h3>
                          <p className="text-white/80 text-sm">par @{room.host?.username}</p>
                        </div>
                        <div className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                          <span className="text-green-400 text-xs font-medium">🌐 Publique</span>
                        </div>
                        {room.is_host_live && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-red-500 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-white text-xs font-medium">LIVE</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contenu */}
                    <div className="p-4">
                      <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                        {room.description || 'Rejoignez ce salon live pour découvrir de la musique incroyable !'}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{room.participants_count || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Headphones className="w-4 h-4" />
                            <span>{room.listener_count || 0}</span>
                          </div>
                          {room.genre && (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getGenreColorById(room.genre)} text-white`}>
                              {room.genre}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJoinRoom(room.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/90 to-purple-500/90 hover:from-cyan-500 hover:to-purple-500 text-white font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/30"
                        >
                          <Play className="w-4 h-4" />
                          Rejoindre
                        </button>
                        <LiveLikeButton 
                          roomId={room.id}
                          initialLikes={room.likes_count || 0}
                          roomTitle={room.title}
                          hostId={room.host_id}
                          compact={true}
                        />
                      </div>
                    </div>

                    {/* Badge genre */}
                    {room.is_featured && (
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full">
                          <Star className="w-3 h-3 text-amber-400" />
                          <span className="text-amber-400 text-xs font-medium">Featured</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Créer un salon ────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0d0d1f] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-400" /> Créer un salon live
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{createError}</div>
              )}

              <div className="space-y-4">
                {/* Nom */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom du salon <span className="text-red-400">*</span></label>
                  <input type="text" value={createForm.name} maxLength={60} placeholder="Ex: Soirée Bikutsi 🔥"
                    onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-800/60 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description <span className="text-gray-500 text-xs">(optionnel)</span></label>
                  <textarea value={createForm.description} maxLength={200} rows={3} placeholder="Décris l'ambiance de ton salon..."
                    onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-800/60 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all resize-none" />
                </div>

                {/* Genre */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Genre musical</label>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                    {GENRES.filter(g => g.id !== 'all').map(g => (
                      <button key={g.id} onClick={() => setCreateForm(p => ({ ...p, genre: g.name }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${createForm.genre === g.name ? `bg-gradient-to-r ${g.color} text-white shadow-md` : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-white'}`}>
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visibilité */}
                <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    {createForm.isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-green-400" />}
                    <div>
                      <p className="text-sm font-medium text-white">{createForm.isPrivate ? 'Salon privé' : 'Salon public'}</p>
                      <p className="text-xs text-gray-500">{createForm.isPrivate ? 'Accessible sur invitation' : 'Visible par tous'}</p>
                    </div>
                  </div>
                  <button onClick={() => setCreateForm(p => ({ ...p, isPrivate: !p.isPrivate }))}
                    className={`relative w-12 h-6 rounded-full transition-all ${createForm.isPrivate ? 'bg-amber-500' : 'bg-cyan-500'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${createForm.isPrivate ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreateModal(false)} disabled={creating}
                  className="flex-1 px-4 py-3 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={handleCreateRoom} disabled={creating || !createForm.name.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  {creating ? 'Création...' : 'Lancer le salon'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveListPage;
