import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Lottie from 'lottie-react';
import heartAnimation from '@/animations/heart-animation.json';

const NewsLikeButton = ({ newsId, initialLikes = 0, authorId }) => {
  const { currentUser, supabase } = useAuth();
  const [likes, setLikes]         = useState(initialLikes);
  const [isLiked, setIsLiked]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const likesRef                  = useRef(initialLikes);
  const channelRef                = useRef(null);

  const isOwnNews = currentUser && authorId && currentUser.id === authorId;

  // ─── Charger le vrai compteur + état liked depuis la DB ───
  const loadLikesData = useCallback(async () => {
    if (!newsId) return;
    try {
      const { count } = await supabase
        .from('news_likes')
        .select('id', { count: 'exact', head: true })
        .eq('news_id', newsId);

      const real = count ?? initialLikes;
      setLikes(real);
      likesRef.current = real;

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
      // table absente — fallback silencieux
    }
  }, [newsId, currentUser, isOwnNews, supabase, initialLikes]);

  // ─── Chargement initial ───
  useEffect(() => {
    loadLikesData();
  }, [loadLikesData]);

  // ─── Supabase Realtime — écoute INSERT/DELETE sur news_likes ───
  useEffect(() => {
    if (!newsId) return;

    // Nettoyer un canal précédent si newsId change
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`news_likes:${newsId}`)
      .on(
        'postgres_changes',
        {
          event: '*',             // INSERT ou DELETE
          schema: 'public',
          table: 'news_likes',
          filter: `news_id=eq.${newsId}`,
        },
        () => {
          // Recompter depuis la DB à chaque changement (source de vérité)
          loadLikesData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup au démontage
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [newsId, supabase, loadLikesData]);

  // ─── Action like / unlike ───
  const handleLike = async () => {
    if (!currentUser || isLoading || isOwnNews) return;

    const wasLiked = isLiked;
    const newLikes = wasLiked
      ? Math.max(0, likesRef.current - 1)
      : likesRef.current + 1;

    // Optimistic update
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
      } else {
        const { error } = await supabase
          .from('news_likes')
          .insert({ user_id: currentUser.id, news_id: newsId });
        if (error) throw error;
      }
      // Le Realtime déclenchera loadLikesData() automatiquement
      // On resync quand même localement pour l'utilisateur courant
      await loadLikesData();
    } catch {
      // Rollback
      setIsLiked(wasLiked);
      const rollback = wasLiked ? newLikes + 1 : Math.max(0, newLikes - 1);
      setLikes(rollback);
      likesRef.current = rollback;
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
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-gray-700/50 cursor-default"
          title="Compteur de likes de votre news"
          style={{ color: likes > 0 ? '#f472b6' : '#6b7280' }}
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
