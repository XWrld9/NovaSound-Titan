import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { db } from '@/lib/supabaseClient';

const SupabaseLikeButton = ({ songId, initialLikes = 0, initialLiked = false }) => {
  const { currentUser } = useSupabaseAuth();
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
        .single();
      
      setIsLiked(!!data);
    } catch (error) {
      setIsLiked(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      alert('Veuillez vous connecter pour aimer une musique');
      return;
    }

    setIsLoading(true);
    try {
      const { action, error } = await db.toggleLike(currentUser.id, songId);
      
      if (error) {
        console.error('Erreur lors du like:', error);
        alert('Une erreur est survenue');
        return;
      }

      if (action === 'liked') {
        setIsLiked(true);
        setLikes(prev => prev + 1);
      } else {
        setIsLiked(false);
        setLikes(prev => prev - 1);
      }
    } catch (error) {
      console.error('Erreur lors du like:', error);
      alert('Une erreur est survenue');
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
          ? 'bg-red-500 text-white hover:bg-red-600' 
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Heart 
        className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} 
      />
      <span className="font-medium">{likes}</span>
    </motion.button>
  );
};

export default SupabaseLikeButton;
