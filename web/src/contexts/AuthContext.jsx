import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';

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

  const updateUser = (userData) => {
    setCurrentUser(userData);
  };

  useEffect(() => {
    // Check if user is already authenticated on mount
    if (pb.authStore.isValid && pb.authStore.model) {
      setCurrentUser(pb.authStore.model);
    }
    setInitialLoading(false);

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setCurrentUser(model);
    });

    return () => unsubscribe();
  }, []);

  const signup = async (email, password, passwordConfirm, username) => {
    try {
      const data = {
        email,
        password,
        passwordConfirm,
        username,
        emailVisibility: true
      };

      const record = await pb.collection('users').create(data);
      
      // Request email verification
      await pb.collection('users').requestVerification(email);
      
      return { success: true, message: 'Account created! Please check your email to verify your account.' };
    } catch (error) {
      console.error('Signup error:', error);
      return { 
        success: false, 
        message: error.response?.data?.email?.message || error.message || 'Signup failed. Please try again.' 
      };
    }
  };

  const login = async (email, password) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      setCurrentUser(authData.record);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      // Check if it's email verification error
      if (error.message && error.message.includes('verify')) {
        return { 
          success: false, 
          message: 'Please verify your email before logging in. Check your inbox for the verification link.',
          needsVerification: true
        };
      }
      
      return { 
        success: false, 
        message: error.response?.message || error.message || 'Invalid email or password' 
      };
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
  };

  const resendVerification = async (email) => {
    try {
      await pb.collection('users').requestVerification(email);
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
      const updated = await pb.collection('users').update(userId, data, { $autoCancel: false });
      setCurrentUser(updated);
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};