import React, { useState, useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SongCard from '@/components/SongCard';
import FollowButton from '@/components/FollowButton';
import ArtistStatsCard from '@/components/ArtistStatsCard';
import {
  Music, User, Users, Headphones, Share2,
  Instagram, Youtube, ExternalLink,
  Twitter, Music2, Globe, Play, Grid3X3, List, Radio,
} from 'lucide-react';
import { formatPlays } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { GENRE_THEMES_MAP } from '@/hooks/useGenreTheme';

/* ══════════════════════════════════════════════════
   SHARE MODAL ARTISTE
   ══════════════════════════════════════════════════ */
const ARTIST_SHARE_THEMES = [
  { id: 'dark',   bg: 'linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)', logo: '#22d3ee' },
  { id: 'fire',   bg: 'linear-gradient(160deg,#1a0505 0%,#3d0b0b 50%,#7f1d1d 100%)', logo: '#f87171' },
  { id: 'forest', bg: 'linear-gradient(160deg,#052e16 0%,#14532d 50%,#166534 100%)', logo: '#4ade80' },
  { id: 'gold',   bg: 'linear-gradient(160deg,#1c1400 0%,#3d2e00 50%,#78570a 100%)', logo: '#fbbf24' },
];

const loadLocalLogo = () =>
  fetch('/icon-192.png').then(r => r.blob())
    .then(blob => new Promise(res => { const reader = new FileReader(); reader.onloadend = () => res(reader.result); reader.readAsDataURL(blob); }))
    .catch(() => null);

const toDataUrl = (src) => new Promise(resolve => {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    try { resolve(c.toDataURL('image/jpeg', 0.92)); } catch { resolve(src); }
  };
  img.onerror = () => resolve(null);
  img.src = src + (src.includes('?') ? '&' : '?') + '_cb=' + Date.now();
});

const waitForImages = (node) => {
  const imgs = Array.from(node.querySelectorAll('img'));
  return Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })));
};

const dataUrlToBlob = (dataUrl) => {
  const arr = dataUrl.split(','); const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]); let n = bstr.length; const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
};

