import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const FollowButton = ({ userId, initialFollowers = 0, onFollowChange }) => {
  const { currentUser, supabase } = useAuth();
  const [isFollowing, setIsFollowing]       = useState(false);
  const [followersCount, setFollowersCount] = useState(Math.max(0, initialFollowers));
  const [isLoading, setIsLoading]           = useState(false);
  const countRef                            = useRef(Math.max(0, initialFollowers));

  useEffect(() => {
    if (currentUser && userId && currentUser.id !== userId) {
      loadFollowState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userId]);

  const loadFollowState = async () => {
    try {
      // 1. Vérifier si l'utilisateur courant suit déjà
      const { data: followData } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .maybeSingle();
      setIsFollowing(!!followData);

      // 2. Recompter le vrai nombre d'abonnés depuis la DB
      const { count } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId);

      const real = Math.max(0, count ?? initialFollowers);
      setFollowersCount(real);
      countRef.current = real;
    } catch {
      setIsFollowing(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || currentUser.id === userId || isLoading) return;

    const wasFollowing = isFollowing;
    const newCount     = wasFollowing
      ? Math.max(0, countRef.current - 1)
      : countRef.current + 1;

    // Update optimiste
    setIsFollowing(!wasFollowing);
    setFollowersCount(newCount);
    countRef.current = newCount;
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

      // Resync depuis la DB (source de vérité)
      const { count } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId);

      const verified = Math.max(0, count ?? newCount);
      setFollowersCount(verified);
      countRef.current = verified;

      // Notifier le parent pour resynchroniser sa liste
      if (onFollowChange) onFollowChange(!wasFollowing, verified);

    } catch (error) {
      // Rollback complet
      setIsFollowing(wasFollowing);
      setFollowersCount(countRef.current = Math.max(0, wasFollowing ? newCount + 1 : newCount - 1));
      console.error('Erreur follow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Ne pas afficher si c'est son propre profil
  if (currentUser && currentUser.id === userId) return null;

  return (
    <motion.button
      onClick={handleFollow}
      disabled={isLoading}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all disabled:opacity-60 ${
        isFollowing
          ? 'bg-gray-700 text-white hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40 border border-gray-600'
          : 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-90 shadow-lg shadow-cyan-500/20'
      }`}
      whileHover={{ scale: isLoading ? 1 : 1.03 }}
      whileTap={{ scale: isLoading ? 1 : 0.97 }}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <UserMinus className="w-4 h-4" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      <span>{isFollowing ? 'Ne plus suivre' : 'Suivre'}</span>
      <span className="text-xs opacity-70 ml-1">({followersCount})</span>
    </motion.button>
  );
};

export default FollowButton;
