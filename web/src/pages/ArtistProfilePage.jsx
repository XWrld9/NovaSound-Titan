import React, { useState, useEffect, useRef } from 'react';
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
import { Music, User, Users, Headphones, Calendar, Share2 } from 'lucide-react';
import { formatPlays } from '@/lib/utils';
import { toPng } from 'html-to-image';


/* ══════════════════════════════════════════════════
   SHARE MODAL ARTISTE — Style Spotify
   ══════════════════════════════════════════════════ */
const ARTIST_SHARE_THEMES = [
  { id: 'dark',   bg: 'linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)', logo: '#22d3ee' },
  { id: 'fire',   bg: 'linear-gradient(160deg,#1a0505 0%,#3d0b0b 50%,#7f1d1d 100%)', logo: '#f87171' },
  { id: 'forest', bg: 'linear-gradient(160deg,#052e16 0%,#14532d 50%,#166534 100%)', logo: '#4ade80' },
  { id: 'gold',   bg: 'linear-gradient(160deg,#1c1400 0%,#3d2e00 50%,#78570a 100%)', logo: '#fbbf24' },
];

/* ── Helpers partagés (logo local, data URL image, wait) ── */
const loadLocalLogo = () =>
  fetch('/icon-192.png')
    .then((r) => r.blob())
    .then((blob) => new Promise((res) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);

const toDataUrl = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
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
  return Promise.all(imgs.map((img) =>
    img.complete ? Promise.resolve()
      : new Promise((res) => { img.onload = res; img.onerror = res; })
  ));
};

