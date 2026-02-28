import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Monitor, Share, ArrowUp } from 'lucide-react';
import usePWAInstall from '@/hooks/usePWAInstall';

/**
 * Détecte iOS (iPhone / iPad / iPod)
 */
const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad OS 13+ se présente comme macOS
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/**
 * Détecte si l'app tourne déjà en mode standalone (déjà installée)
 */
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true);

/**
 * InstallBanner
 * – Android / Chrome / Edge : bouton natif beforeinstallprompt
 * – iOS Safari              : guide visuel (Partager → Sur l'écran d'accueil)
 * – Desktop                 : bandeau discret sous le header
 */
const InstallBanner = () => {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('pwa-banner-dismissed') === '1'
  );
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Affiche le guide iOS après 3 s si pas déjà installé et pas déjà fermé
  useEffect(() => {
    if (!isIOS() || isStandalone() || dismissed) return;
    const timer = setTimeout(() => setShowIOSGuide(true), 3000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const dismiss = () => {
    sessionStorage.setItem('pwa-banner-dismissed', '1');
    setDismissed(true);
    setShowIOSGuide(false);
  };

  // Rien à afficher
  if (isStandalone() || isInstalled || dismissed) return null;

  return (
    <AnimatePresence>

      {/* ══════════════════════════════════════════
          iOS — Guide "Partager → Sur l'écran d'accueil"
      ══════════════════════════════════════════ */}
      {showIOSGuide && isIOS() && (
        <motion.div
          key="ios-guide"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-3"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="bg-gray-900/97 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-4 shadow-2xl shadow-cyan-500/15">
            {/* En-tête */}
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/apple-touch-icon.png"
                alt="NovaSound"
                className="w-11 h-11 rounded-2xl flex-shrink-0 shadow-md"
              />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm leading-tight">
                  Installer NovaSound
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Ajoute l'app sur ton écran d'accueil
                </p>
              </div>
              <button
                onClick={dismiss}
                className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Étapes */}
            <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2.5 flex-wrap">
              {/* Étape 1 */}
              <div className="flex items-center gap-1.5 text-xs text-gray-300">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-[10px] flex-shrink-0">1</span>
                <span>Appuie sur</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-medium">
                  <Share className="w-3 h-3" />
                  Partager
                </span>
              </div>

              <ArrowUp className="w-3 h-3 text-gray-600 flex-shrink-0 rotate-90" />

              {/* Étape 2 */}
              <div className="flex items-center gap-1.5 text-xs text-gray-300">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold text-[10px] flex-shrink-0">2</span>
                <span>
                  Puis{' '}
                  <span className="text-white font-semibold">"Sur l'écran d'accueil"</span>
                </span>
              </div>
            </div>

            {/* Flèche animée pointant vers la barre Safari en bas */}
            <div className="flex justify-center mt-2">
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                className="text-cyan-400"
              >
                <ArrowUp className="w-4 h-4 rotate-180" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════
          Android / Chrome — Bouton natif (mobile)
      ══════════════════════════════════════════ */}
      {canInstall && !isIOS() && (
        <motion.div
          key="install-banner-mobile"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="bg-gray-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 shadow-2xl shadow-cyan-500/10 flex items-center gap-3">
            <img
              src="/apple-touch-icon.png"
              alt="NovaSound TITAN LUX"
              className="w-12 h-12 rounded-xl flex-shrink-0 shadow-md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">
                Installer NovaSound
              </p>
              <p className="text-gray-400 text-xs mt-0.5 leading-tight">
                Accès rapide depuis ton écran d'accueil
              </p>
            </div>
            <motion.button
              onClick={install}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/25"
            >
              <Download className="w-3.5 h-3.5" />
              Installer
            </motion.button>
            <button
              onClick={dismiss}
              className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════
          Desktop — Bandeau discret sous le header
      ══════════════════════════════════════════ */}
      {canInstall && !isIOS() && (
        <motion.div
          key="install-banner-desktop"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ delay: 1.5 }}
          className="hidden md:flex items-center justify-center gap-4 py-2.5 px-6
                     bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10
                     border-b border-cyan-500/20"
        >
          <img src="/apple-touch-icon.png" alt="" className="w-6 h-6 rounded-lg" />
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span>
              Installe{' '}
              <span className="text-cyan-400 font-semibold">NovaSound TITAN LUX</span>{' '}
              sur ton bureau pour un accès instantané
            </span>
          </div>
          <motion.button
            onClick={install}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Installer l'application
          </motion.button>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 ml-2">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

    </AnimatePresence>
  );
};

export default InstallBanner;
