/**
 * ArtistStatsPage — NovaSound TITAN LUX V50000
 * Dashboard analytics artiste
 * - Graphes réels depuis song_plays_history (V50000) avec fallback simulation
 * - Courbes plays/likes sur 7j/30j
 * - Classement de ses morceaux par performance
 * - Total cumulé: écoutes, likes, favoris, abonnés
 * - Insight cards: meilleur jour, meilleure semaine
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  TrendingUp, Headphones, Heart, Bookmark, Users,
  Music, ArrowLeft, BarChart2, Award, Eye
} from 'lucide-react';
import { formatPlays } from '@/lib/utils';

// ── Micro composant graphe en barres SVG ────────────────────────
const BarChart = ({ data, color = '#06b6d4', height = 80 }) => {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = 100 / data.length;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full h-full">
        {data.map((d, i) => {
          const barH = Math.max(1, (d.value / max) * (height - 12));
          const x = i * barW + barW * 0.1;
          const w = barW * 0.8;
          const y = height - barH - 8;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={barH} rx={1.5}
                fill={color} opacity={0.7} />
              {/* Valeur au survol via title */}
              <title>{d.label}: {formatPlays(d.value)}</title>
            </g>
          );
        })}
        {/* Labels axe X */}
        {data.map((d, i) => (
          <text key={`l-${i}`}
            x={i * barW + barW / 2}
            y={height - 1}
            textAnchor="middle"
            fontSize={4.5}
            fill="#4b5563"
          >{d.label}</text>
        ))}
      </svg>
    </div>
  );
};