const dataUrlToBlob = (dataUrl) => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]); let n = bstr.length;
  const u8 = new Uint8Array(n);
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

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* Charger logo local (zéro CORS) */
  useEffect(() => { loadLocalLogo().then(setLogoDataUrl); }, []);

  /* Convertir avatar en data URL pour éviter CORS dans canvas */
  useEffect(() => {
    if (artist.avatar_url) toDataUrl(artist.avatar_url).then(setAvatarDataUrl);
    else setAvatarDataUrl(null);
  }, [artist.avatar_url]);

  /* Regénérer quand logo ou thème change */
  useEffect(() => {
    if (!logoDataUrl) return;
    const t = setTimeout(generateCard, 200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, logoDataUrl, avatarDataUrl]);

  const generateCard = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      await waitForImages(cardRef.current);
      await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      setCardImg(dataUrl);
    } catch (e) { console.warn('[NovaSound] html-to-image:', e); }
    finally { setGenerating(false); }
  };

  const shareCardImage = async () => {
    if (!cardImg) { shareLink(); return; }
    const blob = dataUrlToBlob(cardImg);
    const file = new File([blob], `${artist.username}-novasound.png`, { type: 'image/png' });
    if (navigator.share) {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: artist.username, text: `🎵 Découvre ${artist.username} sur NovaSound TITAN LUX\n${shareUrl}` });
          return;
        } catch (err) { if (err.name === 'AbortError') return; }
      }
      try {
        await navigator.share({ title: artist.username, text: `🎵 Découvre ${artist.username} sur NovaSound TITAN LUX`, url: shareUrl });
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = cardImg; a.download = `${artist.username}-novasound.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: artist.username, text: `🎵 Découvre ${artist.username} sur NovaSound TITAN LUX`, url: shareUrl }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    copyLink();
  };

  const shareApps = [
    { id: 'copy', label: 'Copier le\nlien', bg: '#ffffff', color: '#111',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22}}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
      action: copyLink },
    { id: 'whatsapp', label: 'WhatsApp', bg: '#25D366', color: '#fff',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:22,height:22}}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>,
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`🎵 Découvre ${artist.username} sur NovaSound TITAN LUX\n${shareUrl}`)}`, '_blank') },
    { id: 'instagram', label: 'Stories', bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:22,height:22}}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
      action: shareCardImage },
    { id: 'sms', label: 'SMS', bg: '#4ade80', color: '#052e16',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:22,height:22}}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>,
      action: () => window.open(`sms:?&body=${encodeURIComponent(`🎵 Découvre ${artist.username} sur NovaSound TITAN LUX — ${shareUrl}`)}`, '_self') },
    { id: 'snapchat', label: 'Snapchat', bg: '#FFFC00', color: '#111',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:20,height:20}}><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l.003.06c-.012.249-.023.496-.029.74.171.083.36.126.55.124.44-.007.898-.201 1.325-.562.201-.168.395-.246.564-.246.169 0 .32.06.441.162.302.254.343.742.093 1.08-.222.301-1.374 1.424-3.744 1.524-.009.008-.018.015-.027.023a21.21 21.21 0 0 1-.04.29c-.038.251-.073.479-.073.545.006.166.055.316.147.457.12.185.287.357.464.54.227.233.476.489.67.774.18.267.197.533.047.741-.15.207-.419.3-.734.3-.315 0-.597-.093-.818-.268a3.553 3.553 0 0 1-.357-.317 3.558 3.558 0 0 0-.267-.261c-.245-.214-.494-.313-.753-.313-.225 0-.469.076-.724.225-.524.305-1.155.458-1.876.458-.72 0-1.351-.153-1.876-.458-.255-.149-.499-.225-.724-.225-.259 0-.508.099-.753.313a3.558 3.558 0 0 0-.267.261 3.553 3.553 0 0 1-.357.317c-.221.175-.503.268-.818.268-.315 0-.584-.093-.734-.3-.15-.208-.133-.474.047-.741.194-.285.443-.541.67-.774.177-.183.344-.355.464-.54.092-.141.141-.291.147-.457 0-.066-.035-.294-.073-.545a21.21 21.21 0 0 1-.04-.29c-.009-.008-.018-.015-.027-.023C5.377 12.476 4.225 11.353 4.003 11.052c-.25-.338-.209-.826.093-1.08.121-.102.272-.162.441-.162.169 0 .363.078.564.246.427.361.885.555 1.325.562.19.002.379-.041.55-.124l.003-.06c-.104-1.628-.23-3.654.299-4.847C8.859 1.069 12.216.793 13.206.793z"/></svg>,
      action: shareCardImage },
    { id: 'tiktok', label: 'TikTok', bg: '#111', color: '#fff',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:20,height:20}}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.56V6.79a4.85 4.85 0 0 1-1.07-.1z"/></svg>,
      action: shareCardImage },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        className="w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col"
        style={{ background: '#1c1c1c', paddingBottom: 'env(safe-area-inset-bottom, 12px)', maxHeight: '92dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }} />
        </div>

        {/* Carte artiste */}
        <div className="flex flex-col items-center px-5 pt-4 pb-3 flex-shrink-0">
          <div ref={cardRef} style={{ width: 280, borderRadius: 16, overflow: 'hidden', background: theme.bg, fontFamily: 'system-ui,-apple-system,sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            {/* Avatar — data URL = zéro CORS dans canvas */}
            <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)' }}>
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt={artist.username} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : artist.avatar_url ? (
                <img src={artist.avatar_url} alt={artist.username} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : logoDataUrl ? (
                <img src={logoDataUrl} alt="NovaSound" style={{ width: 80, height: 80, borderRadius: '50%', opacity: 0.5 }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: theme.logo, opacity: 0.4 }} />
              )}
            </div>
            <div style={{ padding: '12px 14px 14px', background: 'rgba(0,0,0,0.45)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.3, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.username}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '0 0 10px' }}>Artiste · NovaSound TITAN LUX</p>
              {/* Logo local = zéro CORS, visible partout */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {logoDataUrl
                  ? <img src={logoDataUrl} alt="NovaSound" style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${theme.logo}`, flexShrink: 0, objectFit: 'cover' }} />
                  : <div style={{ width: 20, height: 20, borderRadius: '50%', background: theme.logo, flexShrink: 0 }} />
                }
                <span style={{ color: theme.logo, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>NovaSound TITAN LUX</span>
              </div>
            </div>
          </div>

          {/* Pastilles */}
          <div className="flex items-center gap-3 mt-3">
            {ARTIST_SHARE_THEMES.map((t) => (
              <button key={t.id} onClick={() => setTheme(t)} style={{ width: 26, height: 26, borderRadius: '50%', background: t.bg, border: theme.id === t.id ? '2.5px solid #fff' : '2.5px solid transparent', outline: theme.id === t.id ? '2px solid rgba(255,255,255,0.35)' : 'none', cursor: 'pointer', flexShrink: 0 }} />
            ))}
            {generating && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'rgba(255,255,255,0.8)', animation: 'spin 0.7s linear infinite', marginLeft: 4 }} />}
          </div>
        </div>

        {/* Apps */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {shareApps.map((app) => (
              <button key={app.id} onClick={app.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 58, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: app.bg, color: app.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  {app.id === 'copy' && copied ? <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22}}><polyline points="20 6 9 17 4 12"/></svg> : app.icon}
                </div>
                <span style={{ fontSize: 10, color: app.id === 'copy' && copied ? '#22d3ee' : 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line', maxWidth: 56 }}>
                  {app.id === 'copy' && copied ? 'Copié !' : app.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-0 pb-2 flex-shrink-0">
          <button onClick={shareCardImage} disabled={generating || !cardImg}
            style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: generating || !cardImg ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: generating || !cardImg ? 'default' : 'pointer', opacity: generating || !cardImg ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {generating ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />Génération…</> : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Partager la carte</>}
          </button>
        </div>
        <div className="px-4 pb-2 flex-shrink-0">
          <button onClick={onClose} style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ArtistProfilePage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  const { playSong: globalPlaySong, currentSong } = usePlayer();

  // Lance la lecture depuis le profil artiste — passe toute la discographie au player global
  const playSong = (song) => {
    globalPlaySong(song, songs.filter(s => !s.is_archived));
  };

  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (id) {
      fetchArtistData();
      fetchFollowers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchArtistData = async () => {
    try {
      setLoading(true);
      const [{ data: artistData, error: artistError }, { data: songsData, error: songsError }] = await Promise.all([
        supabase.from('users').select('*').eq('id', id).single(),
        supabase.from('songs').select('*').eq('uploader_id', id).eq('is_archived', false).order('plays_count', { ascending: false }).limit(50)
      ]);
      if (artistError) throw artistError;
      if (songsError) throw songsError;
      setArtist(artistData);
      setSongs(songsData || []);
    } catch (error) {
      console.error('Erreur chargement artiste:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowers = async () => {
    try {
      const { data: followsData } = await supabase
        .from('follows').select('follower_id, created_at').eq('following_id', id);
      if (!followsData?.length) { setFollowers([]); return; }

      const followerIds = followsData.map(f => f.follower_id);
      const { data: usersData } = await supabase
        .from('users').select('id, username, avatar_url').in('id', followerIds);

      const byId = new Map((usersData || []).map(u => [u.id, u]));
      setFollowers(followsData.map(f => ({ ...f, user: byId.get(f.follower_id) || null })));
    } catch (error) {
      console.error('Erreur chargement abonnés:', error);
    }
  };

  // Calcul total écoutes
  const totalPlays = songs.reduce((sum, s) => sum + (s.plays_count || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Artiste introuvable</p>
            <Link to="/" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">← Retour à l'accueil</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isOwnProfile = currentUser && currentUser.id === artist.id;

  return (
    <>
      <Helmet>
        <title>{`${artist.username || 'Artiste'} — NovaSound TITAN LUX`}</title>
        <meta name="description" content={artist.bio || `Découvrez les morceaux de ${artist.username}`} />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">

          {/* ── Header artiste ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-cyan-950/30 rounded-2xl p-6 md:p-8 mb-8 border border-cyan-500/20 overflow-hidden"
          >
            {/* Fond décoratif */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-magenta-500/8 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
              {/* Avatar */}
              {artist.avatar_url ? (
                <img
                  src={artist.avatar_url}
                  alt={artist.username}
                  className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-cyan-500/50 shadow-xl shadow-cyan-500/20 flex-shrink-0"
                />
              ) : (
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center border-4 border-cyan-500/50 shadow-xl flex-shrink-0">
                  <Music className="w-14 h-14 text-white" />
                </div>
              )}

              {/* Infos */}
              <div className="flex-1 text-center md:text-left min-w-0 w-full overflow-hidden">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 break-words truncate">
                  {artist.username || 'Artiste inconnu'}
                </h1>
                {artist.bio && (
                  <div className="mb-4 max-w-lg">
                    <p className={`text-gray-400 text-sm leading-relaxed break-words ${bioExpanded ? '' : 'line-clamp-3'}`}>
                      {artist.bio}
                    </p>
                    {artist.bio.length > 120 && (
                      <button
                        onClick={() => setBioExpanded(!bioExpanded)}
                        className="text-cyan-400 text-xs mt-1 hover:text-cyan-300 transition-colors font-medium"
                      >
                        {bioExpanded ? 'Réduire ▲' : 'Lire la suite ▼'}
                      </button>
                    )}
                  </div>
                )}

                {/* Stats — Carte visuelle v30 */}
                <div className="mb-5 w-full">
                  <ArtistStatsCard songs={songs} followersCount={followers.length} />
                </div>

                {/* Boutons d'action — flex-wrap pour mobile */}
                <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mt-1">
                  {/* Follow — seulement si ce n'est pas son propre profil */}
                  {!isOwnProfile && currentUser && (
                    <FollowButton
                      userId={artist.id}
                      initialFollowers={followers.length}
                      onFollowChange={(nowFollowing, newCount) => {
                        fetchFollowers();
                      }}
                    />
                  )}
                  {isOwnProfile && (
                    <Link to="/profile" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white text-sm transition-all">
                      ✏️ Modifier mon profil
                    </Link>
                  )}
                  {!currentUser && (
                    <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 text-sm transition-all">
                      Se connecter pour s'abonner
                    </Link>
                  )}
                  {/* Bouton Partager — toujours visible, pour tous */}
                  <button
                    onClick={() => setShowShare(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Partager
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Contenu en 2 colonnes ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Morceaux */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <Music className="w-5 h-5 text-cyan-400" />
                Morceaux
                <span className="text-sm text-gray-500 font-normal ml-1">({songs.length})</span>
              </h2>

              {songs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {songs.map((song, i) => (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <SongCard
                        song={song}
                        onPlay={playSong}
                        isPlaying={currentSong?.id === song.id}
                        onArchived={(id) => setSongs(prev => prev.filter(s => s.id !== id))}
                        onDeleted={(id) => setSongs(prev => prev.filter(s => s.id !== id))}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-14 bg-gray-900/40 border border-gray-800 rounded-2xl">
                  <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun morceau uploadé pour l'instant.</p>
                </div>
              )}
            </div>

            {/* Abonnés */}
            <div>
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <Users className="w-5 h-5 text-fuchsia-400" />
                Abonnés
                <span className="text-sm text-gray-500 font-normal ml-1">({followers.length})</span>
              </h2>

              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 max-h-[500px] overflow-y-auto space-y-3">
                {followers.length > 0 ? (
                  followers.map((follow) => {
                    const u = follow.user;
                    if (!u) return null;
                    return (
                      <Link
                        key={follow.follower_id}
                        to={`/artist/${follow.follower_id}`}
                        className="flex items-center gap-3 p-2 hover:bg-gray-800/60 rounded-xl transition-colors group"
                      >
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate group-hover:text-cyan-400 transition-colors">
                            {u.username || 'Utilisateur'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Date(follow.created_at || Date.now()).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Aucun abonné pour l'instant.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Share Modal Artiste */}
      <AnimatePresence>
        {showShare && artist && <ArtistShareModal artist={artist} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
    </>
  );
};

export default ArtistProfilePage;
