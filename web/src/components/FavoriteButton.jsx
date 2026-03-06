import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

/**
 * FavoriteButton — sauvegarde un son dans la collection privée de l'utilisateur.
 * Distinct du LikeButton (❤️ compteur public).
 */
const FavoriteButton = ({ songId, size = 'md', showLabel = false }) => {
  const { currentUser } = useAuth();
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [checked, setChecked]   = useState(false); // chargement initial fait ?

  const load = useCallback(async () => {
    if (!currentUser || !songId) { setChecked(true); return; }
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('song_id', songId)
      .maybeSingle();
    setSaved(!!data);
    setChecked(true);
  }, [currentUser, songId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (!currentUser || loading) return;
    const was = saved;
    setSaved(!was);
    setLoading(true);
    try {
      if (was) {
        await supabase.from('favorites')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('song_id', songId);
      } else {
        await supabase.from('favorites')
          .insert({ user_id: currentUser.id, song_id: songId });
      }
    } catch {
      setSaved(was); // rollback
    } finally {
      setLoading(false);
    }
  };

  if (!checked) return null;

  // Non connecté → bouton inactif avec invite de connexion
  if (!currentUser) {
    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
    const btnClass = size === 'sm' ? 'p-1.5 rounded-lg text-xs' : 'px-3 py-1.5 rounded-xl text-sm';
    return (
      <a
        href="/#/login"
        title="Connecte-toi pour sauvegarder"
        className={`inline-flex items-center gap-1.5 font-medium transition-all ${btnClass} bg-gray-800/50 text-gray-600 border border-gray-700/40 hover:text-purple-300 hover:border-purple-500/40`}
        onClick={e => e.stopPropagation()}
      >
        <Bookmark className={iconSize} />
        {showLabel && <span>Sauvegarder</span>}
      </a>
    );
  }

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnClass = size === 'sm'
    ? 'p-1.5 rounded-lg text-xs'
    : 'px-3 py-1.5 rounded-xl text-sm';

  return (
    <motion.button
      onClick={toggle}
      disabled={loading}
      whileTap={{ scale: 0.88 }}
      title={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={`inline-flex items-center gap-1.5 font-medium transition-all ${btnClass} ${
        saved
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
          : 'bg-gray-800/80 text-gray-400 border border-gray-700/60 hover:text-purple-300 hover:border-purple-500/40'
      }`}
    >
      {saved
        ? <BookmarkCheck className={`${iconSize} fill-current`} />
        : <Bookmark className={iconSize} />
      }
      {showLabel && (
        <span>{saved ? 'Sauvegardé' : 'Sauvegarder'}</span>
      )}
    </motion.button>
  );
};

export default FavoriteButton;
