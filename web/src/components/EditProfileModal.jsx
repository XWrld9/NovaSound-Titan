import React, { useState, useEffect } from 'react';
import { X, Upload, User, Mail, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const EditProfileModal = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile, supabase } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser && isOpen) {
      setFormData({
        username: currentUser.username || '',
        email: currentUser.email || '',
        bio: currentUser.bio || ''
      });
      setAvatarPreview(currentUser.avatar_url || '');
    }
  }, [currentUser, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validation
      if (file.size > 5 * 1024 * 1024) {
        alert('L\'avatar ne doit pas dépasser 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image valide');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let avatarUrl = currentUser.avatar_url;

      if (!avatarFile && !formData.username && !formData.bio) {
        alert('Aucune modification à enregistrer');
        setIsLoading(false);
        return;
      }

      // Upload de l'avatar si un fichier est sélectionné
      if (avatarFile) {
        // Rafraîchir la session pour éviter les locks
        await supabase.auth.refreshSession();
        
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;

        // Utiliser le bucket 'avatars' dédié avec retry pour éviter le lock
        let uploadData, uploadError;
        let retryCount = 0;
        const maxRetries = 3;

        do {
          const { data, error } = await supabase.storage
            .from('avatars')
            .upload(`${fileName}`, avatarFile, {
              cacheControl: '3600',
              upsert: true
            });
          
          uploadData = data;
          uploadError = error;
          retryCount++;

          if (uploadError && uploadError.message?.includes('Navigator LockManager')) {
            // Attendre avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        } while (uploadError && uploadError.message?.includes('Navigator LockManager') && retryCount < maxRetries);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert('Erreur lors de l\'upload de l\'avatar: ' + uploadError.message);
          setIsLoading(false);
          return;
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(`${fileName}`);

          avatarUrl = publicUrl;
        }
      }

      // Mise à jour du profil
      const updateData = {
        username: formData.username,
        bio: formData.bio
      };

      // N'inclure avatar_url que si un nouvel avatar a été uploadé
      if (avatarUrl !== currentUser.avatar_url) {
        updateData.avatar_url = avatarUrl;
      }

      const { success, message, data } = await updateProfile(updateData);

      if (success) {
        alert('Profil mis à jour avec succès!');
        onClose();
      } else {
        alert(message);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      alert('Une erreur est survenue lors de la mise à jour du profil');
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
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Modifier le profil</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <img
                  src={avatarPreview || `https://ui-avatars.com/api/?name=${formData.username}&background=random`}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors"
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
              <p className="text-sm text-gray-500 mt-2">
                Taille max: 5MB, Formats: JPG, PNG, GIF
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4" />
                Nom d'utilisateur
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Email - Read-only */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4" />
                Email (non modifiable)
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pour modifier l'email, contactez le support
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <FileText className="w-4 h-4" />
                Biographie
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500">
                {formData.bio.length}/500 caractères
              </p>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditProfileModal;
