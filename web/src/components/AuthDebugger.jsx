import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, Bug, AlertCircle } from 'lucide-react';

const AuthDebugger = () => {
  const { 
    currentUser, 
    initialLoading, 
    clearCorruptedSession, 
    diagnoseConnection,
    isAuthenticated 
  } = useAuth();

  const handleClearSession = () => {
    if (window.confirm('Êtes-vous sûr de vouloir nettoyer votre session ? Cela vous déconnectera.')) {
      clearCorruptedSession();
      window.location.reload();
    }
  };

  const handleDiagnose = async () => {
    const diagnosis = await diagnoseConnection();
    
    const diagnosisText = `
🔍 DIAGNOSTIC COMPLET SUPABASE

📊 ÉTAT ACTUEL:
- Connecté: ${isAuthenticated ? '✅ OUI' : '❌ NON'}
- Loading: ${initialLoading ? '⏳ OUI' : '✅ NON'}
- Email: ${currentUser?.email || 'Non connecté'}
- User ID: ${currentUser?.id || 'N/A'}

🌐 RÉSEAU:
- URL: ${diagnosis.supabaseUrl}
- Connecté: ${diagnosis.networkConnected ? '✅' : '❌'}
- Latence: ${diagnosis.latency}ms
- Erreur: ${diagnosis.networkError || 'Aucune'}

🔐 AUTHENTIFICATION:
- Session active: ${diagnosis.hasSession ? '✅' : '❌'}
- Erreur session: ${diagnosis.sessionError || 'Aucune'}

💾 BASE DE DONNÉES:
- Connexion: ${diagnosis.databaseConnection ? '✅' : '❌'}
- Erreur DB: ${diagnosis.databaseError || 'Aucune'}

🧹 SOLUTIONS:
${initialLoading ? '⚠️ Loading infini détecté → Essayez "Nettoyer Session"' : ''}
${!diagnosis.networkConnected ? '❌ Problème réseau → Vérifiez votre connexion' : ''}
${!diagnosis.databaseConnection ? '❌ Base inaccessible → Vérifiez Supabase' : ''}
${!isAuthenticated && !initialLoading ? '✅ État normal → Essayez de vous reconnecter' : ''}
    `.trim();

    alert(diagnosisText);
  };

  const handleHardRefresh = () => {
    // Vider le cache et recharger
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    window.location.reload(true);
  };

  // Ne pas afficher en production
  if (window.location.hostname === 'nova-sound-titan.vercel.app') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <Bug className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-gray-300">Debug Auth</span>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">État:</span>
          <span className={isAuthenticated ? "text-green-400" : "text-red-400"}>
            {isAuthenticated ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Loading:</span>
          <span className={initialLoading ? "text-yellow-400" : "text-green-400"}>
            {initialLoading ? '⏳' : '✅'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">User:</span>
          <span className="text-gray-300 truncate max-w-[120px]">
            {currentUser?.email?.split('@')[0] || 'Aucun'}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Button
          onClick={handleDiagnose}
          size="sm"
          variant="outline"
          className="w-full text-xs"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Diagnostic Complet
        </Button>
        
        <Button
          onClick={handleClearSession}
          size="sm"
          variant="outline"
          className="w-full text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Nettoyer Session
        </Button>
        
        <Button
          onClick={handleHardRefresh}
          size="sm"
          variant="outline"
          className="w-full text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Hard Refresh
        </Button>
      </div>
    </div>
  );
};

export default AuthDebugger;
