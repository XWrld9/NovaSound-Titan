/**
 * LiveRoomsWidget — NovaSound TITAN LUX V50000
 * Widget compact "Salons en direct" pour la HomePage
 * - Fetch des salles actives en temps réel
 * - Compteur participants + barre de capacité
 * - Indicateur pulsant live
 * - Click → /live/:roomId
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { Radio, Users, Music, Headphones, ChevronRight } from 'lucide-react';

const MAX_PARTICIPANTS = 12;

const LiveRoomsWidget = () => {
  const [rooms,   setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('live_rooms')
      .select(`
        id, 
        name, 
        host_id, 
        is_active, 
        is_private, 
        participants_count, 
        current_song_id, 
        created_at, 
        updated_at,
        current_song:songs(id, title, artist)
      `)
      .eq('is_active', true)
      .order('participants_count', { ascending: false })
      .limit(4);
    setRooms(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    const ch = supabase.channel('live_rooms_widget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rooms' }, fetchRooms)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  if (loading) return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {[1,2,3].map(i => (
        <div key={i} className="flex-shrink-0 w-56 h-24 bg-gray-800/60 rounded-2xl animate-pulse border border-red-500/10" />
      ))}
    </div>
  );

  if (!rooms.length) return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900/50 border border-white/[0.05] rounded-2xl">
      <div className="flex items-center gap-3 text-gray-600">
        <Radio className="w-4 h-4" />
        <span className="text-sm">Aucun salon en direct pour l'instant</span>
      </div>
      <Link to="/live" className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors">
        Créer →
      </Link>
    </div>
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {rooms.map((room, i) => {
        const pct = Math.round((room.participant_count || 0) / MAX_PARTICIPANTS * 100);
        return (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Link
              to={`/live/${room.id}`}
              className="flex-shrink-0 w-56 block bg-gray-900/80 border border-red-500/25 rounded-2xl p-3.5 hover:border-red-400/50 hover:bg-gray-900 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">Live</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Users className="w-3 h-3" />
                  <span className="text-[10px] font-bold">{room.participant_count || 0}/{MAX_PARTICIPANTS}</span>
                </div>
              </div>

              {/* Room name */}
              <p className="text-white text-sm font-bold truncate group-hover:text-red-300 transition-colors leading-tight mb-1">
                {room.name}
              </p>

              {/* Current song */}
              {room.current_song?.title ? (
                <div className="flex items-center gap-1.5 mb-2.5">
                  <div className="flex gap-[2px] items-end h-3 flex-shrink-0">
                    {[3,5,4,6,3].map((h,j) => (
                      <div key={j} className="w-[2px] bg-red-400/70 rounded-full animate-pulse"
                        style={{ height: h * 2, animationDelay: `${j * 0.1}s` }} />
                    ))}
                  </div>
                  <p className="text-gray-400 text-[11px] truncate">{room.current_song.title}</p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Music className="w-3 h-3 text-gray-600" />
                  <p className="text-gray-600 text-[11px]">Pas de musique</p>
                </div>
              )}

              {/* Capacity bar */}
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          </motion.div>
        );
      })}

      {/* "Voir tout" card */}
      <Link
        to="/live"
        className="flex-shrink-0 w-32 flex flex-col items-center justify-center gap-2 bg-gray-900/40 border border-white/[0.05] rounded-2xl hover:border-red-500/20 hover:bg-gray-900/60 transition-all group"
      >
        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-all">
          <Radio className="w-4 h-4 text-red-400" />
        </div>
        <span className="text-xs font-semibold text-gray-500 group-hover:text-white transition-colors text-center">
          Voir tout
        </span>
        <ChevronRight className="w-3 h-3 text-gray-700 group-hover:text-red-400 transition-colors" />
      </Link>
    </div>
  );
};

export default LiveRoomsWidget;
