import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, User, Mail, FileText, Instagram, Youtube, Music2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUrl as _supabaseUrl, supabaseAnonKey as _supabaseAnonKey } from '@/lib/supabaseClient';

// Compresser/redimensionner une image avant upload
const compressImage = (file, maxPx = 600, quality = 0.80) =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

// Retry wrapper
const withRetry = async (fn, attempts = 3, delayMs = 1000) => {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const isNetwork = /fetch|network|failed|timeout|xhr/i.test(e.message || '');
      if (!isNetwork || i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
};

// Upload via XHR PUT direct — contourne les limitations fetch() sur WebView Android
const uploadViaXHR = (uploadUrl, file, token, anonKey) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.timeout = 30000;
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Cache-Control', '3600');
    xhr.onload  = () => (xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Erreur réseau XHR'));
    xhr.ontimeout = () => reject(new Error('Timeout XHR 30s'));
    xhr.send(file);
  });

// Upload avatar robuste : SDK Supabase d'abord, puis fallback XHR
const uploadAvatarRobust = async (supabase, fileName, fileToUpload) => {
  // Tentative 1 : SDK Supabase (fetch)
  try {
    const { error } = await withRetry(() =>
      supabase.storage.from('avatars').upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      })
    );
    if (!error) return { ok: true };
    if (/row-level security|RLS|permission/i.test(error.message || '')) {
      return { ok: false, rlsError: true, message: error.message };
    }
    throw new Error(error.message);
  } catch (fetchErr) {
    // Tentative 2 : XHR PUT direct
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token    = sessionData?.session?.access_token;
      const baseUrl  = _supabaseUrl || '';
      const anonKey  = _supabaseAnonKey || '';
      if (!token || !baseUrl) throw new Error('Session invalide');

      const uploadUrl = `${baseUrl}/storage/v1/object/avatars/${fileName}`;
      await withRetry(() => uploadViaXHR(uploadUrl, fileToUpload, token, anonKey), 2, 1500);
      return { ok: true };
    } catch (xhrErr) {
      return { ok: false, message: `fetch: ${fetchErr.message} | XHR: ${xhrErr.message}` };
    }
  }
};