const ArtistShareModal = ({ artist, onClose }) => {
  const cardRef = React.useRef(null);
  const [theme, setTheme] = useState(ARTIST_SHARE_THEMES[0]);
  const [cardImg, setCardImg] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState(null);
  const shareUrl = `${window.location.origin}${window.location.pathname}#/artist/${artist.id}`;

  useEffect(() => { loadLocalLogo().then(setLogoDataUrl); }, []);
  useEffect(() => {
    if (artist.avatar_url) toDataUrl(artist.avatar_url).then(setAvatarDataUrl);
  }, [artist.avatar_url]);
  useEffect(() => { setCardImg(null); }, [theme]);

  const generate = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      await waitForImages(cardRef.current);
      await new Promise(r => setTimeout(r, 200));
      const url = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      setCardImg(url);
    } catch {}
    finally { setGenerating(false); }
  };

  const share = async () => {
    if (!cardImg) return;
    const blob = dataUrlToBlob(cardImg);
    const file = new File([blob], 'artiste-novasound.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `Découvre ${artist.username} sur NovaSound TITAN LUX`, url: shareUrl });
    } else {
      const a = document.createElement('a'); a.href = cardImg;
      a.download = `${artist.username}-novasound.png`; a.click();
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-bold">Partager l'artiste</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 text-lg leading-none">×</button>
        </div>
        <div className="flex gap-2 mb-4">
          {ARTIST_SHARE_THEMES.map(t => (
            <button key={t.id} onClick={() => setTheme(t)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${theme.id === t.id ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: t.bg }} />
          ))}
        </div>
        <div ref={cardRef} style={{ background: theme.bg, borderRadius: 16, padding: 20, fontFamily: 'sans-serif', position: 'relative', overflow: 'hidden' }}>
          {avatarDataUrl && <img src={avatarDataUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${theme.logo}`, marginBottom: 12 }} />}
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{artist.username}</p>
          {artist.bio && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{artist.bio.slice(0, 80)}{artist.bio.length > 80 ? '…' : ''}</p>}
          <p style={{ color: theme.logo, fontSize: 11, marginTop: 10, fontWeight: 600 }}>NovaSound TITAN LUX ✦</p>
          {logoDataUrl && <img src={logoDataUrl} alt="" style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: 6, opacity: 0.8 }} />}
        </div>
        <div className="flex gap-2 mt-4">
          {!cardImg ? (
            <button onClick={generate} disabled={generating}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm font-semibold disabled:opacity-60 transition-all">
              {generating ? 'Génération…' : '🎨 Créer la carte'}
            </button>
          ) : (
            <button onClick={share} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm font-semibold">
              📤 Partager
            </button>
          )}
          <button onClick={copyLink} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:border-white/30 transition-all">
            {copied ? '✓ Copié !' : '🔗 Copier le lien'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════════════
   ICÔNES RÉSEAUX SOCIAUX
   ══════════════════════════════════════════════════ */
const SOCIAL_ICONS = {
  instagram:  { icon: Instagram,  color: '#e1306c', label: 'Instagram' },
  twitter:    { icon: Twitter,    color: '#1da1f2', label: 'Twitter / X' },
  youtube:    { icon: Youtube,    color: '#ff0000', label: 'YouTube' },
  tiktok:     { icon: Music2,     color: '#69c9d0', label: 'TikTok' },
  soundcloud: { icon: Music,      color: '#ff5500', label: 'SoundCloud' },
  website:    { icon: Globe,      color: '#a3e635', label: 'Site web' },
};

const SocialLinks = ({ links }) => {
  if (!links || typeof links !== 'object' || !Object.keys(links).some(k => links[k])) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Object.entries(SOCIAL_ICONS).map(([key, { icon: Icon, color, label }]) => {
        const url = links[key];
        if (!url) return null;
        const href = url.startsWith('http') ? url : `https://${url}`;
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" title={label}
            className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
            <span className="text-xs text-gray-400 group-hover:text-white transition-colors hidden sm:block">{label}</span>
            <ExternalLink className="w-2.5 h-2.5 text-gray-600 hidden sm:block" />
          </a>
        );
      })}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   PAGE PRINCIPALE
   ══════════════════════════════════════════════════ */
