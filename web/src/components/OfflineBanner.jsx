/**
 * OfflineBanner — NovaSound TITAN LUX v4000
 * Bannière réseau offline/reconnecté — animée, propre, non-intrusive
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnline } from '@/contexts/OnlineContext';

const OfflineBanner = () => {
  const { isOnline, wasOffline } = useOnline();

  const show = !isOnline || wasOffline;
  const isReconnected = isOnline && wasOffline;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={isReconnected ? 'reconnected' : 'offline'}
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          className="fixed top-0 left-0 right-0 z-[500] flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-semibold select-none"
          style={{
            background: isReconnected
              ? 'linear-gradient(90deg, #065f46, #047857)'
              : 'linear-gradient(90deg, #1e1b4b, #312e81)',
            boxShadow: isReconnected
              ? '0 4px 20px rgba(16,185,129,0.4)'
              : '0 4px 20px rgba(79,70,229,0.5)',
          }}
        >
          {isReconnected ? (
            <>
              <Wifi className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span className="text-emerald-200">Connexion rétablie — Synchronisation en cours…</span>
              <RefreshCw className="w-3.5 h-3.5 text-emerald-300 animate-spin flex-shrink-0" />
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-indigo-300 flex-shrink-0" />
              <span className="text-indigo-200">Hors-ligne — Les messages seront envoyés à la reconnexion</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
