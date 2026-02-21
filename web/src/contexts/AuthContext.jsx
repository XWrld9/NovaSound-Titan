import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const getEmailRedirectTo = () => {
    try {
      return `${window.location.origin}/#/`;
    } catch {
      return undefined;
    }
  };

  const updateUser = (userData) => {
    setCurrentUser(userData);
  };

  useEffect(() => {
    // Vérifier l'utilisateur actuel au montage
    const initializeAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Récupérer les données du profil utilisateur
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          setCurrentUser({ ...user, ...profile });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    initializeAuth();

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Récupérer les données du profil utilisateur
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        setCurrentUser({ ...session.user, ...profile });
      } else {
        setCurrentUser(null);
      }
      setInitialLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signup = async (email, password, passwordConfirm, username) => {
    if (password !== passwordConfirm) {
      return { 
        success: false, 
        message: 'Les mots de passe ne correspondent pas' 
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          data: {
            username,
            emailVisibility: true
          }
        }
      });
      
      if (error) {
        return { 
          success: false, 
          message: error.message || 'Inscription échouée. Veuillez réessayer.' 
        };
      }

      return { 
        success: true, 
        message: 'Compte créé! Veuillez vérifier votre email pour activer votre compte.' 
      };
    } catch (error) {
      console.error('Signup error:', error);
      return { 
        success: false, 
        message: error.message || 'Inscription échouée. Veuillez réessayer.' 
      };
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Supabase login error:', error);
        
        // Gérer les erreurs spécifiques de Supabase
        if (error.message?.includes('Email not confirmed')) {
          return { 
            success: false, 
            message: 'Veuillez vérifier votre email avant de vous connecter. Consultez votre boîte de réception.',
            needsVerification: true
          };
        }
        
        if (error.message?.includes('Invalid login credentials')) {
          return { 
            success: false, 
            message: 'Email ou mot de passe incorrect' 
          };
        }
        
        if (error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
          return { 
            success: false, 
            message: 'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.' 
          };
        }
        
        if (error.message?.includes('Email rate limit exceeded')) {
          return { 
            success: false, 
            message: 'Limite d\'email atteinte. Veuillez réessayer plus tard ou contacter le support.' 
          };
        }
        
        // Message générique pour les autres erreurs
        return { 
          success: false, 
          message: error.message || 'Erreur de connexion. Veuillez réessayer.' 
        };
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: 'Erreur de connexion. Veuillez réessayer.' 
      };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const resendVerification = async (email) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: getEmailRedirectTo()
        }
      });
      
      if (error) {
        return { 
          success: false, 
          message: error.message || 'Échec de l\'envoi de l\'email de vérification' 
        };
      }
      
      return { success: true, message: 'Email de vérification envoyé! Consultez votre boîte de réception.' };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { 
        success: false, 
        message: error.message || 'Échec de l\'envoi de l\'email de vérification' 
      };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, message: 'Utilisateur non connecté' };
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) {
        return { 
          success: false, 
          message: error.message || 'Échec de la mise à jour du profil' 
        };
      }
      
      setCurrentUser(prev => ({ ...prev, ...data }));
      return { success: true, data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { 
        success: false, 
        message: error.message || 'Échec de la mise à jour du profil' 
      };
    }
  };

  const value = {
    currentUser,
    isAuthenticated: !!currentUser,
    signup,
    login,
    logout,
    resendVerification,
    updateProfile,
    updateUser,
    initialLoading,
    supabase // Exporter supabase pour les autres composants
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
