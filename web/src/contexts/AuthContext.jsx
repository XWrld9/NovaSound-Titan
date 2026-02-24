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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Callback SYNC obligatoire pour Supabase
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
          .select('username, display_name, avatar_url, bio')
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
    try { return `${window.location.origin}/#/`; } catch { return undefined; }
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
        if (error.message?.includes('already registered')) {
          return { success: false, message: 'Cet email est déjà utilisé. Connectez-vous.' };
        }
        return { success: false, message: error.message };
      }

      if (!data?.user) return { success: false, message: 'Échec de la création du compte.' };

      // Créer le profil
      await supabase.from('users').insert([{
        id: data.user.id,
        email: cleanEmail,
        username: cleanUsername,
        created_at: new Date().toISOString()
      }]);

      return {
        success: true,
        message: 'Compte créé ! Vérifiez votre email pour activer votre compte.'
      };
    } catch (err) {
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
        return { success: false, message: error.message };
      }

      if (!data?.user) return { success: false, message: 'Utilisateur non trouvé.' };

      // S'assurer que le profil existe
      await ensureProfile(data.user);

      return { success: true, message: 'Connexion réussie !' };
    } catch (err) {
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

      setCurrentUser(prev => ({ ...prev, ...data }));
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ── Clear corrupted session ──────────────────────────────────────────────
  const clearCorruptedSession = () => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('supabase.') || key.startsWith('novasound.')) {
          localStorage.removeItem(key);
        }
      });
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
