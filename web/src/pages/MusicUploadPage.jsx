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
    description: ''
  });
  const [audioFile, setAudioFile] = useState(null);
  const [albumCover, setAlbumCover] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 104857600) { // 100MB
        setError('Le fichier audio ne doit pas dépasser 100 Mo');
        return;
      }
      setAudioFile(file);
      setError('');
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

    setLoading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(50);

      // 1) Upload audio → bucket "audio"
      const audioExt = audioFile.name.split('.').pop();
      const audioPath = `${currentUser.id}-${Date.now()}.${audioExt}`;

      const { error: audioUploadError } = await supabase.storage
        .from('audio')
        .upload(audioPath, audioFile, { cacheControl: '3600', upsert: false });
      if (audioUploadError) throw audioUploadError;

      const { data: audioPublic } = supabase.storage
        .from('audio')
        .getPublicUrl(audioPath);

      let albumCoverUrl = null;

      // 2) Upload cover (optional) → bucket "covers"
      if (albumCover) {
        const coverExt = albumCover.name.split('.').pop();
        const coverPath = `${currentUser.id}-${Date.now()}.${coverExt}`;

        const { error: coverUploadError } = await supabase.storage
          .from('covers')
          .upload(coverPath, albumCover, { cacheControl: '3600', upsert: false });
        if (coverUploadError) throw coverUploadError;

        const { data: coverPublic } = supabase.storage
          .from('covers')
          .getPublicUrl(coverPath);
        albumCoverUrl = coverPublic?.publicUrl || null;
      }

      // 3) Insert song row
      const insertPayload = {
        title: formData.title,
        artist: formData.artist,
        uploader_id: currentUser.id,
        audio_url: audioPublic?.publicUrl || null,
        cover_url: albumCoverUrl,
        plays_count: 0,
        likes_count: 0,
        created_at: new Date().toISOString()
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
      setError(err.message || "Échec de l'upload. Veuillez réessayer.");
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

      <div className="min-h-screen bg-gray-950 flex flex-col">
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

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fichier audio * (Max 100 Mo)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioChange}
                      className="hidden"
                      id="audio-upload"
                    />
                    <label
                      htmlFor="audio-upload"
                      className="flex items-center justify-center gap-2 w-full px-4 py-8 bg-gray-900/50 border-2 border-dashed border-cyan-500/30 rounded-lg cursor-pointer hover:border-cyan-400 transition-all"
                    >
                      <Music className="w-6 h-6 text-cyan-400" />
                      <span className="text-gray-300">
                        {audioFile ? audioFile.name : 'Cliquer pour ajouter un fichier audio'}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Pochette d'album (Max 20 Mo)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                      id="cover-upload"
                    />
                    <label
                      htmlFor="cover-upload"
                      className="flex items-center justify-center gap-2 w-full px-4 py-8 bg-gray-900/50 border-2 border-dashed border-cyan-500/30 rounded-lg cursor-pointer hover:border-cyan-400 transition-all"
                    >
                      <Image className="w-6 h-6 text-magenta-400" />
                      <span className="text-gray-300">
                        {albumCover ? albumCover.name : 'Cliquer pour ajouter une pochette (optionnel)'}
                      </span>
                    </label>
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