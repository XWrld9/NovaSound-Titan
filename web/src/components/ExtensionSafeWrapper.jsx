/**
 * Extension Safe Wrapper - NovaSound TITAN LUX V410000
 * Wrapper pour protéger les composants contre les extensions
 */

import React, { useEffect, useRef } from 'react';
import { extensionProtection } from '@/lib/extensionProtection';

const ExtensionSafeWrapper = ({ children, onWarning }) => {
  const wrapperRef = useRef(null);
  
  useEffect(() => {
    // Détecter les interférences
    const warnings = extensionProtection.detectInterference();
    
    if (warnings.length > 0) {
      console.warn('[ExtensionSafeWrapper] Interference detected:', warnings);
      onWarning?.(warnings);
    }
    
    // Protéger l'API
    extensionProtection.protectAPI();
    
    return () => {
      extensionProtection.restore();
    };
  }, [onWarning]);
  
  return (
    <div ref={wrapperRef} className="extension-safe-wrapper">
      {children}
    </div>
  );
};

export default ExtensionSafeWrapper;
