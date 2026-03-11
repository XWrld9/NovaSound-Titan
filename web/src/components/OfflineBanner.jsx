/**
 * OfflineBanner — NovaSound TITAN LUX V80000
 * Système simplifié :
 *  - Phase 1 (0→60s offline) : petite bannière top discrète "Connexion perdue…"
 *  - Phase 2 (≥60s offline) : overlay plein-écran — l'utilisateur CHOISIT d'entrer ou non
 *  - Reconnexion : toast vert 3.5s puis disparaît
 *  - /local-player → rien affiché (mode offline intentionnel)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff, Wifi, Music, RefreshCw, Headphones,
  Clock, CheckCircle2, Loader2, ArrowRight,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

/* ── Ping réel ────────────────────────────────────────────────── */
const checkConnectivity = async () => {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    await fetch('https://www.google.com/generate_204', {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal,
    });
    clearTimeout(timer);
    return true;
  } catch { return false; }
};

/* ── Hook réseau exporté (utilisé par d'autres composants) ─────── */
export const useNetworkDetector = () => {
  const [status, setStatus] = useState(navigator.onLine ? 'online' : 'offline');

  useEffect(() => {
    let offlineTimer = null;

    const scheduleOffline = () => {
      if (offlineTimer) return;
      offlineTimer = setTimeout(() => {
        offlineTimer = null;
        setStatus('offline');
      }, 60_000);
    };

    const onOnline  = async () => {
      if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
      const ok = await checkConnectivity();
      setStatus(ok ? 'online' : 'offline');
    };
    const onOffline = () => scheduleOffline();

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    const interval = setInterval(async () => {
      const ok = await checkConnectivity();
      setStatus(prev => ok ? (prev === 'slow' ? 'slow' : 'online') : (prev === 'online' ? 'online' : prev));
    }, 30_000);

    if (!navigator.onLine) scheduleOffline();

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
      if (offlineTimer) clearTimeout(offlineTimer);
    };
  }, []);

  return { isOnline: status === 'online', isSlowConnection: status === 'slow' };
};

