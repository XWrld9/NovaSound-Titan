import { useState, useEffect } from 'react';

/**
 * Stockage global de l'event beforeinstallprompt
 * pour qu'il ne soit pas perdu entre les re-renders / remounts.
 */
let _globalDeferredPrompt = null;
const _listeners = new Set();

const notifyListeners = () => _listeners.forEach(fn => fn(_globalDeferredPrompt));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _globalDeferredPrompt = e;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    _globalDeferredPrompt = null;
    notifyListeners();
  });
}

/**
 * usePWAInstall
 * Capture le beforeinstallprompt et expose une fonction install().
 * Utilise un stockage global pour ne pas rater l'event.
 */
const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(_globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true)
  );

  useEffect(() => {
    const handler = (prompt) => {
      setDeferredPrompt(prompt);
      if (!prompt) setIsInstalled(true);
    };

    _listeners.add(handler);

    // Récupère l'event s'il a été capturé avant le mount
    if (_globalDeferredPrompt) {
      setDeferredPrompt(_globalDeferredPrompt);
    }

    return () => _listeners.delete(handler);
  }, []);

  const install = async () => {
    const prompt = _globalDeferredPrompt || deferredPrompt;
    if (!prompt) return false;
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        _globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        return true;
      }
    } catch (err) {
      console.warn('[PWA] Erreur install:', err);
    }
    return false;
  };

  const canInstall = !!(_globalDeferredPrompt || deferredPrompt) && !isInstalled;

  return { canInstall, isInstalled, install };
};

export default usePWAInstall;
