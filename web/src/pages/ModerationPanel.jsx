import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Flag, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Ban, 
  Eye,
  MessageSquare,
  Trash2,
  Clock,
  User,
  Music,
  Newspaper
} from 'lucide-react';

const ModerationPanel = () => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    checkUserRole();
    fetchReports();
  }, []);

  const checkUserRole = async () => {
    if (!currentUser) return;

    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .single();

      setUserRole(data?.role || null);
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:users!reports_reporter_id_fkey(username, email),
          admin:users!reports_admin_id_fkey(username, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReport = async (reportId, action, adminNotes) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          admin_id: currentUser.id,
          admin_notes: adminNotes
        })
        .eq('id', reportId);

      if (error) throw error;

      fetchReports();
      setSelectedReport(null);
    } catch (error) {
      console.error('Error resolving report:', error);
    }
  };

  const handleBanUser = async (userId, reason, duration) => {
    try {
      const { error } = await supabase
        .from('banned_users')
        .insert({
          user_id: userId,
          banned_by: currentUser.id,
          reason: reason,
          ban_type: duration === 'permanent' ? 'permanent' : 'temporary',
          ban_duration: duration === 'permanent' ? null : duration,
          expires_at: duration === 'permanent' ? null : new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
        });

      if (error) throw error;

      // Marquer l'utilisateur comme banni
      await supabase
        .from('users')
        .update({
          is_banned: true,
          ban_reason: reason,
          ban_expires_at: duration === 'permanent' ? null : new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', userId);

      fetchReports();
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const getContentIcon = (contentType) => {
    switch (contentType) {
      case 'song': return <Music className="w-4 h-4" />;
      case 'news': return <Newspaper className="w-4 h-4" />;
      case 'user': return <User className="w-4 h-4" />;
      default: return <Flag className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-400 bg-yellow-500/10';
      case 'reviewed': return 'text-blue-400 bg-blue-500/10';
      case 'resolved': return 'text-green-400 bg-green-500/10';
      case 'dismissed': return 'text-gray-400 bg-gray-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  if (!userRole || !['admin', 'moderator'].includes(userRole)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Accès Restreint</h2>
          <p className="text-gray-400">Vous n'avez pas les permissions pour accéder au panneau de modération.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-white">Panneau de Modération</h1>
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
            {userRole === 'admin' ? 'Administrateur' : 'Modérateur'}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-cyan-400">Chargement des signalements...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Flag className="w-8 h-8 text-yellow-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {reports.filter(r => r.status === 'pending').length}
                    </div>
                    <div className="text-sm text-gray-400">En attente</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Eye className="w-8 h-8 text-blue-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {reports.filter(r => r.status === 'reviewed').length}
                    </div>
                    <div className="text-sm text-gray-400">En cours</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {reports.filter(r => r.status === 'resolved').length}
                    </div>
                    <div className="text-sm text-gray-400">Résolus</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <X className="w-8 h-8 text-gray-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {reports.filter(r => r.status === 'dismissed').length}
                    </div>
                    <div className="text-sm text-gray-400">Rejetés</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Liste des signalements */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-xl font-semibold text-white">Signalements récents</h2>
              </div>
              <div className="divide-y divide-gray-800">
                {reports.length === 0 ? (
                  <div className="p-8 text-center">
                    <Flag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Aucun signalement pour le moment</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getContentIcon(report.content_type)}
                            <span className="font-medium text-white capitalize">{report.content_type}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                              {report.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-300 mb-2">
                            <strong>Raison:</strong> {report.reason}
                          </div>
                          {report.description && (
                            <div className="text-sm text-gray-400 mb-2">
                              <strong>Description:</strong> {report.description}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Signalé par {report.reporter?.username}</span>
                            <span>•</span>
                            <span>{new Date(report.created_at).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                            className="border-gray-700 text-gray-300 hover:bg-gray-800"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal pour les détails du signalement */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Détails du signalement</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Type de contenu</label>
                    <div className="flex items-center gap-2 mt-1">
                      {getContentIcon(selectedReport.content_type)}
                      <span className="text-white capitalize">{selectedReport.content_type}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Statut</label>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedReport.status)}`}>
                        {selectedReport.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Raison</label>
                  <div className="text-white mt-1 capitalize">{selectedReport.reason}</div>
                </div>

                {selectedReport.description && (
                  <div>
                    <label className="text-sm text-gray-400">Description</label>
                    <div className="text-white mt-1">{selectedReport.description}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Signalé par</label>
                    <div className="text-white mt-1">{selectedReport.reporter?.username}</div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Date</label>
                    <div className="text-white mt-1">
                      {new Date(selectedReport.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>

                {selectedReport.status === 'pending' && (
                  <div className="pt-4 border-t border-gray-800">
                    <h4 className="text-white font-medium mb-3">Actions</h4>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleResolveReport(selectedReport.id, 'dismiss', 'Non pertinent')}
                        className="bg-gray-600 hover:bg-gray-700"
                      >
                        Rejeter
                      </Button>
                      <Button
                        onClick={() => handleResolveReport(selectedReport.id, 'resolve', 'Contenu traité')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Résoudre
                      </Button>
                      {userRole === 'admin' && (
                        <Button
                          onClick={() => handleBanUser(selectedReport.reporter_id, 'Violation des règles', 7)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Bannir 7j
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModerationPanel;
