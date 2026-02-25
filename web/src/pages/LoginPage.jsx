import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setNeedsVerification(false);

    const result = await login(email, password);
    
    if (result.success) {
      setTimeout(() => {
        navigate('/profile');
      }, 500);
    } else {
      setError(result.message);
      if (result.needsVerification) {
        setNeedsVerification(true);
      }
    }
    
    setLoading(false);
  };

  const handleResendVerification = async () => {
    setLoading(true);
    const result = await resendVerification(email);
    if (result.success) {
      setError('');
      setNeedsVerification(false);
      // Réutiliser error pour afficher le succès (message positif)
      setSuccessMessage(result.message);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Connexion — NovaSound TITAN LUX</title>
        <meta name="description" content="Connecte-toi à NovaSound TITAN LUX pour accéder à ta bibliothèque musicale" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12 overflow-x-hidden">
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
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent">
                NovaSound <span className="text-lg font-semibold">TITAN LUX</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Bon retour 👋</h1>
            <p className="text-gray-400">Connecte-toi pour continuer ton aventure musicale</p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
              {successMessage && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
                  <p className="text-cyan-400 text-sm">{successMessage}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-400 text-sm">{error}</p>
                    {needsVerification && email && (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm hover:bg-cyan-500/20 transition-all"
                        disabled={loading}
                      >
                        📧 Renvoyer l'email de confirmation
                      </button>
                    )}
                    {needsVerification && !email && (
                      <p className="text-orange-400 text-xs mt-2">
                        Entrez votre email ci-dessous puis cliquez sur "Renvoyer l'email de confirmation".
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white py-3 text-lg font-semibold shadow-lg shadow-cyan-500/30"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Pas encore de compte ?{' '}
                <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                  S'inscrire
                </Link>
              </p>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-gray-500 text-xs">
                  Compte créé récemment ? Pensez à vérifier vos spams pour l'email de confirmation.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;