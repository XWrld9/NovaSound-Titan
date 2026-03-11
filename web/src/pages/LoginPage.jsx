import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const LoginPage = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, resendVerification, sendPasswordReset } = useAuth();

  const [email,             setEmail]           = useState('');
  const [password,          setPassword]        = useState('');
  const [showPassword,      setShowPassword]    = useState(false);
  const [error,             setError]           = useState('');
  const [loading,           setLoading]         = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [successMessage,    setSuccessMessage]  = useState('');
  const [forgotMode,        setForgotMode]      = useState(false);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError("Entrez votre email d'abord."); return; }
    setError(''); setLoading(true);
    const result = await sendPasswordReset(email);
    setLoading(false);
    if (result.success) { setSuccessMessage(result.message); setForgotMode(false); }
    else setError(result.message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true); setNeedsVerification(false);
    const result = await login(email, password);
    if (result.success) { setTimeout(() => navigate('/profile'), 500); }
    else { setError(result.message); if (result.needsVerification) setNeedsVerification(true); }
    setLoading(false);
  };

  const handleResendVerification = async () => {
    setLoading(true);
    const result = await resendVerification(email);
    if (result.success) { setError(''); setNeedsVerification(false); setSuccessMessage(result.message); }
    else setError(result.message);
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>{'Se connecter'} — NovaSound TITAN LUX</title>
        <meta name="description" content="Connecte-toi à NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex overflow-hidden">

        {/* ══ PANNEAU GAUCHE (lg+) ══ */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col items-center justify-center"
          style={{ background:'linear-gradient(135deg,#050510 0%,#0a0a1f 50%,#0e1a2e 100%)' }}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background:'radial-gradient(circle,#06b6d4,transparent)' }} />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background:'radial-gradient(circle,#a855f7,transparent)' }} />
          </div>
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize:'28px 28px' }} />
          <div className="absolute top-6 right-6 z-20">
</div>

          <motion.div initial={{ opacity:0, x:-30 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2, duration:0.6 }}
            className="relative z-10 flex flex-col items-center text-center max-w-lg px-10">
            <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
              alt="NovaSound" className="w-24 h-24 rounded-full border-2 border-cyan-400 shadow-2xl shadow-cyan-500/40 mb-8" />
            <h2 className="text-5xl font-black text-white mb-2 leading-tight">
              Nova<span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">Sound</span>
            </h2>
            <p className="text-base font-semibold text-gray-500 tracking-widest uppercase mb-6">TITAN LUX</p>
            <p className="text-gray-400 text-base leading-relaxed mb-10">La plateforme qui met la technologie au service de la créativité musicale.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['🎵 Upload & Stream','🌍 Multi-langues','📡 Live Rooms','📱 PWA'].map(f => (
                <span key={f} className="px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-full text-xs text-gray-300">{f}</span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ══ PANNEAU DROIT : Formulaire ══ */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="w-full max-w-sm">

            {/* 🔔 Bannière de mise à jour — notification style app */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', damping: 20 }}
              className="mb-5 relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/80 to-orange-950/60 backdrop-blur-xl shadow-2xl shadow-amber-500/10 p-4"
            >
              {/* Glow de fond */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top left, #f59e0b 0%, transparent 65%)' }} />
              <div className="relative flex items-start gap-3">
                {/* Icône notification pulsante */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className="relative w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                    <span className="text-lg">🔔</span>
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-gray-950 animate-pulse" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Mise à jour importante</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">TITAN LUX</span>
                  </div>
                  <p className="text-sm text-amber-100 leading-snug font-medium">
                    NovaSound a subi une <span className="text-amber-300 font-bold">gigantesque mise à jour</span> ! 🚀
                  </p>
                  <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                    Si tu étais déjà inscrit(e), nous te demandons gentiment de <span className="text-amber-300 font-semibold">créer un nouveau compte</span>. Nous nous excusons sincèrement pour la gêne occasionnée. 🙏
                  </p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <a href="/#/signup" className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-all">
                      ✨ Créer un compte
                    </a>
                    <span className="text-[10px] text-amber-500/60">Merci de votre compréhension ❤️</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Logo mobile */}
            <div className="lg:hidden text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
                  alt="NovaSound" className="w-10 h-10 rounded-full border-2 border-cyan-400" />
                <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">NovaSound TITAN LUX</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-1">{'Bon retour 👋'}</h1>
            <p className="text-gray-400 text-sm mb-7">{'Connecte-toi pour continuer ton aventure musicale'}</p>

            <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 shadow-2xl">
              {forgotMode ? (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="text-center">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center mx-auto mb-3">
                      <KeyRound className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h2 className="text-white font-bold">{'Mot de passe oublié'}</h2>
                    <p className="text-gray-400 text-xs mt-1">{'Entrez votre email pour recevoir un lien de réinitialisation.'}</p>
                  </div>
                  {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"/><p className="text-red-400 text-sm">{error}</p></div>}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">{'Email'}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" inputMode="email"
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-800/60 border border-cyan-500/20 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                        placeholder="your@email.com" />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white py-2.5 font-semibold rounded-xl shadow-lg shadow-cyan-500/20">
                    {loading ? 'Envoi...' : '📧 Envoyer le lien de réinitialisation'}
                  </Button>
                  <button type="button" onClick={()=>{setForgotMode(false);setError('');}} className="w-full text-xs text-gray-400 hover:text-cyan-400 transition-colors">{'← Retour à la connexion'}</button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
                  {successMessage && (
                    <div className={`rounded-xl p-3 flex gap-2 ${successMessage.includes('nouveau') ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-cyan-500/10 border border-cyan-500/30'}`}>
                      <span className="flex-shrink-0">{successMessage.includes('nouveau') ? '🔐' : '✅'}</span>
                      <p className={`text-sm ${successMessage.includes('nouveau') ? 'text-emerald-400' : 'text-cyan-400'}`}>{successMessage}</p>
                    </div>
                  )}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-400 text-sm">{error}</p>
                        {needsVerification && email && (
                          <button type="button" onClick={handleResendVerification} disabled={loading}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/25 rounded-lg text-cyan-400 text-xs hover:bg-cyan-500/20">
                            {'📧 Renvoyer l\'email de confirmation'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">{'Email'}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                      <input type="email" id="email" name="email" value={email} onChange={e=>setEmail(e.target.value)}
                        required autoComplete="email" inputMode="email"
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-800/60 border border-cyan-500/20 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                        placeholder="your@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">{'Mot de passe'}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                      <input type={showPassword?"text":"password"} id="password" name="password" value={password} onChange={e=>setPassword(e.target.value)}
                        required autoComplete="current-password"
                        className="w-full pl-9 pr-10 py-2.5 bg-gray-800/60 border border-cyan-500/20 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                        placeholder="••••••••" />
                      <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400">
                        {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                    <div className="flex justify-end mt-1">
                      <button type="button" onClick={()=>{setForgotMode(true);setError('');setSuccessMessage('');}} className="text-xs text-cyan-500 hover:text-cyan-400">{'Mot de passe oublié ?'}</button>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 text-white py-2.5 font-semibold shadow-lg shadow-cyan-500/20 rounded-xl">
                    {loading ? 'Connexion...' : 'Se connecter'}
                  </Button>
                </form>
              )}
              {!forgotMode && (
                <div className="mt-5 text-center space-y-2">
                  <p className="text-gray-400 text-sm">{'Pas encore de compte ?'}{' '}<Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold">{'S\'inscrire'}</Link></p>
                  <p className="text-gray-600 text-xs">{'Compte créé récemment ? Pensez à vérifier vos spams.'}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
