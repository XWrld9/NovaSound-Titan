/**
 * MoodVote — NovaSound TITAN LUX v4000
 * Vote de mood/vibe crowd-sourcé sur un son
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { notifyOwner } from '@/lib/notifUtils';

const MOODS = [
  { key: 'hype',        emoji: '🔥', label: 'Hype' },
  { key: 'chill',       emoji: '😌', label: 'Chill' },
  { key: 'motivant',    emoji: '💪', label: 'Motivant' },
  { key: 'sad',         emoji: '😢', label: 'Triste' },
  { key: 'amour',       emoji: '❤️', label: 'Amour' },
  { key: 'focus',       emoji: '🎯', label: 'Focus' },
  { key: 'fête',        emoji: '🎉', label: 'Fête' },
  { key: 'nostalgique', emoji: '🌊', label: 'Nostalgie' },
];

const MoodVote = ({ songId }) => {
  const { currentUser } = useAuth();
  const [votes,    setVotes]    = useState({});
  const [myVote,   setMyVote]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!songId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('song_moods').select('mood, user_id').eq('song_id', songId);
      if (cancelled || !data) return;
      const counts = {};
      data.forEach(d => { counts[d.mood] = (counts[d.mood]||0) + 1; });
      setVotes(counts);
      if (currentUser?.id) {
        const mine = data.find(d => d.user_id === currentUser.id || d.user_id === String(currentUser.id));
        setMyVote(mine?.mood || null);
      }
    })();
    return () => { cancelled = true; };
  }, [songId, currentUser?.id]);

  const handleVote = async (mood) => {
    if (!currentUser) return;
    setLoading(true);
    if (myVote === mood) {
      // Retirer le vote
      await supabase.from('song_moods').delete().eq('song_id', songId).eq('user_id', currentUser.id);
      setVotes(v => { const n={...v}; n[mood]=Math.max(0,(n[mood]||1)-1); if(!n[mood]) delete n[mood]; return n; });
      setMyVote(null);
    } else {
      // Mettre à jour ou insérer
      await supabase.from('song_moods').upsert({ song_id: songId, user_id: currentUser.id, mood }, { onConflict: 'song_id,user_id' });
      setVotes(v => {
        const n = {...v};
        if (myVote) { n[myVote]=Math.max(0,(n[myVote]||1)-1); if(!n[myVote]) delete n[myVote]; }
        n[mood]=(n[mood]||0)+1;
        return n;
      });
      setMyVote(mood);
      // Notifier le propriétaire du son
      const moodDef = MOODS.find(m => m.key === mood);
      notifyOwner(supabase, songId, currentUser.id, {
        type:  'mood_vote',
        title: `${moodDef?.emoji || '🎵'} Nouveau vote de vibe`,
        body:  `${currentUser.username || 'Quelqu'un'} a voté "${moodDef?.label || mood}" sur ton son`,
        url:   `/song/${songId}`,
        metadata: { mood, moodEmoji: moodDef?.emoji, refId: songId },
      });
    }
    setLoading(false);
  };

  const totalVotes = Object.values(votes).reduce((a,b)=>a+b, 0);
  const topMood    = Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
  const topMoodDef = topMood ? MOODS.find(m=>m.key===topMood[0]) : null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(v=>!v)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2"
      >
        <span className="font-semibold text-gray-400">Vibe de ce son</span>
        {topMoodDef && (
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-1">
            {topMoodDef.emoji} {topMoodDef.label}
            {totalVotes > 1 && <span className="text-gray-600 ml-0.5">({totalVotes})</span>}
          </span>
        )}
        <span className="text-gray-700">{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {!currentUser && (
              <p className="text-xs text-gray-600 mb-2">Connecte-toi pour voter</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map(m => {
                const count   = votes[m.key] || 0;
                const isVoted = myVote === m.key;
                return (
                  <motion.button
                    key={m.key}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => currentUser && !loading && handleVote(m.key)}
                    disabled={!currentUser || loading}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                      isVoted
                        ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                        : 'border-gray-700/60 bg-white/3 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    } ${!currentUser ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                    {count > 0 && <span className="text-gray-500 font-normal">{count}</span>}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MoodVote;
