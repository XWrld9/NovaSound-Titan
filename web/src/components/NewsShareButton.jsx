import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, X, Loader2, Check } from 'lucide-react';

/**
 * NewsShareButton v2
 * Génère une image de la news via Canvas natif (zéro CORS, zéro dépendance externe).
 * Partage via navigator.share (mobile) ou téléchargement (desktop).
 */
const NewsShareButton = ({ news }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [imgDataUrl, setImgDataUrl]     = useState(null);
  const [shared, setShared]             = useState(false);

  const dateLabel = news?.created_at
    ? new Date(news.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  // URL directe vers l'actu — partagée avec l'image
  const newsUrl = news?.id
    ? `${window.location.origin}/#/news?id=${news.id}`
    : `${window.location.origin}/#/news`;

  // ─── Dessiner la card sur un Canvas 2D ───
  const generateImage = async () => {
    const W = 600, H = 400;
    const canvas = document.createElement('canvas');
    canvas.width  = W * 2; // retina
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Fond dégradé
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(1, '#1a1040');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, W, H, 20);
    ctx.fill();

    // Bordure violette
    ctx.strokeStyle = 'rgba(168,85,247,0.4)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 0.75, 0.75, W - 1.5, H - 1.5, 20);
    ctx.stroke();

    // ── Logo "N" ──
    const logoGrad = ctx.createLinearGradient(40, 40, 72, 72);
    logoGrad.addColorStop(0, '#22d3ee');
    logoGrad.addColorStop(1, '#a855f7');
    ctx.fillStyle = logoGrad;
    ctx.beginPath();
    ctx.arc(56, 56, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 56, 56);

    // Nom plateforme
    ctx.fillStyle = '#22d3ee';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('NovaSound TITAN LUX', 80, 56);

    // Badge date
    const badgeX = 40, badgeY = 90;
    ctx.fillStyle = 'rgba(168,85,247,0.15)';
    ctx.strokeStyle = 'rgba(168,85,247,0.35)';
    ctx.lineWidth = 1;
    const dateW = ctx.measureText(dateLabel).width + 24;
    roundRect(ctx, badgeX, badgeY, dateW, 24, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c084fc';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateLabel, badgeX + 12, badgeY + 12);

    // Titre
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const title = news?.title || '';
    const titleLines = wrapText(ctx, title, W - 80, 22);
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, 40, 128 + i * 30);
    });

    // Ligne séparatrice
    const sepY = 128 + Math.min(titleLines.length, 2) * 30 + 14;
    const lineGrad = ctx.createLinearGradient(40, sepY, W - 40, sepY);
    lineGrad.addColorStop(0, 'rgba(168,85,247,0.5)');
    lineGrad.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, sepY);
    ctx.lineTo(W - 40, sepY);
    ctx.stroke();

    // Contenu tronqué
    ctx.fillStyle = '#d1d5db';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const content = news?.content || '';
    const contentLines = wrapText(ctx, content, W - 80, 14);
    contentLines.slice(0, 4).forEach((line, i) => {
      ctx.fillText(line, 40, sepY + 14 + i * 22);
    });

    // Footer — ligne séparatrice
    const footerY = H - 52;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY);
    ctx.lineTo(W - 40, footerY);
    ctx.stroke();

    // Auteur — avatar initiale
    const username = news?.users?.username || 'NovaSound';
    const avatarGrad = ctx.createLinearGradient(40, footerY + 10, 68, footerY + 38);
    avatarGrad.addColorStop(0, '#22d3ee');
    avatarGrad.addColorStop(1, '#a855f7');
    ctx.fillStyle = avatarGrad;
    ctx.beginPath();
    ctx.arc(54, footerY + 24, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username[0].toUpperCase(), 54, footerY + 24);

    // Nom auteur
    ctx.fillStyle = '#9ca3af';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(username, 76, footerY + 24);

    // Watermark avec lien direct vers l'actu
    ctx.fillStyle = 'rgba(34,211,238,0.5)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const shortUrl = `${window.location.hostname}/#/news?id=${news?.id?.slice(0,8) || ''}`;
    ctx.fillText(shortUrl, W - 40, footerY + 24);

    return canvas.toDataURL('image/png');
  };

  // ─── Helpers ───
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

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

  const handleDownload = () => {
    if (!imgDataUrl) return;
    const a = document.createElement('a');
    a.href = imgDataUrl;
    a.download = `novasound-news-${news?.id?.slice(0, 8) || 'post'}.png`;
    a.click();
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!imgDataUrl) return;
    try {
      const res  = await fetch(imgDataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'novasound-news.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: news?.title || 'NovaSound TITAN LUX',
          text:  `${news?.title}\n\nVia NovaSound TITAN LUX 🎵\n👉 ${newsUrl}`,
          url:   newsUrl,
          files: [file],
        });
      } else if (navigator.share) {
        // Partage sans fichier (Instagram web, etc.) → lien + texte
        await navigator.share({
          title: news?.title || 'NovaSound TITAN LUX',
          text:  `${news?.title}\n\nVia NovaSound TITAN LUX 🎵`,
          url:   newsUrl,
        });
      } else {
        handleDownload();
      }
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      if (err.name !== 'AbortError') handleDownload();
    }
  };

  return (
    <>
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

                <div className="p-5">
                  <div className="rounded-xl overflow-hidden border border-gray-700/50 shadow-lg">
                    <img src={imgDataUrl} alt="Aperçu" className="w-full" />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-3">
                    Aperçu de l'image qui sera partagée
                  </p>
                </div>

                <div className="flex gap-3 px-5 pb-5">
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

                {/* Bouton copier le lien */}
                <div className="px-5 pb-2">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(newsUrl);
                      } catch {
                        const ta = document.createElement('textarea');
                        ta.value = newsUrl;
                        ta.style.cssText = 'position:fixed;opacity:0';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                      }
                      const btn = document.getElementById('copy-news-link');
                      if (btn) { btn.textContent = '✓ Lien copié !'; setTimeout(() => { btn.textContent = '🔗 Copier le lien de l\'actu'; }, 2000); }
                    }}
                    id="copy-news-link"
                    className="w-full py-2 rounded-xl border border-gray-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40 text-xs transition-all"
                  >
                    🔗 Copier le lien de l'actu
                  </button>
                </div>
                <p className="text-xs text-gray-600 text-center pb-4 px-5">
                  Sur mobile : WhatsApp, Telegram… Sur desktop : copie le lien ou télécharge l'image.
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
