/**
 * OnlineContext — NovaSound TITAN LUX V70000
 * Détection réseau fiable : navigator.onLine + vrai ping HTTP
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const OnlineContext = createContext({ isOnline: true, wasOffline: false });
export const useOnline = () => useContext(OnlineContext);

const pingCheck = async () => {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    await fetch('https://www.google.com/generate_204', {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal,
    });
    clearTimeout(timer);
    return true;
  } catch { return false; }
};

export const OnlineProvider = ({ children }) => {
  const [isOnline,   setIsOnline]   = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState(false);
  const reconnectCbs = useRef([]);
  const offlineTimer = useRef(null); // délai avant de confirmer le mode offline

  const goOnline = useCallback(() => {
    // Annuler le timer offline s'il est en cours
    if (offlineTimer.current) { clearTimeout(offlineTimer.current); offlineTimer.current = null; }
    setIsOnline(true);
    setWasOffline(true);
    reconnectCbs.current.forEach(cb => { try { cb(); } catch(e) {} });
    setTimeout(() => setWasOffline(false), 4000);
  }, []);

  const goOffline = useCallback(() => {
    // Attendre 5s avant de passer en mode offline
    // Evite les faux positifs sur coupures momentanées (changement WiFi, etc.)
    if (offlineTimer.current) return; // timer déjà en cours
    offlineTimer.current = setTimeout(() => {
      offlineTimer.current = null;
      setIsOnline(false);
      setWasOffline(false);
    }, 60000); // 1 minute — évite les faux positifs
  }, []);

  useEffect(() => {
    const onOnline  = async () => { const ok = await pingCheck(); if (ok) goOnline(); else goOffline(); };
    const onOffline = () => goOffline();

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    // Ping périodique toutes les 30s (détecte captive portals)
    const interval = setInterval(async () => {
      const ok = await pingCheck();
      if (ok  && !isOnline) goOnline();
      if (!ok && isOnline)  goOffline();
    }, 30_000);

    // Ping initial si navigator dit offline
    if (!navigator.onLine) goOffline();

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
    };
  }, [goOnline, goOffline, isOnline]);

  const onReconnect = useCallback((cb) => {
    reconnectCbs.current.push(cb);
    return () => { reconnectCbs.current = reconnectCbs.current.filter(x => x !== cb); };
  }, []);

  return (
    <OnlineContext.Provider value={{ isOnline, wasOffline, onReconnect }}>
      {children}
    </OnlineContext.Provider>
  );
};
