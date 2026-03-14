/**
 * 👑 Admin Broadcast Panel - NovaSound TITAN LUX
 * 
 * Panneau d'administration pour envoyer des broadcasts
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  Target,
  History,
  BarChart3,
  Settings,
  X,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NoTranslate from '@/components/NoTranslate';
import { 
  sendBroadcast, 
  sendTargetedBroadcast, 
  createPresetBroadcast,
  getBroadcastHistory,
  getBroadcastStats,
  BROADCAST_TYPES,
  isAdmin,
  isModeratorOrAdmin
} from '@/lib/broadcastUtils';

const AdminBroadcastPanel = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  
  // Formulaire
  const [broadcastType, setBroadcastType] = useState('ANNOUNCEMENT');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [targetMode, setTargetMode] = useState('all'); // 'all' | 'targeted'
  
  // Ciblage
  const [targetCriteria, setTargetCriteria] = useState({
    followersCount: '',
    totalPlays: '',
    createdAfter: '',
    isEarlyAdopter: false
  });
  
  // Historique et stats
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  
  // Messages
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkPermissions();
    loadHistory();
    loadStats();
  }, []);

  const checkPermissions = async () => {
    if (!currentUser) return;
    const permission = await isModeratorOrAdmin(currentUser.id);
    setHasPermission(permission);
  };

  const loadHistory = async () => {
    try {
      const data = await getBroadcastHistory(20);
      setHistory(data);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getBroadcastStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleSendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Le titre et le message sont requis');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let result;
      
      if (targetMode === 'all') {
        result = await sendBroadcast(currentUser.id, broadcastType, title.trim(), body.trim(), {
          url: url.trim() || undefined,
          actionLabel: actionLabel.trim() || undefined
        });
      } else {
        // Construire les critères de ciblage
        const criteria = {};
        if (targetCriteria.followersCount) {
          criteria.followersCount = parseInt(targetCriteria.followersCount);
        }
        if (targetCriteria.totalPlays) {
          criteria.totalPlays = parseInt(targetCriteria.totalPlays);
        }
        if (targetCriteria.createdAfter) {
          criteria.createdAfter = targetCriteria.createdAfter;
        }
        if (targetCriteria.isEarlyAdopter) {
          criteria.isEarlyAdopter = true;
        }

        result = await sendTargetedBroadcast(currentUser.id, broadcastType, title.trim(), body.trim(), criteria, {
          url: url.trim() || undefined,
          actionLabel: actionLabel.trim() || undefined
        });
      }

      setSuccess(`✅ Broadcast envoyé à ${result.recipients} utilisateur(s)`);
      
      // Réinitialiser le formulaire
      setTitle('');
      setBody('');
      setUrl('');
      setActionLabel('');
      
      // Recharger l'historique et les stats
      loadHistory();
      loadStats();
      
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'envoi du broadcast');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetBroadcast = async (presetKey) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await createPresetBroadcast(currentUser.id, presetKey);
      setSuccess(`✅ Broadcast prédéfini envoyé à ${result.recipients} utilisateur(s)`);
      
      loadHistory();
      loadStats();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'envoi du broadcast');
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = BROADCAST_TYPES[broadcastType] || BROADCAST_TYPES.ANNOUNCEMENT;

  if (!hasPermission) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-gray-900 border border-red-500/30 rounded-xl p-6 max-w-md w-full">
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Accès refusé</h3>
          </div>
          <p className="text-gray-300 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder au panneau de broadcast.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Send className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Panneau de Broadcast</h2>
              <p className="text-gray-400 text-sm">Envoyer des annonces à tous les utilisateurs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { id: 'create', label: 'Créer', icon: Send },
            { id: 'presets', label: 'Prédéfinis', icon: Settings },
            { id: 'history', label: 'Historique', icon: History },
            { id: 'stats', label: 'Statistiques', icon: BarChart3 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            {activeTab === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Target Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Mode de diffusion
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTargetMode('all')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                        targetMode === 'all'
                          ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <Users className="w-4 h-4 inline mr-2" />
                      Tous les utilisateurs
                    </button>
                    <button
                      onClick={() => setTargetMode('targeted')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                        targetMode === 'targeted'
                          ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <Target className="w-4 h-4 inline mr-2" />
                      Ciblé
                    </button>
                  </div>
                </div>

                {/* Target Criteria (si mode ciblé) */}
                {targetMode === 'targeted' && (
                  <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Critères de ciblage
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Minimum d'abonnés
                        </label>
                        <input
                          type="number"
                          value={targetCriteria.followersCount}
                          onChange={(e) => setTargetCriteria(prev => ({ ...prev, followersCount: e.target.value }))}
                          placeholder="Ex: 50"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Minimum de plays
                        </label>
                        <input
                          type="number"
                          value={targetCriteria.totalPlays}
                          onChange={(e) => setTargetCriteria(prev => ({ ...prev, totalPlays: e.target.value }))}
                          placeholder="Ex: 1000"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-gray-300">
                        <input
                          type="checkbox"
                          checked={targetCriteria.isEarlyAdopter}
                          onChange={(e) => setTargetCriteria(prev => ({ ...prev, isEarlyAdopter: e.target.checked }))}
                          className="rounded border-gray-600 bg-gray-800 text-purple-500"
                        />
                        Pionniers uniquement (30 premiers jours)
                      </label>
                    </div>
                  </div>
                )}

                {/* Type de broadcast */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type de broadcast
                  </label>
                  <select
                    value={broadcastType}
                    onChange={(e) => setBroadcastType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  >
                    {Object.entries(BROADCAST_TYPES).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.icon} {config.label} - {config.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Formulaire */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Titre *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titre du broadcast..."
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Message *
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Message du broadcast..."
                      rows={4}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL (optionnel)
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="/announcements"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Texte du bouton (optionnel)
                    </label>
                    <input
                      type="text"
                      value={actionLabel}
                      onChange={(e) => setActionLabel(e.target.value)}
                      placeholder="Voir plus"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2"
                  >
                    {showPreview ? 'Masquer' : 'Afficher'} l'aperçu
                  </button>
                  
                  <AnimatePresence>
                    {showPreview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-500/20 rounded-lg">
                            {typeConfig.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{title || 'Titre'}</h4>
                            <p className="text-gray-300 text-sm mt-1">{body || 'Message'}</p>
                            {actionLabel && (
                              <button className="mt-2 px-3 py-1 bg-purple-500 text-white text-sm rounded-lg">
                                {actionLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSendBroadcast}
                    disabled={loading || !title.trim() || !body.trim()}
                    className="flex-1 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Envoyer le broadcast
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'presets' && (
              <motion.div
                key="presets"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-medium text-white mb-4">Broadcasts prédéfinis</h3>
                
                {[
                  {
                    key: 'WELCOME_NEW_FEATURES',
                    title: 'Nouvelles fonctionnalités',
                    description: 'Annoncer les nouvelles fonctionnalités',
                    icon: '🚀'
                  },
                  {
                    key: 'MAINTENANCE_SCHEDULED',
                    title: 'Maintenance programmée',
                    description: 'Informer d\'une maintenance',
                    icon: '🔧'
                  },
                  {
                    key: 'WEEKEND_EVENT',
                    title: 'Événement week-end',
                    description: 'Promouvoir un événement spécial',
                    icon: '🎉'
                  },
                  {
                    key: 'NEW_ACHIEVEMENTS',
                    title: 'Nouveaux trophées',
                    description: 'Annoncer de nouveaux trophées',
                    icon: '🏆'
                  }
                ].map(preset => (
                  <div key={preset.key} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{preset.icon}</div>
                        <div>
                          <h4 className="text-white font-medium">{preset.title}</h4>
                          <p className="text-gray-400 text-sm">{preset.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePresetBroadcast(preset.key)}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                      >
                        Envoyer
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-medium text-white mb-4">Historique des broadcasts</h3>
                
                {history.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Aucun broadcast envoyé</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((broadcast) => (
                      <div key={broadcast.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{broadcast.title}</h4>
                            <p className="text-gray-300 text-sm mt-1 line-clamp-2">{broadcast.body}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span><NoTranslate>{broadcast.users?.username}</NoTranslate></span>
                              <span>{new Date(broadcast.created_at).toLocaleString()}</span>
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                                {broadcast.metadata?.broadcastType || 'ANNOUNCEMENT'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-medium text-white mb-4">Statistiques des broadcasts</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-2xl font-bold text-purple-400">{stats.total || 0}</div>
                    <div className="text-gray-400 text-sm">Total (30j)</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-2xl font-bold text-green-400">{stats.recent || 0}</div>
                    <div className="text-gray-400 text-sm">Cette semaine</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-2xl font-bold text-blue-400">{stats.byType?.UPDATE || 0}</div>
                    <div className="text-gray-400 text-sm">Mises à jour</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-2xl font-bold text-orange-400">{stats.byType?.EVENT || 0}</div>
                    <div className="text-gray-400 text-sm">Événements</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-3">Par type</h4>
                  <div className="space-y-2">
                    {Object.entries(stats.byType || {}).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                        <span className="text-gray-300">{type}</span>
                        <span className="text-purple-400 font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-6 mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-400"
            >
              <CheckCircle className="w-5 h-5" />
              {success}
            </motion.div>
          )}
          
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-6 mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400"
            >
              <AlertTriangle className="w-5 h-5" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AdminBroadcastPanel;
