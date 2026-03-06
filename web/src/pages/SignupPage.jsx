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

  const [formData, setFormData] = useState({ email:'', username:'', password:'', passwordConfirm:'' });
  const [showPassword,        setShowPassword]        = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown,setCooldown]= useState(0);
  const submitRef   = useRef(false);
  const cooldownRef = useRef(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const startCooldown = (seconds) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => { if (prev <= 1) { clearInterval(cooldownRef.current); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitRef.current || loading || cooldown > 0) return;
    submitRef.current = true;
    setError(''); setSuccess('');
    const usernameVal = formData.username.trim();
    if (usernameVal.includes(' ')) { setError("Pas d'espaces dans le nom d'utilisateur — utilise des tirets."); submitRef.current=false; return; }
    if (usernameVal.length < 3 || usernameVal.length > 30) { setError("Le nom d'utilisateur doit contenir entre 3 et 30 caractères."); submitRef.current=false; return; }
    if (formData.password !== formData.passwordConfirm) { setError('Les mots de passe ne correspondent pas'); submitRef.current=false; return; }
    if (formData.password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères'); submitRef.current=false; return; }
    setLoading(true);
    const result = await signup(formData.email, formData.password, formData.passwordConfirm, formData.username);
    setLoading(false); submitRef.current = false;
    if (result.success) {
      setSuccess(result.message);
      if (result.autoLogin) setTimeout(() => navigate('/profile'), 2000);
      else if (result.emailError) setTimeout(() => navigate('/login'), 5000);
      else setTimeout(() => navigate('/login'), 4000);
    } else {
      setError(result.message);
      if (result.message?.includes('⏳') || result.message?.toLowerCase().includes('limite')) startCooldown(60);
    }
  };

  return (
    <>
      <Helmet>
        <title>{'Créer mon compte'} — NovaSound TITAN LUX</title>
        <meta name="description" content="Crée ton compte NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex overflow-hidden">

        {/* ══ PANNEAU GAUCHE (lg+) ══ */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 relative flex-col items-center justify-center"
          style={{ background:'linear-gradient(135deg,#050510 0%,#0a0a1f 50%,#0e1a2e 100%)' }}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/3 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background:'radial-gradient(circle,#a855f7,transparent)' }} />
            <div className="absolute bottom-1/3 right-1/3 w-72 h-72 rounded-full opacity-15 blur-3xl" style={{ background:'radial-gradient(circle,#06b6d4,transparent)' }} />
          </div>
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize:'28px 28px' }} />
          <div className="absolute top-6 right-6 z-20">
</div>

          <motion.div initial={{ opacity:0, x:-30 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2, duration:0.6 }}
            className="relative z-10 flex flex-col items-center text-center max-w-sm px-8">
            <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
              alt="NovaSound" className="w-20 h-20 rounded-full border-2 border-fuchsia-400 shadow-2xl shadow-fuchsia-500/30 mb-6" />
            <h2 className="text-4xl font-black text-white mb-2">
              Rejoins la<br /><span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">communauté</span>
            </h2>
            <p className="text-gray-400 text-sm mt-3 leading-relaxed">Partage ta musique, découvre des artistes, connecte-toi en live.</p>
            <div className="mt-8 space-y-3 text-left w-full">
              {[['🎵','Upload et partage tes sons'],['🔴','Crée des live rooms'],['❤️','Abonne-toi à tes artistes'],['🏆','Grimpe le classement']].map(([ico,txt]) => (
                <div key={txt} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className="text-lg">{ico}</span><span>{txt}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ══ PANNEAU DROIT : Formulaire ══ */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative overflow-y-auto" style={{ scrollbarWidth:'none' }}>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="w-full max-w-sm">

            {/* Logo mobile */}
            <div className="lg:hidden text-center mb-6">
              <div className="flex items-center justify-center gap-3">
                <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
                  alt="NovaSound" className="w-9 h-9 rounded-full border-2 border-fuchsia-400" />
                <span className="text-lg font-bold bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">NovaSound TITAN LUX</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-1">{'Crée ton compte 🎵'}</h1>
            <p className="text-gray-400 text-sm mb-6">{'Rejoins la révolution musicale dès aujourd'hui'}</p>

            <div className="bg-gray-900/50 backdrop-blur-xl border border-fuchsia-500/20 rounded-2xl p-6 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 text-sm">{error}</p>
                      {cooldown > 0 && <p className="text-orange-400 text-xs mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{'Patienter'} {cooldown}s</p>}
                    </div>
                  </div>
                )}
                {success && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-400 text-sm">{success}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{'Redirection vers la connexion...'}</p>
                    </div>
                  </div>
                )}

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">{'Nom d'utilisateur'}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-400" />
                    <input type="text" id="username" name="username" value={formData.username}
                      onChange={e => setFormData({...formData,username:e.target.value.replace(/ /g,'')})}
                      required autoComplete="username" maxLength={30}
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-800/60 border border-fuchsia-500/20 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/20"
                      placeholder="jean-dupont ou JeanDupont" />
                  </div>
                  <div className="mt-1.5 px-3 py-2 bg-gray-800/50 border border-gray-700/40 rounded-lg">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      <span className="text-amber-400 font-semibold">{'Conseil'} :</span> {'Pour les noms composés, remplace les espaces par des tirets (@ton-pseudo).'}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">{'Email'}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-400" />
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange}
                      required autoComplete="email" inputMode="email"
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-800/60 border border-fuchsia-500/20 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/20"
                      placeholder="your@email.com" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">{'Mot de passe'}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-400" />
                    <input type={showPassword?"text":"password"} id="password" name="password" value={formData.password} onChange={handleChange}
                      required minLength={8} autoComplete="new-password"
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-800/60 border border-fuchsia-500/20 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/20"
                      placeholder="••••••••" />
                    <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-fuchsia-400">
                      {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{'Minimum 8 caractères'}</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">{'Confirmer le mot de passe'}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-400" />
                    <input type={showPasswordConfirm?"text":"password"} id="passwordConfirm" name="passwordConfirm" value={formData.passwordConfirm} onChange={handleChange}
                      required autoComplete="new-password"
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-800/60 border border-fuchsia-500/20 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/20"
                      placeholder="••••••••" />
                    <button type="button" onClick={()=>setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-fuchsia-400">
                      {showPasswordConfirm ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading || !!success || cooldown > 0}
                  className="w-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600 text-white py-2.5 font-semibold rounded-xl shadow-lg shadow-fuchsia-500/20 disabled:opacity-50 mt-1">
                  {loading ? 'Création en cours...' : cooldown > 0 ? `${'Patienter'} ${cooldown}s...` : 'Créer mon compte'}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <p className="text-gray-400 text-sm">{'Déjà un compte ?'}{' '}<Link to="/login" className="text-fuchsia-400 hover:text-fuchsia-300 font-semibold">{'Se connecter'}</Link></p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
