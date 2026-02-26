import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Shuffle, Repeat, Music, ChevronDown, Heart, Download, Share2,
  UserPlus, UserCheck, ExternalLink, X, Maximize2,
  Copy, Check, Link2, Twitter, Facebook, MessageCircle
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LottieAnimation from '@/components/LottieAnimation';
import playAnimation from '@/animations/play-animation.json';
import { useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';


/* ═══════════════════════════════════════════
   MODAL DE PARTAGE STYLE SPOTIFY
   ═══════════════════════════════════════════ */

// Thèmes de couleur pour la carte (pastilles)
const SHARE_THEMES = [
  { id: 'dark',   bg: 'linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)', logo: '#22d3ee' },
  { id: 'fire',   bg: 'linear-gradient(160deg,#1a0505 0%,#3d0b0b 50%,#7f1d1d 100%)', logo: '#f87171' },
  { id: 'forest', bg: 'linear-gradient(160deg,#052e16 0%,#14532d 50%,#166534 100%)', logo: '#4ade80' },
  { id: 'gold',   bg: 'linear-gradient(160deg,#1c1400 0%,#3d2e00 50%,#78570a 100%)', logo: '#fbbf24' },
];

const ShareModal = ({ song, onClose }) => {
  const cardRef = React.useRef(null);
  const [theme, setTheme] = React.useState(SHARE_THEMES[0]);
  const [cardImg, setCardImg] = React.useState(null);
  const [generating, setGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const shareUrl = `${window.location.origin}${window.location.pathname}#/song/${song.id}`;

  // Génère la carte-image dès que le thème/song change
  React.useEffect(() => {
    const t = setTimeout(generateCard, 200);
    return () => clearTimeout(t);
  }, [theme, song]);

  const generateCard = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      // Double pass pour laisser les images se charger
      await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      setCardImg(dataUrl);
    } catch (e) {
      console.warn('[NovaSound] html-to-image error:', e);
    } finally {
      setGenerating(false);
    }
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

  // Partager l'image-carte (Web Share API level 2 — iOS 15+, Android Chrome)
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
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
    // Fallback desktop : télécharge l'image
    const a = document.createElement('a');
    a.href = cardImg;
    a.download = `${song.title}-novasound.png`;
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
      try {
        await navigator.share({
          title: song.title,
          text: `🎵 Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX`,
          url: shareUrl,
        });
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    copyLink();
  };

  // Apps de partage directes
  const shareApps = [
    {
      id: 'copy', label: 'Copier le\nlien',
      bg: '#ffffff', color: '#111',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{width:24,height:24}}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      ),
      action: copyLink,
    },
    {
      id: 'whatsapp', label: 'WhatsApp',
      bg: '#25D366', color: '#fff',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:24,height:24}}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>,
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`🎵 Écoute "${song.title}" par ${song.artist} sur NovaSound TITAN LUX\n${shareUrl}`)}`, '_blank'),
    },
    {
      id: 'instagram', label: 'Stories',
      bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:24,height:24}}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
      action: shareCardImage,
    },
    {
      id: 'sms', label: 'SMS',
      bg: '#4ade80', color: '#052e16',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:24,height:24}}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>,
      action: () => window.open(`sms:?&body=${encodeURIComponent(`🎵 "${song.title}" par ${song.artist} — ${shareUrl}`)}`, '_self'),
    },
    {
      id: 'snapchat', label: 'Snapchat',
      bg: '#FFFC00', color: '#111',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:22,height:22}}><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l.003.06c-.012.249-.023.496-.029.74.171.083.36.126.55.124.44-.007.898-.201 1.325-.562.201-.168.395-.246.564-.246.169 0 .32.06.441.162.302.254.343.742.093 1.08-.222.301-1.374 1.424-3.744 1.524-.009.008-.018.015-.027.023a21.21 21.21 0 0 1-.04.29c-.038.251-.073.479-.073.545.006.166.055.316.147.457.12.185.287.357.464.54.227.233.476.489.67.774.18.267.197.533.047.741-.15.207-.419.3-.734.3-.315 0-.597-.093-.818-.268a3.553 3.553 0 0 1-.357-.317 3.558 3.558 0 0 0-.267-.261c-.245-.214-.494-.313-.753-.313-.225 0-.469.076-.724.225-.524.305-1.155.458-1.876.458-.72 0-1.351-.153-1.876-.458-.255-.149-.499-.225-.724-.225-.259 0-.508.099-.753.313a3.558 3.558 0 0 0-.267.261 3.553 3.553 0 0 1-.357.317c-.221.175-.503.268-.818.268-.315 0-.584-.093-.734-.3-.15-.208-.133-.474.047-.741.194-.285.443-.541.67-.774.177-.183.344-.355.464-.54.092-.141.141-.291.147-.457 0-.066-.035-.294-.073-.545a21.21 21.21 0 0 1-.04-.29c-.009-.008-.018-.015-.027-.023C5.377 12.476 4.225 11.353 4.003 11.052c-.25-.338-.209-.826.093-1.08.121-.102.272-.162.441-.162.169 0 .363.078.564.246.427.361.885.555 1.325.562.19.002.379-.041.55-.124l.003-.06c-.104-1.628-.23-3.654.299-4.847C8.859 1.069 12.216.793 13.206.793z"/></svg>,
      action: shareCardImage,
    },
    {
      id: 'tiktok', label: 'TikTok',
      bg: '#111', color: '#fff',
      icon: <svg viewBox="0 0 24 24" fill="currentColor" style={{width:22,height:22}}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.56V6.79a4.85 4.85 0 0 1-1.07-.1z"/></svg>,
      action: shareCardImage,
    },
  ];

  return (
    <motion.div
      key="share-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        className="w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          background: '#1c1c1c',
          paddingBottom: 'env(safe-area-inset-bottom, 12px)',
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }} />
        </div>

        {/* ── CARTE PREVIEW — capturée par html-to-image ── */}
        <div className="flex flex-col items-center px-5 pt-4 pb-3 flex-shrink-0">
          {/* Zone de carte (DOM → image) */}
          <div
            ref={cardRef}
            style={{
              width: 280,
              borderRadius: 16,
              overflow: 'hidden',
              background: theme.bg,
              fontFamily: 'system-ui,-apple-system,sans-serif',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}
          >
            {/* Pochette grande */}
            <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', position: 'relative' }}>
              {song.cover_url ? (
                <img
                  src={song.cover_url}
                  alt={song.title}
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(255,255,255,0.06)' }}>
                  <img
                    src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
                    alt="NovaSound"
                    crossOrigin="anonymous"
                    style={{ width: 56, height: 56, borderRadius: '50%', opacity: 0.6 }}
                  />
                </div>
              )}
            </div>
            {/* Infos sous la pochette */}
            <div style={{ padding: '12px 14px 14px', background: 'rgba(0,0,0,0.45)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.3, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <img
                  src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
                  alt="NovaSound"
                  crossOrigin="anonymous"
                  style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${theme.logo}`, flexShrink: 0, display: 'block' }}
                />
                <span style={{ color: theme.logo, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>NovaSound TITAN LUX</span>
              </div>
            </div>
          </div>

          {/* Pastilles de thème + spinner */}
          <div className="flex items-center gap-3 mt-3">
            {SHARE_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t)}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: t.bg,
                  border: theme.id === t.id ? '2.5px solid #fff' : '2.5px solid transparent',
                  outline: theme.id === t.id ? '2px solid rgba(255,255,255,0.35)' : 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'outline 0.15s',
                }}
              />
            ))}
            {generating && (
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'rgba(255,255,255,0.8)', animation: 'spin 0.7s linear infinite', marginLeft: 4 }} />
            )}
          </div>
        </div>

        {/* ── RANGÉE D'APPS ── */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {shareApps.map((app) => (
              <button
                key={app.id}
                onClick={app.action}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 58, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: app.bg,
                  color: app.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  transition: 'transform 0.1s',
                }}>
                  {app.id === 'copy' && copied ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22}}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : app.icon}
                </div>
                <span style={{
                  fontSize: 10, color: app.id === 'copy' && copied ? '#22d3ee' : 'rgba(255,255,255,0.75)',
                  textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line', maxWidth: 56
                }}>
                  {app.id === 'copy' && copied ? 'Copié !' : app.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── BOUTON PARTAGER LA CARTE ── */}
        <div className="px-4 pt-0 pb-2 flex-shrink-0">
          <button
            onClick={shareCardImage}
            disabled={generating || !cardImg}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              background: generating || !cardImg ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#22d3ee,#a855f7)',
              color: '#fff', fontWeight: 600, fontSize: 14,
              border: 'none', cursor: generating || !cardImg ? 'default' : 'pointer',
              opacity: generating || !cardImg ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.2s',
            }}
          >
            {generating ? (
              <>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                Génération en cours…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Partager la carte
              </>
            )}
          </button>
        </div>

        {/* Annuler */}
        <div className="px-4 pb-2 flex-shrink-0">
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 14,
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)',
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            Annuler
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const AudioPlayer = ({ currentSong, playlist = [], onNext, onPrevious }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(70);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [isExpanded, setIsExpanded] = useState(false);
  const [playRecorded, setPlayRecorded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isExpanded ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isExpanded]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current && currentSong?.audio_url) {
      audioRef.current.src = currentSong.audio_url;
      audioRef.current.load();
      setPlayRecorded(false);
      setIsPlaying(false);
      if (currentUser) { checkLikeStatus(); checkFollowStatus(); }
      else { setIsLiked(false); setLikeId(null); setIsFollowing(false); setFollowId(null); }
    }
  }, [currentSong]);

  const checkLikeStatus = async () => {
    try {
      const { data } = await supabase.from('likes').select('id')
        .eq('user_id', currentUser.id).eq('song_id', currentSong.id).maybeSingle();
      setIsLiked(!!data); setLikeId(data?.id || null);
    } catch {}
  };

  const checkFollowStatus = async () => {
    const uid = currentSong?.uploader_id;
    if (!uid || uid === currentUser.id) return;
    try {
      const { data } = await supabase.from('follows').select('id')
        .eq('follower_id', currentUser.id).eq('following_id', uid).maybeSingle();
      setIsFollowing(!!data); setFollowId(data?.id || null);
    } catch {}
  };

  const handleLike = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    try {
      if (isLiked && likeId) {
        await supabase.from('likes').delete().eq('id', likeId);
        setIsLiked(false); setLikeId(null);
      } else {
        const { data } = await supabase.from('likes')
          .insert({ user_id: currentUser.id, song_id: currentSong.id }).select('id').single();
        setIsLiked(true); setLikeId(data?.id || null);
      }
    } catch {}
  };

  const handleFollow = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    const uid = currentSong?.uploader_id;
    if (!uid || uid === currentUser.id) return;
    try {
      if (isFollowing && followId) {
        await supabase.from('follows').delete().eq('id', followId);
        setIsFollowing(false); setFollowId(null);
      } else {
        const { data } = await supabase.from('follows')
          .insert({ follower_id: currentUser.id, following_id: uid }).select('id').single();
        setIsFollowing(true); setFollowId(data?.id || null);
      }
    } catch {}
  };

  const handleDownload = (e) => {
    e?.stopPropagation();
    if (!currentSong.audio_url) return;
    const a = document.createElement('a');
    a.href = currentSong.audio_url; a.download = currentSong.title;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleShare = (e) => {
    e?.stopPropagation();
    setShowShareModal(true);
  };

  const recordPlay = async () => {
    if (playRecorded || !currentSong?.id) return;
    setPlayRecorded(true);
    try {
      const { error } = await supabase.rpc('increment_plays', { song_id_param: currentSong.id });
      if (error) await supabase.from('songs').update({ plays_count: (currentSong.plays_count || 0) + 1 }).eq('id', currentSong.id);
    } catch {}
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (!audioRef.current || !currentSong) return;
    if (isPlaying) { audioRef.current.pause(); }
    else { audioRef.current.play().catch(() => {}); recordPlay(); }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    if (!playRecorded && audioRef.current.currentTime > 10) recordPlay();
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (value) => {
    if (audioRef.current) { audioRef.current.currentTime = value[0]; setCurrentTime(value[0]); }
  };

  const handleVolumeChange = (value) => {
    setVolume(value[0]);
    if (value[0] === 0) setIsMuted(true);
    else if (isMuted) setIsMuted(false);
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    if (!isMuted) { setPrevVolume(volume); setIsMuted(true); }
    else { setIsMuted(false); if (volume === 0) setVolume(prevVolume || 70); }
  };

  const handleEnded = () => {
    if (repeat === 'one') { audioRef.current.currentTime = 0; audioRef.current.play(); }
    else if (repeat === 'all' || playlist.length > 0) onNext?.();
    else setIsPlaying(false);
  };

  const cycleRepeat = (e) => {
    e?.stopPropagation();
    const modes = ['off', 'one', 'all'];
    setRepeat(modes[(modes.indexOf(repeat) + 1) % modes.length]);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 40 ? Volume1 : Volume2;
  const showFollowButton = currentUser && currentSong?.uploader_id && currentSong.uploader_id !== currentUser.id;
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const closePlayer = (e) => { e?.stopPropagation(); window.dispatchEvent(new CustomEvent('novasound:close-player')); };

  if (!currentSong) return null;

  return (
    <>
      {/* ════ AUDIO TAG — TOUJOURS MONTÉ ════ */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
        webkit-playsinline="true"
        style={{ display: 'none' }}
      />

      {/* ════ MODAL DE PARTAGE ════ */}
      <AnimatePresence>
        {showShareModal && (
          <ShareModal song={currentSong} onClose={() => setShowShareModal(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>

      {/* ════════════════════════════════════
          EXPANDED — plein écran (mobile + desktop)
          ════════════════════════════════════ */}
      {isExpanded && (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto"
          style={{
            background: 'linear-gradient(180deg, #0a0f23 0%, #030712 55%)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="absolute inset-0 opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(6,182,212,0.5) 0%, transparent 65%)' }}
          />

          {/* Header */}
          <div className="relative flex items-center justify-between px-5 pt-5 pb-2 z-10"
            style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
          >
            <button onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Réduire</span>
            </button>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">En écoute</p>
            <button onClick={(e) => { closePlayer(e); setIsExpanded(false); }}
              className="p-2 rounded-full bg-gray-800/50 border border-gray-700/40 text-gray-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Layout 2 colonnes sur desktop, 1 colonne sur mobile */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 px-6 pb-8 z-10">

            {/* Pochette */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, type: 'spring', damping: 22 }}
              className="w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10"
            >
              {currentSong.cover_url
                ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                    <Music className="w-24 h-24 text-white/50" />
                  </div>
              }
            </motion.div>

            {/* Contrôles */}
            <div className="flex flex-col gap-5 w-full max-w-sm">

              {/* Titre + artiste + actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-white text-xl sm:text-2xl font-bold leading-tight break-words">{currentSong.title}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className="text-gray-400 text-sm hover:text-white cursor-pointer transition-colors"
                      onClick={() => currentSong?.uploader_id && navigate(`/artist/${currentSong.uploader_id}`)}
                    >
                      {currentSong.artist}
                    </span>
                    {showFollowButton && (
                      <button onClick={handleFollow}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-all flex items-center gap-1 ${
                          isFollowing
                            ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10'
                            : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {isFollowing ? <><UserCheck className="w-3 h-3" />Abonné</> : <><UserPlus className="w-3 h-3" />S'abonner</>}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={handleLike}
                    className={`transition-all active:scale-75 ${isLiked ? 'text-pink-500' : 'text-gray-500 hover:text-pink-400'}`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={handleShare} className="text-gray-500 hover:text-white transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button onClick={handleDownload} className="text-gray-500 hover:text-cyan-400 transition-colors">
                    <Download className="w-5 h-5" />
                  </button>
                  {currentSong?.uploader_id && (
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/artist/${currentSong.uploader_id}`); setIsExpanded(false); }}
                      className="text-gray-500 hover:text-cyan-400 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Seek bar */}
              <div>
                <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                <div className="flex justify-between text-xs text-gray-600 mt-1.5 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex items-center justify-between">
                <button onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
                  className={`p-2 transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                >
                  <Shuffle className="w-5 h-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onPrevious?.(); }}
                  className="p-2 text-gray-300 hover:text-white hover:scale-110 transition-all" disabled={!onPrevious}
                >
                  <SkipBack className="w-7 h-7" />
                </button>
                <button onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-white text-gray-900 hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                  className="p-2 text-gray-300 hover:text-white hover:scale-110 transition-all" disabled={!onNext}
                >
                  <SkipForward className="w-7 h-7" />
                </button>
                <button onClick={cycleRepeat}
                  className={`p-2 relative transition-all ${repeat !== 'off' ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                >
                  <Repeat className="w-5 h-5" />
                  {repeat === 'one' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-cyan-400 leading-none">1</span>}
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                  <VolumeIcon className="w-5 h-5" />
                </button>
                <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="cursor-pointer flex-1" />
                <span className="text-xs text-gray-700 w-6 text-right tabular-nums">{isMuted ? 0 : volume}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════
          MINI PLAYER — barre du bas
          ════════════════════════════════════ */}
      {!isExpanded && (
        <motion.div
          key="mini"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] shadow-2xl"
          style={{
            backgroundColor: 'rgb(18 18 18 / 0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Barre de progression cliquable tout en haut */}
          <div className="w-full h-1 bg-gray-800/80 cursor-pointer group relative"
            onClick={(e) => {
              if (!duration) return;
              const r = e.currentTarget.getBoundingClientRect();
              handleSeek([(e.clientX - r.left) / r.width * duration]);
            }}
          >
            <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-75 group-hover:h-1.5 relative"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* ── MOBILE ── */}
          <div className="md:hidden">
            <div className="flex items-center justify-between px-3 pt-1 pb-0">
              <button onClick={() => setIsExpanded(true)} className="text-gray-600 hover:text-gray-400 transition-colors p-1">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={closePlayer} className="text-gray-600 hover:text-gray-400 transition-colors p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 px-3 pb-2 pt-0.5">
              <div className="flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden cursor-pointer active:opacity-70 transition-opacity"
                onClick={() => setIsExpanded(true)}
              >
                {currentSong.cover_url
                  ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                }
              </div>

              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsExpanded(true)}>
                <div className="text-white text-sm font-semibold flex items-center gap-1 overflow-hidden">
                  <span className="truncate">{currentSong.title}</span>
                  {isPlaying && <LottieAnimation animationData={playAnimation} style={{ width: 16, height: 16 }} loop autoplay className="flex-shrink-0" />}
                </div>
                <div className="text-gray-500 text-xs truncate">{currentSong.artist}</div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={handleLike} className={`p-1.5 ${isLiked ? 'text-pink-500' : 'text-gray-600'}`}>
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onPrevious?.(); }} className="p-1.5 text-gray-500 disabled:opacity-30" disabled={!onPrevious}>
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white text-gray-900 flex items-center justify-center shadow-md active:scale-90 transition-transform"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onNext?.(); }} className="p-1.5 text-gray-500 disabled:opacity-30" disabled={!onNext}>
                  <SkipForward className="w-5 h-5" />
                </button>
                <button onClick={toggleMute} className="p-1.5 text-gray-600">
                  <VolumeIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Durée mobile */}
            <div className="flex justify-between text-[10px] text-gray-700 px-4 pb-1.5 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* ── DESKTOP SPOTIFY 3 COLONNES ── */}
          <div className="hidden md:grid md:grid-cols-3 items-center px-4 py-3 gap-4">

            {/* Gauche : pochette + infos + actions */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden shadow-lg cursor-pointer group"
                onClick={() => setIsExpanded(true)}
              >
                {currentSong.cover_url
                  ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                      <Music className="w-7 h-7 text-white" />
                    </div>
                }
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span
                    className="text-white text-sm font-semibold truncate cursor-pointer hover:underline"
                    onClick={() => setIsExpanded(true)}
                    title={currentSong.title}
                  >
                    {currentSong.title}
                  </span>
                  {isPlaying && <LottieAnimation animationData={playAnimation} style={{ width: 18, height: 18 }} loop autoplay className="flex-shrink-0 opacity-80" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="text-gray-500 text-xs truncate hover:text-white cursor-pointer transition-colors"
                    onClick={() => currentSong?.uploader_id && navigate(`/artist/${currentSong.uploader_id}`)}
                  >
                    {currentSong.artist}
                  </span>
                  {showFollowButton && (
                    <button onClick={handleFollow}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-all flex items-center gap-0.5 flex-shrink-0 ${
                        isFollowing
                          ? 'border-cyan-500/50 text-cyan-400'
                          : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {isFollowing ? <><UserCheck className="w-2.5 h-2.5" />Abonné</> : <><UserPlus className="w-2.5 h-2.5" />+Suivre</>}
                    </button>
                  )}
                </div>
              </div>

              {/* Actions + croix */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={handleLike}
                  className={`p-1.5 rounded-full transition-all ${isLiked ? 'text-pink-500' : 'text-gray-700 hover:text-pink-400'}`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
                <button onClick={handleShare} className="p-1.5 rounded-full text-gray-700 hover:text-white transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={handleDownload} className="p-1.5 rounded-full text-gray-700 hover:text-cyan-400 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={closePlayer}
                  className="p-1.5 rounded-full text-gray-700 hover:text-gray-400 hover:bg-gray-800 transition-all"
                  title="Fermer le lecteur"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Centre : contrôles + seek */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-4">
                <button onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
                  className={`transition-all ${shuffle ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                  title="Aléatoire"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button onClick={(e) => { e.stopPropagation(); onPrevious?.(); }}
                  className="text-gray-400 hover:text-white hover:scale-110 transition-all disabled:opacity-25"
                  disabled={!onPrevious}
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white text-gray-900 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <button onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                  className="text-gray-400 hover:text-white hover:scale-110 transition-all disabled:opacity-25"
                  disabled={!onNext}
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button onClick={cycleRepeat}
                  className={`relative transition-all ${repeat !== 'off' ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
                >
                  <Repeat className="w-4 h-4" />
                  {repeat === 'one' && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-cyan-400 leading-none">1</span>}
                </button>
              </div>

              {/* Seek desktop */}
              <div className="flex items-center gap-2 w-full max-w-xs lg:max-w-sm">
                <span className="text-xs text-gray-700 w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
                <div className="flex-1">
                  <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                </div>
                <span className="text-xs text-gray-700 w-8 tabular-nums">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Droite : volume */}
            <div className="flex items-center justify-end gap-2">
              <button onClick={toggleMute} className="text-gray-600 hover:text-white transition-colors flex-shrink-0">
                <VolumeIcon className="w-4 h-4" />
              </button>
              <div className="w-20 lg:w-28">
                <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="cursor-pointer" />
              </div>
              <span className="text-xs text-gray-700 w-6 tabular-nums">{isMuted ? 0 : volume}</span>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default AudioPlayer;
