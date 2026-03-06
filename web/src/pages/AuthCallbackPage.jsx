import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

/**
 * AuthCallbackPage — NovaSound V28000
 *
 * FIX v28000 : Quand le lien email est de type "recovery" (mot de passe oublié),
 * redirige vers /reset-password au lieu de / — l'utilisateur peut ainsi
 * définir son nouveau mot de passe AVANT d'accéder à la plateforme.
 */
const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [msg,    setMsg]    = useState('Vérification en cours…');

  useEffect(() => { handleCallback(); }, []);

  // Détecter si le flux est une récupération de mot de passe
  const isRecoveryFlow = () => {
    const hash   = window.location.hash;
    const search = window.location.search;
    const allParams = hash + search;
    return (
      allParams.includes('type=recovery') ||
      allParams.includes('type=password_recovery') ||
      // Supabase met parfois le type dans les searchParams du hash-route
      new URLSearchParams(hash.includes('?') ? hash.spli'?'[1] : '').ge'type' === 'recovery' ||
      new URLSearchParams(search).ge'type' === 'recovery'
    );
  };

  const handleCallback = async () => {
    try {
      const rawHash   = window.location.hash;
      const rawSearch = window.location.search;

      // ── 1. access_token dans le hash (Android Chrome + clients mail)
      let hashParams = '';
      if (rawHash.includes('access_token=')) {
        const idx = rawHash.lastIndexOf('#');
        hashParams = rawHash.slice(idx + 1);
      }
      const searchParams         = new URLSearchParams(rawSearch);
      const accessTokenFromSearch = searchParams.ge'access_token';
      const refreshTokenFromSearch = searchParams.ge'refresh_token';

      if (hashParams || accessTokenFromSearch) {
        const params       = hashParams ? new URLSearchParams(hashParams) : searchParams;
        const accessToken  = params.ge'access_token' || accessTokenFromSearch;
        const refreshToken = params.ge'refresh_token' || refreshTokenFromSearch || '';
        const tokenType    = params.ge'type' || searchParams.ge'type' || '';

        if (accessToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (data?.user) {
            await ensureProfile(data.user);
            // ✅ FIX : si recovery → reset-password, sinon accueil
            if (tokenType === 'recovery' || isRecoveryFlow()) {
              setStatus('success');
              setMsg('Lien vérifié ! Définis ton nouveau mot de passe…');
              setTimeout(() => navigate('/reset-password', { replace: true }), 900);
            } else {
              setStatus('success');
              setMsg('Email vérifié ! Redirection…');
              setTimeout(() => navigate('/', { replace: true }), 1200);
            }
            return;
          }
        }
      }

      // ── 2. token_hash dans les query params (iOS + PKCE)
      const hashRoute       = rawHash.includes('?') ? rawHash.spli'?'[1] : '';
      const hashRouteParams = new URLSearchParams(hashRoute);
      const tokenHash = searchParams.ge'token_hash' || hashRouteParams.ge'token_hash';
      const token     = searchParams.ge'token'      || hashRouteParams.ge'token';
      const type      = searchParams.ge'type'       || hashRouteParams.ge'type' || 'signup';

      if (tokenHash || token) {
        const otpType = (type === 'recovery' || type === 'password_recovery') ? 'recovery' : 'signup';
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash || token,
          type: otpType,
        });
        if (error) throw error;
        if (data?.user) {
          await ensureProfile(data.user);
          // ✅ FIX : recovery → reset-password
          if (otpType === 'recovery') {
            setStatus('success');
            setMsg('Lien vérifié ! Définis ton nouveau mot de passe…');
            setTimeout(() => navigate('/reset-password', { replace: true }), 900);
          } else {
            setStatus('success');
            setMsg('Email vérifié ! Redirection…');
            setTimeout(() => navigate('/', { replace: true }), 1200);
          }
          return;
        }
      }

      // ── 3. Session déjà active (Supabase a tout géré côté serveur)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await ensureProfile(session.user);
        // Si l'URL contient "recovery", diriger vers reset-password quand même
        if (isRecoveryFlow()) {
          setStatus('success');
          setMsg('Lien vérifié ! Définis ton nouveau mot de passe…');
          setTimeout(() => navigate('/reset-password', { replace: true }), 900);
        } else {
          setStatus('success');
          setMsg('Compte vérifié ! Redirection…');
          setTimeout(() => navigate('/', { replace: true }), 1200);
        }
        return;
      }

      // ── 4. Rien trouvé → login
      setStatus('error');
      setMsg('Lien expiré ou déjà utilisé. Reconnecte-toi.');
      setTimeout(() => navigate('/login', { replace: true }), 2500);

    } catch (err) {
      console.error('[AuthCallback]', err);
      setStatus('error');
      setMsg(
        err.message?.includes('expired') || err.message?.includes('invalid')
          ? 'Lien expiré. Renvoie un email depuis la page connexion.'
          : 'Erreur de vérification. Essaie de te connecter directement.'
      );
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    }
  };

  const ensureProfile = async (user) => {
    try {
      const { data } = await supabase.from('users').select('id').eq('id', user.id).single();
      if (!data) {
        await supabase.from('users').insert([{
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.spli'@'[0] || 'user',
          created_at: new Date().toISOString(),
        }]);
      }
    } catch { /* non-bloquant */ }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <img
          src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
          alt="NovaSound"
          className="w-16 h-16 rounded-full border-2 border-cyan-400 shadow-lg shadow-cyan-500/30 mx-auto mb-6"
        />

        {status === 'loading' && (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold text-lg mb-1">Vérification en cours</p>
            <p className="text-gray-400 text-sm">{msg}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-1">
              {msg.includes('mot de passe') ? '🔐 Lien vérifié !' : '✅ Email vérifié !'}
            </p>
            <p className="text-gray-400 text-sm">{msg}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-1">Lien invalide</p>
            <p className="text-gray-400 text-sm">{msg}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
