import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus } from 'lucide-react';
import { motion } from 'framer-motion';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';

const FollowButton = ({ userId, initialFollowers = 0, initialFollowing = false }) => {
  const { currentUser } = useAuth();
  const [followers, setFollowers] = useState(initialFollowers);
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser && userId && currentUser.id !== userId) {
      checkIfFollowing();
    }
  }, [currentUser, userId]);

  const checkIfFollowing = async () => {
    try {
      const existingFollow = await pb.collection('follows').getFirstListItem(
        `follower = "${currentUser.id}" && following = "${userId}"`
      );
      setIsFollowing(true);
    } catch (error) {
      setIsFollowing(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      alert('Veuillez vous connecter pour suivre un utilisateur');
      return;
    }

    if (currentUser.id === userId) {
      alert('Vous ne pouvez pas vous suivre vous-même');
      return;
    }

    setIsLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const existingFollow = await pb.collection('follows').getFirstListItem(
          `follower = "${currentUser.id}" && following = "${userId}"`
        );
        await pb.collection('follows').delete(existingFollow.id);
        setIsFollowing(false);
        setFollowers(prev => prev - 1);
      } else {
        // Follow
        await pb.collection('follows').create({
          follower: currentUser.id,
          following: userId
        });
        setIsFollowing(true);
        setFollowers(prev => prev + 1);
      }
    } catch (error) {
      console.error('Erreur lors du follow:', error);
      alert('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  // Ne pas afficher le bouton si c'est le profil de l'utilisateur connecté
  if (currentUser?.id === userId) {
    return null;
  }

  return (
    <motion.button
      onClick={handleFollow}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
        isFollowing 
          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
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
      <span className="text-sm opacity-75">({followers})</span>
    </motion.button>
  );
};

export default FollowButton;
