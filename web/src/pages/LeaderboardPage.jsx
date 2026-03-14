/**
 * LeaderboardPage — NovaSound TITAN LUX V110000
 * - Auditeurs : données user_streaks, scoreLabel correct, lien profil OK
 * - Séries : user_streaks ordonné par current_streak (plus leaderboard_streaks)
 * - currentData pour onglet Séries = streaks (corrigé)
 * - myStreakRank ajouté + secondLabelFn pour label dynamique per-row
 * - Podium + Top20 unifiés sur tous les onglets
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
  Trophy, Crown, Music, Headphones,
  Award, ChevronRight, Play, RefreshCw, Calendar, Flame, Clock, Zap
} from 'lucide-react';

// ── Badges ──────────────────────────────────────────────────────────
const BADGES = [
  { min: 0,      label: 'Auditeur',  color: '#6b7280', icon: '🎧', bg: 'from-gray-600 to-gray-700' },
  { min: 100,    label: 'Mélomane',  color: '#06b6d4', icon: '🎵', bg: 'from-cyan-500 to-blue-600' },
  { min: 500,    label: 'Passionné', color: '#8b5cf6', icon: '🔥', bg: 'from-purple-500 to-violet-600' },
  { min: 2000,   label: 'Légende',   color: '#f59e0b', icon: '👑', bg: 'from-amber-400 to-orange-500' },
  { min: 10000,  label: 'TITAN',     color: '#ec4899', icon: '⚡', bg: 'from-pink-500 to-fuchsia-600' },
];
const getBadge = (score) => {
  let b = BADGES[0];
  for (const x of BADGES) { if (score >= x.min) b = x; }
  return b;
};

// ── Podium ────────────────────────────────────────────────────────────
const PodiumBar = ({ user, rank, score }) => {
  const heights = { 1: 'h-28 md:h-36', 2: 'h-20 md:h-28', 3: 'h-14 md:h-20' };
  const orders  = { 1: 'order-2', 2: 'order-1', 3: 'order-3' };
  const medals  = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const badge   = getBadge(score);
  const name    = user.username || user.title || user.artist || '?';
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.12, type: 'spring', stiffness: 200 }}
      className={`flex flex-col items-center gap-2 ${orders[rank]}`}
    >
      <div className="relative">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-xl">
          {user.avatar_url || user.cover_url
            ? <img src={user.avatar_url || user.cover_url} className="w-full h-full object-cover" alt={name} />
            : <div className={`w-full h-full bg-gradient-to-br ${badge.bg} flex items-center justify-center text-white font-bold text-lg`}>
                {name[0].toUpperCase()}
              </div>
          }
        </div>
        <span className="absolute -top-2 -right-2 text-lg">{medals[rank]}</span>
      </div>
      <p className="text-white text-xs font-bold text-center truncate max-w-[80px]" translate="no"><span className="notranslate"><span className="notranslate" translate="no">{name}</span></span></p>
      <p className="text-xs font-semibold" style={{ color: badge.color }}>{badge.icon} {badge.label}</p>
      <div className={`w-16 md:w-20 ${heights[rank]} rounded-t-xl bg-gradient-to-t ${badge.bg} opacity-70 flex items-end justify-center pb-2`}>
        <span className="text-white text-xs font-black">{formatPlays(score)}</span>
      </div>
    </motion.div>
  );
};

// ── Ligne classement ──────────────────────────────────────────────────
const RankRow = ({ item, rank, scoreKey, scoreLabel, labelKey, secondLabel, secondLabelFn, linkPrefix, onPlay, isMe }) => {
  const badge  = getBadge(item[scoreKey] || 0);
  const isTop3 = rank <= 3;
  const name   = item[labelKey] || '?';
  // V110000 : secondLabelFn override secondLabel pour valeurs dynamiques
  const secondContent = secondLabelFn
    ? secondLabelFn(item)
    : (typeof secondLabel === 'string' ? item[secondLabel] : secondLabel);
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(rank * 0.03, 0.6) }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
        isMe
          ? 'bg-gradient-to-r from-cyan-500/15 to-fuchsia-500/10 border border-cyan-500/30'
          : isTop3
            ? 'bg-gradient-to-r from-white/5 to-transparent border border-white/10'
            : 'hover:bg-gray-800/60 border border-transparent'
      }`}
    >
      <div className="w-8 text-center flex-shrink-0">
        {rank === 1 ? <span className="text-xl">🥇</span>
        : rank === 2 ? <span className="text-xl">🥈</span>
        : rank === 3 ? <span className="text-xl">🥉</span>
        : <span className={`text-sm font-bold tabular-nums ${isMe ? 'text-cyan-400' : 'text-gray-500'}`}>{rank}</span>
        }
      </div>
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
        {item.avatar_url || item.cover_url
          ? <img src={item.avatar_url || item.cover_url} className="w-full h-full object-cover" alt="" />
          : <div className={`w-full h-full bg-gradient-to-br ${badge.bg} flex items-center justify-center text-white text-sm font-bold`}>
              {name[0].toUpperCase()}
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        {linkPrefix
          ? <Link to={`${linkPrefix}/${item.id}`} className={`font-semibold text-sm hover:text-cyan-400 transition-colors truncate block ${isMe ? 'text-cyan-300' : 'text-white'}`} translate="no">
              <span className="notranslate">{name}</span>
              {isMe && <span className="ml-1.5 text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-bold">Toi</span>}
            </Link>
          : <p className={`font-semibold text-sm truncate ${isMe ? 'text-cyan-300' : 'text-white'}`} translate="no">
              <span className="notranslate">{name}</span>
              {isMe && <span className="ml-1.5 text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-bold">Toi</span>}
            </p>
        }
        {secondContent != null && (
          <p className="text-gray-500 text-xs truncate">{secondContent}</p>
        )}
      </div>
      <span className="text-xs hidden sm:block flex-shrink-0" style={{ color: badge.color }}>{badge.icon}</span>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold tabular-nums ${isMe ? 'text-cyan-400' : 'text-white'}`}>{formatPlays(item[scoreKey] || 0)}</p>
        {scoreLabel && <p className="text-[10px] text-gray-600">{scoreLabel}</p>}
      </div>
      {onPlay && (
        <button onClick={() => onPlay(item)}
          className="p-1.5 rounded-full bg-white/10 hover:bg-cyan-500/20 text-gray-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
      )}
    </motion.div>
  );
};

const SONG_PERIODS = [
  { id: 'trending_24h', label: '24 h',    Icon: Clock },
  { id: 'trending_7d',  label: '7 jours', Icon: Flame },
  { id: 'trending_30d', label: '30 j',    Icon: Calendar },
  { id: 'all',          label: 'Tout',    Icon: Trophy },
];

// ══════════════════════════════════════════════════════════════════
const LeaderboardPage = () => {
  const { currentUser } = useAuth();
  const { playSong }    = usePlayer();
  const [tab, setTab]               = useState('artists');
  const [songPeriod, setSongPeriod] = useState('trending_7d');
  const [streaks,    setStreaks]    = useState([]);
  const [streakTab,  setStreakTab]  = useState(false); // V50000: onglet streaks
  const [topArtists, setTopArtists] = useState([]);
  const [topListeners, setTopListeners] = useState([]);
  const [topSongs, setTopSongs]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myArtistRank, setMyArtistRank] = useState(null);
  const [myListenerRank, setMyListenerRank] = useState(null);
  const [myStreakRank, setMyStreakRank] = useState(null); // V110000

  const fetchArtistsAndListeners = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [ar, lr] = await Promise.allSettled([
      // On agrège les plays depuis songs (total_plays n'existe pas dans users)
      supabase.from('songs')
        .select('uploader_id, plays_count, likes_count')
        .eq('is_archived', false)
        .order('plays_count', { ascending: false })
        .limit(200),
      supabase.from('user_streaks')
        .select('user_id,current_streak,longest_streak,total_days')
        .order('total_days', { ascending: false }).limit(20),
    ]);

    if (ar.status === 'fulfilled') {
      // Agréger par uploader_id
      const songRows = ar.value.data || [];
      const byUser = {};
      for (const s of songRows) {
        if (!s.uploader_id) continue;
        if (!byUser[s.uploader_id]) byUser[s.uploader_id] = { total_plays: 0, total_likes: 0 };
        byUser[s.uploader_id].total_plays += s.plays_count || 0;
        byUser[s.uploader_id].total_likes += s.likes_count || 0;
      }
      const uploaderIds = Object.keys(byUser);
      let list = [];
      if (uploaderIds.length) {
        const { data: ud } = await supabase.from('users')
          .select('id,username,avatar_url,followers_count')
          .in('id', uploaderIds);
        list = (ud || []).map(u => ({
          ...u,
          total_plays: byUser[u.id]?.total_plays || 0,
          total_likes: byUser[u.id]?.total_likes || 0,
          xp_points:   (byUser[u.id]?.total_plays || 0) + (byUser[u.id]?.total_likes || 0) * 3,
        })).sort((a, b) => b.total_plays - a.total_plays).slice(0, 20);
      }
      setTopArtists(list);
      if (currentUser?.id) {
        const idx = list.findIndex(u => u.id === currentUser.id);
        setMyArtistRank(idx >= 0 ? idx + 1 : null);
      }
    }
    if (lr.status === 'fulfilled') {
      const streaks = lr.value.data || [];
      if (streaks.length > 0) {
        const ids = streaks.map(r => r.user_id);
        const { data: ud } = await supabase.from('users').select('id,username,avatar_url').in('id', ids);
        const byId = new Map((ud || []).map(u => [u.id, u]));
        const rows = streaks
          .map(r => ({
            ...(byId.get(r.user_id) || { id: r.user_id, username: 'Anonyme', avatar_url: null }),
            total_days: r.total_days,
            current_streak: r.current_streak,
          }))
          .filter(r => r.username && r.username !== 'Anonyme');
        setTopListeners(rows);
        if (currentUser?.id) {
          const idx = rows.findIndex(u => u.id === currentUser.id);
          setMyListenerRank(idx >= 0 ? idx + 1 : null);
        }
      }
    }
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, [currentUser?.id]);

  const fetchSongs = useCallback(async (period) => {
    setLoading(true);
    let data = [];
    try {
      // trending_24h/7d/30d sont des vues inexistantes → requête directe sur songs avec filtre date
      let query = supabase.from('songs')
        .select('id,title,artist,cover_url,audio_url,plays_count,likes_count,uploader_id')
        .eq('is_archived', false)
        .order('plays_count', { ascending: false })
        .limit(20);
      if (period === 'trending_24h') {
        query = query.gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
      } else if (period === 'trending_7d') {
        query = query.gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
      } else if (period === 'trending_30d') {
        query = query.gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
      }
      // 'all' = pas de filtre date
      const { data: d } = await query;
      data = d || [];
      // Fallback si filtre trop restrictif et résultats vides
      if (!data.length && period !== 'all') {
        const { data: fb } = await supabase.from('songs')
          .select('id,title,artist,cover_url,audio_url,plays_count,likes_count,uploader_id')
          .eq('is_archived', false).order('plays_count', { ascending: false }).limit(20);
        data = fb || [];
      }
    } catch { data = []; }
    setTopSongs(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchArtistsAndListeners(); }, [fetchArtistsAndListeners]);
  useEffect(() => { if (tab === 'songs') fetchSongs(songPeriod); }, [tab, songPeriod, fetchSongs]);

  // V110000: fetch streaks — source user_streaks (fiable) ordonné par current_streak
  useEffect(() => {
    if (tab !== 'streaks') return;
    (async () => {
      try {
        const { data: streakData } = await supabase
          .from('user_streaks')
          .select('user_id,current_streak,longest_streak,total_days')
          .order('current_streak', { ascending: false })
          .limit(30);
        if (!streakData?.length) { setStreaks([]); return; }
        const ids = streakData.map(r => r.user_id);
        const { data: ud } = await supabase.from('users').select('id,username,avatar_url').in('id', ids);
        const byId = new Map((ud || []).map(u => [u.id, u]));
        const rows = streakData
          .map(r => ({
            ...(byId.get(r.user_id) || { id: r.user_id, username: 'Anonyme', avatar_url: null }),
            current_streak: r.current_streak,
            longest_streak: r.longest_streak,
            total_days:     r.total_days,
          }))
          .filter(r => r.username && r.username !== 'Anonyme');
        setStreaks(rows);
        if (currentUser?.id) {
          const idx = rows.findIndex(r => r.id === currentUser.id);
          setMyStreakRank(idx >= 0 ? idx + 1 : null);
        }
      } catch(e) { console.error('[Séries]', e); setStreaks([]); }
    })();
  }, [tab, currentUser?.id]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('leaderboard_v10000')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'songs' }, () => {
        if (tab === 'songs') fetchSongs(songPeriod);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
        if (tab !== 'songs') fetchArtistsAndListeners(true);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [tab, songPeriod, fetchArtistsAndListeners, fetchSongs]);

  // V110000 — currentData, scoreKey, scoreLabel, myRank corrects pour TOUS les onglets
  const currentData = tab === 'artists' ? topArtists : tab === 'songs' ? topSongs : tab === 'listeners' ? topListeners : streaks;
  const podiumData  = currentData.slice(0, 3);
  const getScore    = (item) =>
    tab === 'artists'   ? (item.total_plays    || 0)
    : tab === 'songs'   ? (item.plays_count    || 0)
    : tab === 'listeners' ? (item.total_days   || 0)
    :                     (item.current_streak || 0); // streaks
  const scoreKey    =
    tab === 'artists' ? 'total_plays' : tab === 'songs' ? 'plays_count' : tab === 'listeners' ? 'total_days' : 'current_streak';
  const scoreLabel  =
    tab === 'artists' ? 'écoutes' : tab === 'songs' ? 'plays' : tab === 'listeners' ? 'j écoutés' : 'j de suite';
  const myRank      =
    tab === 'artists' ? myArtistRank : tab === 'listeners' ? myListenerRank : tab === 'streaks' ? myStreakRank : null;

  const TABS = [
    { id: 'artists',   label: 'Artistes',  Icon: Crown },
    { id: 'songs',     label: 'Sons',      Icon: Music },
    { id: 'listeners', label: 'Auditeurs', Icon: Headphones },
    { id: 'streaks',   label: 'Séries',    Icon: Flame },   // V50000
  ];

  return (
    <>
      <Helmet><title>Classement — NovaSound TITAN LUX</title></Helmet>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-8 pb-32">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Trophy className="w-4 h-4" />CLASSEMENT
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
              Hall of <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Fame</span>
            </h1>
            <p className="text-gray-400">Les meilleurs de la communauté NovaSound</p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 bg-gray-900 p-1.5 rounded-2xl">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 text-white border border-white/10'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          {/* Filtre période (songs) */}
          <AnimatePresence>
            {tab === 'songs' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 mb-6 overflow-hidden flex-wrap">
                {SONG_PERIODS.map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => setSongPeriod(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      songPeriod === id
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-gray-500 hover:text-gray-300 border border-transparent'
                    }`}>
                    <Icon className="w-3 h-3" />{label}
                  </button>
                ))}
                <button onClick={() => fetchSongs(songPeriod)} disabled={loading || refreshing}
                  className="ml-auto p-1.5 rounded-xl text-gray-600 hover:text-gray-400 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Podium — fonctionne avec 1, 2 ou 3 entrées */}
              {podiumData.length >= 1 && (
                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 mb-6 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                      <Award className="w-4 h-4" />PODIUM
                    </h2>
                    {tab !== 'songs' && (
                      <button onClick={() => fetchArtistsAndListeners(true)} disabled={refreshing}
                        className="p-1.5 rounded-xl text-gray-600 hover:text-gray-400 transition-colors">
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-end justify-center gap-4 md:gap-8">
                    {[
                      podiumData.length >= 2 ? { item: podiumData[1], rank: 2 } : null,
                      { item: podiumData[0], rank: 1 },
                      podiumData.length >= 3 ? { item: podiumData[2], rank: 3 } : null,
                    ].filter(Boolean).map(({ item, rank }) => (
                      <PodiumBar key={rank} user={item} rank={rank} score={getScore(item)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Liste complète */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Top 20</span>
                  <span className="text-xs text-gray-600">
                    {tab === 'artists' ? 'par écoutes totales' : tab === 'songs' ? 'par popularité' : 'par jours d\'écoute'}
                  </span>
                </div>
                <div className="p-3 space-y-0.5">
                  {currentData.map((item, i) => (
                    <RankRow
                      key={item.id || item.user_id || i}
                      item={item}
                      rank={i + 1}
                      scoreKey={scoreKey}
                      scoreLabel={scoreLabel}
                      labelKey={tab === 'songs' ? 'title' : 'username'}
                      secondLabel={tab === 'songs' ? 'artist' : null}
                      secondLabelFn={
                        tab === 'listeners' ? (r) => `🔥 ${r.current_streak || 0}j de suite`
                        : tab === 'streaks'  ? (r) => `record : ${r.longest_streak || 0}j · total : ${r.total_days || 0}j`
                        : null
                      }
                      linkPrefix={tab === 'songs' ? '/song' : '/artist'}
                      onPlay={tab === 'songs' ? (s) => playSong(s, currentData) : null}
                      isMe={currentUser?.id === item.id || currentUser?.id === item.user_id}
                    />
                  ))}
                  {currentData.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-8">Aucune donnée disponible.</p>
                  )}
                </div>
              </div>

              {/* Ma position */}
              {currentUser && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 border border-cyan-500/20 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">
                        {myRank
                          ? `Tu es ${myRank === 1 ? '🥇 ' : myRank === 2 ? '🥈 ' : myRank === 3 ? '🥉 ' : ''}#${myRank} dans ce classement !`
                          : tab === 'songs' ? 'Poste un son pour apparaître ici 🎵'
                          : tab === 'listeners' ? 'Continue d\'écouter pour apparaître ici 🎧'
                          : tab === 'streaks' ? 'Écoute chaque jour pour apparaître ici 🔥'
                          : 'Continue de publier pour grimper ! 🚀'
                        }
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {tab === 'listeners'
                          ? `Streak actuel : ${topListeners.find(u => u.id === currentUser.id)?.current_streak || 0} j 🔥`
                          : tab === 'streaks'
                          ? `Série actuelle : ${streaks.find(r => r.id === currentUser.id || r.user_id === currentUser.id)?.current_streak || 0} j 🔥`
                          : 'Écoutes, likes et publications font grimper ton score'
                        }
                      </p>
                    </div>
                    <Link to={`/artist/${currentUser.id}`} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 flex-shrink-0">
                      Profil <ChevronRight className="w-3 h-3" />
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
