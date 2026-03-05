import LangToggle from '@/components/LangToggle';
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Mail, Lock, User, AlertCircle, CheckCircle, Eye, EyeOff, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const SignupPage = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    passwordConfirm: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const submitRef = useRef(false); // anti double-submit
  const cooldownRef = useRef(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const startCooldown = (seconds) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Anti double-submit (iOS Safari peut déclencher 2x)
    if (submitRef.current || loading || cooldown > 0) return;
    submitRef.current = true;

    setError('');
    setSuccess('');

    // Validation du nom d'utilisateur
    const usernameVal = formData.username.trim();
    if (usernameVal.includes(' ')) {
      setError("Pas d'espaces dans le nom d'utilisateur — utilise des tirets (------ ou --------) pour séparer les mots afin de rester taggable @dans-le-chat-global.");
      submitRef.current = false;
      return;
    }
    if (usernameVal.length < 3 || usernameVal.length > 30) {
      setError("Le nom d'utilisateur doit contenir entre 3 et 30 caractères.");
      submitRef.current = false;
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('Les mots de passe ne correspondent pas');
      submitRef.current = false;
      return;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      submitRef.current = false;
      return;
    }

    setLoading(true);

    const result = await signup(
      formData.email,
      formData.password,
      formData.passwordConfirm,
      formData.username
    );

    setLoading(false);
    submitRef.current = false;

    if (result.success) {
      setSuccess(result.message);
      if (result.autoLogin) {
        // Confirmation email désactivée → connexion directe → profil
        setTimeout(() => navigate('/profile'), 2000);
      } else if (result.emailError) {
        // Compte créé mais email KO → login avec bouton renvoi
        setTimeout(() => navigate('/login'), 5000);
      } else {
        // Cas normal → login pour confirmer
        setTimeout(() => navigate('/login'), 4000);
      }
    } else {
      setError(result.message);
      // Si rate limit → démarrer un cooldown de 60s
      if (result.message?.includes('⏳') || result.message?.toLowerCase().includes('limite')) {
        startCooldown(60);
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Inscription — NovaSound TITAN LUX</title>
        <meta name="description" content="Crée ton compte NovaSound TITAN LUX et commence à partager ta musique" />
      </Helmet>

      <div className="min-h-screen relative bg-gray-950 flex items-center justify-center px-4 py-12 overflow-x-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
                alt="NovaSound TITAN LUX"
                className="w-12 h-12 rounded-full border-2 border-cyan-400 shadow-lg shadow-cyan-500/30"
              />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
                NovaSound <span className="text-lg font-semibold">TITAN LUX</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Crée ton compte 🎵</h1>
            <p className="text-gray-400">Rejoins la révolution musicale dès aujourd'hui</p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 text-sm">{error}</p>
                    {cooldown > 0 && (
                      <p className="text-orange-400 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Réessai disponible dans {cooldown}s
                      </p>
                    )}
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-green-400 text-sm">{success}</p>
                    <p className="text-gray-400 text-xs mt-1">Redirection vers la connexion...</p>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">Nom d'utilisateur</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={(e) => {
                      const val = e.target.value.replace(/ /g, '');
                      setFormData({ ...formData, username: val });
                    }}
                    required
                    autoComplete="username"
                    maxLength={30}
                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                    placeholder="jean--dupont ou JeanDupont"
                  />
                </div>
                <div className="mt-2 px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg">
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    <span className="text-amber-400 font-semibold">Conseil :</span> Pour les noms composés, remplace les espaces par des tirets afin d&apos;être taggable dans le chat (<span className="text-cyan-400 font-mono">@ton-pseudo</span>).
                  </p>
                  <div className="flex items-center gap-4 mt-1.5">
                    <div className="flex flex-col items-center gap-0.5">
                      <code className="text-cyan-400 text-[11px] font-mono tracking-widest bg-gray-900/60 px-2 py-0.5 rounded">&#8212;&#8212;&#8212;</code>
                      <span className="text-[9px] text-gray-600">tiret court (6)</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <code className="text-fuchsia-400 text-[11px] font-mono tracking-widest bg-gray-900/60 px-2 py-0.5 rounded">&#8212;&#8212;&#8212;&#8212;</code>
                      <span className="text-[9px] text-gray-600">tiret long (8)</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <code className="text-green-400 text-[11px] font-mono bg-gray-900/60 px-2 py-0.5 rounded">Jean-Dupont</code>
                      <span className="text-[9px] text-gray-600">recommandé ✓</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Adresse e-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    inputMode="email"
                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 caractères</p>
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-300 mb-2">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                  <input
                    type={showPasswordConfirm ? "text" : "password"}
                    id="passwordConfirm"
                    name="passwordConfirm"
                    value={formData.passwordConfirm}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors"
                  >
                    {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !!success || cooldown > 0}
                className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white py-3 text-lg font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-50"
              >
                {loading ? "Création en cours..." : cooldown > 0 ? `Patienter ${cooldown}s...` : "Créer mon compte"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default SignupPage;