/**
 * ResetPasswordPage — NovaSound TITAN LUX v9000
 * Page de réinitialisation de mot de passe (après clic sur le lien email)
 * Supabase redirige vers /#/reset-password avec le token dans l'URL hash
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [showConf,     setShowConf]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Validation de la force du mot de passe
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, text: '', color: '' };
    
    let score = 0;
    const checks = {
      length: pwd.length >= 8,
      lowercase: /[a-z]/.test(pwd),
      uppercase: /[A-Z]/.test(pwd),
      numbers: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    
    Object.values(checks).forEach(passed => {
      if (passed) score++;
    });
    
    const levels = [
      { score: 0, text: 'Très faible', color: 'text-red-400' },
      { score: 1, text: 'Faible', color: 'text-red-400' },
      { score: 2, text: 'Moyen', color: 'text-yellow-400' },
      { score: 3, text: 'Bon', color: 'text-cyan-400' },
      { score: 4, text: 'Fort', color: 'text-emerald-400' },
      { score: 5, text: 'Très fort', color: 'text-emerald-400' }
    ];
    
    return levels[Math.min(score, 4)];
  };

  const passwordStrength = getPasswordStrength(password);

  // Supabase envoie l'event PASSWORD_RECOVERY quand le token est valide
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
      if (event === 'SIGNED_IN' && session) {
        setSessionReady(true);
      }
    });
    // Aussi vérifier si une session active existe déjà
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation améliorée
    if (password.length < 8) { 
      setError('Le mot de passe doit faire au moins 8 caractères.'); 
      return; 
    }
    
    if (passwordStrength.score < 2) { 
      setError('Le mot de passe est trop faible. Ajoutez des majuscules, chiffres ou caractères spéciaux.'); 
      return; 
    }
    
    if (password !== confirm) { 
      setError('Les mots de passe ne correspondent pas.'); 
      return; 
    }
    
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      // Déconnecter proprement pour que l'utilisateur se reconnecte
      // avec son NOUVEAU mot de passe → confirme que tout fonctionne
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login', {
          replace: true,
          state: { message: '✅ Mot de passe modifié ! Connecte-toi avec ton nouveau mot de passe.' }
        });
      }, 2800);
    } else {
      setError(result.message);
    }
  };

  return (
    <>
      <Helmet>
        <title>Réinitialiser le mot de passe — NovaSound TITAN LUX</title>
      </Helmet>
      <div className="min-h-screen bg-gray-950 flex overflow-hidden">
        {/* Panneau gauche décoratif (desktop) */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative items-center justify-center"
          style={{ background:'linear-gradient(135deg,#050510,#0a0a1f,#0e1a2e)' }}>
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize:'28px 28px' }} />
          <div className="absolute top-1/3 left-1/3 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background:'radial-gradient(circle,#06b6d4,transparent)' }} />
          <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2 }}
            className="relative z-10 text-center max-w-sm px-8">
            <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
              alt="NovaSound" className="w-20 h-20 rounded-full border-2 border-cyan-400 shadow-2xl shadow-cyan-500/30 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-white mb-2">Nova<span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">Sound</span></h2>
            <p className="text-gray-500 tracking-widest uppercase text-sm mb-4">TITAN LUX</p>
            <p className="text-gray-400 text-sm leading-relaxed">Réinitialise ton mot de passe en toute sécurité.</p>
          </motion.div>
        </div>
        {/* Formulaire */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
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
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-7 h-7 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Nouveau mot de passe</h1>
            <p className="text-gray-400 text-sm">Choisissez un nouveau mot de passe sécurisé</p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-2xl">
            {success ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4 py-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg">🎉 Mot de passe enregistré !</p>
                  <p className="text-gray-400 text-sm mt-1">Ton compte est maintenant sécurisé</p>
                  <p className="text-cyan-400 text-xs mt-2">Déconnexion en cours → utilise ton nouveau mot de passe…</p>
                </div>
                
                {/* Conseils de sécurité */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-left">
                  <p className="text-cyan-400 text-xs font-semibold mb-2">💡 Conseils de sécurité :</p>
                  <ul className="text-gray-300 text-xs space-y-1">
                    <li>• Utilise un gestionnaire de mots de passe</li>
                    <li>• Ne partage jamais ton mot de passe</li>
                    <li>• Change-le régulièrement</li>
                  </ul>
                </div>
              </motion.div>
            ) : !sessionReady ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-400 text-sm">Vérification du lien en cours…</p>
                <p className="text-gray-600 text-xs mt-2">
                  Si cette page ne charge pas, ton lien est peut-être expiré.{' '}
                  <button onClick={() => navigate('/login')} className="text-cyan-400 hover:underline">
                    Retour à la connexion
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required minLength={8}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                      placeholder="8+ caractères, majuscules, chiffres, symboles"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors">
                      {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {/* Indicateur de force du mot de passe */}
                  {password && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${passwordStrength.color}`}>
                          Force: {passwordStrength.text}
                        </span>
                        <span className="text-xs text-gray-500">
                          {password.length}/8+ caractères
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            passwordStrength.score <= 1 ? 'bg-red-500' :
                            passwordStrength.score === 2 ? 'bg-yellow-500' :
                            passwordStrength.score === 3 ? 'bg-cyan-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                        />
                      </div>
                      
                      {/* Exigences */}
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div className={`flex items-center gap-1 ${password.length >= 8 ? 'text-emerald-400' : 'text-gray-600'}`}>
                          <span>{password.length >= 8 ? '✓' : '○'}</span> 8+ caractères
                        </div>
                        <div className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-emerald-400' : 'text-gray-600'}`}>
                          <span>{/[a-z]/.test(password) ? '✓' : '○'}</span> minuscule
                        </div>
                        <div className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-emerald-400' : 'text-gray-600'}`}>
                          <span>{/[A-Z]/.test(password) ? '✓' : '○'}</span> majuscule
                        </div>
                        <div className={`flex items-center gap-1 ${/\d/.test(password) ? 'text-emerald-400' : 'text-gray-600'}`}>
                          <span>{/\d/.test(password) ? '✓' : '○'}</span> chiffre
                        </div>
                        <div className={`flex items-center gap-1 ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-emerald-400' : 'text-gray-600'}`}>
                          <span>{/[!@#$%^&*(),.?":{}|<>]/.test(password) ? '✓' : '○'}</span> spécial
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirmer le mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                    <input
                      type={showConf ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required minLength={8}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                      placeholder="Confirmez le nouveau mot de passe"
                    />
                    <button type="button" onClick={() => setShowConf(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors">
                      {showConf ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {password && confirm && password !== confirm && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Les mots de passe ne correspondent pas
                  </p>
                )}
                {password && confirm && password === confirm && (
                  <p className="text-emerald-400 text-xs flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Les mots de passe correspondent
                  </p>
                )}

                <Button type="submit" disabled={loading || (!!password && !!confirm && (password !== confirm || passwordStrength.score < 2))}
                  className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white py-3 text-base font-semibold shadow-lg shadow-cyan-500/30 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Mise à jour…' : '🔒 Créer mon nouveau mot de passe'}
                </Button>

                <button type="button" onClick={() => navigate('/login')}
                  className="w-full text-sm text-gray-400 hover:text-cyan-400 transition-colors mt-1">
                  ← Retour à la connexion
                </button>
              </form>
            )}
          </div>
        </motion.div>
        </div>{/* fin panneau droit */}
      </div>
    </>
  );
};

export default ResetPasswordPage;
