/**
 * OfflineBanner — NovaSound TITAN LUX V70000
 * Refonte complète : overlay plein-écran animé + bannière discrète connexion lente
 * - Détection fiable via fetch ping (pas seulement navigator.onLine)
 * - Mode hors-ligne : overlay élégant avec liste des features dispo offline
 * - Connexion lente : bannière top discrète
 * - Reconnexion : animation verte + dismiss automatique
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, Music, RefreshCw, Headphones, Clock, CheckCircle2, Loader2 } from 'lucide-react';

/* ── Ping réel pour vérifier la connectivité (navigator.onLine = non fiable) ── */
const checkRealConnectivity = async () => {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    await fetch('https://www.google.com/generate_204', {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
};

/* ── Hook réseau fiable ─────────────────────────────────────────────────────── */
export const useNetworkDetector = () => {
  const [isOnline,         setIsOnline]         = useState(navigator.onLine);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const pingTimer = useRef(null);

  const runPing = useCallback(async () => {
    const ok = await checkRealConnectivity();
    setIsOnline(ok);
  }, []);

  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  pingTimer.current = setTimeout(runPing, 300); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    const interval = setInterval(runPing, 30_000);

    const updateSpeed = () => {
      const c = navigator.connection;
      if (c) setIsSlowConnection(['slow-2g','2g'].includes(c.effectiveType));
    };
    if (navigator.connection) {
      navigator.connection.addEventListener('change', updateSpeed);
      updateSpeed();
    }

    if (!navigator.onLine) setIsOnline(false);

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
      if (pingTimer.current) clearTimeout(pingTimer.current);
      if (navigator.connection) navigator.connection.removeEventListener('change', updateSpeed);
    };
  }, [runPing]);

  return { isOnline, isSlowConnection };
};

/* ── Composant OfflineBanner ────────────────────────────────────────────────── */
const OfflineBanner = () => {
  const { isOnline, isSlowConnection } = useNetworkDetector();
  const [justReconnected, setJustReconnected] = useState(false);
  const [checking,        setChecking]        = useState(false);
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    if (!prevOnline.current && isOnline) {
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 3500);
      return () => clearTimeout(t);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  const handleRetry = async () => {
    setChecking(true);
    await new Promise(r => setTimeout(r, 800));
    const ok = await checkRealConnectivity();
    if (ok) window.location.reload();
    setChecking(false);
  };

  if (isOnline && !isSlowConnection && !justReconnected) return null;

  /* Bannière connexion lente */
  if (isOnline && isSlowConnection && !justReconnected) {
    return (
      <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9998]"
        style={{ background: 'rgba(245,158,11,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center justify-center gap-2 px-4 py-2">
          <Wifi className="w-3.5 h-3.5 text-white/90" />
          <span className="text-white text-xs font-medium">Connexion lente — certaines fonctionnalités peuvent être ralenties</span>
        </div>
      </motion.div>
    );
  }

  /* Toast reconnexion */
  if (justReconnected) {
    return (
      <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }} transition={{ type: 'spring', damping: 22 }}
        className="fixed top-4 left-1/2 z-[9999]" style={{ transform: 'translateX(-50%)' }}>
        <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl border shadow-2xl"
          style={{ background: 'rgba(16,185,129,0.95)', borderColor: 'rgba(52,211,153,0.4)', backdropFilter: 'blur(16px)' }}>
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-semibold">Connexion rétablie !</span>
        </div>
      </motion.div>
    );
  }

  /* Overlay hors-ligne plein-écran */
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9990] flex flex-col items-center justify-center"
      style={{ background: 'rgba(4,6,16,0.97)', backdropFilter: 'blur(24px)' }}>

      {/* Halo rouge animé */}
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.18, 0.08, 0.18] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.5) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-8 w-full max-w-sm">

        {/* Icône flottante */}
        <motion.div
          animate={{ y: [0, -7, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border"
          style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.22)' }}>
          <WifiOff className="w-9 h-9 text-red-400" />
        </motion.div>

        <h1 className="text-white text-2xl font-bold mb-2 tracking-tight">Hors-ligne</h1>
        <p className="text-gray-400 text-sm mb-7 leading-relaxed">
          Pas de connexion internet détectée.<br />
          Voici ce que tu peux faire sans connexion :
        </p>

        {/* Features disponibles offline */}
        <div className="w-full space-y-2 mb-7">
          {[
            { icon: Headphones, label: 'Lecteur local — tes fichiers audio',     ok: true  },
            { icon: Music,      label: 'Playlists locales',                       ok: true  },
            { icon: Clock,      label: 'Historique d\'écoute local',              ok: true  },
            { icon: Wifi,       label: 'Flux, chat, live — connexion requise',    ok: false },
          ].map(({ icon: Icon, label, ok }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${ok ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.05)'}`,
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: ok ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.05)' }}>
                <Icon className={`w-4 h-4 ${ok ? 'text-emerald-400' : 'text-gray-500'}`} />
              </div>
              <span className={`text-sm flex-1 text-left ${ok ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
              {ok && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Boutons CTA */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => { window.location.href = '/#/local-player'; }}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.28)' }}>
            <Headphones className="w-4 h-4 inline mr-2 -mt-0.5" />
            Ouvrir le lecteur local
          </button>

          <button onClick={handleRetry} disabled={checking}
            className="w-full py-3 rounded-2xl font-medium text-sm active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: '#9ca3af' }}>
            {checking
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification…</>
              : <><RefreshCw className="w-4 h-4" /> Réessayer la connexion</>}
          </button>
        </div>

        <p className="text-gray-600 text-xs mt-6">NovaSound TITAN LUX · Mode hors-ligne</p>
      </div>
    </motion.div>
  );
};

export default OfflineBanner;
