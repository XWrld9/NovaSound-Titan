/**
 * Composant wrapper pour les opérations sensibles qui peuvent être bloquées par des extensions
 */
import React, { useState, useEffect } from 'react';

export const ExtensionSafeComponent = ({ children, fallback = null, onExtensionBlock = null }) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Détecter si des extensions bloquent des fonctionnalités
    const checkExtensionInterference = () => {
      try {
        // Test localStorage
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        
        // Test fetch
        return fetch('/api/health', { method: 'HEAD' }).catch(() => null);
      } catch (e) {
        return true; // Extension bloque l'accès
      }
    };

    if (checkExtensionInterference()) {
      setIsBlocked(true);
      onExtensionBlock?.();
    }
  }, [onExtensionBlock]);

  // Gérer les erreurs causées par des extensions
  const handleError = (error) => {
    if (error.message && error.message.includes('chrome-extension://')) {
      setHasError(true);
      return null; // Ne pas propager l'erreur
    }
    throw error; // Propager les autres erreurs
  };

  if (hasError) {
    return fallback || <div>Some features may be limited due to browser extensions.</div>;
  }

  if (isBlocked) {
    return fallback || <div>Please disable browser extensions for full functionality.</div>;
  }

  return (
    <div onError={handleError}>
      {children}
    </div>
  );
};

/**
 * Hook pour les opérations sécurisées (localStorage, fetch, etc.)
 */
export const useExtensionSafeStorage = () => {
  const [useMemoryFallback, setUseMemoryFallback] = useState(false);

  const safeSetItem = (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // Fallback en mémoire si localStorage est bloqué
      if (!window.memoryStorage) window.memoryStorage = {};
      window.memoryStorage[key] = value;
      setUseMemoryFallback(true);
      return false;
    }
  };

  const safeGetItem = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      // Utiliser le fallback en mémoire
      return window.memoryStorage?.[key] || null;
    }
  };

  const safeRemoveItem = (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      // Utiliser le fallback en mémoire
      if (window.memoryStorage) {
        delete window.memoryStorage[key];
      }
      return false;
    }
  };

  return {
    setItem: safeSetItem,
    getItem: safeGetItem,
    removeItem: safeRemoveItem,
    useMemoryFallback
  };
};

/**
 * Wrapper fetch sécurisé
 */
export const safeFetch = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    // Si l'erreur vient d'une extension, essayer avec une approche différente
    if (error.message && error.message.includes('chrome-extension://')) {
      console.warn('Extension blocked fetch, trying alternative method');
      
      // Essayer avec une requête simple
      try {
        const response = await fetch(url, { 
          ...options, 
          mode: 'cors',
          cache: 'no-cache'
        });
        return response;
      } catch (fallbackError) {
        throw new Error('Network request blocked by browser extension');
      }
    }
    throw error;
  }
};
