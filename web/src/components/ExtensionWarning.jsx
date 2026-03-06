/**
 * Extension Warning - NovaSound TITAN LUX V410000
 * Alerte pour les extensions détectées
 */

import React, { useState } from 'react';
import { AlertTriangle, X, Shield } from 'lucide-react';

const ExtensionWarning = ({ warnings, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed || !warnings?.length) {
    return null;
  }
  
  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-orange-500/90 border border-orange-600 rounded-lg p-4 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1">
          <h4 className="text-white font-medium text-sm mb-1">
            Extension détectée
          </h4>
          <p className="text-white/80 text-xs mb-2">
            Une extension pourrait interférer avec le fonctionnement de NovaSound.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
            >
              <Shield className="w-3 h-3 text-white" />
              <span className="text-white text-xs">Ignorer</span>
            </button>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ExtensionWarning;
