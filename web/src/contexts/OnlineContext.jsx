/**
 * OnlineContext — NovaSound TITAN LUX v4000
 * Détection réseau en temps réel + expo du statut global
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const OnlineContext = createContext({ isOnline: true, wasOffline: false });

export const useOnline = () => useContext(OnlineContext);

export const OnlineProvider = ({ children }) => {
  const [isOnline,   setIsOnline]   = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState(false);
  const reconnectCbs = useRef([]);

  const onOnline = useCallback(() => {
    setIsOnline(true);
    setWasOffline(true);
    reconnectCbs.current.forEach(cb => { try { cb(); } catch(e) { console.error('[OnlineContext] reconnect cb:', e); } });
    setTimeout(() => setWasOffline(false), 4000);
  }, []);

  const onOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [onOnline, onOffline]);

  // Permettre aux consumers d'enregistrer un callback de reconnexion
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
