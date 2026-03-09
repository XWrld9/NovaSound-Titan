import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Lottie from 'lottie-react';
import heartAnimation from '@/animations/heart-animation.json';
import { supabase } from '@/lib/supabaseClient';
import { notifyUser } from '@/lib/notifUtils';

const LiveLikeButton = ({ roomId, initialLikes = 0, initialLiked = false, compact = false, roomTitle = '', hostId = '' }) => {
  const { currentUser } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const channelRef = useRef(null);

  // Charger l'état liked + compteur depuis DB
  const loadLikesData = useCallback(async () => {
    if (!roomId || !currentUser) return;
    try {
      const { count } = await supabase
        .from('live_room_likes')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);
      if (count !== null) setLikes(count);

      const { data } = await supabase
        .from('live_room_likes')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('room_id', roomId)
        .maybeSingle();
      setIsLiked(!!data);
    } catch { /* silencieux */ }
  }, [roomId, currentUser]);

  useEffect(() => { loadLikesData(); }, [loadLikesData]);

  // Realtime
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`live_room_likes:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_room_likes', filter: `room_id=eq.${roomId}` },
        () => { loadLikesData(); })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [roomId, loadLikesData]);

  // Action like / unlike
  const handleLike = async () => {
    if (!currentUser || isLoading || !roomId) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikes(prev => Math.max(0, wasLiked ? prev - 1 : prev + 1));
    if (!wasLiked) { setShowBurst(true); setTimeout(() => setShowBurst(false), 1000); }
    setIsLoading(true);
    try {
      if (wasLiked) {
        const { error } = await supabase.from('live_room_likes').delete()
          .eq('user_id', currentUser.id).eq('room_id', roomId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('live_room_likes')
          .insert({ user_id: currentUser.id, room_id: roomId });
        if (error) throw error;

        // Notifier l'hôte via notifyUser (insère en DB + déclenche push)
        if (hostId && hostId !== currentUser.id) {
          notifyUser(supabase, hostId, {
            type:     'live_like',
            title:    `❤️ ${currentUser.username || 'Quelqu\'un'} a aimé ton live`,
            body:     `${currentUser.username || 'Quelqu\'un'} a liké "${roomTitle || 'ton salon live'}"`,
            url:      `/live/${roomId}`,
            icon_url: currentUser.avatar_url || '/icon-192.png',
            metadata: { roomId, likerId: currentUser.id, likerName: currentUser.username },
          }).catch(() => {});
        }
      }
    } catch (error) {
      setIsLiked(wasLiked);
      setLikes(prev => Math.max(0, wasLiked ? prev + 1 : prev - 1));
      console.error('Erreur like live room:', error);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="relative inline-flex">
      <AnimatePresence>
        {showBurst && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1.2, y: -20 }}
            exit={{ opacity: 0, scale: 0.8, y: -40 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 pointer-events-none"
          >
            <Lottie 
              animationData={heartAnimation} 
              style={{ width: 60, height: 60 }}
              loop={false}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleLike}
        disabled={!currentUser || isLoading || !roomId}
        className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
          isLiked
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-red-500/30 hover:text-red-400'
        } ${compact ? 'px-2 py-2' : ''}`}
      >
        <div className="relative">
          <Heart 
            className={`w-4 h-4 transition-all ${
              isLiked ? 'fill-current text-red-400' : ''
            } ${isLoading ? 'animate-pulse' : ''}`}
          />
          {isLiked && (
            <motion.div
              className="absolute inset-0 bg-red-400 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 0] }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
        </div>
        
        {!compact && (
          <span className="text-sm font-medium">
            {likes > 0 ? likes : ''}
          </span>
        )}

        {!currentUser && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Connecte-toi pour liker
          </div>
        )}
      </button>
    </div>
  );
};

export default LiveLikeButton;
