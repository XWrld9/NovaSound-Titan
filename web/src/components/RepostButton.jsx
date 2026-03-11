/**
 * RepostButton — NovaSound V27000
 * ✅ Toast cliquable → profil onglet Repartagés
 * ✅ Check icon quand actif
 * ✅ Tooltip natif amélioré
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Repeat2, Check, UserCircle2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { notifyOwner } from '@/lib/notifUtils';

const RepostButton = ({ song, size = 'md', showCount = true, onRepost = null }) => {
  const { currentUser } = useAuth();
  const [hasReposted, setHasReposted] = useState(false);
  const [count, setCount]             = useState(song?.reposts_count ?? 0);
  const [loading, setLoading]         = useState(false);
  const [burst, setBurst]             = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => {
    if (!currentUser?.id || !song?.id) return;
    supabase.from('song_reposts').select('id').eq('song_id', song.id).eq('user_id', currentUser.id)
      .maybeSingle().then(({ data }) => setHasReposted(!!data));
  }, [currentUser?.id, song?.id]);

  useEffect(() => { setCount(song?.reposts_count ?? 0); }, [song?.reposts_count]);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const handleClick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!currentUser || loading) return;
    setLoading(true);
    try {
      if (hasReposted) {
        await supabase.from('song_reposts').delete().eq('song_id', song.id).eq('user_id', currentUser.id);
        setHasReposted(false); setCount(c => Math.max(0, c - 1));
        setShowConfirm(false); onRepost?.(false);
      } else {
        await supabase.from('song_reposts').insert({ song_id: song.id, user_id: currentUser.id });
        setHasReposted(true); setCount(c => c + 1);
        setBurst(true); setTimeout(() => setBurst(false), 600);
        onRepost?.(true);
        setShowConfirm(true);
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => setShowConfirm(false), 3200);
        notifyOwner(supabase, song.id, currentUser.id, {
          type: 'repost',
          title: `🔁 ${currentUser.username || 'Quelqu\'un'} a repartagé ton son`,
          body: `${currentUser.username || 'Quelqu\'un'} a repartagé "${song.title}"`,
          url: `/song/${song.id}`, icon_url: currentUser.avatar_url || '/icon-192.png',
          from_user_id: currentUser.id,
          metadata: { senderId: currentUser.id, senderName: currentUser.username, songId: song.id },
        }).catch(() => {});
      }
    } catch (err) { console.error('RepostButton:', err); }
    finally { setLoading(false); }
  };

  const sizeMap = {
    sm: { icon: 'w-3.5 h-3.5', text: 'text-xs', btn: 'p-1' },
    md: { icon: 'w-4 h-4',     text: 'text-xs', btn: 'p-1.5' },
    lg: { icon: 'w-5 h-5',     text: 'text-sm', btn: 'p-2' },
  };
  const s = sizeMap[size] || sizeMap.md;

  return (
    <div className="relative">
      <AnimatePresence>
        {showConfirm && (
          <motion.div key="toast" initial={{ opacity: 0, y: 6, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.92 }} transition={{ duration: 0.2 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
            <Link to="/profile?tab=reposts" onClick={() => setShowConfirm(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[11px] font-semibold whitespace-nowrap shadow-xl hover:brightness-110 transition-all"
              style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid rgba(74,222,128,0.3)' }}>
              <UserCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
              <span>Sur ton profil · onglet Repartagés</span>
              <ExternalLink className="w-2.5 h-2.5 text-green-400 opacity-70 flex-shrink-0" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button onClick={handleClick} disabled={loading || !currentUser} whileTap={{ scale: 0.88 }}
        title={hasReposted ? 'Retirer de mon profil (onglet Repartagés)' : 'Repartager → apparaît dans ton onglet "Repartagés"'}
        className={`relative flex items-center gap-1.5 rounded-lg transition-all disabled:opacity-40 ${s.btn} ${
          hasReposted ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-green-400'
        }`}>
        <AnimatePresence>
          {burst && (
            <motion.span key="burst" initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-green-400/20 pointer-events-none" />
          )}
        </AnimatePresence>
        <motion.div animate={burst ? { rotate: [0, -20, 20, 0] } : { rotate: 0 }} transition={{ duration: 0.4 }}>
          {hasReposted
            ? <Check className={`${s.icon} text-green-400`} strokeWidth={2.5} />
            : <Repeat2 className={s.icon} strokeWidth={1.8} />}
        </motion.div>
        {showCount && count > 0 && <span className={`${s.text} font-semibold tabular-nums`}>{count}</span>}
      </motion.button>
    </div>
  );
};

export default RepostButton;
