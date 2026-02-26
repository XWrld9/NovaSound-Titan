import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import LikeButton from '@/components/LikeButton';
import { formatPlays } from '@/lib/utils';
import {
  Music, Play, Headphones, Calendar, ArrowLeft, Share2, User,
  Link as LinkIcon, Check, X
} from 'lucide-react';

/* ══════════════════════════════════════════════════
   SHARE MODAL — Style Spotify (identique à AudioPlayer)
   ══════════════════════════════════════════════════ */
const SHARE_THEMES = [
  { id: 'dark',   bg: 'linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)', logo: '#22d3ee' },
  { id: 'fire',   bg: 'linear-gradient(160deg,#1a0505 0%,#3d0b0b 50%,#7f1d1d 100%)', logo: '#f87171' },
  { id: 'forest', bg: 'linear-gradient(160deg,#052e16 0%,#14532d 50%,#166534 100%)', logo: '#4ade80' },
  { id: 'gold',   bg: 'linear-gradient(160deg,#1c1400 0%,#3d2e00 50%,#78570a 100%)', logo: '#fbbf24' },
];

const SongShareModal = ({ song, onClose }) => {
  const cardRef = React.useRef(null);
  const [theme, setTheme] = useState(SHARE_THEMES[0]);
  const [cardImg, setCardImg] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}${window.location.pathname}#/song/${song.id}`;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const t = setTimeout(generateCard, 200);
    return () => clearTimeout(t);
  }, [theme, song]);

  const generateCard = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      setCardImg(dataUrl);
    } catch (e) { console.warn('[NovaSound] html-to-image:', e); }
    finally { setGenerating(false); }
  };

  const dataUrlToBlob = (dataUrl) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  };

  const shareCardImage = async () => {
    if (!cardImg) { shareLink(); return; }
    const blob = dataUrlToBlob(cardImg);
    const file = new File([blob], `${song.title}-novasound.png`, { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: song.title,
          text: `🎵 Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX\n${shareUrl}`,
        });
        return;
      }
    } catch (err) { if (err.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = cardImg; a.download = `${song.title}-novasound.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: song.title, text: `🎵 Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX`, url: shareUrl }); return; }
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
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`🎵 Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX\n${shareUrl}`)}`, '_blank') },
    { id: 'instagram', label: 'Stories', bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:22,height:22}}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
      action: shareCardImage },
    { id: 'sms', label: 'SMS', bg: '#4ade80', color: '#052e16',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:22,height:22}}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>,
      action: () => window.open(`sms:?&body=${encodeURIComponent(`🎵 "${song.title}" par ${song.artist} — ${shareUrl}`)}`, '_self') },
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
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }} />
        </div>

        {/* Carte preview */}
        <div className="flex flex-col items-center px-5 pt-4 pb-3 flex-shrink-0">
          <div ref={cardRef} style={{ width: 280, borderRadius: 16, overflow: 'hidden', background: theme.bg, fontFamily: 'system-ui,-apple-system,sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden' }}>
              {song.cover_url ? (
                <img src={song.cover_url} alt={song.title} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)' }}>
                  <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg" alt="NovaSound" crossOrigin="anonymous" style={{ width: 56, height: 56, borderRadius: '50%', opacity: 0.6 }} />
                </div>
              )}
            </div>
            <div style={{ padding: '12px 14px 14px', background: 'rgba(0,0,0,0.45)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.3, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg" alt="NovaSound" crossOrigin="anonymous" style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${theme.logo}`, flexShrink: 0 }} />
                <span style={{ color: theme.logo, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>NovaSound TITAN LUX</span>
              </div>
            </div>
          </div>

          {/* Pastilles */}
          <div className="flex items-center gap-3 mt-3">
            {SHARE_THEMES.map((t) => (
              <button key={t.id} onClick={() => setTheme(t)} style={{ width: 26, height: 26, borderRadius: '50%', background: t.bg, border: theme.id === t.id ? '2.5px solid #fff' : '2.5px solid transparent', outline: theme.id === t.id ? '2px solid rgba(255,255,255,0.35)' : 'none', cursor: 'pointer', flexShrink: 0, transition: 'outline 0.15s' }} />
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

        {/* Bouton partager la carte */}
        <div className="px-4 pt-0 pb-2 flex-shrink-0">
          <button onClick={shareCardImage} disabled={generating || !cardImg}
            style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: generating || !cardImg ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: generating || !cardImg ? 'default' : 'pointer', opacity: generating || !cardImg ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {generating ? (
              <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />Génération…</>
            ) : (
              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Partager la carte</>
            )}
          </button>
        </div>
        <div className="px-4 pb-2 flex-shrink-0">
          <button onClick={onClose} style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════════════
   SONG PAGE
   ══════════════════════════════════════════════════ */
const SongPage = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [song, setSong]         = useState(null);
  const [artist, setArtist]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [playing, setPlaying]   = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Fix bouton retour : si pas d'historique → accueil
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  // Fermer player via croix
  useEffect(() => {
    const handler = () => setPlaying(false);
    window.addEventListener('novasound:close-player', handler);
    return () => window.removeEventListener('novasound:close-player', handler);
  }, []);

  useEffect(() => {
    if (id) fetchSong();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSong = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('songs').select('*').eq('id', id).single();
      if (error || !data) { navigate('/', { replace: true }); return; }
      setSong(data);
      if (data.uploader_id) {
        const { data: userData } = await supabase.from('users').select('id, username, avatar_url').eq('id', data.uploader_id).single();
        setArtist(userData || null);
      }
    } catch { navigate('/', { replace: true }); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!song) return null;

  const coverUrl  = song.cover_url || null;
  const pageUrl   = `${window.location.origin}/#/song/${id}`;
  const ogImage   = coverUrl || `${window.location.origin}/background.png`;
  const formattedDate = song.created_at ? new Date(song.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  return (
    <>
      <Helmet>
        <title>{`${song.title} — ${song.artist} · NovaSound TITAN LUX`}</title>
        <meta name="description" content={`Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX`} />
        <meta property="og:type"         content="music.song" />
        <meta property="og:url"          content={pageUrl} />
        <meta property="og:title"        content={`${song.title} — ${song.artist}`} />
        <meta property="og:description"  content={`🎵 Écoute sur NovaSound TITAN LUX`} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name"    content="NovaSound TITAN LUX" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${song.title} — ${song.artist}`} />
        <meta name="twitter:description" content={`🎵 Écoute sur NovaSound TITAN LUX`} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">

          {/* Retour — fix : toujours fonctionnel */}
          <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Retour</span>
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900/60 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl">
            {/* Pochette */}
            <div className="relative aspect-square max-h-[420px] overflow-hidden">
              {coverUrl ? (
                <img src={coverUrl} alt={song.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-600/30 to-magenta-600/30 flex items-center justify-center">
                  <Music className="w-32 h-32 text-cyan-400/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              <button onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="p-5 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 shadow-xl shadow-cyan-500/40 transform hover:scale-110 transition-transform">
                  <Play className="w-10 h-10 text-white fill-current" />
                </div>
              </button>
            </div>

            {/* Infos */}
            <div className="p-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">{song.title}</h1>

              {artist ? (
                <Link to={`/artist/${artist.id}`} className="flex items-center gap-2 mt-2 mb-5 group w-fit">
                  {artist.avatar_url ? (
                    <img src={artist.avatar_url} alt={artist.username} className="w-7 h-7 rounded-full object-cover border border-cyan-500/30" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                  <span className="text-cyan-400 group-hover:text-cyan-300 transition-colors font-medium">{artist.username || song.artist}</span>
                </Link>
              ) : (
                <p className="text-gray-400 mt-2 mb-5">{song.artist}</p>
              )}

              <div className="flex items-center gap-6 mb-6 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-4 h-4 text-cyan-500/70" />
                  <span>{formatPlays(song.plays_count)} écoutes</span>
                </div>
                {formattedDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <span>{formattedDate}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <LikeButton songId={song.id} initialLikes={song.likes_count || 0} />
                {/* Bouton Partager → ShareModal Spotify */}
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-sm font-medium"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Partager</span>
                </button>
                <button onClick={() => setPlaying(true)} className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity ml-auto">
                  <Play className="w-4 h-4 fill-current" />
                  <span>Écouter</span>
                </button>
              </div>
            </div>
          </motion.div>
        </main>

        <Footer />
        {playing && <AudioPlayer currentSong={song} />}
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && <SongShareModal song={song} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
    </>
  );
};

export default SongPage;
