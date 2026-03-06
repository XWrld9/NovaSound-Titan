/**
 * Auth Debugger - NovaSound TITAN LUX V410000
 * Outil de débogage pour l'authentification
 */

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bug, Eye, EyeOff, Copy } from 'lucide-react';

const AuthDebugger = ({ visible = false }) => {
  const { currentUser, session } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  
  if (!visible || !currentUser) {
    return null;
  }
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };
  
  return (
    <div className="fixed top-4 left-4 z-50 bg-gray-900/90 border border-gray-700 rounded-lg p-4 backdrop-blur-sm max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <Bug className="w-4 h-4 text-green-400" />
        <h3 className="text-white font-medium text-sm">Auth Debug</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="ml-auto text-gray-400 hover:text-white"
        >
          {showDetails ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">User ID:</span>
          <span className="text-white font-mono">{currentUser.id?.slice(0, 8)}...</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Email:</span>
          <span className="text-white">{currentUser.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Username:</span>
          <span className="text-white">{currentUser.username || 'N/A'}</span>
        </div>
        
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Session:</span>
              <button
                onClick={() => copyToClipboard(session?.access_token || '')}
                className="text-blue-400 hover:text-blue-300"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expires:</span>
              <span className="text-white">
                {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthDebugger;
