import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Lottie from 'lottie-react';
import heartAnimation from '@/animations/heart-animation.json';

const LikeButton = ({ songId, initialLikes = 0, initialLiked = false }) => {
  const { currentUser, supabase } = useAuth();
  const [likes, setLikes]       = useState(initialLikes);
  const [isLiked, setIsLiked]   = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const channelRef              = useRef(null);

  // ─── Charger l'état liked + vrai compteur depuis DB ───
  const loadLikesData = useCallback(async () => {
    if (!songId) return;
    try {
      // Vrai compteur depuis les lignes (source de vérité)
      const { count } = await supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('song_id', songId);

      if (count !== null) setLikes(count);

      // État liked pour l'utilisateur courant
      if (currentUser) {
        const { data } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('song_id', songId)
          .maybeSingle();
        setIsLiked(!!data);
      }
    } catch {
      // silencieux
    }
  }, [songId, currentUser, supabase]);

  // ─── Chargement initial ───
  useEffect(() => {
    loadLikesData();
  }, [loadLikesData]);

  // ─── Supabase Realtime — écoute INSERT/DELETE sur likes ───
  useEffect(() => {
    if (!songId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`likes:${songId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `song_id=eq.${songId}`,
        },
        () => {
          // Recompter depuis la DB à chaque changement
          loadLikesData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [songId, supabase, loadLikesData]);

  // ─── Action like / unlike ───
  const handleLike = async () => {
    if (!currentUser || isLoading) return;

    const wasLiked = isLiked;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikes(prev => Math.max(0, wasLiked ? prev - 1 : prev + 1));

    if (!wasLiked) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 1000);
    }
    setIsLoading(true);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('song_id', songId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: currentUser.id, song_id: songId });
        if (error) throw error;
      }
      // Le Realtime déclenchera loadLikesData() automatiquement
    } catch (error) {
      // Rollback
      setIsLiked(wasLiked);
      setLikes(prev => Math.max(0, wasLiked ? prev + 1 : prev - 1));
      console.error('Erreur like:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <AnimatePresence>
        {showBurst && (
          <motion.div
            initial={{ opacity: 1, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            style={{ transform: 'translate(-30%, -30%)', width: '160%', height: '160%' }}
          >
            <Lottie
              animationData={heartAnimation}
              loop={false}
              autoplay={true}
              style={{ width: 80, height: 80 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleLike}
        disabled={isLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
          isLiked
            ? 'bg-red-500 text-pink-100 hover:bg-red-600'
            : 'bg-gray-800 text-cyan-400 hover:bg-gray-700 border border-cyan-500/30'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Heart className={`w-5 h-5 ${isLiked ? 'text-pink-100 fill-current' : ''}`} />
        <span className="font-medium">{likes}</span>
      </motion.button>
    </div>
  );
};

export default LikeButton;
