import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const FollowButton = ({ userId, initialFollowing = false, initialFollowers = 0 }) => {
  const { currentUser, supabase } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowers);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser && userId && currentUser.id !== userId) {
      checkIfFollowing();
    }
  }, [currentUser, userId]);

  const checkIfFollowing = async () => {
    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .single();
      
      setIsFollowing(!!data);
    } catch (error) {
      setIsFollowing(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      alert('Veuillez vous connecter pour suivre un artiste');
      return;
    }

    if (currentUser.id === userId) {
      return; // Ne peut pas se suivre soi-même
    }

    setIsLoading(true);
    try {
      // Vérifier si déjà follow
      const { data: existingFollow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .single();

      if (existingFollow) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId);
        
        if (error) throw error;
        
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
      } else {
        // Follow
        const { data, error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: userId
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Erreur lors du follow:', error);
      alert('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  // Ne pas afficher le bouton si c'est le profil de l'utilisateur connecté
  if (currentUser && currentUser.id === userId) {
    return null;
  }

  return (
    <motion.button
      onClick={handleFollow}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
        isFollowing 
          ? 'bg-gray-500 text-white hover:bg-gray-600' 
          : 'bg-blue-500 text-white hover:bg-blue-600'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {isFollowing ? (
        <>
          <UserMinus className="w-5 h-5" />
          <span className="font-medium">Ne plus suivre</span>
        </>
      ) : (
        <>
          <UserPlus className="w-5 h-5" />
          <span className="font-medium">Suivre</span>
        </>
      )}
      <span className="text-sm">({followersCount})</span>
    </motion.button>
  );
};

export default FollowButton;
