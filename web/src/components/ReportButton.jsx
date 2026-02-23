import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Flag, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Shield, 
  Ban, 
  Eye,
  MessageSquare,
  Trash2,
  Clock
} from 'lucide-react';

const ReportButton = ({ contentType, contentId, onReported }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc('report_content', {
        content_type_param: contentType,
        content_id_param: contentId,
        reporter_id_param: currentUser.id,
        reason_param: reason,
        description_param: description || null
      });

      if (error) throw error;

      setIsOpen(false);
      setReason('');
      setDescription('');
      if (onReported) onReported();
    } catch (error) {
      console.error('Error reporting content:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
      >
        <Flag className="w-4 h-4" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-400" />
                Signaler le contenu
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Raison du signalement
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Sélectionnez une raison</option>
                  <option value="spam">Spam</option>
                  <option value="inappropriate">Contenu inapproprié</option>
                  <option value="copyright">Violation de droits d'auteur</option>
                  <option value="harassment">Harcèlement</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez pourquoi vous signalez ce contenu..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !reason}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {loading ? 'Signalement...' : 'Signaler'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ReportButton;
