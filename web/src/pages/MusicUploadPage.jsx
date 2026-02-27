/**
 * MusicUploadPage — NovaSound TITAN LUX v60
 *
 * UPLOAD REWRITE COMPLET — Fix iOS/Android/PC
 *
 * Problèmes résolus :
 * 1. fetchWithRetry dans supabaseClient imposait un timeout 30s global → killed les gros fichiers
 * 2. SDK Supabase Storage utilisait ce fetch → upload tué à ~20% sur iOS (bug confirmé)
 * 3. Fallback XHR n'était tenté qu'APRÈS 3 échecs SDK (90s de blocage)
 * 4. Barre de progression mensongère (10% → 20% → stagne → 60% d'un coup)
 *
 * Architecture v60 :
 * - XHR FIRST pour l'audio (jamais le SDK fetch pour les gros fichiers)
 * - onprogress XHR → vraie barre de progression avec Mo uploadés / Mo total
 * - Timeout adaptatif : max(120s, taille_MB × 8s) — jamais de timeout trop court
 * - SDK uniquement pour la pochette (petite, pas de risque)
 * - Avertissement écran veille iOS affiché pendant l'upload
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Upload, Music, Image, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, supabaseUrl as _supabaseUrl, supabaseAnonKey as _supabaseAnonKey } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// ── Détecte iOS ───────────────────────────────────────────────────
const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// ── Devine le Content-Type à partir de l'extension ───────────────
const guessContentType = (file) => {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  const map = {
    mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
    m4a: 'audio/mp4',  ogg: 'audio/ogg', flac: 'audio/flac',
    opus: 'audio/opus', mp4: 'audio/mp4',  m4b: 'audio/mp4',
    jpg: 'image/jpeg',  jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
};

// ── Timeout adaptatif : jamais tuer un gros fichier trop tôt ──────
// Min 120s, puis 8s par MB supplémentaire (très conservateur)
const adaptiveTimeout = (file) => Math.max(120000, (file.size / 1024 / 1024) * 8000);

// ════════════════════════════════════════════════════════════════════
// uploadViaXHR — Fonction principale d'upload, XHR avec progression
// ════════════════════════════════════════════════════════════════════
const uploadViaXHR = async ({ bucket, path, file, token, onProgress }) => {
  const baseUrl = _supabaseUrl || '';
  const anonKey = _supabaseAnonKey || '';
  if (!token || !baseUrl) throw new Error('Session invalide — reconnectez-vous');

  const contentType = guessContentType(file);
  const timeoutMs   = adaptiveTimeout(file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/storage/v1/object/${bucket}/${path}`, true);
    xhr.timeout = timeoutMs;

    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('Cache-Control', '3600');
    // Ajout du owner pour les politiques RLS
    xhr.setRequestHeader('x-supabase-auth', token);

    // Vraie progression en temps réel
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded, e.total);
      }
    };

    xhr.onload = () => {
      // 200 OK ou 409 Conflict (fichier déjà existant) = succès
      if (xhr.status < 300 || xhr.status === 409) {
        resolve();
      } else {
        let msg = `Erreur serveur (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error) msg = body.error;
          else if (body?.message) msg = body.message;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Erreur réseau — vérifiez votre connexion'));

    xhr.ontimeout = () => {
      const mins = Math.round(timeoutMs / 60000);
      reject(new Error(
        `Upload trop long (>${mins} min). Essayez en Wi-Fi ou avec un fichier plus petit.`
      ));
    };

    xhr.onabort = () => reject(new Error('Upload annulé'));

    xhr.send(file);
  });
};

// ════════════════════════════════════════════════════════════════════
// COMPOSANT
// ════════════════════════════════════════════════════════════════════
const MusicUploadPage = () => {
  const navigate    = useNavigate();
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState({ title: '', artist: '', description: '', genre: '' });
  const [audioFile,      setAudioFile]      = useState(null);
  const [audioDuration,  setAudioDuration]  = useState(null);
  const [albumCover,     setAlbumCover]     = useState(null);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [loading,        setLoading]        = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);   // 0–100 affiché
  const [uploadBytes,    setUploadBytes]    = useState({ loaded: 0, total: 0 });
  const [uploadPhase,    setUploadPhase]    = useState('');  // 'audio' | 'cover' | 'saving'

  const GENRES = [
    'Afrobeats', 'Hip-Hop', 'R&B', 'Pop', 'Électronique', 'Trap',
    'Gospel', 'Jazz', 'Reggae', 'Dancehall', 'Amapiano', 'Coupé-Décalé',
    'Rock', 'Classique', 'Folk', 'Country', 'Latin', 'Drill', 'Outro',
  ];

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 52428800) { setError('Le fichier audio ne doit pas dépasser 50 Mo'); return; }
    setAudioFile(file);
    setError('');
    // Auto-détection durée
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.onloadedmetadata = () => {
      if (isFinite(audio.duration)) setAudioDuration(Math.round(audio.duration));
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => URL.revokeObjectURL(url);
    audio.src = url;
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20971520) { setError('La pochette ne doit pas dépasser 20 Mo'); return; }
    setAlbumCover(file);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!audioFile) { setError('Veuillez sélectionner un fichier audio'); return; }
    if (!formData.title.trim() || !formData.artist.trim()) {
      setError('Titre et nom d\'artiste sont obligatoires'); return;
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadBytes({ loaded: 0, total: audioFile.size });

    try {
      // ── Récupérer le token de session avec retry ───────────────────
      let sessionData = null;
      let token = null;
      
      // Premier essai
      try {
        sessionData = await supabase.auth.getSession();
        token = sessionData?.session?.access_token;
      } catch (e) {
        console.warn('[Upload] getSession échec, essai refresh:', e);
      }
      
      // Si pas de token, essayer de rafraîchir
      if (!token) {
        try {
          const { data: refreshData } = await supabase.auth.refreshSession();
          token = refreshData?.session?.access_token;
        } catch (e) {
          console.warn('[Upload] refreshSession échec:', e);
        }
      }
      
      // Dernier essai : récupérer l'utilisateur courant
      if (!token && currentUser) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          // Pas de token direct ici, mais on continue avec l'auth implicite
        } catch (e) {
          console.warn('[Upload] getUser échec:', e);
        }
      }
      
      if (!token && !currentUser) {
        throw new Error('Session expirée — reconnectez-vous');
      }

      // ── Phase 1 : Upload audio via XHR (jamais via SDK fetch) ─
      setUploadPhase('audio');
      const audioExt  = audioFile.name.split('.').pop().toLowerCase() || 'mp3';
      const audioPath = `${currentUser.id}-${Date.now()}.${audioExt}`;

      await uploadViaXHR({
        bucket: 'audio',
        path: audioPath,
        file: audioFile,
        token,
        onProgress: (loaded, total) => {
          setUploadBytes({ loaded, total });
          // Progression audio = 0% → 75% de la barre totale
          const pct = Math.round((loaded / total) * 75);
          setUploadProgress(pct);
        },
      });

      setUploadProgress(75);

      const { data: audioPublic } = supabase.storage
        .from('audio')
        .getPublicUrl(audioPath);

      // ── Phase 2 : Upload pochette (petite → SDK suffit) ───────
      let albumCoverUrl = null;
      if (albumCover) {
        setUploadPhase('cover');
        const coverExt  = albumCover.name.split('.').pop().toLowerCase() || 'jpg';
        const coverPath = `${currentUser.id}-${Date.now()}.${coverExt}`;

        // Pochette petite → on peut utiliser XHR aussi pour cohérence
        await uploadViaXHR({
          bucket: 'covers',
          path: coverPath,
          file: albumCover,
          token,
          onProgress: (loaded, total) => {
            // Progression cover = 75% → 90%
            const pct = 75 + Math.round((loaded / total) * 15);
            setUploadProgress(pct);
          },
        });

        const { data: coverPublic } = supabase.storage
          .from('covers')
          .getPublicUrl(coverPath);
        albumCoverUrl = coverPublic?.publicUrl || null;
      }

      // ── Phase 3 : Insert en base ───────────────────────────────
      setUploadPhase('saving');
      setUploadProgress(90);

      const { error: insertError } = await supabase.from('songs').insert({
        title:       formData.title.trim(),
        artist:      formData.artist.trim(),
        uploader_id: currentUser.id,
        audio_url:   audioPublic?.publicUrl || null,
        cover_url:   albumCoverUrl,
        plays_count: 0,
        likes_count: 0,
        created_at:  new Date().toISOString(),
        genre:       formData.genre || null,
        duration_s:  audioDuration || null,
      });
      if (insertError) throw insertError;

      setUploadProgress(100);
      setSuccess('🎉 Morceau publié avec succès ! Redirection...');
      setTimeout(() => navigate('/'), 2000);

    } catch (err) {
      console.error('[Upload]', err);
      let message = "Échec de l'upload. Veuillez réessayer.";
      const msg = err?.message || '';
      if (msg.includes('annulé') || msg.includes('abort'))         message = '❌ Upload annulé.';
      else if (msg.includes('réseau') || msg.includes('network'))  message = '🔌 Erreur réseau. Vérifiez votre connexion.';
      else if (msg.includes('Session') || msg.includes('401'))     message = '🔑 Session expirée — reconnectez-vous puis réessayez.';
      else if (msg.includes('quota') || msg.includes('exceeded'))  message = '💾 Espace de stockage insuffisant.';
      else if (msg.includes('403') || msg.includes('autorisé'))    message = '🔒 Non autorisé. Reconnectez-vous et réessayez.';
      else if (msg.includes('min)') || msg.includes('long'))       message = `⏱️ ${msg}`;
      else if (msg.length > 0)                                     message = msg;
      setError(message);
      setUploadProgress(0);
      setUploadBytes({ loaded: 0, total: 0 });
    } finally {
      setLoading(false);
      setUploadPhase('');
    }
  };

  // ── Formatage taille fichier ─────────────────────────────────────
  const fmtMB = (bytes) => (bytes / 1024 / 1024).toFixed(1);

  const phaseLabel = {
    audio:  '📤 Upload audio en cours…',
    cover:  '🖼️ Upload pochette…',
    saving: '💾 Enregistrement…',
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

            {/* Avertissement iOS PWA */}
            {isIOS() && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3"
              >
                <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs leading-relaxed">
                  <strong>iOS :</strong> garde l'app au premier plan pendant l'upload. Ne verrouille pas l'écran et ne change pas d'application, sinon le transfert sera interrompu par le système.
                </p>
              </motion.div>
            )}

            <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Erreur */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-sm">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Succès */}
                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-start gap-3"
                    >
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-green-400 text-sm">{success}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Barre de progression — vraie, en temps réel */}
                <AnimatePresence>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="space-y-2.5 bg-gray-800/60 border border-white/8 rounded-xl p-4"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300 font-medium">
                          {phaseLabel[uploadPhase] || '⏳ Préparation…'}
                        </span>
                        <span className="text-sm text-cyan-400 font-bold tabular-nums">
                          {uploadProgress}%
                        </span>
                      </div>

                      {/* Barre visuelle */}
                      <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500"
                          style={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                      </div>

                      {/* Mo uploadés / total */}
                      {uploadPhase === 'audio' && uploadBytes.total > 0 && (
                        <div className="flex justify-between text-xs text-gray-500 tabular-nums">
                          <span>{fmtMB(uploadBytes.loaded)} Mo / {fmtMB(uploadBytes.total)} Mo</span>
                          {uploadBytes.loaded > 0 && uploadBytes.total > 0 && (
                            <span className="text-gray-600">
                              ~{Math.round((uploadBytes.total - uploadBytes.loaded) / 1024 / 1024 * (uploadBytes.total / Math.max(uploadBytes.loaded, 1)))} s restants
                            </span>
                          )}
                        </div>
                      )}

                      {/* Avertissement écran veille pendant gros upload */}
                      {uploadPhase === 'audio' && uploadProgress < 70 && audioFile?.size > 8 * 1024 * 1024 && (
                        <p className="text-amber-400/80 text-xs text-center pt-1">
                          ⚠️ Ne verrouille pas ton écran — reste sur cette page
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Titre */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Titre du morceau *</label>
                  <input
                    type="text" name="title" value={formData.title}
                    onChange={handleChange} required disabled={loading}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all disabled:opacity-50"
                    placeholder="Ex : Midnight Pulse"
                  />
                </div>

                {/* Artiste */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom de l'artiste *</label>
                  <input
                    type="text" name="artist" value={formData.artist}
                    onChange={handleChange} required disabled={loading}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all disabled:opacity-50"
                    placeholder="Ex : NOVA"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    name="description" value={formData.description}
                    onChange={handleChange} rows={3} disabled={loading}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none disabled:opacity-50"
                    placeholder="Parle-nous de ton morceau..."
                  />
                </div>

                {/* Genre */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Genre <span className="text-gray-500 text-xs">(optionnel)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(g => (
                      <button key={g} type="button" disabled={loading}
                        onClick={() => setFormData(prev => ({ ...prev, genre: prev.genre === g ? '' : g }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 ${
                          formData.genre === g
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'border-gray-700 text-gray-400 hover:border-cyan-500/50 hover:text-gray-200'
                        }`}
                      >{g}</button>
                    ))}
                  </div>
                </div>

                {/* Fichier audio */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fichier audio * <span className="text-gray-500 text-xs">(Max 50 Mo — MP3, WAV, AAC, M4A…)</span>
                  </label>
                  <div className="relative w-full">
                    <div className={`flex items-center justify-center gap-3 w-full px-4 py-8 bg-gray-900/50 border-2 border-dashed rounded-lg transition-all pointer-events-none ${audioFile ? 'border-cyan-400/60' : 'border-cyan-500/30'}`}>
                      <Music className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                      <div className="text-center min-w-0">
                        <span className="text-gray-300 block truncate max-w-[240px]">
                          {audioFile ? audioFile.name : 'Appuyer pour choisir un fichier audio'}
                        </span>
                        {!audioFile && (
                          <span className="text-gray-500 text-xs mt-1 block">MP3, WAV, AAC, M4A — Max 50 Mo</span>
                        )}
                        {audioFile && (
                          <span className="text-cyan-400 text-xs mt-1 block">
                            {fmtMB(audioFile.size)} Mo ✓
                            {audioDuration && ` · ${Math.floor(audioDuration/60)}:${String(audioDuration%60).padStart(2,'0')}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.opus,.mp4,.m4b"
                      onChange={handleAudioChange}
                      disabled={loading}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                      // Ajout pour Android/iOS explorateur de fichiers natif
                      {...((typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())) && {
                        capture: undefined, // Désactiver la capture pour forcer l'explorateur
                        multiple: false
                      })}
                    />
                  </div>
                </div>

                {/* Pochette */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Pochette d'album <span className="text-gray-500 text-xs">(Max 20 Mo)</span>
                  </label>
                  <div className="relative w-full">
                    <div className={`flex items-center justify-center gap-3 w-full px-4 py-8 bg-gray-900/50 border-2 border-dashed rounded-lg transition-all pointer-events-none ${albumCover ? 'border-cyan-400/60' : 'border-cyan-500/30'}`}>
                      <Image className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                      <div className="text-center min-w-0">
                        <span className="text-gray-300 block truncate max-w-[240px]">
                          {albumCover ? albumCover.name : 'Appuyer pour ajouter une pochette (optionnel)'}
                        </span>
                        {albumCover && (
                          <span className="text-cyan-400 text-xs mt-1 block">{fmtMB(albumCover.size)} Mo ✓</span>
                        )}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                      onChange={handleCoverChange}
                      disabled={loading}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                    />
                  </div>
                </div>

                {/* Bouton submit */}
                <Button
                  type="submit"
                  disabled={loading || !audioFile}
                  className="w-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white py-3 text-lg font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Upload en cours…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Upload className="w-5 h-5" />
                      Publier le morceau
                    </span>
                  )}
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
