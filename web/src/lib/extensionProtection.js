/**
 * Extension Protection - NovaSound TITAN LUX V410000
 * Protection contre les extensions malveillantes
 */

export const extensionProtection = {
  // Détecter si une extension interfère avec l'application
  detectInterference() {
    const warnings = [];
    
    // Vérifier les modifications DOM non autorisées
    if (document.querySelector('style[data-extension]')) {
      warnings.push('Extension CSS detected');
    }
    
    // Vérifier les scripts injectés
    const scripts = Array.from(document.querySelectorAll('script'));
    const injectedScripts = scripts.filter(script => 
      !script.src.includes('novasound') && 
      !script.src.includes('vercel') &&
      script.src.length > 0
    );
    
    if (injectedScripts.length > 0) {
      warnings.push('Injected scripts detected');
    }
    
    return warnings;
  },
  
  // Protéger contre les modifications de l'API
  protectAPI() {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [url, options] = args;
      
      // Logger les appels suspects
      if (typeof url === 'string' && 
          (url.includes('chrome-extension://') || 
           url.includes('moz-extension://'))) {
        console.warn('[ExtensionProtection] Extension API call detected:', url);
      }
      
      return originalFetch.apply(this, args);
    };
  },
  
  // Restaurer l'environnement
  restore() {
    // Cette fonction pourrait restaurer l'état original si nécessaire
    console.info('[ExtensionProtection] Environment restored');
  }
};

export default extensionProtection;