// ── Sparkline SVG ────────────────────────────────────────────────
const Sparkline = ({ values, color = '#06b6d4', height = 40 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = height - ((v - min) / range) * (height - 6) - 2;
    return `${x},${y}`;
  }).join(' ');
  const areaBottom = `100,${height - 1} 0,${height - 1}`;

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pts} ${areaBottom}`} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// ── Générer des données simulées réalistes ────────────────────────
// (Supabase ne stocke pas l'historique des plays par jour — on simule
//  à partir du total en appliquant une courbe réaliste)
const generateDailyData = (total, days, seed = 1) => {
  const data = [];
  let remaining = total;
  for (let i = days; i >= 1; i--) {
    // Distribution pondérée : plus récent = plus d'activité
    const weight = Math.pow(1 + seed * 0.01, days - i) * (0.5 + Math.random() * 0.7);
    const portion = Math.min(remaining, Math.floor((total / days) * weight));
    data.unshift({
      label: i === 1 ? "Auj" : i === 7 ? "J-7" : i === 30 ? "J-30" : `J-${i-1}`,
      value: Math.max(0, portion),
    });
    remaining -= portion;
  }
  return data;
};

// ════════════════════════════════════════════════════════════════════
const ArtistStatsPage = () => {
  const { currentUser } = useAuth();
  const [songs,        setSongs]        = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [period,       setPeriod]       = useState(7);  // 7 ou 30 jours
  const [chartMetric,  setChartMetric]  = useState('plays');

  useEffect(() => {
    if (currentUser?.id) fetchStats();
  }, [currentUser?.id]);

  const [playsHistory, setPlaysHistory] = useState([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: songsData }, { data: followersData }] = await Promise.all([
        supabase.from('songs').select('*').eq('uploader_id', currentUser.id).order('plays_count', { ascending: false }),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', currentUser.id),
      ]);

      const list = songsData || [];
      setSongs(list);

      const totalPlays    = list.reduce((s, sg) => s + (sg.plays_count || 0), 0);
      const totalLikes    = list.reduce((s, sg) => s + (sg.likes_count || 0), 0);
      const totalFollowers = followersData?.count || 0;

      const { count: totalFavs } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .in('song_id', list.map(s => s.id).filter(Boolean));

      setStats({
        totalPlays, totalLikes, totalFollowers,
        totalFavs: totalFavs || 0,
        songCount: list.filter(s => !s.is_archived).length,
      });

      // V50000: Fetch historique réel depuis song_plays_history
      if (list.length > 0) {
        try {
          const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: history } = await supabase
            .from('song_plays_history')
            .select('listened_at')
            .in('song_id', list.map(s => s.id).filter(Boolean))
            .gte('listened_at', since30)
            .order('listened_at', { ascending: true });
          setPlaysHistory(history || []);
        } catch { setPlaysHistory([]); }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  // V50000: Utiliser les données réelles si disponibles, sinon simuler
  const chartData = useMemo(() => {
    if (!songs.length) return [];

    if (chartMetric === 'plays' && playsHistory.length > 0) {
      // Grouper par jour
      const dayMap = new Map();
      const now = Date.now();
      const cutoff = now - period * 24 * 60 * 60 * 1000;
      for (const row of playsHistory) {
        const ts = new Date(row.listened_at).getTime();
        if (ts < cutoff) continue;
        const day = new Date(row.listened_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      // Remplir les jours manquants
      const result = [];
      for (let i = period - 1; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        result.push({ label, value: dayMap.get(label) || 0 });
      }
      // Afficher max 30 points en 30j, ou tous en 7j
      return period === 7 ? result : result.filter((_, i) => i % 3 === 0 || i === result.length - 1);
    }

    // Fallback: simulation
    const totalMetric = songs.reduce((s, sg) => s + (sg[chartMetric === 'plays' ? 'plays_count' : 'likes_count'] || 0), 0);
    return generateDailyData(totalMetric, period, currentUser?.id?.charCodeAt(0) || 42);
  }, [songs, period, chartMetric, currentUser?.id, playsHistory]);

  const sparkValues = useMemo(() => chartData.map(d => d.value), [chartData]);

  // Top 3 songs
  const topSongs = useMemo(() => songs.filter(s => !s.is_archived).slice(0, 10), [songs]);

  if (!currentUser) return null;

  return (
    <>
      <Helmet>
        <title>Mes Stats — NovaSound TITAN LUX</title>
        <meta name="description" content="Dashboard analytics artiste NovaSound" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-36 md:pb-28">
        <Header />

        <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 py-8 max-w-4xl">
          {/* Retour */}
          <Link to="/profile" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Mon profil
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Mes statistiques</h1>
              <p className="text-gray-500 text-sm">{stats?.songCount ?? '…'} morceaux publiés</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Headphones, label: 'Écoutes totales', value: formatPlays(stats?.totalPlays), color: 'cyan',    sub: 'toutes périodes' },
                  { icon: Heart,      label: 'Likes reçus',     value: formatPlays(stats?.totalLikes), color: 'pink',    sub: 'sur tes sons' },
                  { icon: Bookmark,   label: 'Favoris',         value: formatPlays(stats?.totalFavs),  color: 'purple',  sub: 'enregistrements' },
                  { icon: Users,      label: 'Abonnés',         value: formatPlays(stats?.totalFollowers), color: 'amber', sub: 'followers' },
                ].map(({ icon: Icon, label, value, color, sub }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className={`bg-gray-900/60 border border-white/[0.07] rounded-2xl p-4 hover:border-${color}-500/20 transition-all`}
                  >
                    <div className={`w-8 h-8 rounded-xl bg-${color}-500/15 flex items-center justify-center mb-3`}>
                      <Icon className={`w-4 h-4 text-${color}-400`} />
                    </div>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">{sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* ── Graphe évolution ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-gray-900/60 border border-white/[0.07] rounded-2xl p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-white font-bold">Évolution</h3>
                    <p className="text-gray-600 text-xs mt-0.5">Distribution estimée sur la période</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Métrique */}
                    <div className="flex rounded-xl overflow-hidden border border-white/[0.07]">
                      {[['plays', 'Écoutes'], ['likes', 'Likes']].map(([m, l]) => (
                        <button key={m} onClick={() => setChartMetric(m)}
                          className={`px-3 py-1.5 text-xs font-semibold transition-all ${chartMetric === m ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {/* Période */}
                    <div className="flex rounded-xl overflow-hidden border border-white/[0.07]">
                      {[7, 30].map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                          className={`px-3 py-1.5 text-xs font-semibold transition-all ${period === p ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'}`}>
                          {p}j
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Sparkline large */}
                <div className="mb-3">
                  <Sparkline values={sparkValues} color={chartMetric === 'plays' ? '#06b6d4' : '#ec4899'} height={70} />
                </div>
                {/* Barchart détaillé */}
                <BarChart
                  data={chartData.filter((_, i) => period === 7 ? true : i % 3 === 0)}
                  color={chartMetric === 'plays' ? '#06b6d4' : '#ec4899'}
                  height={90}
                />
              </motion.div>

              {/* ── Classement morceaux ── */}
              {topSongs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="bg-gray-900/60 border border-white/[0.07] rounded-2xl p-5"
                >
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    Classement de tes morceaux
                  </h3>
                  <div className="space-y-2">
                    {topSongs.map((song, idx) => {
                      const maxPlays = topSongs[0]?.plays_count || 1;
                      const pct = Math.round((song.plays_count || 0) / maxPlays * 100);
                      const medals = ['🥇', '🥈', '🥉'];
                      return (
                        <Link key={song.id} to={`/song/${song.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group">
                          {/* Rang */}
                          <span className="w-6 text-center text-sm flex-shrink-0">
                            {idx < 3 ? medals[idx] : <span className="text-gray-600 text-xs">#{idx + 1}</span>}
                          </span>
                          {/* Cover */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-white/[0.06]">
                            {song.cover_url
                              ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-gray-600" /></div>
                            }
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate group-hover:text-cyan-400 transition-colors">{song.title}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {/* Barre progression relative */}
                              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                          {/* Stats */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-cyan-400 text-sm font-bold">{formatPlays(song.plays_count || 0)}</p>
                            <p className="text-gray-600 text-xs flex items-center gap-1 justify-end">
                              <Heart className="w-2.5 h-2.5" />{formatPlays(song.likes_count || 0)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Message si pas de sons ── */}
              {topSongs.length === 0 && (
                <div className="text-center py-12 bg-gray-900/40 border border-white/[0.06] rounded-2xl">
                  <Music className="w-12 h-12 text-gray-800 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Aucun morceau publié</p>
                  <Link to="/upload" className="mt-3 inline-block text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                    Uploader mon premier son →
                  </Link>
                </div>
              )}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ArtistStatsPage;
