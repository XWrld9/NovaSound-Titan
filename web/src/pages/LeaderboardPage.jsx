/**
 * LeaderboardPage — NovaSound TITAN LUX v5000
 * Classement communautaire gamifié :
 * - Top artistes (écoutes, followers, likes)
 * - Top auditeurs (streaks, heures d'écoute, commentaires)
 * - Top sons de la semaine
 * - Badges & niveaux
 * - Animations podium
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import { formatPlays } from '@/lib/utils';
import {
  Trophy, Flame, Crown, Star, Zap, Music, Users, Heart,
  Headphones, TrendingUp, Award, ChevronRight, Play
} from 'lucide-react';

// ── Badges par niveau ──────────────────────────────────────────────
const BADGES = [
  { min: 0,      label: 'Auditeur',    color: '#6b7280', icon: '🎧', bg: 'from-gray-600 to-gray-700' },
  { min: 100,    label: 'Mélomane',    color: '#06b6d4', icon: '🎵', bg: 'from-cyan-500 to-blue-600' },
  { min: 500,    label: 'Passionné',   color: '#8b5cf6', icon: '🔥', bg: 'from-purple-500 to-violet-600' },
  { min: 2000,   label: 'Légende',     color: '#f59e0b', icon: '👑', bg: 'from-amber-400 to-orange-500' },
  { min: 10000,  label: 'TITAN',       color: '#ec4899', icon: '⚡', bg: 'from-pink-500 to-fuchsia-600' },
];

const getBadge = (score) => {
  let badge = BADGES[0];
  for (const b of BADGES) { if (score >= b.min) badge = b; }
  return badge;
};

// ── Podium ─────────────────────────────────────────────────────────
const PodiumBar = ({ user, rank, score, label }) => {
  const heights = { 1: 'h-28 md:h-36', 2: 'h-20 md:h-28', 3: 'h-14 md:h-20' };
  const badge = getBadge(score);
  const order = rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3';
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.12, type: 'spring', stiffness: 200 }}
      className={`flex flex-col items-center gap-2 ${order}`}
    >
      <div className="relative">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-xl">
          {user.avatar_url
            ? <img src={user.avatar_url} className="w-full h-full object-cover" />
            : <div className={`w-full h-full bg-gradient-to-br ${badge.bg} flex items-center justify-center text-white font-bold text-lg`}>
                {(user.username || '?').slice(0, 2).toUpperCase()}
              </div>
          }
        </div>
        <span className="absolute -top-2 -right-2 text-lg">{medals[rank]}</span>
      </div>
      <p className="text-white text-xs font-bold text-center truncate max-w-[80px]">{user.username}</p>
      <p className="text-xs font-semibold" style={{ color: badge.color }}>{badge.icon} {badge.label}</p>
      <div className={`w-16 md:w-20 ${heights[rank]} rounded-t-xl bg-gradient-to-t ${badge.bg} opacity-70 flex items-end justify-center pb-2`}>
        <span className="text-white text-xs font-black">{formatPlays(score)}</span>
      </div>
    </motion.div>
  );
};

// ── Ligne classement ───────────────────────────────────────────────
const RankRow = ({ item, rank, scoreKey, labelKey = 'username', linkPrefix = '/artist', secondLabel = null, onPlay = null }) => {
  const badge = getBadge(item[scoreKey] || 0);
  const isTop3 = rank <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={`flex items-center gap-4 p-3 rounded-xl transition-all group ${
        isTop3
          ? 'bg-gradient-to-r from-white/5 to-transparent border border-white/10'
          : 'hover:bg-gray-800/60'
      }`}
    >
      {/* Rang */}
      <div className="w-8 text-center flex-shrink-0">
        {rank === 1 ? <span className="text-xl">🥇</span>
        : rank === 2 ? <span className="text-xl">🥈</span>
        : rank === 3 ? <span className="text-xl">🥉</span>
        : <span className="text-sm font-bold text-gray-500 tabular-nums">{rank}</span>
        }
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
        {item.avatar_url || item.cover_url
          ? <img src={item.avatar_url || item.cover_url} className="w-full h-full object-cover" />
          : <div className={`w-full h-full bg-gradient-to-br ${badge.bg} flex items-center justify-center text-white text-sm font-bold`}>
              {(item[labelKey] || '?').slice(0, 2).toUpperCase()}
            </div>
        }
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <Link to={`${linkPrefix}/${item.id}`} className="text-white font-semibold text-sm hover:text-cyan-400 transition-colors truncate block">
          {item[labelKey]}
        </Link>
        {secondLabel && (
          <p className="text-gray-500 text-xs truncate">{item[secondLabel]}</p>
        )}
      </div>

      {/* Badge */}
      <span className="text-xs font-medium flex-shrink-0 hidden sm:block" style={{ color: badge.color }}>
        {badge.icon}
      </span>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <p className="text-white text-sm font-bold tabular-nums">{formatPlays(item[scoreKey] || 0)}</p>
      </div>

      {onPlay && (
        <button
          onClick={() => onPlay(item)}
          className="p-1.5 rounded-full bg-white/10 hover:bg-cyan-500/20 text-gray-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
      )}
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════
const LeaderboardPage = () => {
  const { currentUser } = useAuth();
  const { playSong } = usePlayer();
  const [tab, setTab]                     = useState('artists');
  const [topArtists, setTopArtists]       = useState([]);
  const [topListeners, setTopListeners]   = useState([]);
  const [topSongs, setTopSongs]           = useState([]);
  const [myRank, setMyRank]               = useState(null);
  const [loading, setLoading]             = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [artistsRes, songsRes, listenersRes] = await Promise.allSettled([
      supabase
        .from('users')
        .select('id,username,avatar_url,followers_count,total_plays')
        .order('total_plays', { ascending: false })
        .limit(20),
      supabase
        .from('songs')
        .select('id,title,artist,cover_url,plays_count,likes_count,uploader_id')
        .eq('is_archived', false)
        .order('plays_count', { ascending: false })
        .limit(20),
      supabase
        .from('user_streaks')
        .select('user_id,current_streak,longest_streak,total_days,users:user_id(id,username,avatar_url)')
        .order('total_days', { ascending: false })
        .limit(20),
    ]);

    if (artistsRes.status === 'fulfilled') setTopArtists(artistsRes.value.data || []);
    if (songsRes.status === 'fulfilled')   setTopSongs(songsRes.value.data || []);
    if (listenersRes.status === 'fulfilled') {
      const rows = (listenersRes.value.data || []).map(r => ({
        ...r.users,
        total_days: r.total_days,
        current_streak: r.current_streak,
        longest_streak: r.longest_streak,
      }));
      setTopListeners(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TABS = [
    { id: 'artists',   label: 'Artistes',   icon: <Crown className="w-4 h-4" /> },
    { id: 'songs',     label: 'Sons',        icon: <Music className="w-4 h-4" /> },
    { id: 'listeners', label: 'Auditeurs',   icon: <Headphones className="w-4 h-4" /> },
  ];

  const currentData = tab === 'artists' ? topArtists
    : tab === 'songs' ? topSongs
    : topListeners;

  const podiumData = currentData.slice(0, 3);

  return (
    <>
      <Helmet><title>Classement — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl pb-32">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Trophy className="w-4 h-4" />
              CLASSEMENT
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
              Hall of <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Fame</span>
            </h1>
            <p className="text-gray-400">Les meilleurs de la communauté NovaSound</p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 bg-gray-900 p-1.5 rounded-2xl">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 text-white border border-white/10'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Podium Top 3 */}
              {podiumData.length >= 3 && (
                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 mb-6 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
                  <h2 className="text-center text-sm font-bold text-amber-400 mb-6 flex items-center justify-center gap-2">
                    <Award className="w-4 h-4" />
                    PODIUM
                  </h2>
                  <div className="flex items-end justify-center gap-4 md:gap-8">
                    {[
                      podiumData[1] && { user: podiumData[1], rank: 2, score: podiumData[1][tab === 'artists' ? 'total_plays' : tab === 'songs' ? 'plays_count' : 'total_days'] || 0 },
                      podiumData[0] && { user: podiumData[0], rank: 1, score: podiumData[0][tab === 'artists' ? 'total_plays' : tab === 'songs' ? 'plays_count' : 'total_days'] || 0 },
                      podiumData[2] && { user: podiumData[2], rank: 3, score: podiumData[2][tab === 'artists' ? 'total_plays' : tab === 'songs' ? 'plays_count' : 'total_days'] || 0 },
                    ].filter(Boolean).map(({ user, rank, score }) => (
                      <PodiumBar key={rank} user={user} rank={rank} score={score} />
                    ))}
                  </div>
                </div>
              )}

              {/* Liste complète */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Top 20</span>
                  <span className="text-xs text-gray-500">Mis à jour en temps réel</span>
                </div>
                <div className="p-3 space-y-1">
                  {currentData.map((item, i) => (
                    <RankRow
                      key={item.id}
                      item={item}
                      rank={i + 1}
                      scoreKey={tab === 'artists' ? 'total_plays' : tab === 'songs' ? 'plays_count' : 'total_days'}
                      labelKey={tab === 'songs' ? 'title' : 'username'}
                      secondLabel={tab === 'songs' ? 'artist' : tab === 'listeners' ? null : null}
                      linkPrefix={tab === 'songs' ? '/song' : '/artist'}
                      onPlay={tab === 'songs' ? (s) => playSong(s, currentData) : null}
                    />
                  ))}
                  {currentData.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-8">Aucune donnée disponible.</p>
                  )}
                </div>
              </div>

              {/* Ma position */}
              {currentUser && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 border border-cyan-500/20 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <div>
                      <p className="text-white text-sm font-semibold">Ta position dans ce classement</p>
                      <p className="text-gray-400 text-xs">Continue d'écouter et d'interagir pour grimper ! 🚀</p>
                    </div>
                    <Link to="/profile" className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 flex-shrink-0">
                      Mon profil <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default LeaderboardPage;
