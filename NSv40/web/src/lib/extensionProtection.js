/**
 * Protection contre les interférences d'extensions Chrome
 * À charger en premier dans main.jsx
 */

// 1. Protéger les variables globales contre les modifications d'extensions
(function protectGlobalScope() {
  // Sauvegarder les objets natifs critiques
  const originalConsole = window.console;
  const originalFetch = window.fetch;
  const originalLocalStorage = window.localStorage;
  const originalSessionStorage = window.sessionStorage;
  
  // Restaurer si une extension les a modifiés
  if (window.console !== originalConsole) {
    window.console = originalConsole;
  }
  
  // 2. Bloquer les injections de scripts d'extensions connus
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(this, tagName);
    
    // Empêcher les injections de scripts d'extensions
    if (tagName.toLowerCase() === 'script') {
      Object.defineProperty(element, 'src', {
        set: function(value) {
          if (value && value.includes('chrome-extension://')) {
            console.warn('Extension script blocked:', value);
            return;
          }
          element.setAttribute('src', value);
        },
        get: function() {
          return element.getAttribute('src');
        }
      });
    }
    
    return element;
  };
  
  // 3. Gérer les erreurs d'extensions silencieusement
  window.addEventListener('error', function(event) {
    if (event.filename && event.filename.includes('chrome-extension://')) {
      event.preventDefault();
      event.stopPropagation();
      console.warn('Extension error ignored:', event.message);
      return false;
    }
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.toString().includes('chrome-extension://')) {
      event.preventDefault();
      console.warn('Extension promise rejection ignored:', event.reason);
      return false;
    }
  });
  
  // 4. Protéger localStorage contre les corruptions
  const originalSetItem = originalLocalStorage.setItem.bind(originalLocalStorage);
  originalLocalStorage.setItem = function(key, value) {
    try {
      originalSetItem(key, value);
    } catch (e) {
      console.warn('localStorage blocked by extension, using memory fallback');
      // Fallback en mémoire si localStorage est bloqué
      if (!window.memoryStorage) window.memoryStorage = {};
      window.memoryStorage[key] = value;
    }
  };
  
  // 5. Détecter et signaler les interférences
  setTimeout(() => {
    const hasExtensionInterference = 
      document.querySelector('script[src*="chrome-extension://"]') ||
      window.chrome && window.chrome.runtime;
    
    if (hasExtensionInterference) {
      console.warn('Extension interference detected - some features may be limited');
      
      // Notifier l'utilisateur discrètement
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff6b6b;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        opacity: 0.8;
      `;
      notification.textContent = 'Browser extension may interfere with app functionality';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    }
  }, 1000);
})();

// 6. Exporter un helper pour les composants React
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isExtensionInterference: () => document.querySelector('script[src*="chrome-extension://"]') !== null
  };
}
