import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, X, Loader2, Check, Link } from 'lucide-react';

/**
 * NewsShareButton v3 — Mobile-first
 * - Carte générée en 1080×1080 (carré Instagram/WhatsApp)
 * - Polices plus grandes, lisibles même en miniature
 * - Gestion emoji : strip des emoji du canvas, texte seul
 * - Hauteur dynamique avec padding de sécurité
 * - Modal responsive : sheet en bas sur mobile, dialogue centré desktop
 */

// Retire les emoji unicode pour Canvas (Canvas 2D n'affiche pas bien les emoji)
const stripEmoji = str =>
  (str || '').replace(
    /[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}]+/gu,
    ''
  ).replace(/\s{2,}/g, ' ').trim();

const NewsShareButton = ({ news }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview,  setShowPreview]  = useState(false);
  const [imgDataUrl,   setImgDataUrl]   = useState(null);
  const [copied,       setCopied]       = useState(false);
  const [shared,       setShared]       = useState(false);

  if (!news) return null;

  const dateLabel = news.created_at
    ? new Date(news.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const newsUrl = news.id
    ? `${window.location.origin}/#/news?id=${news.id}`
    : `${window.location.origin}/#/news`;

  // ── Canvas helpers ────────────────────────────────────────────────────
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

  function wrapText(ctx, text, maxWidth) {
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

  // ── Génération carte 1080×1080 ────────────────────────────────────────
  const generateImage = async () => {
    const S   = 1080;   // carré Instagram / WhatsApp / Stories
    const PAD = 80;     // marge latérale généreuse
    const DPR = 2;      // rendu @2x pour la netteté
    const canvas = document.createElement('canvas');
    canvas.width  = S * DPR;
    canvas.height = S * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    // ── Police plus fiable sur Canvas ──
    const FONT = "'Arial', 'Helvetica Neue', sans-serif";

    // ── Fond dégradé ──
    const bg = ctx.createLinearGradient(0, 0, S * 0.5, S);
    bg.addColorStop(0,   '#080c14');
    bg.addColorStop(0.55,'#130d2c');
    bg.addColorStop(1,   '#080c14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    // Halo violet centre
    const halo = ctx.createRadialGradient(S * 0.5, S * 0.38, 0, S * 0.5, S * 0.38, S * 0.52);
    halo.addColorStop(0, 'rgba(139,92,246,0.22)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, S, S);

    // Halo cyan bas-gauche
    const halo2 = ctx.createRadialGradient(S * 0.1, S * 0.85, 0, S * 0.1, S * 0.85, S * 0.35);
    halo2.addColorStop(0, 'rgba(34,211,238,0.12)');
    halo2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo2;
    ctx.fillRect(0, 0, S, S);

    // ── Bordure arrondie violette ──
    ctx.strokeStyle = 'rgba(139,92,246,0.6)';
    ctx.lineWidth   = 3;
    roundRect(ctx, 3, 3, S - 6, S - 6, 48);
    ctx.stroke();

    // ── Bande top cyan→violet ──
    const topBar = ctx.createLinearGradient(PAD, 0, S - PAD, 0);
    topBar.addColorStop(0,   'rgba(34,211,238,0)');
    topBar.addColorStop(0.25,'rgba(34,211,238,0.8)');
    topBar.addColorStop(0.75,'rgba(139,92,246,0.8)');
    topBar.addColorStop(1,   'rgba(139,92,246,0)');
    ctx.strokeStyle = topBar;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(PAD, 88); ctx.lineTo(S - PAD, 88);
    ctx.stroke();

    // ── Logo cercle dégradé ──
    const logoR = 30;
    const logoX = PAD + logoR;
    const logoY = 156;
    const lg = ctx.createLinearGradient(logoX - logoR, logoY - logoR, logoX + logoR, logoY + logoR);
    lg.addColorStop(0, '#22d3ee');
    lg.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2); ctx.fill();
    // Lettre N
    ctx.fillStyle    = '#fff';
    ctx.font         = `bold 28px ${FONT}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', logoX, logoY);

    // Nom plateforme + sous-titre
    const nameX = PAD + logoR * 2 + 20;
    ctx.fillStyle    = '#22d3ee';
    ctx.font         = `700 24px ${FONT}`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('NovaSound TITAN LUX', nameX, logoY - 8);
    ctx.fillStyle = 'rgba(34,211,238,0.5)';
    ctx.font      = `400 15px ${FONT}`;
    ctx.fillText('Actualité de la communauté', nameX, logoY + 18);

    // ── Badge date ──
    let curY = 230;
    ctx.font         = `400 16px ${FONT}`;
    ctx.textBaseline = 'middle';
    const bdW = ctx.measureText(dateLabel).width + 36;
    ctx.fillStyle   = 'rgba(139,92,246,0.2)';
    ctx.strokeStyle = 'rgba(139,92,246,0.55)';
    ctx.lineWidth   = 1.5;
    roundRect(ctx, PAD, curY - 15, bdW, 30, 15);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c084fc';
    ctx.fillText(dateLabel, PAD + 18, curY);
    curY += 46;

    // ── Titre ──
    const cleanTitle = stripEmoji(news.title || '');
    ctx.fillStyle    = '#f8fafc';
    ctx.font         = `700 44px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign    = 'left';
    const titleLines = wrapText(ctx, cleanTitle, S - PAD * 2);
    const titleLineH = 56;
    const maxTitle   = 3;
    titleLines.slice(0, maxTitle).forEach((line, i) => {
      ctx.fillText(line, PAD, curY + i * titleLineH);
    });
    curY += Math.min(titleLines.length, maxTitle) * titleLineH + 32;

    // ── Séparateur dégradé ──
    const sep = ctx.createLinearGradient(PAD, 0, S - PAD, 0);
    sep.addColorStop(0,   'rgba(139,92,246,0.8)');
    sep.addColorStop(0.5, 'rgba(34,211,238,0.5)');
    sep.addColorStop(1,   'rgba(34,211,238,0)');
    ctx.strokeStyle = sep;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(S - PAD, curY); ctx.stroke();
    curY += 32;

    // ── Extrait du contenu ──
    const FOOTER_H   = 130;                        // espace réservé footer
    const availH     = S - curY - FOOTER_H;
    const contLineH  = 34;
    const maxCont    = Math.max(1, Math.floor(availH / contLineH));
    const cleanCont  = stripEmoji(news.content || '');
    ctx.fillStyle    = '#94a3b8';
    ctx.font         = `400 22px ${FONT}`;
    ctx.textBaseline = 'top';
    const contLines  = wrapText(ctx, cleanCont, S - PAD * 2);
    contLines.slice(0, maxCont).forEach((line, i) => {
      ctx.fillText(line, PAD, curY + i * contLineH);
    });
    if (contLines.length > maxCont) {
      const lastLineW = ctx.measureText(contLines[maxCont - 1]).width;
      ctx.fillStyle   = 'rgba(139,92,246,0.8)';
      ctx.fillText('…', PAD + lastLineW + 6, curY + (maxCont - 1) * contLineH);
    }

    // ── Footer ──
    const footerY = S - FOOTER_H;

    // Ligne séparatrice footer
    const fLine = ctx.createLinearGradient(PAD, 0, S - PAD, 0);
    fLine.addColorStop(0,   'rgba(255,255,255,0.15)');
    fLine.addColorStop(0.6, 'rgba(255,255,255,0.05)');
    fLine.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.strokeStyle = fLine;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(PAD, footerY); ctx.lineTo(S - PAD, footerY); ctx.stroke();

    // Avatar auteur
    const username = news.users?.username || 'NovaSound';
    const avR = 26;
    const avX = PAD + avR;
    const avY = footerY + FOOTER_H / 2;
    const ag  = ctx.createLinearGradient(avX - avR, avY - avR, avX + avR, avY + avR);
    ag.addColorStop(0, '#22d3ee'); ag.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle    = '#fff';
    ctx.font         = `700 22px ${FONT}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((username[0] || 'N').toUpperCase(), avX, avY);

    // Nom auteur
    ctx.fillStyle    = '#cbd5e1';
    ctx.font         = `600 18px ${FONT}`;
    ctx.textAlign    = 'left';
    ctx.fillText(username, avX + avR + 16, avY);

    // Watermark domaine
    ctx.fillStyle    = 'rgba(34,211,238,0.45)';
    ctx.font         = `400 15px ${FONT}`;
    ctx.textAlign    = 'right';
    ctx.fillText(window.location.hostname, S - PAD, avY);

    return canvas.toDataURL('image/png');
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await generateImage();
      setImgDataUrl(dataUrl);
      setShowPreview(true);
    } catch (err) {
      console.error('[NewsShare] génération:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!imgDataUrl) return;
    const a = document.createElement('a');
    a.href = imgDataUrl;
    a.download = `novasound-${news.id?.slice(0, 8) || 'news'}.png`;
    a.click();
    setShared(true);
    setTimeout(() => setShared(false), 2200);
  };

  const handleNativeShare = async () => {
    if (!imgDataUrl) return;
    try {
      const blob = await (await fetch(imgDataUrl)).blob();
      const file = new File([blob], 'novasound-news.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: news.title || 'NovaSound TITAN LUX',
          text:  `${news.title}\n\nVia NovaSound TITAN LUX 🎵\n👉 ${newsUrl}`,
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: news.title || 'NovaSound TITAN LUX',
          text:  `${news.title}\n\nVia NovaSound TITAN LUX 🎵`,
          url:   newsUrl,
        });
      } else {
        handleDownload(); return;
      }
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch (err) {
      if (err.name !== 'AbortError') handleDownload();
    }
  };

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(newsUrl); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = newsUrl; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPreview(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70]"
            />

            {/* Modal — sheet bas sur mobile, dialogue centré desktop */}
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-[70] sm:hidden"
            >
              <div
                className="bg-gray-900 rounded-t-3xl border-t border-x border-fuchsia-500/25 shadow-2xl pb-safe"
                onClick={e => e.stopPropagation()}
              >
                {/* Grab handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-700" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                  <span className="text-white font-semibold flex items-center gap-2 text-sm">
                    <Share2 className="w-4 h-4 text-fuchsia-400" />
                    Partager cette news
                  </span>
                  <button onClick={() => setShowPreview(false)} className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Aperçu image */}
                <div className="px-4 pt-4 pb-2">
                  <div className="rounded-2xl overflow-hidden border border-gray-700/50 shadow-xl">
                    <img src={imgDataUrl} alt="Aperçu" className="w-full aspect-square object-cover" />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">Carte 1080×1080 prête à partager</p>
                </div>

                {/* Boutons */}
                <div className="px-4 pb-2 flex flex-col gap-2.5">
                  <motion.button
                    onClick={handleNativeShare}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold text-sm shadow-lg shadow-fuchsia-500/25 active:opacity-85"
                  >
                    {shared ? <><Check className="w-4 h-4" /> Partagé !</> : <><Share2 className="w-4 h-4" /> Partager sur les réseaux</>}
                  </motion.button>

                  <div className="flex gap-2.5">
                    <motion.button
                      onClick={handleDownload}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-700 text-gray-300 text-sm active:bg-gray-800 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Télécharger
                    </motion.button>
                    <motion.button
                      onClick={handleCopyLink}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-700 text-gray-300 text-sm active:bg-gray-800 transition-colors"
                    >
                      {copied ? <><Check className="w-4 h-4 text-cyan-400" /> Copié !</> : <><Link className="w-4 h-4" /> Copier lien</>}
                    </motion.button>
                  </div>
                </div>

                {/* Safe area bottom */}
                <div className="h-6" />
              </div>
            </motion.div>

            {/* Dialog desktop */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="fixed inset-0 z-[70] hidden sm:flex items-center justify-center p-6 pointer-events-none"
            >
              <div
                className="bg-gray-900 border border-fuchsia-500/25 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto flex flex-col max-h-[88vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-fuchsia-400" />
                    Partager cette news
                  </h3>
                  <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body 2 col */}
                <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
                  {/* Aperçu */}
                  <div className="flex-1 p-5 border-r border-gray-800 flex flex-col justify-center min-w-0">
                    <div className="rounded-xl overflow-hidden border border-gray-700/40 shadow-lg">
                      <img src={imgDataUrl} alt="Aperçu" className="w-full aspect-square object-cover" />
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-2">Carte 1080×1080 — Instagram / WhatsApp</p>
                  </div>

                  {/* Actions */}
                  <div className="w-60 flex-shrink-0 flex flex-col justify-center gap-3 px-5 py-6">
                    <motion.button
                      onClick={handleNativeShare}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-fuchsia-500/20 hover:opacity-90 transition-all"
                    >
                      {shared ? <><Check className="w-4 h-4" /> Partagé !</> : <><Share2 className="w-4 h-4" /> Partager</>}
                    </motion.button>

                    <motion.button
                      onClick={handleDownload}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 text-sm transition-all"
                    >
                      <Download className="w-4 h-4" /> Télécharger l'image
                    </motion.button>

                    <button
                      onClick={handleCopyLink}
                      className="w-full py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40 text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      {copied ? <><Check className="w-3.5 h-3.5 text-cyan-400" /> Lien copié !</> : <><Link className="w-3.5 h-3.5" /> Copier le lien</>}
                    </button>

                    <p className="text-[11px] text-gray-600 text-center leading-snug mt-1">
                      WhatsApp · Telegram · Instagram<br />ou télécharge l'image.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NewsShareButton;
