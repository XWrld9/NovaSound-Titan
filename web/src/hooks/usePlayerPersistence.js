/**
 * usePlayerPersistence — NovaSound TITAN LUX v1000
 *
 * Deux responsabilités :
 *  1. KEEPALIVE  : ping le Service Worker toutes les 20s pendant la lecture
 *                  pour éviter que le SW soit suspendu (iOS Safari, Android Chrome)
 *                  → garde la Media Session active + notifications de contrôle
 *
 *  2. ÉTAT       : sauvegarde l'état du lecteur (song + position + playlist) dans
 *                  le cache SW à chaque changement significatif.
 *                  Restaure cet état au montage si l'app est rechargée.
 *
 * Usage :
 *   const { savedState, clearSavedState } = usePlayerPersistence({
 *     currentSong, playlist, currentTime, isPlaying
 *   });
 */

import { useEffect, useRef, useCallback } from 'react';

const SW_CHANNEL = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('novasound-player')
  : null;

// ── Envoi message SW avec MessageChannel (réponse async) ─────────────────────
const swMessage = (type, payload = {}) =>
  new Promise((resolve) => {
    if (!navigator.serviceWorker?.controller) { resolve(null); return; }
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = (e) => resolve(e.data);
    navigator.serviceWorker.controller.postMessage({ type, payload }, [port2]);
    // Timeout sécurité 3s
    setTimeout(() => resolve(null), 3000);
  });

// ── Envoi fire-and-forget ─────────────────────────────────────────────────────
const swPost = (type, payload = {}) => {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type, payload });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const usePlayerPersistence = ({ currentSong, playlist = [], currentTime = 0, isPlaying = false } = {}) => {
  const keepAliveRef   = useRef(null);
  const saveTimeoutRef = useRef(null);

  // ── 1. KEEPALIVE — actif uniquement pendant la lecture ─────────────────────
  useEffect(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }

    if (!isPlaying) return;

    const ping = () => {
      swPost('PLAYER_KEEPALIVE');
      // Aussi via BroadcastChannel si disponible (évite le MessageChannel overhead)
      SW_CHANNEL?.postMessage({ type: 'PLAYER_KEEPALIVE' });
    };

    ping(); // Ping immédiat
    keepAliveRef.current = setInterval(ping, 20_000); // Toutes les 20s

    return () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    };
  }, [isPlaying]);

  // ── 2. SAUVEGARDE — debounce 2s pour éviter les écrits trop fréquents ──────
  const saveState = useCallback(() => {
    if (!currentSong?.id) return;

    const state = {
      song:      currentSong,
      playlist:  playlist.slice(0, 50), // max 50 songs pour rester léger
      position:  Math.floor(currentTime),
      isPlaying: false, // on ne restaure jamais en lecture auto (politique UX)
    };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      swPost('PLAYER_STATE_SAVE', state);
      // Fallback localStorage si SW pas disponible
      try {
        localStorage.setItem('_ns_player_state', JSON.stringify({
          ...state,
          savedAt: Date.now(),
        }));
      } catch (_) {}
    }, 2000);
  }, [currentSong, playlist, currentTime]);

  useEffect(() => {
    saveState();
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [saveState]);

  // ── 3. RESTAURATION — lecture de l'état sauvegardé ─────────────────────────
  const loadSavedState = useCallback(async () => {
    // Essayer SW d'abord
    try {
      if (navigator.serviceWorker?.controller) {
        const res = await swMessage('PLAYER_STATE_LOAD');
        if (res?.state?.song?.id) {
          const age = Date.now() - (res.state.savedAt || 0);
          // Ignorer si état > 8h (périmé)
          if (age < 8 * 60 * 60 * 1000) return res.state;
        }
      }
    } catch (_) {}

    // Fallback localStorage
    try {
      const raw = localStorage.getItem('_ns_player_state');
      if (raw) {
        const state = JSON.parse(raw);
        const age = Date.now() - (state.savedAt || 0);
        if (state?.song?.id && age < 8 * 60 * 60 * 1000) return state;
      }
    } catch (_) {}

    return null;
  }, []);

  const clearSavedState = useCallback(() => {
    swPost('PLAYER_STATE_SAVE', {});
    try { localStorage.removeItem('_ns_player_state'); } catch (_) {}
  }, []);

  return { loadSavedState, clearSavedState };
};

export default usePlayerPersistence;
