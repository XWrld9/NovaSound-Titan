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
    // Récupérer la session existante AU DÉBUT
    const initializeSession = async () => {
      try {
        console.log('🔍 Vérification session initiale...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erreur getSession:', error);
          setInitialLoading(false);
          return;
        }
        
        if (session?.user) {
          console.log('✅ Session trouvée:', session.user.email);
          setCurrentUser({ ...session.user });
          
          // Récupérer le profil en arrière-plan
          try {
            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profileError) {
              console.error('Erreur profil:', profileError);
              // Créer le profil s'il n'existe pas
              if (profileError.code === 'PGRST116') {
                console.log('🔧 Création profil manquant...');
                const { error: createError } = await supabase
                  .from('users')
                  .insert([
                    {
                      id: session.user.id,
                      email: session.user.email,
                      username: session.user.user_metadata?.username || session.user.email.split('@')[0],
                      created_at: new Date().toISOString()
                    }
                  ]);
                
                if (createError) {
                  console.error('Erreur création profil:', createError);
                }
              }
            }
            
            // Mettre à jour avec les données du profil
            if (profile) {
              setCurrentUser(prev => ({ ...prev, ...profile }));
            }
          } catch (profileErr) {
            console.error('Erreur chargement profil:', profileErr);
          }
        } else {
          console.log('👋 Aucune session trouvée');
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('💥 Erreur initialiseSession:', err);
        setCurrentUser(null);
      } finally {
        // TOUJOURS arrêter le loading
        setInitialLoading(false);
      }
    };

    // Exécuter l'initialisation
    initializeSession();

    // Ensuite, écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Utilisateur vient de se connecter
        try {
          // Récupérer les données du profil utilisateur
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            console.error('Erreur profil:', profileError);
            // Créer le profil s'il n'existe pas
            if (profileError.code === 'PGRST116') {
              console.log('🔧 Création profil manquant...');
              const { error: createError } = await supabase
                .from('users')
                .insert([
                  {
                    id: session.user.id,
                    email: session.user.email,
                    username: session.user.user_metadata?.username || session.user.email.split('@')[0],
                    created_at: new Date().toISOString()
                  }
                ]);
              
              if (createError) {
                console.error('Erreur création profil:', createError);
              }
            }
          }
          
          // Mettre à jour l'utilisateur avec ou sans profil
          setCurrentUser({ ...session.user, ...(profile || {}) });
          console.log('✅ Utilisateur connecté et profil chargé');
          
        } catch (error) {
          console.error('Erreur chargement profil:', error);
          // Mettre quand même l'utilisateur sans profil
          setCurrentUser({ ...session.user });
        }
      } else if (event === 'SIGNED_OUT') {
        // Utilisateur déconnecté
        console.log('👋 Utilisateur déconnecté');
        setCurrentUser(null);
      }
      // PAS BESOIN de setInitialLoading(false) ici, déjà fait dans initializeSession
    });

    return () => subscription.unsubscribe();
  }, []);

  const signup = async (email, password, passwordConfirm, username) => {
    console.log('🚀 INSCRIPTION SIMPLE ET DIRECTE pour:', email);
    
    if (password !== passwordConfirm) {
      return { 
        success: false, 
        message: 'Les mots de passe ne correspondent pas' 
      };
    }

    // Nettoyer les données
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    try {
      // Inscription DIRECTE sans retry
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          data: {
            username: cleanUsername,
            emailVisibility: true
          }
        }
      });
      
      console.log('📍 Résultat inscription directe:', { data, error });
      
      if (error) {
        console.error('❌ Erreur inscription:', error);
        
        // Gérer les erreurs simples
        if (error.message?.includes('already registered') || 
            error.message?.includes('User already registered')) {
          return { 
            success: false, 
            message: 'Cet email est déjà utilisé. Veuillez vous connecter.' 
          };
        }
        
        return { 
          success: false, 
          message: error.message || 'Inscription échouée. Veuillez réessayer.' 
        };
      }

      if (!data?.user) {
        return { 
          success: false, 
          message: 'Échec de la création du compte. Veuillez réessayer.' 
        };
      }

      console.log('✅ INSCRIPTION RÉUSSIE !');
      
      // Création du profil utilisateur
      try {
        console.log('� Création du profil utilisateur...');
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: cleanEmail,
              username: cleanUsername,
              created_at: new Date().toISOString()
            }
          ]);
        
        if (profileError) {
          console.error('⚠️ Erreur création profil:', profileError);
        } else {
          console.log('✅ Profil créé avec succès');
        }
      } catch (profileErr) {
        console.error('⚠️ Erreur création profil:', profileErr);
      }
      
      return { 
        success: true, 
        message: 'Compte créé! Veuillez vérifier votre email pour activer votre compte.' 
      };
      
    } catch (error) {
      console.error('💥 ERREUR INSCRIPTION:', error);
      return { 
        success: false, 
        message: error.message || 'Erreur technique lors de l\'inscription. Veuillez réessayer.' 
      };
    }
  };

  const login = async (email, password) => {
    console.log('🚀 CONNEXION SIMPLE ET DIRECTE pour:', email);
    
    // Nettoyer l'email
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      // Connexion DIRECTE sans retry, sans timeout, sans complexité
      console.log('📍 Appel signInWithPassword...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password // Utiliser le mot de passe exactement comme fourni
      });
      
      console.log('📍 Résultat connexion directe:', { 
        data: data ? 'OK' : 'NULL', 
        error: error?.message || 'NONE', 
        passwordLength: password?.length,
        userId: data?.user?.id,
        userEmail: data?.user?.email
      });
      
      if (error) {
        console.error('❌ Erreur Supabase:', error);
        
        // Messages d'erreur simples et clairs
        if (error.message?.includes('Invalid login credentials')) {
          return { 
            success: false, 
            message: 'Email ou mot de passe incorrect. Vérifiez la casse (majuscules/minuscules).' 
          };
        }
        
        if (error.message?.includes('Email not confirmed')) {
          return { 
            success: false, 
            message: 'Veuillez vérifier votre email avant de vous connecter.',
            needsVerification: true
          };
        }
        
        return { 
          success: false, 
          message: error.message || 'Erreur de connexion. Veuillez réessayer.' 
        };
      }

      if (!data?.user) {
        console.error('❌ Pas de user dans la réponse');
        return { 
          success: false, 
          message: 'Utilisateur non trouvé. Vérifiez vos identifiants.' 
        };
      }

      console.log('✅ CONNEXION RÉUSSIE ! Session persistante activée.');
      console.log('📍 User ID:', data.user.id);
      console.log('📍 User Email:', data.user.email);
      
      // Forcer la mise à jour de l'état immédiatement
      setCurrentUser(data.user);
      
      // Créer le profil si nécessaire (simple et direct)
      try {
        console.log('🔍 Vérification profil utilisateur...');
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileError && (profileError.code === 'PGRST116' || profileError.message?.includes('No rows found'))) {
          console.log('🔧 Création du profil utilisateur...');
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
            console.error('⚠️ Erreur création profil:', createError);
          } else {
            console.log('✅ Profil créé');
          }
        } else if (profile) {
          // Mettre à jour avec les données du profil
          console.log('✅ Profil trouvé, mise à jour utilisateur');
          setCurrentUser({ ...data.user, ...profile });
        } else {
          console.log('✅ Profil déjà à jour');
        }
      } catch (profileErr) {
        console.error('⚠️ Erreur profil (non bloquant):', profileErr);
      }

      return { 
        success: true, 
        message: 'Connexion réussie !' 
      };
      
    } catch (error) {
      console.error('💥 ERREUR CONNEXION:', error);
      return { 
        success: false, 
        message: error.message || 'Erreur technique. Veuillez réessayer.' 
      };
    }
  };

  const logout = async () => {
    console.log('🚀 DÉBUT LOGOUT ULTRA-ROBUSTE');
    
    try {
      // ÉTAPE 1: Déconnexion Supabase avec retry
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`📍 Tentative logout ${attempts}/${maxAttempts}`);
        
        try {
          const { error } = await supabase.auth.signOut();
          
          if (!error) {
            console.log('✅ LOGOUT SUPABASE RÉUSSI');
            
            // ÉTAPE 2: Nettoyage complet de l'état local
            try {
              setCurrentUser(null);
              console.log('✅ État local nettoyé');
              
              // ÉTAPE 3: Nettoyage du localStorage (fallback)
              try {
                localStorage.removeItem('supabase.auth.token');
                localStorage.removeItem('supabase.auth.refreshToken');
                console.log('✅ LocalStorage nettoyé');
              } catch (storageError) {
                console.warn('⚠️ Erreur nettoyage localStorage:', storageError);
              }
              
              return { success: true };
              
            } catch (stateError) {
              console.error('❌ Erreur nettoyage état:', stateError);
              // Forcer le retour succès même si erreur
              return { success: true };
            }
          } else {
            console.error(`❌ Erreur logout ${attempts}:`, error);
            
            // Si c'est une erreur réseau, réessayer
            if (attempts < maxAttempts && 
                (error.message?.includes('timeout') || 
                 error.message?.includes('network') ||
                 error.message?.includes('fetch'))) {
              console.log(`🔄 Attente avant retry ${attempts + 1}...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              continue;
            }
            
            // Erreur fatale mais forcer le logout local
            setCurrentUser(null);
            return { success: true, error: error.message };
          }
        } catch (attemptError) {
          console.error(`❌ Erreur critique logout ${attempts}:`, attemptError);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
      
      // Forcer le logout local après toutes les tentatives
      console.log('🔄 FORCAGE LOGOUT LOCAL');
      setCurrentUser(null);
      return { success: true };
      
    } catch (globalError) {
      console.error('💥 ERREUR GLOBALE LOGOUT:', globalError);
      
      // Forcer le logout local en dernier recours
      try {
        setCurrentUser(null);
        localStorage.clear();
        return { success: true };
      } catch (forceError) {
        console.error('❌ Erreur forcage logout:', forceError);
        return { success: false, error: 'Erreur critique lors de la déconnexion.' };
      }
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

  // Fonction de diagnostic pour aider à résoudre les problèmes
  const diagnoseConnection = async () => {
    console.log('🔍 DÉBUT DIAGNOSTIC CONNEXION');
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      browser: navigator.userAgent,
      online: navigator.onLine,
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage
    };
    
    console.log('📊 Diagnostic:', diagnosis);
    
    try {
      // Test de connexion basique
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      diagnosis.databaseConnection = !error;
      diagnosis.databaseError = error?.message;
      
      if (error) {
        console.error('❌ Erreur connexion base:', error);
      } else {
        console.log('✅ Connexion base OK');
      }
    } catch (testError) {
      diagnosis.databaseConnection = false;
      diagnosis.databaseError = testError.message;
      console.error('❌ Erreur test base:', testError);
    }
    
    // Test de connexion auth
    try {
      const { data: { session } } = await supabase.auth.getSession();
      diagnosis.hasSession = !!session;
      diagnosis.sessionError = null;
    } catch (authError) {
      diagnosis.hasSession = false;
      diagnosis.sessionError = authError.message;
    }
    
    console.log('🏁 Diagnostic final:', diagnosis);
    return diagnosis;
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
    diagnoseConnection, // Exporter la fonction de diagnostic
    supabase // Exporter supabase pour les autres composants
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
