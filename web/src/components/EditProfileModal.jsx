import React, { useState, useEffect } from 'react';
import { X, Upload, User, Mail, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const EditProfileModal = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile, supabase } = useAuth();
  const [formData, setFormData] = useState({ username: '', bio: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Charger les données depuis la table users (pas juste auth)
  useEffect(() => {
    if (!currentUser || !isOpen) return;
    setError('');
    setSuccess('');
    setAvatarFile(null);

    const loadProfile = async () => {
      setIsFetching(true);
      try {
        const { data } = await supabase
          .from('users')
          .select('username, bio, avatar_url')
          .eq('id', currentUser.id)
          .single();

        if (data) {
          setFormData({
            username: data.username || '',
            bio: data.bio || ''
          });
          setAvatarPreview(data.avatar_url || '');
        } else {
          // Fallback sur les métadonnées auth
          setFormData({
            username: currentUser.user_metadata?.username || '',
            bio: ''
          });
          setAvatarPreview(currentUser.avatar_url || '');
        }
      } catch {
        setFormData({
          username: currentUser.user_metadata?.username || '',
          bio: ''
        });
      } finally {
        setIsFetching(false);
      }
    };

    loadProfile();
  }, [currentUser, isOpen]);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("L'avatar ne doit pas dépasser 5 MB");
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image valide');
      return;
    }
    setAvatarFile(file);
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      let avatarUrl = avatarPreview.startsWith('http') ? avatarPreview : null;

      // Upload avatar
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop().toLowerCase();
        // Nom unique par utilisateur — upsert écrase l'ancien
        const fileName = `avatar-${currentUser.id}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, {
            cacheControl: '3600',
            upsert: true,        // Écrase si existe déjà
            contentType: avatarFile.type
          });

        if (uploadError) {
          setError('Erreur upload avatar : ' + uploadError.message);
          setIsLoading(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        // Forcer le refresh du cache navigateur
        avatarUrl = `${publicUrl}?t=${Date.now()}`;
      }

      const updateData = {
        username: formData.username.trim(),
        bio: formData.bio.trim()
      };
      if (avatarUrl) updateData.avatar_url = avatarUrl;

      const { success: ok, message } = await updateProfile(updateData);

      if (ok) {
        setSuccess('Profil mis à jour !');
        setTimeout(onClose, 1000);
      } else {
        setError(message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      setError('Erreur : ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Modifier le profil</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm">
              {success}
            </div>
          )}

          {isFetching ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="relative mb-2">
                  <img
                    src={avatarPreview || '/profil par defaut.png'}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-2 border-cyan-500/50"
                    onError={(e) => { e.target.src = '/profil par defaut.png'; }}
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 bg-gradient-to-r from-cyan-500 to-magenta-500 text-white p-2 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <Upload className="w-4 h-4" />
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500">Max 5 MB — JPG, PNG, GIF</p>
              </div>

              {/* Username */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  placeholder="Ton nom d'artiste..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                />
              </div>

              {/* Email readonly */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  Email <span className="text-gray-500 text-xs">(non modifiable)</span>
                </label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Biographie
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={500}
                  placeholder="Parle de toi..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{formData.bio.length}/500</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-magenta-500 hover:opacity-90 text-white rounded-lg font-medium transition-all disabled:opacity-60"
                >
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditProfileModal;
