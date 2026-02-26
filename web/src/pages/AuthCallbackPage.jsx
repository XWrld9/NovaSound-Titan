import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

/*
 * AuthCallbackPage — /auth/callback
 *
 * iOS Safari ouvre les liens Supabase sous deux formes :
 *   A) https://site.com/?token=xxx&type=signup#/  (token AVANT le #)
 *   B) https://site.com/#/auth/callback?token=xxx (token APRÈS le #, géré par HashRouter)
 *
 * Ce composant gère les deux cas + le cas où Supabase a déjà traité le token
 * côté serveur et redirigé avec access_token dans le hash.
 */
const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [msg, setMsg] = useState('Vérification en cours…');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const rawHash  = window.location.hash;   // ex: "#/auth/callback#access_token=..."
      const rawSearch = window.location.search; // ex: "?token_hash=xxx"

      // ── 1. access_token dans le hash (Android Chrome + certains clients mail)
      //       Deux sous-cas :
      //       a) #access_token=xxx (hash brut, redirigé par index.html)
      //       b) #/auth/callback#access_token=xxx (double hash)
      let hashParams = '';
      if (rawHash.includes('access_token=')) {
        const idx = rawHash.lastIndexOf('#');
        hashParams = rawHash.slice(idx + 1);
      }
      // Aussi vérifier access_token dans les query params (cas C)
      const searchParams = new URLSearchParams(rawSearch);
      const accessTokenFromSearch = searchParams.get('access_token');
      const refreshTokenFromSearch = searchParams.get('refresh_token');

      if (hashParams || accessTokenFromSearch) {
        const params       = hashParams ? new URLSearchParams(hashParams) : searchParams;
        const accessToken  = params.get('access_token') || accessTokenFromSearch;
        const refreshToken = params.get('refresh_token') || refreshTokenFromSearch || '';

        if (accessToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (data?.user) {
            await ensureProfile(data.user);
            setStatus('success');
            setMsg('Email vérifié ! Redirection…');
            setTimeout(() => navigate('/', { replace: true }), 1200);
            return;
          }
        }
      }

      // ── 2. token_hash dans les query params ou le hash route (iOS + PKCE)
      const hashRoute      = rawHash.includes('?') ? rawHash.split('?')[1] : '';
      const hashRouteParams = new URLSearchParams(hashRoute);

      const tokenHash = searchParams.get('token_hash') || hashRouteParams.get('token_hash');
      const token     = searchParams.get('token')      || hashRouteParams.get('token');
      const type      = searchParams.get('type')       || hashRouteParams.get('type') || 'signup';

      if (tokenHash || token) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash || token,
          type: type === 'recovery' ? 'recovery' : 'signup',
        });
        if (error) throw error;
        if (data?.user) {
          await ensureProfile(data.user);
          setStatus('success');
          setMsg('Email vérifié ! Redirection…');
          setTimeout(() => navigate('/', { replace: true }), 1200);
          return;
        }
      }

      // ── 3. Session déjà active (Supabase a tout géré côté serveur)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await ensureProfile(session.user);
        setStatus('success');
        setMsg('Compte vérifié ! Redirection…');
        setTimeout(() => navigate('/', { replace: true }), 1200);
        return;
      }

      // ── 4. Rien trouvé → login
      setStatus('error');
      setMsg('Lien expiré ou déjà utilisé. Reconnecte-toi.');
      setTimeout(() => navigate('/login', { replace: true }), 2500);

    } catch (err) {
      console.error('[AuthCallback]', err);
      setStatus('error');
      setMsg(err.message?.includes('expired') || err.message?.includes('invalid')
        ? 'Lien expiré. Renvoie un email de confirmation depuis la page connexion.'
        : 'Erreur de vérification. Essaie de te connecter directement.');
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
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          created_at: new Date().toISOString(),
        }]);
      }
    } catch { /* non-bloquant */ }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Logo */}
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
            <p className="text-white font-semibold text-lg mb-1">Email vérifié ! 🎉</p>
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
