import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';

const LikeButton = ({ songId, initialLikes = 0, initialLiked = false }) => {
  const { currentUser } = useAuth();
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
      const existingLike = await pb.collection('likes').getFirstListItem(
        `user = "${currentUser.id}" && song = "${songId}"`
      );
      setIsLiked(true);
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
      if (isLiked) {
        // Unlike
        const existingLike = await pb.collection('likes').getFirstListItem(
          `user = "${currentUser.id}" && song = "${songId}"`
        );
        await pb.collection('likes').delete(existingLike.id);
        setIsLiked(false);
        setLikes(prev => prev - 1);
      } else {
        // Like
        await pb.collection('likes').create({
          user: currentUser.id,
          song: songId
        });
        setIsLiked(true);
        setLikes(prev => prev + 1);
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

export default LikeButton;
