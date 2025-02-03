import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { User, Session, AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import type { Profile } from '@/types/supabase';
import { logger } from '@/lib/logger'; 
import { logOnce } from '@/lib/utils';
// Define the shape of our authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<{ error?: Error }>;
  logout: () => Promise<void>;
  initialized: boolean;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

// Define the internal state type
interface AuthState {
  user: User | null;
  loading: boolean;
  error: SupabaseAuthError | Error | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  initialized: boolean;
}

// Create the context with proper typing for JSX usage
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    profile: null,
    isAuthenticated: false,
    initialized: false
  });
  
  const navigate = useNavigate();
  const { validateSession } = useSession();
  const { toast } = useToast();
  const { fetchProfile } = useProfile();

  const login = useCallback(async (email: string, password: string): Promise<{ error?: Error }> => {
    const MAX_RETRIES = 3;
    const AUTH_DELAY = 1000; // 1 second delay after auth
    const RETRY_DELAY = 1000; // 1 second between retries

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Step 1: Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!data.user) {
        throw new Error('No user data received');
      }

      // Add delay after successful auth to ensure token is stored
      await new Promise(resolve => setTimeout(resolve, AUTH_DELAY));

      // Step 2: Validate session with retries
      let session: Session | null = null;
      let retries = 0;
      let lastError: Error | null = null;

      while (retries < MAX_RETRIES && !session) {
        try {
          const validatedSession = await validateSession();
          if (validatedSession) {
            session = validatedSession;
            break;
          }
          
          console.warn(`Session validation attempt ${retries + 1} failed`);
          if (retries < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        } catch (error) {
          lastError = error instanceof Error 
            ? error 
            : new Error('Unknown session validation error');
            
          if (retries < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
        retries++;
      }

      if (!session) {
        throw new Error(
          lastError
            ? `Failed to validate session after ${MAX_RETRIES} attempts: ${lastError.message}`
            : `Failed to validate session after ${MAX_RETRIES} attempts`
        );
      }

      // Step 3: Load user profile
      const profile = await fetchProfile(data.user.id);
      
      // Step 4: Update auth state
      setState(prev => ({
        ...prev,
        user: data.user,
        profile,
        isAuthenticated: true,
        loading: false,
        error: null,
        initialized: true
      }));

      return {}; // Success case - no error
    } catch (error: unknown) {
      const loginError = new Error(error instanceof Error ? error.message : 'Login failed');
      logOnce('login-error', 'Login error:', loginError);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: loginError,
        initialized: true
      }));
      return { error: loginError };
    }
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      await supabase.auth.signOut();
      setState({
        user: null,
        loading: false,
        error: null,
        profile: null,
        isAuthenticated: false,
        initialized: Boolean(true)
      });
      navigate('/login', { replace: true });
    } catch (error) {
      logOnce('logout-error', 'Logout error:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error : new Error('Logout failed')
      }));
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive"
      });
    }
  }, [navigate, toast]);

  // Handle auth state changes
  const handleAuthStateChange = useCallback(async (event: string, session: any) => {
    try {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState(prev => ({
          ...prev,
          user: session.user,
          profile,
          loading: false,
          error: null,
          isAuthenticated: true,
          initialized: true
        }));
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          loading: false,
          error: null,
          profile: null,
          isAuthenticated: false,
          initialized: true
        });
      }
    } catch (error) {
      logOnce('auth-state-change-error', 'Auth state change error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Auth state change failed'),
        loading: false
      }));
    }
  }, [fetchProfile]);

  // Initialize auth state with proper error handling and cleanup
  useEffect(() => {
    const abortController = new AbortController();
    let cleanup = () => {};

    const initAuth = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, initialized: false }));
        logger.debug(`[${window.performance.now().toFixed(0)}] Auth init started`);

        const session = await validateSession();
        if (abortController.signal.aborted) return;

        if (session?.user) {
          try {
            logger.debug(`[${window.performance.now().toFixed(0)}] Session found, fetching profile...`);
            const profile = await fetchProfile(session.user.id);
            if (abortController.signal.aborted) return;

            setState(prev => ({
              ...prev,
              user: session.user,
              profile,
              loading: false,
              error: null,
              isAuthenticated: true,
              initialized: true
            }));
            logger.debug(`[${window.performance.now().toFixed(0)}] Auth init success, user authenticated and profile loaded`, { userId: session.user.id, hasProfile: !!profile });
          } catch (profileError) {
            if (!abortController.signal.aborted) {
              logger.error(`[${window.performance.now().toFixed(0)}] Profile fetch error during auth init:`, (profileError as Error).message);
              setState(prev => ({
                ...prev,
                user: session.user,
                profile: null,
                loading: false,
                error: profileError instanceof Error ? profileError : new Error('Failed to fetch profile'),
                isAuthenticated: true,
                initialized: true
              }));
              logger.debug(`[${window.performance.now().toFixed(0)}] Auth init success (no profile), user authenticated but profile fetch failed`, { userId: session.user.id, profileError: (profileError as Error).message });
            }
          }
        } else {
          setState(prev => ({
            ...prev,
            user: null,
            profile: null,
            loading: false,
            error: null,
            isAuthenticated: false,
            initialized: true
          }));
          logger.debug(`[${window.performance.now().toFixed(0)}] Auth init success, no session found, user not authenticated`);
        }
        logger.debug(`[${window.performance.now().toFixed(0)}] Auth initialization complete, initialized state set to true`);

        // Set up auth state change listener after initialization
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!abortController.signal.aborted) {
              await handleAuthStateChange(event, session);
            }
          }
        );

        cleanup = () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        logger.error(`[${window.performance.now().toFixed(0)}] Auth initialization error:`, (error as Error).message);
        if (!abortController.signal.aborted) {
          setState(prev => ({
            ...prev,
            user: null,
            profile: null,
            loading: false,
            error: error instanceof Error ? error : new Error('Auth initialization failed'),
            isAuthenticated: false,
            initialized: true
          }));
          logger.debug(`[${window.performance.now().toFixed(0)}] Auth init failed`, { error: (error as Error).message });
        }
      }
    };

    initAuth();

    return () => {
      abortController.abort();
      cleanup();
    };
  }, [validateSession, fetchProfile, handleAuthStateChange]);

  // Ensure the context value matches AuthContextType exactly
  const contextValue: AuthContextType = {
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    user: state.user,
    login,
    logout,
    initialized: state.initialized
  };

  return React.createElement(AuthContext.Provider, { value: contextValue }, children);
};

export const useAuth = (): AuthContextType => {
  const context = useContext<AuthContextType | undefined>(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