const EditProfileModal = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile, supabase } = useAuth();
  const [formData, setFormData] = useState({ username: '', bio: '', social_links: {} });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (!currentUser || !isOpen) return;
    setError(''); setSuccess(''); setAvatarFile(null); setUploadProgress('');

    const loadProfile = async () => {
      setIsFetching(true);
      try {
        const { data } = await supabase
          .from('users')
          .select('username, bio, avatar_url')
          .eq('id', currentUser.id)
          .single();
        if (data) {
          setFormData({ username: data.username || '', bio: data.bio || '', social_links: data.social_links || {} });
          setAvatarPreview(data.avatar_url || '');
        } else {
          setFormData({ username: currentUser.user_metadata?.username || '', bio: '' });
          setAvatarPreview(currentUser.avatar_url || '');
        }
      } catch {
        setFormData({ username: currentUser.user_metadata?.username || '', bio: '' });
      } finally {
        setIsFetching(false);
      }
    };
    loadProfile();
  }, [currentUser, isOpen]);

  const handleInputChange = (e) => {
    let val = e.target.value;
    // Bloquer les espaces dans le username
    if (e.target.name === 'username') val = val.replace(/ /g, '');
    setFormData(prev => ({ ...prev, [e.target.name]: val }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("L'avatar ne doit pas dépasser 5 MB"); return; }
    if (!file.type.startsWith('image/')) { setError('Veuillez sélectionner une image valide'); return; }
    setAvatarFile(file);
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); setError(''); setSuccess(''); setUploadProgress('');

    // Validation username
    const uname = formData.username.trim();
    if (uname.length < 3 || uname.length > 30) {
      setError('Le nom d'utilisateur doit contenir entre 3 et 30 caractères.');
      setIsLoading(false);
      return;
    }
    if (uname.includes(' ')) {
      setError('Pas d'espaces dans le nom d'utilisateur — utilise des tirets (------ ou --------) pour rester taggable dans le chat global.');
      setIsLoading(false);
      return;
    }

    try {
      let avatarUrl = avatarPreview && avatarPreview.startsWith('http') ? avatarPreview : null;

      if (avatarFile) {
        setUploadProgress("Compression de l'image…");
        // Double compression : d'abord 600px, puis si > 200 KB → 400px
        let fileToUpload = await compressImage(avatarFile, 600, 0.80);
        if (fileToUpload.size > 200 * 1024) {
          fileToUpload = await compressImage(fileToUpload, 400, 0.65);
        }

        const fileName = `avatar-${currentUser.id}.jpg`;
        setUploadProgress("Envoi de l'avatar…");

        const result = await uploadAvatarRobust(supabase, fileName, fileToUpload);

        if (!result.ok) {
          if (result.rlsError) {
            setError('Erreur de permission storage. Veuillez exécuter fix-rls-avatars.sql dans Supabase puis réessayer.');
          } else {
            setError('Erreur upload avatar : ' + (result.message || 'Erreur inconnue'));
          }
          setIsLoading(false); setUploadProgress('');
          return;
        }

        setUploadProgress("Récupération de l'URL…");
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = `${publicUrl}?t=${Date.now()}`;
      }

      setUploadProgress('Mise à jour du profil…');
      const updateData = { username: formData.username.trim(), bio: formData.bio.trim(), social_links: formData.social_links || {} };
      if (avatarUrl) updateData.avatar_url = avatarUrl;

      const { success: ok, message } = await updateProfile(updateData);
      setUploadProgress('');

      if (ok) {
        setSuccess('Profil mis à jour !');
        setTimeout(onClose, 1200);
      } else {
        setError(message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      setUploadProgress('');
      if (/fetch|network|failed|timeout/i.test(err.message || '')) {
        setError('Erreur réseau — vérifiez votre connexion et réessayez.');
      } else {
        setError('Erreur : ' + err.message);
      }
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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Modifier le profil</h2>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
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
          {uploadProgress && !error && !success && (
            <div className="mb-4 p-3 bg-gray-800/60 border border-white/10 rounded-lg text-gray-300 text-sm flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin flex-shrink-0" />
              {uploadProgress}
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
                  <label htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white p-2 rounded-full cursor-pointer hover:opacity-90 transition-opacity">
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
                <input type="text" name="username" value={formData.username} onChange={handleInputChange}
                  required placeholder="ton-nom-d-artiste" autoComplete="nickname" maxLength={30}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all" />
                <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                  <span className="text-amber-400">⚠</span>
                  <span>Sépare les mots par <strong className="text-cyan-400">------</strong> ou <strong className="text-cyan-400">--------</strong> pour rester taggable @dans-le-chat</span>
                </p>
              </div>

              {/* Email readonly */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  Email <span className="text-gray-500 text-xs">(non modifiable)</span>
                </label>
                <input type="email" value={currentUser?.email || ''} disabled
                  className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed" />
              </div>

              {/* Bio */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Biographie
                </label>
                <textarea name="bio" value={formData.bio} onChange={handleInputChange}
                  rows={3} maxLength={500} placeholder="Parle de toi..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none" />
                <p className="text-xs text-gray-500 mt-1 text-right">{formData.bio.length}/500</p>
              </div>

              {/* Réseaux sociaux */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                  <Music2 className="w-4 h-4 text-cyan-400" />
                  Réseaux sociaux <span className="text-gray-500 text-xs">(optionnel)</span>
                </label>
                <div className="space-y-2.5">
                  {[
                    { key: 'instagram', icon: Instagram, placeholder: 'instagram.com/tonpseudo', label: 'Instagram', color: 'text-pink-400' },
                    { key: 'tiktok',    icon: Music2,    placeholder: 'tiktok.com/@tonpseudo',   label: 'TikTok',    color: 'text-cyan-300' },
                    { key: 'youtube',   icon: Youtube,   placeholder: 'youtube.com/@tachaine',   label: 'YouTube',   color: 'text-red-400'  },
                    { key: 'soundcloud',icon: Music2,    placeholder: 'soundcloud.com/tonpseudo', label: 'SoundCloud',color: 'text-orange-400'},
                  ].map(({ key, icon: Icon, placeholder, label, color }) => (
                    <div key={key} className="relative">
                      <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${color} pointer-events-none`} />
                      <input
                        type="url"
                        value={formData.social_links?.[key] || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          social_links: { ...prev.social_links, [key]: e.target.value }
                        }))}
                        placeholder={placeholder}
                        className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={isLoading}
                  className="flex-1 px-4 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:opacity-90 text-white rounded-lg font-medium transition-all disabled:opacity-60">
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
