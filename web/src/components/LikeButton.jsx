import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LottieAnimation from '@/components/LottieAnimation';
import heartAnimation from '@/animations/heart-animation.json';

const LikeButton = ({ songId, initialLikes = 0, initialLiked = false }) => {
  const { currentUser, supabase } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser && songId) {
      checkIfLiked();
    }
  }, [currentUser, songId]);

  const checkIfLiked = async () => {
    try {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('song_id', songId)
        .maybeSingle();
      
      setIsLiked(!!data);
    } catch {
      setIsLiked(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser) return;
    if (isLoading) return;

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikes(prev => wasLiked ? prev - 1 : prev + 1);
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
    } catch (error) {
      // Rollback on error
      setIsLiked(wasLiked);
      setLikes(prev => wasLiked ? prev + 1 : prev - 1);
      console.error('Erreur like:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
      {isLiked ? (
        <Heart className="w-5 h-5 text-pink-100" />
      ) : (
        <Heart className="w-5 h-5" />
      )}
      <span className="font-medium">{likes}</span>
    </motion.button>
  );
};

export default LikeButton;
