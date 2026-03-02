/**
 * InstallBanner — NovaSound TITAN LUX v6000
 * – Android : modal de choix APK native vs PWA avec guide pas-à-pas
 * – iOS Safari : guide visuel (Partager → Sur l'écran d'accueil)
 * – Desktop : bandeau discret
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Monitor, Share, ArrowUp, Smartphone } from 'lucide-react';
import usePWAInstall from '@/hooks/usePWAInstall';
import AndroidInstallGuide from '@/components/AndroidInstallGuide';

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true);

const InstallBanner = () => {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('pwa-banner-dismissed') === '1'
  );
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

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

  if (isStandalone() || isInstalled || dismissed) return null;

  return (
    <>
      <AnimatePresence>

        {/* ── iOS Guide ── */}
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
              <div className="flex items-center gap-3 mb-3">
                <img src="/apple-touch-icon.png" alt="NovaSound" className="w-11 h-11 rounded-2xl flex-shrink-0 shadow-md" />
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm leading-tight">Installer NovaSound</p>
                  <p className="text-gray-400 text-xs mt-0.5">Pour recevoir les notifications hors de l'app 🔔</p>
                </div>
                <button onClick={dismiss} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors" aria-label="Fermer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-[10px] flex-shrink-0">1</span>
                  <span>Appuie sur <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-medium"><Share className="w-3 h-3" />Partager</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold text-[10px] flex-shrink-0">2</span>
                  <span>Puis <span className="text-white font-semibold">"Sur l'écran d'accueil"</span></span>
                </div>
              </div>
              <div className="flex justify-center mt-2">
                <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }} className="text-cyan-400">
                  <ArrowUp className="w-4 h-4 rotate-180" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Android Banner ── */}
        {isAndroid() && !isIOS() && (
          <motion.div
            key="android-banner"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 1.5 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="bg-gray-900/97 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-4 shadow-2xl shadow-orange-500/10 flex items-center gap-3">
              <img src="/apple-touch-icon.png" alt="NovaSound TITAN LUX" className="w-12 h-12 rounded-xl flex-shrink-0 shadow-md" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">📲 Installe NovaSound</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-tight">APK natif ou raccourci — à toi de choisir !</p>
              </div>
              <motion.button
                onClick={() => setShowAndroidGuide(true)}
                whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-lg shadow-orange-500/25"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Installer
              </motion.button>
              <button onClick={dismiss} className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-300 transition-colors" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Chrome/non-Android Banner (canInstall) ── */}
        {canInstall && !isIOS() && !isAndroid() && (
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
              <img src="/apple-touch-icon.png" alt="NovaSound TITAN LUX" className="w-12 h-12 rounded-xl flex-shrink-0 shadow-md" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">Installer NovaSound</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-tight">Accès rapide depuis ton écran d'accueil</p>
              </div>
              <motion.button
                onClick={install}
                whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/25"
              >
                <Download className="w-3.5 h-3.5" />
                Installer
              </motion.button>
              <button onClick={dismiss} className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-300 transition-colors" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Desktop Banner ── */}
        {canInstall && !isIOS() && (
          <motion.div
            key="install-banner-desktop"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 1.5 }}
            className="hidden md:flex items-center justify-center gap-4 py-2.5 px-6 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border-b border-cyan-500/20"
          >
            <img src="/apple-touch-icon.png" alt="" className="w-6 h-6 rounded-lg" />
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Monitor className="w-4 h-4 text-cyan-400" />
              <span>Installe <span className="text-cyan-400 font-semibold">NovaSound TITAN LUX</span> sur ton bureau pour un accès instantané</span>
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

      {/* Modal Android Guide */}
      <AnimatePresence>
        {showAndroidGuide && (
          <AndroidInstallGuide onClose={() => { setShowAndroidGuide(false); dismiss(); }} />
        )}
      </AnimatePresence>
    </>
  );
};

export default InstallBanner;
