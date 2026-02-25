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
        setCurrentUser(session?.user ?? null);
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
        return `${url.protocol}//${url.host}/`;
      }
      return `${origin}/`;
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
        // Rate limit Supabase (429 ou message contenant rate/limit/too many)
        if (
          error.status === 429 ||
          error.message?.toLowerCase().includes('rate limit') ||
          error.message?.toLowerCase().includes('too many') ||
          error.message?.toLowerCase().includes('email rate') ||
          error.message?.toLowerCase().includes('over_email_send_rate_limit')
        ) {
          return {
            success: false,
            message: '⏳ Limite de tentatives atteinte. Attendez 60 secondes puis réessayez. Si le problème persiste, essayez avec une autre adresse email.'
          };
        }
        if (error.message?.includes('already registered') || error.message?.includes('User already registered')) {
          return { success: false, message: 'Cet email est déjà utilisé. Connectez-vous.' };
        }
        if (error.message?.includes('invalid email')) {
          return { success: false, message: 'Adresse email invalide.' };
        }
        if (error.message?.includes('weak password') || error.message?.includes('Password should')) {
          return { success: false, message: 'Mot de passe trop faible. Utilisez au moins 8 caractères.' };
        }
        return { success: false, message: error.message };
      }

      if (!data?.user) return { success: false, message: 'Échec de la création du compte.' };

      // Cas où l'utilisateur existe déjà mais non confirmé — Supabase renvoie un user sans erreur
      if (data.user && !data.user.confirmed_at && data.user.identities?.length === 0) {
        return { success: false, message: 'Cet email est déjà utilisé. Connectez-vous ou vérifiez votre boîte mail.' };
      }

      // Créer le profil en base
      try {
        await supabase.from('users').insert([{
          id: data.user.id,
          email: cleanEmail,
          username: cleanUsername,
          created_at: new Date().toISOString()
        }]);
      } catch { /* profil peut déjà exister, non-bloquant */ }

      return {
        success: true,
        message: '✅ Compte créé ! Vérifiez votre boîte mail (et vos spams) pour activer votre compte.'
      };
    } catch (err) {
      if (err?.message?.toLowerCase().includes('rate') || err?.message?.toLowerCase().includes('too many')) {
        return { success: false, message: '⏳ Trop de tentatives. Attendez 60 secondes et réessayez.' };
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
        if (error.message?.includes('Invalid login credentials')) {
          return { success: false, message: 'Email ou mot de passe incorrect.' };
        }
        if (error.message?.includes('Email not confirmed')) {
          return {
            success: false,
            message: 'Veuillez confirmer votre email avant de vous connecter.',
            needsVerification: true
          };
        }
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('abort') || error.message?.includes('Failed to fetch')) {
          return { success: false, message: 'Connexion réseau instable. Vérifiez votre connexion et réessayez.' };
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
    updateProfile,
    updateUser: setCurrentUser,
    clearCorruptedSession,
    supabase
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
