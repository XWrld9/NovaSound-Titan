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
import Header from '@/components/Header';
import {
  Search, Users, Music, Radio, TrendingUp, Clock,
  Filter, ChevronRight, Play, Eye, Zap, Crown,
  Loader2, WifiOff, RefreshCw, Mic, Headphones,
  Sparkles, Flame, Star, Heart
} from 'lucide-react';

const GENRES = [
  { id: 'all', name: 'Tous', color: 'from-cyan-500 to-purple-500' },
  { id: 'electronic', name: 'Electronic', color: 'from-blue-500 to-cyan-500' },
  { id: 'hiphop', name: 'Hip-Hop', color: 'from-purple-500 to-pink-500' },
  { id: 'rock', name: 'Rock', color: 'from-red-500 to-orange-500' },
  { id: 'jazz', name: 'Jazz', color: 'from-amber-500 to-yellow-500' },
  { id: 'pop', name: 'Pop', color: 'from-pink-500 to-rose-500' },
  { id: 'classical', name: 'Classique', color: 'from-indigo-500 to-blue-500' },
  { id: 'world', name: 'World', color: 'from-green-500 to-emerald-500' },
];

const SORT_OPTIONS = [
  { id: 'popular', name: 'Populaire', icon: TrendingUp },
  { id: 'recent', name: 'Récent', icon: Clock },
  { id: 'active', name: 'Actif', icon: Zap },
];

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

  // Charger les salons actifs
  const loadRooms = useCallback(async () => {
    if (!isOnline) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('live_rooms')
        .select(`
          *,
          host:users!live_rooms_host_id_fkey(username, avatar_url),
          live_room_participants(count)
        `)
        .eq('is_active', true)
        .eq('is_public', true)
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
    let filtered = rooms.filter(room => {
      const matchesSearch = !search || 
        room.name?.toLowerCase().includes(search.toLowerCase()) ||
        room.description?.toLowerCase().includes(search.toLowerCase()) ||
        room.host?.username?.toLowerCase().includes(search.toLowerCase());
      
      const matchesGenre = selectedGenre === 'all' || room.genre === selectedGenre;
      
      return matchesSearch && matchesGenre;
    });

    // Trier
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.live_room_participants?.[0]?.count || 0) - (a.live_room_participants?.[0]?.count || 0);
        case 'recent':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'active':
          return (b.listener_count || 0) - (a.listener_count || 0);
        default:
          return 0;
      }
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

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        {/* Header avec glassmorphism */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-gray-900/80 border-b border-white/10">
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
              <Link
                to="/live"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                <Radio className="w-5 h-5" />
                Créer un salon
              </Link>
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
                    className="group relative bg-gray-800/30 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-cyan-500/30 transition-all hover:shadow-xl hover:shadow-cyan-500/10"
                  >
                    {/* Header du salon */}
                    <div className={`h-32 bg-gradient-to-br ${GENRES.find(g => g.id === room.genre)?.color || 'from-gray-600 to-gray-700'} p-4 flex items-end`}>
                      <div className="flex items-center gap-3">
                        {room.host?.avatar_url ? (
                          <img src={room.host.avatar_url} alt="" className="w-12 h-12 rounded-full border-2 border-white/20" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-white font-bold text-lg truncate">{room.name}</h3>
                          <p className="text-white/80 text-sm">par @{room.host?.username}</p>
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
                            <span>{room.live_room_participants?.[0]?.count || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Headphones className="w-4 h-4" />
                            <span>{room.listener_count || 0}</span>
                          </div>
                          {room.genre && (
                            <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs">
                              {GENRES.find(g => g.id === room.genre)?.name || room.genre}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJoinRoom(room.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                        >
                          <Play className="w-4 h-4" />
                          Rejoindre
                        </button>
                        <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-white transition-all">
                          <Heart className="w-4 h-4" />
                        </button>
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
    </>
  );
};

export default LiveListPage;
