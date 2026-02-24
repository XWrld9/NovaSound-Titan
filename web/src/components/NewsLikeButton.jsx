import React, { useState, useEffect, useRef } from 'react';
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
  const likesRef = useRef(initialLikes); // Référence toujours à jour pour éviter les closures stale

  const isOwnNews = currentUser && authorId && currentUser.id === authorId;

  // Charger le vrai compteur + état liked depuis la DB
  // Y compris pour l'auteur (pour voir les likes des autres)
  useEffect(() => {
    if (!newsId) return;
    loadLikesData();
  }, [currentUser, newsId]);

  const loadLikesData = async () => {
    try {
      // 1. Compter les vrais likes dans la DB
      const { count } = await supabase
        .from('news_likes')
        .select('id', { count: 'exact', head: true })
        .eq('news_id', newsId);

      const realCount = count ?? initialLikes;
      setLikes(realCount);
      likesRef.current = realCount;

      // 2. Vérifier si l'utilisateur connecté a liké (sauf auteur)
      if (currentUser && !isOwnNews) {
        const { data } = await supabase
          .from('news_likes')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('news_id', newsId)
          .maybeSingle();
        setIsLiked(!!data);
      }
    } catch {
      // Table pas encore créée — fallback silencieux
    }
  };

  const handleLike = async () => {
    if (!currentUser || isLoading || isOwnNews) return;

    const wasLiked = isLiked;
    const newLikes = wasLiked ? likesRef.current - 1 : likesRef.current + 1;

    // Update optimiste immédiat
    setIsLiked(!wasLiked);
    setLikes(newLikes);
    likesRef.current = newLikes;

    if (!wasLiked) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 1000);
    }
    setIsLoading(true);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('news_likes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('news_id', newsId);
        if (error) throw error;

        // Décrémenter dans news
        await supabase.rpc('decrement_news_likes', { news_id_param: newsId })
          .then(({ error: rpcErr }) => {
            if (rpcErr) {
              // Fallback manuel si la fonction RPC n'existe pas
              return supabase
                .from('news')
                .update({ likes_count: newLikes })
                .eq('id', newsId);
            }
          });
      } else {
        const { error } = await supabase
          .from('news_likes')
          .insert({ user_id: currentUser.id, news_id: newsId });
        if (error) throw error;

        // Incrémenter dans news
        await supabase.rpc('increment_news_likes', { news_id_param: newsId })
          .then(({ error: rpcErr }) => {
            if (rpcErr) {
              return supabase
                .from('news')
                .update({ likes_count: newLikes })
                .eq('id', newsId);
            }
          });
      }

      // Recharger le vrai compteur depuis la DB après l'opération
      const { count } = await supabase
        .from('news_likes')
        .select('id', { count: 'exact', head: true })
        .eq('news_id', newsId);

      if (count !== null) {
        setLikes(count);
        likesRef.current = count;
      }
    } catch {
      // Rollback
      setIsLiked(wasLiked);
      setLikes(likesRef.current = wasLiked ? newLikes + 1 : newLikes - 1);
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
        // Auteur : voit le vrai compteur en lecture seule
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-gray-700/50 cursor-default"
          style={{ color: likes > 0 ? '#f472b6' : '#6b7280' }}
          title="Compteur de likes de votre news"
        >
          <Heart className={`w-4 h-4 ${likes > 0 ? 'fill-current text-pink-400' : ''}`} />
          <span>{likes}</span>
        </div>
      ) : (
        <motion.button
          onClick={handleLike}
          disabled={isLoading || !currentUser}
          whileHover={currentUser ? { scale: 1.05 } : {}}
          whileTap={currentUser ? { scale: 0.95 } : {}}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            !currentUser
              ? 'text-gray-600 cursor-default border border-transparent'
              : isLiked
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'text-gray-400 hover:text-fuchsia-400 hover:bg-fuchsia-500/10 border border-transparent hover:border-fuchsia-500/30'
          }`}
          title={!currentUser ? 'Connectez-vous pour liker' : isLiked ? "Je n'aime plus" : "J'aime"}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-red-400' : ''}`} />
          <span>{likes}</span>
        </motion.button>
      )}
    </div>
  );
};

export default NewsLikeButton;