/* ── Composant principal ────────────────────────────────────────── */
const OfflineBanner = () => {
  const [isOnline,    setIsOnline]    = useState(navigator.onLine);
  const [offlinePhase, setOfflinePhase] = useState(0); // 0=hidden 1=top-banner 2=overlay
  const [justReconnected, setJustReconnected] = useState(false);
  const [checking,    setChecking]    = useState(false);
  const phaseTimer    = useRef(null);
  const prevOnline    = useRef(isOnline);
  const navigate      = useNavigate();
  const location      = useLocation();

  const isLocalPlayer = location.pathname === '/local-player' || location.pathname.startsWith('/local-player/');

  /* Détection réseau */
  useEffect(() => {
    let offlineConfirmTimer = null;

    const scheduleOffline = () => {
      if (offlineConfirmTimer) return;
      offlineConfirmTimer = setTimeout(() => {
        offlineConfirmTimer = null;
        setIsOnline(false);
      }, 60_000);
    };

    const onOnline = async () => {
      if (offlineConfirmTimer) { clearTimeout(offlineConfirmTimer); offlineConfirmTimer = null; }
      const ok = await checkConnectivity();
      if (ok) setIsOnline(true);
    };
    const onOffline = () => scheduleOffline();

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    if (!navigator.onLine) scheduleOffline();

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (offlineConfirmTimer) clearTimeout(offlineConfirmTimer);
    };
  }, []);

  /* Réaction aux changements online/offline */
  useEffect(() => {
    const wasOnline = prevOnline.current;

    if (!isOnline && wasOnline) {
      // Vient de passer offline → Phase 1 immédiate + Phase 2 après 60s
      setOfflinePhase(1);
      phaseTimer.current = setTimeout(() => setOfflinePhase(2), 60_000);
    }

    if (isOnline && !wasOnline) {
      // Reconnecté
      if (phaseTimer.current) { clearTimeout(phaseTimer.current); phaseTimer.current = null; }
      setOfflinePhase(0);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 3500);
    }

    prevOnline.current = isOnline;
    return () => { if (phaseTimer.current) clearTimeout(phaseTimer.current); };
  }, [isOnline]);

  const handleRetry = async () => {
    setChecking(true);
    await new Promise(r => setTimeout(r, 800));
    const ok = await checkConnectivity();
    if (ok) window.location.reload();
    else setChecking(false);
  };

  if (isLocalPlayer) return null;

  return (
    <AnimatePresence>
      {/* Toast reconnexion */}
      {justReconnected && (
        <motion.div key="reconnect"
          initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }} transition={{ type: 'spring', damping: 22 }}
          className="fixed top-4 left-1/2 z-[9999]" style={{ transform: 'translateX(-50%)' }}>
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl border shadow-2xl"
            style={{ background: 'rgba(16,185,129,0.96)', borderColor: 'rgba(52,211,153,0.4)', backdropFilter: 'blur(16px)' }}>
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-semibold">Connexion rétablie !</span>
          </div>
        </motion.div>
      )}

      {/* Phase 1 : bannière discrète */}
      {offlinePhase === 1 && (
        <motion.div key="banner"
          initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9998]"
          style={{ background: 'rgba(239,68,68,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-center gap-2.5 px-4 py-2.5">
            <WifiOff className="w-3.5 h-3.5 text-white/90 flex-shrink-0" />
            <span className="text-white text-xs font-semibold">Connexion perdue — vérification en cours…</span>
            <span className="text-white/60 text-xs ml-1 hidden sm:inline">Le lecteur local reste disponible.</span>
          </div>
        </motion.div>
      )}

      {/* Phase 2 : overlay plein-écran — l'utilisateur choisit */}
      {offlinePhase === 2 && (
        <motion.div key="overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9990] flex flex-col items-center justify-center"
          style={{ background: 'rgba(4,6,16,0.97)', backdropFilter: 'blur(28px)' }}>

          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.14, 0.05, 0.14] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.45) 0%, transparent 68%)' }}
          />

          <div className="relative z-10 flex flex-col items-center text-center px-8 w-full max-w-sm">
            <motion.div
              animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-24 h-24 rounded-[2rem] flex items-center justify-center mb-7 border"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <WifiOff className="w-10 h-10 text-red-400" />
            </motion.div>

            <h1 className="text-white text-3xl font-black mb-2 tracking-tight">Hors-ligne</h1>
            <p className="text-gray-400 text-sm mb-2 leading-relaxed">
              Aucune connexion depuis plus d'une minute.
            </p>
            <p className="text-gray-500 text-xs mb-8">
              Choisis comment continuer ci-dessous.
            </p>

            <div className="w-full space-y-2.5 mb-8">
              {[
                { icon: Headphones, label: 'Lecteur local — tes fichiers audio',  ok: true  },
                { icon: Music,      label: 'Playlists locales sauvegardées',       ok: true  },
                { icon: Clock,      label: 'Historique d\'écoute local',           ok: true  },
                { icon: Wifi,       label: 'Flux, chat, live — connexion requise', ok: false },
              ].map(({ icon: Icon, label, ok }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
                  style={{
                    background: ok ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${ok ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.04)'}`,
                  }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)' }}>
                    <Icon className={`w-4 h-4 ${ok ? 'text-emerald-400' : 'text-gray-600'}`} />
                  </div>
                  <span className={`text-sm flex-1 font-medium ${ok ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
                  {ok && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => navigate('/local-player')}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 24px rgba(16,185,129,0.28)' }}>
                <Headphones className="w-4 h-4" />
                Ouvrir le lecteur local
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <button onClick={handleRetry} disabled={checking}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                {checking
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification…</>
                  : <><RefreshCw className="w-4 h-4" /> Réessayer la connexion</>}
              </button>

              <button onClick={() => setOfflinePhase(1)}
                className="text-gray-600 text-xs py-2 hover:text-gray-400 transition-colors">
                Rester sur cette page
              </button>
            </div>

            <p className="text-gray-700 text-xs mt-6 font-medium">NovaSound TITAN LUX · Mode hors-ligne</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
