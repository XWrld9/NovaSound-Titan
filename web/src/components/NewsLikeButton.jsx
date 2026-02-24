import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Lottie from 'lottie-react';
import heartAnimation from '@/animations/heart-animation.json';

const NewsLikeButton = ({ newsId, initialLikes = 0, authorId }) => {
  const { currentUser, supabase } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  // Empêcher de liker sa propre news
  const isOwnNews = currentUser && authorId && currentUser.id === authorId;

  useEffect(() => {
    if (currentUser && newsId && !isOwnNews) {
      checkIfLiked();
    }
  }, [currentUser, newsId]);

  const checkIfLiked = async () => {
    try {
      const { data } = await supabase
        .from('news_likes')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('news_id', newsId)
        .maybeSingle();
      setIsLiked(!!data);
    } catch {
      // Table news_likes peut ne pas exister — fallback silencieux
      setIsLiked(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser || isLoading || isOwnNews) return;

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikes(prev => wasLiked ? prev - 1 : prev + 1);
    if (!wasLiked) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 1000);
    }
    setIsLoading(true);

    try {
      if (wasLiked) {
        await supabase
          .from('news_likes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('news_id', newsId);

        await supabase
          .from('news')
          .update({ likes_count: likes - 1 })
          .eq('id', newsId);
      } else {
        await supabase
          .from('news_likes')
          .insert({ user_id: currentUser.id, news_id: newsId });

        await supabase
          .from('news')
          .update({ likes_count: likes + 1 })
          .eq('id', newsId);
      }
    } catch {
      // Rollback
      setIsLiked(wasLiked);
      setLikes(prev => wasLiked ? prev + 1 : prev - 1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <AnimatePresence>
        {showBurst && (
          <motion.div
            initial={{ opacity: 1, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute pointer-events-none z-10"
            style={{ transform: 'translate(-30%, -30%)', width: '80px', height: '80px' }}
          >
            <Lottie animationData={heartAnimation} loop={false} autoplay={true} />
          </motion.div>
        )}
      </AnimatePresence>

      {isOwnNews ? (
        // Auteur : voit le compteur mais ne peut pas liker
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-gray-500 border border-gray-700/50 cursor-default" title="Vous ne pouvez pas liker votre propre news">
          <Heart className="w-4 h-4" />
          <span>{likes}</span>
        </div>
      ) : (
        <motion.button
          onClick={handleLike}
          disabled={isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            isLiked
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'text-gray-400 hover:text-fuchsia-400 hover:bg-fuchsia-500/10 border border-transparent hover:border-fuchsia-500/30'
          }`}
          title={isLiked ? "Je n'aime plus" : "J'aime"}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-red-400' : ''}`} />
          <span>{likes}</span>
        </motion.button>
      )}
    </div>
  );
};

export default NewsLikeButton;
