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
        // Récupérer les données du profil utilisateur de manière asynchrone
        // Ne pas bloquer le login, charger en arrière-plan
        setCurrentUser({ ...session.user });
        
        // Récupérer le profil en arrière-plan
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            setCurrentUser(prev => ({ ...prev, ...profile }));
          }
        } catch (error) {
          console.error('Erreur lors de la récupération du profil:', error);
        }
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
        // Si l'email est déjà utilisé, vérifier si l'utilisateur existe dans la base de données
        if (error.message.includes('already registered')) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
          
          if (existingUser) {
            return { 
              success: false, 
              message: 'Cet email est déjà utilisé. Veuillez vous connecter.' 
            };
          } else {
            // L'utilisateur existe dans auth mais pas dans la base de données
            return { 
              success: false, 
              message: 'Compte existant mais profil incomplet. Veuillez contacter le support.' 
            };
          }
        }
        
        return { 
          success: false, 
          message: error.message || 'Inscription échouée. Veuillez réessayer.' 
        };
      }

      // Créer le profil utilisateur dans la base de données
      if (data.user && !error) {
        try {
          const { error: profileError } = await supabase
            .from('users')
            .insert([
              {
                id: data.user.id,
                email: email,
                username: username,
                created_at: new Date().toISOString()
              }
            ]);
          
          if (profileError) {
            console.error('Erreur création profil:', profileError);
            // Ne pas bloquer l'inscription si le profil échoue
          }
        } catch (profileErr) {
          console.error('Erreur création profil:', profileErr);
        }
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
      console.log('Tentative de connexion pour:', email);
      
      // Connexion simple sans timeout manuel (Supabase gère ça nativement)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      console.log('Résultat connexion:', { data, error });
      
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
        
        return { 
          success: false, 
          message: error.message || 'Erreur de connexion. Veuillez réessayer.' 
        };
      }

      if (!data.user) {
        return { 
          success: false, 
          message: 'Utilisateur non trouvé. Veuillez vérifier vos identifiants.' 
        };
      }

      // Vérifier et créer le profil utilisateur si nécessaire
      try {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileError && profileError.code === 'PGRST116') {
          // Le profil n'existe pas, le créer
          console.log('Création du profil utilisateur pour:', data.user.email);
          const { error: createError } = await supabase
            .from('users')
            .insert([
              {
                id: data.user.id,
                email: data.user.email,
                username: data.user.user_metadata?.username || data.user.email.split('@')[0],
                created_at: new Date().toISOString()
              }
            ]);
          
          if (createError) {
            console.error('Erreur création profil:', createError);
            // Ne pas bloquer la connexion pour ça
          }
        }
      } catch (profileErr) {
        console.error('Erreur vérification profil:', profileErr);
        // Ne pas bloquer la connexion
      }

      return { 
        success: true, 
        message: 'Connexion réussie!' 
      };
      
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.message || 'Erreur de connexion. Veuillez réessayer.' 
      };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        // Forcer la déconnexion même en cas d'erreur
        setCurrentUser(null);
        return { success: false, error: error.message };
      }
      setCurrentUser(null);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      setCurrentUser(null);
      return { success: false, error: error.message };
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
