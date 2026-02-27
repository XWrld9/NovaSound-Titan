import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Upload, Music, Image, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const MusicUploadPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    description: '',
    genre: '',
  });
  const [audioFile, setAudioFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(null); // secondes détectées auto
  const [albumCover, setAlbumCover] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const GENRES = [
    'Afrobeats', 'Hip-Hop', 'R&B', 'Pop', 'Électronique', 'Trap',
    'Gospel', 'Jazz', 'Reggae', 'Dancehall', 'Amapiano', 'Coupé-Décalé',
    'Rock', 'Classique', 'Folk', 'Country', 'Latin', 'Drill', 'Outro',
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 52428800) {
        setError('Le fichier audio ne doit pas dépasser 50 Mo');
        return;
      }
      setAudioFile(file);
      setError('');
      // Auto-détecter la durée
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        if (isFinite(audio.duration)) setAudioDuration(Math.round(audio.duration));
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => { URL.revokeObjectURL(url); };
      audio.src = url;
    }
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20971520) { // 20MB
        setError('La pochette ne doit pas dépasser 20 Mo');
        return;
      }
      setAlbumCover(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!audioFile) {
      setError('Veuillez sélectionner un fichier audio');
      return;
    }

    // Limite de taille : 50 MB
    if (audioFile.size > 50 * 1024 * 1024) {
      setError('Le fichier audio est trop volumineux (max 50 MB)');
      return;
    }

    setLoading(true);
    setUploadProgress(10);

    // Fonction upload avec retry automatique (3 tentatives)
    const uploadWithRetry = async (bucket, path, file, options = {}, maxRetries = 3) => {
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // iOS Safari peut renvoyer application/octet-stream
          // On force le contentType depuis file.type ou on le déduit de l'extension
          const guessType = (f) => {
            if (f.type && f.type !== 'application/octet-stream') return f.type;
            const ext = f.name.split('.').pop().toLowerCase();
            const map = { mp3:'audio/mpeg', wav:'audio/wav', aac:'audio/aac',
              m4a:'audio/mp4', ogg:'audio/ogg', flac:'audio/flac',
              opus:'audio/opus', mp4:'audio/mp4', m4b:'audio/mp4',
              jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
              webp:'image/webp', gif:'image/gif' };
            return map[ext] || f.type || 'application/octet-stream';
          };
          const { error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: guessType(file),
              ...options
            });
          if (!error) return { success: true };
          // Si le fichier existe déjà, ce n'est pas une erreur bloquante
          if (error.message?.includes('already exists')) return { success: true };
          lastError = error;
        } catch (err) {
          lastError = err;
          // Attendre avant retry (backoff)
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, attempt * 1500));
        }
      }
      throw lastError;
    };

    try {
      setUploadProgress(20);

      // 1) Upload audio → bucket "audio" avec retry
      const audioExt = audioFile.name.split('.').pop();
      const audioPath = `${currentUser.id}-${Date.now()}.${audioExt}`;

      await uploadWithRetry('audio', audioPath, audioFile);
      setUploadProgress(60);

      const { data: audioPublic } = supabase.storage
        .from('audio')
        .getPublicUrl(audioPath);

      let albumCoverUrl = null;

      // 2) Upload cover (optionnel) → bucket "covers" avec retry
      if (albumCover) {
        const coverExt = albumCover.name.split('.').pop();
        const coverPath = `${currentUser.id}-${Date.now()}.${coverExt}`;

        await uploadWithRetry('covers', coverPath, albumCover);
        setUploadProgress(80);

        const { data: coverPublic } = supabase.storage
          .from('covers')
          .getPublicUrl(coverPath);
        albumCoverUrl = coverPublic?.publicUrl || null;
      }

      setUploadProgress(90);

      // 3) Insert song row
      const insertPayload = {
        title: formData.title,
        artist: formData.artist,
        uploader_id: currentUser.id,
        audio_url: audioPublic?.publicUrl || null,
        cover_url: albumCoverUrl,
        plays_count: 0,
        likes_count: 0,
        created_at: new Date().toISOString(),
        genre: formData.genre || null,
        duration_s: audioDuration || null,
      };

      const { error: insertError } = await supabase
        .from('songs')
        .insert(insertPayload);
      if (insertError) throw insertError;

      setUploadProgress(100);
      setSuccess('Morceau uploadé avec succès ! Redirection...');

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Upload error:', err);
      // Traduire les erreurs techniques
      let message = "Échec de l'upload. Veuillez réessayer.";
      if (err?.message?.includes('aborted') || err?.message?.includes('abort')) {
        message = '⚠️ Upload interrompu (courant sur iOS avec les gros fichiers). Essayez avec un fichier plus petit ou en Wi-Fi.';
      } else if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
        message = 'Erreur réseau. Vérifiez votre connexion internet.';
      } else if (err?.message?.includes('exceeded') || err?.message?.includes('quota')) {
        message = 'Espace de stockage insuffisant.';
      } else if (err?.message?.includes('unauthorized') || err?.message?.includes('403')) {
        message = 'Non autorisé. Reconnectez-vous et réessayez.';
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
      setUploadProgress(0);

    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Uploader un son — NovaSound TITAN LUX</title>
        <meta name="description" content="Uploade ta musique sur NovaSound TITAN LUX et partage-la avec le monde" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent mb-4">
                Uploader ton morceau
              </h1>
              <p className="text-gray-400">Partage ta musique avec le monde entier</p>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-green-400 text-sm">{success}</p>
                  </div>
                )}

                {loading && uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Upload en cours...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-magenta-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    {uploadProgress < 60 && audioFile && audioFile.size > 10 * 1024 * 1024 && (
                      <p className="text-yellow-400 text-xs text-center">
                        ⏳ Fichier volumineux — restez sur cette page, ne verrouillez pas votre écran
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Titre du morceau *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                    placeholder="Ex : Midnight Pulse"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom de l'artiste *</label>
                  <input
                    type="text"
                    name="artist"
                    value={formData.artist}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                    placeholder="Ex : NOVA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none"
                    placeholder="Parle-nous de ton morceau..."
                  />
                </div>

                {/* Sélecteur de genre */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Genre <span className="text-gray-500 text-xs">(optionnel)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, genre: prev.genre === g ? '' : g }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          formData.genre === g
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-gray-200'
                        }`}
                      >{g}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fichier audio * (Max 50 Mo — MP3, WAV, AAC, M4A…)</label>
                  <div className="relative">
                    {/* iOS Fix : input visible avec opacity-0 par-dessus le bouton visuel */}
                    <div className="relative w-full">
                      <div className="flex items-center justify-center gap-2 w-full px-4 py-8 bg-gray-900/50 border-2 border-dashed border-cyan-500/30 rounded-lg transition-all pointer-events-none">
                        <Music className="w-6 h-6 text-cyan-400" />
                        <div className="text-center">
                          <span className="text-gray-300 block">
                            {audioFile ? audioFile.name : 'Appuyer pour choisir un fichier audio'}
                          </span>
                          {!audioFile && (
                            <span className="text-gray-500 text-xs mt-1 block">
                              MP3, WAV, AAC, M4A — Max 50 Mo
                            </span>
                          )}
                          {audioFile && (
                            <span className="text-cyan-400 text-xs mt-1 block">
                              {(audioFile.size / 1024 / 1024).toFixed(1)} Mo — prêt ✓
                              {audioDuration && ` · ${Math.floor(audioDuration/60)}:${String(audioDuration%60).padStart(2,'0')}`}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Input superposé transparent — iOS Safari déclenche directement */}
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.opus,.mp4,.m4b"
                        onChange={handleAudioChange}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Pochette d'album (Max 20 Mo)</label>
                  <div className="relative">
                    <div className="relative w-full">
                      <div className="flex items-center justify-center gap-2 w-full px-4 py-8 bg-gray-900/50 border-2 border-dashed border-cyan-500/30 rounded-lg transition-all pointer-events-none">
                        <Image className="w-6 h-6 text-cyan-400" />
                        <div className="text-center">
                          <span className="text-gray-300 block">
                            {albumCover ? albumCover.name : 'Appuyer pour ajouter une pochette (optionnel)'}
                          </span>
                          {albumCover && (
                            <span className="text-cyan-400 text-xs mt-1 block">
                              {(albumCover.size / 1024 / 1024).toFixed(1)} Mo — prêt ✓
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                        onChange={handleCoverChange}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white py-3 text-lg font-semibold shadow-lg shadow-cyan-500/30"
                >
                  {loading ? 'Upload en cours...' : 'Publier le morceau'}
                  {!loading && <Upload className="w-5 h-5 ml-2" />}
                </Button>
              </form>
            </div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default MusicUploadPage;