const ArtistProfilePage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [artist,        setArtist]        = useState(null);
  const [songs,         setSongs]         = useState([]);
  const [followers,     setFollowers]     = useState([]);
  const [repostedSongs, setRepostedSongs] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showShare,     setShowShare]     = useState(false);
  const [activeTab,     setActiveTab]     = useState('songs');
  const [songView,      setSongView]      = useState('grid');
  const [achievements,  setAchievements]  = useState([]);
  const [liveRoom,      setLiveRoom]      = useState(null);
  const [bioExpanded,   setBioExpanded]   = useState(false);

  const { playSong: globalPlaySong, currentSong } = usePlayer();
  const playSong = (song) => globalPlaySong(song, songs.filter(s => !s.is_archived));

  // Sync song-updated (titre/artiste édités depuis le menu actions)
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail;
      if (!updated?.id) return;
      setSongs(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
    };
    window.addEventListener('novasound:song-updated', handler);
    return () => window.removeEventListener('novasound:song-updated', handler);
  }, []);

  useEffect(() => {
    if (id) {
      fetchArtistData();
      fetchFollowers();
      fetchAchievements();
      fetchLiveRoom();
    }
  }, [id]); // eslint-disable-line

  const fetchLiveRoom = async () => {
    try {
      const { data } = await supabase
        .from('live_rooms')
        .select('id, name, participants_count')
        .eq('host_id', id)
        .eq('is_active', true)
        .maybeSingle();
      setLiveRoom(data || null);
    } catch {}
  };

  const fetchAchievements = async () => {
    try {
      const { data } = await supabase
        .from('user_achievements')
        .select('achievement, unlocked_at, achievement_definitions:achievement(label,icon,rarity,points)')
        .eq('user_id', id)
        .order('unlocked_at', { ascending: false });
      setAchievements(data || []);
    } catch {}
  };

  const fetchArtistData = async () => {
    try {
      setLoading(true);
      const [{ data: artistData, error: artistError }, { data: songsData }, { data: repostsData }] = await Promise.all([
        supabase.from('users').select('*').eq('id', id).single(),
        supabase.from('songs').select('*').eq('uploader_id', id).eq('is_archived', false)
          .order('plays_count', { ascending: false }).limit(50),
        supabase.from('song_reposts')
          .select('song_id, songs(id,title,artist,cover_url,audio_url,plays_count,likes_count,uploader_id)')
          .eq('user_id', id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (artistError) throw artistError;
      setArtist(artistData);
      setSongs(songsData || []);
      setRepostedSongs((repostsData || []).map(r => r.songs).filter(Boolean).filter(s => !s?.is_archived));
    } catch {} finally { setLoading(false); }
  };

  const fetchFollowers = async () => {
    try {
      const { data: followsData } = await supabase
        .from('follows').select('follower_id, created_at').eq('following_id', id);
      if (!followsData?.length) { setFollowers([]); return; }
      const ids = followsData.map(f => f.follower_id);
      const { data: usersData } = await supabase.from('users').select('id, username, avatar_url').in('id', ids);
      const byId = new Map((usersData || []).map(u => [u.id, u]));
      setFollowers(followsData.map(f => ({ ...f, user: byId.get(f.follower_id) || null })));
    } catch {}
  };

  const totalPlays   = songs.reduce((sum, s) => sum + (s.plays_count || 0), 0);
  const isOwnProfile = currentUser?.id === artist?.id;
  const playAll = () => { if (songs.length > 0) globalPlaySong(songs[0], songs); };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-40 md:pb-28">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
      </div>
    </div>
  );

  if (!artist) return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-40 md:pb-28">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Artiste introuvable</p>
          <Link to="/" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">← Accueil</Link>
        </div>
      </div>
      <Footer />
    </div>
  );

  const socialLinks   = artist.social_links && typeof artist.social_links === 'object' ? artist.social_links : {};
  const hasSocialLinks = Object.values(socialLinks).some(Boolean);

  const TABS = [
    { key: 'songs',     label: `Musique (${songs.length})` },
    { key: 'reposts',   label: `Repartagés (${repostedSongs.length})` },
    { key: 'about',     label: 'À propos' },
    { key: 'followers', label: `Abonnés (${followers.length})` },
  ];

  return (
    <>
      <Helmet>
        <title>{`${artist.username || 'Artiste'} — NovaSound TITAN LUX`}</title>
        <meta name="description" content={artist.bio || `Découvrez les morceaux de ${artist.username}`} />
      </Helmet>

      {/* pb-40 mobile = AudioPlayer (80px) + BottomNav (60px) */}
      <div className="min-h-screen bg-gray-950 flex flex-col pb-40 md:pb-32">
        <Header />

        <main className="flex-1 mx-auto w-full px-0 sm:px-4 pb-8">

          {/* ── BANNER ───────────────────────────────── */}
          <div className="relative h-36 sm:h-48 md:h-64 overflow-hidden md:rounded-b-3xl mb-0">
            {artist.banner_url ? (
              <img src={artist.banner_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-cyan-950/40 to-gray-900">
                <div className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(6,182,212,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(168,85,247,0.3) 0%, transparent 50%)' }} />
                <div className="absolute inset-0"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 20px)' }} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent" />
          </div>

          {/* ── HEADER ARTISTE ─────────────────────── */}
          <div className="relative -mt-10 sm:-mt-16 px-3 sm:px-4 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">

              {/* Avatar */}
              <div className="flex-shrink-0">
                {artist.avatar_url ? (
                  <img src={artist.avatar_url} alt={artist.username}
                    className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-gray-950 shadow-2xl" />
                ) : (
                  <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center border-4 border-gray-950 shadow-2xl">
                    <Music className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
                  </div>
                )}
              </div>

              {/* Info + actions */}
              <div className="flex-1 min-w-0 sm:pb-2">
                {/* Titre + live badge */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight">{artist.username || 'Artiste inconnu'}</h1>
                  {totalPlays >= 1000 && <span title="Artiste populaire" className="text-cyan-400 text-base sm:text-lg">✦</span>}
                  {liveRoom && (
                    <Link to={`/live/${liveRoom.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold hover:bg-green-500/25 transition-all animate-pulse"
                    >
                      <Radio className="w-3 h-3" />
                      EN LIVE · {liveRoom.participants_count || 0} 🎧
                    </Link>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500 mb-3 flex-wrap">
                  <span className="flex items-center gap-1"><Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-500/70" />{formatPlays(totalPlays)} écoutes</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-fuchsia-500/70" />{followers.length} abonnés</span>
                  <span className="flex items-center gap-1"><Music className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />{songs.length} son{songs.length > 1 ? 's' : ''}</span>
                </div>

                {/* Actions — flex-wrap pour petits écrans */}
                <div className="flex items-center gap-2 flex-wrap">
                  {songs.length > 0 && (
                    <button onClick={playAll}
                      className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-xs sm:text-sm font-bold hover:from-cyan-400 hover:to-cyan-500 active:scale-95 transition-all shadow-lg shadow-cyan-500/25">
                      <Play className="w-3.5 h-3.5 fill-current" /> Tout jouer
                    </button>
                  )}
                  {!isOwnProfile && currentUser && (
                    <>
                      <FollowButton userId={artist.id} initialFollowers={followers.length} onFollowChange={fetchFollowers} />
                      <Link to={`/chat?tagger=${artist.username || ''}`}
                        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full border border-white/10 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40 text-xs sm:text-sm transition-all">
                        <Globe className="w-3.5 h-3.5" /> Message
                      </Link>
                    </>
                  )}
                  {isOwnProfile && (
                    <Link to="/profile"
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/30 text-xs sm:text-sm transition-all">
                      ✏️ Modifier
                    </Link>
                  )}
                  {!currentUser && (
                    <Link to="/login"
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs sm:text-sm transition-all">
                      S'abonner
                    </Link>
                  )}
                  <button onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full border border-white/10 text-gray-400 hover:border-cyan-500/40 hover:text-cyan-400 text-xs sm:text-sm transition-all">
                    <Share2 className="w-3.5 h-3.5" /> Partager
                  </button>
                </div>
              </div>
            </div>

            {hasSocialLinks && (
              <div className="mt-3 sm:mt-4">
                <SocialLinks links={socialLinks} />
              </div>
            )}
          </div>

          {/* ── ONGLETS — scrollable horizontal sur mobile ── */}
          <div className="border-b border-white/8 mb-4 sm:mb-6">
            <div
              className="flex items-center overflow-x-auto scrollbar-hide px-1 sm:px-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── CONTENU ONGLETS ──────────────────────── */}
          <div className="px-3 sm:px-4">
            <AnimatePresence mode="wait">

              {/* — Musique — */}
              {activeTab === 'songs' && (
                <motion.div key="songs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}>
                  {songs.length > 0 && (
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs sm:text-sm text-gray-500">{songs.length} morceau{songs.length > 1 ? 'x' : ''}</p>
                      <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                        <button onClick={() => setSongView('grid')}
                          className={`p-1.5 rounded-md transition-all ${songView === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-600 hover:text-gray-300'}`}>
                          <Grid3X3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setSongView('list')}
                          className={`p-1.5 rounded-md transition-all ${songView === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-600 hover:text-gray-300'}`}>
                          <List className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  {songs.length === 0 ? (
                    <div className="text-center py-12 sm:py-16 bg-gray-900/30 border border-gray-800 rounded-2xl">
                      <Music className="w-10 h-10 sm:w-12 sm:h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">Aucun morceau pour l'instant.</p>
                    </div>
                  ) : songView === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {songs.map((song, i) => (
                        <motion.div key={song.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <SongCard song={song} onPlay={playSong} isPlaying={currentSong?.id === song.id}
                            onArchived={sid => setSongs(p => p.filter(s => s.id !== sid))}
                            onDeleted={sid => setSongs(p => p.filter(s => s.id !== sid))} />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {songs.map((song, i) => (
                        <motion.div key={song.id}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.025 }}
                          onClick={() => playSong(song)}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                            currentSong?.id === song.id
                              ? 'bg-cyan-500/8 border-cyan-500/30'
                              : 'bg-gray-900/60 border-gray-800/60 hover:bg-gray-800/80 hover:border-gray-700'
                          }`}
                        >
                          <span className="w-5 text-xs text-gray-600 group-hover:hidden text-center tabular-nums">{i + 1}</span>
                          <Play className="w-3.5 h-3.5 text-cyan-400 fill-current hidden group-hover:block flex-shrink-0" />
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/8">
                            {song.cover_url
                              ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              : <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center"><Music className="w-4 h-4 text-cyan-400/40" /></div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-xs sm:text-sm truncate ${currentSong?.id === song.id ? 'text-cyan-300' : 'text-white'}`}>{song.title}</p>
                            <div className="flex items-center gap-1 mt-px">
                              <Headphones className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600" />
                              <span className="text-[10px] sm:text-xs text-gray-600 tabular-nums">{formatPlays(song.plays_count)}</span>
                            </div>
                          </div>
                          {song.genre && (() => {
                            const t = GENRE_THEMES_MAP[song.genre];
                            const c = t?.primary || '#06b6d4';
                            return <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold hidden sm:inline" style={{color:c,background:c+'18',border:`1px solid ${c}35`}}>{song.genre}</span>;
                          })()}
                          <Link to={`/song/${song.id}`} onClick={e => e.stopPropagation()}
                            className="flex-shrink-0 p-1 text-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* — Repartagés — */}
              {activeTab === 'reposts' && (
                <motion.div key="reposts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  {repostedSongs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {repostedSongs.map((song, i) => (
                        <motion.div key={song.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <SongCard song={song} currentSong={currentSong} onPlay={(s) => globalPlaySong(s, repostedSongs)} />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <span className="text-4xl block mb-3">🔁</span>
                      <p className="text-gray-500">Aucun son repartagé</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* — À propos — */}
              {activeTab === 'about' && (
                <motion.div key="about" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                  className="max-w-2xl space-y-4 sm:space-y-6">

                  {artist.username?.toLowerCase() === 'eloadxfamily' && (
                    <div className="flex flex-col items-center py-6 bg-gray-900/60 border border-white/8 rounded-2xl">
                      <img src="/logo_eloadxfamily.png" alt="eloadXFamily"
                        className="w-36 sm:w-48 h-36 sm:h-48 object-contain drop-shadow-2xl"
                        style={{ filter: 'drop-shadow(0 0 24px rgba(220,38,38,0.35))' }}
                      />
                      <p className="text-gray-500 text-xs mt-2 tracking-widest uppercase">Développeur · NovaSound TITAN LUX</p>
                    </div>
                  )}

                  <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-4 sm:p-5">
                    <ArtistStatsCard songs={songs} followersCount={followers.length} />
                  </div>

                  {achievements.length > 0 && (
                    <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-4 sm:p-5">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span>🏆</span> Badges & Trophées
                        <span className="ml-auto text-xs text-fuchsia-400 font-semibold">
                          {achievements.reduce((s, a) => s + (a.achievement_definitions?.points || 0), 0)} XP
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        {achievements.map((a) => {
                          const def = a.achievement_definitions;
                          const rc = { common:'border-gray-700 bg-gray-800/40', rare:'border-cyan-500/40 bg-cyan-500/5', epic:'border-fuchsia-500/40 bg-fuchsia-500/5', legendary:'border-amber-500/40 bg-amber-500/8' }[def?.rarity||'common']||'border-gray-700 bg-gray-800/40';
                          return (
                            <div key={a.achievement} className={`flex items-center gap-2 rounded-xl border px-2.5 sm:px-3 py-2 sm:py-2.5 ${rc}`} title={def?.description||''}>
                              <span className="text-base sm:text-lg flex-shrink-0">{def?.icon||'🎵'}</span>
                              <div className="min-w-0">
                                <p className="text-white text-[10px] sm:text-xs font-semibold truncate">{def?.label||a.achievement}</p>
                                <p className="text-gray-500 text-[9px] sm:text-[10px] capitalize">{def?.rarity||'common'} · {def?.points||0} XP</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {artist.bio ? (
                    <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-4 sm:p-5">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Biographie</h3>
                      <p className={`text-gray-300 text-sm leading-relaxed ${bioExpanded ? '' : 'line-clamp-5'}`}>{artist.bio}</p>
                      {artist.bio.length > 200 && (
                        <button onClick={() => setBioExpanded(!bioExpanded)} className="text-cyan-400 text-xs mt-2 hover:text-cyan-300 transition-colors font-medium">
                          {bioExpanded ? 'Réduire ▲' : 'Lire la suite ▼'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-5 text-center">
                      <p className="text-gray-600 text-sm">Aucune biographie renseignée.</p>
                    </div>
                  )}

                  {hasSocialLinks && (
                    <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-4 sm:p-5">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Réseaux sociaux</h3>
                      <div className="flex flex-col gap-2">
                        {Object.entries(SOCIAL_ICONS).map(([key, { icon: Icon, color, label }]) => {
                          const url = socialLinks[key];
                          if (!url) return null;
                          const href = url.startsWith('http') ? url : `https://${url}`;
                          return (
                            <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 hover:border-white/15 transition-all group">
                              <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color }} />
                              <span className="text-xs sm:text-sm text-gray-300 group-hover:text-white transition-colors flex-1 truncate">{url}</span>
                              <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {songs.length > 0 && (() => {
                    const genres = [...new Set(songs.map(s => s.genre).filter(Boolean))];
                    if (!genres.length) return null;
                    return (
                      <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-4 sm:p-5">
                        <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Genres</h3>
                        <div className="flex flex-wrap gap-2">
                          {genres.map(g => (
                            <span key={g} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{g}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* — Abonnés — */}
              {activeTab === 'followers' && (
                <motion.div key="followers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  {followers.length === 0 ? (
                    <div className="text-center py-12 sm:py-16 bg-gray-900/30 border border-gray-800 rounded-2xl">
                      <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500">Aucun abonné pour l'instant.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {followers.map(follow => {
                        const u = follow.user;
                        if (!u) return null;
                        return (
                          <Link key={follow.follower_id} to={`/artist/${follow.follower_id}`}
                            className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-900/60 border border-white/8 rounded-xl hover:bg-gray-800/80 hover:border-white/15 transition-all group">
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt={u.username} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0 border border-white/10" />
                              : <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 border border-white/10"><User className="w-4 h-4 text-gray-500" /></div>
                            }
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-xs sm:text-sm font-semibold truncate group-hover:text-cyan-400 transition-colors">{u.username || 'Utilisateur'}</p>
                              <p className="text-gray-600 text-[10px] sm:text-xs">{new Date(follow.created_at).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <Footer />
      </div>

      <AnimatePresence>
        {showShare && artist && <ArtistShareModal artist={artist} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
    </>
  );
};

export default ArtistProfilePage;
