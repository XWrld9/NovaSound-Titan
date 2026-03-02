import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Auth state listener ──────────────────────────────────────────────────
  useEffect(() => {
    // iOS Safari peut perdre la session au reload — on la récupère explicitement d'abord
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setInitialLoading(false);
    }).catch(() => {
      setInitialLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Sur iOS/Android, SIGNED_IN après vérification email ou OAuth
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          setCurrentUser(session?.user ?? null);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        } else {
          setCurrentUser(session?.user ?? null);
        }
        setInitialLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Enrichissement profil DB (séparé du listener auth) ───────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    // Ne pas re-enrichir si le profil est déjà chargé
    if (currentUser.username || currentUser.avatar_url) return;

    const loadProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('username, avatar_url, bio')
          .eq('id', currentUser.id)
          .single();
        if (profile) {
          setCurrentUser(prev => ({ ...prev, ...profile }));
        }
      } catch { /* non-bloquant */ }
    };

    loadProfile();
  }, [currentUser?.id]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getEmailRedirectTo = () => {
    try {
      const origin = window.location.origin;
      // iOS Safari a parfois un origin vide — fallback sur href
      if (!origin || origin === 'null') {
        const url = new URL(window.location.href);
        // /#/auth/callback : composant dédié qui gère tous les cas iOS
        return `${url.protocol}//${url.host}/#/auth/callback`;
      }
      // HashRouter : /#/auth/callback gère le token_hash, access_token et session active
      return `${origin}/#/auth/callback`;
    } catch {
      return undefined;
    }
  };

  const ensureProfile = async (user) => {
    try {
      const { data } = await supabase.from('users').select('id').eq('id', user.id).single();
      if (!data) {
        await supabase.from('users').insert([{
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email.split('@')[0],
          created_at: new Date().toISOString()
        }]);
      }
    } catch { /* non-bloquant */ }
  };

  // ── Signup ───────────────────────────────────────────────────────────────
  const signup = async (email, password, passwordConfirm, username) => {
    if (password !== passwordConfirm) {
      return { success: false, message: 'Les mots de passe ne correspondent pas' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          data: { username: cleanUsername }
        }
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        const status = error.status || 0;

        // ── Rate limit ──────────────────────────────────────────────────────
        if (
          status === 429 ||
          msg.includes('rate limit') ||
          msg.includes('too many') ||
          msg.includes('email rate') ||
          msg.includes('over_email_send_rate_limit')
        ) {
          return {
            success: false,
            message: '⏳ Trop de tentatives. Attendez 60 secondes puis réessayez.'
          };
        }

        // ── Erreur SMTP / envoi email ───────────────────────────────────────
        // Le compte est CRÉÉ côté auth.users mais l'email n'a pas pu être envoyé.
        // On retourne succès partiel → l'user peut renv oyer depuis la page login.
        if (
          msg.includes('error sending confirmation email') ||
          msg.includes('sending confirmation') ||
          msg.includes('smtp') ||
          msg.includes('email sending') ||
          msg.includes('error sending') ||
          msg.includes('mail') ||
          (status === 500 && (msg.includes('email') || msg.includes('confirmation') || msg.includes('mail')))
        ) {
          // Forcer la création du profil ici car le trigger a peut-être échoué aussi
          try {
            await supabase.from('users').insert([{
              id: data?.user?.id,
              email: cleanEmail,
              username: cleanUsername,
              created_at: new Date().toISOString()
            }]);
          } catch { /* déjà existant, non-bloquant */ }

          return {
            success: true,
            emailError: true,
            message: '✅ Compte créé ! Problème d\'envoi d\'email détecté (configuration SMTP). Allez sur la page connexion et cliquez "Renvoyer l\'email de confirmation". Ou demandez à l\'admin de désactiver la confirmation email dans Supabase Auth Settings.'
          };
        }

        // ── Erreur base de données ──────────────────────────────────────────
        if (
          msg.includes('database error') ||
          msg.includes('saving new user') ||
          msg.includes('duplicate key') ||
          msg.includes('unique constraint') ||
          msg.includes('violates') ||
          (status === 500 && !msg.includes('email'))
        ) {
          return {
            success: false,
            message: '⚠️ Erreur de base de données. Ce nom d\'utilisateur est peut-être déjà pris. Essayez un autre nom d\'utilisateur.'
          };
        }

        // ── Email déjà utilisé ──────────────────────────────────────────────
        if (
          msg.includes('already registered') ||
          msg.includes('user already registered') ||
          msg.includes('already exists')
        ) {
          return { success: false, message: 'Cet email est déjà utilisé. Connectez-vous.' };
        }

        // ── Autres erreurs connues ──────────────────────────────────────────
        if (msg.includes('invalid email')) {
          return { success: false, message: 'Adresse email invalide.' };
        }
        if (msg.includes('weak password') || msg.includes('password should')) {
          return { success: false, message: 'Mot de passe trop faible. Minimum 8 caractères.' };
        }

        return { success: false, message: error.message };
      }

      if (!data?.user) return { success: false, message: 'Échec de la création du compte.' };

      // Email déjà utilisé non confirmé (Supabase ne renvoie pas d'erreur dans ce cas)
      if (data.user && !data.user.confirmed_at && data.user.identities?.length === 0) {
        return {
          success: false,
          message: 'Cet email est déjà utilisé. Connectez-vous ou vérifiez votre boîte mail pour confirmer votre compte.',
          needsVerification: true
        };
      }

      // Créer le profil en base (fallback si le trigger n'a pas tourné)
      try {
        await supabase.from('users').insert([{
          id: data.user.id,
          email: cleanEmail,
          username: cleanUsername,
          created_at: new Date().toISOString()
        }]);
      } catch { /* le trigger l'a déjà créé → non-bloquant */ }

      // Si data.session existe → confirmation email désactivée → connexion directe
      if (data.session) {
        return {
          success: true,
          autoLogin: true,
          message: '🎉 Compte créé ! Connexion automatique en cours...'
        };
      }

      // Confirmation email activée → demander à l'user de vérifier sa boîte
      return {
        success: true,
        message: '✅ Compte créé ! Vérifiez votre boîte mail (et vos spams) puis cliquez sur le lien de confirmation pour vous connecter.'
      };

    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('rate') || msg.includes('too many')) {
        return { success: false, message: '⏳ Trop de tentatives. Attendez 60 secondes et réessayez.' };
      }
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('abort')) {
        return { success: false, message: '⚠️ Erreur réseau. Vérifiez votre connexion et réessayez.' };
      }
      return { success: false, message: err.message || 'Erreur technique lors de l\'inscription.' };
    }
  };

  // ── Login ────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        if (error.message?.includes('Email not confirmed')) {
          return {
            success: false,
            message: 'Votre email n\'est pas encore confirmé. Vérifiez vos spams ou utilisez le bouton "Renvoyer l\'email de confirmation" ci-dessous.',
            needsVerification: true
          };
        }
        if (error.message?.includes('Invalid login credentials')) {
          // Supabase renvoie ce message aussi quand l'email n'est pas confirmé
          // On propose toujours le renvoi de confirmation pour éviter la confusion
          return {
            success: false,
            message: 'Email ou mot de passe incorrect. Si vous venez de créer votre compte, vérifiez votre boîte mail (spams inclus) et confirmez votre email avant de vous connecter.',
            needsVerification: true
          };
        }
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('abort') || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          return { success: false, message: '⚠️ Connexion réseau instable. Vérifiez votre connexion Wi-Fi ou données mobiles et réessayez.' };
        }
        return { success: false, message: error.message };
      }

      if (!data?.user) return { success: false, message: 'Utilisateur non trouvé.' };

      // S'assurer que le profil existe
      await ensureProfile(data.user);

      return { success: true, message: 'Connexion réussie !' };
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('abort') || err?.message?.includes('fetch') || err?.message?.includes('network')) {
        return { success: false, message: '⚠️ Connexion interrompue. Vérifiez votre réseau et réessayez.' };
      }
      return { success: false, message: err.message || 'Erreur de connexion. Réessayez.' };
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      return { success: true };
    } catch {
      setCurrentUser(null);
      return { success: true };
    }
  };

  // ── Send password reset email ────────────────────────────────────────────
  const sendPasswordReset = async (email) => {
    try {
      const redirectTo = window.location.origin + '/#/reset-password';
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Email de réinitialisation envoyé ! Vérifiez votre boîte mail (et vos spams).' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ── Update password (after reset link) ──────────────────────────────────
  const updatePassword = async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Mot de passe mis à jour avec succès !' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ── Resend verification ──────────────────────────────────────────────────
  const resendVerification = async (email) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: getEmailRedirectTo() }
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Email de vérification envoyé !' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ── Update profile ───────────────────────────────────────────────────────
  const updateProfile = async (updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, message: 'Utilisateur non connecté' };

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) return { success: false, message: error.message };

      // Injecter un timestamp pour forcer le rechargement de l'avatar dans le Header
      setCurrentUser(prev => ({ ...prev, ...data, _avatarTs: Date.now() }));
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ── Clear corrupted session ──────────────────────────────────────────────
  const clearCorruptedSession = () => {
    try {
      const keys = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('supabase.') || key.startsWith('novasound.'))) {
            keys.push(key);
          }
        }
        keys.forEach(key => { try { localStorage.removeItem(key); } catch {} });
      } catch { /* mode privé iOS */ }
    } catch { /* ignore */ }
    setCurrentUser(null);
    setInitialLoading(false);
  };

  const value = {
    currentUser,
    isAuthenticated: !!currentUser,
    initialLoading,
    signup,
    login,
    logout,
    resendVerification,
    sendPasswordReset,
    updatePassword,
    updateProfile,
    updateUser: setCurrentUser,
    clearCorruptedSession,
    supabase
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
