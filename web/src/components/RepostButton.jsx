/**
 * RepostButton — NovaSound TITAN LUX v5000
 * Bouton de repartage d'un son (song_reposts).
 * Met à jour reposts_count via trigger DB.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Repeat2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { notifyOwner } from '@/lib/notifUtils';

const RepostButton = ({ song, size = 'md', showCount = true, onRepost = null }) => {
  const { currentUser } = useAuth();
  const [hasReposted, setHasReposted] = useState(false);
  const [count, setCount]             = useState(song?.reposts_count ?? 0);
  const [loading, setLoading]         = useState(false);
  const [burst, setBurst]             = useState(false);

  // Vérifier si l'utilisateur a déjà reposté
  useEffect(() => {
    if (!currentUser?.id || !song?.id) return;
    supabase
      .from('song_reposts')
      .select('id')
      .eq('song_id', song.id)
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => setHasReposted(!!data));
  }, [currentUser?.id, song?.id]);

  // Synchroniser le count avec la prop song
  useEffect(() => {
    setCount(song?.reposts_count ?? 0);
  }, [song?.reposts_count]);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) return;
    if (loading) return;
    setLoading(true);

    try {
      if (hasReposted) {
        // Retirer le repost
        await supabase
          .from('song_reposts')
          .delete()
          .eq('song_id', song.id)
          .eq('user_id', currentUser.id);
        setHasReposted(false);
        setCount(c => Math.max(0, c - 1));
        onRepost?.(false);
      } else {
        // Ajouter le repost
        await supabase
          .from('song_reposts')
          .insert({ song_id: song.id, user_id: currentUser.id });
        setHasReposted(true);
        setCount(c => c + 1);
        setBurst(true);
        setTimeout(() => setBurst(false), 600);
        onRepost?.(true);

        // Notifier le propriétaire du son (non-bloquant)
        notifyOwner(supabase, song.id, currentUser.id, {
          type:     'repost',
          title:    `🔁 ${currentUser.username || 'Quelqu\'un'} a repartagé ton son`,
          body:     `${currentUser.username || 'Quelqu\'un'} a repartagé "${song.title}"`,
          url:      `/song/${song.id}`,
          icon_url: currentUser.avatar_url || '/icon-192.png',
          metadata: { senderId: currentUser.id, senderName: currentUser.username, songId: song.id },
        }).catch(() => {});
      }
    } catch (err) {
      console.error('RepostButton:', err);
    } finally {
      setLoading(false);
    }
  };

  const sizeMap = {
    sm: { icon: 'w-3.5 h-3.5', text: 'text-xs', btn: 'p-1' },
    md: { icon: 'w-4 h-4',   text: 'text-xs', btn: 'p-1.5' },
    lg: { icon: 'w-5 h-5',   text: 'text-sm', btn: 'p-2' },
  };
  const s = sizeMap[size] || sizeMap.md;

  return (
    <motion.button
      onClick={handleClick}
      disabled={loading || !currentUser}
      whileTap={{ scale: 0.88 }}
      title={hasReposted ? 'Annuler le repartage' : 'Repartager ce son'}
      className={`relative flex items-center gap-1.5 rounded-lg transition-all disabled:opacity-40 ${s.btn} ${
        hasReposted
          ? 'text-green-400 hover:text-green-300'
          : 'text-gray-500 hover:text-green-400'
      }`}
    >
      <AnimatePresence>
        {burst && (
          <motion.span
            key="burst"
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full bg-green-400/20 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={burst ? { rotate: [0, -20, 20, 0] } : { rotate: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Repeat2 className={s.icon} strokeWidth={hasReposted ? 2.5 : 1.8} />
      </motion.div>

      {showCount && count > 0 && (
        <span className={`${s.text} font-semibold tabular-nums`}>{count}</span>
      )}
    </motion.button>
  );
};

export default RepostButton;
