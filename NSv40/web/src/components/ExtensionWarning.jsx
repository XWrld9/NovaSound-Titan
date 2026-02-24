/**
 * Composant d'alerte pour les interférences d'extensions
 */
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ExtensionWarning = () => {
  const { extensionWarning } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);

  if (!extensionWarning || dismissed) return null;

  return (
    <div className="fixed top-4 right-4 max-w-sm bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 z-50 animate-pulse">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-yellow-400 font-semibold text-sm mb-1">
            Browser Extension Detected
          </h4>
          <p className="text-yellow-200 text-xs mb-2">
            Some browser extensions may interfere with login and audio features. 
            Try disabling them if you experience issues.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDismissed(true)}
              className="text-yellow-400 text-xs hover:text-yellow-300"
            >
              Dismiss
            </button>
            <button
              onClick={() => window.open('/chrome-extension-fix', '_blank')}
              className="text-yellow-400 text-xs hover:text-yellow-300 underline"
            >
              Learn More
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-400 hover:text-yellow-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ExtensionWarning;
