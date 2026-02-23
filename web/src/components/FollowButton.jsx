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
        .maybeSingle();
      setIsFollowing(!!data);
    } catch {
      setIsFollowing(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || currentUser.id === userId || isLoading) return;

    // Optimistic update
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount(prev => wasFollowing ? prev - 1 : prev + 1);
    setIsLoading(true);

    try {
      if (wasFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUser.id, following_id: userId });
        if (error) throw error;
      }
    } catch (error) {
      // Rollback
      setIsFollowing(wasFollowing);
      setFollowersCount(prev => wasFollowing ? prev + 1 : prev - 1);
      console.error('Erreur follow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (currentUser && currentUser.id === userId) return null;

  return (
    <motion.button
      onClick={handleFollow}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all disabled:opacity-60 ${
        isFollowing
          ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600'
          : 'bg-gradient-to-r from-cyan-500 to-magenta-500 text-white hover:opacity-90'
      }`}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      {isFollowing ? (
        <><UserMinus className="w-4 h-4" /><span>Ne plus suivre</span></>
      ) : (
        <><UserPlus className="w-4 h-4" /><span>Suivre</span></>
      )}
      {followersCount > 0 && (
        <span className="text-xs opacity-75">({followersCount})</span>
      )}
    </motion.button>
  );
};

export default FollowButton;
