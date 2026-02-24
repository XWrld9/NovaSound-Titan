import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, X, Loader2, Check } from 'lucide-react';
import { toPng } from 'html-to-image';

/**
 * NewsShareButton
 * Génère une image de la news (style card) et la partage via
 * navigator.share (mobile) ou téléchargement direct (desktop).
 */
const NewsShareButton = ({ news }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [imgDataUrl, setImgDataUrl]     = useState(null);
  const [shared, setShared]             = useState(false);
  const cardRef                         = useRef(null);

  // ─── Formater la date en français ───
  const dateLabel = news?.created_at
    ? new Date(news.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  // ─── Tronquer le contenu pour la card image ───
  const shortContent = news?.content?.length > 320
    ? news.content.slice(0, 317) + '…'
    : news?.content || '';

  // ─── Générer l'image depuis le DOM ───
  const generateImage = useCallback(async () => {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,          // haute résolution
      backgroundColor: '#111827',
    });
  }, []);

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await generateImage();
      setImgDataUrl(dataUrl);
      setShowPreview(true);
    } catch (err) {
      console.error('Erreur génération image:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Télécharger l'image ───
  const handleDownload = () => {
    if (!imgDataUrl) return;
    const a = document.createElement('a');
    a.href = imgDataUrl;
    a.download = `novasound-news-${news?.id?.slice(0,8) || 'post'}.png`;
    a.click();
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  // ─── Partage natif (mobile) ou copie lien (desktop) ───
  const handleNativeShare = async () => {
    if (!imgDataUrl) return;
    try {
      // Convertir dataUrl → Blob → File
      const res   = await fetch(imgDataUrl);
      const blob  = await res.blob();
      const file  = new File([blob], `novasound-news.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: news?.title || 'NovaSound TITAN LUX',
          text:  `${news?.title}\n\nVia NovaSound TITAN LUX 🎵`,
          files: [file],
        });
      } else {
        // Fallback desktop : télécharger
        handleDownload();
      }
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      if (err.name !== 'AbortError') {
        handleDownload(); // fallback si share échoue
      }
    }
  };

  return (
    <>
      {/* ── Bouton déclencheur ── */}
      <motion.button
        onClick={handleShare}
        disabled={isGenerating}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-gray-400 hover:text-fuchsia-400 hover:bg-fuchsia-500/10 border border-transparent hover:border-fuchsia-500/30 transition-all disabled:opacity-50"
        title="Partager cette news"
      >
        {isGenerating
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Share2 className="w-4 h-4" />
        }
        <span className="hidden sm:inline">Partager</span>
      </motion.button>

      {/* ── Card invisible utilisée comme source pour html-to-image ── */}
      {/* Rendu hors écran mais dans le DOM pour que html-to-image puisse la capturer */}
      <div
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '600px',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: '600px',
            background: 'linear-gradient(135deg, #111827 0%, #1a1040 100%)',
            borderRadius: '20px',
            padding: '40px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#fff',
            border: '1px solid rgba(168,85,247,0.3)',
            boxShadow: '0 0 60px rgba(168,85,247,0.15)',
          }}
        >
          {/* Logo + nom plateforme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <img
              src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
              alt="NovaSound"
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #22d3ee' }}
              crossOrigin="anonymous"
            />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#22d3ee', letterSpacing: '0.05em' }}>
              NovaSound TITAN LUX
            </span>
          </div>

          {/* Badge date */}
          <div style={{
            display: 'inline-block',
            background: 'rgba(168,85,247,0.15)',
            border: '1px solid rgba(168,85,247,0.35)',
            borderRadius: '999px',
            padding: '3px 12px',
            fontSize: '12px',
            color: '#c084fc',
            marginBottom: '14px',
          }}>
            {dateLabel}
          </div>

          {/* Titre */}
          <h2 style={{
            fontSize: '26px',
            fontWeight: '800',
            lineHeight: '1.25',
            marginBottom: '20px',
            color: '#ffffff',
            wordBreak: 'break-word',
          }}>
            {news?.title}
          </h2>

          {/* Ligne séparatrice */}
          <div style={{
            height: '1px',
            background: 'linear-gradient(to right, rgba(168,85,247,0.4), transparent)',
            marginBottom: '20px',
          }} />

          {/* Contenu tronqué */}
          <p style={{
            fontSize: '15px',
            lineHeight: '1.7',
            color: '#d1d5db',
            whiteSpace: 'pre-line',
            wordBreak: 'break-word',
          }}>
            {shortContent}
          </p>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Auteur */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {news?.users?.avatar_url ? (
                <img
                  src={news.users.avatar_url}
                  alt=""
                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                  crossOrigin="anonymous"
                />
              ) : (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'linear-gradient(135deg,#22d3ee,#a855f7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', color: '#fff', fontWeight: '700',
                }}>
                  {(news?.users?.username || 'A')[0].toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                {news?.users?.username || 'NovaSound'}
              </span>
            </div>

            {/* Watermark */}
            <span style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em',
            }}>
              nova-sound-titan.vercel.app
            </span>
          </div>
        </div>
      </div>

      {/* ── Modal de prévisualisation + partage ── */}
      <AnimatePresence>
        {showPreview && imgDataUrl && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPreview(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-gray-900 border border-fuchsia-500/30 rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-fuchsia-400" />
                    Partager cette news
                  </h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Aperçu image */}
                <div className="p-5">
                  <div className="rounded-xl overflow-hidden border border-gray-700/50 shadow-lg">
                    <img src={imgDataUrl} alt="Aperçu" className="w-full" />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-3">
                    Aperçu de l'image qui sera partagée
                  </p>
                </div>

                {/* Boutons d'action */}
                <div className="flex gap-3 px-5 pb-5">
                  {/* Partage natif (WhatsApp, Instagram, etc. sur mobile) */}
                  <motion.button
                    onClick={handleNativeShare}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-all"
                  >
                    {shared
                      ? <><Check className="w-4 h-4" /> Partagé !</>
                      : <><Share2 className="w-4 h-4" /> Partager sur les réseaux</>
                    }
                  </motion.button>

                  {/* Télécharger */}
                  <motion.button
                    onClick={handleDownload}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 text-sm transition-all"
                    title="Télécharger l'image"
                  >
                    <Download className="w-4 h-4" />
                  </motion.button>
                </div>

                <p className="text-xs text-gray-600 text-center pb-4 px-5">
                  Sur mobile : Instagram, WhatsApp, Facebook… Sur desktop : télécharge l'image.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NewsShareButton;
