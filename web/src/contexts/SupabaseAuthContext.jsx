import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, supabase } from '@/lib/supabaseClient';

const SupabaseAuthContext = createContext();

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
};

export const SupabaseAuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const updateUser = (userData) => {
    setCurrentUser(userData);
  };

  useEffect(() => {
    // Vérifier l'utilisateur actuel au montage
    const initializeAuth = async () => {
      try {
        const { user } = await auth.getCurrentUser();
        if (user) {
          // Récupérer les données du profil utilisateur
          const { data: profile } = await db.getUserById(user.id);
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
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Récupérer les données du profil utilisateur
        const { data: profile } = await db.getUserById(session.user.id);
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
        message: 'Passwords do not match' 
      };
    }

    try {
      const { data, error } = await auth.signUp(email, password, username);
      
      if (error) {
        return { 
          success: false, 
          message: error.message || 'Signup failed. Please try again.' 
        };
      }

      return { 
        success: true, 
        message: 'Account created! Please check your email to verify your account.' 
      };
    } catch (error) {
      console.error('Signup error:', error);
      return { 
        success: false, 
        message: error.message || 'Signup failed. Please try again.' 
      };
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await auth.signIn(email, password);
      
      if (error) {
        // Vérifier si c'est une erreur de vérification email
        if (error.message && error.message.includes('verify')) {
          return { 
            success: false, 
            message: 'Please verify your email before logging in. Check your inbox for the verification link.',
            needsVerification: true
          };
        }
        
        return { 
          success: false, 
          message: error.message || 'Invalid email or password' 
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.message || 'Invalid email or password' 
      };
    }
  };

  const logout = async () => {
    try {
      const { error } = await auth.signOut();
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
      });
      
      if (error) {
        return { 
          success: false, 
          message: error.message || 'Failed to send verification email' 
        };
      }
      
      return { success: true, message: 'Verification email sent! Please check your inbox.' };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to send verification email' 
      };
    }
  };

  const updateProfile = async (userId, data) => {
    try {
      const { data: updated, error } = await db.updateUser(userId, data);
      
      if (error) {
        return { 
          success: false, 
          message: error.message || 'Failed to update profile' 
        };
      }
      
      setCurrentUser(prev => ({ ...prev, ...updated }));
      return { success: true, user: updated };
    } catch (error) {
      console.error('Update profile error:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to update profile' 
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
    initialLoading
  };

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
};
